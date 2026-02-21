import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  
  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  // Validate URL format
  let targetUrl: URL;
  try {
    targetUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
  }

  try {
    // Fetch the target URL server-side (bypassing CORS)
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 MindKey/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
    });

    const contentType = response.headers.get('content-type') || 'text/html';
    
    // Handle different content types
    if (contentType.includes('text/html') || contentType.includes('application/xhtml+xml')) {
      const html = await response.text();
      
      return new NextResponse(html, {
        status: response.status,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'X-Proxy-Source': 'mind-key',
          'X-Original-URL': url,
        },
      });
    } else {
      // For non-HTML resources (CSS, JS, images, etc.)
      const arrayBuffer = await response.arrayBuffer();
      
      return new NextResponse(arrayBuffer, {
        status: response.status,
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'X-Proxy-Source': 'mind-key',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
  } catch (error: any) {
    console.error('Proxy error:', error);
    
    // Provide more detailed error information
    let errorMessage = error.message;
    let errorCode = 'PROXY_ERROR';
    
    if (error.cause?.code === 'ECONNREFUSED') {
      errorMessage = `Connection refused - the server at ${targetUrl.host} is not responding`;
      errorCode = 'CONNECTION_REFUSED';
    } else if (error.cause?.code === 'ENOTFOUND') {
      errorMessage = `Host not found - ${targetUrl.host}`;
      errorCode = 'HOST_NOT_FOUND';
    } else if (error.cause?.code === 'ETIMEDOUT') {
      errorMessage = `Connection timed out - ${targetUrl.host}`;
      errorCode = 'TIMEOUT';
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      code: errorCode,
      url: url 
    }, { status: 502 });
  }
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
