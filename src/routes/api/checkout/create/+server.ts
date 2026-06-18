import { error, json, type RequestHandler } from '@sveltejs/kit';
import { createAuthedSupabaseFromRequest, requireAuthedUser } from '$lib/server/authedSupabase';
import { getPublicItemDownloadHref } from '$lib/content/routing';
import { buildItemHeroCdnImageUrl } from '$lib/seo/itemHeroImageUrl';
import {
	getTierPriceCents,
	isItemForSale,
	LICENSE_TIER_LABELS,
	type LicenseTier
} from '$lib/licensing/tiers';
import {
	createLemonCheckout,
	getLemonSqueezyConfig,
	isCulocaSalesEnabled,
	variantIdForTier
} from '$lib/server/lemonSqueezy';
import { absoluteUrl } from '$lib/seo/site';
import { DEFAULT_CONTENT_TYPE_BY_SLUG } from '$lib/content/types';
import { addToCart } from '$lib/server/licenseCart';

const FOTO_TYPE_ID = DEFAULT_CONTENT_TYPE_BY_SLUG.get('foto')?.id ?? 1;

export const POST: RequestHandler = async ({ request }) => {
	if (!isCulocaSalesEnabled()) {
		throw error(503, 'Bildverkauf ist derzeit nicht aktiviert.');
	}

	const lemonConfig = getLemonSqueezyConfig();
	if (!lemonConfig) {
		throw error(503, 'Zahlungsanbieter ist nicht konfiguriert.');
	}

	const supabase = createAuthedSupabaseFromRequest(request);
	const user = await requireAuthedUser(supabase);

	const body = await request.json().catch(() => ({}));
	const itemId = typeof body?.itemId === 'string' ? body.itemId : '';
	const tier = body?.tier as LicenseTier;
	const addToCartOnly = body?.addToCartOnly === true;

	if (!itemId) {
		throw error(400, 'itemId fehlt');
	}
	if (tier !== 'standard' && tier !== 'extended') {
		throw error(400, 'Ungültige Lizenzstufe');
	}

	const { data: item, error: itemError } = await supabase
		.from('items')
		.select(
			'id, slug, title, description, caption, profile_id, type_id, is_private, stock_settings, path_2048, path_512, canonical_path, country_slug, district_slug, municipality_slug'
		)
		.eq('id', itemId)
		.maybeSingle();

	if (itemError || !item) {
		throw error(404, 'Bild nicht gefunden');
	}

	if (!isItemForSale(item, { salesGloballyEnabled: true, fotoTypeId: FOTO_TYPE_ID })) {
		throw error(403, 'Dieses Bild ist nicht zum Verkauf freigegeben');
	}

	if (item.profile_id === user.id) {
		throw error(400, 'Eigene Bilder können nicht gekauft werden');
	}

	const priceCents = getTierPriceCents(tier, item, {
		standard: lemonConfig.defaultStandardPriceCents,
		extended: lemonConfig.defaultExtendedPriceCents
	});

	if (!Number.isFinite(priceCents) || priceCents < 100) {
		throw error(400, 'Ungültiger Preis');
	}

	if (addToCartOnly) {
		try {
			await addToCart(supabase, user.id, itemId, tier, lemonConfig);
			return json({ ok: true, addedToCart: true });
		} catch (e) {
			throw error(400, e instanceof Error ? e.message : 'Warenkorb fehlgeschlagen');
		}
	}

	const downloadPath = getPublicItemDownloadHref(item);
	const redirectUrl = absoluteUrl(`${downloadPath}?purchase=success`);
	const previewImageUrl = buildItemHeroCdnImageUrl(item);
	const productName = `${LICENSE_TIER_LABELS[tier]}: ${item.title || item.slug || 'Culoca Foto'}`;
	const productDescription =
		item.description ||
		item.caption ||
		`Lizenziertes Foto auf culoca.com — ${LICENSE_TIER_LABELS[tier]}`;

	const checkout = await createLemonCheckout(lemonConfig, {
		variantId: variantIdForTier(lemonConfig, tier),
		priceCents,
		productName,
		productDescription,
		previewImageUrl,
		redirectUrl,
		custom: {
			checkout_mode: 'single',
			buyer_user_id: user.id,
			item_id: item.id,
			license_tier: tier,
			price_cents: String(priceCents)
		}
	});

	return json({
		ok: true,
		checkoutUrl: checkout.checkoutUrl,
		checkoutId: checkout.checkoutId,
		tier,
		priceCents
	});
};
