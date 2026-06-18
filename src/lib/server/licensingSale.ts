import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_CONTENT_TYPE_BY_SLUG } from '$lib/content/types';
import {
	CULOCA_LICENSE_AUTO_APPROVE_PERMISSION,
	MANAGE_CULOCA_LICENSING_PERMISSION
} from '$lib/licensing/shopApproval';
import { isItemForSale } from '$lib/licensing/tiers';

const FOTO_TYPE_ID = DEFAULT_CONTENT_TYPE_BY_SLUG.get('foto')?.id ?? 1;

export async function userHasPermission(
	supabase: SupabaseClient,
	userId: string,
	permission: string
): Promise<boolean> {
	const { data, error } = await supabase.rpc('has_permission', {
		user_id: userId,
		permission_name: permission
	});
	if (error) {
		console.error('userHasPermission:', permission, error);
		return false;
	}
	return data === true;
}

export async function userCanAutoApproveLicenses(
	supabase: SupabaseClient,
	userId: string
): Promise<boolean> {
	const [autoApprove, manage] = await Promise.all([
		userHasPermission(supabase, userId, CULOCA_LICENSE_AUTO_APPROVE_PERMISSION),
		userHasPermission(supabase, userId, MANAGE_CULOCA_LICENSING_PERMISSION)
	]);
	return autoApprove || manage;
}

export async function getCreatorLicensingOptIn(
	supabase: SupabaseClient,
	profileId: string | null | undefined
): Promise<boolean> {
	if (!profileId) return false;

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

export async function getCreatorAutoApprove(
	supabase: SupabaseClient,
	profileId: string | null | undefined
): Promise<boolean> {
	if (!profileId) return false;

	const [canAuto, profileResult] = await Promise.all([
		userCanAutoApproveLicenses(supabase, profileId),
		supabase
			.from('profiles')
			.select('culoca_licensing_auto_approve')
			.eq('id', profileId)
			.maybeSingle()
	]);

	if (profileResult.error) {
		console.error('getCreatorAutoApprove:', profileResult.error);
		return false;
	}

	return canAuto && profileResult.data?.culoca_licensing_auto_approve === true;
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
	const profileId = item.profile_id ?? null;
	const [creatorLicensingOptIn, creatorAutoApprove] = await Promise.all([
		getCreatorLicensingOptIn(supabase, profileId),
		getCreatorAutoApprove(supabase, profileId)
	]);

	return isItemForSale(item, {
		salesGloballyEnabled: options.salesGloballyEnabled,
		fotoTypeId: FOTO_TYPE_ID,
		creatorLicensingOptIn,
		creatorAutoApprove,
		curatorUserId: ''
	});
}
