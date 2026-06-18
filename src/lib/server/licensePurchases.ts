import { supabaseAdmin } from '$lib/supabaseAdmin';
import type { LicenseTier } from '$lib/licensing/tiers';

export type LicensePurchaseRow = {
	id: string;
	buyer_user_id: string;
	item_id: string;
	seller_profile_id: string | null;
	license_tier: LicenseTier;
	status: string;
	lemon_order_id: string;
	lemon_order_number: string | null;
	price_cents: number | null;
	currency: string | null;
	purchased_at: string;
	items?: {
		id: string;
		slug: string | null;
		title: string | null;
		path_512: string | null;
		path_2048: string | null;
		canonical_path: string | null;
		country_slug: string | null;
		district_slug: string | null;
		municipality_slug: string | null;
	} | null;
};

export async function grantLicensePurchase(args: {
	buyerUserId: string;
	itemId: string;
	sellerProfileId: string | null;
	licenseTier: LicenseTier;
	lemonOrderId: string;
	lemonOrderNumber?: string | null;
	lemonVariantId?: string | null;
	lemonCustomerId?: string | null;
	priceCents?: number | null;
	currency?: string | null;
	metadata?: Record<string, unknown>;
}) {
	if (!supabaseAdmin) {
		throw new Error('Supabase admin client not configured');
	}

	const { data, error } = await supabaseAdmin
		.from('license_purchases')
		.upsert(
			{
				buyer_user_id: args.buyerUserId,
				item_id: args.itemId,
				seller_profile_id: args.sellerProfileId,
				license_tier: args.licenseTier,
				status: 'active',
				lemon_order_id: args.lemonOrderId,
				lemon_order_number: args.lemonOrderNumber ?? null,
				lemon_variant_id: args.lemonVariantId ?? null,
				lemon_customer_id: args.lemonCustomerId ?? null,
				price_cents: args.priceCents ?? null,
				currency: args.currency ?? null,
				refunded_at: null,
				metadata: args.metadata ?? {}
			},
			{ onConflict: 'lemon_order_id,item_id,license_tier' }
		)
		.select('id')
		.single();

	if (error) throw error;
	return data;
}

export async function revokeLicenseByOrderId(lemonOrderId: string) {
	if (!supabaseAdmin) {
		throw new Error('Supabase admin client not configured');
	}

	const { error } = await supabaseAdmin
		.from('license_purchases')
		.update({ status: 'refunded', refunded_at: new Date().toISOString() })
		.eq('lemon_order_id', lemonOrderId);

	if (error) throw error;
}

export async function listBuyerLicenses(buyerUserId: string): Promise<LicensePurchaseRow[]> {
	if (!supabaseAdmin) {
		throw new Error('Supabase admin client not configured');
	}

	const { data, error } = await supabaseAdmin
		.from('license_purchases')
		.select(
			'id, buyer_user_id, item_id, seller_profile_id, license_tier, status, lemon_order_id, lemon_order_number, price_cents, currency, purchased_at, items(id, slug, title, path_512, path_2048, canonical_path, country_slug, district_slug, municipality_slug)'
		)
		.eq('buyer_user_id', buyerUserId)
		.eq('status', 'active')
		.order('purchased_at', { ascending: false });

	if (error) throw error;
	return (data || []) as LicensePurchaseRow[];
}

export async function buyerHasActiveLicense(buyerUserId: string, itemId: string): Promise<boolean> {
	if (!supabaseAdmin) return false;
	const { count, error } = await supabaseAdmin
		.from('license_purchases')
		.select('id', { count: 'exact', head: true })
		.eq('buyer_user_id', buyerUserId)
		.eq('item_id', itemId)
		.eq('status', 'active');
	if (error) return false;
	return (count ?? 0) > 0;
}
