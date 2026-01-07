import { useEffect, useRef, useCallback } from 'react';
import { useStore, FileTransfer } from '@/store/store';
import { getSignalingServerUrl, ICE_SERVERS } from '@/lib/constants';

type SignalMessage = {
  type: 'join' | 'offer' | 'answer' | 'candidate' | 'peer-joined' | 'peer-left';
  roomId: string;
  payload?: unknown;
};

type FileMetadata = {
  type: 'file-meta';
  fileId: string;
  name: string;
  size: number;
  mime: string;
};

type TransferMessage = {
  type: 'transfer-start' | 'transfer-complete' | 'transfer-cancel';
  fileId: string;
};

const CHUNK_SIZE = 16 * 1024; // 16KB chunks

export const useWebRTC = () => {
  const ws = useRef<WebSocket | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const dc = useRef<RTCDataChannel | null>(null);
  const sendAbortController = useRef<AbortController | null>(null);

  // File receiver state
  const incomingFile = useRef<{
    meta: FileMetadata;
    receivedSize: number;
    chunks: ArrayBuffer[];
    storeId: string;
  } | null>(null);

  const cleanup = useCallback(() => {
    sendAbortController.current?.abort();
    dc.current?.close();
    pc.current?.close();
    ws.current?.close();
    
    dc.current = null;
    pc.current = null;
    ws.current = null;
    incomingFile.current = null;
    
    useStore.getState().setStatus('idle');
  }, []);

  // Download completed file
  const downloadFile = useCallback((fileData: { meta: FileMetadata; chunks: ArrayBuffer[] }) => {
    const blob = new Blob(fileData.chunks, { type: fileData.meta.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileData.meta.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  // Handle incoming data channel messages
  const handleDataMessage = useCallback((data: unknown) => {
    const store = useStore.getState();
    
    // String messages (metadata, control)
    if (typeof data === 'string') {
      try {
        const msg = JSON.parse(data);
        
        if (msg.type === 'file-meta') {
          console.log('Receiving file:', msg.name);
          const fileId = store.addFile({
            name: msg.name,
            size: msg.size,
            type: msg.mime,
            direction: 'receive',
          });
          
          incomingFile.current = {
            meta: msg,
            receivedSize: 0,
            chunks: [],
            storeId: fileId,
          };
          
          store.setCurrentFile(fileId);
          store.updateFileStatus(fileId, 'transferring');
          store.setStatus('transferring');
        } else if (msg.type === 'transfer-complete') {
          console.log('Transfer complete signal received');
        } else if (msg.type === 'transfer-cancel') {
          if (incomingFile.current) {
            store.updateFileStatus(incomingFile.current.storeId, 'error');
            incomingFile.current = null;
          }
        }
      } catch (e) {
        console.log('Received text:', data);
      }
      return;
    }

    // Binary data (file chunks)
    if (incomingFile.current && data instanceof ArrayBuffer) {
      const chunk = data;
      incomingFile.current.chunks.push(chunk);
      incomingFile.current.receivedSize += chunk.byteLength;

      const progress = Math.min(
        100,
        Math.round((incomingFile.current.receivedSize / incomingFile.current.meta.size) * 100)
      );
      
      store.updateFileProgress(incomingFile.current.storeId, progress);

      // Check if transfer complete
      if (incomingFile.current.receivedSize >= incomingFile.current.meta.size) {
        console.log('File transfer complete');
        store.updateFileStatus(incomingFile.current.storeId, 'completed');
        store.setStatus('connected');
        downloadFile(incomingFile.current);
        incomingFile.current = null;
      }
    }
  }, [downloadFile]);

  // Setup data channel event handlers
  const setupDataChannel = useCallback((channel: RTCDataChannel) => {
    channel.binaryType = 'arraybuffer';
    // Set threshold for flow control (e.g., 64KB)
    channel.bufferedAmountLowThreshold = 65536;
    
    channel.onopen = () => {
      console.log('Data channel open');
      useStore.getState().setStatus('connected');
    };
    
    channel.onclose = () => {
      console.log('Data channel closed');
    };
    
    channel.onerror = (error) => {
      console.error('Data channel error:', error);
    };
    
    channel.onmessage = (event) => handleDataMessage(event.data);
  }, [handleDataMessage]);

  // Send WebRTC offer
  const sendOffer = useCallback(async () => {
    if (!pc.current || !ws.current || ws.current.readyState !== WebSocket.OPEN) {
      console.error('Cannot send offer: connection not ready');
      return;
    }

    // Create data channel for file transfer
    dc.current = pc.current.createDataChannel('coral-transfer', { ordered: true });
    setupDataChannel(dc.current);

    try {
      const offer = await pc.current.createOffer();
      await pc.current.setLocalDescription(offer);
      console.log('Sending offer');
      
      ws.current.send(JSON.stringify({
        type: 'offer',
        roomId: useStore.getState().roomId,
        payload: offer,
      }));
    } catch (err) {
      console.error('Failed to create offer:', err);
      useStore.getState().setError('Failed to create connection offer');
    }
  }, [setupDataChannel]);

  // Handle signaling messages
  const handleSignalMessage = useCallback(async (msg: SignalMessage) => {
    const store = useStore.getState();
    const currentRole = store.role;
    const currentStatus = store.status;

    try {
      switch (msg.type) {
        case 'peer-joined':
          console.log('Peer joined the room');
          store.setPeer({ id: msg.payload as string || 'peer', joinedAt: Date.now() });
          
          if (currentRole === 'sender' && (currentStatus === 'waiting-peer' || currentStatus === 'connecting')) {
            store.setStatus('peer-joined');
            setTimeout(() => sendOffer(), 100);
          } else if (currentRole === 'receiver') {
            console.log('Receiver: waiting for offer from sender');
          }
          break;

        case 'peer-left':
          console.log('Peer left the room');
          store.setPeer(null);
          if (store.status === 'connected') {
            store.setStatus('disconnected');
          }
          break;

        case 'offer':
          if (currentRole === 'receiver' && pc.current) {
            console.log('Received offer');
            await pc.current.setRemoteDescription(new RTCSessionDescription(msg.payload as RTCSessionDescriptionInit));
            const answer = await pc.current.createAnswer();
            await pc.current.setLocalDescription(answer);
            console.log('Sending answer');
            
            ws.current?.send(JSON.stringify({
              type: 'answer',
              roomId: msg.roomId,
              payload: answer,
            }));
          }
          break;

        case 'answer':
          if (currentRole === 'sender' && pc.current) {
            console.log('Received answer');
            await pc.current.setRemoteDescription(new RTCSessionDescription(msg.payload as RTCSessionDescriptionInit));
          }
          break;

        case 'candidate':
          if (msg.payload && pc.current) {
            console.log('Adding ICE candidate');
            await pc.current.addIceCandidate(new RTCIceCandidate(msg.payload as RTCIceCandidateInit));
          }
          break;
      }
    } catch (err) {
      console.error('Signaling error:', err);
      store.setError('Failed to establish P2P connection');
    }
  }, [sendOffer]);

  // Initialize peer connection
  const initializePeerConnection = useCallback(() => {
    pc.current = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.current.onicecandidate = (event) => {
      if (event.candidate && ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({
          type: 'candidate',
          roomId: useStore.getState().roomId,
          payload: event.candidate,
        }));
      }
    };

    pc.current.onconnectionstatechange = () => {
      const state = pc.current?.connectionState;
      console.log('Connection state:', state);
      
      const store = useStore.getState();
      
      if (state === 'connected') {
        store.setStatus('connected');
      } else if (state === 'failed') {
        store.setError('P2P connection failed');
        store.setStatus('error');
      } else if (state === 'disconnected' || state === 'closed') {
        if (store.status === 'connected' || store.status === 'transferring') {
          store.setStatus('disconnected');
        }
      }
    };

    // Handle incoming data channel (for receiver)
    pc.current.ondatachannel = (event) => {
      console.log('Received data channel');
      dc.current = event.channel;
      setupDataChannel(dc.current);
    };
  }, [setupDataChannel]);

  // Connect to signaling server and join room
  const connect = useCallback((newRoomId: string, userRole: 'sender' | 'receiver') => {
    const store = useStore.getState();
    store.setRoomId(newRoomId);
    store.setRole(userRole);
    store.setStatus('connecting');
    store.setError(null);

    const wsUrl = getSignalingServerUrl();
    console.log('Connecting to signaling server:', wsUrl);
    
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log('WebSocket connected');
      ws.current?.send(JSON.stringify({ type: 'join', roomId: newRoomId }));
      
      initializePeerConnection();
      
      if (userRole === 'sender') {
        useStore.getState().setStatus('waiting-peer');
        console.log('Sender: waiting for peer to join');
      } else {
        console.log('Receiver: waiting for offer');
      }
    };

    ws.current.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log('Signaling message:', msg.type);
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
      if (event.code !== 1000) {
        const currentStatus = useStore.getState().status;
        if (currentStatus === 'connecting' || currentStatus === 'waiting-peer') {
          store.setError('Connection closed unexpectedly');
          store.setStatus('error');
        }
      }
    };
  }, [initializePeerConnection, handleSignalMessage]);

  // Send file to peer
  const sendFile = useCallback(async (file: File) => {
    if (!dc.current || dc.current.readyState !== 'open') {
      console.error('Data channel not ready');
      return;
    }

    const store = useStore.getState();
    
    // Add file to store
    const fileId = store.addFile({
      name: file.name,
      size: file.size,
      type: file.type,
      direction: 'send',
    });
    
    store.setCurrentFile(fileId);
    store.updateFileStatus(fileId, 'transferring');
    store.setStatus('transferring');

    // Create abort controller for this transfer
    sendAbortController.current = new AbortController();

    try {
      // Send file metadata
      const metadata: FileMetadata = {
        type: 'file-meta',
        fileId,
        name: file.name,
        size: file.size,
        mime: file.type || 'application/octet-stream',
      };
      dc.current.send(JSON.stringify(metadata));

      // Read file and send chunks
      const buffer = await file.arrayBuffer();
      let offset = 0;

      const sendNextChunk = (): Promise<void> => {
        return new Promise((resolve, reject) => {
          if (sendAbortController.current?.signal.aborted) {
            reject(new Error('Transfer cancelled'));
            return;
          }

          const sendChunk = () => {
            try {
              while (offset < buffer.byteLength) {
                if (sendAbortController.current?.signal.aborted) {
                  reject(new Error('Transfer cancelled'));
                  return;
                }

                // Flow control: Wait if buffer is getting full (1MB threshold)
                if (dc.current!.bufferedAmount > 1024 * 1024) {
                  dc.current!.onbufferedamountlow = () => {
                    dc.current!.onbufferedamountlow = null;
                    sendChunk();
                  };
                  return;
                }

                const end = Math.min(offset + CHUNK_SIZE, buffer.byteLength);
                const chunk = buffer.slice(offset, end);
                dc.current!.send(chunk);
                offset = end;

                // Update progress occasionally
                if (offset % (CHUNK_SIZE * 20) === 0 || offset === buffer.byteLength) {
                  const progress = Math.min(100, Math.round((offset / file.size) * 100));
                  useStore.getState().updateFileProgress(fileId, progress);
                }
              }
              resolve();
            } catch (err) {
              reject(err);
            }
          };

          sendChunk();
        });
      };

      await sendNextChunk();

      // Send completion message
      dc.current.send(JSON.stringify({ type: 'transfer-complete', fileId }));
      
      store.updateFileStatus(fileId, 'completed');
      store.setStatus('connected');
      console.log('File sent successfully');

    } catch (err) {
      console.error('Send error:', err);
      if ((err as Error).message !== 'Transfer cancelled') {
        store.updateFileStatus(fileId, 'error');
        store.setError('File transfer failed');
      }
    } finally {
      sendAbortController.current = null;
    }
  }, []);

  // Cancel current transfer
  const cancelTransfer = useCallback(() => {
    sendAbortController.current?.abort();
    
    const store = useStore.getState();
    if (store.currentFileId) {
      store.updateFileStatus(store.currentFileId, 'error');
    }
    
    // Notify peer
    if (dc.current?.readyState === 'open') {
      dc.current.send(JSON.stringify({ 
        type: 'transfer-cancel', 
        fileId: store.currentFileId 
      }));
    }
    
    store.setStatus('connected');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    connect,
    sendFile,
    cancelTransfer,
    cleanup,
  };
};
