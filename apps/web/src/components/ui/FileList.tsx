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
    return <Wifi className="w-3 h-3 text-[var(--color-accent)] flex-shrink-0" aria-label="Direct (LAN)" role="img" />;
  }
  return <Globe className="w-3 h-3 text-[var(--color-warning)] flex-shrink-0" aria-label="Via internet (relay)" role="img" />;
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
        'relative overflow-hidden glass rounded-xl p-3 sm:p-4 border transition-all',
        selecting && 'cursor-pointer',
        selecting && selected && 'ring-1 ring-[var(--color-accent)] border-[var(--color-accent-border)]',
        isCompleted && 'border-[var(--color-accent-border)]',
        isDownloading && 'border-[var(--color-accent-border)]',
        isError && 'border-[var(--color-error-border)]',
        !isCompleted && !isDownloading && !isError && 'border-[var(--border-soft)]'
      )}
    >
      <div className="flex items-start gap-2 sm:gap-3">
        {/* File icon or thumbnail */}
        <div className={cn(
          'flex-shrink-0 rounded-lg flex items-center justify-center overflow-hidden',
          thumbnailUrl ? 'w-12 h-12 sm:w-16 sm:h-16 bg-[var(--bg-elevated)]' : 'w-10 h-10 sm:w-12 sm:h-12 bg-[var(--surface-glass-strong)]'
        )}>
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt={file.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl sm:text-2xl">{getFileIcon(file.type)}</span>
          )}
        </div>

        {/* File info */}
        <div className={cn('flex-1 min-w-0', isInbox && 'pr-10 sm:pr-12')}>
          <div className="flex items-center gap-1 sm:gap-2">
            {selecting && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect?.(file.id);
                }}
                className={cn(
                  'flex-shrink-0 rounded-md p-0.5 transition-colors',
                  selected ? 'text-[var(--color-accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                )}
                aria-label={selected ? 'Deselect file' : 'Select file'}
                title={selected ? 'Deselect file' : 'Select file'}
              >
                {selected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              </button>
            )}
            <h4 className="font-medium text-[var(--text-primary)] truncate flex-1 text-sm sm:text-base">{file.name}</h4>
            {isError && <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--color-error)] flex-shrink-0" />}
            {!selecting && onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(file.id);
                }}
                className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-bg)] transition-colors"
                aria-label="Delete file"
                title="Delete file"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-1 text-xs sm:text-sm text-[var(--text-muted)]">
            <span>{formatFileSize(file.size)}</span>
            {isInbox && (
              <>
                <span className="hidden sm:inline">•</span>
                <span className="truncate max-w-[120px] sm:max-w-none flex items-center gap-1">
                  {file.uploaderName}
                  <ConnectionPathIcon path={uploaderConnectionPath} />
                </span>
              </>
            )}
            <span className="hidden sm:inline">•</span>
            <div className="flex items-center gap-1">
              {isOutbox ? (
                <CheckCircle
                  className="w-3 h-3 text-[var(--color-accent)]"
                  aria-label="File shared successfully"
                />
              ) : (
                <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              )}
              <span className="hidden sm:inline">{new Date(file.uploadedAt).toLocaleTimeString()}</span>
              <span className="sm:hidden">{new Date(file.uploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>

          {/* Outbox: show who is downloading with per-peer progress */}
          {isOutbox && fileDownloaders.length > 0 && (
            <div className="mt-2 space-y-1.5">
              <span className="text-xs text-[var(--text-muted)]">Sending to:</span>
              <div className="flex flex-wrap gap-2">
                {fileDownloaders.map((d) => {
                  const progress = downloaderProgress[d.deviceId] ?? 0;
                  return (
                    <div
                      key={d.deviceId}
                      className="flex items-center gap-1.5"
                      title={`${d.displayName} ${progress}%`}
                    >
                      <div
                        className="rounded-lg p-[2px]"
                        style={{
                          background: `conic-gradient(from -90deg, rgba(20, 184, 166, 0.9) 0%, rgba(6, 182, 212, 0.9) ${progress}%, rgba(100, 116, 139, 0.2) ${progress}%, rgba(100, 116, 139, 0.2) 100%)`,
                        }}
                      >
                        <div
                          className="flex h-5 w-10 items-center justify-center rounded-md text-xs font-bold text-white"
                          style={{ backgroundColor: getAvatarColor(d.deviceId) }}
                        >
                          {getInitials(d.deviceId)}
                        </div>
                      </div>
                      <span className="text-xs font-medium text-[var(--color-accent)]">{progress}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Download progress */}
          {isInbox && isDownloading && (
            <div className="mt-2.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-glass-strong)]">
                <div
                  className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-500 ease-out relative"
                  style={{ width: `${progressValue}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer [background-size:200%_100%]" />
                </div>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span className="flex items-center gap-1.5">
                  Downloading
                  {file.speed != null && file.speed > 0 && (
                    <span className="text-[var(--color-accent)]">{formatSpeed(file.speed)}</span>
                  )}
                  {file.eta != null && file.eta > 0 && (
                    <span>{formatEta(file.eta)}</span>
                  )}
                </span>
                <span className="font-medium text-[var(--color-accent)]">{progressValue}%</span>
              </div>
            </div>
          )}

          {/* Error message */}
          {isError && (
            <div className="mt-1 text-xs text-[var(--color-error)]">
              Download failed. Try again.
            </div>
          )}

          {/* Copy button for text files */}
          {isInbox && !selecting && !isDownloading && isTextFile && onCopyTextFile && (
            <div className="mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  const ok = await onCopyTextFile(file);
                  if (ok) {
                    setCopySuccess(true);
                    setTimeout(() => setCopySuccess(false), 2000);
                  }
                }}
                className="text-xs sm:text-sm"
                aria-label="Copy text"
                title="Copy text"
              >
                {copySuccess ? <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" /> : <Copy className="w-3 h-3 sm:w-4 sm:h-4" />}
                <span>{copySuccess ? 'Copied!' : 'Copy'}</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Download/Retry/Cancel side action for inbox */}
      {isInbox && !selecting && (
        <button
          type="button"
          onClick={() => {
            if (isCompleted) return;
            if (isDownloading && onCancelDownload) { onCancelDownload(file.id); return; }
            onDownload?.(file);
          }}
          disabled={isCompleted || (isDownloading && !onCancelDownload)}
          className={cn(
            'absolute right-0 top-0 bottom-0 w-10 sm:w-12',
            'inline-flex flex-col items-center justify-center gap-1',
            'rounded-none rounded-r-xl border-l transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-inset',
            'disabled:cursor-default',
            isCompleted
              ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)] border-[var(--color-accent-border)]'
              : isError
                ? 'bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-error-border)] hover:bg-[var(--color-error-bg)]'
                : isDownloading && onCancelDownload
                  ? 'bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-error-border)] hover:bg-[var(--color-error-bg)]'
                  : 'bg-[var(--color-accent)] text-white border-[var(--color-accent-border)] hover:bg-[var(--color-accent-hover)]'
          )}
          aria-label={isCompleted ? 'Downloaded' : isError ? 'Retry download' : isDownloading && onCancelDownload ? 'Cancel download' : 'Download file'}
          title={isCompleted ? 'Downloaded' : isError ? 'Retry download' : isDownloading && onCancelDownload ? 'Cancel download' : 'Download file'}
        >
          {isCompleted
            ? <CheckCircle className="w-4 h-4" />
            : isDownloading && onCancelDownload
              ? <X className="w-4 h-4" />
              : <Download className="w-4 h-4" />}
          <span className="text-xs leading-none">
            {isCompleted ? 'Done' : isError ? 'Retry' : isDownloading && onCancelDownload ? 'Cancel' : 'Save'}
          </span>
        </button>
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
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1 glass border border-[var(--border-soft)] rounded-lg text-xs text-[var(--text-primary)] hover:bg-[var(--surface-glass-strong)] transition-colors"
      >
        {selected.icon && <selected.icon className="w-3 h-3" />}
        <span>{selected.label}</span>
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 left-0 z-20 w-36 glass-strong border border-[var(--border-soft)] rounded-lg shadow-xl overflow-hidden">
            {options.map((option) => (
              <button
                key={option.id}
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors',
                  option.id === value
                    ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
                    : 'text-[var(--text-primary)] hover:bg-[var(--surface-glass)]'
                )}
              >
                {option.icon && <option.icon className="w-3 h-3" />}
                {option.label}
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
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={cn('w-5 h-5', 'text-[var(--color-accent)]')} />
            <h3 className="font-semibold text-[var(--text-primary)]">{title}</h3>
            <span className="text-sm text-[var(--text-muted)]">
              ({filteredFiles.length}{files.length !== filteredFiles.length && ` / ${files.length}`})
            </span>
          </div>
        </div>
      )}

      {/* Filters (hidden when hideFilters=true, e.g. Outbox; code kept for later) */}
      {!hideFilters && files.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter */}
          <div className="flex items-center gap-1 glass rounded-lg p-1">
            {(['all', 'pending', 'completed'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  'px-2 py-1 text-xs rounded transition-colors capitalize',
                  statusFilter === status
                    ? 'bg-[var(--bg-surface)] text-white'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                )}
              >
                {status === 'all' ? 'All' : status === 'pending' ? 'Pending' : 'Done'}
              </button>
            ))}
          </div>

          {/* Type filter */}
          <FilterDropdown
            label="Type"
            value={typeFilter}
            options={fileTypeCategories.map((c) => ({ id: c.id, label: c.label, icon: c.icon }))}
            onChange={setTypeFilter}
          />

          {/* User filter */}
          {uploaders.length > 1 && (
            <FilterDropdown
              label="From"
              value={userFilter}
              options={[{ id: 'all', label: 'All Users', icon: User }, ...uploaders]}
              onChange={setUserFilter}
            />
          )}

          {/* Sort */}
          <FilterDropdown
            label="Sort"
            value={sortBy}
            options={[
              { id: 'newest', label: 'Newest First', icon: Clock },
              { id: 'oldest', label: 'Oldest First', icon: Clock },
              { id: 'size', label: 'Largest First', icon: FileType },
            ]}
            onChange={(v) => setSortBy(v as typeof sortBy)}
          />

          {/* Clear filters */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>
      )}

      {/* File list */}
      {filteredFiles.length > 0 ? (
        <div className="space-y-2">
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
        <div className="flex flex-col items-center justify-center py-8 text-[var(--text-muted)]">
          {hasFilters ? (
            <>
              <div className="flex items-center justify-center w-14 h-14 mx-auto mb-3 rounded-2xl bg-[var(--surface-glass-strong)] border border-[var(--border-soft)]">
                <Icon className="w-6 h-6 opacity-40" />
              </div>
              <p className="font-medium text-[var(--text-secondary)]">No files match filters</p>
              <button onClick={clearFilters} className="mt-3 text-sm text-[var(--color-accent)] hover:underline">
                Clear filters
              </button>
            </>
          ) : isInbox ? (
            <>
              <div className="flex items-center justify-center w-14 h-14 mx-auto mb-3 rounded-2xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent-border)]">
                <Inbox className="w-6 h-6 text-[var(--color-accent)] opacity-70" />
              </div>
              {showTrash ? (
                <>
                  <p className="font-medium text-[var(--text-secondary)]">Trash is empty</p>
                  <p className="text-xs mt-1 max-w-[260px] text-center leading-relaxed opacity-70">
                    Hidden inbox files appear here and can be restored
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-[var(--text-secondary)]">Waiting for files</p>
                  <p className="text-xs mt-1 max-w-[260px] text-center leading-relaxed opacity-70">
                    When someone shares a file, it downloads directly from their device to yours
                  </p>
                  <div className="flex items-center gap-4 mt-4 text-xs uppercase tracking-wider opacity-50">
                    <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Encrypted</span>
                    <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Peer-to-peer</span>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-center w-14 h-14 mx-auto mb-3 rounded-2xl bg-[var(--color-accent-subtle)] border border-[var(--color-accent-border)]">
                <Send className="w-6 h-6 text-[var(--color-accent)] opacity-70" />
              </div>
              <p className="font-medium text-[var(--text-secondary)]">Share your first file</p>
              <p className="text-xs mt-1 max-w-[260px] text-center leading-relaxed opacity-70">
                Files go directly to other devices -- nothing is uploaded to a server
              </p>

              {/* Inline action buttons */}
              <div className="flex items-center gap-3 mt-5">
                {onAddFile && (
                  <button
                    onClick={onAddFile}
                    className="flex items-center gap-2 text-sm font-medium text-white bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] transition-all px-5 py-2.5 rounded-xl shadow-lg"
                  >
                    <FileUp className="w-4.5 h-4.5" />
                    Share File
                  </button>
                )}
                {onPaste && (
                  <button
                    onClick={onPaste}
                    className="flex items-center gap-2 text-sm font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors px-4 py-2.5 rounded-xl border border-[var(--color-accent-border)] hover:bg-[var(--color-accent-subtle)]"
                  >
                    <ClipboardPaste className="w-4 h-4" />
                    Paste
                  </button>
                )}
              </div>

              <p className="text-xs mt-4 opacity-40">
                or drag & drop files anywhere
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
