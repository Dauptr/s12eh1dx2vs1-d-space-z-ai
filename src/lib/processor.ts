/**
 * HTML Processor for Mind Key
 * Handles URL rewriting and script injection for preview iframe
 */

/**
 * Rewrites all resource URLs in HTML to go through the proxy
 */
export function rewriteUrls(html: string, baseUrl: string): string {
  try {
    const base = new URL(baseUrl);
    const origin = base.origin;
    
    // Create proxy URL
    const createProxyUrl = (url: string): string => {
      try {
        // If it's a relative URL, make it absolute
        if (url.startsWith('/')) {
          url = `${origin}${url}`;
        } else if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:') && !url.startsWith('blob:')) {
          url = `${origin}/${url}`;
        }
        // Skip data URLs and blob URLs
        if (url.startsWith('data:') || url.startsWith('blob:')) {
          return url;
        }
        return `/api/proxy?url=${encodeURIComponent(url)}`;
      } catch {
        return url;
      }
    };

    // Rewrite href attributes for link elements (CSS, icons, etc.)
    html = html.replace(
      /<link([^>]*)href=["']([^"']+)["']([^>]*)>/gi,
      (match, before, href, after) => {
        if (href.startsWith('data:') || href.startsWith('/api/proxy')) {
          return match;
        }
        const newHref = createProxyUrl(href);
        return `<link${before}href="${newHref}"${after}>`;
      }
    );

    // Rewrite src attributes for script elements
    html = html.replace(
      /<script([^>]*)src=["']([^"']+)["']([^>]*)>/gi,
      (match, before, src, after) => {
        if (src.startsWith('data:') || src.startsWith('/api/proxy')) {
          return match;
        }
        const newSrc = createProxyUrl(src);
        return `<script${before}src="${newSrc}"${after}>`;
      }
    );

    // Rewrite src attributes for img elements
    html = html.replace(
      /<img([^>]*)src=["']([^"']+)["']([^>]*)>/gi,
      (match, before, src, after) => {
        if (src.startsWith('data:') || src.startsWith('/api/proxy')) {
          return match;
        }
        const newSrc = createProxyUrl(src);
        return `<img${before}src="${newSrc}"${after}>`;
      }
    );

    // Rewrite srcset for responsive images
    html = html.replace(
      /srcset=["']([^"']+)["']/gi,
      (match, srcset) => {
        const newSrcset = srcset.split(',').map(entry => {
          const parts = entry.trim().split(/\s+/);
          if (parts[0] && !parts[0].startsWith('data:') && !parts[0].startsWith('/api/proxy')) {
            parts[0] = createProxyUrl(parts[0]);
          }
          return parts.join(' ');
        }).join(', ');
        return `srcset="${newSrcset}"`;
      }
    );

    // Rewrite src attributes for iframe elements
    html = html.replace(
      /<iframe([^>]*)src=["']([^"']+)["']([^>]*)>/gi,
      (match, before, src, after) => {
        if (src.startsWith('data:') || src.startsWith('/api/proxy')) {
          return match;
        }
        const newSrc = createProxyUrl(src);
        return `<iframe${before}src="${newSrc}"${after}>`;
      }
    );

    // Rewrite src attributes for video/audio/source elements
    html = html.replace(
      /<(video|audio|source)([^>]*)src=["']([^"']+)["']([^>]*)>/gi,
      (match, tag, before, src, after) => {
        if (src.startsWith('data:') || src.startsWith('/api/proxy')) {
          return match;
        }
        const newSrc = createProxyUrl(src);
        return `<${tag}${before}src="${newSrc}"${after}>`;
      }
    );

    // Rewrite url() in inline styles
    html = html.replace(
      /url\(["']?([^"')]+)["']?\)/gi,
      (match, url) => {
        if (url.startsWith('data:') || url.startsWith('/api/proxy')) {
          return match;
        }
        const newUrl = createProxyUrl(url);
        return `url("${newUrl}")`;
      }
    );

    return html;
  } catch (error) {
    console.error('Error rewriting URLs:', error);
    return html;
  }
}

/**
 * Generates the injected scripts for iframe functionality
 */
