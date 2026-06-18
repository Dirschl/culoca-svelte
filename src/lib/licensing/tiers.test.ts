import { describe, expect, it } from 'vitest';
import { isItemForSale, canRequestLicense } from './tiers';

const CURATOR = '0ceb2320-0553-463b-971a-a0eef5ecdf09';
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
	curatorUserId: CURATOR
};

describe('isItemForSale', () => {
	it('requires saleApproved opt-in', () => {
		expect(
			isItemForSale(
				{ ...baseItem, stock_settings: {} },
				baseOpts
			)
		).toBe(false);
	});

	it('requires creator opt-in for non-curator items', () => {
		expect(
			isItemForSale(baseItem, { ...baseOpts, creatorLicensingOptIn: false })
		).toBe(false);
	});

	it('allows curator own items without profile opt-in flag', () => {
		expect(
			isItemForSale(
				{ ...baseItem, profile_id: CURATOR },
				{ ...baseOpts, creatorLicensingOptIn: false }
			)
		).toBe(true);
	});

	it('allows sale when approved and creator opted in', () => {
		expect(isItemForSale(baseItem, baseOpts)).toBe(true);
	});
});

describe('canRequestLicense', () => {
	it('shows request when not for sale', () => {
		expect(
			canRequestLicense(
				{ ...baseItem, stock_settings: {} },
				{ ...baseOpts, isViewerCreator: false }
			)
		).toBe(true);
	});

	it('hides request when already for sale', () => {
		expect(canRequestLicense(baseItem, { ...baseOpts, isViewerCreator: false })).toBe(false);
	});
});
