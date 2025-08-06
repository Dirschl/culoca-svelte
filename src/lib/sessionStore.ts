import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { supabase } from './supabaseClient';
import type { UserPermissions } from './auth/permissions';
import { ANONYMOUS_PERMISSIONS } from './auth/permissions';

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
	isAnonymous: boolean; // New field for anonymous users
	customerBranding: CustomerBranding | null;
	activeUserFilter: ActiveUserFilter | null;
	isDuplicateDisplay: boolean;
	homeBase?: { lat: number, lon: number } | null;
	permissions: UserPermissions | null;
	permissionsLoaded: boolean;
}

function createSessionStore() {
	const initialState: SessionState = {
		userId: null,
		isAuthenticated: false,
		isAnonymous: true, // Default to anonymous
		customerBranding: null,
		activeUserFilter: null,
		isDuplicateDisplay: false,
		permissions: null,
		permissionsLoaded: false
	};

	const { subscribe, set, update } = writable<SessionState>(initialState);

	return {
		subscribe,
		
		// Get current state
		get: () => {
			let currentState: SessionState;
			subscribe(state => {
				currentState = state;
			})();
			return currentState!;
		},
		
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
				const newState = { 
					...state, 
					userId, 
					isAuthenticated,
					isAnonymous: !isAuthenticated, // Set anonymous based on authentication
					// Automatically set anonymous permissions for non-authenticated users
					permissions: isAuthenticated ? state.permissions : ANONYMOUS_PERMISSIONS,
					permissionsLoaded: isAuthenticated ? state.permissionsLoaded : true
				};
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

		// Set anonymous mode
		setAnonymous: (isAnonymous: boolean) => {
			update(state => {
				const newState = { 
					...state, 
					isAnonymous,
					isAuthenticated: !isAnonymous,
					userId: isAnonymous ? null : state.userId
				};
				saveToStorage(newState);
				return newState;
			});
		},

		// Set home base
		setHomeBase: (lat: number, lon: number) => {
			update(state => {
				const newState = { ...state, homeBase: { lat, lon } };
				saveToStorage(newState);
				return newState;
			});
		},

		// Load user permissions
		loadPermissions: async (userId: string | null) => {
			try {
				// If no userId, set anonymous permissions
				if (!userId) {
					update(state => ({
						...state,
						permissions: ANONYMOUS_PERMISSIONS,
						permissionsLoaded: true
					}));
					console.log('✅ Anonymous permissions loaded');
					console.log('📋 Anonymous permissions:', {
						view_gallery: ANONYMOUS_PERMISSIONS.view_gallery,
						view_items: ANONYMOUS_PERMISSIONS.view_items,
						view_maps: ANONYMOUS_PERMISSIONS.view_maps,
						search: ANONYMOUS_PERMISSIONS.search,
						joystick: ANONYMOUS_PERMISSIONS.joystick,
						bulk_upload: ANONYMOUS_PERMISSIONS.bulk_upload,
						settings: ANONYMOUS_PERMISSIONS.settings,
						admin: ANONYMOUS_PERMISSIONS.admin,
						delete_items: ANONYMOUS_PERMISSIONS.delete_items,
						edit_items: ANONYMOUS_PERMISSIONS.edit_items,
						create_items: ANONYMOUS_PERMISSIONS.create_items,
						public_content: ANONYMOUS_PERMISSIONS.public_content
					});
					return;
				}
				
				// First, check user's role in profiles table
				const { data: profile, error: profileError } = await supabase
					.from('profiles')
					.select('role_id')
					.eq('id', userId)
					.single();
				
				if (profileError) {
					console.error('Failed to get user profile:', profileError);
					// Fallback to anonymous permissions
					update(state => ({
						...state,
						permissions: ANONYMOUS_PERMISSIONS,
						permissionsLoaded: true
					}));
					return;
				}
				
				console.log('🔍 User role_id:', profile.role_id);
				
				// Ensure user has a valid role (default to user role = 2 if null)
				let roleId = profile.role_id;
				if (!roleId || roleId === 1) {
					console.log('🔄 User has no role or anonymous role, setting to user role (2)');
					
					const { error: updateError } = await supabase
						.from('profiles')
						.update({ role_id: 2 })
						.eq('id', userId);
					
					if (updateError) {
						console.error('Failed to update user role:', updateError);
					} else {
						console.log('✅ User role updated to 2 (user)');
						roleId = 2;
					}
				}
				
				// Load permissions based on role
				const { data: permissions, error } = await supabase.rpc('get_user_permissions', {
					user_id: userId
				});
				
				if (error) {
					console.error('Failed to load permissions:', error);
					// Fallback to anonymous permissions
					update(state => ({
						...state,
						permissions: ANONYMOUS_PERMISSIONS,
						permissionsLoaded: true
					}));
					console.log('⚠️ Fallback to anonymous permissions due to RPC error');
					console.log('📋 Anonymous permissions (fallback):', {
						view_gallery: ANONYMOUS_PERMISSIONS.view_gallery,
						view_items: ANONYMOUS_PERMISSIONS.view_items,
						view_maps: ANONYMOUS_PERMISSIONS.view_maps,
						search: ANONYMOUS_PERMISSIONS.search,
						joystick: ANONYMOUS_PERMISSIONS.joystick,
						bulk_upload: ANONYMOUS_PERMISSIONS.bulk_upload,
						settings: ANONYMOUS_PERMISSIONS.settings,
						admin: ANONYMOUS_PERMISSIONS.admin,
						delete_items: ANONYMOUS_PERMISSIONS.delete_items,
						edit_items: ANONYMOUS_PERMISSIONS.edit_items,
						create_items: ANONYMOUS_PERMISSIONS.create_items,
						public_content: ANONYMOUS_PERMISSIONS.public_content
					});
					return;
				}
				
				update(state => ({
					...state,
					permissions,
					permissionsLoaded: true
				}));
				
				console.log('✅ Permissions loaded for user:', userId, 'role:', roleId);
				console.log('📋 Detailed permissions:', {
					view_gallery: permissions.view_gallery,
					view_items: permissions.view_items,
					view_maps: permissions.view_maps,
					search: permissions.search,
					joystick: permissions.joystick,
					bulk_upload: permissions.bulk_upload,
					settings: permissions.settings,
					admin: permissions.admin,
					delete_items: permissions.delete_items,
					edit_items: permissions.edit_items,
					create_items: permissions.create_items,
					manage_users: permissions.manage_users,
					view_analytics: permissions.view_analytics,
					system_settings: permissions.system_settings,
					public_content: permissions.public_content
				});
			} catch (error) {
				console.error('Error loading permissions:', error);
				// Fallback to anonymous permissions
				update(state => ({
					...state,
					permissions: ANONYMOUS_PERMISSIONS,
					permissionsLoaded: true
				}));
				console.log('⚠️ Fallback to anonymous permissions due to exception');
				console.log('📋 Anonymous permissions (fallback):', {
					view_gallery: ANONYMOUS_PERMISSIONS.view_gallery,
					view_items: ANONYMOUS_PERMISSIONS.view_items,
					view_maps: ANONYMOUS_PERMISSIONS.view_maps,
					search: ANONYMOUS_PERMISSIONS.search,
					joystick: ANONYMOUS_PERMISSIONS.joystick,
					bulk_upload: ANONYMOUS_PERMISSIONS.bulk_upload,
					settings: ANONYMOUS_PERMISSIONS.settings,
					admin: ANONYMOUS_PERMISSIONS.admin,
					delete_items: ANONYMOUS_PERMISSIONS.delete_items,
					edit_items: ANONYMOUS_PERMISSIONS.edit_items,
					create_items: ANONYMOUS_PERMISSIONS.create_items,
					public_content: ANONYMOUS_PERMISSIONS.public_content
				});
			}
		},

		// Check specific permission
		hasPermission: (permission: keyof UserPermissions): boolean => {
			let currentState: SessionState;
			subscribe(state => {
				currentState = state;
			})();
			
			if (!currentState!.permissionsLoaded || !currentState!.permissions) {
				return false;
			}
			
			return currentState!.permissions[permission] || false;
		},

		// Set anonymous permissions explicitly
		setAnonymousPermissions: () => {
			update(state => ({
				...state,
				permissions: ANONYMOUS_PERMISSIONS,
				permissionsLoaded: true
			}));
			console.log('✅ Anonymous permissions set explicitly');
			console.log('📋 Anonymous permissions:', {
				view_gallery: ANONYMOUS_PERMISSIONS.view_gallery,
				view_items: ANONYMOUS_PERMISSIONS.view_items,
				view_maps: ANONYMOUS_PERMISSIONS.view_maps,
				search: ANONYMOUS_PERMISSIONS.search,
				joystick: ANONYMOUS_PERMISSIONS.joystick,
				bulk_upload: ANONYMOUS_PERMISSIONS.bulk_upload,
				settings: ANONYMOUS_PERMISSIONS.settings,
				admin: ANONYMOUS_PERMISSIONS.admin,
				delete_items: ANONYMOUS_PERMISSIONS.delete_items,
				edit_items: ANONYMOUS_PERMISSIONS.edit_items,
				create_items: ANONYMOUS_PERMISSIONS.create_items,
				public_content: ANONYMOUS_PERMISSIONS.public_content
			});
		},

		// Set user role and reload permissions
		setUserRole: async (userId: string, roleId: number) => {
			try {
				const { error } = await supabase
					.from('profiles')
					.update({ role_id: roleId })
					.eq('id', userId);
				
				if (error) {
					console.error('Failed to update user role:', error);
					return false;
				}
				
				console.log('✅ User role updated to:', roleId);
				
				// Reload permissions with new role
				await loadPermissions(userId);
				
				return true;
			} catch (error) {
				console.error('Error setting user role:', error);
				return false;
			}
		},

		// Get user role
		getUserRole: async (userId: string) => {
			try {
				const { data: profile, error } = await supabase
					.from('profiles')
					.select('role_id')
					.eq('id', userId)
					.single();
				
				if (error) {
					console.error('Failed to get user role:', error);
					return null;
				}
				
				return profile.role_id;
			} catch (error) {
				console.error('Error getting user role:', error);
				return null;
			}
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
export const isAnonymous = derived(sessionStore, $sessionStore => $sessionStore.isAnonymous);
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

// Permission derived stores
export const userPermissions = derived(sessionStore, $sessionStore => $sessionStore.permissions);
export const permissionsLoaded = derived(sessionStore, $sessionStore => $sessionStore.permissionsLoaded);

// Specific permission checks
export const hasPublicContentPermission = derived(sessionStore, $sessionStore => 
	$sessionStore.permissions?.public_content || false
);

export const hasAdminPermission = derived(sessionStore, $sessionStore => 
	$sessionStore.permissions?.admin || false
);

export const hasJoystickPermission = derived(sessionStore, $sessionStore => 
	$sessionStore.permissions?.joystick || false
);

export const hasBulkUploadPermission = derived(sessionStore, $sessionStore => 
	$sessionStore.permissions?.bulk_upload || false
);

export const hasSettingsPermission = derived(sessionStore, $sessionStore => 
	$sessionStore.permissions?.settings || false
);

export const hasEditItemsPermission = derived(sessionStore, $sessionStore => 
	$sessionStore.permissions?.edit_items || false
);

export const hasDeleteItemsPermission = derived(sessionStore, $sessionStore => 
	$sessionStore.permissions?.delete_items || false
);

export const hasCreateItemsPermission = derived(sessionStore, $sessionStore => 
	$sessionStore.permissions?.create_items || false
);

export const hasManageUsersPermission = derived(sessionStore, $sessionStore => 
	$sessionStore.permissions?.manage_users || false
);

export const hasViewAnalyticsPermission = derived(sessionStore, $sessionStore => 
	$sessionStore.permissions?.view_analytics || false
);

export const hasViewMapsPermission = derived(sessionStore, $sessionStore => 
	$sessionStore.permissions?.view_maps || false
);

export const hasGpsTrackingPermission = derived(sessionStore, $sessionStore => 
	$sessionStore.permissions?.gps_tracking || false
);

export const hasSystemSettingsPermission = derived(sessionStore, $sessionStore => 
	$sessionStore.permissions?.system_settings || false
); 