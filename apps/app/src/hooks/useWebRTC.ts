import { useEffect, useRef, useCallback } from 'react';
import {
  useStore,
  type FileMetadata,
  type AutoExpireValue,
} from '@/store/store';
import { getSignalingServerUrl, ICE_SERVERS } from '@/lib/constants';
import { getDeviceId, getShortName } from '@/lib/deviceId';
import { trackTransferAttempt, trackTransferCompleted, trackTransferFailed } from '@/lib/analytics/reliability';
import { logger } from '@/lib/logger';
import { PROTOCOL_VERSION, isEncryptedRelayType, parseWireMessage, type EncryptedPayloadV1, type WireMessageV1 } from '@/protocol';
import { decryptPeerPayload } from '@/lib/crypto/roomCrypto';
import { decryptTransferChunk, deriveTransferKey, readTransferFrameId } from '@/lib/crypto/transferCrypto';
import { detectIcePath, parseCandidateType } from '@/lib/webrtc/ice';
import { generateThumbnail, sameFileIdentity } from '@/lib/webrtc/fileMetadata';
import { sendEncryptedDataControl, sendEncryptedSignal } from '@/lib/webrtc/signalingClient';
import { sendEncryptedFile } from '@/lib/webrtc/transferSender';
import {
  copyTextBlobToClipboard,
  finalizeReceivedFile as finalizeTransfer,
  type FileMetadataPayload,
} from '@/lib/webrtc/transferReceiver';
import { closeAllPeers, closePeer } from '@/lib/webrtc/peerManager';

// ============ Types ============

type SignalMessage = WireMessageV1;

type MemberPayload = {
  deviceId: string;
  displayName?: string;
  joinedAt: number;
};

type ChatMessagePayload = {
  text: string;
  senderId: string;
  senderName: string;
  timestamp: number;
};

interface FilePickerWindow extends Window {
  showSaveFilePicker?: (options: { suggestedName: string }) => Promise<{
    createWritable: () => Promise<FileSystemWritableFileStream>;
  }>;
}

type RoomSettingsPayload = {
  maxMembers: number;
  autoExpire: AutoExpireValue;
  requireApproval: boolean;
  hostManagement: boolean;
};

// ============ Constants ============

const BUFFER_LOW_THRESHOLD = 128 * 1024; // 128KB (2 chunks)
const PROGRESS_UPDATE_BYTES = 256 * 1024; // Update UI every 256KB (avoids 0% for long time on large files)
const ICE_DIAGNOSTICS = process.env.NEXT_PUBLIC_ICE_DIAGNOSTICS === 'true';
// ============ Hook ============

