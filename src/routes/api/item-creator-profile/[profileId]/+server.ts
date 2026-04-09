import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import {
	ITEM_PAGE_PROFILE_SELECT,
	ITEM_PAGE_PROFILE_SELECT_CORE,
	scrubPublicProfileRow
} from '$lib/server/itemPagePublic';
import type { RequestHandler } from './$types';

/**
 * Öffentliche Profil-Daten für die Item-„Ersteller“-Box (Whitelist wie SSR).
 * Fallback, wenn das Client-Payload kein `profile` hat (Hydration / Edge).
 */
export const GET: RequestHandler = async ({ params }) => {
	const profileId = params.profileId;
	if (!profileId) throw error(400, 'profileId fehlt');

	const url =
		env.PUBLIC_SUPABASE_URL ||
		env.VITE_SUPABASE_URL ||
		process.env.PUBLIC_SUPABASE_URL ||
		process.env.VITE_SUPABASE_URL;
	const key = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!url || !key?.trim()) {
		console.error('[item-creator-profile] SUPABASE_SERVICE_ROLE_KEY oder URL fehlt');
		throw error(503, 'Profil-Dienst nicht konfiguriert');
	}

	const supabase = createClient(url, key, { auth: { persistSession: false } });

	let { data, error: qErr } = await supabase
		.from('profiles')
		.select(ITEM_PAGE_PROFILE_SELECT)
		.eq('id', profileId)
		.maybeSingle();

	if (qErr) {
		const second = await supabase
			.from('profiles')
			.select(ITEM_PAGE_PROFILE_SELECT_CORE)
			.eq('id', profileId)
			.maybeSingle();
		if (second.error) {
			console.warn('[item-creator-profile]', profileId, second.error.message);
			throw error(500, 'Profil konnte nicht geladen werden');
		}
		data = second.data;
	}

	const row = data as Record<string, unknown> | null;
	const profile = scrubPublicProfileRow(row);
	if (!profile) {
		throw error(404, 'Profil nicht gefunden');
	}

	return json({ profile });
};
