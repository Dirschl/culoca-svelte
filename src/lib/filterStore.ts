import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { page } from '$app/stores';

export interface UserFilter {
	userId: string;
	username: string;
	accountName?: string;
}

export interface LocationFilter {
	lat: number;
	lon: number;
	name: string;
	fromItem?: boolean; // true if set from item detail page
}

export interface FilterState {
	userFilter: UserFilter | null;
	locationFilter: LocationFilter | null;
	lastGpsPosition: { lat: number; lon: number } | null;
	gpsAvailable: boolean;
}

// Create the store
function createFilterStore() {
	const initialState: FilterState = {
		userFilter: null,
		locationFilter: null,
		lastGpsPosition: null,
		gpsAvailable: false
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

		// Clear all filters
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

// Export the store
export const filterStore = createFilterStore();

// Derived stores for easy access
export const userFilter = derived(filterStore, $filterStore => $filterStore.userFilter);
export const locationFilter = derived(filterStore, $filterStore => $filterStore.locationFilter);
export const hasActiveFilters = derived(filterStore, $filterStore => 
	!!$filterStore.userFilter || !!$filterStore.locationFilter
);
export const gpsStatus = derived(filterStore, $filterStore => ({
	available: $filterStore.gpsAvailable,
	lastPosition: $filterStore.lastGpsPosition
})); 