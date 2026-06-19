import { LICENSE_TIER_LABELS } from '$lib/licensing/tiers';
import {
	CULOCA_LICENSE_TERMS_URL,
	buildAcquireLicensePageUrl,
	buildImageLicenseUrl
} from '$lib/seo/licenseUrls';
import { absoluteUrl } from '$lib/seo/site';

const CULOCA_WIDERRUF_URL = absoluteUrl('/web/widerruf');

/** Gemeinsame Offer-Felder für digitale Bildlizenzen (Google Merchant Listings). */
function buildDigitalLicenseOfferExtras() {
	return {
		itemCondition: 'https://schema.org/NewCondition',
		hasMerchantReturnPolicy: {
			'@type': 'MerchantReturnPolicy',
			applicableCountry: 'DE',
			returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
			merchantReturnDays: 14,
			returnMethod: 'https://schema.org/ReturnByMail',
			returnFees: 'https://schema.org/FreeReturn',
			merchantReturnLink: CULOCA_WIDERRUF_URL
		},
		shippingDetails: {
			'@type': 'OfferShippingDetails',
			shippingRate: {
				'@type': 'MonetaryAmount',
				value: 0,
				currency: 'EUR'
			},
			shippingDestination: {
				'@type': 'DefinedRegion',
				addressCountry: 'DE'
			},
			deliveryTime: {
				'@type': 'ShippingDeliveryTime',
				handlingTime: {
					'@type': 'QuantitativeValue',
					minValue: 0,
					maxValue: 0,
					unitCode: 'DAY'
				},
				transitTime: {
					'@type': 'QuantitativeValue',
					minValue: 0,
					maxValue: 0,
					unitCode: 'DAY'
				}
			}
		}
	};
}

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
	itemId?: string | null;
}) {
	const extras = buildDigitalLicenseOfferExtras();
	const offer = (name: string, cents: number, tier: 'standard' | 'extended') => ({
		'@type': 'Offer',
		name,
		price: (cents / 100).toFixed(2),
		priceCurrency: 'EUR',
		availability: 'https://schema.org/InStock',
		url: args.pageUrl,
		...(args.itemId ? { sku: `culoca-license-${tier}-${args.itemId}` } : {}),
		seller: {
			'@type': 'Organization',
			name: 'Culoca'
		},
		...extras
	});
	return [
		offer(LICENSE_TIER_LABELS.standard, args.standardPriceCents, 'standard'),
		offer(LICENSE_TIER_LABELS.extended, args.extendedPriceCents, 'extended')
	];
}

export function buildLicenseProductJsonLd(args: {
	productName: string;
	description: string;
	imageUrl?: string | null;
	pageUrl: string;
	standardPriceCents: number;
	extendedPriceCents: number;
	itemId?: string | null;
}) {
	return {
		'@type': 'Product',
		name: args.productName,
		description: args.description,
		brand: {
			'@type': 'Brand',
			name: 'Culoca'
		},
		...(args.imageUrl ? { image: args.imageUrl } : {}),
		offers: buildCommercialLicenseOffers({
			pageUrl: args.pageUrl,
			standardPriceCents: args.standardPriceCents,
			extendedPriceCents: args.extendedPriceCents,
			itemId: args.itemId
		})
	};
}
