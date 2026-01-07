'use client';

import { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useStore } from '@/store/store';
import { Send, Download, Loader2, FileUp, CheckCircle, Copy, Link as LinkIcon, ClipboardPaste, AlertCircle, X } from 'lucide-react';

export default function Home() {
  const [view, setView] = useState<'home' | 'send' | 'receive'>('home');
  const [copySuccess, setCopySuccess] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const { connect, sendFile, cleanup } = useWebRTC();
  const { roomId, status, role, progress, error } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validate UUID format (simple regex check)
  const isValidUUID = (str: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  // Validate and handle room parameter from URL
  const validateAndConnect = (roomIdParam: string) => {
    if (!isValidUUID(roomIdParam)) {
      setLinkError(`Invalid room code: ${roomIdParam.substring(0, 8)}...`);
      setView('home');
      // Clean URL
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', window.location.pathname);
      }
      return false;
    }
    setLinkError(null);
    return true;
  };

  // Check for room parameter in URL on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam) {
        if (validateAndConnect(roomParam)) {
          setView('receive');
          connect(roomParam, 'receiver');
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen to connection errors and reset to home
  useEffect(() => {
    if (error && view === 'receive') {
      setLinkError(error);
      setView('home');
      useStore.getState().setError(null);
      // Clean URL
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [error, view]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const startSending = () => {
    setLinkError(null);
    const newRoomId = uuidv4();
    setView('send');
    connect(newRoomId, 'sender');
  };

  const startReceiving = () => {
    setLinkError(null);
    setView('receive');
  };

  const copyLink = async () => {
    if (roomId) {
      try {
        const link = `${window.location.origin}?room=${roomId}`;
        await navigator.clipboard.writeText(link);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (err) {
        console.error('Failed to copy!', err);
      }
    }
  };

  const pasteLink = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        onScanSuccess(text);
      }
    } catch (err) {
      console.error('Failed to read clipboard!', err);
      setLinkError('Failed to read from clipboard');
    }
  };

  const onScanSuccess = (decodedText: string) => {
    try {
      let targetRoomId = decodedText;
      if (decodedText.includes('room=')) {
        const url = new URL(decodedText);
        targetRoomId = url.searchParams.get('room') || decodedText;
      }
      if (targetRoomId) {
        if (validateAndConnect(targetRoomId)) {
          setView('receive');
          connect(targetRoomId, 'receiver');
        }
      }
    } catch (e) {
      console.error("Scan error", e);
      setLinkError('Invalid QR code format');
      setView('home');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      sendFile(file);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-900 text-white p-4 font-sans">
      <div className="z-10 max-w-md w-full text-center space-y-8">
        <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-cyan-500 font-display">
          mardjan
        </h1>
        <p className="text-slate-400">Secure P2P File Transfer</p>

        {view === 'home' && (
          <div className="space-y-4">
            {linkError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-4">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-400 font-medium text-sm">{linkError}</p>
                  <p className="text-red-300/70 text-xs mt-1">The room code may be invalid or expired.</p>
                </div>
                <button
                  onClick={() => setLinkError(null)}
                  className="text-red-400 hover:text-red-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={startSending}
                className="flex flex-col items-center justify-center p-6 bg-slate-800 rounded-2xl hover:bg-slate-700 transition-all border border-slate-700 aspect-square group"
              >
                <Send className="w-12 h-12 mb-4 text-teal-400 group-hover:scale-110 transition-transform" />
                <span className="text-xl font-medium">Send</span>
              </button>
              <button
                onClick={startReceiving}
                className="flex flex-col items-center justify-center p-6 bg-slate-800 rounded-2xl hover:bg-slate-700 transition-all border border-slate-700 aspect-square group"
              >
                <Download className="w-12 h-12 mb-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                <span className="text-xl font-medium">Receive</span>
              </button>
            </div>
          </div>
        )}

        {view === 'send' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {status === 'connecting' && (
              <>
                <div className="bg-white p-4 rounded-xl inline-block shadow-lg shadow-teal-500/20">
                  {roomId && <QRCodeSVG value={`${typeof window !== 'undefined' ? window.location.origin : ''}?room=${roomId}`} size={200} />}
                </div>

                <div className="flex flex-col gap-3">
                  <p className="text-slate-400">Scan this code to connect</p>
                  <button
                    onClick={copyLink}
                    className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 py-2 px-4 rounded-lg text-sm transition-colors border border-slate-700"
                  >
                    {copySuccess ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    {copySuccess ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>

                <div className="flex items-center justify-center gap-2 text-yellow-400">
                  <Loader2 className="animate-spin" /> Waiting for peer...
                </div>
              </>
            )}

            {status === 'connected' && (
              <div className="bg-slate-800 p-8 rounded-2xl border border-teal-500/30 space-y-6">
                <div className="text-teal-400 font-bold text-xl flex items-center justify-center gap-2">
                  <CheckCircle /> Peer Connected
                </div>

                <div className="py-8 border-2 border-dashed border-slate-600 rounded-xl hover:bg-slate-700/50 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}>
                  <FileUp className="w-16 h-16 mx-auto mb-2 text-slate-400" />
                  <p>Tap to select file</p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'receive' && status === 'idle' && (
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 w-full max-w-sm space-y-4">
            <h2 className="mb-2 text-lg font-medium">Scan QR Code</h2>
            <div className="rounded-lg overflow-hidden">
              <QRScanner onScan={onScanSuccess} />
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-600" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-800 px-2 text-slate-400">Or</span>
              </div>
            </div>

            <button
              onClick={pasteLink}
              className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 py-3 px-4 rounded-xl transition-colors font-medium"
            >
              <ClipboardPaste className="w-5 h-5 text-cyan-400" />
              Paste from Clipboard
            </button>
          </div>
        )}

        {view === 'receive' && status === 'connecting' && (
          <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 w-full space-y-4">
            <div className="flex items-center justify-center gap-2 text-yellow-400">
              <Loader2 className="animate-spin" /> Connecting to peer...
            </div>
            <p className="text-slate-400 text-sm">Establishing secure connection</p>
          </div>
        )}

        {view === 'receive' && status === 'connected' && (
          <div className="bg-slate-800 p-8 rounded-2xl border border-teal-500/30 w-full space-y-4">
            <div className="text-teal-400 font-bold text-xl flex items-center justify-center gap-2">
              <CheckCircle /> Connected
            </div>
            <p className="text-slate-400 text-sm">Waiting for file...</p>
          </div>
        )}

        {(status === 'transferring' || status === 'completed') && (
          <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 w-full space-y-6">
            <h3 className="text-xl font-bold">{status === 'completed' ? 'Transfer Complete' : 'Transferring...'}</h3>

            <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden">
              <div
                className="bg-teal-500 h-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-right text-slate-400">{progress}%</p>

            {status === 'completed' && role === 'receiver' && (
              <p className="text-green-400">File downloaded automatically.</p>
            )}
            {status === 'completed' && role === 'sender' && (
              <button onClick={() => setView('home')} className="text-sm underline text-slate-400">
                Send another file
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function QRScanner({ onScan }: { onScan: (data: string) => void }) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );
    scanner.render((text) => {
      scanner.clear();
      onScan(text);
    }, (err) => {
      // console.warn(err);
    });

    return () => {
      scanner.clear().catch(err => console.error("Failed to clear scanner", err));
    };
  }, [onScan]);

  return <div id="reader" className="w-full overflow-hidden rounded-lg"></div>;
}
