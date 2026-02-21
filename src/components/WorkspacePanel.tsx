'use client';

import React from 'react';
import { Server, RefreshCw, Wifi, WifiOff, Clock, Zap, Globe, Cloud } from 'lucide-react';

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
  htmlSize?: number;
  timestamp: number;
}

interface WorkspacePanelProps {
  status: WorkspaceStatus;
  url: string;
  onRefresh: () => void;
}

export function WorkspacePanel({ status, url, onRefresh }: WorkspacePanelProps) {
  const getStatusIcon = () => {
    switch (status.status) {
      case 'online':
        return <Wifi className="w-4 h-4 text-green-400" />;
      case 'offline':
      case 'timeout':
      case 'not_found':
        return <WifiOff className="w-4 h-4 text-red-400" />;
      case 'checking':
        return <Clock className="w-4 h-4 text-yellow-400 animate-pulse" />;
      default:
        return <Server className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (status.status) {
      case 'online':
        return 'text-green-400';
      case 'offline':
      case 'timeout':
      case 'not_found':
        return 'text-red-400';
      case 'checking':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusText = () => {
    switch (status.status) {
      case 'online':
        return 'Connected';
      case 'offline':
        return 'Offline';
      case 'timeout':
        return 'Timeout';
      case 'not_found':
        return 'Not Found';
      case 'checking':
        return 'Checking...';
      default:
        return 'Unknown';
    }
  };

  // Check if it's a z.ai workspace
  const isZaiWorkspace = () => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.endsWith('.z.ai') || urlObj.hostname.includes('space.z.ai');
    } catch {
      return false;
    }
  };

  const isZai = isZaiWorkspace();

  return (
    <div className="bg-[var(--bg-tertiary)] border-b border-[var(--border-color)] px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Status Info */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className={`text-sm font-medium ${getStatusColor()}`}>
              {getStatusText()}
            </span>
          </div>

          {status.isNextJs && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-[var(--bg-secondary)] rounded-md">
              <Zap className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span className="text-xs text-[var(--accent-primary)] font-medium">Next.js</span>
            </div>
          )}

          {isZai && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 rounded-md border border-blue-500/30">
              <Cloud className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs text-blue-400 font-medium">z.ai Workspace</span>
            </div>
          )}

          {status.isLocal && !isZai && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-[var(--bg-secondary)] rounded-md">
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs text-blue-400 font-medium">Local</span>
            </div>
          )}

          {status.httpStatus && (
            <span className="text-xs text-[var(--text-muted)]">
              HTTP {status.httpStatus}
            </span>
          )}

          {status.htmlSize && status.htmlSize > 0 && (
            <span className="text-xs text-[var(--text-muted)]">
              {(status.htmlSize / 1024).toFixed(1)} KB
            </span>
          )}

          {status.serverInfo?.poweredBy && (
            <span className="text-xs text-[var(--text-muted)] hidden md:inline">
              {status.serverInfo.poweredBy}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)] font-mono hidden lg:inline max-w-[300px] truncate">
            {url}
          </span>
          <button
            onClick={onRefresh}
            className="btn-ghost p-1.5"
            title="Refresh workspace status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error Message */}
      {status.error && status.status !== 'online' && (
        <div className="mt-2 text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-md">
          {status.errorType && <span className="font-medium">[{status.errorType}] </span>}
          {status.error}
        </div>
      )}
    </div>
  );
}
