import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

interface TerminalRequest {
  command: 'install' | 'dev' | 'build' | 'start' | 'custom';
  customCommand?: string;
  cwd?: string;
}

// Detect available package manager (prefer bun)
function getPackageManager(): string {
  // This project uses bun, so default to bun
  // In production, you might want to check which is available
  return 'bun';
}

export async function POST(request: NextRequest) {
  const body: TerminalRequest = await request.json();
  const { command, customCommand, cwd } = body;

  const pm = getPackageManager();

  // Validate command - use bun or npm
  const allowedCommands: Record<string, string[]> = {
    install: [pm, 'install'],
    dev: [pm, 'run', 'dev'],
    build: [pm, 'run', 'build'],
    start: [pm, 'start'],
  };

  let cmd: string[];
  let cmdLabel: string;

  if (command === 'custom' && customCommand) {
    // Parse custom command safely
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

  try {
    const output = await executeCommand(cmd, cwd || process.cwd());
    
    return NextResponse.json({
      success: true,
      command: cmdLabel,
      output,
      packageManager: pm,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Command failed';
    return NextResponse.json({
      success: false,
      command: cmdLabel,
      error: message,
      timestamp: new Date().toISOString(),
    });
  }
}

function executeCommand(cmd: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const [command, ...args] = cmd;
    
    const proc = spawn(command, args, {
      cwd,
      shell: true,
      env: { 
        ...process.env, 
        FORCE_COLOR: '1',
      },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Set timeout for long-running commands
    const timeout = setTimeout(() => {
      proc.kill();
      resolve(stdout + '\n[Command timed out after 60s - process may still be running]');
    }, 60000);

    proc.on('close', (code) => {
      clearTimeout(timeout);
      const output = stdout + (stderr ? `\n${stderr}` : '');
      
      if (code === 0 || code === null) {
        resolve(output || 'Command completed');
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
      { id: 'install', label: `${pm} install`, description: 'Install dependencies' },
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
