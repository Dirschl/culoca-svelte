import { describe, expect, it } from 'vitest';
import { matchDenialPresetFromReason, resolveDenialReasonText } from './denialReasons';

describe('resolveDenialReasonText', () => {
	it('uses preset label', () => {
		expect(resolveDenialReasonText('quality')).toBe('Qualität nicht ausreichend');
	});

	it('uses custom text for other', () => {
		expect(resolveDenialReasonText('other', 'Motiv zu speziell')).toBe('Motiv zu speziell');
	});
});

describe('matchDenialPresetFromReason', () => {
	it('matches stored preset label', () => {
		expect(matchDenialPresetFromReason('Kein Modelrelease / erkennbare Personen im Bild')).toEqual({
			presetId: 'no_model_release',
			customText: ''
		});
	});

	it('falls back to other for unknown text', () => {
		expect(matchDenialPresetFromReason('Individuelle Begründung')).toEqual({
			presetId: 'other',
			customText: 'Individuelle Begründung'
		});
	});
});
