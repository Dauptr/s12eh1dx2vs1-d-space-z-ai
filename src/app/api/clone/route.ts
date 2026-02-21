import { NextRequest, NextResponse } from 'next/server';

interface CloneResult {
  success: boolean;
  files: {
    path: string;
    content: string;
    type: 'html' | 'css' | 'js' | 'image' | 'other';
    size: number;
  }[];
  totalSize: number;
  errors: string[];
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { url, includeAssets = true, maxAssets = 50 } = body;
  
  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  const result: CloneResult = {
    success: false,
    files: [],
    totalSize: 0,
    errors: [],
  };

  try {
    // Fetch main HTML
    const htmlResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!htmlResponse.ok) {
      return NextResponse.json({ error: `Failed to fetch: ${htmlResponse.status}` }, { status: htmlResponse.status });
    }

    let html = await htmlResponse.text();
    const baseUrl = new URL(url);
    
    // Add main HTML file
    result.files.push({
      path: 'index.html',
      content: html,
      type: 'html',
      size: html.length,
    });
    result.totalSize += html.length;

    if (includeAssets) {
      // Extract and fetch CSS files
      const cssLinks = html.matchAll(/<link[^>]*href=["']([^"']+\.css[^"']*)["']/gi);
      let assetCount = 0;
      
      for (const match of cssLinks) {
        if (assetCount >= maxAssets) break;
        
        try {
          const cssUrl = resolveUrl(match[1], baseUrl);
          const cssResponse = await fetch(cssUrl);
          
          if (cssResponse.ok) {
            const css = await cssResponse.text();
            const filename = getFilename(cssUrl, 'css');
            
            result.files.push({
              path: `assets/${filename}`,
              content: css,
              type: 'css',
              size: css.length,
            });
            result.totalSize += css.length;
            
            // Rewrite HTML to point to local file
            html = html.replace(match[1], `assets/${filename}`);
            assetCount++;
          }
        } catch (e) {
          result.errors.push(`Failed to fetch CSS: ${match[1]}`);
        }
      }

      // Extract and fetch JS files
      const jsScripts = html.matchAll(/<script[^>]*src=["']([^"']+\.js[^"']*)["']/gi);
      
      for (const match of jsScripts) {
        if (assetCount >= maxAssets) break;
        
        try {
          const jsUrl = resolveUrl(match[1], baseUrl);
          const jsResponse = await fetch(jsUrl);
          
          if (jsResponse.ok) {
            const js = await jsResponse.text();
            const filename = getFilename(jsUrl, 'js');
            
            result.files.push({
              path: `assets/${filename}`,
              content: js,
              type: 'js',
              size: js.length,
            });
            result.totalSize += js.length;
            
            // Rewrite HTML to point to local file
            html = html.replace(match[1], `assets/${filename}`);
            assetCount++;
          }
        } catch (e) {
          result.errors.push(`Failed to fetch JS: ${match[1]}`);
        }
      }

      // Update the main HTML with rewritten paths
      result.files[0].content = html;
      result.files[0].size = html.length;
    }

    result.success = true;
    return NextResponse.json(result);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message, ...result }, { status: 500 });
  }
}

function resolveUrl(url: string, baseUrl: URL): string {
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    if (url.startsWith('//')) {
      return `${baseUrl.protocol}${url}`;
    }
    if (url.startsWith('/')) {
      return `${baseUrl.origin}${url}`;
    }
    return new URL(url, baseUrl.origin).href;
  } catch {
    return url;
  }
}

function getFilename(url: string, defaultExt: string): string {
  try {
    const urlObj = new URL(url);
    let filename = urlObj.pathname.split('/').pop() || `file.${defaultExt}`;
    
    // Remove hash and query params from filename
    filename = filename.split('?')[0].split('#')[0];
    
    // Ensure extension
    if (!filename.includes('.')) {
      filename += `.${defaultExt}`;
    }
    
    // Sanitize filename
    filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    return filename;
  } catch {
    return `file_${Date.now()}.${defaultExt}`;
  }
}
