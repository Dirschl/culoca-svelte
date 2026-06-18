import { error, json, type RequestHandler } from '@sveltejs/kit';
import { createAuthedSupabaseFromRequest, requireAuthedUser } from '$lib/server/authedSupabase';
import { getLemonSqueezyConfig, isCulocaSalesEnabled } from '$lib/server/lemonSqueezy';
import {
	addToCart,
	cartTotals,
	clearCart,
	listCartForUser,
	removeFromCart,
	setAllCartTiers,
	setCartItemTier
} from '$lib/server/licenseCart';
import type { LicenseTier } from '$lib/licensing/tiers';

function salesGuard() {
	if (!isCulocaSalesEnabled()) {
		throw error(503, 'Bildverkauf ist derzeit nicht aktiviert.');
	}
	const lemonConfig = getLemonSqueezyConfig();
	if (!lemonConfig) {
		throw error(503, 'Zahlungsanbieter ist nicht konfiguriert.');
	}
	return lemonConfig;
}

export const GET: RequestHandler = async ({ request }) => {
	salesGuard();
	const supabase = createAuthedSupabaseFromRequest(request);
	const user = await requireAuthedUser(supabase);
	const lines = await listCartForUser(supabase, user.id);
	const totals = cartTotals(lines);
	return json({ lines, ...totals });
};

export const POST: RequestHandler = async ({ request }) => {
	const lemonConfig = salesGuard();
	const supabase = createAuthedSupabaseFromRequest(request);
	const user = await requireAuthedUser(supabase);
	const body = await request.json().catch(() => ({}));
	const itemId = typeof body?.itemId === 'string' ? body.itemId : '';
	const tier = body?.tier as LicenseTier;
	if (!itemId) throw error(400, 'itemId fehlt');
	if (tier !== 'standard' && tier !== 'extended') throw error(400, 'Ungültige Lizenzstufe');

	try {
		await addToCart(supabase, user.id, itemId, tier, lemonConfig);
		const lines = await listCartForUser(supabase, user.id);
		return json({ ok: true, ...cartTotals(lines), lines });
	} catch (e) {
		throw error(400, e instanceof Error ? e.message : 'Warenkorb fehlgeschlagen');
	}
};

export const PATCH: RequestHandler = async ({ request }) => {
	const lemonConfig = salesGuard();
	const supabase = createAuthedSupabaseFromRequest(request);
	const user = await requireAuthedUser(supabase);
	const body = await request.json().catch(() => ({}));

	if (body?.setAllTier === 'standard' || body?.setAllTier === 'extended') {
		await setAllCartTiers(supabase, user.id, body.setAllTier, lemonConfig);
		const lines = await listCartForUser(supabase, user.id);
		return json({ ok: true, ...cartTotals(lines), lines });
	}

	const itemId = typeof body?.itemId === 'string' ? body.itemId : '';
	const tier = body?.tier as LicenseTier;
	if (!itemId || (tier !== 'standard' && tier !== 'extended')) {
		throw error(400, 'itemId und tier erforderlich');
	}
	await setCartItemTier(supabase, user.id, itemId, tier, lemonConfig);
	const lines = await listCartForUser(supabase, user.id);
	return json({ ok: true, ...cartTotals(lines), lines });
};

export const DELETE: RequestHandler = async ({ request, url }) => {
	salesGuard();
	const supabase = createAuthedSupabaseFromRequest(request);
	const user = await requireAuthedUser(supabase);
	const itemId = url.searchParams.get('itemId');
	if (itemId) {
		await removeFromCart(supabase, user.id, { itemId });
	} else {
		await clearCart(supabase, user.id);
	}
	const lines = await listCartForUser(supabase, user.id);
	return json({ ok: true, ...cartTotals(lines), lines });
};
