'use client';

import { cn, formatFileSize, getFileIcon } from '@/lib/utils';
import { Progress } from './Progress';
import { CheckCircle, AlertCircle, X } from 'lucide-react';
import type { FileMetadata } from '@/store/store';

interface FileCardProps {
  file: FileMetadata;
  onRemove?: () => void;
  className?: string;
}

export function FileCard({ file, onRemove, className }: FileCardProps) {
  // Map FileMetadata status to FileCard status
  const getCardStatus = () => {
    if (file.status === 'downloading') return 'transferring';
    if (file.status === 'completed') return 'completed';
    if (file.status === 'error') return 'error';
    return 'pending';
  };

  const cardStatus = getCardStatus();

  const statusColors = {
    pending: 'border-[var(--border-soft)]',
    transferring: 'border-[var(--color-accent-border)]',
    completed: 'border-[var(--color-accent-border)]',
    error: 'border-[var(--color-error-border)]',
  };

  const statusIcons = {
    pending: null,
    transferring: null,
    completed: <CheckCircle className="w-5 h-5 text-[var(--color-accent)]" />,
    error: <AlertCircle className="w-5 h-5 text-[var(--color-error)]" />,
  };

  // Map direction
  const directionLabel = file.direction === 'inbox' ? 'Receiving' : 'Sending';

  return (
    <div
      className={cn(
        'bg-[var(--bg-elevated)] rounded-xl p-4 border transition-colors',
        statusColors[cardStatus],
        className
      )}
    >
      <div className="flex items-start gap-3">
        {/* File icon */}
        <div className="flex-shrink-0 w-12 h-12 bg-[var(--bg-surface)] rounded-lg flex items-center justify-center text-2xl">
          {getFileIcon(file.type)}
        </div>

        {/* File info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-white truncate flex-1">{file.name}</h4>
            {statusIcons[cardStatus]}
            {onRemove && cardStatus !== 'transferring' && (
              <button
                onClick={onRemove}
                className="p-1 hover:bg-[var(--bg-surface)] rounded transition-colors"
              >
                <X className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            )}
          </div>
          
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {formatFileSize(file.size)}
            <span className="mx-2">•</span>
            <span className="capitalize">
              {directionLabel}
            </span>
          </p>

          {/* Progress bar for active transfers */}
          {(cardStatus === 'transferring' || cardStatus === 'pending') && (
            <div className="mt-3">
              <Progress value={file.progress} size="sm" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

