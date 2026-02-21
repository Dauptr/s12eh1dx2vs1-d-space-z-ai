import { NextRequest, NextResponse } from 'next/server';

interface DeployRequest {
  files: { path: string; content: string }[];
  repoName: string;
  githubToken?: string;
  isPrivate?: boolean;
  description?: string;
  targetRepo?: string;
  buildAndDeploy?: boolean;
  framework?: string;
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
    buildAndDeploy = false,
    framework = 'static'
  } = body;
  
  if (!files || !Array.isArray(files)) {
    return NextResponse.json({ error: 'Files array is required' }, { status: 400 });
  }

  if (!githubToken) {
    return NextResponse.json({
      success: false,
      requiresAuth: true,
      message: 'GitHub token required',
      cliCommands: generateCliCommands(repoName, framework),
      instructions: {
        step1: 'Go to https://github.com/settings/tokens',
        step2: 'Click "Generate new token (classic)"',
        step3: 'Select scopes: repo, workflow',
        step4: 'Copy the token and use it',
      },
    });
  }

  // Validate token format
  if (!githubToken.startsWith('ghp_') && !githubToken.startsWith('github_pat_')) {
    return NextResponse.json({
      success: false,
      error: 'Invalid token format. Token should start with "ghp_" or "github_pat_"',
      cliCommands: generateCliCommands(repoName, framework),
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
        details: 'Make sure your token has "repo" and "workflow" scopes',
      }, { status: 401 });
    }
    
    const userData = await userResponse.json();
    const owner = userData.login;
    
    let targetOwner = owner;
    let targetRepoName = repoName;
    let isExistingRepo = false;

    // Parse targetRepo if provided
    if (targetRepo && targetRepo.includes('/')) {
      const [targetUser, targetRepoName_] = targetRepo.split('/');
      targetOwner = targetUser;
      targetRepoName = targetRepoName_;
      isExistingRepo = true;
    }

    const fullRepoPath = `${targetOwner}/${targetRepoName}`;

    // Check if repo exists
    const checkRepoResponse = await fetch(`https://api.github.com/repos/${fullRepoPath}`, { headers });
    isExistingRepo = checkRepoResponse.ok;

    let repoUrl: string;

    if (!isExistingRepo) {
      // Create new repository
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
          cliCommands: generateCliCommands(repoName, framework),
        }, { status: createRepoResponse.status });
      }

      const repoData = await createRepoResponse.json();
      repoUrl = repoData.html_url;
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      repoUrl = `https://github.com/${fullRepoPath}`;
    }

    // Add GitHub Actions workflow for auto-build & deploy if requested
    let deployFiles = [...files];
    
    if (buildAndDeploy && framework !== 'static') {
      deployFiles = addGithubActionsWorkflow(deployFiles, framework);
    }

    // Get the default branch's commit SHA
    let baseTreeSha: string;
    let defaultBranch = 'main';
    
    const mainRefResponse = await fetch(`https://api.github.com/repos/${fullRepoPath}/git/ref/heads/main`, { headers });
    
    if (mainRefResponse.ok) {
      const refData = await mainRefResponse.json();
      baseTreeSha = refData.object.sha;
    } else {
      const masterRefResponse = await fetch(`https://api.github.com/repos/${fullRepoPath}/git/ref/heads/master`, { headers });
      if (masterRefResponse.ok) {
        const refData = await masterRefResponse.json();
        baseTreeSha = refData.object.sha;
        defaultBranch = 'master';
      } else {
        return NextResponse.json({
          success: false,
          error: 'Could not find main or master branch',
          repoUrl,
          cliCommands: generateCliCommands(repoName, framework),
        }, { status: 500 });
      }
    }

    // Create blobs for each file
    const treeItems: Array<{ path: string; mode: '100644'; type: 'blob'; sha: string }> = [];
    const failedFiles: string[] = [];
    
    for (const file of deployFiles) {
      try {
        if (file.content.length > 10 * 1024 * 1024) {
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
          failedFiles.push(file.path);
        }
      } catch {
        failedFiles.push(file.path);
      }
    }

    if (treeItems.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Failed to create any file blobs',
        repoUrl,
        cliCommands: generateCliCommands(repoName, framework),
      }, { status: 500 });
    }

    // Create tree
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
      }, { status: 500 });
    }

    const treeData = await treeResponse.json();

    // Create commit
    const commitMessage = buildAndDeploy 
      ? `Deploy from Mind Key\n\nFiles: ${treeItems.length}\nFramework: ${framework}\nAuto-build: Enabled via GitHub Actions`
      : `Deploy from Mind Key\n\nFiles: ${treeItems.length}`;
    
    const commitResponse = await fetch(`https://api.github.com/repos/${fullRepoPath}/git/commits`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: commitMessage,
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
      }, { status: 500 });
    }

    const commitData = await commitResponse.json();

    // Update reference
    const updateRefResponse = await fetch(`https://api.github.com/repos/${fullRepoPath}/git/refs/heads/${defaultBranch}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ sha: commitData.sha }),
    });

    if (!updateRefResponse.ok) {
      return NextResponse.json({
        success: false,
        error: 'Failed to update branch',
        repoUrl,
      }, { status: 500 });
    }

    // Enable GitHub Pages
    let pagesEnabled = false;
    let pagesUrl = null;
    
    // For static sites or build-and-deploy, use gh-pages branch or root
    if (framework === 'static' || buildAndDeploy) {
      const pagesResponse = await fetch(`https://api.github.com/repos/${fullRepoPath}/pages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          source: { branch: defaultBranch, path: '/' },
          build_type: buildAndDeploy && framework !== 'static' ? 'workflow' : 'legacy',
        }),
      });

      pagesEnabled = pagesResponse.ok;
      if (pagesEnabled) {
        pagesUrl = `https://${targetOwner}.github.io/${targetRepoName}/`;
      }
    }

    // Return result with next steps
    const result: Record<string, unknown> = {
      success: true,
      owner: targetOwner,
      repo: targetRepoName,
      repoUrl,
      pagesUrl,
      pagesEnabled,
      filesPushed: treeItems.length,
      filesSkipped: failedFiles.length,
      defaultBranch,
      framework,
      buildAndDeploy,
    };

    if (buildAndDeploy && framework !== 'static') {
      result.message = `✅ Deployed ${treeItems.length} files! GitHub Actions will build and deploy automatically.`;
      result.nextSteps = [
        'Check the Actions tab in your repository',
        'Wait for the build to complete (1-2 minutes)',
        `Your site will be live at: https://${targetOwner}.github.io/${targetRepoName}/`,
      ];
      result.actionsUrl = `${repoUrl}/actions`;
    } else if (framework === 'static') {
      result.message = `✅ Deployed ${treeItems.length} files! Your site is live.`;
    } else {
      result.message = `✅ Deployed ${treeItems.length} files! Enable GitHub Pages manually.`;
      result.nextSteps = [
        'Go to Settings > Pages',
        'Select source branch and folder',
        'Wait for deployment',
      ];
    }

    return NextResponse.json(result);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ 
      success: false,
      error: message,
      cliCommands: generateCliCommands(repoName, framework),
    }, { status: 500 });
  }
}

