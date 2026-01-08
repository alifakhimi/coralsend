'use client';

import { useState, useMemo } from 'react';
import { cn, formatFileSize, getFileIcon } from '@/lib/utils';
import { useStore, type FileMetadata } from '@/store/store';
import { Progress } from './Progress';
import { Button } from './Button';
import {
  Download,
  CheckCircle,
  AlertCircle,
  Loader2,
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
} from 'lucide-react';

// ============ File Type Categories ============

const fileTypeCategories = [
  { id: 'all', label: 'All Types', icon: File },
  { id: 'image', label: 'Images', icon: Image, match: (t: string) => t.startsWith('image/') },
  { id: 'video', label: 'Videos', icon: FileVideo, match: (t: string) => t.startsWith('video/') },
  { id: 'audio', label: 'Audio', icon: FileAudio, match: (t: string) => t.startsWith('audio/') },
  { id: 'document', label: 'Documents', icon: FileText, match: (t: string) => 
    t.includes('pdf') || t.includes('document') || t.includes('text') || t.includes('spreadsheet') || t.includes('presentation')
  },
  { id: 'archive', label: 'Archives', icon: Archive, match: (t: string) => 
    t.includes('zip') || t.includes('rar') || t.includes('tar') || t.includes('gzip')
  },
];

// ============ File Item Component ============

interface FileItemProps {
  file: FileMetadata;
  onDownload?: (file: FileMetadata) => void;
}

function FileItem({ file, onDownload }: FileItemProps) {
  const isDownloading = file.status === 'downloading';
  const isCompleted = file.status === 'completed';
  const isError = file.status === 'error';
  const isInbox = file.direction === 'inbox';
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');

  // Get thumbnail URL if available (for completed files)
  const thumbnailUrl = file.thumbnailUrl;

  return (
    <div
      className={cn(
        'bg-slate-800/50 rounded-xl p-4 border transition-all',
        isCompleted && 'border-teal-500/30',
        isDownloading && 'border-cyan-500/30',
        isError && 'border-red-500/30',
        !isCompleted && !isDownloading && !isError && 'border-slate-700/50'
      )}
    >
      <div className="flex items-start gap-3">
        {/* File icon or thumbnail */}
        <div className={cn(
          'flex-shrink-0 rounded-lg flex items-center justify-center overflow-hidden',
          thumbnailUrl ? 'w-16 h-16 bg-slate-900' : 'w-12 h-12 bg-slate-700/50'
        )}>
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt={file.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl">{getFileIcon(file.type)}</span>
          )}
        </div>

        {/* File info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-white truncate flex-1">{file.name}</h4>
            {isCompleted && <CheckCircle className="w-4 h-4 text-teal-400 flex-shrink-0" />}
            {isError && <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
          </div>

          <div className="flex items-center gap-2 mt-1 text-sm text-slate-400">
            <span>{formatFileSize(file.size)}</span>
            <span>•</span>
            <span className="truncate">{file.uploaderName}</span>
            <span>•</span>
            <Clock className="w-3 h-3" />
            <span>{new Date(file.uploadedAt).toLocaleTimeString()}</span>
          </div>

          {/* Progress bar for downloading files */}
          {isDownloading && (
            <div className="mt-3">
              <Progress value={file.progress} size="sm" />
            </div>
          )}
        </div>

        {/* Action button */}
        {isInbox && !isCompleted && !isDownloading && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => onDownload?.(file)}
          >
            <Download className="w-4 h-4" />
            Download
          </Button>
        )}
        
        {isDownloading && (
          <div className="flex items-center gap-2 text-cyan-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            {file.progress}%
          </div>
        )}
      </div>
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
        className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 border border-slate-700 rounded-lg text-xs text-slate-300 hover:border-slate-600 transition-colors"
      >
        {selected.icon && <selected.icon className="w-3 h-3" />}
        <span>{selected.label}</span>
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 left-0 z-20 w-36 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
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
                    ? 'bg-teal-500/20 text-teal-400'
                    : 'text-slate-300 hover:bg-slate-700'
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
  className?: string;
}

export function FileList({ direction, onDownload, className }: FileListProps) {
  const allFiles = useStore((s) => s.currentRoom?.files);
  const members = useStore((s) => s.currentRoom?.members);
  
  // Filter files by direction using useMemo to avoid creating new arrays on every render
  const files = useMemo(() => 
    allFiles?.filter(f => f.direction === direction) || []
  , [allFiles, direction]);
  
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'size'>('newest');

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
  const emptyMessage = isInbox
    ? 'No files shared with you yet'
    : 'Share files by clicking the + button';

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn('w-5 h-5', isInbox ? 'text-cyan-400' : 'text-teal-400')} />
          <h3 className="font-semibold text-white">{title}</h3>
          <span className="text-sm text-slate-500">
            ({filteredFiles.length}{files.length !== filteredFiles.length && ` / ${files.length}`})
          </span>
        </div>
      </div>

      {/* Filters */}
      {files.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter */}
          <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
            {(['all', 'pending', 'completed'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  'px-2 py-1 text-xs rounded transition-colors capitalize',
                  statusFilter === status
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white'
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
              className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-white transition-colors"
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
            <FileItem key={file.id} file={file} onDownload={onDownload} />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-slate-500">
          <Icon className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{hasFilters ? 'No files match filters' : emptyMessage}</p>
          {hasFilters && (
            <button onClick={clearFilters} className="mt-2 text-sm text-teal-400 hover:underline">
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