export const useWebRTC = () => {
  const ws = useRef<WebSocket | null>(null);
  const removedFromRoomRef = useRef(false);

  // Multi-peer connections: deviceId -> RTCPeerConnection
  const peers = useRef<Map<string, RTCPeerConnection>>(new Map());
  const dataChannels = useRef<Map<string, RTCDataChannel>>(new Map());
  const pendingIceCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  // File transfer state
  const pendingFiles = useRef<Map<string, File>>(new Map()); // fileId -> File
  const incomingChunks = useRef<Map<string, { meta: FileMetadataPayload; chunks: (ArrayBuffer | Blob)[]; receivedBytes: number; startTime: number; lastUpdateBytes?: number; transferId: string; transferKey: CryptoKey; nextChunk: number; totalChunks: number }>>(new Map());
  const incomingTransfers = useRef<Map<string, string>>(new Map());
  const earlyChunks = useRef<Map<string, ArrayBuffer[]>>(new Map()); // chunks arriving before file-start
  const receivedFileBlobs = useRef<Map<string, Blob>>(new Map()); // fileId -> Blob (text files only, for copy)
  const requestModes = useRef<Map<string, 'download' | 'copy'>>(new Map()); // requester intent by fileId
  const fileWriters = useRef<Map<string, FileSystemWritableFileStream>>(new Map());
  const sendFileToOneRef = useRef<(file: File, fileId: string, targetDeviceId: string) => Promise<void>>(
    async () => undefined,
  );
  const writeQueues = useRef<Map<string, Promise<void>>>(new Map()); // fileId -> Sequential Write Promise
  const sendAbortControllers = useRef<Map<string, AbortController>>(new Map()); // `${fileId}-${targetDeviceId}` -> AbortController
  const lastProgressReported = useRef<Map<string, number>>(new Map()); // fileId -> last % sent to sender

  // ============ Cleanup ============

  const cleanup = useCallback((roomIdOverride?: string) => {
    sendAbortControllers.current.forEach((ac) => ac.abort());
    sendAbortControllers.current.clear();

    closeAllPeers({
      peers: peers.current,
      dataChannels: dataChannels.current,
      pendingIceCandidates: pendingIceCandidates.current,
    });

    // Send explicit leave before closing so server removes us immediately
    const roomId = roomIdOverride ?? useStore.getState().currentRoom?.id;
    if (ws.current?.readyState === WebSocket.OPEN && roomId) {
      try {
        ws.current.send(JSON.stringify({ version: PROTOCOL_VERSION, type: 'leave', roomId }));
      } catch {
        // ignore
      }
    }

    // Close WebSocket and clear handlers to prevent state updates after cleanup
    if (ws.current) {
      ws.current.onclose = null;
      ws.current.onerror = null;
      ws.current.onmessage = null;
      ws.current.onopen = null;
      ws.current.close();
      ws.current = null;
    }

    incomingChunks.current.clear();
    incomingTransfers.current.clear();
    pendingFiles.current.clear();
    receivedFileBlobs.current.clear();
    requestModes.current.clear();
    fileWriters.current.clear();
    writeQueues.current.clear();
    lastProgressReported.current.clear();

    useStore.getState().reset();
  }, []);

  // ============ File Actions ============

  const finalizeReceivedFile = useCallback(async (fileId: string, meta: FileMetadataPayload, chunks: (ArrayBuffer | Blob)[]) => {
    const mode = requestModes.current.get(fileId) ?? 'download';
    requestModes.current.delete(fileId);
    await finalizeTransfer({
      fileId,
      metadata: meta,
      chunks,
      mode,
      receivedTextFiles: receivedFileBlobs.current,
    });
  }, []);

  // ============ Data Channel Handling ============

  const handleDataMessage = useCallback(async (senderDeviceId: string, data: unknown) => {
    const store = useStore.getState();

    // String messages (control messages)
    if (typeof data === 'string') {
      try {
        let msg = JSON.parse(data) as { version?: number; type?: string; payload?: unknown };
        const roomId = store.currentRoom?.id;
        const myDeviceId = store.deviceId;
        if (!roomId || !myDeviceId || msg.version !== PROTOCOL_VERSION || !msg.type || !msg.payload) return;
        if (['file-start', 'file-end', 'file-progress', 'file-cancel'].includes(msg.type)) {
          msg = {
            ...msg,
            payload: await decryptPeerPayload(roomId, msg.type, senderDeviceId, myDeviceId, msg.payload as EncryptedPayloadV1),
          };
        }

        if (msg.type === 'file-start') {
          // Receiving file data start
          const start = msg.payload as FileMetadataPayload & { transferId: string; salt: string; totalChunks: number };
          const meta = start;
          const transferKey = await deriveTransferKey(roomId, meta.id, senderDeviceId, myDeviceId, start.transferId, start.salt);
          logger.info('Transfer', 'Receiving encrypted file');

          // Ensure file exists in store (in case file-meta was missed)
          const existingFile = store.currentRoom?.files.find(f => f.id === meta.id);
          if (!existingFile) {
            store.addFile({
              name: meta.name,
              size: meta.size,
              type: meta.type,
              uploaderId: meta.uploaderId,
              uploaderName: meta.uploaderName,
              uploadedAt: meta.uploadedAt,
              direction: 'inbox',
              thumbnailUrl: meta.thumbnailUrl,
            }, meta.id);
          }

          const buffered = earlyChunks.current.get(meta.id);
          const receivedBytes = buffered ? buffered.reduce((s, c) => s + c.byteLength, 0) : 0;
          
          const writer = fileWriters.current.get(meta.id);
          if (writer && buffered && buffered.length > 0) {
            let q = writeQueues.current.get(meta.id) || Promise.resolve();
            for (const bChunk of buffered) {
              q = q.then(() => writer.write(bChunk)).catch(err => {
                logger.error('Transfer', `Early chunk write error: ${err}`);
              });
            }
            writeQueues.current.set(meta.id, q);
            incomingChunks.current.set(meta.id, { meta, chunks: [], receivedBytes, startTime: Date.now(), lastUpdateBytes: 0, transferId: start.transferId, transferKey, nextChunk: 0, totalChunks: start.totalChunks });
          } else {
            incomingChunks.current.set(meta.id, { meta, chunks: buffered ? [...buffered] : [], receivedBytes, startTime: Date.now(), lastUpdateBytes: 0, transferId: start.transferId, transferKey, nextChunk: 0, totalChunks: start.totalChunks });
          }
          incomingTransfers.current.set(start.transferId, meta.id);
          
          earlyChunks.current.delete(meta.id);
          if (buffered) {
            logger.info('Transfer', `Flushed ${buffered.length} early chunks (${receivedBytes} bytes)`, meta.id);
          }
          store.updateFileStatus(meta.id, 'downloading');
          store.updateFileProgress(meta.id, 0);

        } else if (msg.type === 'file-end') {
          // File transfer complete
          const end = msg.payload as { fileId: string; transferId: string; totalChunks: number; totalBytes: number };
          const fileId = end.fileId;
          const incoming = incomingChunks.current.get(fileId);

          if (incoming) {
            if (incoming.transferId !== end.transferId || incoming.nextChunk !== end.totalChunks || incoming.receivedBytes !== end.totalBytes) {
              store.updateFileStatus(fileId, 'error');
              throw new Error('Encrypted transfer was truncated');
            }
            // Ensure sender's avatar shows 100% before we remove downloader
            const dc = dataChannels.current.get(senderDeviceId);
            if (dc?.readyState === 'open') {
              void sendEncryptedDataControl(dc, roomId, myDeviceId, senderDeviceId, 'file-progress', { fileId, progress: 100 });
            }
            trackTransferCompleted(incoming.meta.size, Date.now() - incoming.startTime);
            logger.info('Transfer', 'Encrypted file transfer complete');
            store.updateFileStatus(fileId, 'completed');
            
            const writer = fileWriters.current.get(fileId);
            if (writer) {
              const prevWrite = writeQueues.current.get(fileId) || Promise.resolve();
              prevWrite.then(async () => {
                await writer.close();
                fileWriters.current.delete(fileId);
                writeQueues.current.delete(fileId);
              }).catch(err => console.error('Writer close err', err));
              // File is already saved directly to disk, so we skip Blob extraction & triggerDownload
              requestModes.current.delete(fileId);
            } else {
              void finalizeReceivedFile(fileId, incoming.meta, incoming.chunks);
            }
            
            // Auto-hide downloaded inbox file after a short delay (moves to trash)
            setTimeout(() => {
              const f = useStore.getState().currentRoom?.files.find((x) => x.id === fileId);
              if (f?.direction === 'inbox' && f.status === 'completed') {
                useStore.getState().removeFile(fileId);
              }
            }, 5000);
            incomingChunks.current.delete(fileId);
            incomingTransfers.current.delete(incoming.transferId);
            earlyChunks.current.delete(fileId);
            lastProgressReported.current.delete(fileId);
          }
        } else if (msg.type === 'file-progress') {
          // Receiver reports progress back to sender (for avatar display)
          const { fileId: fid, progress: pct } = msg.payload as { fileId: string; progress: number };
          if (typeof fid === 'string' && typeof pct === 'number') {
            store.updateFileDownloaderProgress(fid, senderDeviceId, Math.min(100, Math.max(0, pct)));
            // Only remove downloader when receiver has actually received 100% (not when sender's buffer is done)
            if (pct >= 100) {
              store.removeFileDownloader(fid, senderDeviceId);
            }
          }
        } else if (msg.type === 'file-cancel') {
          // Receiver cancelled download - abort send to that requester
          const { fileId: fid } = msg.payload as { fileId: string };
          if (typeof fid === 'string') {
            const key = `${fid}-${senderDeviceId}`;
            const ac = sendAbortControllers.current.get(key);
            if (ac) {
              ac.abort();
              sendAbortControllers.current.delete(key);
            }
            store.removeFileDownloader(fid, senderDeviceId);
          }
        }
      } catch {
        logger.warn('Transfer', 'Rejected invalid encrypted control message');
      }
      return;
    }

    // Binary data (file chunks) with fileId prefix
    if (data instanceof ArrayBuffer) {
      const transferId = readTransferFrameId(data);
      const fileId = incomingTransfers.current.get(transferId);
      if (!fileId) return;

      const incoming = incomingChunks.current.get(fileId);
      if (incoming) {
        let chunk: ArrayBuffer;
        try {
          chunk = await decryptTransferChunk(incoming.transferKey, data, incoming.transferId, incoming.nextChunk);
          incoming.nextChunk += 1;
        } catch (error) {
          store.updateFileStatus(fileId, 'error');
          logger.error('Transfer', 'Encrypted chunk rejected', String(error));
          return;
        }
        incoming.receivedBytes += chunk.byteLength;

        const writer = fileWriters.current.get(fileId);
        if (writer) {
          const prevWrite = writeQueues.current.get(fileId) || Promise.resolve();
          const currentWrite = prevWrite.then(() => writer.write(chunk)).catch(err => {
            logger.error('Transfer', `Chunk write error: ${err}`);
          });
          writeQueues.current.set(fileId, currentWrite);
        } else {
          incoming.chunks.push(chunk);
          // Periodically merge ArrayBuffers into a Blob to offload memory to browser's disk backing
          if (incoming.chunks.length >= 160) {
            const mergedBlob = new Blob(incoming.chunks, { type: incoming.meta.type });
            incoming.chunks = [mergedBlob];
          }
        }

        const progress = Math.min(100, Math.round((incoming.receivedBytes / incoming.meta.size) * 100));

        // Update UI: every 256KB received or 1% progress (avoids 0% for long time on large files)
        const lastUpdateBytes = incoming.lastUpdateBytes ?? 0;
        const bytesSinceLastUpdate = incoming.receivedBytes - lastUpdateBytes;
        const prevProgress = store.currentRoom?.files.find(f => f.id === fileId)?.progress ?? 0;
        const shouldUpdate = progress >= 100 || progress - prevProgress >= 1 || bytesSinceLastUpdate >= PROGRESS_UPDATE_BYTES;
        if (shouldUpdate) {
          incoming.lastUpdateBytes = incoming.receivedBytes;
          const elapsed = (Date.now() - incoming.startTime) / 1000;
          const speed = elapsed > 0 ? incoming.receivedBytes / elapsed : 0;
          const remaining = incoming.meta.size - incoming.receivedBytes;
          const eta = speed > 0 ? remaining / speed : 0;
          store.updateFileTransferStats(fileId, progress, speed, eta);
        }

        // Report progress back to sender (throttle to ~5% steps)
        const last = lastProgressReported.current.get(fileId) ?? -1;
        if (progress >= 100 || progress - last >= 5) {
          lastProgressReported.current.set(fileId, progress);
          const dc = dataChannels.current.get(senderDeviceId);
          if (dc?.readyState === 'open') {
            void sendEncryptedDataControl(dc, store.currentRoom!.id, store.deviceId!, senderDeviceId, 'file-progress', { fileId, progress });
          }
        }
      }
    }
  }, [finalizeReceivedFile]);

  const setupDataChannel = useCallback((channel: RTCDataChannel, remoteDeviceId: string) => {
    channel.binaryType = 'arraybuffer';
    channel.bufferedAmountLowThreshold = BUFFER_LOW_THRESHOLD;

    channel.onopen = () => {
      logger.info('DataChannel', `open`, remoteDeviceId);
      useStore.getState().updateMemberStatus(remoteDeviceId, 'online');
    };

    channel.onclose = () => {
      logger.info('DataChannel', `closed`, remoteDeviceId);
      const store = useStore.getState();
      store.updateMemberStatus(remoteDeviceId, 'offline');

      // Note: Retry logic is handled in peer connection state change handlers
      // This ensures we don't have circular dependencies
    };

    channel.onerror = (event) => {
      const rtcErr = (event as RTCErrorEvent).error;
      const detail = rtcErr
        ? `${rtcErr.errorDetail ?? ''} ${rtcErr.message ?? ''}`.trim()
        : 'unknown error';
      logger.error('DataChannel', `error with ${remoteDeviceId}`, detail);
    };

    channel.onmessage = (event) => { void handleDataMessage(remoteDeviceId, event.data); };

    dataChannels.current.set(remoteDeviceId, channel);
  }, [handleDataMessage]);

  // ============ Peer Connection ============

  // Clean up peer connection
  const cleanupPeerConnection = useCallback((remoteDeviceId: string) => {
    closePeer({
      peers: peers.current,
      dataChannels: dataChannels.current,
      pendingIceCandidates: pendingIceCandidates.current,
    }, remoteDeviceId);
  }, []);


  const createPeerConnection = useCallback((remoteDeviceId: string, isInitiator: boolean) => {
    // Clean up old connection if exists and is in bad state
    const existingPc = peers.current.get(remoteDeviceId);
    if (existingPc) {
      const state = existingPc.connectionState;
      const iceState = existingPc.iceConnectionState;
      if (state === 'closed' || state === 'failed' || iceState === 'closed' || iceState === 'failed') {
        console.log('Cleaning up old failed connection with', remoteDeviceId);
        existingPc.close();
        peers.current.delete(remoteDeviceId);
        dataChannels.current.delete(remoteDeviceId);
      } else {
        // Connection still exists and is valid
        return existingPc;
      }
    }

    logger.info('ICE', `Creating peer connection ${isInitiator ? '(initiator)' : '(receiver)'}`, remoteDeviceId);

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peers.current.set(remoteDeviceId, pc);

    pc.onicecandidate = (event) => {
      if (ICE_DIAGNOSTICS && event.candidate) {
        logger.debug('ICE', `Local ${parseCandidateType(event.candidate)} candidate gathered`);
      }
      if (event.candidate && ws.current?.readyState === WebSocket.OPEN) {
        const state = useStore.getState();
        if (state.currentRoom?.id && state.deviceId) {
          void sendEncryptedSignal(ws.current, state.currentRoom.id, state.deviceId, 'candidate', event.candidate, remoteDeviceId);
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      logger.info('ICE', `connection state: ${state}`, remoteDeviceId);

      if (state === 'connected' || state === 'completed') {
        useStore.getState().updateMemberStatus(remoteDeviceId, 'online');
        void detectIcePath(pc, remoteDeviceId).then((path) => {
          useStore.getState().updateMemberConnectionPath(remoteDeviceId, path);
        });
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        const store = useStore.getState();
        store.updateMemberStatus(remoteDeviceId, 'offline');

        // Clean up failed connection
        if (state === 'failed' || state === 'closed') {
          cleanupPeerConnection(remoteDeviceId);

          // Retry after a delay
          setTimeout(async () => {
            const retryStore = useStore.getState();
            const myDeviceId = retryStore.deviceId;
            const room = retryStore.currentRoom;

            if (!myDeviceId || !room) return;

            // Check if member still exists in room
            const member = room.members.find(m => m.deviceId === remoteDeviceId);
            if (!member || member.deviceId === myDeviceId) return;

            // Don't retry if already connected
            const existingPc = peers.current.get(remoteDeviceId);
            if (existingPc && (existingPc.connectionState === 'connected' || existingPc.iceConnectionState === 'connected' || existingPc.iceConnectionState === 'completed')) {
              return;
            }

            console.log('Retrying ICE connection with', member.displayName);
            retryStore.updateMemberStatus(remoteDeviceId, 'connecting');

            // Initiate connection (higher deviceId initiates)
            if (myDeviceId > remoteDeviceId) {
              try {
                const newPc = createPeerConnection(remoteDeviceId, true);
                const offer = await newPc.createOffer();
                await newPc.setLocalDescription(offer);

                void sendEncryptedSignal(ws.current, room.id, myDeviceId, 'offer', offer, remoteDeviceId);
              } catch (err) {
                console.error('Failed to retry ICE connection:', err);
                retryStore.updateMemberStatus(remoteDeviceId, 'offline');
              }
            }
          }, 3000); // Retry after 3 seconds
        }
      }
    };

    pc.onicecandidateerror = (event) => {
      if (ICE_DIAGNOSTICS) {
        logger.warn('ICE', `Candidate gathering failed with code ${event.errorCode}`);
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      logger.info('ICE', `peer connection state: ${state}`, remoteDeviceId);

      if (state === 'connected') {
        useStore.getState().updateMemberStatus(remoteDeviceId, 'online');
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        const store = useStore.getState();
        store.updateMemberStatus(remoteDeviceId, 'offline');

        // Clean up failed connection
        if (state === 'failed' || state === 'closed') {
          cleanupPeerConnection(remoteDeviceId);

          // Retry after a delay
          setTimeout(async () => {
            const retryStore = useStore.getState();
            const myDeviceId = retryStore.deviceId;
            const room = retryStore.currentRoom;

            if (!myDeviceId || !room) return;

            // Check if member still exists in room
            const member = room.members.find(m => m.deviceId === remoteDeviceId);
            if (!member || member.deviceId === myDeviceId) return;

            // Don't retry if already connected
            const existingPc = peers.current.get(remoteDeviceId);
            if (existingPc && (existingPc.connectionState === 'connected' || existingPc.iceConnectionState === 'connected' || existingPc.iceConnectionState === 'completed')) {
              return;
            }

            console.log('Retrying connection with', member.displayName);
            retryStore.updateMemberStatus(remoteDeviceId, 'connecting');

            // Initiate connection (higher deviceId initiates)
            if (myDeviceId > remoteDeviceId) {
              try {
                const newPc = createPeerConnection(remoteDeviceId, true);
                const offer = await newPc.createOffer();
                await newPc.setLocalDescription(offer);

                void sendEncryptedSignal(ws.current, room.id, myDeviceId, 'offer', offer, remoteDeviceId);
              } catch (err) {
                console.error('Failed to retry connection:', err);
                retryStore.updateMemberStatus(remoteDeviceId, 'offline');
              }
            }
          }, 3000); // Retry after 3 seconds
        }
      }
    };

    // Handle incoming data channel (for non-initiator)
    pc.ondatachannel = (event) => {
      console.log('Received data channel from', remoteDeviceId);
      setupDataChannel(event.channel, remoteDeviceId);
    };

    // If initiator, create data channel
    if (isInitiator) {
      const dc = pc.createDataChannel('coral-transfer', { ordered: true });
      setupDataChannel(dc, remoteDeviceId);
    }

    return pc;
  }, [setupDataChannel, cleanupPeerConnection]);

  const broadcastAvailableOutboxMetadata = useCallback(() => {
    const store = useStore.getState();
    const room = store.currentRoom;
    const deviceId = store.deviceId;
    if (!room || !deviceId) return;

    const outboxFiles = room.files.filter((file) => file.direction === 'outbox' && !file.trashed);
    const unavailableIds = outboxFiles
      .filter((file) => !pendingFiles.current.has(file.id))
      .map((file) => file.id);

    // Metadata without its in-memory File source must not remain advertised.
    if (unavailableIds.length > 0) store.purgeFiles(unavailableIds);

    const availableFiles = outboxFiles.filter((file) => pendingFiles.current.has(file.id));
    if (availableFiles.length > 0) {
      console.log('Sending encrypted file metadata to peers');
    }
    availableFiles.forEach((file) => {
      const meta: FileMetadataPayload = {
        id: file.id,
        name: file.name,
        size: file.size,
        type: file.type,
        uploaderId: deviceId,
        uploaderName: getShortName(deviceId),
        uploadedAt: file.uploadedAt,
        thumbnailUrl: file.thumbnailUrl,
      };
      void sendEncryptedSignal(ws.current, room.id, deviceId, 'file-meta', meta);
    });
  }, []);

  const purgeInboxFiles = useCallback((uploaderId?: string) => {
    const store = useStore.getState();
    const fileIds = store.currentRoom?.files
      .filter((file) => file.direction === 'inbox' && (!uploaderId || file.uploaderId === uploaderId))
      .map((file) => file.id) ?? [];
    if (fileIds.length === 0) return;

    const ids = new Set(fileIds);
    store.purgeFiles(fileIds);
    incomingTransfers.current.forEach((fileId, transferId) => {
      if (ids.has(fileId)) incomingTransfers.current.delete(transferId);
    });
    fileIds.forEach((fileId) => {
      incomingChunks.current.delete(fileId);
      earlyChunks.current.delete(fileId);
      requestModes.current.delete(fileId);
      receivedFileBlobs.current.delete(fileId);
      lastProgressReported.current.delete(fileId);

      const writer = fileWriters.current.get(fileId);
      if (writer) {
        const queuedWrites = writeQueues.current.get(fileId) ?? Promise.resolve();
        void queuedWrites.then(() => writer.abort()).catch(() => {});
        fileWriters.current.delete(fileId);
        writeQueues.current.delete(fileId);
      }
    });
  }, []);

  // ============ Signaling ============

  const handleSignalMessage = useCallback(async (msg: SignalMessage) => {
    const store = useStore.getState();
    const myDeviceId = store.deviceId;
    const roomId = store.currentRoom?.id;

    if (!roomId || !myDeviceId) return;

    try {
      if (isEncryptedRelayType(msg.type)) {
        if (!msg.deviceId) throw new Error('Encrypted message is missing sender ID');
        msg = {
          ...msg,
          payload: await decryptPeerPayload(
            roomId,
            msg.type,
            msg.deviceId,
            msg.targetId,
            msg.payload as EncryptedPayloadV1,
          ),
        };
      }
      switch (msg.type) {
        case 'member-list': {
          // Update member list from server
          const members = msg.payload as MemberPayload[];
          for (const m of members) {
            if (m.deviceId !== myDeviceId) {
              void sendEncryptedSignal(ws.current, roomId, myDeviceId, 'peer-profile', { displayName: getShortName(myDeviceId) }, m.deviceId);
              // Check if member already exists
              const existingMember = store.currentRoom?.members.find(member => member.deviceId === m.deviceId);

              if (!existingMember) {
                // New member - add to list
                store.removePendingJoinRequest(m.deviceId);
                store.addMember({
                  deviceId: m.deviceId,
                  displayName: m.displayName ?? m.deviceId.slice(0, 8),
                  joinedAt: m.joinedAt,
                  status: 'connecting' as const,
                });
              } else if (existingMember.status === 'offline') {
                // Member was offline - retry connection
                console.log('Retrying connection with offline member');
                store.updateMemberStatus(m.deviceId, 'connecting');
              }

              // Set timeout to check connection status
              setTimeout(() => {
                const currentMember = useStore.getState().currentRoom?.members.find(member => member.deviceId === m.deviceId);
                if (currentMember && currentMember.status === 'connecting') {
                  console.warn('Peer connection timeout; marking peer offline');
                  useStore.getState().updateMemberStatus(m.deviceId, 'offline');
                }
              }, 30000); // 30 seconds timeout

              // Check if we need to initiate connection
              const pc = peers.current.get(m.deviceId);
              const shouldInitiate = !pc || pc.connectionState === 'closed' || pc.connectionState === 'failed' ||
                pc.iceConnectionState === 'closed' || pc.iceConnectionState === 'failed';

              if (shouldInitiate && myDeviceId > m.deviceId) {
                console.log('Initiating peer connection');
                try {
                  const newPc = createPeerConnection(m.deviceId, true);
                  const offer = await newPc.createOffer();
                  await newPc.setLocalDescription(offer);

                  void sendEncryptedSignal(ws.current, roomId, myDeviceId, 'offer', offer, m.deviceId);
                } catch (err) {
                  console.error('Failed to initiate connection:', err);
                  store.updateMemberStatus(m.deviceId, 'offline');
                }
              } else if (shouldInitiate) {
                console.log('Waiting for peer offer');
              }
            }
          }
          // A live reconnect keeps File objects in memory and republishes them.
          // A hard reload has no sources, so stale Outbox metadata is removed.
          broadcastAvailableOutboxMetadata();
          store.setStatus('connected');
          break;
        }

        case 'member-joined': {
          const member = msg.payload as MemberPayload;
          if (member.deviceId !== myDeviceId) {
            void sendEncryptedSignal(ws.current, roomId, myDeviceId, 'peer-profile', { displayName: getShortName(myDeviceId) }, member.deviceId);
            // Check if member already exists
            const existingMember = store.currentRoom?.members.find(m => m.deviceId === member.deviceId);

            if (!existingMember) {
              // New member - add to list
              console.log('Member joined');
              store.removePendingJoinRequest(member.deviceId);
              store.addMember({
                deviceId: member.deviceId,
                displayName: member.displayName ?? member.deviceId.slice(0, 8),
                joinedAt: member.joinedAt,
                status: 'connecting' as const,
              });
            } else if (existingMember.status === 'offline') {
              // Member was offline - retry connection
              console.log('Retrying connection with offline member');
              store.updateMemberStatus(member.deviceId, 'connecting');
            }

            // Set timeout to check connection status
            setTimeout(() => {
              const currentMember = useStore.getState().currentRoom?.members.find(m => m.deviceId === member.deviceId);
              if (currentMember && currentMember.status === 'connecting') {
                console.warn('Peer connection timeout; marking peer offline');
                useStore.getState().updateMemberStatus(member.deviceId, 'offline');
              }
            }, 30000); // 30 seconds timeout

            // Check if we need to initiate connection
            const pc = peers.current.get(member.deviceId);
            const shouldInitiate = !pc || pc.connectionState === 'closed' || pc.connectionState === 'failed' ||
              pc.iceConnectionState === 'closed' || pc.iceConnectionState === 'failed';

            if (shouldInitiate && myDeviceId > member.deviceId) {
              console.log('Initiating peer connection');
              try {
                const newPc = createPeerConnection(member.deviceId, true);
                const offer = await newPc.createOffer();
                await newPc.setLocalDescription(offer);

                void sendEncryptedSignal(ws.current, roomId, myDeviceId, 'offer', offer, member.deviceId);
              } catch (err) {
                console.error('Failed to initiate connection:', err);
                store.updateMemberStatus(member.deviceId, 'offline');
              }
            } else if (shouldInitiate) {
              console.log('Waiting for peer offer');
            }

            // Send only files that still have a live source in this page.
            broadcastAvailableOutboxMetadata();
          }
          break;
        }

        case 'peer-profile': {
          if (!msg.deviceId) break;
          const profile = msg.payload as { displayName?: string };
          if (typeof profile.displayName === 'string' && profile.displayName.length > 0 && profile.displayName.length <= 80) {
            store.updateMemberProfile(msg.deviceId, profile.displayName);
          }
          break;
        }

        case 'member-left': {
          const member = msg.payload as MemberPayload;
          console.log('Member left');

          // Clean up peer connection
          const pc = peers.current.get(member.deviceId);
          if (pc) {
            pc.close();
            peers.current.delete(member.deviceId);
          }
          dataChannels.current.delete(member.deviceId);

          // File bytes live only in the uploader's page. Once that member leaves,
          // their Inbox entries are no longer valid download targets.
          purgeInboxFiles(member.deviceId);
          store.removeMember(member.deviceId);
          break;
        }

        case 'offer': {
          const senderDeviceId = msg.deviceId!;
          if (senderDeviceId === myDeviceId) return;

          console.log('Received offer from', senderDeviceId);
          const pc = createPeerConnection(senderDeviceId, false);

          await pc.setRemoteDescription(new RTCSessionDescription(msg.payload as RTCSessionDescriptionInit));
          for (const candidate of pendingIceCandidates.current.get(senderDeviceId) ?? []) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          pendingIceCandidates.current.delete(senderDeviceId);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          void sendEncryptedSignal(ws.current, roomId, myDeviceId, 'answer', answer, senderDeviceId);
          break;
        }

        case 'answer': {
          const senderDeviceId = msg.deviceId!;
          console.log('Received answer from', senderDeviceId);

          const pc = peers.current.get(senderDeviceId);
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.payload as RTCSessionDescriptionInit));
            for (const candidate of pendingIceCandidates.current.get(senderDeviceId) ?? []) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
            pendingIceCandidates.current.delete(senderDeviceId);
          }
          break;
        }

        case 'candidate': {
          const senderDeviceId = msg.deviceId!;
          const pc = peers.current.get(senderDeviceId);
          if (ICE_DIAGNOSTICS) logger.debug('ICE', 'Remote candidate received');
          if (pc?.remoteDescription && msg.payload) {
            await pc.addIceCandidate(new RTCIceCandidate(msg.payload as RTCIceCandidateInit));
          } else if (msg.payload) {
            const pending = pendingIceCandidates.current.get(senderDeviceId) ?? [];
            pending.push(msg.payload as RTCIceCandidateInit);
            pendingIceCandidates.current.set(senderDeviceId, pending);
          }
          break;
        }

        case 'file-meta': {
          // Received file metadata from another member
          const meta = msg.payload as FileMetadataPayload;
          if (meta.uploaderId !== myDeviceId) {
            // Prevent duplicate inbox entries when the same file is re-shared with a new id.
            const duplicate = store.currentRoom?.files.find((f) =>
              f.direction === 'inbox' &&
              sameFileIdentity(
                { name: f.name, size: f.size, type: f.type, uploaderId: f.uploaderId },
                { name: meta.name, size: meta.size, type: meta.type, uploaderId: meta.uploaderId }
              ) &&
              f.id !== meta.id
            );
            if (duplicate) {
              logger.debug('Transfer', 'Skipped duplicate encrypted file metadata');
              break;
            }

            console.log('Encrypted file metadata available');
            store.addFile({
              name: meta.name,
              size: meta.size,
              type: meta.type,
              uploaderId: meta.uploaderId,
              uploaderName: meta.uploaderName,
              uploadedAt: meta.uploadedAt,
              direction: 'inbox',
              thumbnailUrl: meta.thumbnailUrl,
            }, meta.id);
          }
          break;
        }

        case 'file-meta-sync-request': {
          // Another peer asks us to resend current outbox metadata
          broadcastAvailableOutboxMetadata();
          break;
        }

        case 'file-request': {
          // Someone wants to download a file I shared
          const { fileId, requesterId } = msg.payload as { fileId: string; requesterId: string };
          const stillShared = store.currentRoom?.files.some(
            (f) => f.id === fileId && f.direction === 'outbox'
          );
          if (!stillShared) {
            pendingFiles.current.delete(fileId);
            break;
          }
          const file = pendingFiles.current.get(fileId);
          if (file) {
            const requester = store.currentRoom?.members.find(m => m.deviceId === requesterId);
            store.addFileDownloader(fileId, requesterId, requester?.displayName ?? requesterId.slice(0, 8));
            void sendFileToOneRef.current(file, fileId, requesterId);
          }
          break;
        }

        case 'room-settings': {
          const settings = msg.payload as RoomSettingsPayload;
          store.setRoomSettings(settings);
          break;
        }

        case 'join-request': {
          const request = msg.payload as MemberPayload;
          if (request.deviceId !== myDeviceId) {
            store.addPendingJoinRequest({
              deviceId: request.deviceId,
              displayName: request.displayName ?? request.deviceId.slice(0, 8),
              joinedAt: request.joinedAt,
            });
          }
          break;
        }

        case 'join-request-resolved': {
          const payload = msg.payload as { requesterId?: string };
          if (payload.requesterId) {
            store.removePendingJoinRequest(payload.requesterId);
          }
          break;
        }

        case 'host-assigned': {
          const payload = msg.payload as { token?: string; deviceId?: string };
          if (payload?.token && payload?.deviceId) {
            store.setHostToken(payload.token, payload.deviceId);
          }
          break;
        }

        case 'join-pending': {
          store.setStatus('connecting');
          store.setError('Waiting for approval from a room member');
          break;
        }

        case 'join-approved': {
          store.setError(null);
          store.setStatus('connected');
          break;
        }

        case 'join-rejected': {
          store.setStatus('error');
          store.setError('Your join request was rejected');
          break;
        }

        case 'room-full': {
          store.setStatus('error');
          store.setError('Room is full');
          break;
        }

        case 'room-expired': {
          const payload = msg.payload as { reason?: string };
          const reason = payload?.reason ?? 'expired';
          // A host departure closes every connection without emitting member-left.
          // Drop remote metadata immediately; live peers will republish after reconnect.
          purgeInboxFiles();
          store.setStatus('error');
          store.setError(reason === 'host_left' ? 'Host left the room' : 'Room expired due to inactivity');
          break;
        }

        case 'member-removed': {
          removedFromRoomRef.current = true;
          if (ws.current) {
            ws.current.onclose = null;
            ws.current.onmessage = null;
            ws.current.close();
            ws.current = null;
          }
          store.reset();
          const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
          window.location.assign(`${basePath}/app`);
          logger.warn('General', 'Removed from room by host');
          break;
        }

        case 'chat': {
          // Received chat message
          const chatMsg = msg.payload as ChatMessagePayload;
          if (chatMsg.senderId !== myDeviceId) {
            store.addMessage({
              text: chatMsg.text,
              senderId: chatMsg.senderId,
              senderName: chatMsg.senderName,
              timestamp: chatMsg.timestamp,
              isMe: false,
            });
          }
          break;
        }
      }
    } catch {
      console.warn('Rejected an invalid or undecryptable signaling message');
    }
  }, [broadcastAvailableOutboxMetadata, createPeerConnection, purgeInboxFiles]);

  // ============ Connection ============

  const connect = useCallback((roomId: string, isCreator: boolean) => {
    if (removedFromRoomRef.current) {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      window.location.assign(`${basePath}/app`);
      return;
    }

    const deviceId = getDeviceId();
    const displayName = getShortName(deviceId);

    const store = useStore.getState();
    store.setDeviceId(deviceId);
    store.setStatus('connecting');
    store.setError(null);

    if (isCreator) {
      store.createRoom(roomId, deviceId, displayName);
    } else {
      store.joinRoom(roomId, deviceId, displayName);
    }

    const wsUrl = getSignalingServerUrl();
    logger.info('Signaling', `Connecting to ${wsUrl}`);

    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      logger.info('Signaling', 'WebSocket connected');

      const roomSettings = useStore.getState().currentRoom?.settings;
      const joinPayload = {
        deviceId,
        settings: roomSettings ?? undefined,
      };
      ws.current?.send(JSON.stringify({
        version: PROTOCOL_VERSION,
        type: 'join',
        roomId,
        payload: joinPayload,
      }));
    };

    ws.current.onmessage = (event) => {
      try {
        const msg = parseWireMessage(JSON.parse(event.data));
        void handleSignalMessage(msg);
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    };

    ws.current.onerror = (err) => {
      logger.error('Signaling', 'WebSocket error', String(err));
      store.setError(`Connection failed: ${wsUrl}`);
      store.setStatus('error');
    };

    ws.current.onclose = (event) => {
      logger.info('Signaling', `WebSocket closed: ${event.code}`);
      if (event.code !== 1000 && store.status !== 'idle') {
        store.setStatus('disconnected');
      }
    };
  }, [handleSignalMessage]);

  // ============ File Sharing ============

  const shareFile = useCallback(async (file: File) => {
    const store = useStore.getState();
    const room = store.currentRoom;
    if (!room || !store.deviceId) return;
    const myDeviceId = store.deviceId;

    const existingOutbox = room.files.find((f) =>
      f.direction === 'outbox' &&
      sameFileIdentity(
        { name: f.name, size: f.size, type: f.type, uploaderId: f.uploaderId },
        {
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          uploaderId: myDeviceId,
        }
      )
    );

    const fileId = existingOutbox?.id ?? Math.random().toString(36).substring(2, 15);
    const myName = getShortName(myDeviceId);
    const uploadedAt = Date.now();

    // Store/refresh file source for transfer requests.
    pendingFiles.current.set(fileId, file);

    // Generate thumbnail for images
    const thumbnailUrl = await generateThumbnail(file);

    // Add to outbox with the same fileId (existing id if duplicate).
    store.addFile({
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      uploaderId: myDeviceId,
      uploaderName: myName,
      uploadedAt,
      direction: 'outbox',
      thumbnailUrl,
    }, fileId);

    // Broadcast metadata to all peers via signaling server
    const meta: FileMetadataPayload = {
      id: fileId,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      uploaderId: myDeviceId,
      uploaderName: myName,
      uploadedAt,
      thumbnailUrl,
    };

    await sendEncryptedSignal(ws.current, room.id, myDeviceId, 'file-meta', meta);

    console.log('Encrypted file metadata shared');
  }, []);

  // Cancel an in-progress download (receiver-initiated)
  const cancelFileDownload = useCallback((fileId: string) => {
    const store = useStore.getState();
    const file = store.currentRoom?.files.find((f) => f.id === fileId);
    if (!file || file.status !== 'downloading') return;

    const uploaderId = file.uploaderId;
    const dc = dataChannels.current.get(uploaderId);
    const incoming = incomingChunks.current.get(fileId);
    trackTransferFailed(
      file.size,
      incoming ? Date.now() - incoming.startTime : 0,
      'cancelled_by_recipient',
    );

    if (dc?.readyState === 'open') {
      if (store.currentRoom && store.deviceId) {
        void sendEncryptedDataControl(dc, store.currentRoom.id, store.deviceId, uploaderId, 'file-cancel', { fileId });
      }
    }

    const writer = fileWriters.current.get(fileId);
    if (writer) {
      const prevWrite = writeQueues.current.get(fileId) || Promise.resolve();
      prevWrite.then(async () => {
        try {
          // Attempt to abort to discard the incomplete file
          await writer.abort();
        } catch {
          try {
            await writer.close();
          } catch {}
        }
      }).catch(() => {});
      fileWriters.current.delete(fileId);
      writeQueues.current.delete(fileId);
    }

    incomingChunks.current.delete(fileId);
    earlyChunks.current.delete(fileId);
    lastProgressReported.current.delete(fileId);
    requestModes.current.delete(fileId);
    store.updateFileStatus(fileId, 'available');
    store.updateFileProgress(fileId, 0);
  }, []);

  // Request a file, with preferred completion mode for text files.
  const requestFile = useCallback(async (file: FileMetadata, mode: 'download' | 'copy' = 'download') => {
    const store = useStore.getState();
    const room = store.currentRoom;
    if (!room || !store.deviceId) return;

    if (ws.current?.readyState !== WebSocket.OPEN) {
      trackTransferAttempt(file.size);
      trackTransferFailed(file.size, 0, 'connection_unavailable');
      return;
    }

    const picker = (window as FilePickerWindow).showSaveFilePicker;
    if (mode === 'download' && picker) {
      try {
        const handle = await picker({ suggestedName: file.name });
        const writable = await handle.createWritable();
        fileWriters.current.set(file.id, writable);
      } catch (err) {
        // User cancelled picker, abort download request fully
        if ((err as Error).name === 'AbortError') return;
        logger.warn('Transfer', `showSaveFilePicker error: ${err}`);
      }
    }

    trackTransferAttempt(file.size);
    console.log('Requesting encrypted file transfer');
    requestModes.current.set(file.id, mode);

    // Send request via signaling server
    await sendEncryptedSignal(ws.current, room.id, store.deviceId, 'file-request', {
      fileId: file.id,
      requesterId: store.deviceId,
    }, file.uploaderId);

    store.updateFileStatus(file.id, 'downloading');
    store.updateFileProgress(file.id, 0);
  }, []);

  const requestFileMetaSync = useCallback(() => {
    const store = useStore.getState();
    const room = store.currentRoom;
    if (!room) return;

    // Full inbox reset before resync:
    // clear current inbox list (including trash), transient download state, and cached text blobs.
    const inboxIds = room.files
      .filter((f) => f.direction === 'inbox')
      .map((f) => f.id);

    if (inboxIds.length > 0) {
      store.purgeFiles(inboxIds);
      inboxIds.forEach((id) => {
        incomingChunks.current.delete(id);
        earlyChunks.current.delete(id);
        requestModes.current.delete(id);
        receivedFileBlobs.current.delete(id);
        lastProgressReported.current.delete(id);
      });
    }

    if (store.deviceId) {
      void sendEncryptedSignal(ws.current, room.id, store.deviceId, 'file-meta-sync-request', { requesterId: store.deviceId });
    }
  }, []);

  const updateRoomSettings = useCallback((settings: RoomSettingsPayload) => {
    const store = useStore.getState();
    const room = store.currentRoom;
    if (!room) return;
    store.setRoomSettings(settings);
    const payload: RoomSettingsPayload & { hostToken?: string } = { ...settings };
    if (room.settings.hostManagement && room.hostToken && room.hostDeviceId === store.deviceId) {
      payload.hostToken = room.hostToken;
    }
    ws.current?.send(JSON.stringify({
      version: PROTOCOL_VERSION,
      type: 'room-settings',
      roomId: room.id,
      payload,
    }));
  }, []);

  const approveJoinRequest = useCallback((deviceId: string) => {
    const store = useStore.getState();
    const room = store.currentRoom;
    if (!room) return;
    if (!room.settings.hostManagement || room.hostDeviceId !== store.deviceId || !room.hostToken) return;
    store.removePendingJoinRequest(deviceId);
    ws.current?.send(JSON.stringify({
      version: PROTOCOL_VERSION,
      type: 'join-approved',
      roomId: room.id,
      targetId: deviceId,
      payload: { requesterId: deviceId, hostToken: room.hostToken },
    }));
  }, []);

  const rejectJoinRequest = useCallback((deviceId: string) => {
    const store = useStore.getState();
    const room = store.currentRoom;
    if (!room) return;
    if (!room.settings.hostManagement || room.hostDeviceId !== store.deviceId || !room.hostToken) return;
    store.removePendingJoinRequest(deviceId);
    ws.current?.send(JSON.stringify({
      version: PROTOCOL_VERSION,
      type: 'join-rejected',
      roomId: room.id,
      targetId: deviceId,
      payload: { requesterId: deviceId, hostToken: room.hostToken },
    }));
  }, []);

  const removeMemberFromRoom = useCallback((deviceId: string) => {
    const store = useStore.getState();
    const room = store.currentRoom;
    if (!room) return;
    if (deviceId === store.deviceId) return;
    if (!room.settings.hostManagement || room.hostDeviceId !== store.deviceId || !room.hostToken) return;
    ws.current?.send(JSON.stringify({
      version: PROTOCOL_VERSION,
      type: 'member-remove',
      roomId: room.id,
      targetId: deviceId,
      payload: { targetId: deviceId, hostToken: room.hostToken },
    }));
  }, []);

  // Send file to a specific peer
  const sendFileToOne = useCallback(async (file: File, fileId: string, targetDeviceId: string) => {
    const dc = dataChannels.current.get(targetDeviceId);
    if (!dc || dc.readyState !== 'open') {
      logger.error('Transfer', `No data channel`, targetDeviceId);
      return;
    }

    const store = useStore.getState();
    const roomId = store.currentRoom?.id;
    const senderId = store.deviceId;
    if (!roomId || !senderId) return;
    store.updateFileDownloaderProgress(fileId, targetDeviceId, 0);
    const completed = await sendEncryptedFile({
      file,
      fileId,
      targetDeviceId,
      dataChannel: dc,
      roomId,
      senderId,
      abortControllers: sendAbortControllers.current,
      onProgress: (progress) => {
        useStore.getState().updateFileDownloaderProgress(fileId, targetDeviceId, progress);
      },
    });
    if (!completed) {
      useStore.getState().removeFileDownloader(fileId, targetDeviceId);
    }
  }, []);

  useEffect(() => {
    sendFileToOneRef.current = sendFileToOne;
  }, [sendFileToOne]);

  // ============ Chat ============

  const sendChat = useCallback((text: string) => {
    const store = useStore.getState();
    const room = store.currentRoom;
    if (!room || !store.deviceId) return;

    const myName = getShortName(store.deviceId);
    const timestamp = Date.now();

    // Add to local messages
    store.addMessage({
      text,
      senderId: store.deviceId,
      senderName: myName,
      timestamp,
      isMe: true,
    });

    // Broadcast to all peers via signaling server
    void sendEncryptedSignal(ws.current, room.id, store.deviceId, 'chat', {
      text,
      senderId: store.deviceId,
      senderName: myName,
      timestamp,
    });
  }, []);

  // ============ Effects ============

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // Handle visibility change and periodic check for reconnection
  useEffect(() => {
    const checkConnection = () => {
      if (document.visibilityState === 'visible') {
        const store = useStore.getState();
        const { currentRoom, status, deviceId } = store;

        // If we are in a room but disconnected (or error), try to reconnect
        if (currentRoom && deviceId && (status === 'disconnected' || status === 'error' || !ws.current || ws.current.readyState === WebSocket.CLOSED)) {
          console.log('Reconnecting to secure room');
          connect(currentRoom.id, false);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Immediate check when becoming visible
        checkConnection();
      }
    };

    // Check periodically (every 5 seconds)
    const intervalId = setInterval(checkConnection, 5000);

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, [connect]);

  // ============ Retry Connection ============

  const retryConnection = useCallback((remoteDeviceId: string) => {
    console.log('Manual retry connection with', remoteDeviceId);
    const store = useStore.getState();

    // Clean up existing connection
    cleanupPeerConnection(remoteDeviceId);

    // Update status to connecting
    store.updateMemberStatus(remoteDeviceId, 'connecting');

    // Create new peer connection
    const myDeviceId = store.deviceId;
    if (!myDeviceId) {
      console.error('Cannot retry: no device ID');
      return;
    }

    // Keep initiator election consistent with the main signaling flow.
    const isInitiator = myDeviceId > remoteDeviceId;

    const pc = createPeerConnection(remoteDeviceId, isInitiator);

    if (isInitiator) {
      // Create offer
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          if (ws.current?.readyState === WebSocket.OPEN) {
            if (store.currentRoom?.id) {
              void sendEncryptedSignal(ws.current, store.currentRoom.id, myDeviceId, 'offer', pc.localDescription, remoteDeviceId);
            }
          }
        })
        .catch((err) => {
          console.error('Error creating offer for retry:', err);
          store.updateMemberStatus(remoteDeviceId, 'offline');
        });
    }
  }, [cleanupPeerConnection, createPeerConnection]);

  // Copy text file content. If blob is not local yet, request file in copy mode.
  const copyTextFile = useCallback(async (file: FileMetadata): Promise<boolean> => {
    if (!file.type.startsWith('text/')) return false;

    const blob = receivedFileBlobs.current.get(file.id);
    if (blob) {
      return copyTextBlobToClipboard(blob);
    }

    requestFile(file, 'copy');
    return false;
  }, [requestFile]);

  // ============ Return ============

  return {
    connect,
    shareFile,
    requestFile,
    requestFileMetaSync,
    cancelFileDownload,
    sendChat,
    cleanup,
    retryConnection,
    copyTextFile,
    updateRoomSettings,
    removeMemberFromRoom,
    approveJoinRequest,
    rejectJoinRequest,
  };
};
