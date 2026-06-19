import { describe, expect, it } from 'vitest';
import {
	CULOCA_LICENSE_TERMS_URL,
	buildAcquireLicensePageUrl,
	buildImageLicenseUrl
} from './licenseUrls';
import { resolveImageLicenseSchemaUrls, buildLicenseProductJsonLd } from './licensingStructuredData';

describe('licenseUrls', () => {
	it('builds download acquire URL from canonical path', () => {
		expect(
			buildAcquireLicensePageUrl({
				canonical_path: '/deutschland/bayern/cham/lohberg/hindenburgkanzel-lohberg'
			})
		).toBe(
			'https://culoca.com/deutschland/bayern/cham/lohberg/hindenburgkanzel-lohberg/download'
		);
	});

	it('builds image license anchor URL', () => {
		expect(
			buildImageLicenseUrl({ canonical_path: '/item/test-foto' })
		).toBe('https://culoca.com/item/test-foto/download#lizenzbedingungen');
	});
});

describe('resolveImageLicenseSchemaUrls', () => {
	const item = { canonical_path: '/item/shop-foto' };

	it('uses general terms when not commercially for sale', () => {
		expect(
			resolveImageLicenseSchemaUrls({
				commercialSale: false,
				item,
				attributionLicenseUrl: 'https://example.com/license'
			})
		).toEqual({
			license: 'https://example.com/license',
			acquireLicensePage: 'https://example.com/license'
		});
	});

	it('uses per-image download URLs when commercially for sale', () => {
		const urls = resolveImageLicenseSchemaUrls({
			commercialSale: true,
			item
		});
		expect(urls.acquireLicensePage).toBe('https://culoca.com/item/shop-foto/download');
		expect(urls.license).toBe(
			'https://culoca.com/item/shop-foto/download#lizenzbedingungen'
		);
	});

	it('falls back to culoca license terms', () => {
		expect(
			resolveImageLicenseSchemaUrls({ commercialSale: false, item: {} }).license
		).toBe(CULOCA_LICENSE_TERMS_URL);
	});
});

describe('buildLicenseProductJsonLd', () => {
	it('includes brand and merchant listing fields on offers', () => {
		const product = buildLicenseProductJsonLd({
			productName: 'Bildlizenz: Test',
			description: 'Test',
			pageUrl: 'https://culoca.com/item/x/download',
			standardPriceCents: 2900,
			extendedPriceCents: 9900,
			itemId: 'abc-123'
		});
		expect(product.brand).toEqual({ '@type': 'Brand', name: 'Culoca' });
		expect(product.offers).toHaveLength(2);
		const offer = product.offers[0] as Record<string, unknown>;
		expect(offer.sku).toBe('culoca-license-standard-abc-123');
		expect(offer.hasMerchantReturnPolicy).toMatchObject({
			'@type': 'MerchantReturnPolicy',
			merchantReturnLink: 'https://culoca.com/web/widerruf'
		});
		expect(offer.shippingDetails).toMatchObject({
			'@type': 'OfferShippingDetails',
			shippingRate: { value: 0, currency: 'EUR' }
		});
	});
});
