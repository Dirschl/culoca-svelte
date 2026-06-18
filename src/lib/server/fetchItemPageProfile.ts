import type { SupabaseClient } from '@supabase/supabase-js';
import {
	ITEM_PAGE_PROFILE_SELECT,
	ITEM_PAGE_PROFILE_SELECT_CORE,
	scrubPublicProfileRow
} from '$lib/server/itemPagePublic';

/** Postgres-RPC (SECURITY DEFINER), siehe database-migrations/2026-04-09_get_public_profile_for_item_page.sql */
export const ITEM_PAGE_PROFILE_RPC = 'get_public_profile_for_item_page';

const LICENSING_PROFILE_COLUMNS = ['culoca_licensing_opt_in', 'culoca_licensing_auto_approve'] as const;

async function mergeProfileLicensingFlags(
	client: SupabaseClient,
	profileId: string,
	row: Record<string, unknown> | null
): Promise<Record<string, unknown> | null> {
	if (!row) return null;
	const needsMerge = LICENSING_PROFILE_COLUMNS.some((key) => row[key] === undefined);
	if (!needsMerge) return row;

	const { data, error } = await client
		.from('profiles')
		.select(LICENSING_PROFILE_COLUMNS.join(', '))
		.eq('id', profileId)
		.maybeSingle();

	if (error) {
		console.warn('[fetchItemPageProfile] licensing flags', profileId, error.message);
		return row;
	}

	if (!data) return row;
	return { ...row, ...data };
}

/**
 * Öffentliches Profil für die Item-Ersteller-Box (Whitelist-Spalten).
 * 1) RPC umgeht RLS auf `profiles`, wenn die Migration ausgeführt wurde.
 * 2) Sonst direkter Select (Service Role / Policies wie bisher).
 * 3) Lizenz-Flags nachladen, falls die RPC-Version sie noch nicht enthält.
 */
export async function fetchItemPageProfileRow(
	client: SupabaseClient,
	profileId: string
): Promise<Record<string, unknown> | null> {
	const rpc = await client.rpc(ITEM_PAGE_PROFILE_RPC, { p_profile_id: profileId });

	let row: Record<string, unknown> | null = null;

	if (!rpc.error && rpc.data != null && typeof rpc.data === 'object') {
		row = rpc.data as Record<string, unknown>;
	} else if (rpc.error && !isMissingRpcError(rpc.error)) {
		console.warn(
			`[fetchItemPageProfile] RPC ${ITEM_PAGE_PROFILE_RPC}`,
			profileId,
			rpc.error.message
		);
	}

	if (!row) {
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

		row = data as Record<string, unknown> | null;
	}

	row = await mergeProfileLicensingFlags(client, profileId, row);
	return scrubPublicProfileRow(row);
}

function isMissingRpcError(err: { message?: string; code?: string }): boolean {
	const m = (err.message || '').toLowerCase();
	return (
		m.includes('could not find the function') ||
		m.includes('does not exist') ||
		err.code === '42883'
	);
}
