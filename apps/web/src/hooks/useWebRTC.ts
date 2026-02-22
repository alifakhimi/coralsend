import { useEffect, useRef, useCallback } from 'react';
import { useStore, type Member, type FileMetadata, type ChatMessage, type ConnectionPath } from '@/store/store';
import { analytics } from '@/lib/analytics';
import { getSignalingServerUrl, ICE_SERVERS } from '@/lib/constants';
import { getDeviceId, getShortName } from '@/lib/deviceId';
import { logger } from '@/lib/logger';

// ============ Types ============

type SignalMessage = {
  type: string;
  roomId: string;
  deviceId?: string;
  targetId?: string;
  payload?: unknown;
};

type FileMetadataPayload = {
  id: string;
  name: string;
  size: number;
  type: string;
  uploaderId: string;
  uploaderName: string;
  uploadedAt: number;
  thumbnailUrl?: string;
};

type MemberPayload = {
  deviceId: string;
  displayName: string;
  joinedAt: number;
  status: string;
};

type ChatMessagePayload = {
  text: string;
  senderId: string;
  senderName: string;
  timestamp: number;
};

type FileIdentity = {
  name: string;
  size: number;
  type: string;
  uploaderId: string;
};

// ============ Constants ============

const FILE_ID_HEADER = 36;
const CHUNK_SIZE = 64 * 1024; // 64KB payload (+ 36B header stays well under 256KB maxMessageSize)
const BUFFER_LOW_THRESHOLD = 128 * 1024; // 128KB (2 chunks)
const BUFFER_HIGH_THRESHOLD = 1024 * 1024; // 1MB (~16 chunks queued)
const THUMBNAIL_MAX_SIZE = 200; // Max thumbnail dimension
const ICE_DIAGNOSTICS = process.env.NEXT_PUBLIC_ICE_DIAGNOSTICS === 'true';

// ============ Helpers ============

/**
 * Generate a thumbnail for an image file
 */
async function generateThumbnail(file: File): Promise<string | undefined> {
  if (!file.type.startsWith('image/')) return undefined;

  try {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Scale down to max thumbnail size
          if (width > height) {
            if (width > THUMBNAIL_MAX_SIZE) {
              height = Math.round((height * THUMBNAIL_MAX_SIZE) / width);
              width = THUMBNAIL_MAX_SIZE;
            }
          } else {
            if (height > THUMBNAIL_MAX_SIZE) {
              width = Math.round((width * THUMBNAIL_MAX_SIZE) / height);
              height = THUMBNAIL_MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = () => resolve(undefined);
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(file);
    });
  } catch {
    return undefined;
  }
}

function parseCandidateType(candidate: RTCIceCandidate | RTCIceCandidateInit): string {
  const candidateValue = candidate.candidate ?? '';
  const match = candidateValue.match(/\btyp\s+([a-zA-Z0-9]+)/);
  return match?.[1] ?? 'unknown';
}

function sameFileIdentity(a: FileIdentity, b: FileIdentity): boolean {
  return (
    a.uploaderId === b.uploaderId &&
    a.name === b.name &&
    a.size === b.size &&
    (a.type || 'application/octet-stream') === (b.type || 'application/octet-stream')
  );
}

