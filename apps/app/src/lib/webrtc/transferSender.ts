import { createFileWorker } from '@/lib/fileWorker';
import { getShortName } from '@/lib/deviceId';
import { logger } from '@/lib/logger';
import {
  deriveTransferKey,
  encryptTransferChunk,
  generateTransferSalt,
} from '@/lib/crypto/transferCrypto';
import { sendEncryptedDataControl } from './signalingClient';

const CHUNK_SIZE = 64 * 1024;
const BUFFER_HIGH_THRESHOLD = 1024 * 1024;

interface SendEncryptedFileOptions {
  file: File;
  fileId: string;
  targetDeviceId: string;
  dataChannel: RTCDataChannel;
  roomId: string;
  senderId: string;
  abortControllers: Map<string, AbortController>;
  onProgress: (progress: number) => void;
}

function streamEncryptedChunks(
  file: File,
  dataChannel: RTCDataChannel,
  transferKey: CryptoKey,
  transferId: string,
  abortController: AbortController,
  onProgress: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const worker = createFileWorker();
    let chunkIndex = 0;
    let lastProgress = 0;
    const terminate = () => worker.terminate();

    if (abortController.signal.aborted) {
      terminate();
      reject(new Error('Cancelled'));
      return;
    }

    abortController.signal.addEventListener('abort', () => {
      terminate();
      reject(new Error('Cancelled'));
    }, { once: true });

    worker.onmessage = async (event) => {
      if (event.data.type === 'transfer-done') {
        terminate();
        resolve();
        return;
      }
      if (event.data.type !== 'chunk-data') return;

      const { chunk, progressOffset, totalBytes } = event.data as {
        chunk: ArrayBuffer;
        progressOffset: number;
        totalBytes: number;
      };
      if (abortController.signal.aborted) {
        terminate();
        reject(new Error('Cancelled'));
        return;
      }
      if (dataChannel.readyState !== 'open') {
        terminate();
        reject(new Error('DataChannel closed'));
        return;
      }

      try {
        dataChannel.send(await encryptTransferChunk(transferKey, transferId, chunkIndex, chunk));
        chunkIndex += 1;
      } catch (error) {
        terminate();
        reject(error);
        return;
      }

      const progress = Math.min(100, Math.round((progressOffset / totalBytes) * 100));
      if (progress >= 100 || progress - lastProgress >= 1) {
        lastProgress = progress;
        onProgress(progress);
      }

      if (dataChannel.bufferedAmount > BUFFER_HIGH_THRESHOLD) {
        dataChannel.onbufferedamountlow = () => {
          dataChannel.onbufferedamountlow = null;
          worker.postMessage({ type: 'pull-chunk' });
        };
      } else {
        worker.postMessage({ type: 'pull-chunk' });
      }
    };

    worker.onerror = (error) => {
      terminate();
      reject(error);
    };
    worker.postMessage({ type: 'start-transfer', payload: { file, chunkSize: CHUNK_SIZE } });
  });
}

export async function sendEncryptedFile(options: SendEncryptedFileOptions): Promise<boolean> {
  const {
    file,
    fileId,
    targetDeviceId,
    dataChannel,
    roomId,
    senderId,
    abortControllers,
    onProgress,
  } = options;
  const abortKey = `${fileId}-${targetDeviceId}`;
  abortControllers.get(abortKey)?.abort();
  const abortController = new AbortController();
  abortControllers.set(abortKey, abortController);

  try {
    const transferId = crypto.randomUUID();
    const salt = generateTransferSalt();
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const transferKey = await deriveTransferKey(
      roomId,
      fileId,
      senderId,
      targetDeviceId,
      transferId,
      salt,
    );
    await sendEncryptedDataControl(dataChannel, roomId, senderId, targetDeviceId, 'file-start', {
      id: fileId,
      name: file.name,
      size: file.size,
      type: file.type,
      uploaderId: senderId,
      uploaderName: getShortName(senderId),
      uploadedAt: Date.now(),
      transferId,
      salt,
      totalChunks,
    });
    await streamEncryptedChunks(
      file,
      dataChannel,
      transferKey,
      transferId,
      abortController,
      onProgress,
    );
    await sendEncryptedDataControl(dataChannel, roomId, senderId, targetDeviceId, 'file-end', {
      fileId,
      transferId,
      totalChunks,
      totalBytes: file.size,
    });
    logger.info('Transfer', 'Encrypted file sent', targetDeviceId);
    return true;
  } catch (error) {
    if ((error as Error).message !== 'Cancelled') {
      logger.error('Transfer', 'Encrypted send failed');
    }
    return false;
  } finally {
    abortControllers.delete(abortKey);
  }
}
