'use client';

import React from 'react';
import { 
  Key, 
  Loader2, 
  ArrowLeft, 
  ArrowRight, 
  Download, 
  Home,
  Globe,
  Zap,
  Server,
  Wifi,
  WifiOff
} from 'lucide-react';
import { Console, LogEntry } from './Console';

interface WorkspaceStatus {
  status: 'online' | 'offline' | 'timeout' | 'not_found' | 'checking' | 'unknown';
  isLocal: boolean;
  isNextJs: boolean;
  serverInfo?: {
    server: string;
    poweredBy: string;
    contentType: string;
  };
  httpStatus?: number;
  error?: string;
  errorType?: string;
  timestamp: number;
}

interface SidebarProps {
  url: string;
  setUrl: (url: string) => void;
  isLoading: boolean;
  onInitialize: () => void;
  onBack: () => void;
  onForward: () => void;
  onHome: () => void;
  onDownload: () => void;
  logs: LogEntry[];
  onCommand: (command: string) => void;
  onClearLogs: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  workspaceStatus?: WorkspaceStatus | null;
  isWorkspaceMode?: boolean;
}

export function Sidebar({
  url,
  setUrl,
  isLoading,
  onInitialize,
  onBack,
  onForward,
  onHome,
  onDownload,
  logs,
  onCommand,
  onClearLogs,
  canGoBack,
  canGoForward,
  workspaceStatus,
  isWorkspaceMode,
}: SidebarProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onInitialize();
    }
  };

  const getStatusIndicator = () => {
    if (!workspaceStatus) return null;
    
    const iconClass = "w-3.5 h-3.5";
    
    switch (workspaceStatus.status) {
      case 'online':
        return (
          <div className="flex items-center gap-1.5">
            <Wifi className={`${iconClass} text-green-400`} />
            <span className="text-xs text-green-400">Connected</span>
          </div>
        );
      case 'offline':
      case 'timeout':
      case 'not_found':
        return (
          <div className="flex items-center gap-1.5">
            <WifiOff className={`${iconClass} text-red-400`} />
            <span className="text-xs text-red-400">{workspaceStatus.status}</span>
          </div>
        );
      case 'checking':
        return (
          <div className="flex items-center gap-1.5">
            <Loader2 className={`${iconClass} text-yellow-400 animate-spin`} />
            <span className="text-xs text-yellow-400">Checking...</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="sidebar w-[350px] h-full flex flex-col shrink-0">
      {/* Header */}
      <div className="px-4 py-4 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-3 mb-1">
          <div className="relative">
            <Key className="w-7 h-7 text-[var(--accent-primary)]" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-[var(--accent-primary)] rounded-full animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              <span className="text-[var(--text-primary)]">Mind</span>
              <span className="text-[var(--accent-primary)]"> Key</span>
            </h1>
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest">
              Universal Access Engine
            </p>
          </div>
        </div>
      </div>

      {/* URL Input Section */}
      <div className="px-4 py-4 border-b border-[var(--border-color)]">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-[var(--text-muted)]" />
            <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Target URL</span>
          </div>
          <div className="relative">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com or localhost:3000"
              className="input-mind w-full pr-12"
              disabled={isLoading}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isLoading ? (
                <Loader2 className="w-5 h-5 text-[var(--accent-primary)] animate-spin" />
              ) : (
                <Zap className="w-5 h-5 text-[var(--text-muted)]" />
              )}
            </div>
          </div>
          <button
            type="submit"
            disabled={!url.trim() || isLoading}
            className="btn-mind w-full mt-3 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Initializing...</span>
              </>
            ) : (
              <>
                <Key className="w-5 h-5" />
                <span>Initialize Access</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Workspace Status */}
      {workspaceStatus && (
        <div className="px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Workspace</span>
            </div>
            {getStatusIndicator()}
          </div>
          
          {workspaceStatus.isNextJs && workspaceStatus.status === 'online' && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex items-center gap-1 px-2 py-1 bg-[var(--bg-secondary)] rounded text-xs">
                <Zap className="w-3 h-3 text-[var(--accent-primary)]" />
                <span className="text-[var(--accent-primary)]">Next.js detected</span>
              </div>
              {workspaceStatus.httpStatus && (
                <span className="text-xs text-[var(--text-muted)]">
                  HTTP {workspaceStatus.httpStatus}
                </span>
              )}
            </div>
          )}

          {workspaceStatus.error && workspaceStatus.status !== 'online' && (
            <div className="mt-2 text-xs text-red-400">
              {workspaceStatus.error}
            </div>
          )}
        </div>
      )}

      {/* Navigation Controls */}
      <div className="px-4 py-3 border-b border-[var(--border-color)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={onBack}
              disabled={!canGoBack || isLoading}
              className="btn-ghost p-2 disabled:opacity-30"
              title="Go back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              onClick={onForward}
              disabled={!canGoForward || isLoading}
              className="btn-ghost p-2 disabled:opacity-30"
              title="Go forward"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onHome}
              disabled={isLoading}
              className="btn-ghost p-2 disabled:opacity-30"
              title="Go home"
            >
              <Home className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={onDownload}
            disabled={!url || isLoading}
            className="btn-ghost p-2 px-3 disabled:opacity-30 flex items-center gap-2 text-sm"
            title="Download as HTML"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Download</span>
          </button>
        </div>
      </div>

      {/* Console */}
      <div className="flex-1 min-h-0">
        <Console
          logs={logs}
          onCommand={onCommand}
          onClear={onClearLogs}
          isLoading={isLoading}
        />
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-[var(--border-color)] bg-[var(--bg-tertiary)]">
        <p className="text-[10px] text-[var(--text-muted)] text-center">
          Press <kbd className="px-1.5 py-0.5 bg-[var(--bg-primary)] rounded text-[var(--accent-primary)]">Enter</kbd> to submit • 
          <kbd className="px-1.5 py-0.5 bg-[var(--bg-primary)] rounded text-[var(--accent-primary)]">Shift+Enter</kbd> for new line
        </p>
      </div>
    </div>
  );
}