async function detectIcePath(pc: RTCPeerConnection, remoteDeviceId: string): Promise<ConnectionPath> {
  try {
    const stats = await pc.getStats();
    let selectedPair: RTCStats | null = null;
    const candidates = new Map<string, RTCStats>();

    stats.forEach((report) => {
      if (report.type === 'local-candidate' || report.type === 'remote-candidate') {
        candidates.set(report.id, report);
      }
      if (report.type === 'candidate-pair') {
        const pair = report as RTCStats & {
          selected?: boolean;
          state?: string;
          localCandidateId?: string;
          remoteCandidateId?: string;
          nominated?: boolean;
        };
        if (pair.selected || pair.state === 'succeeded' || pair.nominated) {
          selectedPair = pair;
        }
      }
    });

    if (!selectedPair) {
      if (ICE_DIAGNOSTICS) logger.debug('ICE', `no selected candidate pair yet`, remoteDeviceId);
      return 'unknown';
    }

    const pair = selectedPair as RTCStats & {
      localCandidateId?: string;
      remoteCandidateId?: string;
      state?: string;
    };
    const local = pair.localCandidateId ? candidates.get(pair.localCandidateId) : undefined;
    const remote = pair.remoteCandidateId ? candidates.get(pair.remoteCandidateId) : undefined;

    const localType = (local as RTCStats & { candidateType?: string } | undefined)?.candidateType ?? 'unknown';
    const remoteType = (remote as RTCStats & { candidateType?: string } | undefined)?.candidateType ?? 'unknown';
    const localProtocol = (local as RTCStats & { protocol?: string } | undefined)?.protocol ?? 'unknown';
    const remoteProtocol = (remote as RTCStats & { protocol?: string } | undefined)?.protocol ?? 'unknown';

    logger.info('ICE', `selected pair state=${pair.state ?? 'unknown'} local=${localType}/${localProtocol} remote=${remoteType}/${remoteProtocol}`, remoteDeviceId);

    const isRelay = localType === 'relay' || remoteType === 'relay';
    return isRelay ? 'relay' : 'direct';
  } catch (error) {
    logger.warn('ICE', `failed to read selected candidate pair`, `${remoteDeviceId} ${error}`);
    return 'unknown';
  }
}

// ============ Hook ============

