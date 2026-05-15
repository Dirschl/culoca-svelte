import { SITE_URL } from '$lib/seo/site';

const IMAGES_BASE = `${SITE_URL}/images`;

/**
 * Stabile CDN-URL des Item-Hauptbildes (2048, sonst 512).
 * Dieselbe URL wird für Preload, sichtbares <img>, OG, JSON-LD und Sitemap verwendet.
 */
export function buildItemHeroCdnImageUrl(item: {
	slug: string | null | undefined;
	path_2048?: string | null;
	path_512?: string | null;
}): string | null {
	const imagePath = item.path_2048 || item.path_512;
	if (!imagePath || !item.slug) return null;
	const extensionMatch = imagePath.match(/\.(jpg|jpeg|webp|png)$/i);
	const fileExtension = extensionMatch ? extensionMatch[0].toLowerCase() : '.jpg';
	const sizeSuffix = item.path_2048 ? '2048' : '512';
	return `${IMAGES_BASE}/${item.slug}-${sizeSuffix}${fileExtension}`;
}
