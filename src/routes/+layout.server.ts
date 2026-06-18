import type { LayoutServerLoad } from './$types';

function readPriceCents(publicKey: string, serverKey: string, fallback: number): number {
	const raw = process.env[publicKey]?.trim() || process.env[serverKey]?.trim();
	if (!raw) return fallback;
	const parsed = Number(raw);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const load: LayoutServerLoad = async () => {
	const enabled =
		process.env.CULOCA_SALES_ENABLED === 'true' ||
		process.env.PUBLIC_CULOCA_SALES_ENABLED === 'true';

	return {
		culocaSales: {
			enabled,
			standardPriceCents: readPriceCents(
				'PUBLIC_CULOCA_LICENSE_STANDARD_PRICE_CENTS',
				'CULOCA_LICENSE_STANDARD_PRICE_CENTS',
				2900
			),
			extendedPriceCents: readPriceCents(
				'PUBLIC_CULOCA_LICENSE_EXTENDED_PRICE_CENTS',
				'CULOCA_LICENSE_EXTENDED_PRICE_CENTS',
				9900
			)
		}
	};
};
