export const PROFILE_SECTION_IDS = [
	'basics',
	'attribution',
	'privacy',
	'gps',
	'contact',
	'social',
	'errorlog'
] as const;

export type ProfileSection = (typeof PROFILE_SECTION_IDS)[number];

export function isProfileSection(value: string | null | undefined): value is ProfileSection {
	return value !== undefined && value !== null && (PROFILE_SECTION_IDS as readonly string[]).includes(value);
}
