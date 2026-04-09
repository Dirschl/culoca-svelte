/**
 * Flexibles Stock-Metadaten-JSON pro Item (`items.stock_settings`).
 * Start: agencies.adobe — später weitere Agenturen / Culoca-Lizenz / Shop.
 *
 * Legacy-Spalten `adobe_stock_*` bleiben vorerst parallel; Leselogik bevorzugt JSON.
 */

export type AdobeStockAgencyState = {
	status: AdobeStockStatus;
	uploadedAt: string | null;
	assetId: string | null;
	publicUrl: string | null;
	error: string | null;
};

export type AdobeStockStatus =
	| 'none'
	| 'uploaded'
	| 'pending_review'
	| 'approved'
	| 'rejected'
	| 'error';

export type ItemStockSettings = {
	agencies?: {
		adobe?: Partial<{
			status: AdobeStockStatus;
			uploadedAt: string | null;
			assetId: string | null;
			publicUrl: string | null;
			error: string | null;
		}> | null;
	};
};

/** Zurücksetzen nur Adobe-Zweig (FTP/Link), ohne restliches `stock_settings` zu löschen. */
export const EMPTY_ADOBE_STOCK_STATE: AdobeStockAgencyState = {
	status: 'none',
	uploadedAt: null,
	assetId: null,
	publicUrl: null,
	error: null
};

function isAdobeStatus(v: unknown): v is AdobeStockStatus {
	return (
		v === 'none' ||
		v === 'uploaded' ||
		v === 'pending_review' ||
		v === 'approved' ||
		v === 'rejected' ||
		v === 'error'
	);
}

export function parseItemStockSettings(raw: unknown): ItemStockSettings {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
	return raw as ItemStockSettings;
}

/** Adobe-Teil aus JSON (ohne Legacy-Fallback). */
export function getAdobeFromStockSettings(raw: unknown): Partial<AdobeStockAgencyState> | null {
	const s = parseItemStockSettings(raw).agencies?.adobe;
	if (!s || typeof s !== 'object') return null;
	return {
		status: isAdobeStatus(s.status) ? s.status : undefined,
		uploadedAt:
			s.uploadedAt === undefined || s.uploadedAt === null
				? undefined
				: typeof s.uploadedAt === 'string'
					? s.uploadedAt
					: null,
		assetId: s.assetId !== undefined ? (s.assetId as string | null) : undefined,
		publicUrl: s.publicUrl !== undefined ? (s.publicUrl as string | null) : undefined,
		error: s.error !== undefined ? (s.error as string | null) : undefined
	};
}

/**
 * Effektiver Adobe-Zustand: JSON `agencies.adobe` hat Vorrang vor Legacy-Spalten
 * (pro Feld, wenn im JSON gesetzt).
 */
export function getAdobeStockStateFromItem(item: Record<string, unknown>): AdobeStockAgencyState {
	const j = getAdobeFromStockSettings(item.stock_settings);
	const legacyStatus = item.adobe_stock_status;
	const status =
		j?.status !== undefined
			? j.status
			: isAdobeStatus(legacyStatus)
				? legacyStatus
				: 'none';

	const uploadedAt =
		j?.uploadedAt !== undefined
			? j.uploadedAt
			: typeof item.adobe_stock_uploaded_at === 'string'
				? item.adobe_stock_uploaded_at
				: item.adobe_stock_uploaded_at === null
					? null
					: null;

	const assetId =
		j?.assetId !== undefined
			? j.assetId
			: typeof item.adobe_stock_asset_id === 'string' || item.adobe_stock_asset_id === null
				? (item.adobe_stock_asset_id as string | null)
				: null;

	const publicUrl =
		j?.publicUrl !== undefined
			? j.publicUrl
			: typeof item.adobe_stock_url === 'string' || item.adobe_stock_url === null
				? (item.adobe_stock_url as string | null)
				: null;

	const err =
		j?.error !== undefined
			? j.error
			: typeof item.adobe_stock_error === 'string' || item.adobe_stock_error === null
				? (item.adobe_stock_error as string | null)
				: null;

	return {
		status,
		uploadedAt,
		assetId,
		publicUrl,
		error: err
	};
}

/** Flache Legacy-Felder für Client/API — konsistent mit getAdobeStockStateFromItem. */
export function resolveAdobeLegacyFields(item: Record<string, unknown>): {
	adobe_stock_status: string;
	adobe_stock_uploaded_at: string | null;
	adobe_stock_asset_id: string | null;
	adobe_stock_url: string | null;
	adobe_stock_error: string | null;
} {
	const a = getAdobeStockStateFromItem(item);
	return {
		adobe_stock_status: a.status,
		adobe_stock_uploaded_at: a.uploadedAt,
		adobe_stock_asset_id: a.assetId,
		adobe_stock_url: a.publicUrl,
		adobe_stock_error: a.error
	};
}

export function enrichItemWithResolvedAdobeStock<T extends Record<string, unknown>>(item: T): T {
	const flat = resolveAdobeLegacyFields(item);
	return { ...item, ...flat } as T;
}

/** Schreibt `agencies.adobe` in ein stock_settings-Objekt (übrige Keys unverändert). */
export function setAdobeInStockSettings(
	existingStock: unknown,
	adobe: AdobeStockAgencyState
): Record<string, unknown> {
	const base = parseItemStockSettings(existingStock);
	const agencies = {
		...(base.agencies && typeof base.agencies === 'object' ? base.agencies : {}),
		adobe: {
			status: adobe.status,
			uploadedAt: adobe.uploadedAt,
			assetId: adobe.assetId,
			publicUrl: adobe.publicUrl,
			error: adobe.error
		}
	};
	return { ...base, agencies } as Record<string, unknown>;
}

/**
 * Nach PATCH/Upload: Legacy-Spalten + `stock_settings.agencies.adobe` (bestehendes JSON unter `stock_settings` bleibt erhalten).
 */
export function buildAdobeDualWrite(
	existingStock: unknown,
	adobe: AdobeStockAgencyState
): {
	adobe_stock_status: string;
	adobe_stock_uploaded_at: string | null;
	adobe_stock_asset_id: string | null;
	adobe_stock_url: string | null;
	adobe_stock_error: string | null;
	stock_settings: Record<string, unknown>;
} {
	return {
		adobe_stock_status: adobe.status,
		adobe_stock_uploaded_at: adobe.uploadedAt,
		adobe_stock_asset_id: adobe.assetId,
		adobe_stock_url: adobe.publicUrl,
		adobe_stock_error: adobe.error,
		stock_settings: setAdobeInStockSettings(existingStock, adobe)
	};
}
