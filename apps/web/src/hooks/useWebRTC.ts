import { useEffect, useRef, useCallback } from 'react';
import { useStore, type Member, type FileMetadata, type ChatMessage } from '@/store/store';
import { getSignalingServerUrl, ICE_SERVERS } from '@/lib/constants';
import { getDeviceId, getShortName } from '@/lib/deviceId';

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

// ============ Constants ============

const CHUNK_SIZE = 16 * 1024; // 16KB chunks
const BUFFER_LOW_THRESHOLD = 65536; // 64KB
const BUFFER_HIGH_THRESHOLD = 1024 * 1024; // 1MB
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

async function logSelectedIcePath(pc: RTCPeerConnection, remoteDeviceId: string): Promise<void> {
  if (!ICE_DIAGNOSTICS) return;

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
      console.log(`[ICE][${remoteDeviceId}] no selected candidate pair yet`);
      return;
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

    console.log(
      `[ICE][${remoteDeviceId}] selected pair state=${pair.state ?? 'unknown'} local=${localType}/${localProtocol} remote=${remoteType}/${remoteProtocol}`
    );
  } catch (error) {
    console.warn(`[ICE][${remoteDeviceId}] failed to read selected candidate pair`, error);
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
  const incomingChunks = useRef<Map<string, { meta: FileMetadataPayload; chunks: ArrayBuffer[] }>>(new Map());
  const sendAbortController = useRef<AbortController | null>(null);

  // ============ Cleanup ============

  const cleanup = useCallback(() => {
    sendAbortController.current?.abort();

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

    useStore.getState().reset();
  }, []);

  // ============ File Download ============

  const downloadFile = useCallback((meta: FileMetadataPayload, chunks: ArrayBuffer[]) => {
    const blob = new Blob(chunks, { type: meta.type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = meta.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

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
          console.log('Receiving file from', senderDeviceId, ':', meta.name);

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

          incomingChunks.current.set(meta.id, { meta, chunks: [] });
          store.updateFileStatus(meta.id, 'downloading');
          store.updateFileProgress(meta.id, 0);

        } else if (msg.type === 'file-end') {
          // File transfer complete
          const fileId = msg.fileId;
          const incoming = incomingChunks.current.get(fileId);

          if (incoming) {
            console.log('File transfer complete:', incoming.meta.name);
            store.updateFileStatus(fileId, 'completed');
            downloadFile(incoming.meta, incoming.chunks);
            incomingChunks.current.delete(fileId);
          }
        }
      } catch (e) {
        console.log('Received text:', data);
      }
      return;
    }

    // Binary data (file chunks) with fileId prefix
    if (data instanceof ArrayBuffer) {
      // First 36 bytes are fileId (padded to 36 chars)
      const decoder = new TextDecoder();
      const fileIdBytes = data.slice(0, 36);
      const fileId = decoder.decode(fileIdBytes).trim();
      const chunk = data.slice(36);

      const incoming = incomingChunks.current.get(fileId);
      if (incoming) {
        incoming.chunks.push(chunk);
        const received = incoming.chunks.reduce((acc, c) => acc + c.byteLength, 0);
        const progress = Math.min(100, Math.round((received / incoming.meta.size) * 100));
        store.updateFileProgress(fileId, progress);
      } else {
        console.warn('Received chunk for unknown fileId:', fileId);
      }
    }
  }, [downloadFile]);

  const setupDataChannel = useCallback((channel: RTCDataChannel, remoteDeviceId: string) => {
    channel.binaryType = 'arraybuffer';
    channel.bufferedAmountLowThreshold = BUFFER_LOW_THRESHOLD;

    channel.onopen = () => {
      console.log('Data channel open with', remoteDeviceId);
      useStore.getState().updateMemberStatus(remoteDeviceId, 'online');
    };

    channel.onclose = () => {
      console.log('Data channel closed with', remoteDeviceId);
      const store = useStore.getState();
      store.updateMemberStatus(remoteDeviceId, 'offline');

      // Note: Retry logic is handled in peer connection state change handlers
      // This ensures we don't have circular dependencies
    };

    channel.onerror = (error) => {
      console.error('Data channel error with', remoteDeviceId, ':', error);
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

    console.log('Creating peer connection with', remoteDeviceId, isInitiator ? '(initiator)' : '(receiver)');

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
      console.log('ICE connection state with', remoteDeviceId, ':', state);

      if (state === 'connected' || state === 'completed') {
        useStore.getState().updateMemberStatus(remoteDeviceId, 'online');
        void logSelectedIcePath(pc, remoteDeviceId);
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
      console.log('Connection state with', remoteDeviceId, ':', state);

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

        case 'file-request': {
          // Someone wants to download a file I shared
          const { fileId, requesterId } = msg.payload as { fileId: string; requesterId: string };
          const file = pendingFiles.current.get(fileId);
          if (file) {
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
    console.log('Connecting to signaling server:', wsUrl);

    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log('WebSocket connected');

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
      console.error('WebSocket error:', err);
      store.setError(`Connection failed: ${wsUrl}`);
      store.setStatus('error');
    };

    ws.current.onclose = (event) => {
      console.log('WebSocket closed:', event.code);
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

    const fileId = Math.random().toString(36).substring(2, 15);
    const myName = getShortName(store.deviceId);
    const uploadedAt = Date.now();

    // Store file for later transfer requests
    pendingFiles.current.set(fileId, file);

    // Generate thumbnail for images
    const thumbnailUrl = await generateThumbnail(file);

    // Add to outbox with the same fileId
    store.addFile({
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      uploaderId: store.deviceId,
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
      uploaderId: store.deviceId,
      uploaderName: myName,
      uploadedAt,
      thumbnailUrl,
    };

    ws.current?.send(JSON.stringify({
      type: 'file-meta',
      roomId: room.id,
      payload: meta,
    }));

    console.log('File shared:', file.name, thumbnailUrl ? '(with thumbnail)' : '');
  }, []);

  // Request to download a file
  const requestFile = useCallback((file: FileMetadata) => {
    const store = useStore.getState();
    const room = store.currentRoom;
    if (!room || !store.deviceId) return;

    console.log('Requesting file:', file.name, 'from', file.uploaderId);

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

  // Send file to a specific peer
  const sendFileToOne = useCallback(async (file: File, fileId: string, targetDeviceId: string) => {
    const dc = dataChannels.current.get(targetDeviceId);
    if (!dc || dc.readyState !== 'open') {
      console.error('No data channel to', targetDeviceId);
      return;
    }

    const store = useStore.getState();
    sendAbortController.current = new AbortController();

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
      let offset = 0;
      const encoder = new TextEncoder();
      const fileIdBytes = encoder.encode(fileId.padEnd(36, ' '));

      const sendChunk = (): Promise<void> => {
        return new Promise((resolve, reject) => {
          const send = () => {
            try {
              while (offset < buffer.byteLength) {
                if (sendAbortController.current?.signal.aborted) {
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

                const end = Math.min(offset + CHUNK_SIZE, buffer.byteLength);
                const chunk = buffer.slice(offset, end);

                // Prepend fileId to chunk
                const combined = new Uint8Array(36 + chunk.byteLength);
                combined.set(fileIdBytes, 0);
                combined.set(new Uint8Array(chunk), 36);

                dc.send(combined.buffer);
                offset = end;
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

      // Send end message
      dc.send(JSON.stringify({ type: 'file-end', fileId }));
      console.log('File sent to', targetDeviceId);

    } catch (err) {
      console.error('Send error:', err);
    } finally {
      sendAbortController.current = null;
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

  // ============ Return ============

  return {
    connect,
    shareFile,
    requestFile,
    sendChat,
    cleanup,
    retryConnection,
  };
};
