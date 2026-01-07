import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/store/store';
import { getSignalingServerUrl, ICE_SERVERS } from '@/lib/constants';

type SignalMessage = {
  type: 'join' | 'offer' | 'answer' | 'candidate' | 'peer-joined';
  roomId: string;
  payload?: any;
};

type FileMetadata = {
  type: 'meta';
  name: string;
  size: number;
  mime: string;
};

const CHUNK_SIZE = 16 * 1024; // 16KB

export const useWebRTC = () => {
  const { roomId, role, setStatus, setProgress, setError } = useStore();
  const ws = useRef<WebSocket | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const dc = useRef<RTCDataChannel | null>(null);

  // File Receiver State (in ref to avoid re-renders during transfer)
  const incomingFile = useRef<{ meta: FileMetadata; receivedSize: number; chunks: ArrayBuffer[] } | null>(null);

  const cleanup = useCallback(() => {
    dc.current?.close();
    pc.current?.close();
    ws.current?.close();
    setStatus('idle');
    setProgress(0);
    incomingFile.current = null;
  }, [setStatus, setProgress]);

  // --- Signaling Logic ---
  const handleSignalMessage = useCallback(async (msg: SignalMessage) => {
    const currentRole = useStore.getState().role;
    try {
      switch (msg.type) {
        case 'peer-joined':
          // When sender receives this, it means receiver has joined
          const currentStatus = useStore.getState().status;
          if (currentRole === 'sender' && currentStatus === 'connecting') {
            console.log('Sender: Peer joined! Sending offer...');
            // Now send the offer
            sendOffer();
          } else if (currentRole === 'receiver' && currentStatus === 'connecting') {
            // Receiver also gets peer-joined when sender joins
            // But receiver should wait for offer, not send anything
            console.log('Receiver: Sender is in room, waiting for offer...');
          }
          break;

        case 'offer':
          if (currentRole === 'receiver' && pc.current) {
            console.log('Receiver: Received offer');
            await pc.current.setRemoteDescription(new RTCSessionDescription(msg.payload));
            const answer = await pc.current.createAnswer();
            await pc.current.setLocalDescription(answer);
            console.log('Receiver: Sending answer:', answer.type);
            ws.current?.send(JSON.stringify({
              type: 'answer',
              roomId: msg.roomId,
              payload: answer
            }));
          }
          break;

        case 'answer':
          if (currentRole === 'sender' && pc.current) {
            console.log('Sender: Received answer');
            await pc.current.setRemoteDescription(new RTCSessionDescription(msg.payload));
          }
          break;

        case 'candidate':
          if (msg.payload && pc.current) {
            console.log('Received ICE candidate');
            await pc.current.addIceCandidate(new RTCIceCandidate(msg.payload));
          }
          break;
      }
    } catch (err) {
      console.error('Signaling error:', err);
      setError('Failed to establish P2P connection');
    }
  }, [role, setError]);

  // --- Data Channel Logic ---
  const handleDataMessage = useCallback((data: any) => {
    // If string, it's metadata or chat
    if (typeof data === 'string') {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'meta') {
          console.log('Receiving file:', msg.name);
          incomingFile.current = {
            meta: msg,
            receivedSize: 0,
            chunks: []
          };
          setStatus('transferring');
          setProgress(0);
        }
      } catch (e) {
        console.log('Received text:', data);
      }
      return;
    }

    // If ArrayBuffer/Blob, it's file data
    if (incomingFile.current) {
      const chunk = data as ArrayBuffer;
      incomingFile.current.chunks.push(chunk);
      incomingFile.current.receivedSize += chunk.byteLength;

      const progress = Math.min(100, Math.round((incomingFile.current.receivedSize / incomingFile.current.meta.size) * 100));
      // Optimize: Only update state every few % to avoid lag
      useStore.getState().setProgress(progress);

      if (incomingFile.current.receivedSize >= incomingFile.current.meta.size) {
        console.log('File Transfer Complete');
        setStatus('completed');
        downloadFile(incomingFile.current);
        incomingFile.current = null;
      }
    }
  }, [setStatus, setProgress]);

  const downloadFile = (fileData: { meta: FileMetadata; chunks: ArrayBuffer[] }) => {
    const blob = new Blob(fileData.chunks, { type: fileData.meta.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileData.meta.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const setupDataChannel = useCallback((channel: RTCDataChannel) => {
    channel.onopen = () => {
      console.log('Data Channel Open');
      setStatus('connected');
    };
    channel.onmessage = (event) => handleDataMessage(event.data);
  }, [setStatus, handleDataMessage]);

  const initializePeerConnection = useCallback(() => {
    pc.current = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.current.onicecandidate = (event) => {
      if (event.candidate && ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({
          type: 'candidate',
          roomId: useStore.getState().roomId,
          payload: event.candidate
        }));
      }
    };

    pc.current.onconnectionstatechange = () => {
      const state = pc.current?.connectionState;
      console.log('P2P Connection State:', state);
      if (state === 'connected') {
        console.log('P2P Connected!');
        setStatus('connected');
      } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        console.error('P2P Connection failed:', state);
        if (state === 'failed') {
          setError('P2P connection failed. Please try again.');
        }
      }
    };

    // Receiver: Handle incoming data channel
    pc.current.ondatachannel = (event) => {
      dc.current = event.channel;
      setupDataChannel(dc.current);
    };
  }, [setStatus, setupDataChannel]);


  const sendOffer = useCallback(async () => {
    if (!pc.current || !ws.current || ws.current.readyState !== WebSocket.OPEN) return;
    
    // Reliable channel for file transfer
    dc.current = pc.current.createDataChannel('file-transfer', { ordered: true });
    setupDataChannel(dc.current);

    const offer = await pc.current.createOffer();
    await pc.current.setLocalDescription(offer);
    console.log('Sending offer:', offer.type);
    ws.current.send(JSON.stringify({
      type: 'offer',
      roomId: useStore.getState().roomId,
      payload: offer
    }));
  }, [setupDataChannel]);

  const connect = useCallback((newRoomId: string, userRole: 'sender' | 'receiver') => {
    useStore.getState().setRoomId(newRoomId);
    useStore.getState().setRole(userRole);
    useStore.getState().setStatus('connecting');

    const wsUrl = getSignalingServerUrl();
    console.log('Connecting to WebSocket:', wsUrl);
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = async () => {
      console.log('WS Connected');
      ws.current?.send(JSON.stringify({ type: 'join', roomId: newRoomId }));

      // Initialize peer connection for both sender and receiver
      initializePeerConnection();

      if (userRole === 'sender') {
        // Sender: wait for peer-joined message before sending offer
        console.log('Sender: Waiting for receiver to join...');
      } else {
        // Receiver: wait for offer, handled in handleSignalMessage
        console.log('Receiver: Waiting for offer...');
      }
    };

    ws.current.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      console.log('Received signaling message:', msg.type, 'from role:', role);
      handleSignalMessage(msg);
    };

    ws.current.onerror = (err) => {
      console.error('WS Error:', err);
      const wsUrl = getSignalingServerUrl();
      setError(`WebSocket connection failed. Trying to connect to: ${wsUrl}`);
    };

    ws.current.onclose = (event) => {
      console.log('WS Closed:', event.code, event.reason);
      if (event.code !== 1000 && useStore.getState().status === 'connecting') {
        const wsUrl = getSignalingServerUrl();
        setError(`Connection closed. Server may be unreachable at: ${wsUrl}`);
      }
    };
  }, [initializePeerConnection, handleSignalMessage, setError, sendOffer]);

  const sendFile = async (file: File) => {
    if (!dc.current || dc.current.readyState !== 'open') return;

    setStatus('transferring');
    setProgress(0);

    // 1. Send Metadata
    const metadata: FileMetadata = { type: 'meta', name: file.name, size: file.size, mime: file.type };
    dc.current.send(JSON.stringify(metadata));

    // 2. Read and Send Chunks
    const buffer = await file.arrayBuffer();
    let offset = 0;

    const sendChunk = () => {
      while (offset < buffer.byteLength) {
        // Flow control: Don't overflow the buffer
        if (dc.current!.bufferedAmount > 16 * 1024 * 1024) { // 16MB buffer limit
             return; // Wait for onbufferedamountlow
        }
        
        const end = Math.min(offset + CHUNK_SIZE, buffer.byteLength);
        const chunk = buffer.slice(offset, end);
        dc.current!.send(chunk);
        offset += CHUNK_SIZE;
        
        const progress = Math.min(100, Math.round((offset / file.size) * 100));
        useStore.getState().setProgress(progress);
      }
      
      if (offset >= buffer.byteLength) {
         setStatus('completed');
         // We might want to remove the listener
         dc.current!.onbufferedamountlow = null;
      }
    };

    dc.current.onbufferedamountlow = sendChunk;
    sendChunk(); // Start sending
  };

  const sendMessage = (msg: string) => {
    if (dc.current?.readyState === 'open') {
      dc.current.send(msg);
    }
  };

  return { connect, sendMessage, sendFile, cleanup };
};
