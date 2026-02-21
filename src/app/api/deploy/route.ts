import { NextRequest, NextResponse } from 'next/server';

interface DeployRequest {
  files: { path: string; content: string }[];
  repoName: string;
  githubToken?: string;
  isPrivate?: boolean;
  description?: string;
}

export async function POST(request: NextRequest) {
  const body: DeployRequest = await request.json();
  const { files, repoName, githubToken, isPrivate = false, description = '' } = body;
  
  if (!files || !Array.isArray(files)) {
    return NextResponse.json({ error: 'Files array is required' }, { status: 400 });
  }

  if (!repoName) {
    return NextResponse.json({ error: 'Repository name is required' }, { status: 400 });
  }

  // If no token provided, return instructions
  if (!githubToken) {
    return NextResponse.json({
      success: false,
      requiresAuth: true,
      message: 'GitHub token required',
      instructions: {
        step1: 'Go to https://github.com/settings/tokens',
        step2: 'Click "Generate new token (classic)"',
        step3: 'Select scopes: repo, workflow',
        step4: 'Copy the token and provide it',
        step5: 'Run the deploy command with your token',
      },
      manualSteps: [
        'Create a new repository on GitHub',
        'Initialize with README',
        'Push the downloaded files manually',
        'Enable GitHub Pages in repository settings',
      ],
      commands: `
# After downloading the ZIP:
unzip ${repoName}.zip
cd ${repoName}
git init
git add .
git commit -m "Initial commit from Mind Key"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/${repoName}.git
git push -u origin main

# For GitHub Pages (if static):
# Go to Settings > Pages > Source: main branch
      `.trim(),
    });
  }

  try {
    // Create repository
    const createRepoResponse = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'MindKey/1.0',
      },
      body: JSON.stringify({
        name: repoName,
        description: description || `Cloned project from Mind Key - ${new Date().toISOString().split('T')[0]}`,
        private: isPrivate,
        auto_init: true,
      }),
    });

    if (!createRepoResponse.ok) {
      const error = await createRepoResponse.json();
      
      // Check if repo already exists
      if (error.errors?.some((e: { message: string }) => e.message?.includes('already exists'))) {
        return NextResponse.json({
          success: false,
          error: 'Repository already exists',
          message: 'Please choose a different repository name or delete the existing one',
        }, { status: 409 });
      }
      
      return NextResponse.json({
        success: false,
        error: error.message || 'Failed to create repository',
      }, { status: createRepoResponse.status });
    }

    const repoData = await createRepoResponse.json();
    const owner = repoData.owner.login;

    // Get the default branch's commit SHA
    const refResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/main`, {
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'MindKey/1.0',
      },
    });

    if (!refResponse.ok) {
      return NextResponse.json({
        success: false,
        error: 'Failed to get repository reference',
        repoUrl: repoData.html_url,
      }, { status: 500 });
    }

    const refData = await refResponse.json();
    const baseTreeSha = refData.object.sha;

    // Create blobs for each file
    const treeItems: Array<{ path: string; mode: '100644'; type: 'blob'; sha: string }> = [];
    
    for (const file of files) {
      // Create blob
      const blobResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/blobs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'MindKey/1.0',
        },
        body: JSON.stringify({
          content: file.content,
          encoding: 'utf-8',
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
      }
    }

    // Create tree
    const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/trees`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'MindKey/1.0',
      },
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeItems,
      }),
    });

    if (!treeResponse.ok) {
      return NextResponse.json({
        success: false,
        error: 'Failed to create tree',
        repoUrl: repoData.html_url,
      }, { status: 500 });
    }

    const treeData = await treeResponse.json();

    // Create commit
    const commitResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/commits`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'MindKey/1.0',
      },
      body: JSON.stringify({
        message: 'Initial commit from Mind Key',
        tree: treeData.sha,
        parents: [baseTreeSha],
      }),
    });

    if (!commitResponse.ok) {
      return NextResponse.json({
        success: false,
        error: 'Failed to create commit',
        repoUrl: repoData.html_url,
      }, { status: 500 });
    }

    const commitData = await commitResponse.json();

    // Update reference
    const updateRefResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/main`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'MindKey/1.0',
      },
      body: JSON.stringify({
        sha: commitData.sha,
      }),
    });

    if (!updateRefResponse.ok) {
      return NextResponse.json({
        success: false,
        error: 'Failed to update reference',
        repoUrl: repoData.html_url,
      }, { status: 500 });
    }

    // Enable GitHub Pages for static sites
    const pagesResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/pages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'MindKey/1.0',
      },
      body: JSON.stringify({
        source: {
          branch: 'main',
          path: '/',
        },
      }),
    });

    const pagesEnabled = pagesResponse.ok;

    return NextResponse.json({
      success: true,
      repoUrl: repoData.html_url,
      pagesUrl: pagesEnabled ? `https://${owner}.github.io/${repoName}/` : null,
      pagesEnabled,
      message: pagesEnabled 
        ? 'Repository created and GitHub Pages enabled! Your site will be live in a few minutes.'
        : 'Repository created successfully. Enable GitHub Pages manually in repository settings.',
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
