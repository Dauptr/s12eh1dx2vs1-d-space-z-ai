# Mind Key - Universal Access Engine

A powerful browser preview tool with scanning, cloning, building, and deployment capabilities. Works with any URL, including localhost and internal network targets.

![Mind Key Preview](https://img.shields.io/badge/Next.js-16.1-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=for-the-badge&logo=tailwind-css)

## Features

### Core Features
- **🌐 Universal Access**: Preview any website, including those with CORS restrictions
- **☁️ z.ai Workspace Support**: Direct embedding for z.ai workspaces with full SSR
- **💻 Local Development**: Works with localhost and internal network targets
- **⚡ Next.js Compatible**: Full support for SSR, API routes, and HMR
- **🖥️ Interactive Console**: Execute JavaScript commands in the preview context
- **🎨 Dark Theme**: Beautiful cyberpunk-inspired interface

### NEW: Scan, Clone, Build, Deploy

| Feature | Description |
|---------|-------------|
| **🔍 Scan** | Analyze target structure, frameworks, dependencies, assets |
| **📋 Clone** | Clone target website with all assets (CSS, JS, images) |
| **📦 Build** | Generate production-ready project (Static, Next.js, React, Vue) |
| **🚀 Deploy** | Deploy directly to GitHub with GitHub Pages |

### Build Options
- **Static HTML** - Simple HTML + server.js
- **Next.js** - Full Next.js project with SSR
- **React + Vite** - Modern React project
- **Vue + Vite** - Modern Vue project

### Deployment Features
- **Docker Support** - Auto-generated Dockerfile & docker-compose.yml
- **GitHub Actions** - Auto CI/CD workflow
- **Node.js Version Selection** - Choose from 14.x to 21.x
- **Download as ZIP** - Complete project archive
- **Download as HTML** - Single file for quick sharing

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ or [Bun](https://bun.sh/)

### Run Locally

```bash
# Install dependencies
bun install

# Start development server
bun run dev
```

Open **http://localhost:3000** in your browser.

## How to Use

### 1. Initialize Access

Enter any URL and click **"Initialize Access"**:
- External URLs: `https://example.com`
- z.ai Workspace: `https://your-workspace.space.z.ai/`
- Local server: `localhost:3001`

### 2. Scan Target

Click the **"Scan"** tab to analyze:
- Detected frameworks (Next.js, React, Vue, Tailwind, etc.)
- Asset count (scripts, styles, images, fonts)
- Estimated build size
- Recommended Node.js version

### 3. Clone Target

Click the **"Clone"** tab to:
- Fetch all HTML, CSS, JS assets
- View cloned files list
- See total size

### 4. Build Project

Click the **"Build"** tab to:
- Configure project name
- Select Node.js version (14.21.3 - 21.6.2)
- Choose framework (Static, Next.js, React, Vue)
- Enable Docker support
- Enable GitHub Actions CI/CD
- Generate complete project

### 5. Download

- **Download ZIP** - Complete project with all files
- **Download HTML** - Single index.html file

### 6. Deploy to GitHub

Click the **"Deploy"** tab to:
- Create GitHub repository automatically
- Push files to GitHub
- Enable GitHub Pages (for static sites)

**Optional**: Provide GitHub token for automatic deployment

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── scan/route.ts          # Target scanning API
│   │   ├── clone/route.ts         # Asset cloning API
│   │   ├── build/route.ts         # Project generation API
│   │   ├── download/route.ts      # ZIP/HTML download API
│   │   ├── deploy/route.ts        # GitHub deployment API
│   │   ├── proxy/route.ts         # CORS proxy
│   │   └── workspace/status/route.ts
│   ├── page.tsx
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ClonePanel.tsx             # Scan/Clone/Build/Deploy UI
│   ├── WorkspacePanel.tsx
│   ├── PreviewFrame.tsx
│   ├── Console.tsx
│   └── Sidebar.tsx
└── lib/
    └── processor.ts
```

## API Reference

### POST /api/scan
Scan and analyze a target URL.
```json
{ "url": "https://example.com" }
```

### POST /api/clone
Clone target with assets.
```json
{ "url": "https://example.com", "includeAssets": true }
```

### POST /api/build
Generate project files.
```json
{
  "html": "...",
  "config": {
    "projectName": "my-project",
    "nodeVersion": "18.19.0",
    "framework": "nextjs",
    "includeDocker": true,
    "includeGithubActions": true
  }
}
```

### POST /api/download
Download as ZIP or HTML.
```json
{ "files": [...], "projectName": "my-project", "type": "zip" }
```

### POST /api/deploy
Deploy to GitHub.
```json
{ "files": [...], "repoName": "my-project", "githubToken": "ghp_..." }
```

## Supported Node.js Versions

| Version | Recommended For |
|---------|-----------------|
| 14.21.3 | Legacy projects |
| 16.20.2 | Stable legacy |
| 17.9.1 | Specific needs |
| 18.19.0 | Next.js, Modern |
| 20.11.0 | Latest LTS |
| 21.6.2 | Bleeding edge |

## Troubleshooting

### "Connection refused" error
The target server is not running. Start your development server first.

### Preview shows blank page
1. Check if the target URL is correct
2. For local URLs, ensure the server is running
3. Check browser console for errors

### Clone fails
Some websites block automated requests. Try downloading the HTML directly.

### Deploy fails without token
Generate a GitHub token with `repo` and `workflow` scopes.

## Development

```bash
bun run dev          # Start dev server
bun run build        # Production build
bun run lint         # Run ESLint
```

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **UI Components**: shadcn/ui
- **Icons**: Lucide React
- **Fonts**: JetBrains Mono, Space Grotesk

## License

MIT License - Feel free to use and modify for your projects.

---

Built with ❤️ using Next.js and Tailwind CSS
