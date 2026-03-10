import type { RequestHandler } from './$types';

const PROXY_PATH = '/api/seo-proxy?url=';

function proxyUrl(absoluteUrl: string): string {
  return PROXY_PATH + encodeURIComponent(absoluteUrl);
}

function rewriteOriginUrls(content: string, origin: string): string {
  return content.replace(
    new RegExp(origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/[^"\'\\s)]*', 'g'),
    (match) => proxyUrl(match)
  );
}

function rewriteCssUrls(css: string, cssBaseUrl: string): string {
  return css.replace(
    /url\(\s*['"]?([^'")]+)['"]?\s*\)/g,
    (_match, rawUrl: string) => {
      const trimmed = rawUrl.trim();
      if (trimmed.startsWith('data:') || trimmed.startsWith('#')) return _match;
      try {
        const absolute = new URL(trimmed, cssBaseUrl).href;
        return `url('${proxyUrl(absolute)}')`;
      } catch {
        return _match;
      }
    }
  );
}

export const GET: RequestHandler = async ({ url }) => {
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return new Response('URL parameter is required', { status: 400 });
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': '*/*',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
      }
    });

    if (!response.ok) {
      return new Response(`HTTP ${response.status}: ${response.statusText}`, { status: response.status });
    }

    const contentType = response.headers.get('Content-Type') || '';
    const isHtml = contentType.includes('html') || contentType.includes('xml');
    const isCss = contentType.includes('css');

    if (isHtml) {
      let html = await response.text();
      const parsed = new URL(targetUrl);
      const origin = parsed.origin;

      html = rewriteOriginUrls(html, origin);

      const base = origin + parsed.pathname.replace(/\/[^/]*$/, '/');
      const baseTag = `<base href="${proxyUrl(base)}">`;

      if (html.includes('<head>')) {
        html = html.replace('<head>', `<head>${baseTag}`);
      } else if (html.includes('<head ')) {
        html = html.replace(/<head\s[^>]*>/, `$&${baseTag}`);
      } else if (html.includes('<html')) {
        html = html.replace(/<html[^>]*>/, `$&<head>${baseTag}</head>`);
      } else {
        html = `<head>${baseTag}</head>${html}`;
      }

      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': contentType || 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
          'X-Frame-Options': 'SAMEORIGIN',
        }
      });
    }

    if (isCss) {
      let css = await response.text();
      css = rewriteCssUrls(css, targetUrl);

      return new Response(css, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600',
        }
      });
    }

    const body = await response.arrayBuffer();
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (err: any) {
    return new Response(`Fetch error: ${err.message}`, { status: 500 });
  }
};
