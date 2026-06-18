/**
 * Culoca-Bildlizenzen (Verkauf über Lemon Squeezy).
 * stock_settings.culoca: Kurator-Freigabe pro Bild.
 */

export type LicenseTier = 'standard' | 'extended';

export type CulocaSaleSettings = {
	/** @deprecated Legacy — wird beim Lesen auf saleApproved gemappt */
	saleEnabled?: boolean;
	/** Kurator-Freigabe: Bild im Culoca-Shop (Opt-in) */
	saleApproved?: boolean;
	saleApprovedAt?: string | null;
	saleApprovedBy?: string | null;
	standardPriceCents?: number | null;
	extendedPriceCents?: number | null;
};

export type ItemStockSettingsWithCuloca = {
	agencies?: Record<string, unknown>;
	culoca?: CulocaSaleSettings | null;
};

export const LICENSE_TIER_LABELS: Record<LicenseTier, string> = {
	standard: 'Standard-Lizenz',
	extended: 'Erweiterte Lizenz'
};

export const LICENSE_TIER_DESCRIPTIONS: Record<LicenseTier, string> = {
	standard:
		'Digitale und gedruckte Nutzung in Websites, Social Media, Blogs und Präsentationen. Keine Weiterveräußerung als Stock-Foto. Eine Organisation / ein Projekt.',
	extended:
		'Werbung, Merchandise, größere Print-Auflagen und breitere kommerzielle Kampagnen. Keine Weiterveräußerung als Stock-Foto. Eine Organisation / ein Projekt.'
};

export function parseCulocaSaleSettings(raw: unknown): CulocaSaleSettings | null {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
	const o = raw as CulocaSaleSettings;
	const saleApproved =
		o.saleApproved === true || (o.saleApproved === undefined && o.saleEnabled === true);
	return {
		saleApproved,
		saleApprovedAt: typeof o.saleApprovedAt === 'string' ? o.saleApprovedAt : null,
		saleApprovedBy: typeof o.saleApprovedBy === 'string' ? o.saleApprovedBy : null,
		standardPriceCents:
			typeof o.standardPriceCents === 'number' ? o.standardPriceCents : null,
		extendedPriceCents:
			typeof o.extendedPriceCents === 'number' ? o.extendedPriceCents : null
	};
}

export function getCulocaFromStockSettings(raw: unknown): CulocaSaleSettings | null {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
	const culoca = (raw as ItemStockSettingsWithCuloca).culoca;
	return parseCulocaSaleSettings(culoca);
}

export function isCulocaSaleApproved(stockSettings: unknown): boolean {
	return getCulocaFromStockSettings(stockSettings)?.saleApproved === true;
}

export type ItemForSaleInput = {
	is_private?: boolean | null;
	type_id?: number | null;
	profile_id?: string | null;
	stock_settings?: unknown;
};

export type ItemForSaleOptions = {
	salesGloballyEnabled: boolean;
	fotoTypeId: number;
	/** Profil culoca_licensing_opt_in oder Kurator als Ersteller */
	creatorLicensingOptIn: boolean;
	curatorUserId: string;
};

/**
 * Bild ist kaufbar nur wenn: global an, öffentliches Foto, Ersteller-Opt-in (oder Kurator),
 * und Kurator hat saleApproved gesetzt.
 */
export function isItemForSale(item: ItemForSaleInput, options: ItemForSaleOptions): boolean {
	if (!options.salesGloballyEnabled) return false;
	if (item.is_private) return false;
	if (item.type_id !== options.fotoTypeId) return false;

	const profileId = item.profile_id ?? null;
	const creatorOk =
		options.creatorLicensingOptIn ||
		(!!profileId && profileId === options.curatorUserId);
	if (!creatorOk) return false;

	return isCulocaSaleApproved(item.stock_settings);
}

export function getTierPriceCents(
	tier: LicenseTier,
	item: { stock_settings?: unknown },
	defaults: { standard: number; extended: number }
): number {
	const culoca = getCulocaFromStockSettings(item.stock_settings);
	if (tier === 'standard') {
		return culoca?.standardPriceCents ?? defaults.standard;
	}
	return culoca?.extendedPriceCents ?? defaults.extended;
}

/** UI: Lizenz-Anfrage statt Shop (Foto, Verkauf global an, aber nicht freigegeben). */
export function canRequestLicense(
	item: ItemForSaleInput,
	options: Omit<ItemForSaleOptions, 'creatorLicensingOptIn'> & {
		creatorLicensingOptIn?: boolean;
		isViewerCreator?: boolean;
	}
): boolean {
	if (!options.salesGloballyEnabled) return false;
	if (options.isViewerCreator) return false;
	if (item.is_private) return false;
	if (item.type_id !== options.fotoTypeId) return false;
	if (isItemForSale(item, { ...options, creatorLicensingOptIn: options.creatorLicensingOptIn ?? false })) {
		return false;
	}
	return true;
}
