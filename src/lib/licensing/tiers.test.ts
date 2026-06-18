import { describe, expect, it } from 'vitest';
import { isItemForSale, canRequestLicense } from './tiers';

const FOTO = 1;

const baseItem = {
	is_private: false,
	type_id: FOTO,
	profile_id: 'other-user',
	stock_settings: { culoca: { saleApproved: true } }
};

const baseOpts = {
	salesGloballyEnabled: true,
	fotoTypeId: FOTO,
	creatorLicensingOptIn: true,
	curatorUserId: ''
};

describe('isItemForSale', () => {
	it('requires saleApproved or auto-approve', () => {
		expect(isItemForSale({ ...baseItem, stock_settings: {} }, baseOpts)).toBe(false);
	});

	it('requires creator opt-in', () => {
		expect(isItemForSale(baseItem, { ...baseOpts, creatorLicensingOptIn: false })).toBe(false);
	});

	it('allows auto-approve without per-image flag', () => {
		expect(
			isItemForSale(
				{ ...baseItem, stock_settings: {} },
				{ ...baseOpts, creatorAutoApprove: true }
			)
		).toBe(true);
	});

	it('respects explicit opt-out with auto-approve', () => {
		expect(
			isItemForSale(
				{ ...baseItem, stock_settings: { culoca: { saleApproved: false } } },
				{ ...baseOpts, creatorAutoApprove: true }
			)
		).toBe(false);
	});

	it('allows sale when approved and creator opted in', () => {
		expect(isItemForSale(baseItem, baseOpts)).toBe(true);
	});
});

describe('canRequestLicense', () => {
	it('shows request when not for sale', () => {
		expect(
			canRequestLicense({ ...baseItem, stock_settings: {} }, { ...baseOpts, isViewerCreator: false })
		).toBe(true);
	});

	it('hides request when already for sale', () => {
		expect(canRequestLicense(baseItem, { ...baseOpts, isViewerCreator: false })).toBe(false);
	});
});
