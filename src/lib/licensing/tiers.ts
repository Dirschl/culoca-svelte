/**
 * Culoca-Bildlizenzen (Verkauf über Lemon Squeezy).
 * stock_settings.culoca ergänzt agencies.adobe.
 */

export type LicenseTier = 'standard' | 'extended';

export type CulocaSaleSettings = {
	saleEnabled?: boolean;
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
	return {
		saleEnabled: o.saleEnabled === true,
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

export function isItemForSale(
	item: { is_private?: boolean | null; type_id?: number | null; stock_settings?: unknown },
	options: { salesGloballyEnabled: boolean; fotoTypeId: number }
): boolean {
	if (!options.salesGloballyEnabled) return false;
	if (item.is_private) return false;
	if (item.type_id !== options.fotoTypeId) return false;
	const culoca = getCulocaFromStockSettings(item.stock_settings);
	if (culoca?.saleEnabled === false) return false;
	return true;
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
