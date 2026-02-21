import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  
  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  // Determine if this is a local/development URL
  const isLocalUrl = (targetUrl: string): boolean => {
    try {
      const parsed = new URL(targetUrl);
      const localHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
      const localPatterns = [/^192\.168\./, /^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./];
      
      if (localHosts.includes(parsed.hostname)) return true;
      if (localPatterns.some(p => p.test(parsed.hostname))) return true;
      if (parsed.hostname.endsWith('.local') || parsed.hostname.endsWith('.test')) return true;
      
      // Check for z.ai workspace URLs - they should use direct embed for full functionality
      if (parsed.hostname.endsWith('.z.ai') || parsed.hostname.includes('space.z.ai')) return true;
      
      return false;
    } catch {
      return false;
    }
  };

  const isLocal = isLocalUrl(url);
  
  try {
    // Use GET instead of HEAD because some servers return 403 for HEAD
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    // Read a small portion to check content type
    const contentType = response.headers.get('content-type') || '';
    
    // Detect server type from headers
    const serverHeader = response.headers.get('server') || '';
    const xPoweredBy = response.headers.get('x-powered-by') || '';
    
    const isNextJs = 
      xPoweredBy.toLowerCase().includes('next') ||
      response.headers.get('x-nextjs-cache') !== null ||
      url.includes('_next') ||
      contentType.includes('text/html'); // Most z.ai URLs are Next.js

    // Read the response body for HTML content
    let htmlSize = 0;
    if (contentType.includes('text/html')) {
      const text = await response.text();
      htmlSize = text.length;
    }

    return NextResponse.json({
      status: 'online',
      isLocal,
      isNextJs,
      serverInfo: {
        server: serverHeader,
        poweredBy: xPoweredBy,
        contentType,
      },
      httpStatus: response.status,
      htmlSize,
      timestamp: Date.now(),
    });

  } catch (error: unknown) {
    // Determine error type
    let status = 'offline';
    let errorType = 'unknown';
    let errorMessage = 'Unknown error';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      if (error.name === 'AbortError') {
        status = 'timeout';
        errorType = 'timeout';
      } else if ((error as any).cause?.code === 'ECONNREFUSED') {
        status = 'offline';
        errorType = 'connection_refused';
      } else if ((error as any).cause?.code === 'ENOTFOUND') {
        status = 'not_found';
        errorType = 'host_not_found';
      }
    }

    return NextResponse.json({
      status,
      isLocal,
      isNextJs: false,
      error: errorMessage,
      errorType,
      timestamp: Date.now(),
    });
  }
}
