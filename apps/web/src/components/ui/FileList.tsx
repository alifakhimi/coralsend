'use client';

import { useState, useMemo } from 'react';
import { cn, formatFileSize, formatSpeed, formatEta, getFileIcon } from '@/lib/utils';
import { useStore, type FileMetadata, type ConnectionPath } from '@/store/store';
import { getInitials, getAvatarColor } from '@/lib/deviceId';
import { Button } from './Button';
import {
  Download,
  Copy,
  CheckCircle,
  AlertCircle,
  Inbox,
  Send,
  Filter,
  Clock,
  User,
  FileType,
  ChevronDown,
  X,
  Image,
  FileVideo,
  FileAudio,
  FileText,
  Archive,
  File,
  Wifi,
  Globe,
  FileUp,
  ClipboardPaste,
  Shield,
  Zap,
  Trash2,
  CheckSquare,
  Square,
  Share,
  Share2,
} from 'lucide-react';

// ============ File Type Categories ============

const fileTypeCategories = [
  { id: 'all', label: 'All Types', icon: File },
  { id: 'image', label: 'Images', icon: Image, match: (t: string) => t.startsWith('image/') },
  { id: 'video', label: 'Videos', icon: FileVideo, match: (t: string) => t.startsWith('video/') },
  { id: 'audio', label: 'Audio', icon: FileAudio, match: (t: string) => t.startsWith('audio/') },
  {
    id: 'document', label: 'Documents', icon: FileText, match: (t: string) =>
      t.includes('pdf') || t.includes('document') || t.includes('text') || t.includes('spreadsheet') || t.includes('presentation')
  },
  {
    id: 'archive', label: 'Archives', icon: Archive, match: (t: string) =>
      t.includes('zip') || t.includes('rar') || t.includes('tar') || t.includes('gzip')
  },
];

// ============ File Item Component ============

const EMPTY_DOWNLOADERS: Array<{ deviceId: string; displayName: string }> = [];
const EMPTY_PROGRESS: Record<string, number> = {};

interface FileItemProps {
  file: FileMetadata;
  onDownload?: (file: FileMetadata) => void;
  onCancelDownload?: (fileId: string) => void;
  onCopyTextFile?: (file: FileMetadata) => Promise<boolean>;
  onDelete?: (fileId: string) => void;
  selecting?: boolean;
  selected?: boolean;
  onToggleSelect?: (fileId: string) => void;
}

function ConnectionPathIcon({ path }: { path?: ConnectionPath }) {
  if (!path || path === 'unknown') return null;
  if (path === 'direct') {
    return <Wifi className="w-3 h-3 text-[var(--color-accent)] flex-shrink-0" aria-label="Direct peer-to-peer" role="img" />;
  }
  return <Globe className="w-3 h-3 text-[var(--color-warning)] flex-shrink-0" aria-label="Via TURN relay" role="img" />;
}

