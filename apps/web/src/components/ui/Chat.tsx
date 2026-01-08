'use client';

import { useState, useRef, useEffect } from 'react';
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

export function Chat({ messages, onSend, className }: ChatProps) {
  const [text, setText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const members = useStore((s) => s.currentRoom?.members || []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isExpanded) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isExpanded]);

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

  const getMember = (deviceId: string) => members.find((m) => m.deviceId === deviceId);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Group messages by sender and time (within 2 minutes)
  const groupedMessages = messages.reduce<Array<{ senderId: string; messages: ChatMessage[] }>>((acc, msg) => {
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
  }, []);

  const unreadCount = isExpanded ? 0 : messages.filter((m) => !m.isMe).length;

  return (
    <div className={cn('flex flex-col bg-slate-800/50 rounded-xl border border-slate-700', className)}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between p-3 hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-slate-400" />
          <span className="font-medium text-white text-sm">Chat</span>
          {unreadCount > 0 && (
            <span className="bg-teal-500 text-white text-xs px-1.5 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {/* Messages */}
      {isExpanded && (
        <>
          <div className="flex-1 max-h-64 overflow-y-auto p-3 space-y-4 border-t border-slate-700">
            {groupedMessages.length === 0 ? (
              <p className="text-center text-slate-500 text-sm py-4">
                No messages yet. Say hello! 👋
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
                    {/* Avatar */}
                    {member && !isMe && (
                      <MemberAvatar member={member} size="sm" showStatus={false} />
                    )}

                    {/* Messages */}
                    <div className={cn('flex flex-col gap-1 max-w-[75%]', isMe && 'items-end')}>
                      {/* Sender name */}
                      {!isMe && (
                        <span className="text-xs text-slate-500 ml-1">
                          {group.messages[0].senderName}
                        </span>
                      )}

                      {/* Message bubbles */}
                      {group.messages.map((msg, msgIdx) => (
                        <div
                          key={msg.id}
                          className={cn(
                            'px-3 py-2 rounded-2xl text-sm break-words',
                            isMe
                              ? 'bg-teal-600 text-white rounded-br-md'
                              : 'bg-slate-700 text-white rounded-bl-md',
                            msgIdx === 0 && isMe && 'rounded-tr-2xl',
                            msgIdx === 0 && !isMe && 'rounded-tl-2xl'
                          )}
                        >
                          {msg.text}
                        </div>
                      ))}

                      {/* Timestamp */}
                      <span className="text-xs text-slate-500 ml-1">
                        {formatTime(group.messages[group.messages.length - 1].timestamp)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-slate-700">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
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
          </div>
        </>
      )}
    </div>
  );
}

