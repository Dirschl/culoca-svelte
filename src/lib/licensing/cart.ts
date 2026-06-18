import type { LicenseTier } from '$lib/licensing/tiers';

export const MAX_CART_ITEMS = 50;

export type CartLinePayload = {
	item_id: string;
	license_tier: LicenseTier;
	price_cents: number;
};

export type CartLineDisplay = CartLinePayload & {
	id: string;
	added_at: string;
	item_title: string | null;
	item_slug: string | null;
	item_href: string | null;
	preview_path: string | null;
	already_licensed?: boolean;
};

export function parseCartLineItemsJson(raw: string | undefined | null): CartLinePayload[] {
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		const out: CartLinePayload[] = [];
		for (const row of parsed) {
			if (!row || typeof row !== 'object') continue;
			const item_id = String((row as CartLinePayload).item_id || '');
			const license_tier = (row as CartLinePayload).license_tier;
			const price_cents = Number((row as CartLinePayload).price_cents);
			if (!item_id) continue;
			if (license_tier !== 'standard' && license_tier !== 'extended') continue;
			if (!Number.isFinite(price_cents) || price_cents < 100) continue;
			out.push({ item_id, license_tier, price_cents });
		}
		return out;
	} catch {
		return [];
	}
}

export function serializeCartLineItems(lines: CartLinePayload[]): string {
	return JSON.stringify(lines);
}
