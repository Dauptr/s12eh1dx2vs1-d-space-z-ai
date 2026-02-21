'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  Terminal,
  Play,
  ArrowRight,
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

interface DeployResult {
  success: boolean;
  requiresAuth?: boolean;
  repoUrl?: string;
  pagesUrl?: string;
  message?: string;
  error?: string;
  details?: string;
  owner?: string;
  repo?: string;
  filesPushed?: number;
  filesSkipped?: number;
  cliCommands?: string;
  nextSteps?: string[];
  actionsUrl?: string;
  framework?: string;
  buildAndDeploy?: boolean;
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

const NODE_VERSIONS = [
  '14.21.3',
  '16.20.2',
  '17.9.1',
  '18.19.0',
  '20.11.0',
  '21.6.2',
];

// Helper function to generate CLI commands
function generateCliCommands(projectName: string, framework: string = 'static'): string {
  const buildCmd = framework === 'static' ? '' : 'npm run build';
  
  return `# === MIND KEY DEPLOY COMMANDS ===

# 1. Download and extract
unzip ${projectName}.zip
cd ${projectName}

# 2. Install dependencies
npm install

# 3. Build for production
${buildCmd || '# No build needed for static site'}

# 4. Initialize git
git init
git branch -M main
git add .
git commit -m "Deploy from Mind Key"

# 5. Push to GitHub
git remote add origin https://github.com/YOUR_USERNAME/${projectName}.git
git push -u origin main --force

# 6. Enable GitHub Pages
# Go to: Settings > Pages > Source: main branch

# Your site: https://YOUR_USERNAME.github.io/${projectName}/`.trim();
}

export function ClonePanel({ url, html, isConnected, isWorkspace }: ClonePanelProps) {
  const [activeTab, setActiveTab] = useState<'scan' | 'clone' | 'build' | 'deploy' | 'terminal'>('scan');
  const [isLoading, setIsLoading] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [clonedFiles, setClonedFiles] = useState<{ path: string; content: string }[]>([]);
  const [buildFiles, setBuildFiles] = useState<{ path: string; content: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [githubToken, setGithubToken] = useState('');
  const [targetRepo, setTargetRepo] = useState('');
  const [showCliCommands, setShowCliCommands] = useState(false);
  const [deployResult, setDeployResult] = useState<DeployResult | null>(null);
  const [buildAndDeploy, setBuildAndDeploy] = useState(true);
  
  // Terminal state
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [packageManager, setPackageManager] = useState<'bun' | 'npm'>('bun');

  const [buildConfig, setBuildConfig] = useState<BuildConfig>({
    projectName: 'my-project',
    nodeVersion: '18.19.0',
    framework: 'static',
    includeDocker: true,
    includeGithubActions: true,
  });

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
      } catch { /* ignore */ }
    }
  }, [url]);

  // Handlers
  const handleScan = useCallback(async () => {
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
    } catch {
      setError('Failed to scan target');
    } finally {
      setIsLoading(false);
    }
  }, [url]);

  const handleClone = useCallback(async () => {
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
    } catch {
      setError('Failed to clone target');
    } finally {
      setIsLoading(false);
    }
  }, [url]);

  const handleBuild = useCallback(async () => {
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
        body: JSON.stringify({ url, html: mainHtml, config: buildConfig }),
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        setBuildFiles(data.files);
        setSuccess(`Generated ${data.files.length} project files!`);
      } else {
        setError(data.error || 'Build failed');
      }
    } catch {
      setError('Failed to generate build');
    } finally {
      setIsLoading(false);
    }
  }, [html, clonedFiles, url, buildConfig]);

  const handleDownloadZip = useCallback(async () => {
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
        body: JSON.stringify({ files, projectName: buildConfig.projectName, type: 'zip' }),
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${buildConfig.projectName}.zip`;
        a.click();
        URL.revokeObjectURL(blobUrl);
        setSuccess('ZIP downloaded successfully!');
      } else {
        const data = await response.json();
        setError(data.error || 'Download failed');
      }
    } catch {
      setError('Failed to download ZIP');
    } finally {
      setIsLoading(false);
    }
  }, [buildFiles, clonedFiles, buildConfig.projectName]);

  const handleDownloadHtml = useCallback(async () => {
    const mainHtml = clonedFiles.find(f => f.path === 'index.html')?.content || 
                     buildFiles.find(f => f.path === 'index.html')?.content || html;
    if (!mainHtml) {
      setError('No HTML content to download.');
      return;
    }
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: [{ path: 'index.html', content: mainHtml }], projectName: buildConfig.projectName, type: 'html' }),
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${buildConfig.projectName}.html`;
        a.click();
        URL.revokeObjectURL(blobUrl);
        setSuccess('HTML downloaded successfully!');
      } else {
        const data = await response.json();
        setError(data.error || 'Download failed');
      }
    } catch {
      setError('Failed to download HTML');
    } finally {
      setIsLoading(false);
    }
  }, [clonedFiles, buildFiles, html, buildConfig.projectName]);

  const handleDeploy = useCallback(async () => {
    const files = buildFiles.length > 0 ? buildFiles : clonedFiles;
    if (files.length === 0) {
      setError('No files to deploy. Please build first.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setDeployResult(null);
    
    try {
      const response = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files,
          repoName: buildConfig.projectName,
          githubToken: githubToken || undefined,
          targetRepo: targetRepo || undefined,
          description: `Cloned from ${url}`,
          buildAndDeploy: buildAndDeploy,
          framework: buildConfig.framework,
        }),
      });
      const data = await response.json();
      setDeployResult(data);
      
      if (data.success === true) {
        setSuccess(data.message || 'Deployed successfully!');
      } else if (data.requiresAuth) {
        setError('GitHub token required for automatic deployment');
        setShowCliCommands(true);
      } else {
        setError(data.error || 'Deploy failed');
        if (data.cliCommands) setShowCliCommands(true);
      }
    } catch {
      setError('Failed to deploy');
    } finally {
      setIsLoading(false);
    }
  }, [buildFiles, clonedFiles, buildConfig.projectName, buildConfig.framework, githubToken, targetRepo, url, buildAndDeploy]);

  const handleCopyCliCommands = useCallback(() => {
    const commands = deployResult?.cliCommands || generateCliCommands(buildConfig.projectName, buildConfig.framework);
    navigator.clipboard.writeText(commands);
    setSuccess('CLI commands copied to clipboard!');
  }, [deployResult, buildConfig.projectName, buildConfig.framework]);

  // Get current files
  const currentFiles = buildFiles.length > 0 ? buildFiles : clonedFiles;

  // Fetch package manager info on mount
  useEffect(() => {
    fetch('/api/terminal')
      .then(res => res.json())
      .then(data => {
        if (data.projectInfo?.packageManager) {
          setPackageManager(data.projectInfo.packageManager);
        }
      })
      .catch(() => {});
  }, []);

  // Terminal command executor
  const runCommand = useCallback(async (command: 'install' | 'dev' | 'build' | 'start') => {
    setIsRunning(true);
    const timestamp = new Date().toLocaleTimeString();
    const cmdStr = command === 'install' 
      ? `${packageManager} install` 
      : `${packageManager} run ${command}`;
    setTerminalOutput(prev => [...prev, `[${timestamp}] Running: ${cmdStr}...`]);
    
    try {
      const response = await fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      const data = await response.json();
      
      if (data.packageManager) {
        setPackageManager(data.packageManager);
      }
      
      if (data.success) {
        const lines = data.output.split('\n');
        setTerminalOutput(prev => [...prev, ...lines.map((l: string) => `  ${l}`)]);
        setTerminalOutput(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✅ Command completed`]);
      } else {
        setTerminalOutput(prev => [...prev, `  ❌ Error: ${data.error}`]);
        if (data.suggestion) {
          setTerminalOutput(prev => [...prev, `  💡 ${data.suggestion}`]);
        }
      }
    } catch (err) {
      setTerminalOutput(prev => [...prev, `  ❌ Failed to execute command`]);
    } finally {
      setIsRunning(false);
    }
  }, [packageManager]);
  
  const clearTerminal = useCallback(() => {
    setTerminalOutput([]);
  }, []);

  // Render tab button with icon - using explicit components
  const renderTabButton = (tabId: 'scan' | 'clone' | 'build' | 'deploy' | 'terminal', label: string) => {
    let Icon: React.ComponentType<{ className?: string }>;
    switch (tabId) {
      case 'scan': Icon = Scan; break;
      case 'clone': Icon = Copy; break;
      case 'build': Icon = Package; break;
      case 'deploy': Icon = Github; break;
      case 'terminal': Icon = Terminal; break;
    }
    
    return (
      <button
        onClick={() => setActiveTab(tabId)}
        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
          activeTab === tabId
            ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
            : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
        }`}
      >
        <Icon className="w-4 h-4" />
        {label}
      </button>
    );
  };

  return (
    <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
      {/* Tab Navigation */}
      <div className="flex items-center border-b border-[var(--border-color)]">
        {renderTabButton('scan', 'Scan')}
        {renderTabButton('clone', 'Clone')}
        {renderTabButton('build', 'Build')}
        {renderTabButton('deploy', 'Deploy')}
        {renderTabButton('terminal', 'Terminal')}
        
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
              <button onClick={handleScan} disabled={isLoading || !url} className="btn-mind flex items-center gap-2">
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
                <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
                  <div className="text-xs text-[var(--text-muted)] mb-1">Title</div>
                  <div className="text-sm font-medium truncate">{scanResult.title || 'N/A'}</div>
                </div>
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
                <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
                  <div className="text-xs text-[var(--text-muted)] mb-1">Assets</div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>JS: {scanResult.assets.scripts}</div>
                    <div>CSS: {scanResult.assets.styles}</div>
                    <div>IMG: {scanResult.assets.images}</div>
                  </div>
                </div>
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
            <button onClick={handleClone} disabled={isLoading || !url} className="btn-mind flex items-center gap-2">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
              Clone Target
            </button>

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
                    <div className="text-xs text-[var(--text-muted)]">+{clonedFiles.length - 20} more</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Build Tab */}
        {activeTab === 'build' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Node.js Version</label>
                <select
                  value={buildConfig.nodeVersion}
                  onChange={(e) => setBuildConfig(prev => ({ ...prev, nodeVersion: e.target.value }))}
                  className="input-mind w-full text-sm py-2"
                >
                  {NODE_VERSIONS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
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

            <div>
              <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">
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

            <div className="flex flex-wrap gap-2">
              <button onClick={handleBuild} disabled={isLoading} className="btn-mind flex items-center gap-2">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                Generate Build
              </button>
              {currentFiles.length > 0 && (
                <>
                  <button onClick={handleDownloadZip} disabled={isLoading} className="btn-ghost flex items-center gap-2">
                    <FileArchive className="w-4 h-4" />
                    Download ZIP
                  </button>
                  <button onClick={handleDownloadHtml} disabled={isLoading} className="btn-ghost flex items-center gap-2">
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

        {/* Terminal Tab */}
        {activeTab === 'terminal' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-[var(--text-muted)]">Package Manager:</span>
              <span className="text-xs px-2 py-0.5 bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] rounded">{packageManager}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => runCommand('install')} 
                disabled={isRunning}
                className="btn-mind flex items-center gap-2"
              >
                {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                {packageManager} install
              </button>
              <button 
                onClick={() => runCommand('dev')} 
                disabled={isRunning}
                className="btn-ghost flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                {packageManager} run dev
              </button>
              <button 
                onClick={() => runCommand('build')} 
                disabled={isRunning}
                className="btn-ghost flex items-center gap-2"
              >
                <Package className="w-4 h-4" />
                {packageManager} run build
              </button>
              <button 
                onClick={() => runCommand('start')} 
                disabled={isRunning}
                className="btn-ghost flex items-center gap-2"
              >
                <Server className="w-4 h-4" />
                {packageManager} start
              </button>
              <button 
                onClick={clearTerminal}
                className="btn-ghost text-xs"
              >
                Clear
              </button>
            </div>
            
            {/* Quick Deploy Section */}
            <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 text-purple-400 font-medium mb-2">
                <Zap className="w-4 h-4" />
                Quick Deploy Pipeline
              </div>
              <div className="flex items-center gap-2 text-sm">
                <button 
                  onClick={async () => {
                    await runCommand('build');
                  }}
                  disabled={isRunning}
                  className="btn-mind text-xs"
                >
                  Build Project
                </button>
                <span className="text-[var(--text-muted)]">then</span>
                <button 
                  onClick={() => setActiveTab('deploy')}
                  className="btn-ghost text-xs"
                >
                  Deploy to GitHub
                </button>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-2">
                💡 Dependencies are pre-installed. Memory-intensive commands may timeout.
              </p>
            </div>
            
            {/* Terminal Output */}
            <div className="bg-[var(--bg-primary)] rounded-lg p-4 font-mono text-sm">
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-2 border-b border-[var(--border-color)] pb-2">
                <Terminal className="w-4 h-4" />
                Console Output
              </div>
              <div className="max-h-64 overflow-y-auto space-y-0.5">
                {terminalOutput.length === 0 ? (
                  <div className="text-[var(--text-muted)] text-xs">
                    Click a command above to start...
                  </div>
                ) : (
                  terminalOutput.map((line, i) => (
                    <div 
                      key={i} 
                      className={`text-xs whitespace-pre-wrap ${
                        line.includes('❌') ? 'text-red-400' : 
                        line.includes('✅') ? 'text-green-400' : 
                        line.startsWith('[') ? 'text-yellow-400' : 
                        'text-[var(--text-secondary)]'
                      }`}
                    >
                      {line}
                    </div>
                  ))
                )}
                {isRunning && (
                  <div className="text-yellow-400 text-xs animate-pulse">
                    Running...
                  </div>
                )}
              </div>
            </div>
            
            {/* GitHub Deployment Link */}
            {deployResult?.pagesUrl && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-green-400 font-medium flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      Live Deployment
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Your site is live at:
                    </p>
                  </div>
                  <a 
                    href={deployResult.pagesUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    View Live Site
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                <code className="text-xs bg-[var(--bg-primary)] px-2 py-1 rounded mt-2 block">
                  {deployResult.pagesUrl}
                </code>
              </div>
            )}
          </div>
        )}

        {/* Deploy Tab */}
        {activeTab === 'deploy' && (
          <div className="space-y-4">
            {!githubToken && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <div className="flex items-center gap-2 text-yellow-400 font-medium mb-1">
                  <AlertCircle className="w-4 h-4" />
                  No GitHub Token Provided
                </div>
                <p className="text-xs text-yellow-300/80">
                  Add your token for automatic deployment, or use CLI commands below.
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Target Repository (optional)</label>
              <input
                type="text"
                value={targetRepo}
                onChange={(e) => setTargetRepo(e.target.value)}
                className="input-mind w-full text-sm py-2"
                placeholder="username/repository (leave empty to create new)"
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Format: <code className="bg-[var(--bg-primary)] px-1 rounded">username/repo</code>
              </p>
            </div>

            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">GitHub Personal Access Token</label>
              <input
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                className="input-mind w-full text-sm py-2"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">
                <a href="https://github.com/settings/tokens/new" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-primary)] hover:underline">
                  Create a token →
                </a>
                {' '}(needs repo scope)
              </p>
            </div>

            {/* Build & Deploy Option */}
            {buildConfig.framework !== 'static' && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={buildAndDeploy}
                    onChange={(e) => setBuildAndDeploy(e.target.checked)}
                    className="accent-[var(--accent-primary)] w-4 h-4"
                  />
                  <div>
                    <span className="text-blue-400 font-medium">Build & Deploy with GitHub Actions</span>
                    <p className="text-xs text-blue-300/70 mt-0.5">
                      Automatically runs: npm install → npm run build → deploy
                    </p>
                  </div>
                </label>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button onClick={handleDeploy} disabled={isLoading || currentFiles.length === 0} className="btn-mind flex items-center gap-2">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />}
                {githubToken ? (buildAndDeploy && buildConfig.framework !== 'static' ? 'Build & Deploy' : 'Deploy to GitHub') : 'Get CLI Commands'}
              </button>
              <button onClick={() => setShowCliCommands(!showCliCommands)} className="btn-ghost flex items-center gap-2">
                <Server className="w-4 h-4" />
                {showCliCommands ? 'Hide' : 'Show'} CLI
              </button>
              {currentFiles.length === 0 && (
                <span className="text-xs text-[var(--text-muted)] flex items-center">
                  Build or clone first to enable deployment
                </span>
              )}
            </div>

            {showCliCommands && (
              <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-[var(--text-muted)]">CLI Deploy Commands</span>
                  <button onClick={handleCopyCliCommands} className="text-xs text-[var(--accent-primary)] hover:underline flex items-center gap-1">
                    <Copy className="w-3 h-3" />
                    Copy
                  </button>
                </div>
                <pre className="text-xs bg-[var(--bg-primary)] p-3 rounded overflow-x-auto whitespace-pre-wrap text-green-400 font-mono">
{deployResult?.cliCommands || generateCliCommands(buildConfig.projectName, buildConfig.framework)}
                </pre>
              </div>
            )}

            {deployResult && (
              <div className={`rounded-lg p-4 ${deployResult.success ? 'bg-green-500/10 border border-green-500/30' : deployResult.requiresAuth ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                {deployResult.success ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">✅ {deployResult.message || 'Deployed Successfully!'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {deployResult.owner && (
                        <div className="bg-[var(--bg-primary)] px-3 py-2 rounded">
                          <span className="text-[var(--text-muted)]">Repository:</span>
                          <span className="ml-1 font-medium">{deployResult.owner}/{deployResult.repo}</span>
                        </div>
                      )}
                      {deployResult.filesPushed !== undefined && (
                        <div className="bg-[var(--bg-primary)] px-3 py-2 rounded">
                          <span className="text-[var(--text-muted)]">Files pushed:</span>
                          <span className="ml-1 font-medium text-green-400">{deployResult.filesPushed}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Links */}
                    <div className="flex flex-wrap gap-2">
                      {deployResult.repoUrl && (
                        <a href={deployResult.repoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[var(--accent-primary)] hover:underline bg-[var(--bg-primary)] px-3 py-2 rounded">
                          <Github className="w-4 h-4" />
                          View Repository
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {deployResult.pagesUrl && (
                        <a href={deployResult.pagesUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-green-400 hover:underline bg-green-500/10 px-3 py-2 rounded border border-green-500/30">
                          <Globe className="w-4 h-4" />
                          View Live Site
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {deployResult.actionsUrl && (
                        <a href={deployResult.actionsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-400 hover:underline bg-blue-500/10 px-3 py-2 rounded border border-blue-500/30">
                          <Zap className="w-4 h-4" />
                          View Build Progress
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    
                    {/* Next Steps */}
                    {deployResult.nextSteps && deployResult.nextSteps.length > 0 && (
                      <div className="bg-[var(--bg-primary)] rounded p-3">
                        <div className="text-xs font-medium text-[var(--text-muted)] mb-2">📋 Next Steps:</div>
                        <ol className="list-decimal list-inside text-xs text-[var(--text-secondary)] space-y-1">
                          {deployResult.nextSteps.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                ) : deployResult.requiresAuth ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-yellow-400">
                      <AlertCircle className="w-5 h-5" />
                      <span className="font-medium">Token Required</span>
                    </div>
                    <p className="text-xs text-yellow-300">Add your GitHub token above for automatic deployment.</p>
                    <button onClick={() => setShowCliCommands(true)} className="text-xs text-yellow-400 underline">
                      Or use CLI commands →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-red-400">
                      <XCircle className="w-4 h-4" />
                      <span className="font-medium">Deployment Failed</span>
                    </div>
                    <p className="text-sm text-red-300">{deployResult.error || deployResult.message || 'Unknown error'}</p>
                    {deployResult.details && (
                      <p className="text-xs text-red-200 bg-[var(--bg-primary)] p-2 rounded">{deployResult.details}</p>
                    )}
                    <button onClick={() => setShowCliCommands(true)} className="text-xs text-[var(--accent-primary)] underline">
                      Use CLI commands instead →
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
              <div className="text-xs text-[var(--text-muted)] space-y-2">
                <div className="font-medium">💡 Deploy Options:</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="font-medium text-[var(--text-primary)]">Auto Deploy</div>
                    <ol className="list-decimal list-inside space-y-0.5 text-xs">
                      <li>Add GitHub token</li>
                      <li>Enter target repo (optional)</li>
                      <li>Click Deploy</li>
                    </ol>
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium text-[var(--text-primary)]">CLI Deploy</div>
                    <ol className="list-decimal list-inside space-y-0.5 text-xs">
                      <li>Download ZIP</li>
                      <li>Run CLI commands</li>
                      <li>Enable Pages</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
