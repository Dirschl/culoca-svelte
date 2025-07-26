import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { page } from '$app/stores';
import { get } from 'svelte/store';

export interface UserFilter {
	userId: string;
	username: string;
	accountName?: string;
	avatarUrl?: string;
	privacyMode?: 'public' | 'closed' | 'private' | 'all';
}

export interface LocationFilter {
	lat: number;
	lon: number;
	name: string;
	fromItem?: boolean; // true if set from item detail page
}

export interface ReferrerAccount {
	profileId: string;
	accountName: string;
	fullName: string;
	avatarUrl?: string;
	privacyMode: 'public' | 'closed' | 'private' | 'all';
	timestamp: number; // When referrer was set
}

export interface FilterState {
	userFilter: UserFilter | null;
	locationFilter: LocationFilter | null;
	lastGpsPosition: { lat: number; lon: number } | null;
	gpsAvailable: boolean;
	referrerAccount: ReferrerAccount | null; // Persistent customer branding
}

// Create the store
function createFilterStore() {
	// Lade gespeicherten State aus localStorage, falls vorhanden
	const storedState = loadFromStorage();
	const initialState: FilterState = {
		userFilter: null,
		locationFilter: null,
		lastGpsPosition: null,
		gpsAvailable: false,
		referrerAccount: null,
		...storedState // Überschreibt ggf. mit gespeicherten Werten
	};

	const { subscribe, set, update } = writable<FilterState>(initialState);

	return {
		subscribe,
		
		// Set user filter
		setUserFilter: (filter: UserFilter | null) => {
			update(state => {
				const newState = { ...state, userFilter: filter };
				updateURL(newState);
				saveToStorage(newState);
				return newState;
			});
		},

		// Set location filter
		setLocationFilter: (filter: LocationFilter | null) => {
			update(state => {
				const newState = { ...state, locationFilter: filter };
				updateURL(newState);
				saveToStorage(newState);
				return newState;
			});
		},

		// Set referrer account (persistent customer branding)
		setReferrerAccount: (referrer: ReferrerAccount | null) => {
			update(state => {
				const newState = { ...state, referrerAccount: referrer };
				saveToStorage(newState);
				return newState;
			});
		},

		// Update GPS status and position
		updateGpsStatus: (available: boolean, position?: { lat: number; lon: number }) => {
			update(state => {
				const newState = { 
					...state, 
					gpsAvailable: available,
					lastGpsPosition: position || state.lastGpsPosition
				};
				
				// Auto-remove location filter if GPS becomes available and no manual location set
				if (available && state.locationFilter && !state.locationFilter.fromItem) {
					newState.locationFilter = null;
					updateURL(newState);
				}
				
				saveToStorage(newState);
				return newState;
			});
		},

		// Clear all filters (but keep referrer account)
		clearFilters: () => {
			update(state => {
				const newState = { 
					...state, 
					userFilter: null, 
					locationFilter: null 
				};
				updateURL(newState);
				saveToStorage(newState);
				return newState;
			});
		},

		// Clear only user filter
		clearUserFilter: () => {
			update(state => {
				const newState = { ...state, userFilter: null };
				updateURL(newState);
				saveToStorage(newState);
				return newState;
			});
		},

		// Clear only location filter
		clearLocationFilter: () => {
			update(state => {
				const newState = { ...state, locationFilter: null };
				updateURL(newState);
				saveToStorage(newState);
				return newState;
			});
		},

		// Clear referrer account (remove customer branding)
		clearReferrerAccount: () => {
			update(state => {
				const newState = { ...state, referrerAccount: null };
				saveToStorage(newState);
				return newState;
			});
		},

		// Apply referrer account as user filter (for customer branding)
		applyReferrerAsUserFilter: () => {
			update(state => {
				if (!state.referrerAccount) return state;
				
				const userFilter: UserFilter = {
					userId: state.referrerAccount.profileId,
					username: state.referrerAccount.fullName,
					accountName: state.referrerAccount.accountName,
					avatarUrl: state.referrerAccount.avatarUrl,
					privacyMode: state.referrerAccount.privacyMode
				};
				
				const newState = { ...state, userFilter };
				updateURL(newState);
				saveToStorage(newState);
				return newState;
			});
		},

		// Initialize from URL parameters and localStorage
		initFromUrl: (searchParams: URLSearchParams) => {
			if (!browser) return;

			const storedState = loadFromStorage();
			let newState = { ...initialState, ...storedState };

			// Check URL parameters
			const userParam = searchParams.get('user');
			const accountParam = searchParams.get('account');
			const latParam = searchParams.get('lat');
			const lonParam = searchParams.get('lon');
			const locationParam = searchParams.get('location');

			if (userParam) {
				newState.userFilter = {
					userId: userParam,
					username: userParam, // Will be resolved later
					accountName: accountParam || undefined
				};
			}

			if (latParam && lonParam && locationParam) {
				newState.locationFilter = {
					lat: parseFloat(latParam),
					lon: parseFloat(lonParam),
					name: locationParam,
					fromItem: true
				};
			}

			set(newState);
			saveToStorage(newState);
		}
	};
}

