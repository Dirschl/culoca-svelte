import { LICENSE_TIER_LABELS } from '$lib/licensing/tiers';
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

export function buildCommercialLicenseOffers(args: {
	pageUrl: string;
	standardPriceCents: number;
	extendedPriceCents: number;
}) {
	const offer = (name: string, cents: number) => ({
		'@type': 'Offer',
		name,
		price: (cents / 100).toFixed(2),
		priceCurrency: 'EUR',
		availability: 'https://schema.org/InStock',
		url: args.pageUrl,
		seller: {
			'@type': 'Organization',
			name: 'Culoca'
		}
	});
	return [
		offer(LICENSE_TIER_LABELS.standard, args.standardPriceCents),
		offer(LICENSE_TIER_LABELS.extended, args.extendedPriceCents)
	];
}

export function buildLicenseProductJsonLd(args: {
	productName: string;
	description: string;
	imageUrl?: string | null;
	pageUrl: string;
	standardPriceCents: number;
	extendedPriceCents: number;
}) {
	return {
		'@type': 'Product',
		name: args.productName,
		description: args.description,
		...(args.imageUrl ? { image: args.imageUrl } : {}),
		offers: buildCommercialLicenseOffers({
			pageUrl: args.pageUrl,
			standardPriceCents: args.standardPriceCents,
			extendedPriceCents: args.extendedPriceCents
		})
	};
}
