import { SITE_URL } from '$lib/seo/site';

const IMAGES_BASE = `${SITE_URL}/images`;

function imageVersionToken(
	source: { updated_at?: string | null; created_at?: string | null } | null | undefined
): string | null {
	const rawValue = source?.updated_at || source?.created_at;
	if (!rawValue) return null;
	const timestamp = new Date(rawValue).getTime();
	return Number.isFinite(timestamp) ? String(timestamp) : null;
}

function appendVersionParam(
	url: string,
	source: { updated_at?: string | null; created_at?: string | null } | null | undefined
): string {
	const version = imageVersionToken(source);
	if (!version) return url;
	const separator = url.includes('?') ? '&' : '?';
	return `${url}${separator}v=${version}`;
}

/**
 * CDN-URL des Item-Hauptbildes (2048, sonst 512) inkl. v=-Cachebuster —
 * gleiche Logik wie `src` / `primaryImageAbsoluteUrl` auf der Item-Seite.
 */
export function buildItemHeroCdnImageUrl(item: {
	slug: string | null | undefined;
	path_2048?: string | null;
	path_512?: string | null;
	updated_at?: string | null;
	created_at?: string | null;
}): string | null {
	const imagePath = item.path_2048 || item.path_512;
	if (!imagePath || !item.slug) return null;
	const extensionMatch = imagePath.match(/\.(jpg|jpeg|webp|png)$/i);
	const fileExtension = extensionMatch ? extensionMatch[0].toLowerCase() : '.jpg';
	const sizeSuffix = item.path_2048 ? '2048' : '512';
	const base = `${IMAGES_BASE}/${item.slug}-${sizeSuffix}${fileExtension}`;
	return appendVersionParam(base, item);
}
