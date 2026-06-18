export const CULOCA_SALE_DENIAL_PRESETS = [
	{ id: 'no_model_release', label: 'Kein Modelrelease / erkennbare Personen im Bild' },
	{ id: 'no_castles', label: 'Burgen und Schlösser können nicht verkauft werden' },
	{ id: 'quality', label: 'Qualität nicht ausreichend' },
	{ id: 'rights_unclear', label: 'Rechte am Motiv unklar' },
	{ id: 'other', label: 'Sonstiges (Freitext)' }
] as const;

export type CulocaSaleDenialPresetId = (typeof CULOCA_SALE_DENIAL_PRESETS)[number]['id'];

export function resolveDenialReasonText(
	presetId: CulocaSaleDenialPresetId | string,
	customText?: string
): string {
	if (presetId === 'other') {
		const custom = customText?.trim();
		return custom || 'Verkauf nicht freigegeben';
	}
	const preset = CULOCA_SALE_DENIAL_PRESETS.find((p) => p.id === presetId);
	return preset?.label ?? customText?.trim() ?? 'Verkauf nicht freigegeben';
}

export function matchDenialPresetFromReason(reason: string | null | undefined): {
	presetId: CulocaSaleDenialPresetId;
	customText: string;
} {
	const text = reason?.trim() ?? '';
	if (!text) return { presetId: 'other', customText: '' };
	const match = CULOCA_SALE_DENIAL_PRESETS.find((p) => p.id !== 'other' && p.label === text);
	if (match) return { presetId: match.id, customText: '' };
	return { presetId: 'other', customText: text };
}
