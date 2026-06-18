import { getPublicItemDownloadHref } from '$lib/content/routing';
import { absoluteUrl, SITE_URL } from '$lib/seo/site';

/** Allgemeine Lizenzbedingungen (rechtlicher Rahmen). */
export const CULOCA_LICENSE_TERMS_URL = `${SITE_URL}/web/license`;

/** Kommerzielle Lizenzierung / Kauf pro Bild. */
export function buildAcquireLicensePageUrl(item: {
	slug?: string | null;
	canonical_path?: string | null;
	canonicalPath?: string | null;
}): string {
	return absoluteUrl(getPublicItemDownloadHref(item));
}

/** Schema.org license — verweist auf die Bild-spezifischen Nutzungsbedingungen auf der Kauf-/Download-Seite. */
export function buildImageLicenseUrl(item: {
	slug?: string | null;
	canonical_path?: string | null;
	canonicalPath?: string | null;
}): string {
	return `${buildAcquireLicensePageUrl(item)}#lizenzbedingungen`;
}
