import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);

  const path = event.url.pathname;
  if (path.startsWith('/images/similar/') || path.startsWith('/images/embed/')) {
    const cur = response.headers.get('X-Robots-Tag') || '';
    if (!/\bnoimageindex\b/i.test(cur)) {
      response.headers.set('X-Robots-Tag', cur ? `${cur}, noimageindex` : 'noimageindex');
    }
  }

  if (event.url.pathname.startsWith('/api/')) {
    // Add robots headers to prevent indexing on API routes.
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, nosnippet, noarchive');
  }

  const contentType = response.headers.get('content-type') || '';
  const isHtmlDocument = contentType.includes('text/html');
  if (isHtmlDocument) {
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }

  return response;
};
