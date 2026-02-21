import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

interface DeployRequest {
  files: { path: string; content: string }[];
  repoName: string;
  githubToken?: string;
  isPrivate?: boolean;
  description?: string;
  targetRepo?: string; // Format: username/repo
  buildFirst?: boolean;
  buildCommand?: string;
}

export async function POST(request: NextRequest) {
  const body: DeployRequest = await request.json();
  const { 
    files, 
    repoName, 
    githubToken, 
    isPrivate = false, 
    description = '',
    targetRepo,
    buildFirst = false,
    buildCommand = 'npm install && npm run build'
  } = body;
  
  if (!files || !Array.isArray(files)) {
    return NextResponse.json({ error: 'Files array is required' }, { status: 400 });
  }

  if (!githubToken) {
    return NextResponse.json({
      success: false,
      requiresAuth: true,
      message: 'GitHub token required',
      cliCommands: generateCliCommands(files, repoName, buildFirst),
      instructions: {
        step1: 'Go to https://github.com/settings/tokens',
        step2: 'Click "Generate new token (classic)"',
        step3: 'Select scopes: repo, workflow',
        step4: 'Copy the token and use it below',
      },
    });
  }

  // Validate token format
  if (!githubToken.startsWith('ghp_') && !githubToken.startsWith('github_pat_')) {
    return NextResponse.json({
      success: false,
      error: 'Invalid token format. Token should start with "ghp_" or "github_pat_"',
      cliCommands: generateCliCommands(files, repoName, buildFirst),
    }, { status: 400 });
  }

  const headers = {
    'Authorization': `Bearer ${githubToken}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'MindKey/1.0',
  };

  try {
    // Get authenticated user info
    const userResponse = await fetch('https://api.github.com/user', { headers });
    
    if (!userResponse.ok) {
      const errorData = await userResponse.json();
      return NextResponse.json({
        success: false,
        error: `GitHub authentication failed: ${errorData.message || 'Invalid token'}`,
        cliCommands: generateCliCommands(files, repoName, buildFirst),
      }, { status: 401 });
    }
    
    const userData = await userResponse.json();
    const owner = userData.login;
    
    console.log(`[Deploy] Authenticated as: ${owner}`);

    let targetOwner = owner;
    let targetRepoName = repoName;
    let isExistingRepo = false;

    // Parse targetRepo if provided (format: username/repo)
    if (targetRepo && targetRepo.includes('/')) {
      const [targetUser, targetRepo] = targetRepo.split('/');
      targetOwner = targetUser;
      targetRepoName = targetRepo;
      isExistingRepo = true;
    }

    const fullRepoPath = `${targetOwner}/${targetRepoName}`;

    // Check if repo exists
    const checkRepoResponse = await fetch(`https://api.github.com/repos/${fullRepoPath}`, { headers });
    isExistingRepo = checkRepoResponse.ok;

    let repoUrl: string;

    if (!isExistingRepo) {
      // Create new repository
      console.log(`[Deploy] Creating repository: ${fullRepoPath}`);
      
      const createRepoResponse = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: targetRepoName,
          description: description || `Project from Mind Key - ${new Date().toISOString().split('T')[0]}`,
          private: isPrivate,
          auto_init: true,
        }),
      });

      if (!createRepoResponse.ok) {
        const errorData = await createRepoResponse.json();
        return NextResponse.json({
          success: false,
          error: errorData.message || 'Failed to create repository',
          details: errorData.errors?.map((e: { message: string }) => e.message).join(', '),
          cliCommands: generateCliCommands(files, targetRepoName, buildFirst),
        }, { status: createRepoResponse.status });
      }

      const repoData = await createRepoResponse.json();
      repoUrl = repoData.html_url;
      console.log(`[Deploy] Repository created: ${repoUrl}`);
      
      // Wait for repo to be ready
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      repoUrl = `https://github.com/${fullRepoPath}`;
      console.log(`[Deploy] Using existing repository: ${repoUrl}`);
    }

    // Get the default branch's commit SHA
    console.log(`[Deploy] Getting main branch reference...`);
    const refResponse = await fetch(`https://api.github.com/repos/${fullRepoPath}/git/ref/heads/main`, { headers });

    let baseTreeSha: string;
    
    if (!refResponse.ok) {
      // Try 'master' branch if 'main' doesn't exist
      const masterRefResponse = await fetch(`https://api.github.com/repos/${fullRepoPath}/git/ref/heads/master`, { headers });
      
      if (!masterRefResponse.ok) {
        return NextResponse.json({
          success: false,
          error: 'Could not find main or master branch',
          repoUrl,
          cliCommands: generateCliCommands(files, targetRepoName, buildFirst),
        }, { status: 500 });
      }
      
      const masterRefData = await masterRefResponse.json();
      baseTreeSha = masterRefData.object.sha;
    } else {
      const refData = await refResponse.json();
      baseTreeSha = refData.object.sha;
    }
    
    console.log(`[Deploy] Base tree SHA: ${baseTreeSha}`);

    // Create blobs for each file
    console.log(`[Deploy] Creating blobs for ${files.length} files...`);
    const treeItems: Array<{ path: string; mode: '100644'; type: 'blob'; sha: string }> = [];
    const failedFiles: string[] = [];
    
    for (const file of files) {
      try {
        if (file.content.length > 10 * 1024 * 1024) {
          console.warn(`[Deploy] Skipping large file: ${file.path}`);
          failedFiles.push(file.path);
          continue;
        }

        const blobResponse = await fetch(`https://api.github.com/repos/${fullRepoPath}/git/blobs`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            content: Buffer.from(file.content).toString('base64'),
            encoding: 'base64',
          }),
        });

        if (blobResponse.ok) {
          const blobData = await blobResponse.json();
          treeItems.push({
            path: file.path,
            mode: '100644',
            type: 'blob',
            sha: blobData.sha,
          });
        } else {
          console.error(`[Deploy] Failed to create blob for ${file.path}`);
          failedFiles.push(file.path);
        }
      } catch (e) {
        failedFiles.push(file.path);
      }
    }

    if (treeItems.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Failed to create any file blobs',
        repoUrl,
        cliCommands: generateCliCommands(files, targetRepoName, buildFirst),
      }, { status: 500 });
    }

    // Create tree
    console.log(`[Deploy] Creating tree...`);
    const treeResponse = await fetch(`https://api.github.com/repos/${fullRepoPath}/git/trees`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeItems,
      }),
    });

    if (!treeResponse.ok) {
      const errorData = await treeResponse.json();
      return NextResponse.json({
        success: false,
        error: 'Failed to create git tree',
        details: errorData.message,
        repoUrl,
        cliCommands: generateCliCommands(files, targetRepoName, buildFirst),
      }, { status: 500 });
    }

    const treeData = await treeResponse.json();

    // Create commit
    console.log(`[Deploy] Creating commit...`);
    const commitResponse = await fetch(`https://api.github.com/repos/${fullRepoPath}/git/commits`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: `Deploy from Mind Key\n\nFiles: ${treeItems.length}\nSkipped: ${failedFiles.length}`,
        tree: treeData.sha,
        parents: [baseTreeSha],
      }),
    });

    if (!commitResponse.ok) {
      const errorData = await commitResponse.json();
      return NextResponse.json({
        success: false,
        error: 'Failed to create commit',
        details: errorData.message,
        repoUrl,
        cliCommands: generateCliCommands(files, targetRepoName, buildFirst),
      }, { status: 500 });
    }

    const commitData = await commitResponse.json();

    // Update reference (try main first, then master)
    console.log(`[Deploy] Updating branch reference...`);
    let updateRefResponse = await fetch(`https://api.github.com/repos/${fullRepoPath}/git/refs/heads/main`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ sha: commitData.sha }),
    });

    if (!updateRefResponse.ok) {
      // Try master branch
      updateRefResponse = await fetch(`https://api.github.com/repos/${fullRepoPath}/git/refs/heads/master`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ sha: commitData.sha }),
      });
    }

    if (!updateRefResponse.ok) {
      return NextResponse.json({
        success: false,
        error: 'Failed to update branch',
        repoUrl,
        cliCommands: generateCliCommands(files, targetRepoName, buildFirst),
      }, { status: 500 });
    }

    console.log(`[Deploy] Files pushed successfully`);

    // Enable GitHub Pages
    console.log(`[Deploy] Enabling GitHub Pages...`);
    const pagesResponse = await fetch(`https://api.github.com/repos/${fullRepoPath}/pages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        source: { branch: 'main', path: '/' },
      }),
    });

    const pagesEnabled = pagesResponse.ok;
    const pagesUrl = pagesEnabled ? `https://${targetOwner}.github.io/${targetRepoName}/` : null;

    return NextResponse.json({
      success: true,
      owner: targetOwner,
      repo: targetRepoName,
      repoUrl,
      pagesUrl,
      pagesEnabled,
      filesPushed: treeItems.length,
      filesSkipped: failedFiles.length,
      message: `✅ Deployed ${treeItems.length} files to ${fullRepoPath}!`,
      cliCommands: null, // Not needed when successful
    });

  } catch (error: unknown) {
    console.error('[Deploy] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
      success: false,
      error: message,
      cliCommands: generateCliCommands(files, repoName, buildFirst),
    }, { status: 500 });
  }
}

