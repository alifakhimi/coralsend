'use client';

import { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useStore } from '@/store/store';
import { getBaseUrl } from '@/lib/constants';
import {
  Button,
  Card,
  MemberList,
  MemberAvatarStack,
  FileList,
  Chat,
  RoomSettings,
} from '@/components/ui';
import {
  Plus,
  Copy,
  Check,
  X,
  ArrowLeft,
  FileUp,
  Share2,
  Users,
  Inbox,
  Send,
  Settings,
} from 'lucide-react';

interface RoomViewProps {
  onLeaveRoom: () => void;
  onShareFile: (file: File) => void;
  onRequestFile: (file: any) => void;
  onSendChat: (message: string) => void;
}

export function RoomView({ onLeaveRoom, onShareFile, onRequestFile, onSendChat }: RoomViewProps) {
  const currentRoom = useStore((s) => s.currentRoom);
  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'inbox' | 'outbox'>('inbox');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!currentRoom) return null;

  const shareUrl = `${getBaseUrl()}?room=${currentRoom.id}`;

  // Copy share link
  const copyLink = async () => {
    try {
      const link = `${getBaseUrl()}?room=${currentRoom.id}`;
      await navigator.clipboard.writeText(link);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file) => onShareFile(file));
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle file drag and drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      Array.from(files).forEach((file) => onShareFile(file));
    }
  };

  return (
    <div className="h-screen flex flex-col animate-in fade-in slide-in-from-right duration-300">
      {/* Header */}
      <header className="p-4 border-b border-slate-800">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onLeaveRoom}>
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
            <Card variant="glow" className="animate-in fade-in duration-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">Share Room</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowShare(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <div className="bg-white p-3 rounded-xl">
                  <QRCodeSVG value={shareUrl} size={150} level="H" />
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
            <FileList direction={activeTab} onDownload={onRequestFile} />
          </Card>

          {/* Chat */}
          <Chat messages={currentRoom.messages} onSend={onSendChat} />
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
      <RoomSettings isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* Global drag listener */}
      <div
        className="fixed inset-0 z-40 pointer-events-none"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
      />
    </div>
  );
}
