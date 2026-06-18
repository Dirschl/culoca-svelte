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
import { supabaseAdmin } from '$lib/supabaseAdmin';

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

function requireCartDb() {
	if (!supabaseAdmin) {
		throw error(503, 'Datenbank-Konfiguration unvollständig (Service Role).');
	}
	return supabaseAdmin;
}

async function requireCartUser(request: Request) {
	const supabase = createAuthedSupabaseFromRequest(request);
	const user = await requireAuthedUser(supabase);
	return { user, db: requireCartDb() };
}

function cartErrorMessage(e: unknown): string {
	if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string') {
		return e.message;
	}
	return e instanceof Error ? e.message : 'Warenkorb fehlgeschlagen';
}

export const GET: RequestHandler = async ({ request }) => {
	try {
		salesGuard();
		const { user, db } = await requireCartUser(request);
		const lines = await listCartForUser(db, user.id);
		const totals = cartTotals(lines);
		return json({ lines, ...totals });
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) throw e;
		console.error('[cart GET]', e);
		throw error(500, cartErrorMessage(e));
	}
};

export const POST: RequestHandler = async ({ request }) => {
	const lemonConfig = salesGuard();
	const { user, db } = await requireCartUser(request);
	const body = await request.json().catch(() => ({}));
	const itemId = typeof body?.itemId === 'string' ? body.itemId : '';
	const tier = body?.tier as LicenseTier;
	if (!itemId) throw error(400, 'itemId fehlt');
	if (tier !== 'standard' && tier !== 'extended') throw error(400, 'Ungültige Lizenzstufe');

	try {
		await addToCart(db, user.id, itemId, tier, lemonConfig);
		const lines = await listCartForUser(db, user.id);
		return json({ ok: true, ...cartTotals(lines), lines });
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) throw e;
		throw error(400, cartErrorMessage(e));
	}
};

export const PATCH: RequestHandler = async ({ request }) => {
	const lemonConfig = salesGuard();
	const { user, db } = await requireCartUser(request);
	const body = await request.json().catch(() => ({}));

	try {
		if (body?.setAllTier === 'standard' || body?.setAllTier === 'extended') {
			await setAllCartTiers(db, user.id, body.setAllTier, lemonConfig);
			const lines = await listCartForUser(db, user.id);
			return json({ ok: true, ...cartTotals(lines), lines });
		}

		const itemId = typeof body?.itemId === 'string' ? body.itemId : '';
		const tier = body?.tier as LicenseTier;
		if (!itemId || (tier !== 'standard' && tier !== 'extended')) {
			throw error(400, 'itemId und tier erforderlich');
		}
		await setCartItemTier(db, user.id, itemId, tier, lemonConfig);
		const lines = await listCartForUser(db, user.id);
		return json({ ok: true, ...cartTotals(lines), lines });
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) throw e;
		throw error(400, cartErrorMessage(e));
	}
};

export const DELETE: RequestHandler = async ({ request, url }) => {
	try {
		salesGuard();
		const { user, db } = await requireCartUser(request);
		const itemId = url.searchParams.get('itemId');
		if (itemId) {
			await removeFromCart(db, user.id, { itemId });
		} else {
			await clearCart(db, user.id);
		}
		const lines = await listCartForUser(db, user.id);
		return json({ ok: true, ...cartTotals(lines), lines });
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) throw e;
		throw error(400, cartErrorMessage(e));
	}
};
