import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_CONTENT_TYPE_BY_SLUG } from '$lib/content/types';
import { resolveItemShopApproved } from '$lib/licensing/shopApproval';

const FOTO_TYPE_ID = DEFAULT_CONTENT_TYPE_BY_SLUG.get('foto')?.id ?? 1;

export type ProfileLicensingFlags = {
	culoca_licensing_opt_in: boolean;
	culoca_licensing_auto_approve: boolean;
};

export async function loadProfileLicensingMap(
	supabase: SupabaseClient,
	profileIds: string[]
): Promise<Map<string, ProfileLicensingFlags>> {
	const map = new Map<string, ProfileLicensingFlags>();
	const unique = [...new Set(profileIds.filter(Boolean))];
	if (!unique.length) return map;

	const chunkSize = 200;
	for (let i = 0; i < unique.length; i += chunkSize) {
		const chunk = unique.slice(i, i + chunkSize);
		const { data, error } = await supabase
			.from('profiles')
			.select('id, culoca_licensing_opt_in, culoca_licensing_auto_approve')
			.in('id', chunk);

		if (error) {
			console.warn('[Sitemap] profile licensing batch:', error.message);
			continue;
		}

		for (const row of data || []) {
			map.set(String(row.id), {
				culoca_licensing_opt_in: row.culoca_licensing_opt_in === true,
				culoca_licensing_auto_approve: row.culoca_licensing_auto_approve === true
			});
		}
	}

	return map;
}

export function isItemShopIndexable(
	item: {
		type_id?: number | null;
		profile_id?: string | null;
		stock_settings?: unknown;
	},
	profileMap: Map<string, ProfileLicensingFlags>
): boolean {
	if (item.type_id !== FOTO_TYPE_ID || !item.profile_id) return false;
	const profile = profileMap.get(item.profile_id);
	if (!profile?.culoca_licensing_opt_in) return false;
	return resolveItemShopApproved(
		item.stock_settings,
		profile.culoca_licensing_auto_approve === true
	);
}
