import { createHmac, timingSafeEqual } from 'node:crypto';
import type { LicenseTier } from '$lib/licensing/tiers';
import { parseCartLineItemsJson, type CartLinePayload } from '$lib/licensing/cart';
import { normalizeCheckoutUrl } from '$lib/licensing/checkoutUrl';

export type LemonSqueezyConfig = {
	apiKey: string;
	storeId: string;
	webhookSecret: string;
	standardVariantId: string;
	extendedVariantId: string;
	testMode: boolean;
	defaultStandardPriceCents: number;
	defaultExtendedPriceCents: number;
};

export function getLemonSqueezyConfig(): LemonSqueezyConfig | null {
	const apiKey = process.env.LEMONSQUEEZY_API_KEY?.trim();
	const storeId = process.env.LEMONSQUEEZY_STORE_ID?.trim();
	const webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET?.trim();
	const standardVariantId = process.env.LEMONSQUEEZY_VARIANT_STANDARD_ID?.trim();
	const extendedVariantId = process.env.LEMONSQUEEZY_VARIANT_EXTENDED_ID?.trim();

	if (!apiKey || !storeId || !standardVariantId || !extendedVariantId) {
		return null;
	}

	return {
		apiKey,
		storeId,
		webhookSecret: webhookSecret || '',
		standardVariantId,
		extendedVariantId,
		testMode: process.env.LEMONSQUEEZY_TEST_MODE === 'true',
		defaultStandardPriceCents: Number(process.env.CULOCA_LICENSE_STANDARD_PRICE_CENTS || 2900),
		defaultExtendedPriceCents: Number(process.env.CULOCA_LICENSE_EXTENDED_PRICE_CENTS || 9900)
	};
}

export function isCulocaSalesEnabled(): boolean {
	return process.env.CULOCA_SALES_ENABLED === 'true';
}

export function variantIdForTier(config: LemonSqueezyConfig, tier: LicenseTier): string {
	return tier === 'extended' ? config.extendedVariantId : config.standardVariantId;
}


type CheckoutCustomData = Record<string, string>;

export type CreateCheckoutInput = {
	variantId: string;
	priceCents: number;
	productName: string;
	productDescription: string;
	previewImageUrl?: string | null;
	redirectUrl: string;
	custom: CheckoutCustomData;
	testMode?: boolean;
};

export type CreateCheckoutResult = {
	checkoutUrl: string;
	checkoutId: string;
};

export async function createLemonCheckout(
	config: LemonSqueezyConfig,
	input: CreateCheckoutInput
): Promise<CreateCheckoutResult> {
	const body = {
		data: {
			type: 'checkouts',
			attributes: {
				custom_price: input.priceCents,
				test_mode: input.testMode ?? config.testMode,
				product_options: {
					name: input.productName,
					description: input.productDescription,
					redirect_url: input.redirectUrl,
					receipt_button_text: 'Zu meinen Lizenzen',
					receipt_link_url: input.redirectUrl,
					receipt_thank_you_note:
						'Vielen Dank! Ihre Lizenz ist in Ihrem Culoca-Konto unter Einstellungen → Meine Lizenzen verfügbar. Sie können das Bild jederzeit erneut herunterladen.',
					enabled_variants: [Number(input.variantId)],
					...(input.previewImageUrl ? { media: [input.previewImageUrl] } : {})
				},
				checkout_data: {
					custom: input.custom
				}
			},
			relationships: {
				store: { data: { type: 'stores', id: config.storeId } },
				variant: { data: { type: 'variants', id: input.variantId } }
			}
		}
	};

	const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
		method: 'POST',
		headers: {
			Accept: 'application/vnd.api+json',
			'Content-Type': 'application/vnd.api+json',
			Authorization: `Bearer ${config.apiKey}`
		},
		body: JSON.stringify(body)
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Lemon Squeezy checkout failed (${response.status}): ${text}`);
	}

	const json = (await response.json()) as {
		data?: { id?: string; attributes?: { url?: string } };
	};
	const rawCheckoutUrl = json.data?.attributes?.url;
	const checkoutId = json.data?.id;
	if (!rawCheckoutUrl || !checkoutId) {
		throw new Error('Lemon Squeezy checkout response missing url');
	}

	const checkoutUrl = normalizeCheckoutUrl(rawCheckoutUrl);

	return { checkoutUrl, checkoutId };
}

export function verifyLemonWebhookSignature(
	rawBody: string,
	signatureHeader: string | null,
	secret: string
): boolean {
	if (!secret || !signatureHeader) return false;
	const digest = createHmac('sha256', secret).update(rawBody).digest('hex');
	try {
		return timingSafeEqual(Buffer.from(digest), Buffer.from(signatureHeader));
	} catch {
		return false;
	}
}

export type LemonWebhookPayload = {
	meta?: {
		event_name?: string;
		custom_data?: Record<string, string>;
	};
	data?: {
		id?: string;
		type?: string;
		attributes?: Record<string, unknown>;
	};
};

export type ParsedWebhookOrder = {
	buyerUserId: string;
	mode: 'cart' | 'single';
	lineItems: CartLinePayload[];
};

export function parseWebhookOrder(payload: LemonWebhookPayload): ParsedWebhookOrder | null {
	const custom = payload.meta?.custom_data;
	if (!custom?.buyer_user_id) return null;

	const buyerUserId = String(custom.buyer_user_id);

	if (custom.checkout_mode === 'cart' && custom.line_items) {
		const lineItems = parseCartLineItemsJson(String(custom.line_items));
		if (!lineItems.length) return null;
		return { buyerUserId, mode: 'cart', lineItems };
	}

	if (custom.item_id && custom.license_tier) {
		const tier = custom.license_tier;
		if (tier !== 'standard' && tier !== 'extended') return null;
		const priceCents = Number(custom.price_cents || 0);
		return {
			buyerUserId,
			mode: 'single',
			lineItems: [
				{
					item_id: String(custom.item_id),
					license_tier: tier as LicenseTier,
					price_cents: Number.isFinite(priceCents) && priceCents >= 100 ? priceCents : 0
				}
			]
		};
	}

	return null;
}

/** @deprecated use parseWebhookOrder */
export function parseWebhookCustomData(payload: LemonWebhookPayload) {
	const order = parseWebhookOrder(payload);
	if (!order || order.lineItems.length !== 1) return null;
	const line = order.lineItems[0];
	return {
		item_id: line.item_id,
		buyer_user_id: order.buyerUserId,
		license_tier: line.license_tier
	};
}
