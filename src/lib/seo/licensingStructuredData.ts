import {
	CULOCA_LICENSE_TERMS_URL,
	buildAcquireLicensePageUrl,
	buildImageLicenseUrl
} from '$lib/seo/licenseUrls';

export function resolveImageLicenseSchemaUrls(args: {
	commercialSale: boolean;
	item: {
		slug?: string | null;
		canonical_path?: string | null;
		canonicalPath?: string | null;
	};
	attributionLicenseUrl?: string | null;
}): { license: string; acquireLicensePage: string } {
	const fallback = args.attributionLicenseUrl?.trim() || CULOCA_LICENSE_TERMS_URL;
	if (!args.commercialSale) {
		return { license: fallback, acquireLicensePage: fallback };
	}
	return {
		license: buildImageLicenseUrl(args.item),
		acquireLicensePage: buildAcquireLicensePageUrl(args.item)
	};
}
