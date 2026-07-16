import { afterEach, describe, expect, it } from 'vitest';
import { normalizeCheckoutUrl } from './checkoutUrl';

describe('normalizeCheckoutUrl', () => {
	afterEach(() => {
		delete process.env.LEMONSQUEEZY_CHECKOUT_HOST;
	});

	it('uses the configured Lemon Squeezy checkout host', () => {
		process.env.LEMONSQUEEZY_CHECKOUT_HOST = 'checkout.culoca.com';

		expect(normalizeCheckoutUrl('https://culoca.lemonsqueezy.com/checkout/buy/abc')).toBe(
			'https://checkout.culoca.com/checkout/buy/abc'
		);
	});

	it('accepts a configured host with protocol or trailing path', () => {
		process.env.LEMONSQUEEZY_CHECKOUT_HOST = 'https://checkout.culoca.com/';

		expect(normalizeCheckoutUrl('https://culoca.lemonsqueezy.com/checkout/buy/abc')).toBe(
			'https://checkout.culoca.com/checkout/buy/abc'
		);
	});

	it('falls back to apex host normalization', () => {
		expect(normalizeCheckoutUrl('https://www.culoca.com/checkout/buy/abc')).toBe(
			'https://culoca.com/checkout/buy/abc'
		);
	});
});
