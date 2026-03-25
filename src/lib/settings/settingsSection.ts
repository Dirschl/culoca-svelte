export const SETTINGS_SECTION_IDS = [
	'appearance',
	'gallery',
	'audio',
	'interface',
	'upload'
] as const;

export type SettingsSection = (typeof SETTINGS_SECTION_IDS)[number];

export function isSettingsSection(value: string | null | undefined): value is SettingsSection {
	return value !== undefined && value !== null && (SETTINGS_SECTION_IDS as readonly string[]).includes(value);
}
