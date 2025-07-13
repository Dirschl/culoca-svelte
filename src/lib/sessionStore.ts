import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export interface CustomerBranding {
	profileId: string;
	accountName: string;
	fullName: string;
	avatarUrl?: string;
	privacyMode: 'public' | 'closed' | 'private' | 'all';
	timestamp: number;
}

export interface ActiveUserFilter {
	userId: string;
	username: string;
	accountName: string;
	avatarUrl?: string;
	privacyMode?: 'public' | 'closed' | 'private' | 'all';
}

export interface SessionState {
	userId: string | null;
	isAuthenticated: boolean;
	customerBranding: CustomerBranding | null;
	activeUserFilter: ActiveUserFilter | null;
	isDuplicateDisplay: boolean;
}

function createSessionStore() {
	const initialState: SessionState = {
		userId: null,
		isAuthenticated: false,
		customerBranding: null,
		activeUserFilter: null,
		isDuplicateDisplay: false
	};

	const { subscribe, set, update } = writable<SessionState>(initialState);

	return {
		subscribe,
		
		// Initialize store
		init: () => {
			if (!browser) return;
			
			// Load from localStorage
			try {
				const stored = localStorage.getItem('culoca-session');
				if (stored) {
					const sessionData = JSON.parse(stored);
					update(state => ({ ...state, ...sessionData }));
				}
			} catch (e) {
				console.error('Failed to parse session data:', e);
				// Clear corrupted data
				localStorage.removeItem('culoca-session');
			}
		},

		// Set user authentication
		setUser: (userId: string | null, isAuthenticated: boolean) => {
			update(state => {
				const newState = { ...state, userId, isAuthenticated };
				saveToStorage(newState);
				return newState;
			});
		},

		// Set customer branding
		setCustomerBranding: (branding: CustomerBranding | null) => {
			update(state => {
				const newState = { ...state, customerBranding: branding };
				saveToStorage(newState);
				return newState;
			});
		},

		// Clear customer branding
		clearCustomerBranding: () => {
			update(state => {
				const newState = { ...state, customerBranding: null };
				saveToStorage(newState);
				return newState;
			});
		},

		// Set active user filter
		setActiveUserFilter: (filter: ActiveUserFilter | null) => {
			update(state => {
				const newState = { ...state, activeUserFilter: filter };
				saveToStorage(newState);
				return newState;
			});
		},

		// Clear active user filter
		clearActiveUserFilter: () => {
			update(state => {
				const newState = { ...state, activeUserFilter: null };
				saveToStorage(newState);
				return newState;
			});
		},

		// Apply customer branding as user filter
		applyCustomerBrandingAsFilter: () => {
			update(state => {
				if (!state.customerBranding) return state;
				
				const userFilter: ActiveUserFilter = {
					userId: state.customerBranding.profileId,
					username: state.customerBranding.fullName,
					accountName: state.customerBranding.accountName,
					avatarUrl: state.customerBranding.avatarUrl,
					privacyMode: state.customerBranding.privacyMode
				};
				
				const newState = { ...state, activeUserFilter: userFilter };
				saveToStorage(newState);
				return newState;
			});
		},

		// Set duplicate display mode
		setDuplicateDisplay: (isDuplicate: boolean) => {
			update(state => {
				const newState = { ...state, isDuplicateDisplay: isDuplicate };
				saveToStorage(newState);
				return newState;
			});
		},

		// Clear session
		clearSession: () => {
			if (browser) {
				localStorage.removeItem('culoca-session');
			}
			set(initialState);
		}
	};
}

// Helper function to save to localStorage
function saveToStorage(state: SessionState) {
	if (!browser) return;
	
	try {
		localStorage.setItem('culoca-session', JSON.stringify(state));
	} catch (e) {
		console.error('Failed to save session data:', e);
	}
}

// Create the store
export const sessionStore = createSessionStore();

// Derived stores
export const isAuthenticated = derived(sessionStore, $sessionStore => $sessionStore.isAuthenticated);
export const currentUserId = derived(sessionStore, $sessionStore => $sessionStore.userId);
export const customerBranding = derived(sessionStore, $sessionStore => $sessionStore.customerBranding);
export const activeUserFilter = derived(sessionStore, $sessionStore => $sessionStore.activeUserFilter);
export const isDuplicateDisplay = derived(sessionStore, $sessionStore => $sessionStore.isDuplicateDisplay);
export const sessionReady = writable(false);

// Check if customer branding should be shown
export const shouldShowCustomerBranding = derived(sessionStore, $sessionStore => {
	if (!$sessionStore.customerBranding) return false;
	
	// Always show customer branding if set
	return true;
}); 