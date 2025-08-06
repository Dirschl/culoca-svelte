// =====================================================
// PERMISSIONS SYSTEM - FRONTEND INTEGRATION
// =====================================================

import type { User } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';

// Permission types
export interface UserPermissions {
  view_gallery: boolean;
  view_items: boolean;
  view_maps: boolean;
  search: boolean;
  joystick: boolean;
  bulk_upload: boolean;
  settings: boolean;
  admin: boolean;
  delete_items: boolean;
  edit_items: boolean;
  create_items: boolean;
  manage_users?: boolean;
  view_analytics?: boolean;
  system_settings?: boolean;
  public_content?: boolean;
  gps_tracking?: boolean;
}

export interface UserRole {
  role_id: number;
  role_name: string;
  display_name: string;
  permissions: UserPermissions;
}

// Default permissions for anonymous users
export const ANONYMOUS_PERMISSIONS: UserPermissions = {
  view_gallery: true,
  view_items: true,
  view_maps: true,
  search: true,
  joystick: false,  // Deaktiviert für anonyme User
  bulk_upload: true,  // Aktiviert für anonyme User
  settings: false,  // Deaktiviert für anonyme User
  admin: false,
  delete_items: false,
  edit_items: false,
  create_items: false,
  public_content: false,
  gps_tracking: false  // Deaktiviert für anonyme User
};

// Permission checking functions
export async function hasPermission(user: User | null, permission: keyof UserPermissions): Promise<boolean> {
  if (!user) {
    // Anonymous user - check against default permissions
    return ANONYMOUS_PERMISSIONS[permission] || false;
  }

  try {
    const { data, error } = await supabase.rpc('has_permission', {
      user_id: user.id,
      permission_name: permission
    });

    if (error) {
      console.error('Permission check error:', error);
      return false;
    }

    return data || false;
  } catch (error) {
    console.error('Permission check failed:', error);
    return false;
  }
}

export async function getUserPermissions(user: User | null): Promise<UserPermissions> {
  if (!user) {
    return ANONYMOUS_PERMISSIONS;
  }

  try {
    const { data, error } = await supabase.rpc('get_user_permissions', {
      user_id: user.id
    });

    if (error) {
      console.error('Get permissions error:', error);
      return ANONYMOUS_PERMISSIONS;
    }

    return data || ANONYMOUS_PERMISSIONS;
  } catch (error) {
    console.error('Get permissions failed:', error);
    return ANONYMOUS_PERMISSIONS;
  }
}

export async function getUserRole(user: User | null): Promise<UserRole | null> {
  if (!user) {
    return null;
  }

  try {
    const { data, error } = await supabase.rpc('get_user_role_info', {
      user_id: user.id
    });

    if (error) {
      console.error('Get role info error:', error);
      return null;
    }

    return data?.[0] || null;
  } catch (error) {
    console.error('Get role info failed:', error);
    return null;
  }
}

// Convenience functions for common permission checks
export async function canAccessAdmin(user: User | null): Promise<boolean> {
  return hasPermission(user, 'admin');
}

export async function canUseJoystick(user: User | null): Promise<boolean> {
  return hasPermission(user, 'joystick');
}

export async function canBulkUpload(user: User | null): Promise<boolean> {
  return hasPermission(user, 'bulk_upload');
}

export async function canEditItems(user: User | null): Promise<boolean> {
  return hasPermission(user, 'edit_items');
}

export async function canDeleteItems(user: User | null): Promise<boolean> {
  return hasPermission(user, 'delete_items');
}

export async function canManageUsers(user: User | null): Promise<boolean> {
  return hasPermission(user, 'manage_users');
}

export async function canViewAnalytics(user: User | null): Promise<boolean> {
  return hasPermission(user, 'view_analytics');
}

// Permission store for reactive UI updates
import { writable } from 'svelte/store';

export const userPermissions = writable<UserPermissions>(ANONYMOUS_PERMISSIONS);
export const userRole = writable<UserRole | null>(null);

// Function to update permission stores
export async function updatePermissionStores(user: User | null) {
  const permissions = await getUserPermissions(user);
  const role = await getUserRole(user);
  
  userPermissions.set(permissions);
  userRole.set(role);
}

// Permission guard for components
export function createPermissionGuard(permission: keyof UserPermissions) {
  return async (user: User | null) => {
    return await hasPermission(user, permission);
  };
}

// =====================================================
// USAGE EXAMPLES:
// =====================================================

// In a Svelte component:
/*
<script>
  import { user } from '$lib/auth';
  import { canAccessAdmin, canUseJoystick } from '$lib/auth/permissions';
  import { userPermissions } from '$lib/auth/permissions';
  
  // Reactive permission checking
  $: canAccessAdminPanel = $userPermissions.admin;
  $: canUseJoystickFeature = $userPermissions.joystick;
  
  // Or async checking
  async function checkPermissions() {
    const canAdmin = await canAccessAdmin($user);
    const canJoystick = await canUseJoystick($user);
  }
</script>

{#if $userPermissions.admin}
  <a href="/admin">Admin Panel</a>
{/if}

{#if $userPermissions.joystick}
  <a href="/simulation">Simulation</a>
{/if}
*/ 