import { describe, expect, it } from 'vitest';
import { formatProfileSaveError } from './upsertProfileRow';

describe('formatProfileSaveError', () => {
	it('maps missing licensing column to actionable message', () => {
		const msg = formatProfileSaveError({
			message: "Could not find the 'culoca_licensing_opt_in' column of 'profiles' in the schema cache",
			code: 'PGRST204'
		});
		expect(msg).toContain('Lizenz-Einstellungen');
	});

	it('maps duplicate accountname', () => {
		const msg = formatProfileSaveError({
			message: 'duplicate key value violates unique constraint "profiles_accountname_key"'
		});
		expect(msg).toContain('Accountname');
	});
});
