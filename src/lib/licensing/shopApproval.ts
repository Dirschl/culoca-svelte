import { getCulocaFromStockSettings, isCulocaSaleApproved, type ItemStockSettingsWithCuloca } from './tiers';
import type { UserPermissions } from '$lib/auth/permissions';

export const CULOCA_LICENSE_AUTO_APPROVE_PERMISSION = 'culoca_license_auto_approve';
export const MANAGE_CULOCA_LICENSING_PERMISSION = 'manage_culoca_licensing';

export function userHasAutoApproveCapability(
	permissions: Record<string, boolean> | UserPermissions | null | undefined
): boolean {
	if (!permissions) return false;
	return !!(
		permissions[CULOCA_LICENSE_AUTO_APPROVE_PERMISSION] ||
		permissions[MANAGE_CULOCA_LICENSING_PERMISSION]
	);
}

export function creatorAutoApproveActive(
	profileAutoApprove: boolean | null | undefined,
	hasCapability: boolean
): boolean {
	return hasCapability && profileAutoApprove === true;
}

function getRawCulocaBranch(stockSettings: unknown) {
	if (!stockSettings || typeof stockSettings !== 'object' || Array.isArray(stockSettings)) {
		return null;
	}
	const culoca = (stockSettings as ItemStockSettingsWithCuloca).culoca;
	if (!culoca || typeof culoca !== 'object' || Array.isArray(culoca)) return null;
	return culoca as { saleApproved?: boolean; saleEnabled?: boolean };
}

/** Expliziter Opt-out pro Bild (nur bei Autofreigabe relevant). */
export function isExplicitShopOptOut(stockSettings: unknown): boolean {
	return getRawCulocaBranch(stockSettings)?.saleApproved === false;
}

/**
 * Shop-Freigabe: explizit true, oder Autofreigabe wenn nicht explizit false.
 */
export function resolveItemShopApproved(
	stockSettings: unknown,
	creatorAutoApprove: boolean
): boolean {
	if (isExplicitShopOptOut(stockSettings)) return false;
	if (isCulocaSaleApproved(stockSettings)) return true;
	return creatorAutoApprove;
}
