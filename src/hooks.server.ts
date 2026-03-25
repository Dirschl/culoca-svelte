import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	const path = event.url.pathname;
	if (path.startsWith('/images/similar/') || path.startsWith('/images/embed/')) {
		// Sicherheit gegen “accidental extra tokens”:
		// Für ähnliche/Embed-Thumbnails soll Google-Bildern ausschließlich `noimageindex`
		// als X-Robots-Tag entgegengehalten werden.
		response.headers.set('X-Robots-Tag', 'noimageindex');
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
