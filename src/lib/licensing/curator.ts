/** Culoca-Lizenz-Kurator (vorerst nur DIRSCHL.com). */

export const DEFAULT_LICENSE_CURATOR_USER_ID = '0ceb2320-0553-463b-971a-a0eef5ecdf09';

export function getLicenseCuratorUserId(): string {
	if (typeof process !== 'undefined' && process.env?.CULOCA_LICENSE_CURATOR_USER_ID?.trim()) {
		return process.env.CULOCA_LICENSE_CURATOR_USER_ID.trim();
	}
	return DEFAULT_LICENSE_CURATOR_USER_ID;
}

export function isLicenseCurator(userId: string | null | undefined): boolean {
	return !!userId && userId === getLicenseCuratorUserId();
}

/** Client-safe: feste Kurator-ID (Env nur serverseitig). */
export const LICENSE_CURATOR_USER_ID = DEFAULT_LICENSE_CURATOR_USER_ID;

export function isLicenseCuratorClient(userId: string | null | undefined): boolean {
	return !!userId && userId === LICENSE_CURATOR_USER_ID;
}
