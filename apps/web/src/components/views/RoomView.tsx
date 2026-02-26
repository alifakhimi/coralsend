'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore, type FileMetadata } from '@/store/store';
import { useToastStore } from '@/store/toast';
import { getRoomShareUrl, getRoomSharePayload } from '@/lib/constants';
import { useShareLink } from '@/hooks/useShareLink';
import { cn } from '@/lib/utils';
import {
  Button,
  Logo,
  MemberAvatarStack,
  FileList,
  BottomSheet,
  PanelCard,
  Switch,
  ActionButton,
  ChatMessages,
  ChatInput,
  RoomSettings,
  ShareRoomSheet,
} from '@/components/ui';
import {
  FileUp,
  Share2,
  Users,
  Inbox,
  Send,
  Settings,
  ClipboardPaste,
  MessageSquare,
  ChevronUp,
  X,
  Trash2,
  CheckSquare,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';

interface RoomViewProps {
  onLeaveRoom: () => void;
  onShareFile: (file: File) => void;
  onRequestFile: (file: FileMetadata) => void;
  onCancelDownload?: (fileId: string) => void;
  onSendChat: (message: string) => void;
  onRetryConnection?: (deviceId: string) => void;
  onCopyTextFile?: (file: FileMetadata) => Promise<boolean>;
  onRequestFileMetaSync?: () => void;
}

export function RoomView({
  onLeaveRoom,
  onShareFile,
  onRequestFile,
  onCancelDownload,
  onSendChat,
  onRetryConnection,
  onCopyTextFile,
  onRequestFileMetaSync,
}: RoomViewProps) {
  const currentRoom = useStore((s) => s.currentRoom);
  const showToast = useToastStore((s) => s.showToast);
  const removeFile = useStore((s) => s.removeFile);
  const removeFiles = useStore((s) => s.removeFiles);
  const clearFilesByDirection = useStore((s) => s.clearFilesByDirection);
  const restoreFiles = useStore((s) => s.restoreFiles);
  const emptyTrashByDirection = useStore((s) => s.emptyTrashByDirection);
  const purgeFiles = useStore((s) => s.purgeFiles);
  const [showChat, setShowChat] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'inbox' | 'outbox'>('inbox');
  const [showTrash, setShowTrash] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDragOver, setIsDragOver] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [isPasting, setIsPasting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shareUrl = currentRoom ? getRoomShareUrl(currentRoom.id) : '';
  const sharePayload = currentRoom ? getRoomSharePayload(currentRoom.id, shareUrl) : null;
  const { copyLink, shareLink, copiedKey } = useShareLink({
    payload: sharePayload ?? { title: '', text: '', url: shareUrl },
    onCopied: () => showToast('Link copied'),
  });

  // Paste from clipboard (keyboard or button): share all files without filtering
  const processPastedFiles = useCallback(
    (files: File[]) => {
      files.forEach((file) => onShareFile(file));
    },
    [onShareFile]
  );

  // Paste event (Ctrl+V / Cmd+V) – only when Outbox tab is active
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (activeTab !== 'outbox') return;
      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      const files: File[] = [];
      if (clipboardData.files?.length) {
        files.push(...Array.from(clipboardData.files));
      }
      if (files.length === 0) {
        const text = clipboardData.getData('text/plain');
        if (text?.trim()) {
          files.push(new File([text], 'pasted-text.txt', { type: 'text/plain' }));
        }
      }
      if (files.length === 0) return;
      e.preventDefault();
      processPastedFiles(files);
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [activeTab, processPastedFiles]);

  useEffect(() => {
    // Keep selection/navigation predictable when switching tabs
    setShowTrash(false);
    setEditMode(false);
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Paste button: Async Clipboard API (for mobile / programmatic paste)
  const handlePasteClick = useCallback(async () => {
    if (typeof navigator?.clipboard?.read !== 'function') {
      setPasteError('Paste from clipboard is not supported in this browser');
      setTimeout(() => setPasteError(null), 3000);
      return;
    }
    setIsPasting(true);
    setPasteError(null);
    try {
      const items = await navigator.clipboard.read();
      const files: File[] = [];
      for (const item of items) {
        // Try every non-text MIME type as a file (images, videos, PDFs, etc.)
        let handledAsBlob = false;
        for (const mimeType of item.types) {
          if (mimeType === 'text/plain') continue;
          try {
            const blob = await item.getType(mimeType);
            const ext = mimeType.split('/')[1]?.split(';')[0] || 'bin';
            const name = `pasted-file.${ext}`;
            files.push(new File([blob], name, { type: mimeType }));
            handledAsBlob = true;
            break;
          } catch { /* type not available */ }
        }
        // Fallback to text if no blob type was handled
        if (!handledAsBlob && item.types?.includes('text/plain')) {
          try {
            const blob = await item.getType('text/plain');
            const text = await blob.text();
            if (text?.trim()) {
              files.push(new File([text], 'pasted-text.txt', { type: 'text/plain' }));
            }
          } catch { /* ignore */ }
        }
      }
      if (files.length > 0) {
        processPastedFiles(files);
      } else {
        setPasteError('Nothing to paste from clipboard');
        setTimeout(() => setPasteError(null), 3000);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to read clipboard';
      setPasteError(message);
      setTimeout(() => setPasteError(null), 3000);
    } finally {
      setIsPasting(false);
    }
  }, [processPastedFiles]);

  const canUsePasteButton = typeof navigator !== 'undefined' && typeof navigator.clipboard?.read === 'function';

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

  const roomFiles = currentRoom?.files ?? [];
  const roomMessages = currentRoom?.messages ?? [];
  const inboxCount = roomFiles.filter((f) => f.direction === 'inbox').length;
  const outboxCount = roomFiles.filter((f) => f.direction === 'outbox').length;
  const panelCount = activeTab === 'inbox' ? inboxCount : outboxCount;
  const lastMessage = roomMessages[roomMessages.length - 1];
  const unreadCount = showChat ? 0 : roomMessages.filter((m) => !m.isMe).length;

  if (!currentRoom) return null;
  const roomName = currentRoom.name?.trim();

  const activeFiles = roomFiles.filter((f) => {
    if (f.direction !== activeTab) return false;
    if (activeTab === 'inbox') return showTrash ? !!f.trashed : !f.trashed;
    return !f.trashed;
  });

  const clearSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (fileId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  const handleDeleteSingle = (fileId: string) => {
    if (activeTab === 'inbox' && showTrash) purgeFiles([fileId]);
    else removeFile(fileId);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    if (activeTab === 'inbox' && showTrash) purgeFiles(Array.from(selectedIds));
    else if (activeTab === 'inbox') removeFiles(Array.from(selectedIds));
    else purgeFiles(Array.from(selectedIds));
    clearSelection();
  };

  const handleRestoreSelected = () => {
    if (selectedIds.size === 0) return;
    restoreFiles(Array.from(selectedIds));
    clearSelection();
  };

  const handleDeleteAll = () => {
    if (activeTab === 'inbox' && showTrash) emptyTrashByDirection('inbox');
    else clearFilesByDirection(activeTab);
    clearSelection();
  };

  return (
    <div className="safe-area flex flex-col h-full animate-in fade-in slide-in-from-right duration-300">
      {/* Header */}
      <header className="shrink-0 px-4 pb-2">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              size="icon"
              onClick={onLeaveRoom}
              title="Back to home"
              className="h-12 w-12 p-1.5"
            >
              <Logo size="sm" showText={false} />
            </Button>
            <div>
              <h1 className="font-semibold text-(--text-primary) text-sm">Room {currentRoom.id}</h1>
              <div className="flex items-center gap-1.5 text-xs text-(--text-muted)">
                <Users className="w-3 h-3" />
                <span>{currentRoom.members.length} members</span>
              </div>
            </div>
          </div>

          <div className="flex items-stretch gap-2">
            <Button
              variant="secondary"
              size="sm"
              aria-label="Share room"
              title="Share room"
              onClick={() => setShowShare(true)}
            >
              <MemberAvatarStack size="md" />
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              aria-label="Show settings"
              title="Settings"
              onClick={() => setShowSettings(true)}
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 min-h-0 flex flex-col max-w-2xl mx-auto w-full">
        <div className="shrink-0 px-3 pt-2">
          <div className="flex gap-1 glass rounded-lg p-1 border border-[var(--border-soft)]">
            <button
              onClick={() => setActiveTab('inbox')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors',
                activeTab === 'inbox'
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              )}
            >
              <Inbox className="w-4 h-4" />
              Inbox
              {inboxCount > 0 && (
                <span
                  className={cn(
                    'text-xs px-1.5 py-0.5 rounded-full transition-colors',
                    activeTab === 'inbox'
                      ? 'bg-white/20 text-white'
                      : 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
                  )}
                >
                  {inboxCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('outbox')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors',
                activeTab === 'outbox'
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              )}
            >
              <Send className="w-4 h-4" />
              Outbox
              {outboxCount > 0 && (
                <span
                  className={cn(
                    'text-xs px-1.5 py-0.5 rounded-full transition-colors',
                    activeTab === 'outbox'
                      ? 'bg-white/20 text-white'
                      : 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
                  )}
                >
                  {outboxCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 px-3 py-2">
          <PanelCard
            className="h-full"
            icon={
              activeTab === 'inbox'
                ? <Inbox className="w-5 h-5 text-[var(--color-accent)]" />
                : <Send className="w-5 h-5 text-[var(--color-accent)]" />
            }
            title={activeTab === 'inbox' ? 'Inbox' : 'Outbox'}
            badge={
              <span className="text-sm text-[var(--text-muted)]">
                ({panelCount})
              </span>
            }
            actions={
              <div className="flex flex-col items-end gap-1.5">
                {/* Main actions row */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 justify-end">
                  {activeTab === 'inbox' && (
                    <ActionButton
                      icon={<Trash2 className="w-3.5 h-3.5" />}
                      label={showTrash ? 'Show Inbox' : 'Trash'}
                      onClick={() => {
                        setShowTrash((v) => !v);
                        setEditMode(false);
                        clearSelection();
                      }}
                      variant="default"
                    />
                  )}

                  {activeTab === 'inbox' && !showTrash && onRequestFileMetaSync && (
                    <ActionButton
                      icon={<RefreshCw className="w-3.5 h-3.5" />}
                      label="Resync"
                      onClick={onRequestFileMetaSync}
                      variant="teal"
                      title="Request metadata sync from peers"
                    />
                  )}

                  {activeTab === 'outbox' && (
                    <ActionButton
                      icon={<FileUp className="w-3.5 h-3.5" />}
                      label="Share File"
                      onClick={() => fileInputRef.current?.click()}
                      variant="primary"
                    />
                  )}

                  {activeTab === 'outbox' && canUsePasteButton && (
                    <ActionButton
                      icon={<ClipboardPaste className="w-3.5 h-3.5" />}
                      label={isPasting ? 'Pasting…' : 'Paste'}
                      onClick={handlePasteClick}
                      disabled={isPasting}
                      variant="teal"
                    />
                  )}

                  {/* Edit switch only when there are visible files */}
                  {activeFiles.length > 0 && (
                    <div className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-soft)] px-2 py-1">
                      <span className="hidden sm:inline text-xs text-[var(--text-muted)]">Edit</span>
                      <Switch checked={editMode} onChange={setEditMode} />
                    </div>
                  )}
                </div>

                {/* Edit actions row */}
                {editMode && activeFiles.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 justify-end">
                    {!selectionMode ? (
                      <ActionButton
                        icon={<CheckSquare className="w-3.5 h-3.5" />}
                        label="Select files"
                        onClick={() => setSelectionMode(true)}
                        variant="default"
                      />
                    ) : (
                      <>
                        {activeTab === 'inbox' && showTrash && (
                          <ActionButton
                            icon={<RotateCcw className="w-3.5 h-3.5" />}
                            label="Restore"
                            onClick={handleRestoreSelected}
                            disabled={selectedIds.size === 0}
                            variant="teal"
                          />
                        )}
                        <ActionButton
                          icon={<Trash2 className="w-3.5 h-3.5" />}
                          label="Delete selected"
                          onClick={handleDeleteSelected}
                          disabled={selectedIds.size === 0}
                          variant="danger"
                        />
                        <ActionButton
                          icon={<X className="w-3.5 h-3.5" />}
                          label="Cancel"
                          onClick={clearSelection}
                          variant="default"
                        />
                      </>
                    )}

                    <ActionButton
                      icon={<Trash2 className="w-3.5 h-3.5" />}
                      label={
                        activeTab === 'inbox' && !showTrash
                          ? 'Move all to trash'
                          : activeTab === 'inbox'
                            ? 'Empty trash'
                            : 'Delete all'
                      }
                      onClick={handleDeleteAll}
                      variant="danger"
                    />
                  </div>
                )}
              </div>
            }
          >
            {pasteError && <p className="text-xs text-[var(--color-error)] mb-2">{pasteError}</p>}
            <FileList
              direction={activeTab}
              onDownload={onRequestFile}
              onCancelDownload={onCancelDownload}
              onCopyTextFile={onCopyTextFile}
              onAddFile={activeTab === 'outbox' ? () => fileInputRef.current?.click() : undefined}
              onPaste={activeTab === 'outbox' && canUsePasteButton ? handlePasteClick : undefined}
              showTrash={showTrash}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onDeleteSingle={handleDeleteSingle}
              hideHeader
              hideFilters
            />
          </PanelCard>
        </div>
      </div>

      {/* Chat ticker row */}
      <div className="shrink-0 max-w-2xl mx-auto w-full px-3 pb-2">
        <button
          onClick={() => setShowChat(true)}
          className="w-full flex items-center gap-3 px-4 py-2.5 glass border border-[var(--border-soft)] rounded-xl hover:bg-[var(--surface-glass-strong)] transition-colors shadow-sm"
        >
          <MessageSquare className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
          <span className="flex-1 text-left text-sm truncate text-[var(--text-primary)]">
            {lastMessage ? lastMessage.text : 'No messages yet'}
          </span>
          {unreadCount > 0 && (
            <span className="bg-[var(--color-accent)] text-white text-xs px-1.5 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
          <ChevronUp className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
        </button>
      </div>

      {/* Chat sheet */}
      <BottomSheet
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        title="Chat"
        icon={<MessageSquare className="w-4 h-4 text-[var(--color-accent)]" />}
        footer={<ChatInput onSend={onSendChat} />}
      >
        <ChatMessages messages={roomMessages} />
      </BottomSheet>

      {/* Share sheet */}
      <BottomSheet
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        title="Share room"
        icon={<Share2 className="w-4 h-4 text-[var(--color-accent)]" />}
      >
        {currentRoom && (
          <ShareRoomSheet
            roomCode={currentRoom.id}
            roomName={currentRoom.name?.trim() || undefined}
            shareUrl={shareUrl}
            copiedKey={copiedKey}
            onCopyLink={copyLink}
            onShareLink={shareLink}
            memberCount={currentRoom.members.length}
            onRetryConnection={onRetryConnection}
          />
        )}
      </BottomSheet>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Drop zone overlay */}
      {isDragOver && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center"
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          <div className="text-center p-10 rounded-3xl border-2 border-dashed border-[var(--color-accent-border)] bg-[var(--color-accent-subtle)]">
            <FileUp className="w-16 h-16 text-[var(--color-accent)] mx-auto mb-4 animate-bounce" />
            <p className="text-xl font-semibold text-[var(--text-primary)]">Drop files to share</p>
            <p className="text-sm text-[var(--text-muted)] mt-1">Any file type, any size</p>
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
