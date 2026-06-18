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
	return culoca as {
		saleApproved?: boolean;
		saleEnabled?: boolean;
		saleDenied?: boolean;
		saleDeniedReason?: string | null;
		saleDeniedAt?: string | null;
		saleDeniedBy?: string | null;
	};
}

export type CulocaSaleDenialInfo = {
	denied: boolean;
	reason: string | null;
	at: string | null;
	by: string | null;
};

export function getCulocaSaleDenial(stockSettings: unknown): CulocaSaleDenialInfo {
	const culoca = getRawCulocaBranch(stockSettings);
	if (!culoca || culoca.saleDenied !== true) {
		return { denied: false, reason: null, at: null, by: null };
	}
	const reason =
		typeof culoca.saleDeniedReason === 'string' && culoca.saleDeniedReason.trim()
			? culoca.saleDeniedReason.trim()
			: null;
	return {
		denied: true,
		reason,
		at: typeof culoca.saleDeniedAt === 'string' ? culoca.saleDeniedAt : null,
		by: typeof culoca.saleDeniedBy === 'string' ? culoca.saleDeniedBy : null
	};
}

/** Expliziter Opt-out pro Bild (nur bei Autofreigabe, keine Kurator-Ablehnung). */
export function isExplicitShopOptOut(stockSettings: unknown): boolean {
	if (getCulocaSaleDenial(stockSettings).denied) return false;
	return getRawCulocaBranch(stockSettings)?.saleApproved === false;
}

/**
 * Shop-Freigabe: explizit true, oder Autofreigabe wenn nicht explizit false.
 */
export function resolveItemShopApproved(
	stockSettings: unknown,
	creatorAutoApprove: boolean
): boolean {
	if (getCulocaSaleDenial(stockSettings).denied) return false;
	if (isExplicitShopOptOut(stockSettings)) return false;
	if (isCulocaSaleApproved(stockSettings)) return true;
	return creatorAutoApprove;
}
