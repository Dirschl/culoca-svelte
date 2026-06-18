import { describe, expect, it } from 'vitest';
import { isExplicitShopOptOut, resolveItemShopApproved } from './shopApproval';

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
});

describe('isExplicitShopOptOut', () => {
	it('detects saleApproved false', () => {
		expect(isExplicitShopOptOut({ culoca: { saleApproved: false } })).toBe(true);
	});

	it('ignores missing branch', () => {
		expect(isExplicitShopOptOut({})).toBe(false);
	});
});
