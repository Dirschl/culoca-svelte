import { json, error } from '@sveltejs/kit';
import { fetchItemPageProfileRow } from '$lib/server/fetchItemPageProfile';
import { createSupabaseServerClient } from '$lib/server/supabaseServer';
import type { RequestHandler } from './$types';

/**
 * Öffentliche Profil-Daten für die Item-„Ersteller“-Box (Whitelist wie SSR).
 * Fallback, wenn das Client-Payload kein `profile` hat (Hydration / Edge).
 * Nutzt dieselbe Logik wie loadContentPage (RPC SECURITY DEFINER + Select-Fallback).
 */
export const GET: RequestHandler = async ({ params }) => {
	const profileId = params.profileId;
	if (!profileId) throw error(400, 'profileId fehlt');

	const supabase = createSupabaseServerClient();
	const profile = await fetchItemPageProfileRow(supabase, profileId);
	if (!profile) {
		throw error(404, 'Profil nicht gefunden');
	}

	return json({ profile });
};
