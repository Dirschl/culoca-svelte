import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_CONTENT_TYPE_BY_SLUG } from '$lib/content/types';
import { getLicenseCuratorUserId } from '$lib/licensing/curator';
import { isItemForSale } from '$lib/licensing/tiers';

const FOTO_TYPE_ID = DEFAULT_CONTENT_TYPE_BY_SLUG.get('foto')?.id ?? 1;

export async function getCreatorLicensingOptIn(
	supabase: SupabaseClient,
	profileId: string | null | undefined
): Promise<boolean> {
	if (!profileId) return false;
	if (profileId === getLicenseCuratorUserId()) return true;

	const { data, error } = await supabase
		.from('profiles')
		.select('culoca_licensing_opt_in')
		.eq('id', profileId)
		.maybeSingle();

	if (error) {
		console.error('getCreatorLicensingOptIn:', error);
		return false;
	}

	return data?.culoca_licensing_opt_in === true;
}

export async function isItemEligibleForSale(
	supabase: SupabaseClient,
	item: {
		is_private?: boolean | null;
		type_id?: number | null;
		profile_id?: string | null;
		stock_settings?: unknown;
	},
	options: { salesGloballyEnabled: boolean }
): Promise<boolean> {
	const creatorLicensingOptIn = await getCreatorLicensingOptIn(supabase, item.profile_id ?? null);
	return isItemForSale(item, {
		salesGloballyEnabled: options.salesGloballyEnabled,
		fotoTypeId: FOTO_TYPE_ID,
		creatorLicensingOptIn,
		curatorUserId: getLicenseCuratorUserId()
	});
}