function generateCliCommands(files: { path: string; content: string }[], repoName: string, buildFirst: boolean): string {
  return `
# === MIND KEY DEPLOY COMMANDS ===

# 1. Create project directory
mkdir -p ${repoName} && cd ${repoName}

# 2. Initialize git
git init
git branch -M main

# 3. Download and extract files (or use the ZIP download)
# Files: ${files.length} total

# 4. ${buildFirst ? `Build the project first:
npm install
npm run build` : 'No build required (static files)'}

# 5. Commit files
git add .
git commit -m "Deploy from Mind Key"

# 6. Add your GitHub remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/${repoName}.git

# 7. Push to GitHub
git push -u origin main --force

# 8. Enable GitHub Pages
# Go to: https://github.com/YOUR_USERNAME/${repoName}/settings/pages
# Select "main" branch and "/" (root), then Save

# Your site will be live at:
# https://YOUR_USERNAME.github.io/${repoName}/

# === END ===
`.trim();
}

// CLI endpoint for local deployment
export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get('action');
  
  if (action === 'cli-help') {
    return NextResponse.json({
      usage: 'mindkey deploy --repo username/repo --token YOUR_TOKEN --dir ./dist',
      options: {
        '--repo': 'GitHub repository (username/repo format)',
        '--token': 'GitHub personal access token',
        '--dir': 'Directory to deploy (default: ./dist)',
        '--build': 'Run npm build before deploy',
        '--pages': 'Enable GitHub Pages after deploy',
      },
      examples: [
        'mindkey deploy --repo myuser/myapp --token ghp_xxx',
        'mindkey deploy --repo myuser/myapp --token ghp_xxx --dir ./build --pages',
      ],
    });
  }
  
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
