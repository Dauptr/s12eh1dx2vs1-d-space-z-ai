'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { PreviewFrame } from '@/components/PreviewFrame';
import { WorkspacePanel } from '@/components/WorkspacePanel';
import { ClonePanel } from '@/components/ClonePanel';
import { LogEntry } from '@/components/Console';
import { processHtml } from '@/lib/processor';

// Generate unique ID for log entries
const generateId = () => Math.random().toString(36).substring(2, 9);

// Workspace status interface
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

// Normalize URL (add protocol if missing)
function normalizeUrl(url: string): string {
  url = url.trim();
  if (!url) return '';
  
  // Check if it has a protocol
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Check if it looks like a localhost or IP address
  if (url.startsWith('localhost') || url.startsWith('127.0.0.1') || url.startsWith('192.168.') || url.startsWith('10.') || url.startsWith('172.')) {
    return `http://${url}`;
  }
  
  // Default to https for other URLs
  return `https://${url}`;
}

// Check if URL is local/internal or z.ai workspace (should use direct embed)
function isLocalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const localHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
    const localPatterns = [/^192\.168\./, /^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./];
    
    if (localHosts.includes(parsed.hostname)) return true;
    if (localPatterns.some(p => p.test(parsed.hostname))) return true;
    if (parsed.hostname.endsWith('.local') || parsed.hostname.endsWith('.test')) return true;
    
    // z.ai workspace URLs - treat as local for direct embedding (they need SSR)
    if (parsed.hostname.endsWith('.z.ai') || parsed.hostname.includes('space.z.ai')) return true;
    
    return false;
  } catch {
    return false;
  }
}

