import type { SupabaseClient } from '@supabase/supabase-js';
import {
	ITEM_PAGE_PROFILE_SELECT,
	ITEM_PAGE_PROFILE_SELECT_CORE,
	scrubPublicProfileRow
} from '$lib/server/itemPagePublic';

/** Postgres-RPC (SECURITY DEFINER), siehe database-migrations/2026-04-09_get_public_profile_for_item_page.sql */
export const ITEM_PAGE_PROFILE_RPC = 'get_public_profile_for_item_page';

/**
 * Öffentliches Profil für die Item-Ersteller-Box (Whitelist-Spalten).
 * 1) RPC umgeht RLS auf `profiles`, wenn die Migration ausgeführt wurde.
 * 2) Sonst direkter Select (Service Role / Policies wie bisher).
 */
export async function fetchItemPageProfileRow(
	client: SupabaseClient,
	profileId: string
): Promise<Record<string, unknown> | null> {
	const rpc = await client.rpc(ITEM_PAGE_PROFILE_RPC, { p_profile_id: profileId });

	if (!rpc.error && rpc.data != null && typeof rpc.data === 'object') {
		return scrubPublicProfileRow(rpc.data as Record<string, unknown>);
	}

	if (rpc.error && !isMissingRpcError(rpc.error)) {
		console.warn(
			`[fetchItemPageProfile] RPC ${ITEM_PAGE_PROFILE_RPC}`,
			profileId,
			rpc.error.message
		);
	}

	let { data, error: profileError } = await client
		.from('profiles')
		.select(ITEM_PAGE_PROFILE_SELECT)
		.eq('id', profileId)
		.maybeSingle();

	if (profileError) {
		console.warn('[fetchItemPageProfile] select (full)', profileId, profileError.message);
		const second = await client
			.from('profiles')
			.select(ITEM_PAGE_PROFILE_SELECT_CORE)
			.eq('id', profileId)
			.maybeSingle();
		if (second.error) {
			console.warn('[fetchItemPageProfile] select (core)', profileId, second.error.message);
			return null;
		}
		data = second.data;
	}

	return scrubPublicProfileRow(data as Record<string, unknown> | null);
}

function isMissingRpcError(err: { message?: string; code?: string }): boolean {
	const m = (err.message || '').toLowerCase();
	return (
		m.includes('could not find the function') ||
		m.includes('does not exist') ||
		err.code === '42883'
	);
}
