'use client';

import React from 'react';
import { RefreshCw, ExternalLink, Maximize2, Minimize2, Server, Zap, AlertCircle } from 'lucide-react';

interface PreviewFrameProps {
  html: string;
  url: string;
  isLoading: boolean;
  onReload: () => void;
  useDirectEmbed?: boolean;
  isWorkspace?: boolean;
  onLoad?: () => void;
  onError?: (error: string) => void;
}

export function PreviewFrame({ 
  html, 
  url, 
  isLoading, 
  onReload,
  useDirectEmbed = false,
  isWorkspace = false,
  onLoad,
  onError
}: PreviewFrameProps) {
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [iframeKey, setIframeKey] = React.useState(0);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isLoaded, setIsLoaded] = React.useState(false);

  const handleOpenExternal = () => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleForceReload = () => {
    setLoadError(null);
    setIsLoaded(false);
    setIframeKey(prev => prev + 1);
    onReload();
  };

  const handleIframeLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleIframeError = () => {
    const errorMsg = 'Failed to load the preview';
    setLoadError(errorMsg);
    onError?.(errorMsg);
  };

  const displayUrl = url || 'about:blank';

  // For direct embed, we don't use sandbox to allow full functionality
  // For proxied content, we use minimal sandbox
  const getSandboxAttrs = () => {
    if (useDirectEmbed) {
      // No sandbox for local/localhost - allows full functionality
      return undefined;
    }
    // Minimal sandbox for proxied content
    return 'allow-scripts allow-same-origin allow-forms allow-popups';
  };

  return (
    <div className={`flex flex-col h-full ${isFullscreen ? 'fixed inset-0 z-50 bg-[var(--bg-primary)]' : ''}`}>
      {/* Browser Chrome */}
      <div className="browser-chrome flex items-center gap-2 px-3 py-2">
        {/* Window Controls */}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 cursor-pointer transition-colors" />
          <div className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400 cursor-pointer transition-colors" />
          <div className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-400 cursor-pointer transition-colors" />
        </div>

        {/* Workspace Indicator */}
        {isWorkspace && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-[var(--bg-tertiary)] rounded-md border border-[var(--accent-primary)]/30">
            <Server className="w-3 h-3 text-[var(--accent-primary)]" />
            <span className="text-xs text-[var(--accent-primary)] font-medium">Workspace</span>
          </div>
        )}

        {/* Status Indicator */}
        {isLoaded && !loadError && url && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 rounded-md">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs text-green-400">Loaded</span>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={handleForceReload}
            disabled={isLoading || !url}
            className="btn-ghost p-1.5 disabled:opacity-30"
            title="Reload"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* URL Bar */}
        <div className="flex-1 url-bar flex items-center gap-2">
          <div className="shrink-0">
            {loadError ? (
              <AlertCircle className="w-4 h-4 text-red-400" />
            ) : useDirectEmbed ? (
              <Zap className="w-4 h-4 text-[var(--accent-primary)]" />
            ) : url.startsWith('https://') ? (
              <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
          </div>
          <span className="flex-1 truncate text-sm">
            {displayUrl}
          </span>
          {useDirectEmbed && !loadError && (
            <span className="text-xs text-[var(--accent-primary)] shrink-0">
              DIRECT
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleOpenExternal}
            disabled={!url}
            className="btn-ghost p-1.5 disabled:opacity-30"
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="btn-ghost p-1.5"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Preview Content */}
      <div className="flex-1 relative bg-white">
        {/* Loading Overlay */}
        {isLoading && (
          <div className="loading-overlay z-20">
            <div className="spinner" />
            <p className="text-[var(--text-secondary)] text-sm mt-3">
              {useDirectEmbed ? 'Connecting to workspace...' : 'Loading preview...'}
            </p>
            <p className="text-[var(--text-muted)] text-xs mt-1">{url}</p>
          </div>
        )}

        {/* Error State */}
        {loadError && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--bg-primary)] z-10">
            <div className="text-center max-w-md px-4">
              <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                Failed to Load
              </h2>
              <p className="text-[var(--text-secondary)] text-sm mb-4">
                {loadError}
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={handleForceReload}
                  className="btn-mind px-4 py-2 text-sm"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </button>
                <button
                  onClick={handleOpenExternal}
                  className="btn-ghost px-4 py-2 text-sm"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Externally
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !url && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--bg-primary)]">
            <div className="text-center max-w-md px-4">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
                <svg className="w-10 h-10 text-[var(--accent-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                Mind Key Preview
              </h2>
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-4">
                Enter a URL in the sidebar and click &quot;Initialize Access&quot; to preview any website.
              </p>
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex items-center gap-3 text-[var(--accent-primary)] bg-[var(--bg-tertiary)] p-3 rounded-lg">
                  <Zap className="w-5 h-5 shrink-0" />
                  <span className="text-left">Works with localhost workspaces</span>
                </div>
                <div className="flex items-center gap-3 text-[var(--text-muted)] bg-[var(--bg-tertiary)] p-3 rounded-lg">
                  <Server className="w-5 h-5 shrink-0" />
                  <span className="text-left">Supports Next.js development servers</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Direct Embed Iframe (for local servers) - No sandbox for full functionality */}
        {useDirectEmbed && url && !isLoading && !loadError && (
          <iframe
            key={iframeKey}
            src={url}
            className="w-full h-full border-0"
            title="Preview"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            // No sandbox for local URLs - allows full Next.js functionality
          />
        )}

        {/* Proxied Content Iframe (for external URLs) */}
        {!useDirectEmbed && html && !loadError && (
          <iframe
            key={iframeKey}
            srcDoc={html}
            className="w-full h-full border-0"
            title="Preview"
            sandbox={getSandboxAttrs()}
            onLoad={handleIframeLoad}
            onError={handleIframeError}
          />
        )}
      </div>
    </div>
  );
}
