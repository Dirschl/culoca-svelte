import { writable, type Writable } from 'svelte/store';
import { authFetch } from './authFetch';

export interface UnifiedRights {
  download: boolean;
  download_original: boolean;
  edit: boolean;
  delete: boolean;
}

export interface RoleInfo {
  role_id: number;
  role_name: string;
  permissions: any;
}

export interface RightsState {
  rights: UnifiedRights | null;
  roleInfo: RoleInfo | null;
  isOwner: boolean;
  loading: boolean;
  error: string | null;
}

function createUnifiedRightsStore() {
  const { subscribe, set, update }: Writable<RightsState> = writable({
    rights: null,
    roleInfo: null,
    isOwner: false,
    loading: false,
    error: null
  });

  return {
    subscribe,
    reset: () => set({
      rights: null,
      roleInfo: null,
      isOwner: false,
      loading: false,
      error: null
    }),
    loadRights: async (itemId: string) => {
      console.log('🔍 [UnifiedRightsStore] Loading rights for item:', itemId);
      
      update(state => ({ ...state, loading: true, error: null }));
      
      try {
        const response = await authFetch(`/api/unified-rights/${itemId}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('🔍 [UnifiedRightsStore] API response:', data);
        
        const rights: UnifiedRights = {
          download: data.rights?.download || false,
          download_original: data.rights?.download_original || false,
          edit: data.rights?.edit || false,
          delete: data.rights?.delete || false
        };
        
        const roleInfo: RoleInfo = {
          role_id: data.roleInfo?.role_id || 0,
          role_name: data.roleInfo?.role_name || 'unknown',
          permissions: data.roleInfo?.permissions || {}
        };
        
        console.log('🔍 [UnifiedRightsStore] Parsed rights:', rights);
        console.log('🔍 [UnifiedRightsStore] Role info:', roleInfo);
        console.log('🔍 [UnifiedRightsStore] Is owner:', data.isOwner);
        
        set({
          rights,
          roleInfo,
          isOwner: data.isOwner || false,
          loading: false,
          error: null
        });
        
        console.log('🔍 [UnifiedRightsStore] Store updated successfully');
        
      } catch (error) {
        console.error('❌ [UnifiedRightsStore] Error loading rights:', error);
        set({
          rights: null,
          roleInfo: null,
          isOwner: false,
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  };
}

export const unifiedRightsStore = createUnifiedRightsStore();
