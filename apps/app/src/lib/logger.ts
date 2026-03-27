export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogCategory = 'ICE' | 'Transfer' | 'Signaling' | 'DataChannel' | 'General';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  category: LogCategory;
  message: string;
  detail?: string;
}

const RING_SIZE = 500;
const entries: LogEntry[] = [];
let listeners: Array<() => void> = [];

function push(entry: LogEntry) {
  if (entries.length >= RING_SIZE) entries.shift();
  entries.push(entry);
  listeners.forEach((fn) => fn());
}

function log(level: LogLevel, category: LogCategory, message: string, detail?: string) {
  const entry: LogEntry = { timestamp: Date.now(), level, category, message, detail };
  push(entry);

  const tag = `[${category}]`;
  const formatted = detail ? `${tag} ${message} ${detail}` : `${tag} ${message}`;

  switch (level) {
    case 'debug': console.debug(formatted); break;
    case 'info':  console.log(formatted); break;
    case 'warn':  console.warn(formatted); break;
    case 'error': console.error(formatted); break;
  }
}

export const logger = {
  debug: (category: LogCategory, message: string, detail?: string) => log('debug', category, message, detail),
  info:  (category: LogCategory, message: string, detail?: string) => log('info',  category, message, detail),
  warn:  (category: LogCategory, message: string, detail?: string) => log('warn',  category, message, detail),
  error: (category: LogCategory, message: string, detail?: string) => log('error', category, message, detail),

  getEntries: () => [...entries],
  subscribe: (fn: () => void) => {
    listeners.push(fn);
    return () => { listeners = listeners.filter((l) => l !== fn); };
  },
  clear: () => { entries.length = 0; listeners.forEach((fn) => fn()); },
};
