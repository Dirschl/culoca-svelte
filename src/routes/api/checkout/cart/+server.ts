import { error, json, type RequestHandler } from '@sveltejs/kit';
import { createAuthedSupabaseFromRequest, requireAuthedUser } from '$lib/server/authedSupabase';
import {
	createLemonCheckout,
	getLemonSqueezyConfig,
	isCulocaSalesEnabled,
	variantIdForTier
} from '$lib/server/lemonSqueezy';
import { absoluteUrl } from '$lib/seo/site';
import { LICENSE_TIER_LABELS } from '$lib/licensing/tiers';
import { cartTotals, listCartForUser } from '$lib/server/licenseCart';
import { serializeCartLineItems, type CartLinePayload } from '$lib/licensing/cart';
import { supabaseAdmin } from '$lib/supabaseAdmin';

export const POST: RequestHandler = async ({ request }) => {
	if (!isCulocaSalesEnabled()) {
		throw error(503, 'Bildverkauf ist derzeit nicht aktiviert.');
	}
	const lemonConfig = getLemonSqueezyConfig();
	if (!lemonConfig) {
		throw error(503, 'Zahlungsanbieter ist nicht konfiguriert.');
	}
	if (!supabaseAdmin) {
		throw error(503, 'Datenbank-Konfiguration unvollständig (Service Role).');
	}

	const supabase = createAuthedSupabaseFromRequest(request);
	const user = await requireAuthedUser(supabase);

	const lines = await listCartForUser(supabaseAdmin, user.id);
	const payable = lines.filter((l) => !l.already_licensed);
	const { totalCents, payableCount } = cartTotals(lines);

	if (payableCount === 0) {
		throw error(400, 'Warenkorb ist leer oder enthält nur bereits lizenzierte Bilder');
	}

	if (totalCents < 100) {
		throw error(400, 'Ungültiger Gesamtbetrag');
	}

	const lineItems: CartLinePayload[] = payable.map((l) => ({
		item_id: l.item_id,
		license_tier: l.license_tier,
		price_cents: l.price_cents
	}));

	const hasExtended = payable.some((l) => l.license_tier === 'extended');
	const checkoutTier = hasExtended ? 'extended' : 'standard';
	const redirectUrl = absoluteUrl('/settings/licenses?purchase=success');

	const productName =
		payableCount === 1
			? `${LICENSE_TIER_LABELS[payable[0].license_tier]}: ${payable[0].item_title || 'Culoca Foto'}`
			: `Culoca Bildlizenzen (${payableCount} Fotos)`;

	const productDescription =
		payableCount === 1
			? payable[0].item_title || 'Lizenziertes Foto auf culoca.com'
			: `${payableCount} lizenzierte Fotos auf culoca.com — Standard- und/oder Erweiterte Lizenzen gemäß Warenkorb.`;

	const checkout = await createLemonCheckout(lemonConfig, {
		variantId: variantIdForTier(lemonConfig, checkoutTier),
		priceCents: totalCents,
		productName,
		productDescription,
		previewImageUrl: null,
		redirectUrl,
		custom: {
			checkout_mode: 'cart',
			buyer_user_id: user.id,
			line_items: serializeCartLineItems(lineItems),
			item_count: String(payableCount)
		}
	});

	return json({
		ok: true,
		checkoutUrl: checkout.checkoutUrl,
		checkoutId: checkout.checkoutId,
		totalCents,
		itemCount: payableCount
	});
};
