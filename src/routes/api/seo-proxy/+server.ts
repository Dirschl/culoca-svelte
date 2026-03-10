import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return new Response('URL parameter is required', { status: 400 });
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
      }
    });

    if (!response.ok) {
      return new Response(`HTTP ${response.status}: ${response.statusText}`, { status: response.status });
    }

    let html = await response.text();

    const parsed = new URL(targetUrl);
    const base = parsed.origin + parsed.pathname.replace(/\/[^/]*$/, '/');
    const baseTag = `<base href="${base}">`;

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
        'Content-Type': response.headers.get('Content-Type') || 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Frame-Options': 'SAMEORIGIN',
      }
    });
  } catch (err: any) {
    return new Response(`Fetch error: ${err.message}`, { status: 500 });
  }
};
