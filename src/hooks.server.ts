import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // Add noindex headers to all API routes
  if (event.url.pathname.startsWith('/api/')) {
    const response = await resolve(event);
    
    // Add robots headers to prevent indexing
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, nosnippet, noarchive');
    
    return response;
  }
  
  return resolve(event);
};

