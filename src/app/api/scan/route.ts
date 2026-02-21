import { NextRequest, NextResponse } from 'next/server';

interface ScanResult {
  url: string;
  title: string;
  description: string;
  frameworks: string[];
  dependencies: {
    name: string;
    version: string;
    type: string;
  }[];
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
    viewport?: string;
  };
  apiRoutes: string[];
  nodeVersion: string;
  buildSize: string;
  timestamp: number;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  
  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  // Validate URL
  let targetUrl: URL;
  try {
    targetUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
  }

  const isLocalUrl = isLocalTarget(targetUrl);

  try {
    // Fetch the HTML content with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let response: Response;
    
    if (isLocalUrl) {
      // Direct fetch for local URLs
      response = await fetch(targetUrl.href, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
    } else {
      // Use proxy for external URLs to bypass CORS
      const proxyUrl = `${request.nextUrl.origin}/api/proxy?url=${encodeURIComponent(targetUrl.href)}`;
      response = await fetch(proxyUrl, {
        signal: controller.signal,
      });
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json({ 
        error: `Failed to fetch: ${response.status} ${response.statusText}`,
        url: targetUrl.href,
      }, { status: response.status });
    }

    const html = await response.text();
    
    // Parse the HTML
    const result: ScanResult = {
      url: targetUrl.href,
      title: '',
      description: '',
      frameworks: [],
      dependencies: [],
      assets: {
        scripts: 0,
        styles: 0,
        images: 0,
        fonts: 0,
        icons: 0,
        other: 0,
      },
      meta: {},
      apiRoutes: [],
      nodeVersion: '18.19.0',
      buildSize: `${(html.length / 1024).toFixed(1)} KB`,
      timestamp: Date.now(),
    };

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) result.title = titleMatch[1].trim();

    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
    if (descMatch) result.description = descMatch[1].trim();

    // Extract meta tags
    const authorMatch = html.match(/<meta[^>]*name=["']author["'][^>]*content=["']([^"']+)["']/i);
    if (authorMatch) result.meta.author = authorMatch[1].trim();

    const keywordsMatch = html.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["']/i);
    if (keywordsMatch) result.meta.keywords = keywordsMatch[1].trim();

    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    if (ogImageMatch) result.meta.ogImage = ogImageMatch[1].trim();

    const viewportMatch = html.match(/<meta[^>]*name=["']viewport["'][^>]*content=["']([^"']+)["']/i);
    if (viewportMatch) result.meta.viewport = viewportMatch[1].trim();

    // Detect frameworks
    const frameworkPatterns = [
      { name: 'Next.js', pattern: /_next|__NEXT|next\/router|next\/link|data-next/i },
      { name: 'React', pattern: /react|React\.createElement|__REACT|data-reactroot/i },
      { name: 'Vue.js', pattern: /vue|Vue\.(createApp|component)|__VUE|v-cloak/i },
      { name: 'Angular', pattern: /angular|ng-|NgApp|ng-version/i },
      { name: 'Svelte', pattern: /svelte|__svelte/i },
      { name: 'Tailwind CSS', pattern: /tailwind|tw-|bg-\[|text-\[/i },
      { name: 'Bootstrap', pattern: /bootstrap|btn-|container-|row-/i },
      { name: 'jQuery', pattern: /jquery|jQuery|\$\('\.|document\)\.ready/i },
      { name: 'GSAP', pattern: /gsap|TweenMax|TweenLite|gsap\./i },
      { name: 'Three.js', pattern: /three\.js|THREE\./i },
      { name: 'Framer Motion', pattern: /framer-motion|motion\./i },
      { name: 'Alpine.js', pattern: /alpine|x-data|x-show/i },
      { name: 'HTMX', pattern: /htmx|hx-get|hx-post/i },
    ];

    for (const { name, pattern } of frameworkPatterns) {
      if (pattern.test(html)) {
        result.frameworks.push(name);
      }
    }

    // Count scripts - handle both single and double quotes
    const scriptMatches = [...html.matchAll(/<script[^>]*src=["']([^"']+)["']/gi)];
    result.assets.scripts = scriptMatches.length;

    // Extract script dependencies
    for (const match of scriptMatches) {
      const src = match[1];
      const dep = extractDependency(src, 'js');
      if (dep) result.dependencies.push(dep);
    }

    // Count styles - handle both rel="stylesheet" and other patterns
    const styleMatches = [...html.matchAll(/<link[^>]*href=["']([^"']+\.css[^"']*)["']/gi)];
    result.assets.styles = styleMatches.length;

    // Extract CSS dependencies
    for (const match of styleMatches) {
      const href = match[1];
      const dep = extractDependency(href, 'css');
      if (dep) result.dependencies.push(dep);
    }

    // Count images
    const imgMatches = [...html.matchAll(/<img[^>]*src=["']([^"']+)["']/gi)];
    result.assets.images = imgMatches.length;

    // Count inline images (data-src, background-image)
    const bgImageMatches = html.match(/url\(["'][^"')]+["']\)/gi) || [];
    result.assets.images += bgImageMatches.length;

    // Count fonts
    const fontMatches = html.match(/@font-face/gi) || [];
    const fontFileMatches = html.match(/\.woff2?|\.ttf|\.eot/gi) || [];
    result.assets.fonts = Math.max(fontMatches.length, fontFileMatches.length);

    // Count icons
    const iconMatches = html.match(/<link[^>]*rel=["'](icon|shortcut icon|apple-touch-icon|mask-icon)["']/gi) || [];
    result.assets.icons = iconMatches.length;

    // Detect API routes (Next.js specific)
    const apiMatches = [...html.matchAll(/["']\/api\/([^"']+)["']/gi)];
    for (const match of apiMatches) {
      const apiPath = `/api/${match[1]}`;
      if (!result.apiRoutes.includes(apiPath)) {
        result.apiRoutes.push(apiPath);
      }
    }

    // Estimate total size
    const totalAssets = result.assets.scripts + result.assets.styles + result.assets.images;
    const estimatedTotal = html.length + (totalAssets * 30000); // Rough estimate per asset
    result.buildSize = `${(estimatedTotal / 1024).toFixed(1)} KB`;

    // Set recommended Node version based on frameworks
    if (result.frameworks.includes('Next.js')) {
      result.nodeVersion = '18.19.0';
    } else if (result.frameworks.includes('Angular')) {
      result.nodeVersion = '18.19.0';
    }

    return NextResponse.json(result);

  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return NextResponse.json({ 
          error: 'Request timeout - server took too long to respond',
          url: targetUrl.href,
        }, { status: 504 });
      }
      return NextResponse.json({ 
        error: error.message,
        url: targetUrl.href,
      }, { status: 500 });
    }
    return NextResponse.json({ error: 'Unknown error' }, { status: 500 });
  }
}

function isLocalTarget(url: URL): boolean {
  const localPatterns = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    '.local',
    '.test',
    '.internal',
  ];
  
  const hostname = url.hostname.toLowerCase();
  
  // Check for z.ai workspace pattern
  if (hostname.includes('.z.ai') || hostname.includes('space.z.ai')) {
    return true;
  }
  
  return localPatterns.some(pattern => 
    hostname === pattern || hostname.endsWith(pattern) || hostname.startsWith(pattern)
  );
}

function extractDependency(url: string, type: string): { name: string; version: string; type: string } | null {
  try {
    // Handle CDN URLs
    if (url.includes('unpkg.com') || url.includes('cdn.jsdelivr.net')) {
      const parts = url.split('/');
      const pkgIndex = parts.findIndex(p => p.includes('@'));
      if (pkgIndex > 0) {
        const name = parts[pkgIndex].split('@')[0];
        const version = parts[pkgIndex].split('@')[1]?.split('/')[0] || 'latest';
        return { name, version, type };
      }
    }
    
    // Handle cdnjs
    if (url.includes('cdnjs.cloudflare.com')) {
      const parts = url.split('/');
      const libsIndex = parts.findIndex(p => p === 'libs');
      if (libsIndex >= 0 && parts.length > libsIndex + 2) {
        const name = parts[libsIndex + 1];
        const version = parts[libsIndex + 2];
        return { name, version, type };
      }
    }

    // Handle Google Fonts
    if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
      return { name: 'Google Fonts', version: 'latest', type: 'font' };
    }
    
    // Handle local paths
    const filename = url.split('/').pop()?.split('?')[0] || '';
    if (filename) {
      return { name: filename, version: 'local', type };
    }
    
    return null;
  } catch {
    return null;
  }
}
