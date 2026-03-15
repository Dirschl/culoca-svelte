import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabaseAdmin.js';

type RefreshResultEntry = {
  success?: boolean;
  count?: number;
  data?: unknown;
  error?: string;
};

export const POST = async ({ request }) => {
  try {
    if (!supabaseAdmin) {
      return json({ error: 'Admin operations not available - SUPABASE_SERVICE_ROLE_KEY missing' }, { status: 503 });
    }

    const { table, userId } = await request.json();

    console.log(`🔄 Refreshing cache for table: ${table}, userId: ${userId || 'all'}`);

    let results: Record<string, RefreshResultEntry> = {};

    // Refresh profiles table
    if (!table || table === 'profiles') {
      console.log('🔄 Refreshing profiles table...');
      
      // Force a read with admin privileges to refresh cache
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .limit(1);
      
      if (profilesError) {
        console.error('Error refreshing profiles:', profilesError);
        results.profiles = { error: profilesError.message };
      } else {
        console.log('✅ Profiles cache refreshed');
        results.profiles = { success: true, count: profiles?.length || 0 };
      }
    }

    // Refresh items table
    if (!table || table === 'items') {
      console.log('🔄 Refreshing items table...');
      
      // Force a read with admin privileges to refresh cache
      const { data: items, error: itemsError } = await supabaseAdmin
        .from('items')
        .select('*')
        .limit(1);
      
      if (itemsError) {
        console.error('Error refreshing items:', itemsError);
        results.items = { error: itemsError.message };
      } else {
        console.log('✅ Items cache refreshed');
        results.items = { success: true, count: items?.length || 0 };
      }
    }

    // Refresh auth users
    if (!table || table === 'auth') {
      console.log('🔄 Refreshing auth users...');
      
      try {
        const { data: users, error: authError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (authError) {
          console.error('Error refreshing auth users:', authError);
          results.auth = { error: authError.message };
        } else {
          console.log('✅ Auth users cache refreshed');
          results.auth = { success: true, count: users?.users?.length || 0 };
        }
      } catch (error: unknown) {
        console.error('Error refreshing auth users:', error);
        results.auth = { error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }

    // If specific user ID provided, refresh that user's data
    if (userId) {
      console.log(`🔄 Refreshing specific user: ${userId}`);
      
      // Refresh user profile
      const { data: userProfile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (profileError) {
        console.error('Error refreshing user profile:', profileError);
        results.userProfile = { error: profileError.message };
      } else {
        console.log('✅ User profile refreshed');
        results.userProfile = { success: true, data: userProfile };
      }

      // Refresh user's items
      const { data: userItems, error: itemsError } = await supabaseAdmin
        .from('items')
        .select('*')
        .eq('profile_id', userId);
      
      if (itemsError) {
        console.error('Error refreshing user items:', itemsError);
        results.userItems = { error: itemsError.message };
      } else {
        console.log('✅ User items refreshed');
        results.userItems = { success: true, count: userItems?.length || 0 };
      }
    }

    console.log('🔄 Cache refresh completed:', results);
    return json({ success: true, results });

  } catch (error: unknown) {
    console.error('Error in refresh-cache API:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