export function getInjectedScripts(baseUrl: string): string {
  return `
<script>
(function() {
  'use strict';
  
  // Store base URL
  const BASE_URL = "${baseUrl}";
  
  // Safe console intercept - wrapped in try-catch
  try {
    const originalConsole = {
      log: console.log.bind(console),
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      info: console.info.bind(console)
    };
    
    function safeStringify(obj) {
      try {
        if (obj === undefined) return 'undefined';
        if (obj === null) return 'null';
        if (typeof obj === 'function') return obj.toString();
        if (typeof obj === 'object') {
          return JSON.stringify(obj, null, 2);
        }
        return String(obj);
      } catch (e) {
        return '[Object]';
      }
    }
    
    function sendToParent(type, args) {
      try {
        if (window.parent === window) return; // Not in iframe
        window.parent.postMessage({
          type: 'console',
          method: type,
          args: args.map(safeStringify)
        }, '*');
      } catch (e) {
        // Silently fail for cross-origin issues
      }
    }
    
    console.log = function() {
      originalConsole.log.apply(console, arguments);
      sendToParent('log', Array.from(arguments));
    };
    
    console.error = function() {
      originalConsole.error.apply(console, arguments);
      sendToParent('error', Array.from(arguments));
    };
    
    console.warn = function() {
      originalConsole.warn.apply(console, arguments);
      sendToParent('warn', Array.from(arguments));
    };
    
    console.info = function() {
      originalConsole.info.apply(console, arguments);
      sendToParent('info', Array.from(arguments));
    };
  } catch (e) {
    // Console interception failed - continue anyway
  }
  
  // Navigation interceptor
  try {
    document.addEventListener('click', function(e) {
      let target = e.target;
      while (target && target.tagName !== 'A') {
        target = target.parentElement;
      }
      
      if (target && target.tagName === 'A') {
        const href = target.getAttribute('href');
        if (href && !href.startsWith('#') && !href.startsWith('javascript:') && 
            target.target !== '_blank' && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          
          let fullUrl;
          try {
            fullUrl = new URL(href, BASE_URL).href;
          } catch {
            fullUrl = href;
          }
          
          try {
            window.parent.postMessage({
              type: 'navigate',
              url: fullUrl
            }, '*');
          } catch {
            // Cross-origin blocked
          }
        }
      }
    }, true);
  } catch (e) {
    // Navigation interception failed
  }
  
  // JS Executor listener
  try {
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'execute') {
        try {
          const result = eval(e.data.code);
          Promise.resolve(result).then(value => {
            try {
              let output = value;
              if (typeof value === 'object') {
                try {
                  output = JSON.stringify(value, null, 2);
                } catch {
                  output = String(value);
                }
              }
              window.parent.postMessage({
                type: 'executeResult',
                result: String(output),
                isError: false
              }, '*');
            } catch {
              // Send result failed
            }
          }).catch(err => {
            try {
              window.parent.postMessage({
                type: 'executeResult',
                result: err.message || String(err),
                isError: true
              }, '*');
            } catch {
              // Send error failed
            }
          });
        } catch (err) {
          try {
            window.parent.postMessage({
              type: 'executeResult',
              result: err.message || String(err),
              isError: true
            }, '*');
          } catch {
            // Send error failed
          }
        }
      }
    });
  } catch (e) {
    // Message listener failed
  }
  
  // Signal ready
  try {
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'ready',
        url: window.location.href,
        title: document.title
      }, '*');
    }
  } catch (e) {
    // Ready signal failed
  }
  
})();
</script>
`;
}

/**
 * Injects scripts into HTML head
 */
export function injectScripts(html: string, baseUrl: string): string {
  const scripts = getInjectedScripts(baseUrl);
  
  // Try to inject into head
  if (html.includes('</head>')) {
    return html.replace('</head>', `${scripts}</head>`);
  }
  
  // Try to inject after opening html tag
  if (html.includes('<html')) {
    return html.replace(/<html[^>]*>/, `$&${scripts}`);
  }
  
  // Just prepend to the beginning
  return scripts + html;
}

/**
 * Process HTML for preview: rewrite URLs and inject scripts
 */
export function processHtml(html: string, baseUrl: string): string {
  let processed = rewriteUrls(html, baseUrl);
  processed = injectScripts(processed, baseUrl);
  return processed;
}