function FileItem({
  file,
  onDownload,
  onCancelDownload,
  onCopyTextFile,
  onDelete,
  selecting = false,
  selected = false,
  onToggleSelect,
}: FileItemProps) {
  const fileDownloaders = useStore((s) => s.fileDownloaders[file.id] ?? EMPTY_DOWNLOADERS);
  const downloaderProgress = useStore((s) => s.fileDownloaderProgress[file.id] ?? EMPTY_PROGRESS);
  const uploaderConnectionPath = useStore((s) =>
    s.currentRoom?.members.find(m => m.deviceId === file.uploaderId)?.connectionPath
  );
  const isDownloading = file.status === 'downloading';
  const isCompleted = file.status === 'completed';
  const isError = file.status === 'error';
  const isInbox = file.direction === 'inbox';
  const isOutbox = file.direction === 'outbox';
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  const isTextFile = file.type.startsWith('text/');
  const [copySuccess, setCopySuccess] = useState(false);
  const progressValue = Math.max(0, Math.min(file.progress ?? 0, 100));

  // Get thumbnail URL if available (for completed files)
  const thumbnailUrl = file.thumbnailUrl;

  return (
    <div
      onClick={selecting ? () => onToggleSelect?.(file.id) : undefined}
      className={cn(
        'relative overflow-hidden glass rounded-xl border transition-all',
        'p-3 min-[480px]:p-4',
        selecting && 'cursor-pointer active:scale-[0.99]',
        selecting && selected && 'ring-1 ring-[var(--color-accent)] border-[var(--color-accent-border)]',
        isCompleted && 'border-[var(--color-accent-border)]',
        isDownloading && 'border-[var(--color-accent-border)]',
        isError && 'border-[var(--color-error-border)]',
        !isCompleted && !isDownloading && !isError && 'border-[var(--border-soft)]'
      )}
    >
      {/* Main row: thumbnail | info | action */}
      <div className="flex items-stretch gap-3 min-[480px]:gap-4">
        {/* Thumbnail / icon - touch-friendly size */}
        <div
          className={cn(
            'flex-shrink-0 rounded-xl flex items-center justify-center overflow-hidden',
            thumbnailUrl ? 'w-14 h-14 min-[480px]:w-16 min-[480px]:h-16 bg-[var(--bg-elevated)]' : 'w-12 h-12 min-[480px]:w-14 min-[480px]:h-14 bg-[var(--surface-glass-strong)]'
          )}
        >
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl min-[480px]:text-2xl">{getFileIcon(file.type)}</span>
          )}
        </div>

        {/* Info block - flex-1 min-w-0 for truncation */}
        <div className={cn('flex-1 min-w-0 flex flex-col justify-center', isInbox && !selecting && 'pr-2 min-[480px]:pr-0')}>
          <div className="flex items-center gap-2 min-w-0">
            {selecting && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect?.(file.id);
                }}
                className="flex-shrink-0 p-1.5 -m-1.5 rounded-lg transition-colors touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label={selected ? 'Deselect file' : 'Select file'}
              >
                {selected ? <CheckSquare className="w-5 h-5 text-[var(--color-accent)]" /> : <Square className="w-5 h-5 text-[var(--text-muted)]" />}
              </button>
            )}
            <h4 className="font-medium text-[var(--text-primary)] truncate text-sm min-[480px]:text-base flex-1">{file.name}</h4>
            {isError && <AlertCircle className="w-4 h-4 text-[var(--color-error)] flex-shrink-0" aria-hidden />}
          </div>

          {/* Meta row: size, uploader, time */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs text-[var(--text-muted)]">
            <span className="">{formatFileSize(file.size)}</span>
            {isInbox && (
              <>
                {/* <span aria-hidden>·</span> */}
                <span className="truncate max-w-[100px] min-[480px]:max-w-[140px] inline-flex items-center gap-1">
                  {file.uploaderName}
                  <ConnectionPathIcon path={uploaderConnectionPath} />
                </span>
              </>
            )}
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" aria-hidden />
              {new Date(file.uploadedAt).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Outbox: who is downloading */}
          {isOutbox && fileDownloaders.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">Sending to:</span>
              <div className="flex flex-wrap gap-1.5">
                {fileDownloaders.map((d) => {
                  const progress = downloaderProgress[d.deviceId] ?? 0;
                  return (
                    <div
                      key={d.deviceId}
                      className="flex items-center gap-1 rounded-lg bg-[var(--surface-glass)] px-2 py-1"
                      title={`${d.displayName} ${progress}%`}
                    >
                      <div
                        className="flex h-6 w-8 items-center justify-center rounded text-[10px] font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: getAvatarColor(d.deviceId) }}
                      >
                        {getInitials(d.deviceId)}
                      </div>
                      <span className="text-xs font-medium text-[var(--color-accent)]">{progress}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Error message */}
          {isError && (
            <p className="mt-1 text-xs text-[var(--color-error)]">Download failed. Try again.</p>
          )}

          {/* Copy button for text files */}
          {isInbox && !selecting && !isDownloading && isTextFile && onCopyTextFile && (
            <div className="mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={async (e) => {
                  e.stopPropagation();
                  const ok = await onCopyTextFile(file);
                  if (ok) {
                    setCopySuccess(true);
                    setTimeout(() => setCopySuccess(false), 2000);
                  }
                }}
                className="text-xs min-h-[36px] touch-manipulation"
                aria-label="Copy text"
              >
                {copySuccess ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copySuccess ? 'Copied!' : 'Copy'}</span>
              </Button>
            </div>
          )}
        </div>

        {/* Download / Save action - touch-friendly */}
        {isInbox && !selecting && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (isCompleted) return;
              if (isDownloading && onCancelDownload) {
                onCancelDownload(file.id);
                return;
              }
              onDownload?.(file);
            }}
            disabled={isCompleted || (isDownloading && !onCancelDownload)}
            className={cn(
              'flex-shrink-0 flex flex-col items-center justify-center gap-1',
              'min-w-[56px] min-h-[56px] min-[480px]:min-w-[64px] min-[480px]:min-h-[64px]',
              'rounded-xl border transition-colors touch-manipulation',
              'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-inset',
              isCompleted
                ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)] border-[var(--color-accent-border)]'
                : isError
                  ? 'bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-error-border)]'
                  : isDownloading && onCancelDownload
                    ? 'bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-error-border)]'
                    : 'bg-[var(--color-accent)] text-white border-[var(--color-accent-border)] active:opacity-90'
            )}
            aria-label={isCompleted ? 'Downloaded' : isError ? 'Retry download' : isDownloading && onCancelDownload ? 'Cancel download' : 'Save file'}
          >
            {isCompleted ? <CheckCircle className="w-5 h-5" /> : isDownloading && onCancelDownload ? <X className="w-5 h-5" /> : <Download className="w-5 h-5" />}
            <span className="text-[10px] min-[480px]:text-xs font-medium leading-none">
              {isCompleted ? 'Done' : isError ? 'Retry' : isDownloading && onCancelDownload ? 'Cancel' : 'Save'}
            </span>
          </button>
        )}
      </div>

      {/* Download progress bar - full width, below main row */}
      {isInbox && (true || isDownloading) && (
        <div className="mt-3 -mx-3 min-[480px]:-mx-4 px-3 min-[480px]:px-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-glass-strong)]">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-500 ease-out relative overflow-hidden"
              style={{ width: `${progressValue}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer [background-size:200%_100%]" />
            </div>
          </div>
          <div className="mt-1.5 flex items-center justify-between font-mono text-xs text-[var(--text-muted)]">
            <span className="flex items-center gap-2">
              Downloading
              {file.speed != null && file.speed > 0 && (
                <span className="text-[var(--color-accent)] text-end font-medium w-20">{formatSpeed(file.speed)}</span>
              )}
              {file.eta != null && file.eta > 0 && <span>{formatEta(file.eta)}</span>}
            </span>
            <span className="font-semibold text-[var(--color-accent)]">{progressValue}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Filter Dropdown Component ============

interface FilterDropdownProps {
  label: string;
  value: string;
  options: { id: string; label: string; icon?: React.ComponentType<{ className?: string }> }[];
  onChange: (value: string) => void;
}

function FilterDropdown({ label, value, options, onChange }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value) || options[0];

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-2 min-h-[36px] glass border border-[var(--border-soft)] rounded-xl text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-glass-strong)] active:bg-[var(--surface-glass)] transition-colors touch-manipulation"
      >
        {selected.icon && <selected.icon className="w-3.5 h-3.5" />}
        <span>{selected.label}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute top-full mt-1.5 left-0 z-20 min-w-[140px] max-w-[200px] glass-strong border border-[var(--border-soft)] rounded-xl shadow-xl overflow-hidden">
            {options.map((option) => (
              <button
                key={option.id}
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2.5 min-h-[44px] text-xs text-left transition-colors touch-manipulation',
                  option.id === value
                    ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)] font-medium'
                    : 'text-[var(--text-primary)] hover:bg-[var(--surface-glass)] active:bg-[var(--surface-glass-strong)]'
                )}
              >
                {option.icon && <option.icon className="w-3.5 h-3.5 flex-shrink-0" />}
                <span className="truncate">{option.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ============ Main File List Component ============

interface FileListProps {
  direction: 'inbox' | 'outbox';
  onDownload?: (file: FileMetadata) => void;
  onCancelDownload?: (fileId: string) => void;
  onCopyTextFile?: (file: FileMetadata) => Promise<boolean>;
  onAddFile?: () => void;
  onPaste?: () => void;
  showTrash?: boolean;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (fileId: string) => void;
  onDeleteSingle?: (fileId: string) => void;
  className?: string;
  hideHeader?: boolean;
  /** When true, filters row (Pending/Done, Type, Sort) is hidden; code kept for later */
  hideFilters?: boolean;
}

export function FileList({
  direction,
  onDownload,
  onCancelDownload,
  onCopyTextFile,
  onAddFile,
  onPaste,
  showTrash = false,
  selectionMode = false,
  selectedIds = new Set<string>(),
  onToggleSelect,
  onDeleteSingle,
  className,
  hideHeader,
  hideFilters,
}: FileListProps) {
  const allFiles = useStore((s) => s.currentRoom?.files);

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'size'>('newest');

  // Filter files by direction and trash mode
  const files = useMemo(() => {
    const byDirection = allFiles?.filter((f) => f.direction === direction) || [];
    if (direction === 'inbox') {
      return byDirection.filter((f) => (showTrash ? !!f.trashed : !f.trashed));
    }
    return byDirection.filter((f) => !f.trashed);
  }, [allFiles, direction, showTrash]);

  // Get unique uploaders
  const uploaders = useMemo(() => {
    const unique = new Map<string, string>();
    files.forEach((f) => unique.set(f.uploaderId, f.uploaderName));
    return Array.from(unique.entries()).map(([id, name]) => ({ id, label: name, icon: User }));
  }, [files]);

  // Filter and sort files
  const filteredFiles = useMemo(() => {
    let result = [...files];

    // Status filter
    if (statusFilter === 'pending') {
      result = result.filter((f) => f.status === 'available' || f.status === 'downloading');
    } else if (statusFilter === 'completed') {
      result = result.filter((f) => f.status === 'completed');
    }

    // Type filter
    if (typeFilter !== 'all') {
      const category = fileTypeCategories.find((c) => c.id === typeFilter);
      if (category?.match) {
        result = result.filter((f) => category.match(f.type));
      }
    }

    // User filter
    if (userFilter !== 'all') {
      result = result.filter((f) => f.uploaderId === userFilter);
    }

    // Sort
    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => b.uploadedAt - a.uploadedAt);
        break;
      case 'oldest':
        result.sort((a, b) => a.uploadedAt - b.uploadedAt);
        break;
      case 'size':
        result.sort((a, b) => b.size - a.size);
        break;
    }

    return result;
  }, [files, statusFilter, typeFilter, userFilter, sortBy]);

  const hasFilters = statusFilter !== 'all' || typeFilter !== 'all' || userFilter !== 'all';

  const clearFilters = () => {
    setStatusFilter('all');
    setTypeFilter('all');
    setUserFilter('all');
  };

  const isInbox = direction === 'inbox';
  const Icon = isInbox ? Inbox : Send;
  const title = isInbox ? 'Inbox' : 'Outbox';
  const deleteOne = (fileId: string) => {
    onDeleteSingle?.(fileId);
  };

  const emptyMessage = isInbox
    ? 'No files shared with you yet'
    : 'Share files by clicking the + button';

  return (
    <div className={cn('space-y-3 min-[480px]:space-y-4', className)}>
      {/* Header */}
      {!hideHeader && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className={cn('w-5 h-5 flex-shrink-0', 'text-[var(--color-accent)]')} aria-hidden />
            <h3 className="font-semibold text-[var(--text-primary)] truncate">{title}</h3>
            <span className="text-xs min-[480px]:text-sm text-[var(--text-muted)] flex-shrink-0">
              {filteredFiles.length}{files.length !== filteredFiles.length && `/${files.length}`}
            </span>
          </div>
        </div>
      )}

      {/* Filters (hidden when hideFilters=true, e.g. Outbox) */}
      {!hideFilters && files.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Status filter - compact pills */}
          <div className="flex items-center gap-0.5 glass rounded-xl p-1 flex-shrink-0">
            {(['all', 'pending', 'completed'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  'px-3 py-2 min-h-[36px] text-xs font-medium rounded-lg transition-colors touch-manipulation',
                  statusFilter === status
                    ? 'bg-[var(--bg-surface)] text-white shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] active:bg-[var(--surface-glass)]'
                )}
              >
                {status === 'all' ? 'All' : status === 'pending' ? 'Pending' : 'Done'}
              </button>
            ))}
          </div>

          {/* Type, User, Sort dropdowns - scroll horizontally on narrow screens */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <FilterDropdown
              label="Type"
              value={typeFilter}
              options={fileTypeCategories.map((c) => ({ id: c.id, label: c.label, icon: c.icon }))}
              onChange={setTypeFilter}
            />
            {uploaders.length > 1 && (
              <FilterDropdown
                label="From"
                value={userFilter}
                options={[{ id: 'all', label: 'All Users', icon: User }, ...uploaders]}
                onChange={setUserFilter}
              />
            )}
            <FilterDropdown
              label="Sort"
              value={sortBy}
              options={[
                { id: 'newest', label: 'Newest', icon: Clock },
                { id: 'oldest', label: 'Oldest', icon: Clock },
                { id: 'size', label: 'Size', icon: FileType },
              ]}
              onChange={(v) => setSortBy(v as typeof sortBy)}
            />
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2 min-h-[36px] text-xs text-[var(--text-muted)] hover:text-[var(--color-accent)] active:bg-[var(--surface-glass)] rounded-lg transition-colors flex-shrink-0 touch-manipulation"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>
      )}

      {/* File list */}
      {filteredFiles.length > 0 ? (
        <div className="space-y-2 min-[480px]:space-y-3">
          {filteredFiles.map((file) => (
            <FileItem
              key={file.id}
              file={file}
              onDownload={onDownload}
              onCancelDownload={onCancelDownload}
              onCopyTextFile={onCopyTextFile}
              onDelete={deleteOne}
              selecting={selectionMode}
              selected={selectedIds.has(file.id)}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 min-[480px]:py-12 text-[var(--text-muted)] px-4">
          {hasFilters ? (
            <>
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--surface-glass-strong)] border border-[var(--border-soft)]">
                <Icon className="w-7 h-7 opacity-40" aria-hidden />
              </div>
              <p className="font-medium text-[var(--text-secondary)] text-center">No files match filters</p>
              <button
                onClick={clearFilters}
                className="mt-4 px-4 py-2.5 min-h-[44px] text-sm font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] rounded-xl transition-colors touch-manipulation"
              >
                Clear filters
              </button>
            </>
          ) : isInbox ? (
            <>
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent-border)]">
                <Inbox className="w-7 h-7 text-[var(--color-accent)] opacity-70" aria-hidden />
              </div>
              {showTrash ? (
                <>
                  <p className="font-medium text-[var(--text-secondary)] text-center">Trash is empty</p>
                  <p className="text-xs mt-2 max-w-[280px] text-center leading-relaxed opacity-70">
                    Hidden inbox files appear here and can be restored
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-[var(--text-secondary)] text-center">Waiting for files</p>
                  <p className="text-xs mt-2 max-w-[280px] text-center leading-relaxed opacity-70">
                    When someone shares a file, it downloads directly from their device to yours
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-4 mt-5 text-xs uppercase tracking-wider opacity-50">
                    <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Encrypted</span>
                    <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Peer-to-peer</span>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent-border)]">
                <Send className="w-7 h-7 text-[var(--color-accent)] opacity-70" aria-hidden />
              </div>
              <p className="font-medium text-[var(--text-secondary)] text-center">Share your first file</p>
              <p className="text-xs mt-2 max-w-[280px] text-center leading-relaxed opacity-70">
                Files go directly to other devices — nothing is uploaded to a server
              </p>

              {/* Action buttons - touch-friendly */}
              <div className="flex flex-col sm:flex-row items-center gap-3 mt-6 w-full max-w-[260px]">
                {onAddFile && (
                  <button
                    onClick={onAddFile}
                    className="w-full min-h-[48px] flex items-center justify-center gap-2 text-sm font-medium text-white bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] active:opacity-90 transition-all px-6 py-3 rounded-xl touch-manipulation"
                  >
                    <FileUp className="w-4.5 h-4.5" />
                    Share File
                  </button>
                )}
                {onPaste && (
                  <button
                    onClick={onPaste}
                    className="w-full min-h-[48px] flex items-center justify-center gap-2 text-sm font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors px-5 py-3 rounded-xl border border-[var(--color-accent-border)] hover:bg-[var(--color-accent-subtle)] active:bg-[var(--color-accent-subtle)] touch-manipulation"
                  >
                    <ClipboardPaste className="w-4 h-4" />
                    Paste
                  </button>
                )}
              </div>

              <p className="text-xs mt-4 opacity-40 text-center">
                or drag & drop files anywhere
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
