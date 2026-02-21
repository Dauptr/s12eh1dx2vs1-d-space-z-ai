import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

interface TerminalRequest {
  command: 'install' | 'dev' | 'build' | 'start' | 'custom';
  customCommand?: string;
  cwd?: string;
}

// Detect available package manager (prefer bun)
function getPackageManager(): string {
  return 'bun';
}

export async function POST(request: NextRequest) {
  const body: TerminalRequest = await request.json();
  const { command, customCommand, cwd } = body;

  const pm = getPackageManager();

  // Validate command - use bun or npm
  const allowedCommands: Record<string, string[]> = {
    install: [pm, 'install', '--no-progress', '--silent'],
    dev: [pm, 'run', 'dev'],
    build: [pm, 'run', 'build'],
    start: [pm, 'start'],
  };

  let cmd: string[];
  let cmdLabel: string;

  if (command === 'custom' && customCommand) {
    const parts = customCommand.trim().split(/\s+/);
    cmd = parts;
    cmdLabel = customCommand;
  } else if (allowedCommands[command]) {
    cmd = allowedCommands[command];
    cmdLabel = cmd.join(' ');
  } else {
    return NextResponse.json({ 
      success: false, 
      error: 'Invalid command' 
    }, { status: 400 });
  }

  // For install commands, check if node_modules already exists
  if (command === 'install') {
    const fs = await import('fs/promises');
    const nodeModulesPath = cwd ? `${cwd}/node_modules` : `${process.cwd()}/node_modules`;
    try {
      await fs.access(nodeModulesPath);
      return NextResponse.json({
        success: true,
        command: cmdLabel,
        output: '✅ node_modules already exists - skipping install\nUse "rm -rf node_modules && bun install" to reinstall',
        packageManager: pm,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // node_modules doesn't exist, proceed with install
    }
  }

  try {
    const output = await executeCommand(cmd, cwd || process.cwd(), command);
    
    return NextResponse.json({
      success: true,
      command: cmdLabel,
      output,
      packageManager: pm,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Command failed';
    
    // Check for OOM error
    if (message.includes('137') || message.includes('killed') || message.includes('SIGKILL')) {
      return NextResponse.json({
        success: false,
        command: cmdLabel,
        error: '⚠️ Process killed (OOM - Out of Memory)\n\nTry: bun install --no-save --ignore-scripts',
        suggestion: 'Run in a terminal with more memory or use: bun install --ignore-scripts',
        timestamp: new Date().toISOString(),
      });
    }
    
    return NextResponse.json({
      success: false,
      command: cmdLabel,
      error: message,
      timestamp: new Date().toISOString(),
    });
  }
}

function executeCommand(cmd: string[], cwd: string, commandType?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const [command, ...args] = cmd;
    
    // Set memory limits for heavy commands
    const env = { 
      ...process.env, 
      FORCE_COLOR: '1',
      NODE_OPTIONS: '--max-old-space-size=512',
    };
    
    // For install, add memory-saving flags
    if (commandType === 'install') {
      args.push('--ignore-scripts');
    }
    
    const proc = spawn(command, args, {
      cwd,
      shell: true,
      env,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      // Limit output size to prevent memory issues
      if (stdout.length > 50000) {
        stdout = stdout.slice(-50000) + '\n...[truncated]';
      }
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Shorter timeout for heavy commands
    const timeoutMs = commandType === 'install' ? 30000 : 60000;
    
    const timeout = setTimeout(() => {
      proc.kill('SIGTERM');
      resolve(stdout + '\n⏱️ Command timed out after ' + (timeoutMs/1000) + 's');
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timeout);
      const output = stdout + (stderr ? `\n${stderr}` : '');
      
      if (code === 0 || code === null) {
        resolve(output || '✅ Command completed');
      } else if (code === 137) {
        reject(new Error('137 - OOM Killed (Out of Memory)'));
      } else {
        reject(new Error(`Exit code ${code}\n${output}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

// GET endpoint returns available commands and status
export async function GET() {
  const pm = getPackageManager();
  
  return NextResponse.json({
    availableCommands: [
      { id: 'install', label: `${pm} install`, description: 'Install dependencies (skips if exists)' },
      { id: 'dev', label: `${pm} run dev`, description: 'Start development server' },
      { id: 'build', label: `${pm} run build`, description: 'Build for production' },
      { id: 'start', label: `${pm} start`, description: 'Start production server' },
    ],
    projectInfo: {
      hasPackageJson: true,
      nodeVersion: process.version,
      platform: process.platform,
      packageManager: pm,
    },
  });
}
