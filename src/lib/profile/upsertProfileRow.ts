import type { SupabaseClient } from '@supabase/supabase-js';

const LICENSING_ONLY_KEYS = ['culoca_licensing_opt_in', 'culoca_licensing_opt_in_at'] as const;

function isMissingColumnError(error: { message?: string; code?: string } | null, column: string) {
	if (!error?.message) return false;
	const msg = error.message.toLowerCase();
	return (
		msg.includes(column.toLowerCase()) &&
		(msg.includes('column') || msg.includes('schema cache') || error.code === 'PGRST204')
	);
}

function stripKeys<T extends Record<string, unknown>>(data: T, keys: readonly string[]): T {
	const next = { ...data };
	for (const key of keys) {
		delete next[key];
	}
	return next;
}

export type ProfileUpsertResult = {
	error: { message: string; code?: string } | null;
	licensingSkipped: boolean;
};

/** Upsert mit Fallback, falls Lizenz-Spalten in der DB noch fehlen (Migration nicht gelaufen). */
export async function upsertProfileRow(
	supabase: SupabaseClient,
	profileData: Record<string, unknown>
): Promise<ProfileUpsertResult> {
	const first = await supabase.from('profiles').upsert(profileData, { onConflict: 'id' });
	if (!first.error) {
		return { error: null, licensingSkipped: false };
	}

	if (
		LICENSING_ONLY_KEYS.some((key) => isMissingColumnError(first.error, key)) &&
		LICENSING_ONLY_KEYS.some((key) => key in profileData)
	) {
		const retry = await supabase
			.from('profiles')
			.upsert(stripKeys(profileData, LICENSING_ONLY_KEYS), { onConflict: 'id' });
		return {
			error: retry.error,
			licensingSkipped: !retry.error
		};
	}

	return { error: first.error, licensingSkipped: false };
}

export function formatProfileSaveError(
	error: { message?: string; code?: string } | null,
	options?: { licensingSkipped?: boolean }
): string {
	if (!error?.message) {
		return 'Fehler beim Speichern des Profils';
	}

	const msg = error.message;
	const lower = msg.toLowerCase();

	if (lower.includes('culoca_licensing_opt_in')) {
		return 'Lizenz-Einstellungen konnten nicht gespeichert werden (Datenbank-Migration fehlt). Alle anderen Profildaten bitte erneut speichern, nachdem die Migration ausgeführt wurde.';
	}
	if (lower.includes('duplicate key') && lower.includes('accountname')) {
		return 'Dieser Accountname ist bereits vergeben.';
	}
	if (lower.includes('profiles_accountname') || lower.includes('accountname')) {
		return 'Ungültiger oder bereits vergebener Accountname.';
	}
	if (lower.includes('column') || error.code === 'PGRST204') {
		return `Profil konnte nicht gespeichert werden: ${msg}`;
	}

	if (options?.licensingSkipped) {
		return 'Profil gespeichert. Lizenz-Opt-in konnte nicht übernommen werden — bitte Datenbank-Migration ausführen.';
	}

	return msg;
}
