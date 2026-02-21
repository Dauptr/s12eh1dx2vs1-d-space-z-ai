import { NextRequest, NextResponse } from 'next/server';

interface CloneResult {
  success: boolean;
  files: {
    path: string;
    content: string;
    type: string;
    size: number;
  }[];
  totalSize: number;
  errors: string[];
  skippedAssets: string[];
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { url, includeAssets = true, maxAssets = 50 } = body;
  
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
  const requestOrigin = request.nextUrl.origin;

  const result: CloneResult = {
    success: false,
    files: [],
    totalSize: 0,
    errors: [],
    skippedAssets: [],
  };

  try {
    // Fetch main HTML with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    let htmlResponse: Response;
    
    if (isLocalUrl) {
      // Direct fetch for local URLs
      htmlResponse = await fetch(targetUrl.href, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
    } else {
      // Use proxy for external URLs
      const proxyUrl = `${requestOrigin}/api/proxy?url=${encodeURIComponent(targetUrl.href)}`;
      htmlResponse = await fetch(proxyUrl, {
        signal: controller.signal,
      });
    }

    clearTimeout(timeoutId);

    if (!htmlResponse.ok) {
      return NextResponse.json({ 
        error: `Failed to fetch: ${htmlResponse.status} ${htmlResponse.statusText}`,
        url: targetUrl.href,
      }, { status: htmlResponse.status });
    }

    let html = await htmlResponse.text();
    const baseUrl = targetUrl;
    
    // Add main HTML file
    result.files.push({
      path: 'index.html',
      content: html,
      type: 'html',
      size: html.length,
    });
    result.totalSize += html.length;

    if (includeAssets) {
      let assetCount = 0;
      const maxAssetSize = 2 * 1024 * 1024; // 2MB max per asset

      // Extract and fetch CSS files
      const cssMatches = [...html.matchAll(/<link[^>]*href=["']([^"']+\.css[^"']*)["']/gi)];
      
      for (const match of cssMatches) {
        if (assetCount >= maxAssets) {
          result.skippedAssets.push('Max assets limit reached');
          break;
        }
        
        const originalUrl = match[1];
        
        try {
          const cssUrl = resolveUrl(originalUrl, baseUrl);
          
          // Skip external CDN URLs that are too large
          if (isExternalCdn(cssUrl)) {
            continue;
          }

          const assetController = new AbortController();
          const assetTimeoutId = setTimeout(() => assetController.abort(), 10000);

          let cssResponse: Response;
          if (isLocalUrl) {
            cssResponse = await fetch(cssUrl, { signal: assetController.signal });
          } else {
            const proxyUrl = `${requestOrigin}/api/proxy?url=${encodeURIComponent(cssUrl)}`;
            cssResponse = await fetch(proxyUrl, { signal: assetController.signal });
          }

          clearTimeout(assetTimeoutId);

          if (cssResponse.ok) {
            const css = await cssResponse.text();
            
            // Skip if too large
            if (css.length > maxAssetSize) {
              result.skippedAssets.push(`${cssUrl} (too large: ${(css.length / 1024).toFixed(0)}KB)`);
              continue;
            }
            
            const filename = getFilename(cssUrl, 'css');
            
            result.files.push({
              path: `assets/${filename}`,
              content: css,
              type: 'css',
              size: css.length,
            });
            result.totalSize += css.length;
            
            // Rewrite HTML to point to local file
            html = html.replace(new RegExp(escapeRegex(originalUrl), 'g'), `assets/${filename}`);
            assetCount++;
          }
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : 'Unknown error';
          result.errors.push(`CSS: ${originalUrl} - ${errorMsg}`);
        }
      }

      // Extract and fetch JS files (prioritize local/internal scripts)
      const jsMatches = [...html.matchAll(/<script[^>]*src=["']([^"']+\.js[^"']*)["']/gi)];
      
      for (const match of jsMatches) {
        if (assetCount >= maxAssets) {
          result.skippedAssets.push('Max assets limit reached');
          break;
        }
        
        const originalUrl = match[1];
        
        try {
          const jsUrl = resolveUrl(originalUrl, baseUrl);
          
          // Skip common large external libraries
          if (isLargeExternalLibrary(jsUrl)) {
            result.skippedAssets.push(jsUrl);
            continue;
          }

          const assetController = new AbortController();
          const assetTimeoutId = setTimeout(() => assetController.abort(), 10000);

          let jsResponse: Response;
          if (isLocalUrl) {
            jsResponse = await fetch(jsUrl, { signal: assetController.signal });
          } else {
            const proxyUrl = `${requestOrigin}/api/proxy?url=${encodeURIComponent(jsUrl)}`;
            jsResponse = await fetch(proxyUrl, { signal: assetController.signal });
          }

          clearTimeout(assetTimeoutId);

          if (jsResponse.ok) {
            const js = await jsResponse.text();
            
            // Skip if too large
            if (js.length > maxAssetSize) {
              result.skippedAssets.push(`${jsUrl} (too large: ${(js.length / 1024).toFixed(0)}KB)`);
              continue;
            }
            
            const filename = getFilename(jsUrl, 'js');
            
            result.files.push({
              path: `assets/${filename}`,
              content: js,
              type: 'js',
              size: js.length,
            });
            result.totalSize += js.length;
            
            // Rewrite HTML to point to local file
            html = html.replace(new RegExp(escapeRegex(originalUrl), 'g'), `assets/${filename}`);
            assetCount++;
          }
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : 'Unknown error';
          result.errors.push(`JS: ${originalUrl} - ${errorMsg}`);
        }
      }

      // Extract images (only local ones, skip external)
      const imgMatches = [...html.matchAll(/<img[^>]*src=["']([^"']+\.(png|jpg|jpeg|gif|svg|webp)[^"']*)["']/gi)];
      
      for (const match of imgMatches) {
        if (assetCount >= maxAssets) break;
        
        const originalUrl = match[1];
        
        // Skip data URIs and external images
        if (originalUrl.startsWith('data:') || isExternalCdn(originalUrl)) {
          continue;
        }

        try {
          const imgUrl = resolveUrl(originalUrl, baseUrl);
          
          const assetController = new AbortController();
          const assetTimeoutId = setTimeout(() => assetController.abort(), 10000);

          const imgResponse = await fetch(
            isLocalUrl ? imgUrl : `${requestOrigin}/api/proxy?url=${encodeURIComponent(imgUrl)}`,
            { signal: assetController.signal }
          );

          clearTimeout(assetTimeoutId);

          if (imgResponse.ok) {
            const contentType = imgResponse.headers.get('content-type') || '';
            
            // Only clone text-based images like SVG
            if (contentType.includes('svg') || contentType.includes('text')) {
              const imgContent = await imgResponse.text();
              
              if (imgContent.length < maxAssetSize) {
                const filename = getFilename(imgUrl, 'svg');
                
                result.files.push({
                  path: `assets/${filename}`,
                  content: imgContent,
                  type: 'image',
                  size: imgContent.length,
                });
                result.totalSize += imgContent.length;
                
                html = html.replace(new RegExp(escapeRegex(originalUrl), 'g'), `assets/${filename}`);
                assetCount++;
              }
            } else {
              // For binary images, keep the original URL
              result.skippedAssets.push(`Binary image: ${originalUrl}`);
            }
          }
        } catch (e) {
          // Images are optional, don't fail
          result.errors.push(`Image: ${originalUrl}`);
        }
      }

      // Update the main HTML with rewritten paths
      result.files[0].content = html;
      result.files[0].size = html.length;
    }

    result.success = true;
    
    return NextResponse.json({
      ...result,
      message: `Cloned ${result.files.length} files (${(result.totalSize / 1024).toFixed(1)} KB)`,
    });

  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return NextResponse.json({ 
          error: 'Request timeout - server took too long to respond',
          url: targetUrl.href,
          ...result,
        }, { status: 504 });
      }
      return NextResponse.json({ 
        error: error.message,
        url: targetUrl.href,
        ...result,
      }, { status: 500 });
    }
    return NextResponse.json({ error: 'Unknown error', ...result }, { status: 500 });
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

function isExternalCdn(url: string): boolean {
  const cdnPatterns = [
    'cdn.jsdelivr.net',
    'unpkg.com',
    'cdnjs.cloudflare.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'use.fontawesome.com',
    'kit.fontawesome.com',
    'code.jquery.com',
    'stackpath.bootstrapcdn.com',
    'maxcdn.bootstrapcdn.com',
  ];
  
  return cdnPatterns.some(cdn => url.includes(cdn));
}

function isLargeExternalLibrary(url: string): boolean {
  const largeLibs = [
    'react.production.min.js',
    'react-dom.production.min.js',
    'angular.min.js',
    'vue.global.prod.js',
    'three.min.js',
    'gsap.min.js',
    'bootstrap.bundle.min.js',
    'jquery.min.js',
  ];
  
  const lowerUrl = url.toLowerCase();
  return largeLibs.some(lib => lowerUrl.includes(lib)) && isExternalCdn(url);
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
    if (url.startsWith('data:')) {
      return url; // Data URIs stay as-is
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
    
    // Sanitize filename - preserve dots and dashes
    filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    // Avoid overly long filenames
    if (filename.length > 50) {
      const ext = filename.split('.').pop() || defaultExt;
      filename = `${filename.substring(0, 40)}.${ext}`;
    }
    
    return filename;
  } catch {
    return `file_${Date.now()}.${defaultExt}`;
  }
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