function generateCliCommands(projectName: string, framework: string): string {
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

function addGithubActionsWorkflow(files: { path: string; content: string }[], framework: string): { path: string; content: string }[] {
  const workflowContent = getGithubActionsWorkflow(framework);
  
  return [
    ...files,
    {
      path: '.github/workflows/deploy.yml',
      content: workflowContent,
    },
  ];
}

function getGithubActionsWorkflow(framework: string): string {
  const nodeVersion = '20';
  
  let buildSteps = '';
  let publishDir = '.';
  let staticOutput = '';
  
  switch (framework) {
    case 'nextjs':
      buildSteps = `
      - name: Install dependencies
        run: npm ci || npm install
        
      - name: Build Next.js
        run: npm run build
        
      - name: Static export
        run: |
          if npm run export 2>/dev/null; then
            echo "Export successful"
          else
            echo "No export script, using next build output"
          fi`;
      publishDir = './out';
      staticOutput = `
      - name: Add .nojekyll
        run: touch ${publishDir}/.nojekyll`;
      break;
    case 'react':
    case 'vue':
      buildSteps = `
      - name: Install dependencies
        run: npm ci || npm install
        
      - name: Build
        run: npm run build`;
      publishDir = './dist';
      staticOutput = `
      - name: Add .nojekyll
        run: touch ${publishDir}/.nojekyll`;
      break;
    default:
      buildSteps = `
      - name: Install dependencies
        run: npm ci || npm install`;
      publishDir = '.';
  }
  
  return `name: Build and Deploy to GitHub Pages

on:
  push:
    branches: [main, master]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '${nodeVersion}'
${buildSteps}
${staticOutput}

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ${publishDir}

  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
`;
}

// GET endpoint for CLI help
export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get('action');
  
  if (action === 'cli-help') {
    return NextResponse.json({
      usage: 'mindkey deploy --repo username/repo --token YOUR_TOKEN --dir ./dist',
      options: {
        '--repo': 'GitHub repository (username/repo format)',
        '--token': 'GitHub personal access token',
        '--dir': 'Directory to deploy (default: ./dist)',
        '--build': 'Add GitHub Actions for auto-build',
        '--pages': 'Enable GitHub Pages after deploy',
      },
      examples: [
        'mindkey deploy --repo myuser/myapp --token ghp_xxx',
        'mindkey deploy --repo myuser/myapp --token ghp_xxx --build',
      ],
    });
  }
  
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
