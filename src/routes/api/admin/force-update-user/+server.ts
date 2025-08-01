import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabaseAdmin.js';

export const POST = async ({ request }) => {
  try {
    if (!supabaseAdmin) {
      return json({ error: 'Admin operations not available - SUPABASE_SERVICE_ROLE_KEY missing' }, { status: 503 });
    }

    const { userId, updates } = await request.json();

    if (!userId) {
      return json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log(`🔄 Force updating user: ${userId}`, updates);

    const results = {};

    // Force update profile with admin privileges
    if (updates.profile) {
      console.log('🔄 Force updating profile...');
      
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from('profiles')
        .update(updates.profile)
        .eq('id', userId)
        .select()
        .single();
      
      if (profileError) {
        console.error('Error force updating profile:', profileError);
        results.profile = { error: profileError.message };
      } else {
        console.log('✅ Profile force updated successfully');
        results.profile = { success: true, data: profileData };
      }
    }

    // Force update auth user
    if (updates.auth) {
      console.log('🔄 Force updating auth user...');
      
      try {
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          updates.auth
        );
        
        if (authError) {
          console.error('Error force updating auth user:', authError);
          results.auth = { error: authError.message };
        } else {
          console.log('✅ Auth user force updated successfully');
          results.auth = { success: true, data: authData };
        }
      } catch (error) {
        console.error('Error force updating auth user:', error);
        results.auth = { error: error.message };
      }
    }

    // Force update user's items
    if (updates.items) {
      console.log('🔄 Force updating user items...');
      
      const { data: itemsData, error: itemsError } = await supabaseAdmin
        .from('items')
        .update(updates.items)
        .eq('profile_id', userId)
        .select();
      
      if (itemsError) {
        console.error('Error force updating items:', itemsError);
        results.items = { error: itemsError.message };
      } else {
        console.log('✅ Items force updated successfully');
        results.items = { success: true, count: itemsData?.length || 0 };
      }
    }

    // Refresh cache after updates
    console.log('🔄 Refreshing cache after updates...');
    
    // Force read to refresh cache
    const { data: refreshedProfile, error: refreshError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (refreshError) {
      console.error('Error refreshing cache:', refreshError);
      results.cache = { error: refreshError.message };
    } else {
      console.log('✅ Cache refreshed successfully');
      results.cache = { success: true, data: refreshedProfile };
    }

    console.log('🔄 Force update completed:', results);
    return json({ success: true, results });

  } catch (error) {
    console.error('Error in force-update-user API:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}; 