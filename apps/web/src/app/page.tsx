'use client';

import { useState, useRef, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useStore } from '@/store/store';
import { getBaseUrl } from '@/lib/constants';
import { getDeviceId, getShortName } from '@/lib/deviceId';
import { extractRoomId, isValidUUID } from '@/lib/utils';
import {
  Logo,
  Button,
  Card,
  QRScanner,
  MemberList,
  MemberAvatarStack,
  FileList,
  RoomHistory,
  Chat,
  RoomSettings,
} from '@/components/ui';
import {
  Plus,
  QrCode,
  Copy,
  Check,
  ClipboardPaste,
  AlertCircle,
  X,
  ArrowLeft,
  FileUp,
  Share2,
  Users,
  Inbox,
  Send,
  Settings,
} from 'lucide-react';

// Generate room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function Home() {
  const [showScanner, setShowScanner] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'inbox' | 'outbox'>('inbox');

  const { connect, shareFile, requestFile, sendChat, cleanup } = useWebRTC();
  
  // Use individual selectors to prevent unnecessary re-renders
  const view = useStore((s) => s.view);
  const status = useStore((s) => s.status);
  const error = useStore((s) => s.error);
  const currentRoom = useStore((s) => s.currentRoom);
  const deviceId = useStore((s) => s.deviceId);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize device ID on mount
  useEffect(() => {
    if (!deviceId) {
      useStore.getState().setDeviceId(getDeviceId());
    }
  }, [deviceId]);

  // Handle room parameter in URL on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');

      if (roomParam) {
        window.history.replaceState({}, '', window.location.pathname);
        joinRoom(roomParam);
      }
    }
  }, []);

  // Handle connection errors
  useEffect(() => {
    if (error) {
      setLinkError(error);
      useStore.getState().setError(null);
    }
  }, [error]);

  // Create new room
  const createRoom = () => {
    setLinkError(null);
    const roomId = generateRoomCode();
    connect(roomId, true);
  };

  // Join existing room
  const joinRoom = (roomIdOrUrl: string) => {
    setLinkError(null);
    let roomId = extractRoomId(roomIdOrUrl) || roomIdOrUrl.toUpperCase();

    // Validate room code (6 alphanumeric characters)
    if (!/^[A-Z0-9]{6}$/.test(roomId) && !isValidUUID(roomId)) {
      setLinkError('Invalid room code format');
      return;
    }

    setShowScanner(false);
    connect(roomId, false);
  };

  // Leave room
  const leaveRoom = () => {
    cleanup();
    useStore.getState().leaveRoom();
    setLinkError(null);
  };

  // Copy share link
  const copyLink = async () => {
    if (!currentRoom) return;

    try {
      const baseUrl = getBaseUrl();
      const link = `${baseUrl}?room=${currentRoom.id}`;
      await navigator.clipboard.writeText(link);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Paste link from clipboard
  const pasteLink = async () => {
    try {
      const text = await navigator.clipboard.readText();
      joinRoom(text);
    } catch (err) {
      console.error('Clipboard error:', err);
      setLinkError('Unable to read clipboard');
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file) => shareFile(file));
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle file drag and drop
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      Array.from(files).forEach((file) => shareFile(file));
    }
  };

  // Get share URL
  const shareUrl = currentRoom ? `${getBaseUrl()}?room=${currentRoom.id}` : '';

  // ============ RENDER ============

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
      {/* Background pattern */}
      <div className="fixed inset-0 opacity-30">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, rgba(20, 184, 166, 0.15) 0%, transparent 50%),
                             radial-gradient(circle at 75% 75%, rgba(6, 182, 212, 0.15) 0%, transparent 50%)`,
          }}
        />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* ============ HOME VIEW ============ */}
        {view === 'home' && (
          <>
            {/* Header */}
            <header className="p-4 sm:p-6">
              <div className="max-w-lg mx-auto flex items-center justify-between">
                <Logo size="sm" />
                {deviceId && (
                  <span className="text-xs text-slate-500 bg-slate-800/50 px-2 py-1 rounded">
                    {getShortName(deviceId)}
                  </span>
                )}
              </div>
            </header>

            {/* Main content */}
            <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
              <div className="w-full max-w-md space-y-6">
                {/* Logo and tagline */}
                <div className="text-center space-y-4 mb-8">
                  <Logo size="lg" className="justify-center" />
                  <p className="text-slate-400 text-lg">Multi-Peer File Sharing</p>
                </div>

                {/* Error message */}
                {linkError && (
                  <Card variant="bordered" className="border-red-500/30 bg-red-500/5">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-red-400 text-sm">{linkError}</p>
                      </div>
                      <button onClick={() => setLinkError(null)}>
                        <X className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </Card>
                )}

                {/* Scanner view */}
                {showScanner ? (
                  <div className="space-y-4 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <Button variant="ghost" size="sm" onClick={() => setShowScanner(false)}>
                        <ArrowLeft className="w-4 h-4" />
                        Back
                      </Button>
                    </div>

                    <Card variant="bordered" className="overflow-hidden p-0">
                      <QRScanner onScan={joinRoom} onError={(e) => setLinkError(e)} />
                    </Card>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-700" />
                      </div>
                      <div className="relative flex justify-center">
                        <span className="bg-slate-900 px-4 text-sm text-slate-500">or</span>
                      </div>
                    </div>

                    <Button variant="secondary" className="w-full" onClick={pasteLink}>
                      <ClipboardPaste className="w-4 h-4" />
                      Paste Room Code
                    </Button>
                  </div>
                ) : (
                  /* Main actions */
                  <div className="space-y-4 animate-in fade-in">
                    {/* Create Room */}
                    <button
                      onClick={createRoom}
                      className="w-full group relative bg-gradient-to-r from-teal-500/10 to-cyan-500/10 border border-teal-500/30 rounded-2xl p-6 hover:border-teal-400/50 hover:from-teal-500/20 hover:to-cyan-500/20 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/25 group-hover:scale-110 transition-transform">
                          <Plus className="w-7 h-7 text-white" />
                        </div>
                        <div className="text-left">
                          <h3 className="text-xl font-semibold text-white">Create Room</h3>
                          <p className="text-slate-400 text-sm">Start a new sharing session</p>
                        </div>
                      </div>
                    </button>

                    {/* Join Room */}
                    <button
                      onClick={() => setShowScanner(true)}
                      className="w-full group relative bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-slate-600 hover:bg-slate-800/80 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-slate-700 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <QrCode className="w-7 h-7 text-cyan-400" />
                        </div>
                        <div className="text-left">
                          <h3 className="text-xl font-semibold text-white">Join Room</h3>
                          <p className="text-slate-400 text-sm">Scan QR code or enter code</p>
                        </div>
                      </div>
                    </button>

                    {/* Room History */}
                    <RoomHistory onRejoin={(roomId) => joinRoom(roomId)} />
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <footer className="p-4 text-center text-slate-500 text-xs">
              <p>Files are transferred directly between devices</p>
            </footer>
          </>
        )}

        {/* ============ ROOM VIEW ============ */}
        {view === 'room' && currentRoom && (
          <>
            {/* Header */}
            <header className="p-4 border-b border-slate-800">
              <div className="max-w-2xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" onClick={leaveRoom}>
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <div>
                    <h1 className="font-semibold text-white">Room {currentRoom.id}</h1>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Users className="w-3 h-3" />
                      <span>{currentRoom.members.length} members</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <MemberAvatarStack />
                  <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)}>
                    <Settings className="w-4 h-4" />
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setShowShare(true)}>
                    <Share2 className="w-4 h-4" />
                    Share
                  </Button>
                </div>
              </div>
            </header>

            {/* Main content */}
            <div className="flex-1 overflow-auto p-4">
              <div className="max-w-2xl mx-auto space-y-6">
                {/* Share modal */}
                {showShare && (
                  <Card variant="glow" className="animate-in fade-in">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-white">Share Room</h3>
                      <Button variant="ghost" size="icon" onClick={() => setShowShare(false)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 items-center">
                      <div className="bg-white p-3 rounded-xl">
                        <QRCodeSVG value={shareUrl} size={150} />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <p className="text-sm text-slate-400 mb-1">Room Code</p>
                          <p className="text-2xl font-mono font-bold text-teal-400">{currentRoom.id}</p>
                        </div>
                        <Button variant="secondary" onClick={copyLink} className="w-full sm:w-auto">
                          {copySuccess ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          {copySuccess ? 'Copied!' : 'Copy Link'}
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Member list */}
                <Card variant="bordered">
                  <MemberList />
                </Card>

                {/* Tab navigation */}
                <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
                  <button
                    onClick={() => setActiveTab('inbox')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                      activeTab === 'inbox'
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Inbox className="w-4 h-4" />
                    Inbox
                  </button>
                  <button
                    onClick={() => setActiveTab('outbox')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                      activeTab === 'outbox'
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Send className="w-4 h-4" />
                    Outbox
                  </button>
                </div>

                {/* File list */}
                <Card variant="bordered">
                  <FileList
                    direction={activeTab}
                    onDownload={(file) => requestFile(file)}
                  />
                </Card>

                {/* Chat */}
                <Chat
                  messages={currentRoom.messages}
                  onSend={sendChat}
                />
              </div>
        </div>

            {/* Floating action button */}
            <div className="fixed bottom-6 right-6">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-14 h-14 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full shadow-lg shadow-teal-500/25 flex items-center justify-center hover:scale-110 transition-transform"
              >
                <Plus className="w-7 h-7 text-white" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {/* Drop zone overlay */}
            {isDragOver && (
              <div
                className="fixed inset-0 z-50 bg-slate-900/90 flex items-center justify-center"
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
              >
                <div className="text-center">
                  <FileUp className="w-16 h-16 text-teal-400 mx-auto mb-4" />
                  <p className="text-xl font-semibold text-white">Drop files to share</p>
                </div>
              </div>
            )}

            {/* Room Settings Modal */}
            <RoomSettings
              isOpen={showSettings}
              onClose={() => setShowSettings(false)}
            />
          </>
        )}
        </div>

      {/* Global drag listener */}
      <div
        className="fixed inset-0 z-40 pointer-events-none"
        onDragOver={(e) => {
          e.preventDefault();
          if (view === 'room') setIsDragOver(true);
        }}
      />
      </main>
  );
}