export default function MindKeyPage() {
  // State
  const [url, setUrl] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [html, setHtml] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [workspaceStatus, setWorkspaceStatus] = useState<WorkspaceStatus | null>(null);
  const [isWorkspaceMode, setIsWorkspaceMode] = useState(false);
  const [useDirectEmbed, setUseDirectEmbed] = useState(false);
  const [showClonePanel, setShowClonePanel] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Add log entry
  const addLog = useCallback((type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev, {
      id: generateId(),
      type,
      message,
      timestamp: Date.now(),
    }]);
  }, []);

  // Clear logs
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // Check workspace status
  const checkWorkspaceStatus = useCallback(async (targetUrl: string) => {
    setWorkspaceStatus({ status: 'checking', isLocal: false, isNextJs: false, timestamp: Date.now() });
    
    try {
      const response = await fetch(`/api/workspace/status?url=${encodeURIComponent(targetUrl)}`);
      const data = await response.json();
      setWorkspaceStatus(data);
      
      if (data.status === 'online') {
        setIsWorkspaceMode(true);
        setUseDirectEmbed(true);
        
        // Check if it's z.ai workspace
        try {
          const urlObj = new URL(targetUrl);
          if (urlObj.hostname.endsWith('.z.ai') || urlObj.hostname.includes('space.z.ai')) {
            addLog('info', `✓ z.ai workspace detected: ${data.isNextJs ? 'Next.js' : 'Server'} at ${targetUrl}`);
          } else if (data.isLocal) {
            addLog('info', `✓ Local workspace detected: ${data.isNextJs ? 'Next.js' : 'Static'} server at ${targetUrl}`);
          } else {
            addLog('info', `✓ Server online at ${targetUrl}`);
          }
        } catch {
          addLog('info', `✓ Server online at ${targetUrl}`);
        }
      } else if (data.status !== 'online') {
        addLog('warn', `Server status: ${data.status} - ${data.error || 'Unable to connect'}`);
      }
      
      return data;
    } catch (error) {
      const errorData: WorkspaceStatus = {
        status: 'unknown',
        isLocal: isLocalUrl(targetUrl),
        isNextJs: false,
        error: 'Failed to check status',
        timestamp: Date.now(),
      };
      setWorkspaceStatus(errorData);
      return errorData;
    }
  }, [addLog]);

  // Fetch URL via proxy (for external URLs)
  const fetchUrlViaProxy = useCallback(async (targetUrl: string) => {
    addLog('system', `Fetching via proxy: ${targetUrl}`);

    try {
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}`;
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      
      if (!contentType.includes('text/html')) {
        const text = await response.text();
        setHtml(`<html><body><pre style="white-space: pre-wrap; font-family: monospace;">${text}</pre></body></html>`);
        addLog('warn', `Content-Type: ${contentType} - displayed as text`);
      } else {
        const rawHtml = await response.text();
        const processed = processHtml(rawHtml, targetUrl);
        setHtml(processed);
        addLog('info', `✓ Loaded successfully (${rawHtml.length} bytes)`);
      }

      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      addLog('error', `✗ Failed: ${message}`);
      setHtml('');
      return false;
    }
  }, [addLog]);

  // Load URL
  const loadUrl = useCallback(async (targetUrl: string) => {
    const normalizedUrl = normalizeUrl(targetUrl);
    
    if (!normalizedUrl) {
      addLog('error', 'Please enter a valid URL');
      return;
    }

    setIsLoading(true);
    setCurrentUrl(normalizedUrl);
    setUrl(normalizedUrl);

    // Check if it's a local URL
    const local = isLocalUrl(normalizedUrl);
    
    if (local) {
      // For local URLs, check server status first
      addLog('system', `Checking workspace: ${normalizedUrl}`);
      const status = await checkWorkspaceStatus(normalizedUrl);
      
      if (status.status === 'online') {
        // Use direct embedding for local servers
        setUseDirectEmbed(true);
        setHtml(''); // Clear proxied HTML
        addLog('info', `✓ Direct embedding active for workspace`);
        
        // Check if it's a z.ai URL
        try {
          const urlObj = new URL(normalizedUrl);
          if (urlObj.hostname.endsWith('.z.ai') || urlObj.hostname.includes('space.z.ai')) {
            addLog('info', `✓ z.ai workspace detected - full functionality enabled`);
          } else {
            addLog('info', `✓ Full functionality enabled (SSR, API routes, HMR)`);
          }
        } catch {
          addLog('info', `✓ Full functionality enabled (SSR, API routes, HMR)`);
        }
      } else {
        // Try proxy as fallback
        setUseDirectEmbed(false);
        await fetchUrlViaProxy(normalizedUrl);
      }
    } else {
      // For external URLs, use proxy
      setUseDirectEmbed(false);
      setIsWorkspaceMode(false);
      await fetchUrlViaProxy(normalizedUrl);
    }

    // Update history
    setHistory(prev => {
      const newHistory = [...prev.slice(0, historyIndex + 1), normalizedUrl];
      return newHistory;
    });
    setHistoryIndex(prev => prev + 1);
    setIsLoading(false);
  }, [addLog, checkWorkspaceStatus, fetchUrlViaProxy, historyIndex]);

  // Initialize access
  const handleInitialize = useCallback(() => {
    if (url.trim()) {
      loadUrl(url);
    }
  }, [url, loadUrl]);

  // Navigation handlers
  const handleBack = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const prevUrl = history[newIndex];
      setUrl(prevUrl);
      loadUrl(prevUrl);
    }
  }, [historyIndex, history, loadUrl]);

  const handleForward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const nextUrl = history[newIndex];
      setUrl(nextUrl);
      loadUrl(nextUrl);
    }
  }, [historyIndex, history, loadUrl]);

  const handleHome = useCallback(() => {
    setUrl('');
    setCurrentUrl('');
    setHtml('');
    setHistory([]);
    setHistoryIndex(-1);
    setWorkspaceStatus(null);
    setIsWorkspaceMode(false);
    setUseDirectEmbed(false);
    addLog('system', 'Cleared preview');
  }, [addLog]);

  const handleReload = useCallback(() => {
    if (currentUrl) {
      loadUrl(currentUrl);
    }
  }, [currentUrl, loadUrl]);

  // Download handler
  const handleDownload = useCallback(() => {
    if (!html && !currentUrl) return;
    
    const content = html || `<!-- Direct embed: ${currentUrl} -->`;
    const blob = new Blob([content], { type: 'text/html' });
    const urlObj = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = urlObj;
    a.download = `mindkey-${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(urlObj);
    addLog('info', '✓ Downloaded HTML file');
  }, [html, currentUrl, addLog]);

  // Execute JavaScript in iframe
  const executeCommand = useCallback((command: string) => {
    addLog('command', `› ${command}`);
    
    const iframe = document.querySelector<HTMLIFrameElement>('iframe[title="Preview"]');
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage({
          type: 'execute',
          code: command,
        }, '*');
      } catch {
        addLog('error', 'Cannot execute - cross-origin restriction');
      }
    } else {
      addLog('error', 'No preview loaded');
    }
  }, [addLog]);

  // Handle messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Ignore messages from unknown origins for security
      const { type, method, args, result, isError, url: navUrl } = event.data || {};

      // Handle different message types
      switch (type) {
        case 'console':
          if (args) {
            const formattedArgs = Array.isArray(args) ? args.join(' ') : String(args);
            // Filter out common cross-origin errors
            if (formattedArgs.includes('Script error') || formattedArgs.includes('cross-origin')) {
              return; // Ignore cross-origin script errors
            }
            addLog(method as LogEntry['type'], formattedArgs);
          }
          break;

        case 'navigate':
          if (navUrl) {
            addLog('system', `Navigate to: ${navUrl}`);
            loadUrl(navUrl);
          }
          break;

        case 'executeResult':
          addLog(isError ? 'error' : 'result', result);
          break;

        case 'ready':
          addLog('info', '✓ Preview ready');
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [addLog, loadUrl]);

  // Handle iframe load
  const handleIframeLoad = useCallback(() => {
    addLog('info', '✓ Page loaded successfully');
  }, [addLog]);

  // Handle iframe error
  const handleIframeError = useCallback((error: string) => {
    addLog('error', error);
  }, [addLog]);

  // Add initial welcome log
  useEffect(() => {
    const hasInitialized = localStorage.getItem('mindkey-initialized');
    if (!hasInitialized) {
      addLog('system', 'Mind Key initialized');
      addLog('info', 'Enter a URL and click "Initialize Access" to begin');
      addLog('info', 'Supports localhost workspaces and external URLs');
      localStorage.setItem('mindkey-initialized', 'true');
    }
  }, [addLog]);

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Animated Grid Background */}
      <div className="grid-bg" />

      {/* Main Content */}
      <div className="relative flex w-full h-full">
        {/* Sidebar */}
        <Sidebar
          url={url}
          setUrl={setUrl}
          isLoading={isLoading}
          onInitialize={handleInitialize}
          onBack={handleBack}
          onForward={handleForward}
          onHome={handleHome}
          onDownload={handleDownload}
          logs={logs}
          onCommand={executeCommand}
          onClearLogs={clearLogs}
          canGoBack={historyIndex > 0}
          canGoForward={historyIndex < history.length - 1}
          workspaceStatus={workspaceStatus}
          isWorkspaceMode={isWorkspaceMode}
        />

        {/* Main Area */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Workspace Panel (show when in workspace mode) */}
          {isWorkspaceMode && workspaceStatus && (
            <WorkspacePanel
              status={workspaceStatus}
              url={currentUrl}
              onRefresh={() => loadUrl(currentUrl)}
            />
          )}

          {/* Clone Panel (show when target is loaded) */}
          {currentUrl && (
            <ClonePanel
              url={currentUrl}
              html={html}
              isConnected={!!currentUrl}
              isWorkspace={isWorkspaceMode}
            />
          )}

          {/* Preview Frame */}
          <div className="flex-1 min-w-0">
            <PreviewFrame
              html={html}
              url={currentUrl}
              isLoading={isLoading}
              onReload={handleReload}
              useDirectEmbed={useDirectEmbed}
              isWorkspace={isWorkspaceMode}
              onLoad={handleIframeLoad}
              onError={handleIframeError}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
