import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format file size to human readable
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Format transfer speed (bytes/sec) to human readable
export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '';
  return `${formatFileSize(bytesPerSec)}/s`;
}

// Format ETA in seconds to human readable
export function formatEta(seconds: number): string {
  if (seconds <= 0 || !isFinite(seconds)) return '';
  if (seconds < 60) return `~${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `~${Math.ceil(seconds / 60)}m`;
  return `~${Math.floor(seconds / 3600)}h ${Math.ceil((seconds % 3600) / 60)}m`;
}

// Get file icon based on mime type
export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.includes('pdf')) return '📄';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return '📦';
  if (mimeType.includes('text') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️';
  return '📁';
}

// Validate UUID format
export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Extract room ID from URL or text
export function extractRoomId(text: string): string | null {
  const trimmed = text.trim();
  
  // If it contains /room/{id} path (from QR code or share link - full or relative URL)
  const pathMatch = trimmed.match(/\/room\/([A-Z0-9a-f-]+)/i);
  if (pathMatch) {
    const id = pathMatch[1];
    return isValidUUID(id) ? id : id.toUpperCase();
  }
  
  // If it's a URL with room parameter (?room=...)
  if (trimmed.includes('room=')) {
    try {
      const url = new URL(trimmed);
      const room = url.searchParams.get('room');
      return room ? (isValidUUID(room) ? room : room.toUpperCase()) : null;
    } catch {
      const match = trimmed.match(/room=([A-Z0-9a-f-]+)/i);
      return match ? match[1].toUpperCase() : null;
    }
  }
  
  // If it's a direct UUID
  if (isValidUUID(trimmed)) {
    return trimmed;
  }
  
  // If it's a 6-character room code
  if (/^[A-Za-z0-9]{6}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  
  return null;
}

