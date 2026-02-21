import { NextRequest, NextResponse } from 'next/server';

interface BuildConfig {
  projectName: string;
  nodeVersion: string;
  framework: 'static' | 'nextjs' | 'react' | 'vue';
  includeDocker: boolean;
  includeGithubActions: boolean;
}

interface BuildFile {
  path: string;
  content: string;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { 
    url, 
    html, 
    config = {} 
  }: { 
    url: string; 
    html: string; 
    config: Partial<BuildConfig>;
  } = body;
  
  if (!html) {
    return NextResponse.json({ error: 'HTML content is required' }, { status: 400 });
  }

  const buildConfig: BuildConfig = {
    projectName: config.projectName || 'cloned-project',
    nodeVersion: config.nodeVersion || '18.19.0',
    framework: config.framework || 'static',
    includeDocker: config.includeDocker ?? true,
    includeGithubActions: config.includeGithubActions ?? true,
    ...config,
  };

  const files: BuildFile[] = [];

  try {
    // Generate files based on framework
    switch (buildConfig.framework) {
      case 'nextjs':
        generateNextJsProject(files, html, buildConfig);
        break;
      case 'react':
        generateReactProject(files, html, buildConfig);
        break;
      case 'vue':
        generateVueProject(files, html, buildConfig);
        break;
      default:
        generateStaticProject(files, html, buildConfig);
    }

    // Add Docker support
    if (buildConfig.includeDocker) {
      generateDockerFiles(files, buildConfig);
    }

    // Add GitHub Actions
    if (buildConfig.includeGithubActions) {
      generateGithubActions(files, buildConfig);
    }

    // Add README
    generateReadme(files, buildConfig, url);

    return NextResponse.json({
      success: true,
      files,
      projectName: buildConfig.projectName,
      nodeVersion: buildConfig.nodeVersion,
      framework: buildConfig.framework,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function generateStaticProject(files: BuildFile[], html: string, config: BuildConfig) {
  // index.html
  files.push({
    path: 'index.html',
    content: html,
  });

  // Simple server
  files.push({
    path: 'server.js',
    content: `const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, filePath);
  
  const ext = path.extname(filePath);
  const contentTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
  };
  
  const contentType = contentTypes[ext] || 'application/octet-stream';
  
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(\`Server running at http://localhost:\${PORT}\`);
});
`,
  });

  // package.json
  files.push({
    path: 'package.json',
    content: JSON.stringify({
      name: config.projectName,
      version: '1.0.0',
      description: 'Cloned project from Mind Key',
      main: 'server.js',
      scripts: {
        start: 'node server.js',
        dev: 'node server.js',
      },
      keywords: ['cloned', 'mind-key'],
      license: 'MIT',
    }, null, 2),
  });
}

function generateNextJsProject(files: BuildFile[], html: string, config: BuildConfig) {
  // page.tsx
  files.push({
    path: 'src/app/page.tsx',
    content: `export default function Home() {
  return (
    <div dangerouslySetInnerHTML={{ __html: ${JSON.stringify(html)} }} />
  );
}
`,
  });

  // layout.tsx
  files.push({
    path: 'src/app/layout.tsx',
    content: `import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '${config.projectName}',
  description: 'Cloned project from Mind Key',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
  });

  // package.json
  files.push({
    path: 'package.json',
    content: JSON.stringify({
      name: config.projectName,
      version: '1.0.0',
      private: true,
      scripts: {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
        lint: 'next lint',
      },
      dependencies: {
        next: '^14.0.0',
        react: '^18.2.0',
        'react-dom': '^18.2.0',
      },
      devDependencies: {
        '@types/node': '^20',
        '@types/react': '^18',
        typescript: '^5',
      },
    }, null, 2),
  });

  // next.config.js
  files.push({
    path: 'next.config.js',
    content: `/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
};

module.exports = nextConfig;
`,
  });

  // tsconfig.json
  files.push({
    path: 'tsconfig.json',
    content: JSON.stringify({
      compilerOptions: {
        target: 'es5',
        lib: ['dom', 'dom.iterable', 'esnext'],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: 'preserve',
        incremental: true,
        plugins: [{ name: 'next' }],
        paths: {
          '@/*': ['./src/*'],
        },
      },
      include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
      exclude: ['node_modules'],
    }, null, 2),
  });
}

function generateReactProject(files: BuildFile[], html: string, config: BuildConfig) {
  // App.jsx
  files.push({
    path: 'src/App.jsx',
    content: `function App() {
  return (
    <div dangerouslySetInnerHTML={{ __html: ${JSON.stringify(html)} }} />
  );
}

export default App;
`,
  });

  // main.jsx
  files.push({
    path: 'src/main.jsx',
    content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
  });

  // index.html
  files.push({
    path: 'index.html',
    content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${config.projectName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`,
  });

  // package.json
  files.push({
    path: 'package.json',
    content: JSON.stringify({
      name: config.projectName,
      version: '1.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
      },
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0',
      },
      devDependencies: {
        '@types/react': '^18',
        '@types/react-dom': '^18',
        '@vitejs/plugin-react': '^4',
        vite: '^5',
      },
    }, null, 2),
  });

  // vite.config.js
  files.push({
    path: 'vite.config.js',
    content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
`,
  });
}

function generateVueProject(files: BuildFile[], html: string, config: BuildConfig) {
  // App.vue
  files.push({
    path: 'src/App.vue',
    content: `<template>
  <div v-html="htmlContent"></div>
</template>

<script setup>
const htmlContent = ${JSON.stringify(html)};
</script>
`,
  });

  // main.js
  files.push({
    path: 'src/main.js',
    content: `import { createApp } from 'vue';
import App from './App.vue';

createApp(App).mount('#app');
`,
  });

  // package.json
  files.push({
    path: 'package.json',
    content: JSON.stringify({
      name: config.projectName,
      version: '1.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
      },
      dependencies: {
        vue: '^3.4.0',
      },
      devDependencies: {
        '@vitejs/plugin-vue': '^5',
        vite: '^5',
      },
    }, null, 2),
  });

  // vite.config.js
  files.push({
    path: 'vite.config.js',
    content: `import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
});
`,
  });
}

function generateDockerFiles(files: BuildFile[], config: BuildConfig) {
  // Dockerfile
  files.push({
    path: 'Dockerfile',
    content: `FROM node:${config.nodeVersion}-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build (if needed)
RUN npm run build || true

# Expose port
EXPOSE 3000

# Start server
CMD ["npm", "start"]
`,
  });

  // docker-compose.yml
  files.push({
    path: 'docker-compose.yml',
    content: `version: '3.8'

services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
`,
  });

  // .dockerignore
  files.push({
    path: '.dockerignore',
    content: `node_modules
.git
.gitignore
*.md
.env*
`,
  });
}

function generateGithubActions(files: BuildFile[], config: BuildConfig) {
  // main.yml
  files.push({
    path: '.github/workflows/main.yml',
    content: `name: Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '${config.nodeVersion}'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Deploy to GitHub Pages
        if: github.ref == 'refs/heads/main'
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: \${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./out
`,
  });
}

function generateReadme(files: BuildFile[], config: BuildConfig, url: string) {
  files.push({
    path: 'README.md',
    content: `# ${config.projectName}

Cloned from: ${url}

Generated by Mind Key - Universal Access Engine

## Quick Start

\`\`\`bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
\`\`\`

## Requirements

- Node.js ${config.nodeVersion} or higher
- npm or yarn

## Project Structure

\`\`\`
.
├── package.json
├── README.md
${config.includeDocker ? '├── Dockerfile\n├── docker-compose.yml\n' : ''}${config.includeGithubActions ? '├── .github/\n│   └── workflows/\n│       └── main.yml\n' : ''}└── src/
\`\`\`

## License

MIT
`,
  });
}