// Helper functions
function updateURL(state: FilterState) {
	if (!browser) return;

	const url = new URL(window.location.href);
	const params = url.searchParams;

	// Clear existing filter params
	params.delete('user');
	params.delete('account');
	params.delete('lat');
	params.delete('lon');
	params.delete('location');

	// Add current filters
	if (state.userFilter && state.userFilter.userId) {
		params.set('user', state.userFilter.userId);
		if (state.userFilter.accountName) {
			params.set('account', state.userFilter.accountName);
		}
	}

	if (state.locationFilter) {
		params.set('lat', state.locationFilter.lat.toString());
		params.set('lon', state.locationFilter.lon.toString());
		params.set('location', state.locationFilter.name);
	}

	// Update URL without triggering navigation
	window.history.replaceState({}, '', url.toString());
}

function saveToStorage(state: FilterState) {
	if (!browser) return;
	
	try {
		localStorage.setItem('culoca-filters', JSON.stringify(state));
	} catch (error) {
		console.warn('Failed to save filters to localStorage:', error);
	}
}

function loadFromStorage(): Partial<FilterState> {
	if (!browser) return {};
	
	try {
		const stored = localStorage.getItem('culoca-filters');
		return stored ? JSON.parse(stored) : {};
	} catch (error) {
		console.warn('Failed to load filters from localStorage:', error);
		return {};
	}
}

// Hilfsfunktion: Beste verfügbare GPS-Position bestimmen
export function getEffectiveGpsPosition() {
	const state = get(filterStore);
	// 1. Location-Filter (z.B. aus Suchfeld)
	if (state.locationFilter && state.locationFilter.lat && state.locationFilter.lon) {
		return { 
			lat: state.locationFilter.lat, 
			lon: state.locationFilter.lon, 
			source: 'locationFilter',
			fromItem: state.locationFilter.fromItem || false
		};
	}
	// 2. Letzte GPS-Position (live)
	if (state.lastGpsPosition && state.lastGpsPosition.lat && state.lastGpsPosition.lon) {
		return { 
			lat: state.lastGpsPosition.lat, 
			lon: state.lastGpsPosition.lon, 
			source: 'lastGpsPosition',
			fromItem: false
		};
	}
	// 3. Persistierter Wert (aus localStorage)
	if (typeof window !== 'undefined') {
		const stored = localStorage.getItem('culoca-filters');
		if (stored) {
			try {
				const parsed = JSON.parse(stored);
				if (parsed.lastGpsPosition && parsed.lastGpsPosition.lat && parsed.lastGpsPosition.lon) {
					return { 
						lat: parsed.lastGpsPosition.lat, 
						lon: parsed.lastGpsPosition.lon, 
						source: 'persisted',
						fromItem: false
					};
				}
			} catch (e) {}
		}
	}
	// 4. Kein Wert verfügbar
	return null;
}

// Export the store
export const filterStore = createFilterStore();

// Derived stores for easy access
export const userFilter = derived(filterStore, $filterStore => $filterStore.userFilter);
export const locationFilter = derived(filterStore, $filterStore => $filterStore.locationFilter);
export const referrerAccount = derived(filterStore, $filterStore => $filterStore.referrerAccount);
export const hasActiveFilters = derived(filterStore, $filterStore => 
	!!$filterStore.userFilter || !!$filterStore.locationFilter
);
export const gpsStatus = derived(filterStore, $filterStore => ({
	available: $filterStore.gpsAvailable,
	lastPosition: $filterStore.lastGpsPosition
}));

// Derived store to check if customer branding should be shown
export const shouldShowCustomerBranding = derived(filterStore, $filterStore => {
	// Show customer branding if:
	// 1. There's a referrer account with private mode (always show), OR
	// 2. There's a referrer account with closed mode (always show), OR
	// 3. There's a referrer account with public mode (always show as branding)
	if (!$filterStore.referrerAccount) return false;
	
	if ($filterStore.referrerAccount.privacyMode === 'private') {
		return true; // Always show for private mode
	}
	
	if ($filterStore.referrerAccount.privacyMode === 'closed') {
		return true; // Always show for closed mode
	}
	
	if ($filterStore.referrerAccount.privacyMode === 'public') {
		return true; // Always show customer branding for public mode
	}
	
	return false; // Don't show for 'all' mode
}); 