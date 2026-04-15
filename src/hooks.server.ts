import type { Handle } from '@sveltejs/kit';
import { PRIMARY_REGIONAL_FEED_PATH } from '$lib/content/routing';

export const handle: Handle = async ({ event, resolve }) => {
	const pathname = event.url.pathname;

	// Legacy: /foto → regionaler Hub (einheitliche Entdeckungs-URLs für Google & Nutzer)
	if (pathname === '/foto') {
		return Response.redirect(new URL(`${PRIMARY_REGIONAL_FEED_PATH}${event.url.search}`, event.url.origin), 301);
	}
	// Upload liegt unter /upload (früher /foto/upload)
	if (pathname === '/foto/upload' || pathname.startsWith('/foto/upload/')) {
		const rest = pathname === '/foto/upload' ? '' : pathname.slice('/foto/upload'.length);
		return Response.redirect(new URL(`/upload${rest}${event.url.search}`, event.url.origin), 301);
	}

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
