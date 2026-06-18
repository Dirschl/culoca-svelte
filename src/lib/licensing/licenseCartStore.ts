import { writable, get } from 'svelte/store';
import { authFetch } from '$lib/authFetch';

export const licenseCartCount = writable(0);

export const culocaSalesEnabled =
	typeof import.meta !== 'undefined' && import.meta.env.PUBLIC_CULOCA_SALES_ENABLED === 'true';

export async function refreshLicenseCartCount(): Promise<number> {
	if (!culocaSalesEnabled) {
		licenseCartCount.set(0);
		return 0;
	}
	try {
		const response = await authFetch('/api/cart');
		if (!response.ok) {
			licenseCartCount.set(0);
			return 0;
		}
		const data = await response.json();
		const count = Number(data?.count ?? 0);
		licenseCartCount.set(count);
		return count;
	} catch {
		licenseCartCount.set(0);
		return 0;
	}
}

export function setLicenseCartCount(count: number) {
	licenseCartCount.set(count);
}

export function bumpLicenseCartCount(delta = 1) {
	licenseCartCount.update((n) => Math.max(0, n + delta));
}

export function notifyCartUpdated(count?: number) {
	if (typeof count === 'number') {
		setLicenseCartCount(count);
	} else {
		void refreshLicenseCartCount();
	}
	if (typeof window !== 'undefined') {
		window.dispatchEvent(
			new CustomEvent('culoca:cart-updated', { detail: { count: get(licenseCartCount) } })
		);
	}
}
