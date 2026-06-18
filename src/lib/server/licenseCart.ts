import type { SupabaseClient } from '@supabase/supabase-js';
import { getPublicItemHref } from '$lib/content/routing';
import { getTierPriceCents, type LicenseTier } from '$lib/licensing/tiers';
import type { LemonSqueezyConfig } from '$lib/server/lemonSqueezy';
import { isItemEligibleForSale } from '$lib/server/licensingSale';
import { isCulocaSalesEnabled } from '$lib/server/lemonSqueezy';
import { MAX_CART_ITEMS, type CartLineDisplay } from '$lib/licensing/cart';

const ITEM_SELECT =
	'id, slug, title, profile_id, type_id, is_private, stock_settings, path_512, path_2048, canonical_path, country_slug, district_slug, municipality_slug';

export async function listCartForUser(
	supabase: SupabaseClient,
	userId: string
): Promise<CartLineDisplay[]> {
	const { data: rows, error } = await supabase
		.from('license_cart_items')
		.select('id, item_id, license_tier, price_cents, added_at')
		.eq('user_id', userId)
		.order('added_at', { ascending: true });

	if (error) throw error;
	if (!rows?.length) return [];

	const itemIds = [...new Set(rows.map((row) => String(row.item_id)))];
	const { data: items, error: itemsError } = await supabase
		.from('items')
		.select(ITEM_SELECT)
		.in('id', itemIds);

	if (itemsError) throw itemsError;

	const itemById = new Map((items || []).map((item) => [String(item.id), item]));
	const licensedItemIds = await getLicensedItemIds(supabase, userId);

	return rows.map((row) => {
		const item = itemById.get(String(row.item_id));
		return {
			id: String(row.id),
			item_id: String(row.item_id),
			license_tier: row.license_tier as LicenseTier,
			price_cents: Number(row.price_cents),
			added_at: String(row.added_at),
			item_title: item?.title ?? null,
			item_slug: item?.slug ?? null,
			item_href: item ? getPublicItemHref(item) : null,
			preview_path: item?.path_512 ?? item?.path_2048 ?? null,
			already_licensed: licensedItemIds.has(String(row.item_id))
		};
	});
}

async function getLicensedItemIds(supabase: SupabaseClient, userId: string) {
	const { data } = await supabase
		.from('license_purchases')
		.select('item_id')
		.eq('buyer_user_id', userId)
		.eq('status', 'active');
	return new Set((data || []).map((r) => String(r.item_id)));
}

export async function addToCart(
	supabase: SupabaseClient,
	userId: string,
	itemId: string,
	tier: LicenseTier,
	lemonConfig: Pick<LemonSqueezyConfig, 'defaultStandardPriceCents' | 'defaultExtendedPriceCents'>
) {
	const { count } = await supabase
		.from('license_cart_items')
		.select('id', { count: 'exact', head: true })
		.eq('user_id', userId);

	if ((count ?? 0) >= MAX_CART_ITEMS) {
		throw new Error(`Warenkorb maximal ${MAX_CART_ITEMS} Positionen`);
	}

	const { data: item, error: itemError } = await supabase
		.from('items')
		.select(ITEM_SELECT)
		.eq('id', itemId)
		.maybeSingle();

	if (itemError || !item) {
		throw new Error('Bild nicht gefunden');
	}

	const salesOn = isCulocaSalesEnabled();
	if (
		!(await isItemEligibleForSale(supabase, item, { salesGloballyEnabled: salesOn }))
	) {
		throw new Error('Bild nicht zum Verkauf freigegeben');
	}

	if (item.profile_id === userId) {
		throw new Error('Eigene Bilder können nicht in den Warenkorb');
	}

	const licensed = await getLicensedItemIds(supabase, userId);
	if (licensed.has(itemId)) {
		throw new Error('Sie besitzen bereits eine Lizenz für dieses Bild');
	}

	const priceCents = getTierPriceCents(tier, item, {
		standard: lemonConfig.defaultStandardPriceCents,
		extended: lemonConfig.defaultExtendedPriceCents
	});

	const { error } = await supabase.from('license_cart_items').upsert(
		{
			user_id: userId,
			item_id: itemId,
			license_tier: tier,
			price_cents: priceCents
		},
		{ onConflict: 'user_id,item_id' }
	);

	if (error) throw error;
}

export async function removeFromCart(
	supabase: SupabaseClient,
	userId: string,
	args: { itemId: string }
) {
	const { error } = await supabase
		.from('license_cart_items')
		.delete()
		.eq('user_id', userId)
		.eq('item_id', args.itemId);
	if (error) throw error;
}

export async function clearCart(supabase: SupabaseClient, userId: string) {
	const { error } = await supabase.from('license_cart_items').delete().eq('user_id', userId);
	if (error) throw error;
}

export async function setCartItemTier(
	supabase: SupabaseClient,
	userId: string,
	itemId: string,
	newTier: LicenseTier,
	lemonConfig: Pick<LemonSqueezyConfig, 'defaultStandardPriceCents' | 'defaultExtendedPriceCents'>
) {
	const { data: item } = await supabase.from('items').select(ITEM_SELECT).eq('id', itemId).maybeSingle();
	if (!item) throw new Error('Bild nicht gefunden');
	const priceCents = getTierPriceCents(newTier, item, {
		standard: lemonConfig.defaultStandardPriceCents,
		extended: lemonConfig.defaultExtendedPriceCents
	});
	const { error } = await supabase
		.from('license_cart_items')
		.update({ license_tier: newTier, price_cents: priceCents })
		.eq('user_id', userId)
		.eq('item_id', itemId);
	if (error) throw error;
}

export async function setAllCartTiers(
	supabase: SupabaseClient,
	userId: string,
	newTier: LicenseTier,
	lemonConfig: Pick<LemonSqueezyConfig, 'defaultStandardPriceCents' | 'defaultExtendedPriceCents'>
) {
	const lines = await listCartForUser(supabase, userId);
	for (const line of lines) {
		if (line.license_tier !== newTier) {
			await setCartItemTier(supabase, userId, line.item_id, newTier, lemonConfig);
		}
	}
}

export function cartTotals(lines: CartLineDisplay[]) {
	const payable = lines.filter((l) => !l.already_licensed);
	const totalCents = payable.reduce((sum, l) => sum + l.price_cents, 0);
	return { count: lines.length, payableCount: payable.length, totalCents };
}
