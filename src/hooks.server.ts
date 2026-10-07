import type { Handle } from '@sveltejs/kit';
import { GEO_ROUTE_PREFIX } from '$lib/geo/hierarchy';

/** Länder-Kurzcodes: früher Country-Hub unter `/de` statt `/region/de` — nicht Items umleiten. */
const LEGACY_GEO_ROOT_SEGMENTS = new Set(['de', 'at', 'ch', 'lu', 'mc']);

// Alte, bereits veröffentlichte Motiv-URLs bleiben nach redaktionellen Slug-Korrekturen erreichbar.
const LEGACY_ITEM_REDIRECTS = new Map([
	[
		'/foto/rapsfelder-lutbild-arbing-reischach-altoetting-oberbayern-johann-dirschl',
		'/de/altoetting/reischach/rapsfelder-luftbild-arbing-reischach-altoetting-oberbayern-johann-dirschl'
	]
]);

/**
 * Nur kurze Pfade (1–3 Segmente nach Land) → Region-Hub. Items bleiben unter
 * `/de/landkreis/gemeinde/slug` (4 Segmente), keine Umleitung.
 */
function legacyGeoRedirectTarget(pathname: string): string | null {
	const parts = pathname.split('/').filter(Boolean);
	if (!parts.length) return null;
	const root = parts[0].toLowerCase();
	if (!LEGACY_GEO_ROOT_SEGMENTS.has(root)) return null;
	if (parts.length >= 4) return null;
	return `${GEO_ROUTE_PREFIX}/${parts.join('/')}`;
}

export const handle: Handle = async ({ event, resolve }) => {
	const pathname = event.url.pathname;

	// Upload liegt unter /upload (früher /foto/upload)
	if (pathname === '/foto/upload' || pathname.startsWith('/foto/upload/')) {
		const rest = pathname === '/foto/upload' ? '' : pathname.slice('/foto/upload'.length);
		return Response.redirect(new URL(`/upload${rest}${event.url.search}`, event.url.origin), 301);
	}

	const correctedItemPath = LEGACY_ITEM_REDIRECTS.get(pathname);
	if (correctedItemPath) {
		return Response.redirect(new URL(`${correctedItemPath}${event.url.search}`, event.url.origin), 301);
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
		// HTML darf lokal gespeichert, muss aber vor Wiederverwendung validiert werden.
		// `no-store` verhinderte bislang auch bedingte Requests mit dem von SvelteKit
		// gelieferten ETag und zwang Crawler bei jedem Besuch zum Volltransfer.
		response.headers.set('Cache-Control', 'private, no-cache, must-revalidate');
		response.headers.delete('Pragma');
		response.headers.delete('Expires');
	}

	return response;
};
