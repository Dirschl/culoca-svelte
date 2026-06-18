import { describe, expect, it } from 'vitest';
import {
	isExplicitShopOptOut,
	resolveItemShopApproved,
	getCulocaSaleDenial
} from './shopApproval';

describe('resolveItemShopApproved', () => {
	it('returns true for explicit approval', () => {
		expect(resolveItemShopApproved({ culoca: { saleApproved: true } }, false)).toBe(true);
	});

	it('returns false without approval or auto-approve', () => {
		expect(resolveItemShopApproved({}, false)).toBe(false);
	});

	it('returns true with auto-approve when not opted out', () => {
		expect(resolveItemShopApproved({}, true)).toBe(true);
	});

	it('returns false on explicit opt-out even with auto-approve', () => {
		expect(resolveItemShopApproved({ culoca: { saleApproved: false } }, true)).toBe(false);
	});

	it('returns false when curator denied even with auto-approve', () => {
		expect(
			resolveItemShopApproved(
				{
					culoca: {
						saleDenied: true,
						saleDeniedReason: 'Qualität nicht ausreichend',
						saleApproved: false
					}
				},
				true
			)
		).toBe(false);
	});
});

describe('isExplicitShopOptOut', () => {
	it('detects saleApproved false without denial', () => {
		expect(isExplicitShopOptOut({ culoca: { saleApproved: false } })).toBe(true);
	});

	it('does not treat curator denial as owner opt-out', () => {
		expect(
			isExplicitShopOptOut({
				culoca: { saleApproved: false, saleDenied: true, saleDeniedReason: 'Kein Modelrelease' }
			})
		).toBe(false);
	});

	it('ignores missing branch', () => {
		expect(isExplicitShopOptOut({})).toBe(false);
	});
});

describe('getCulocaSaleDenial', () => {
	it('reads denial reason', () => {
		expect(
			getCulocaSaleDenial({
				culoca: { saleDenied: true, saleDeniedReason: 'Burgen und Schlösser können nicht verkauft werden' }
			})
		).toEqual({
			denied: true,
			reason: 'Burgen und Schlösser können nicht verkauft werden',
			at: null,
			by: null
		});
	});
});
