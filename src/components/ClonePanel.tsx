'use client';

import React, { useState, useEffect } from 'react';
import {
  Scan,
  Copy,
  Download,
  FileCode,
  Folder,
  Github,
  Package,
  Server,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileArchive,
  Container,
  Globe,
  Zap,
} from 'lucide-react';

interface ScanResult {
  url: string;
  title: string;
  description: string;
  frameworks: string[];
  dependencies: { name: string; version: string; type: string }[];
  assets: {
    scripts: number;
    styles: number;
    images: number;
    fonts: number;
    icons: number;
    other: number;
  };
  meta: {
    author?: string;
    keywords?: string;
    ogImage?: string;
  };
  nodeVersion: string;
  buildSize: string;
  timestamp: number;
}

interface BuildConfig {
  projectName: string;
  nodeVersion: string;
  framework: 'static' | 'nextjs' | 'react' | 'vue';
  includeDocker: boolean;
  includeGithubActions: boolean;
}

interface ClonePanelProps {
  url: string;
  html: string;
  isConnected: boolean;
  isWorkspace: boolean;
}

export function ClonePanel({ url, html, isConnected, isWorkspace }: ClonePanelProps) {
  const [activeTab, setActiveTab] = useState<'scan' | 'clone' | 'build' | 'deploy'>('scan');
  const [isLoading, setIsLoading] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [clonedFiles, setClonedFiles] = useState<{ path: string; content: string }[]>([]);
  const [buildFiles, setBuildFiles] = useState<{ path: string; content: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [buildConfig, setBuildConfig] = useState<BuildConfig>({
    projectName: 'my-project',
    nodeVersion: '18.19.0',
    framework: 'static',
    includeDocker: true,
    includeGithubActions: true,
  });

  const [githubToken, setGithubToken] = useState('');
  const [deployResult, setDeployResult] = useState<{
    success: boolean;
    repoUrl?: string;
    pagesUrl?: string;
    message?: string;
    instructions?: any;
  } | null>(null);

  const nodeVersions = [
    '14.21.3',
    '16.20.2',
    '17.9.1',
    '18.19.0',
    '20.11.0',
    '21.6.2',
  ];

  // Auto-generate project name from URL
  useEffect(() => {
    if (url) {
      try {
        const urlObj = new URL(url);
        const name = urlObj.hostname
          .replace(/\./g, '-')
          .replace(/[^a-z0-9-]/gi, '')
          .toLowerCase();
        setBuildConfig(prev => ({ ...prev, projectName: name }));
      } catch {}
    }
  }, [url]);

  // Scan target
  const handleScan = async () => {
    if (!url) return;
    
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await fetch(`/api/scan?url=${encodeURIComponent(url)}`);
      const data = await response.json();
      
      if (response.ok) {
        setScanResult(data);
        setSuccess('Scan completed successfully!');
        
        // Auto-detect framework
        if (data.frameworks?.includes('Next.js')) {
          setBuildConfig(prev => ({ ...prev, framework: 'nextjs' }));
        } else if (data.frameworks?.includes('React')) {
          setBuildConfig(prev => ({ ...prev, framework: 'react' }));
        } else if (data.frameworks?.includes('Vue.js')) {
          setBuildConfig(prev => ({ ...prev, framework: 'vue' }));
        }
      } else {
        setError(data.error || 'Scan failed');
      }
    } catch (e) {
      setError('Failed to scan target');
    } finally {
      setIsLoading(false);
    }
  };

  // Clone target
  const handleClone = async () => {
    if (!url) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, includeAssets: true }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setClonedFiles(data.files);
        setSuccess(`Cloned ${data.files.length} files successfully!`);
      } else {
        setError(data.error || 'Clone failed');
      }
    } catch (e) {
      setError('Failed to clone target');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate build
  const handleBuild = async () => {
    if (!html && clonedFiles.length === 0) {
      setError('No content to build. Please scan or clone first.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const mainHtml = clonedFiles.find(f => f.path === 'index.html')?.content || html;
      
      const response = await fetch('/api/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          html: mainHtml,
          config: buildConfig,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setBuildFiles(data.files);
        setSuccess(`Generated ${data.files.length} project files!`);
      } else {
        setError(data.error || 'Build failed');
      }
    } catch (e) {
      setError('Failed to generate build');
    } finally {
      setIsLoading(false);
    }
  };

  // Download as ZIP
  const handleDownloadZip = async () => {
    const files = buildFiles.length > 0 ? buildFiles : clonedFiles;
    if (files.length === 0) {
      setError('No files to download. Please build first.');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files,
          projectName: buildConfig.projectName,
          type: 'zip',
        }),
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${buildConfig.projectName}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        setSuccess('ZIP downloaded successfully!');
      } else {
        const data = await response.json();
        setError(data.error || 'Download failed');
      }
    } catch (e) {
      setError('Failed to download ZIP');
    } finally {
      setIsLoading(false);
    }
  };

  // Download as single HTML
  const handleDownloadHtml = async () => {
    const mainHtml = clonedFiles.find(f => f.path === 'index.html')?.content || 
                     buildFiles.find(f => f.path === 'index.html')?.content || 
                     html;
    
    if (!mainHtml) {
      setError('No HTML content to download.');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: [{ path: 'index.html', content: mainHtml }],
          projectName: buildConfig.projectName,
          type: 'html',
        }),
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${buildConfig.projectName}.html`;
        a.click();
        URL.revokeObjectURL(url);
        setSuccess('HTML downloaded successfully!');
      } else {
        const data = await response.json();
        setError(data.error || 'Download failed');
      }
    } catch (e) {
      setError('Failed to download HTML');
    } finally {
      setIsLoading(false);
    }
  };

  // Deploy to GitHub
  const handleDeploy = async () => {
    const files = buildFiles.length > 0 ? buildFiles : clonedFiles;
    if (files.length === 0) {
      setError('No files to deploy. Please build first.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setDeployResult(null);
    
    try {
      const response = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files,
          repoName: buildConfig.projectName,
          githubToken: githubToken || undefined,
          description: `Cloned from ${url}`,
        }),
      });
      
      const data = await response.json();
      setDeployResult(data);
      
      if (data.success) {
        setSuccess(data.message || 'Deployed successfully!');
      } else if (data.requiresAuth) {
        // Show auth instructions
      } else {
        setError(data.error || 'Deploy failed');
      }
    } catch (e) {
      setError('Failed to deploy');
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'scan', label: 'Scan', icon: Scan },
    { id: 'clone', label: 'Clone', icon: Copy },
    { id: 'build', label: 'Build', icon: Package },
    { id: 'deploy', label: 'Deploy', icon: Github },
  ];

  return (
    <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
      {/* Tab Navigation */}
      <div className="flex items-center border-b border-[var(--border-color)]">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
        
        {/* Status Messages */}
        {isLoading && (
          <div className="ml-auto flex items-center gap-2 px-4 text-[var(--accent-primary)]">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Processing...</span>
          </div>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 text-sm">
          <XCircle className="w-4 h-4" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto opacity-50 hover:opacity-100">×</button>
        </div>
      )}
      
      {success && (
        <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-400 text-sm">
          <CheckCircle className="w-4 h-4" />
          {success}
          <button onClick={() => setSuccess(null)} className="ml-auto opacity-50 hover:opacity-100">×</button>
        </div>
      )}

      {/* Tab Content */}
      <div className="p-4">
        {/* Scan Tab */}
        {activeTab === 'scan' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <button
                onClick={handleScan}
                disabled={isLoading || !url}
                className="btn-mind flex items-center gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
                Scan Target
              </button>
              
              {!isConnected && (
                <span className="text-sm text-[var(--text-muted)]">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  Initialize access first to scan
                </span>
              )}
            </div>

            {scanResult && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                {/* Title */}
                <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
                  <div className="text-xs text-[var(--text-muted)] mb-1">Title</div>
                  <div className="text-sm font-medium truncate">{scanResult.title || 'N/A'}</div>
                </div>
                
                {/* Frameworks */}
                <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
                  <div className="text-xs text-[var(--text-muted)] mb-1">Frameworks</div>
                  <div className="flex flex-wrap gap-1">
                    {scanResult.frameworks.length > 0 ? (
                      scanResult.frameworks.map(fw => (
                        <span key={fw} className="px-2 py-0.5 bg-[var(--bg-primary)] rounded text-xs text-[var(--accent-primary)]">
                          {fw}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-[var(--text-muted)]">None detected</span>
                    )}
                  </div>
                </div>
                
                {/* Assets */}
                <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
                  <div className="text-xs text-[var(--text-muted)] mb-1">Assets</div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>JS: {scanResult.assets.scripts}</div>
                    <div>CSS: {scanResult.assets.styles}</div>
                    <div>IMG: {scanResult.assets.images}</div>
                  </div>
                </div>
                
                {/* Build Size */}
                <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
                  <div className="text-xs text-[var(--text-muted)] mb-1">Est. Size</div>
                  <div className="text-sm font-medium">{scanResult.buildSize}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Clone Tab */}
        {activeTab === 'clone' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <button
                onClick={handleClone}
                disabled={isLoading || !url}
                className="btn-mind flex items-center gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                Clone Target
              </button>
            </div>

            {clonedFiles.length > 0 && (
              <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">
                    <Folder className="w-4 h-4 inline mr-2" />
                    Cloned Files ({clonedFiles.length})
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {((clonedFiles.reduce((a, f) => a + f.content.length, 0)) / 1024).toFixed(1)} KB
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-32 overflow-y-auto">
                  {clonedFiles.slice(0, 20).map((file, i) => (
                    <div key={i} className="text-xs bg-[var(--bg-primary)] rounded px-2 py-1 truncate">
                      <FileCode className="w-3 h-3 inline mr-1" />
                      {file.path}
                    </div>
                  ))}
                  {clonedFiles.length > 20 && (
                    <div className="text-xs text-[var(--text-muted)]">
                      +{clonedFiles.length - 20} more files
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Build Tab */}
        {activeTab === 'build' && (
          <div className="space-y-4">
            {/* Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Project Name */}
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Project Name</label>
                <input
                  type="text"
                  value={buildConfig.projectName}
                  onChange={(e) => setBuildConfig(prev => ({ ...prev, projectName: e.target.value }))}
                  className="input-mind w-full text-sm py-2"
                  placeholder="my-project"
                />
              </div>
              
              {/* Node Version */}
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Node.js Version</label>
                <select
                  value={buildConfig.nodeVersion}
                  onChange={(e) => setBuildConfig(prev => ({ ...prev, nodeVersion: e.target.value }))}
                  className="input-mind w-full text-sm py-2"
                >
                  {nodeVersions.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              
              {/* Framework */}
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Framework</label>
                <select
                  value={buildConfig.framework}
                  onChange={(e) => setBuildConfig(prev => ({ ...prev, framework: e.target.value as BuildConfig['framework'] }))}
                  className="input-mind w-full text-sm py-2"
                >
                  <option value="static">Static HTML</option>
                  <option value="nextjs">Next.js</option>
                  <option value="react">React + Vite</option>
                  <option value="vue">Vue + Vite</option>
                </select>
              </div>
            </div>

            {/* Advanced Options */}
            <div>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                Advanced Options
              </button>
              
              {showAdvanced && (
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={buildConfig.includeDocker}
                      onChange={(e) => setBuildConfig(prev => ({ ...prev, includeDocker: e.target.checked }))}
                      className="accent-[var(--accent-primary)]"
                    />
                    <Container className="w-4 h-4" />
                    Include Docker
                  </label>
                  
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={buildConfig.includeGithubActions}
                      onChange={(e) => setBuildConfig(prev => ({ ...prev, includeGithubActions: e.target.checked }))}
                      className="accent-[var(--accent-primary)]"
                    />
                    <Github className="w-4 h-4" />
                    GitHub Actions
                  </label>
                </div>
              )}
            </div>

            {/* Build Actions */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleBuild}
                disabled={isLoading}
                className="btn-mind flex items-center gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                Generate Build
              </button>
              
              {buildFiles.length > 0 && (
                <>
                  <button
                    onClick={handleDownloadZip}
                    disabled={isLoading}
                    className="btn-ghost flex items-center gap-2"
                  >
                    <FileArchive className="w-4 h-4" />
                    Download ZIP
                  </button>
                  
                  <button
                    onClick={handleDownloadHtml}
                    disabled={isLoading}
                    className="btn-ghost flex items-center gap-2"
                  >
                    <FileCode className="w-4 h-4" />
                    Download HTML
                  </button>
                </>
              )}
            </div>

            {buildFiles.length > 0 && (
              <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">
                    <Package className="w-4 h-4 inline mr-2" />
                    Generated Files ({buildFiles.length})
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-32 overflow-y-auto">
                  {buildFiles.map((file, i) => (
                    <div key={i} className="text-xs bg-[var(--bg-primary)] rounded px-2 py-1 truncate">
                      <FileCode className="w-3 h-3 inline mr-1" />
                      {file.path}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Deploy Tab */}
        {activeTab === 'deploy' && (
          <div className="space-y-4">
            {/* GitHub Token */}
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">
                GitHub Token (optional - for automatic deploy)
              </label>
              <input
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                className="input-mind w-full text-sm py-2"
                placeholder="ghp_xxxxxxxxxxxx"
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Get your token from GitHub Settings → Developer settings → Personal access tokens
              </p>
            </div>

            {/* Deploy Actions */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleDeploy}
                disabled={isLoading || (buildFiles.length === 0 && clonedFiles.length === 0)}
                className="btn-mind flex items-center gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />}
                Deploy to GitHub
              </button>
            </div>

            {/* Deploy Result */}
            {deployResult && (
              <div className={`rounded-lg p-4 ${deployResult.success ? 'bg-green-500/10' : 'bg-[var(--bg-tertiary)]'}`}>
                {deployResult.success ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      <span className="font-medium">Deployed Successfully!</span>
                    </div>
                    {deployResult.repoUrl && (
                      <a
                        href={deployResult.repoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-[var(--accent-primary)] hover:underline"
                      >
                        <Github className="w-4 h-4" />
                        {deployResult.repoUrl}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {deployResult.pagesUrl && (
                      <a
                        href={deployResult.pagesUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-[var(--accent-primary)] hover:underline"
                      >
                        <Globe className="w-4 h-4" />
                        {deployResult.pagesUrl}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ) : deployResult.instructions ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-yellow-400">
                      <AlertCircle className="w-4 h-4" />
                      <span className="font-medium">Manual Deploy Required</span>
                    </div>
                    <pre className="text-xs bg-[var(--bg-primary)] p-3 rounded overflow-x-auto whitespace-pre-wrap">
                      {deployResult.instructions.commands || deployResult.instructions.manualSteps?.join('\n')}
                    </pre>
                  </div>
                ) : (
                  <div className="text-red-400">{deployResult.message || 'Deploy failed'}</div>
                )}
              </div>
            )}

            {/* Quick Tips */}
            <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
              <div className="text-xs text-[var(--text-muted)] space-y-2">
                <div className="font-medium">💡 Quick Tips:</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>Without a token, you'll get manual deploy instructions</li>
                  <li>With a token, we'll create the repo and push files automatically</li>
                  <li>GitHub Pages will be enabled automatically for static sites</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
