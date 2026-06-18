import { error, json, type RequestHandler } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { listBuyerLicenses } from '$lib/server/licensePurchases';
import { getPublicItemHref } from '$lib/content/routing';
import { LICENSE_TIER_LABELS } from '$lib/licensing/tiers';

function createAuthedSupabase(request: Request) {
	const authHeader = request.headers.get('authorization');
	if (!authHeader?.startsWith('Bearer ')) {
		throw error(401, 'Nicht angemeldet');
	}

	const supabaseUrl =
		process.env.PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
	const supabaseAnonKey =
		process.env.PUBLIC_SUPABASE_ANON_KEY ||
		process.env.VITE_SUPABASE_ANON_KEY ||
		import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

	if (!supabaseUrl || !supabaseAnonKey) {
		throw error(500, 'Server-Konfigurationsfehler');
	}

	return createClient(supabaseUrl, supabaseAnonKey, {
		auth: { persistSession: false },
		global: { headers: { Authorization: authHeader } }
	});
}

export const GET: RequestHandler = async ({ request }) => {
	const supabase = createAuthedSupabase(request);
	const {
		data: { user },
		error: userError
	} = await supabase.auth.getUser();
	if (userError || !user) {
		throw error(401, 'Nicht angemeldet');
	}

	const rows = await listBuyerLicenses(user.id);

	return json({
		licenses: rows.map((row) => {
			const item = row.items;
			return {
				id: row.id,
				itemId: row.item_id,
				licenseTier: row.license_tier,
				licenseTierLabel: LICENSE_TIER_LABELS[row.license_tier],
				purchasedAt: row.purchased_at,
				orderNumber: row.lemon_order_number,
				priceCents: row.price_cents,
				currency: row.currency,
				itemTitle: item?.title || null,
				itemSlug: item?.slug || null,
				itemHref: item ? getPublicItemHref(item) : null,
				downloadHref: item ? `${getPublicItemHref(item)}/download` : null,
				previewPath: item?.path_512 || item?.path_2048 || null
			};
		})
	});
};
