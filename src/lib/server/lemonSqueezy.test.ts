import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	createLemonCheckout,
	parseWebhookOrder,
	type LemonSqueezyConfig,
	validateWebhookOrderContext,
	validateWebhookSource,
	verifyLemonWebhookSignature
} from './lemonSqueezy';

const config: LemonSqueezyConfig = {
	apiKey: 'test-key',
	storeId: '410993',
	webhookSecret: 'secret',
	standardVariantId: '1807065',
	extendedVariantId: '1807072',
	testMode: true,
	defaultStandardPriceCents: 2900,
	defaultExtendedPriceCents: 9900
};

function orderPayload(overrides: Record<string, unknown> = {}) {
	return {
		meta: {
			event_name: 'order_created',
			custom_data: {
				checkout_mode: 'single',
				buyer_user_id: 'buyer-1',
				item_id: 'item-1',
				license_tier: 'standard',
				price_cents: '2900'
			}
		},
		data: {
			id: 'order-1',
			type: 'orders',
			attributes: {
				store_id: 410993,
				test_mode: true,
				status: 'paid',
				first_order_item: { variant_id: 1807065 },
				...overrides
			}
		}
	};
}

describe('Lemon Squeezy integration', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('verifies only the exact HMAC signature', () => {
		const body = JSON.stringify({ hello: 'culoca' });
		const signature = createHmac('sha256', config.webhookSecret).update(body).digest('hex');
		expect(verifyLemonWebhookSignature(body, signature, config.webhookSecret)).toBe(true);
		expect(verifyLemonWebhookSignature(`${body}x`, signature, config.webhookSecret)).toBe(false);
		expect(verifyLemonWebhookSignature(body, 'not-a-signature', config.webhookSecret)).toBe(false);
	});

	it('parses server-provided single checkout data', () => {
		expect(parseWebhookOrder(orderPayload())).toEqual({
			buyerUserId: 'buyer-1',
			mode: 'single',
			lineItems: [{ item_id: 'item-1', license_tier: 'standard', price_cents: 2900 }]
		});
	});

	it.each([
		['store_id', { store_id: 999 }, 'Webhook store mismatch'],
		['test_mode', { test_mode: false }, 'Webhook test mode mismatch'],
		['status', { status: 'pending' }, 'Order is not paid'],
		['variant_id', { first_order_item: { variant_id: 999 } }, 'Webhook variant mismatch']
	])('rejects an order with invalid %s', (_field, overrides, message) => {
		const payload = orderPayload(overrides);
		const order = parseWebhookOrder(payload);
		expect(order).not.toBeNull();
		expect(validateWebhookOrderContext(payload, config, order!)).toBe(message);
	});

	it('rejects a refund from another store before revoking access', () => {
		const payload = orderPayload({ store_id: 999 });
		payload.meta.event_name = 'order_refunded';
		expect(validateWebhookSource(payload, config)).toBe('Webhook store mismatch');
	});

	it('creates a test checkout with the configured store, variant and custom data', async () => {
		const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
			const body = JSON.parse(String(init.body));
			expect(body.data.attributes.test_mode).toBe(true);
			expect(body.data.attributes.custom_price).toBe(2900);
			expect(body.data.attributes.checkout_data.custom.buyer_user_id).toBe('buyer-1');
			expect(body.data.relationships.store.data.id).toBe('410993');
			expect(body.data.relationships.variant.data.id).toBe('1807065');
			return new Response(
				JSON.stringify({
					data: {
						id: 'checkout-1',
						attributes: { url: 'https://culoca.lemonsqueezy.com/checkout/custom/1' }
					}
				}),
				{ status: 201, headers: { 'Content-Type': 'application/json' } }
			);
		});
		vi.stubGlobal('fetch', fetchMock);

		await expect(
			createLemonCheckout(config, {
				variantId: config.standardVariantId,
				priceCents: 2900,
				productName: 'Standard-Lizenz: Testbild',
				productDescription: 'Test',
				redirectUrl: 'https://culoca.com/dashboard?section=licenses&purchase=success',
				custom: { buyer_user_id: 'buyer-1' }
			})
		).resolves.toEqual({
			checkoutId: 'checkout-1',
			checkoutUrl: 'https://culoca.lemonsqueezy.com/checkout/custom/1'
		});
	});
});
