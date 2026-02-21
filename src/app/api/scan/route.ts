import { NextRequest, NextResponse } from 'next/server';

interface ScanResult {
  url: string;
  title: string;
  description: string;
  frameworks: string[];
  dependencies: {
    name: string;
    version: string;
    type: 'js' | 'css' | 'font';
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

  try {
    // Fetch the HTML content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Failed to fetch: ${response.status}` }, { status: response.status });
    }

    const html = await response.text();
    
    // Parse the HTML
    const result: ScanResult = {
      url,
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
    if (titleMatch) result.title = titleMatch[1];

    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    if (descMatch) result.description = descMatch[1];

    // Extract meta tags
    const authorMatch = html.match(/<meta[^>]*name=["']author["'][^>]*content=["']([^"']+)["']/i);
    if (authorMatch) result.meta.author = authorMatch[1];

    const keywordsMatch = html.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["']/i);
    if (keywordsMatch) result.meta.keywords = keywordsMatch[1];

    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    if (ogImageMatch) result.meta.ogImage = ogImageMatch[1];

    const viewportMatch = html.match(/<meta[^>]*name=["']viewport["'][^>]*content=["']([^"']+)["']/i);
    if (viewportMatch) result.meta.viewport = viewportMatch[1];

    // Detect frameworks
    const frameworkPatterns = [
      { name: 'Next.js', pattern: /_next|__NEXT|next\/router|next\/link/i },
      { name: 'React', pattern: /react|React\.createElement|__REACT/i },
      { name: 'Vue.js', pattern: /vue|Vue\.(createApp|component)|__VUE/i },
      { name: 'Angular', pattern: /angular|ng-|NgApp/i },
      { name: 'Svelte', pattern: /svelte|__svelte/i },
      { name: 'Tailwind CSS', pattern: /tailwind|tw-/i },
      { name: 'Bootstrap', pattern: /bootstrap/i },
      { name: 'jQuery', pattern: /jquery|jQuery|\$\(document\)/i },
      { name: 'GSAP', pattern: /gsap|TweenMax|TweenLite/i },
      { name: 'Three.js', pattern: /three\.js|THREE\./i },
      { name: 'Framer Motion', pattern: /framer-motion|motion\./i },
    ];

    for (const { name, pattern } of frameworkPatterns) {
      if (pattern.test(html)) {
        result.frameworks.push(name);
      }
    }

    // Count scripts
    const scripts = html.match(/<script[^>]*src=/gi) || [];
    result.assets.scripts = scripts.length;

    // Extract script dependencies
    const scriptMatches = html.matchAll(/<script[^>]*src=["']([^"']+)["']/gi);
    for (const match of scriptMatches) {
      const src = match[1];
      const dep = extractDependency(src, 'js');
      if (dep) result.dependencies.push(dep);
    }

    // Count styles
    const styles = html.match(/<link[^>]*rel=["']stylesheet["']/gi) || [];
    result.assets.styles = styles.length;

    // Extract CSS dependencies
    const styleMatches = html.matchAll(/<link[^>]*href=["']([^"']+)["']/gi);
    for (const match of styleMatches) {
      const href = match[1];
      if (href.includes('.css')) {
        const dep = extractDependency(href, 'css');
        if (dep) result.dependencies.push(dep);
      }
    }

    // Count images
    const images = html.match(/<img[^>]*src=/gi) || [];
    result.assets.images = images.length;

    // Count fonts
    const fonts = html.match(/@font-face|\.woff|\.woff2|\.ttf|\.eot/gi) || [];
    result.assets.fonts = fonts.length;

    // Extract font dependencies
    const fontMatches = html.matchAll(/url\(["']?([^"')]+\.(woff2?|ttf|eot))["']?\)/gi);
    for (const match of fontMatches) {
      result.dependencies.push({
        name: match[1].split('/').pop()?.split('?')[0] || 'font',
        version: 'local',
        type: 'font',
      });
    }

    // Count icons
    const icons = html.match(/<link[^>]*rel=["'](icon|shortcut icon|apple-touch-icon)["']/gi) || [];
    result.assets.icons = icons.length;

    // Detect API routes (Next.js specific)
    const apiMatches = html.matchAll(/["']\/api\/([^"']+)["']/gi);
    for (const match of apiMatches) {
      if (!result.apiRoutes.includes(`/api/${match[1]}`)) {
        result.apiRoutes.push(`/api/${match[1]}`);
      }
    }

    // Estimate total size
    const totalAssets = result.assets.scripts + result.assets.styles + result.assets.images;
    const estimatedTotal = html.length + (totalAssets * 50000); // Rough estimate
    result.buildSize = `${(estimatedTotal / 1024).toFixed(1)} KB`;

    // Set recommended Node version based on frameworks
    if (result.frameworks.includes('Next.js')) {
      result.nodeVersion = '18.19.0';
    } else if (result.frameworks.includes('Angular')) {
      result.nodeVersion = '18.19.0';
    }

    return NextResponse.json(result);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function extractDependency(url: string, type: 'js' | 'css'): { name: string; version: string; type: 'js' | 'css' | 'font' } | null {
  try {
    // Handle CDN URLs
    if (url.includes('unpkg.com') || url.includes('cdn.jsdelivr.net')) {
      const parts = url.split('/');
      const pkgIndex = parts.findIndex(p => p.includes('@'));
      if (pkgIndex > 0) {
        const name = parts[pkgIndex].split('@')[0];
        const version = parts[pkgIndex].split('@')[1] || 'latest';
        return { name, version, type };
      }
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
