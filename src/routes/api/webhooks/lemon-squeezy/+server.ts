import { error, json, type RequestHandler } from '@sveltejs/kit';
import {
	getLemonSqueezyConfig,
	parseWebhookOrder,
	verifyLemonWebhookSignature,
	type LemonWebhookPayload
} from '$lib/server/lemonSqueezy';
import { grantLicensePurchase, revokeLicenseByOrderId } from '$lib/server/licensePurchases';
import { supabaseAdmin } from '$lib/supabaseAdmin';

export const POST: RequestHandler = async ({ request }) => {
	const config = getLemonSqueezyConfig();
	if (!config?.webhookSecret) {
		throw error(503, 'Webhook not configured');
	}

	const rawBody = await request.text();
	const signature = request.headers.get('x-signature');

	if (!verifyLemonWebhookSignature(rawBody, signature, config.webhookSecret)) {
		throw error(401, 'Invalid webhook signature');
	}

	let payload: LemonWebhookPayload;
	try {
		payload = JSON.parse(rawBody) as LemonWebhookPayload;
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const eventName = payload.meta?.event_name || '';

	if (eventName === 'order_created') {
		const order = parseWebhookOrder(payload);
		if (!order) {
			console.warn('[Lemon Webhook] order_created without valid custom_data');
			return json({ ok: true, skipped: true });
		}

		const attrs = payload.data?.attributes || {};
		const orderId = String(payload.data?.id || attrs.identifier || '');
		if (!orderId) {
			throw error(400, 'Missing order id');
		}

		const orderTotal = typeof attrs.total === 'number' ? attrs.total : null;
		let granted = 0;

		for (const line of order.lineItems) {
			let sellerProfileId: string | null = null;
			if (supabaseAdmin) {
				const { data: itemRow } = await supabaseAdmin
					.from('items')
					.select('profile_id')
					.eq('id', line.item_id)
					.maybeSingle();
				sellerProfileId = itemRow?.profile_id ?? null;
			}

			const linePrice =
				line.price_cents > 0
					? line.price_cents
					: orderTotal && order.lineItems.length === 1
						? orderTotal
						: null;

			await grantLicensePurchase({
				buyerUserId: order.buyerUserId,
				itemId: line.item_id,
				sellerProfileId,
				licenseTier: line.license_tier,
				lemonOrderId: orderId,
				lemonOrderNumber: (attrs.order_number as string) ?? null,
				lemonVariantId: attrs.variant_id != null ? String(attrs.variant_id) : null,
				lemonCustomerId: attrs.customer_id != null ? String(attrs.customer_id) : null,
				priceCents: linePrice,
				currency: (attrs.currency as string) ?? null,
				metadata: { event: eventName, checkout_mode: order.mode }
			});
			granted += 1;
		}

		if (order.mode === 'cart' && supabaseAdmin) {
			await supabaseAdmin.from('license_cart_items').delete().eq('user_id', order.buyerUserId);
		}

		return json({ ok: true, granted });
	}

	if (eventName === 'order_refunded') {
		const orderId = String(payload.data?.id || '');
		if (orderId) {
			await revokeLicenseByOrderId(orderId);
		}
		return json({ ok: true, revoked: true });
	}

	return json({ ok: true, ignored: eventName });
};