export const useWebRTC = () => {
  const ws = useRef<WebSocket | null>(null);

  // Multi-peer connections: deviceId -> RTCPeerConnection
  const peers = useRef<Map<string, RTCPeerConnection>>(new Map());
  const dataChannels = useRef<Map<string, RTCDataChannel>>(new Map());

  // File transfer state
  const pendingFiles = useRef<Map<string, File>>(new Map()); // fileId -> File
  const incomingChunks = useRef<Map<string, { meta: FileMetadataPayload; chunks: ArrayBuffer[]; receivedBytes: number; startTime: number }>>(new Map());
  const earlyChunks = useRef<Map<string, ArrayBuffer[]>>(new Map()); // chunks arriving before file-start
  const receivedFileBlobs = useRef<Map<string, Blob>>(new Map()); // fileId -> Blob (text files only, for copy)
  const requestModes = useRef<Map<string, 'download' | 'copy'>>(new Map()); // requester intent by fileId
  const sendAbortControllers = useRef<Map<string, AbortController>>(new Map()); // `${fileId}-${targetDeviceId}` -> AbortController
  const lastProgressReported = useRef<Map<string, number>>(new Map()); // fileId -> last % sent to sender

  // ============ Cleanup ============

  const cleanup = useCallback(() => {
    sendAbortControllers.current.forEach((ac) => ac.abort());
    sendAbortControllers.current.clear();

    // Close all data channels
    dataChannels.current.forEach((dc) => dc.close());
    dataChannels.current.clear();

    // Close all peer connections
    peers.current.forEach((pc) => pc.close());
    peers.current.clear();

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
    pendingFiles.current.clear();
    receivedFileBlobs.current.clear();
    requestModes.current.clear();
    lastProgressReported.current.clear();

    useStore.getState().reset();
  }, []);

  // ============ File Actions ============

  const copyTextBlobToClipboard = useCallback(async (blob: Blob): Promise<boolean> => {
    try {
      const text = await blob.text();
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }, []);

  const triggerDownload = useCallback((meta: FileMetadataPayload, blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = meta.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const finalizeReceivedFile = useCallback(async (fileId: string, meta: FileMetadataPayload, chunks: ArrayBuffer[]) => {
    const blob = new Blob(chunks, { type: meta.type });
    if (meta.type.startsWith('text/')) {
      receivedFileBlobs.current.set(fileId, blob);
    }

    const mode = requestModes.current.get(fileId) ?? 'download';
    requestModes.current.delete(fileId);

    if (mode === 'copy' && meta.type.startsWith('text/')) {
      const copied = await copyTextBlobToClipboard(blob);
      if (!copied) {
        // Clipboard can fail due to permissions; fallback to normal download.
        triggerDownload(meta, blob);
      }
      return;
    }

    triggerDownload(meta, blob);
  }, [copyTextBlobToClipboard, triggerDownload]);

  // ============ Data Channel Handling ============

  const handleDataMessage = useCallback((senderDeviceId: string, data: unknown) => {
    const store = useStore.getState();

    // String messages (control messages)
    if (typeof data === 'string') {
      try {
        const msg = JSON.parse(data);

        if (msg.type === 'file-start') {
          // Receiving file data start
          const meta = msg.payload as FileMetadataPayload;
          logger.info('Transfer', `Receiving file: ${meta.name}`, senderDeviceId);

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
          incomingChunks.current.set(meta.id, { meta, chunks: buffered ?? [], receivedBytes, startTime: Date.now() });
          earlyChunks.current.delete(meta.id);
          if (buffered) {
            logger.info('Transfer', `Flushed ${buffered.length} early chunks (${receivedBytes} bytes)`, meta.id);
          }
          store.updateFileStatus(meta.id, 'downloading');
          store.updateFileProgress(meta.id, 0);

        } else if (msg.type === 'file-end') {
          // File transfer complete
          const fileId = msg.fileId;
          const incoming = incomingChunks.current.get(fileId);

          if (incoming) {
            // Ensure sender's avatar shows 100% before we remove downloader
            const dc = dataChannels.current.get(senderDeviceId);
            if (dc?.readyState === 'open') {
              dc.send(JSON.stringify({ type: 'file-progress', fileId, progress: 100 }));
            }
            analytics.track('file_downloaded', {
              fileType: incoming.meta.type,
              fileSize: incoming.meta.size,
            });
            logger.info('Transfer', `File transfer complete: ${incoming.meta.name}`);
            store.updateFileStatus(fileId, 'completed');
            void finalizeReceivedFile(fileId, incoming.meta, incoming.chunks);
            // Auto-hide downloaded inbox file after a short delay (moves to trash)
            setTimeout(() => {
              const f = useStore.getState().currentRoom?.files.find((x) => x.id === fileId);
              if (f?.direction === 'inbox' && f.status === 'completed') {
                useStore.getState().removeFile(fileId);
              }
            }, 5000);
            incomingChunks.current.delete(fileId);
            earlyChunks.current.delete(fileId);
            lastProgressReported.current.delete(fileId);
          }
        } else if (msg.type === 'file-progress') {
          // Receiver reports progress back to sender (for avatar display)
          const { fileId: fid, progress: pct } = msg as { fileId: string; progress: number };
          if (typeof fid === 'string' && typeof pct === 'number') {
            store.updateFileDownloaderProgress(fid, senderDeviceId, Math.min(100, Math.max(0, pct)));
            // Only remove downloader when receiver has actually received 100% (not when sender's buffer is done)
            if (pct >= 100) {
              store.removeFileDownloader(fid, senderDeviceId);
            }
          }
        } else if (msg.type === 'file-cancel') {
          // Receiver cancelled download - abort send to that requester
          const { fileId: fid } = msg as { fileId: string };
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
      } catch (e) {
        console.log('Received text:', data);
      }
      return;
    }

    // Binary data (file chunks) with fileId prefix
    if (data instanceof ArrayBuffer) {
      const decoder = new TextDecoder();
      const fileIdBytes = data.slice(0, FILE_ID_HEADER);
      const fileId = decoder.decode(fileIdBytes).trim();
      const chunk = data.slice(FILE_ID_HEADER);

      const incoming = incomingChunks.current.get(fileId);
      if (incoming) {
        incoming.chunks.push(chunk);
        incoming.receivedBytes += chunk.byteLength;
        const progress = Math.min(100, Math.round((incoming.receivedBytes / incoming.meta.size) * 100));

        // Throttle UI store updates to 1% steps
        const prevProgress = store.currentRoom?.files.find(f => f.id === fileId)?.progress ?? 0;
        if (progress >= 100 || progress - prevProgress >= 1) {
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
            dc.send(JSON.stringify({ type: 'file-progress', fileId, progress }));
          }
        }
      } else {
        // Buffer chunks that arrive before their file-start message
        let buf = earlyChunks.current.get(fileId);
        if (!buf) {
          buf = [];
          earlyChunks.current.set(fileId, buf);
          logger.debug('Transfer', `Buffering early chunks for fileId: ${fileId}`);
        }
        buf.push(chunk);
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

    channel.onmessage = (event) => handleDataMessage(remoteDeviceId, event.data);

    dataChannels.current.set(remoteDeviceId, channel);
  }, [handleDataMessage]);

  // ============ Peer Connection ============

  // Clean up peer connection
  const cleanupPeerConnection = useCallback((remoteDeviceId: string) => {
    const pc = peers.current.get(remoteDeviceId);
    if (pc) {
      console.log('Cleaning up peer connection with', remoteDeviceId);
      pc.close();
      peers.current.delete(remoteDeviceId);
    }
    dataChannels.current.delete(remoteDeviceId);
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
        const candidateType = parseCandidateType(event.candidate);
        console.log(`[ICE][${remoteDeviceId}] local candidate: ${candidateType}`);
      }
      if (event.candidate && ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({
          type: 'candidate',
          roomId: useStore.getState().currentRoom?.id,
          targetId: remoteDeviceId,
          payload: event.candidate,
        }));
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

                ws.current?.send(JSON.stringify({
                  type: 'offer',
                  roomId: room.id,
                  targetId: remoteDeviceId,
                  payload: offer,
                }));
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
        console.warn(
          `[ICE][${remoteDeviceId}] candidate error: ${event.errorCode} ${event.errorText} (${event.url || 'no-url'})`
        );
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

                ws.current?.send(JSON.stringify({
                  type: 'offer',
                  roomId: room.id,
                  targetId: remoteDeviceId,
                  payload: offer,
                }));
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

  // ============ Signaling ============

  const handleSignalMessage = useCallback(async (msg: SignalMessage) => {
    const store = useStore.getState();
    const myDeviceId = store.deviceId;
    const roomId = store.currentRoom?.id;

    if (!roomId || !myDeviceId) return;

    try {
      switch (msg.type) {
        case 'member-list': {
          // Update member list from server
          const members = msg.payload as MemberPayload[];
          for (const m of members) {
            if (m.deviceId !== myDeviceId) {
              // Check if member already exists
              const existingMember = store.currentRoom?.members.find(member => member.deviceId === m.deviceId);

              if (!existingMember) {
                // New member - add to list
                store.addMember({
                  deviceId: m.deviceId,
                  displayName: m.displayName,
                  joinedAt: m.joinedAt,
                  status: 'connecting' as const,
                });
              } else if (existingMember.status === 'offline') {
                // Member was offline - retry connection
                console.log('Retrying connection with offline member', m.displayName);
                store.updateMemberStatus(m.deviceId, 'connecting');
              }

              // Set timeout to check connection status
              setTimeout(() => {
                const currentMember = useStore.getState().currentRoom?.members.find(member => member.deviceId === m.deviceId);
                if (currentMember && currentMember.status === 'connecting') {
                  console.warn('Connection timeout for', m.displayName, '- marking as offline');
                  useStore.getState().updateMemberStatus(m.deviceId, 'offline');
                }
              }, 30000); // 30 seconds timeout

              // Check if we need to initiate connection
              const pc = peers.current.get(m.deviceId);
              const shouldInitiate = !pc || pc.connectionState === 'closed' || pc.connectionState === 'failed' ||
                pc.iceConnectionState === 'closed' || pc.iceConnectionState === 'failed';

              if (shouldInitiate && myDeviceId > m.deviceId) {
                console.log('Initiating connection with member', m.displayName, '(I am initiator)');
                try {
                  const newPc = createPeerConnection(m.deviceId, true);
                  const offer = await newPc.createOffer();
                  await newPc.setLocalDescription(offer);

                  ws.current?.send(JSON.stringify({
                    type: 'offer',
                    roomId,
                    targetId: m.deviceId,
                    payload: offer,
                  }));
                } catch (err) {
                  console.error('Failed to initiate connection:', err);
                  store.updateMemberStatus(m.deviceId, 'offline');
                }
              } else if (shouldInitiate) {
                console.log('Waiting for offer from member', m.displayName, '(they are initiator)');
              }
            }
          }
          store.setStatus('connected');
          break;
        }

        case 'member-joined': {
          const member = msg.payload as MemberPayload;
          if (member.deviceId !== myDeviceId) {
            // Check if member already exists
            const existingMember = store.currentRoom?.members.find(m => m.deviceId === member.deviceId);

            if (!existingMember) {
              // New member - add to list
              console.log('Member joined:', member.displayName);
              store.addMember({
                deviceId: member.deviceId,
                displayName: member.displayName,
                joinedAt: member.joinedAt,
                status: 'connecting' as const,
              });
            } else if (existingMember.status === 'offline') {
              // Member was offline - retry connection
              console.log('Retrying connection with offline member', member.displayName);
              store.updateMemberStatus(member.deviceId, 'connecting');
            }

            // Set timeout to check connection status
            setTimeout(() => {
              const currentMember = useStore.getState().currentRoom?.members.find(m => m.deviceId === member.deviceId);
              if (currentMember && currentMember.status === 'connecting') {
                console.warn('Connection timeout for', member.displayName, '- marking as offline');
                useStore.getState().updateMemberStatus(member.deviceId, 'offline');
              }
            }, 30000); // 30 seconds timeout

            // Check if we need to initiate connection
            const pc = peers.current.get(member.deviceId);
            const shouldInitiate = !pc || pc.connectionState === 'closed' || pc.connectionState === 'failed' ||
              pc.iceConnectionState === 'closed' || pc.iceConnectionState === 'failed';

            if (shouldInitiate && myDeviceId > member.deviceId) {
              console.log('Initiating connection with', member.displayName, '(I am initiator)');
              try {
                const newPc = createPeerConnection(member.deviceId, true);
                const offer = await newPc.createOffer();
                await newPc.setLocalDescription(offer);

                ws.current?.send(JSON.stringify({
                  type: 'offer',
                  roomId,
                  targetId: member.deviceId,
                  payload: offer,
                }));
              } catch (err) {
                console.error('Failed to initiate connection:', err);
                store.updateMemberStatus(member.deviceId, 'offline');
              }
            } else if (shouldInitiate) {
              console.log('Waiting for offer from', member.displayName, '(they are initiator)');
            }

            // Send my shared files (outbox) to the new member
            const myFiles = store.currentRoom?.files.filter(f => f.direction === 'outbox') || [];
            if (myFiles.length > 0) {
              console.log('Sending file list to new member:', member.displayName, `(${myFiles.length} files)`);
              myFiles.forEach(file => {
                const meta: FileMetadataPayload = {
                  id: file.id,
                  name: file.name,
                  size: file.size,
                  type: file.type,
                  uploaderId: store.deviceId!,
                  uploaderName: getShortName(store.deviceId!),
                  uploadedAt: file.uploadedAt,
                  thumbnailUrl: file.thumbnailUrl,
                };

                // Broadcast metadata (receivers will ignore duplicates)
                ws.current?.send(JSON.stringify({
                  type: 'file-meta',
                  roomId: store.currentRoom?.id,
                  payload: meta,
                }));
              });
            }
          }
          break;
        }

        case 'member-left': {
          const member = msg.payload as MemberPayload;
          console.log('Member left:', member.displayName);

          // Clean up peer connection
          const pc = peers.current.get(member.deviceId);
          if (pc) {
            pc.close();
            peers.current.delete(member.deviceId);
          }
          dataChannels.current.delete(member.deviceId);

          store.removeMember(member.deviceId);
          break;
        }

        case 'offer': {
          const senderDeviceId = msg.deviceId!;
          if (senderDeviceId === myDeviceId) return;

          console.log('Received offer from', senderDeviceId);
          const pc = createPeerConnection(senderDeviceId, false);

          await pc.setRemoteDescription(new RTCSessionDescription(msg.payload as RTCSessionDescriptionInit));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          ws.current?.send(JSON.stringify({
            type: 'answer',
            roomId,
            targetId: senderDeviceId,
            payload: answer,
          }));
          break;
        }

        case 'answer': {
          const senderDeviceId = msg.deviceId!;
          console.log('Received answer from', senderDeviceId);

          const pc = peers.current.get(senderDeviceId);
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.payload as RTCSessionDescriptionInit));
          }
          break;
        }

        case 'candidate': {
          const senderDeviceId = msg.deviceId!;
          const pc = peers.current.get(senderDeviceId);
          if (pc && msg.payload) {
            await pc.addIceCandidate(new RTCIceCandidate(msg.payload as RTCIceCandidateInit));
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
              logger.debug('Transfer', `Skip duplicate inbox meta for ${meta.name}`, meta.id);
              break;
            }

            console.log('File available:', meta.name, 'from', meta.uploaderName, meta.thumbnailUrl ? '(with thumbnail)' : '');
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
          const myFiles = store.currentRoom?.files.filter(
            (f) => f.direction === 'outbox' && !f.trashed
          ) || [];
          myFiles.forEach((file) => {
            const meta: FileMetadataPayload = {
              id: file.id,
              name: file.name,
              size: file.size,
              type: file.type,
              uploaderId: store.deviceId!,
              uploaderName: getShortName(store.deviceId!),
              uploadedAt: file.uploadedAt,
              thumbnailUrl: file.thumbnailUrl,
            };
            ws.current?.send(JSON.stringify({
              type: 'file-meta',
              roomId: store.currentRoom?.id,
              payload: meta,
            }));
          });
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
            sendFileToOne(file, fileId, requesterId);
          }
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
    } catch (err) {
      console.error('Signal handling error:', err);
    }
  }, [createPeerConnection]);

  // ============ Connection ============

  const connect = useCallback((roomId: string, isCreator: boolean) => {
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

      const joinPayload = { deviceId, displayName };
      ws.current?.send(JSON.stringify({
        type: 'join',
        roomId,
        payload: joinPayload,
      }));
    };

    ws.current.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleSignalMessage(msg);
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

    ws.current?.send(JSON.stringify({
      type: 'file-meta',
      roomId: room.id,
      payload: meta,
    }));

    analytics.track('file_shared', { fileType: file.type, fileSize: file.size });
    console.log('File shared:', file.name, thumbnailUrl ? '(with thumbnail)' : '');
  }, []);

  // Cancel an in-progress download (receiver-initiated)
  const cancelFileDownload = useCallback((fileId: string) => {
    const store = useStore.getState();
    const file = store.currentRoom?.files.find((f) => f.id === fileId);
    if (!file || file.status !== 'downloading') return;

    const uploaderId = file.uploaderId;
    const dc = dataChannels.current.get(uploaderId);
    if (dc?.readyState === 'open') {
      dc.send(JSON.stringify({ type: 'file-cancel', fileId }));
    }

    incomingChunks.current.delete(fileId);
    lastProgressReported.current.delete(fileId);
    requestModes.current.delete(fileId);
    store.updateFileStatus(fileId, 'available');
    store.updateFileProgress(fileId, 0);
  }, []);

  // Request a file, with preferred completion mode for text files.
  const requestFile = useCallback((file: FileMetadata, mode: 'download' | 'copy' = 'download') => {
    const store = useStore.getState();
    const room = store.currentRoom;
    if (!room || !store.deviceId) return;

    console.log('Requesting file:', file.name, 'from', file.uploaderId);
    requestModes.current.set(file.id, mode);

    // Send request via signaling server
    ws.current?.send(JSON.stringify({
      type: 'file-request',
      roomId: room.id,
      targetId: file.uploaderId,
      payload: {
        fileId: file.id,
        requesterId: store.deviceId,
      },
    }));

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

    ws.current?.send(JSON.stringify({
      type: 'file-meta-sync-request',
      roomId: room.id,
      payload: { requesterId: store.deviceId },
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
    const abortKey = `${fileId}-${targetDeviceId}`;
    const ac = new AbortController();
    sendAbortControllers.current.set(abortKey, ac);
    store.updateFileDownloaderProgress(fileId, targetDeviceId, 0);
    let completed = false; // true when receiver will send file-progress 100%

    try {
      // Send start message
      dc.send(JSON.stringify({
        type: 'file-start',
        payload: {
          id: fileId,
          name: file.name,
          size: file.size,
          type: file.type,
          uploaderId: store.deviceId,
          uploaderName: getShortName(store.deviceId!),
          uploadedAt: Date.now(),
        },
      }));

      // Read and send chunks
      const buffer = await file.arrayBuffer();
      const totalBytes = buffer.byteLength;
      let offset = 0;
      const encoder = new TextEncoder();
      const fileIdBytes = encoder.encode(fileId.padEnd(FILE_ID_HEADER, ' '));

      // Pre-allocate reusable send buffer to avoid per-chunk allocation
      const sendBuf = new Uint8Array(FILE_ID_HEADER + CHUNK_SIZE);
      sendBuf.set(fileIdBytes, 0);
      let lastSenderProgress = 0;

      const sendChunk = (): Promise<void> => {
        return new Promise((resolve, reject) => {
          const send = () => {
            try {
              while (offset < totalBytes) {
                if (ac.signal.aborted) {
                  reject(new Error('Cancelled'));
                  return;
                }

                if (dc.bufferedAmount > BUFFER_HIGH_THRESHOLD) {
                  dc.onbufferedamountlow = () => {
                    dc.onbufferedamountlow = null;
                    send();
                  };
                  return;
                }

                const end = Math.min(offset + CHUNK_SIZE, totalBytes);
                const chunkLen = end - offset;

                // Reuse pre-allocated buffer: copy chunk data after the 36-byte header
                sendBuf.set(new Uint8Array(buffer, offset, chunkLen), FILE_ID_HEADER);
                dc.send(sendBuf.buffer.slice(0, FILE_ID_HEADER + chunkLen));

                offset = end;

                // Sender-side progress (throttled to 1% steps)
                const senderProgress = Math.min(100, Math.round((offset / totalBytes) * 100));
                if (senderProgress >= 100 || senderProgress - lastSenderProgress >= 1) {
                  lastSenderProgress = senderProgress;
                  store.updateFileDownloaderProgress(fileId, targetDeviceId, senderProgress);
                }
              }
              resolve();
            } catch (err) {
              reject(err);
            }
          };
          send();
        });
      };

      await sendChunk();

      // Send end message (receiver will send file-progress 100% when done, then we remove downloader)
      dc.send(JSON.stringify({ type: 'file-end', fileId }));
      completed = true;
      logger.info('Transfer', `File sent`, targetDeviceId);

    } catch (err) {
      if ((err as Error).message !== 'Cancelled') {
        logger.error('Transfer', `Send error: ${err}`);
      }
    } finally {
      sendAbortControllers.current.delete(abortKey);
      // Only remove on error/cancel: on success, receiver will send file-progress 100% and we remove there
      if (!completed) {
        useStore.getState().removeFileDownloader(fileId, targetDeviceId);
      }
    }
  }, []);

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
    ws.current?.send(JSON.stringify({
      type: 'chat',
      roomId: room.id,
      payload: {
        text,
        senderId: store.deviceId,
        senderName: myName,
        timestamp,
      },
    }));
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
          console.log('Reconnecting to room:', currentRoom.id);
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
            ws.current.send(JSON.stringify({
              type: 'offer',
              roomId: store.currentRoom?.id,
              targetId: remoteDeviceId,
              payload: pc.localDescription,
            }));
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
  }, [copyTextBlobToClipboard, requestFile]);

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
  };
};
