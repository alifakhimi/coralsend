'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/store';
import { MemberAvatar } from './MemberAvatar';
import { Button } from './Button';
import {
  Send,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: number;
  isMe: boolean;
}

interface ChatProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  className?: string;
}

interface ChatInputProps {
  onSend: (text: string) => void;
}

export function ChatMessages({ messages, className }: { messages: ChatMessage[]; className?: string }) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const members = useStore((s) => s.currentRoom?.members || []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getMember = (deviceId: string) => members.find((m) => m.deviceId === deviceId);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Group messages by sender and time (within 2 minutes)
  const groupedMessages = useMemo(
    () =>
      messages.reduce<Array<{ senderId: string; messages: ChatMessage[] }>>((acc, msg) => {
        const lastGroup = acc[acc.length - 1];

        if (
          lastGroup &&
          lastGroup.senderId === msg.senderId &&
          msg.timestamp - lastGroup.messages[lastGroup.messages.length - 1].timestamp < 120000
        ) {
          lastGroup.messages.push(msg);
        } else {
          acc.push({ senderId: msg.senderId, messages: [msg] });
        }

        return acc;
      }, []),
    [messages]
  );

  return (
    <div className={cn('space-y-4', className)}>
      {groupedMessages.length === 0 ? (
        <p className="text-center text-[var(--text-muted)] text-sm py-4">
          No messages yet. Say hello!
        </p>
      ) : (
        groupedMessages.map((group, groupIdx) => {
          const member = getMember(group.senderId);
          const isMe = group.messages[0].isMe;

          return (
            <div
              key={groupIdx}
              className={cn('flex gap-2', isMe && 'flex-row-reverse')}
            >
              {member && !isMe && (
                <MemberAvatar member={member} size="sm" showStatus={false} />
              )}

              <div className={cn('flex flex-col gap-1 max-w-[75%]', isMe && 'items-end')}>
                {!isMe && (
                  <span className="text-xs text-[var(--text-muted)] ml-1">
                    {group.messages[0].senderName}
                  </span>
                )}

                {group.messages.map((msg, msgIdx) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'px-3 py-2 rounded-2xl text-sm break-words',
                      isMe
                        ? 'bg-[var(--color-accent)] text-white rounded-br-md'
                        : 'glass-strong text-[var(--text-primary)] rounded-bl-md',
                      msgIdx === 0 && isMe && 'rounded-tr-2xl',
                      msgIdx === 0 && !isMe && 'rounded-tl-2xl'
                    )}
                  >
                    {msg.text}
                  </div>
                ))}

                <span className="text-xs text-[var(--text-muted)] ml-1">
                  {formatTime(group.messages[group.messages.length - 1].timestamp)}
                </span>
              </div>
            </div>
          );
        })
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}

export function ChatInput({ onSend }: ChatInputProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex gap-2">
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        className="flex-1 bg-[var(--surface-glass)] border border-[var(--border-soft)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]"
      />
      <Button
        variant="primary"
        size="icon"
        onClick={handleSend}
        disabled={!text.trim()}
      >
        <Send className="w-4 h-4" />
      </Button>
    </div>
  );
}

export function Chat({ messages, onSend, className }: ChatProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const unreadCount = isExpanded ? 0 : messages.filter((m) => !m.isMe).length;

  return (
    <div className={cn('flex flex-col glass rounded-xl border border-[var(--border-soft)]', className)}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between p-3 hover:bg-[var(--surface-glass)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="font-medium text-[var(--text-primary)] text-sm">Chat</span>
          {unreadCount > 0 && (
            <span className="bg-[var(--color-accent)] text-white text-xs px-1.5 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
        ) : (
          <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
        )}
      </button>

      {isExpanded && (
        <>
          <div className="flex-1 max-h-64 overflow-y-auto p-3 border-t border-[var(--border-soft)]">
            <ChatMessages messages={messages} />
          </div>
          <div className="p-3 border-t border-[var(--border-soft)]">
            <ChatInput onSend={onSend} />
          </div>
        </>
      )}
    </div>
  );
}

