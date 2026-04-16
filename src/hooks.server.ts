import type { Handle } from '@sveltejs/kit';
import { GEO_ROUTE_PREFIX } from '$lib/geo/hierarchy';

/** Frühere Geo-URLs ohne `/region`-Präfix (Bookmarks, alte canonical_path). */
const LEGACY_GEO_ROOT_SEGMENTS = new Set(['de', 'at', 'ch', 'lu', 'mc']);

function legacyGeoRedirectTarget(pathname: string): string | null {
	const parts = pathname.split('/').filter(Boolean);
	if (!parts.length) return null;
	const root = parts[0].toLowerCase();
	if (!LEGACY_GEO_ROOT_SEGMENTS.has(root)) return null;
	return `${GEO_ROUTE_PREFIX}/${parts.join('/')}`;
}

export const handle: Handle = async ({ event, resolve }) => {
	const pathname = event.url.pathname;

	// Upload liegt unter /upload (früher /foto/upload)
	if (pathname === '/foto/upload' || pathname.startsWith('/foto/upload/')) {
		const rest = pathname === '/foto/upload' ? '' : pathname.slice('/foto/upload'.length);
		return Response.redirect(new URL(`/upload${rest}${event.url.search}`, event.url.origin), 301);
	}

	const legacyTarget = legacyGeoRedirectTarget(pathname);
	if (legacyTarget) {
		return Response.redirect(new URL(`${legacyTarget}${event.url.search}`, event.url.origin), 301);
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
