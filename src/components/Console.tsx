'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Terminal, Send, Trash2 } from 'lucide-react';

export interface LogEntry {
  id: string;
  type: 'info' | 'warn' | 'error' | 'command' | 'result' | 'system';
  message: string;
  timestamp: number;
}

interface ConsoleProps {
  logs: LogEntry[];
  onCommand: (command: string) => void;
  onClear: () => void;
  isLoading?: boolean;
}

export function Console({ logs, onCommand, onClear, isLoading }: ConsoleProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onCommand(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const getLogIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'error':
        return <span className="text-red-400">✗</span>;
      case 'warn':
        return <span className="text-yellow-400">⚠</span>;
      case 'info':
        return <span className="text-green-400">ℹ</span>;
      case 'command':
        return <span className="text-cyan-400">›</span>;
      case 'result':
        return <span className="text-purple-400">←</span>;
      default:
        return <span className="text-gray-400">•</span>;
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {/* Console Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-[var(--accent-primary)]" />
          <span className="text-sm font-medium text-[var(--text-primary)]">Console</span>
          <span className="px-2 py-0.5 text-xs bg-[var(--bg-tertiary)] rounded-full text-[var(--text-muted)]">
            {logs.length}
          </span>
        </div>
        <button
          onClick={onClear}
          className="btn-ghost p-1"
          title="Clear console"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Console Output */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2 console-scroll"
        style={{ maxHeight: '300px' }}
      >
        {logs.length === 0 ? (
          <div className="text-center text-[var(--text-muted)] py-8 text-sm">
            <Terminal className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>No logs yet</p>
            <p className="text-xs mt-1">Load a URL to see console output</p>
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={`console-log ${log.type}`}
            >
              <div className="flex items-start gap-2">
                <span className="shrink-0 mt-0.5">{getLogIcon(log.type)}</span>
                <div className="flex-1 min-w-0">
                  <pre className="whitespace-pre-wrap break-all text-[var(--text-primary)]">
                    {log.message}
                  </pre>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {formatTime(log.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Command Input */}
      <form onSubmit={handleSubmit} className="border-t border-[var(--border-color)] p-2">
        <div className="flex items-center gap-2">
          <span className="text-[var(--accent-primary)] font-mono text-sm">›</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Execute JavaScript..."
            className="flex-1 bg-transparent border-none outline-none text-sm font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="btn-ghost p-1.5 disabled:opacity-30"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
