import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabaseAdmin.js';

export const GET = async ({ params }) => {
  try {
    if (!supabaseAdmin) {
      return json({ error: 'Admin operations not available - SUPABASE_SERVICE_ROLE_KEY missing' }, { status: 503 });
    }

    const { userId } = params;

    if (!userId) {
      return json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log(`🔍 Getting all items for user: ${userId}`);

    // Get all items for this user with admin privileges (bypassing RLS)
    const { data: items, error } = await supabaseAdmin
      .from('items')
      .select('*')
      .eq('profile_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getting user items:', error);
      return json({ error: `Failed to get user items: ${error.message}` }, { status: 500 });
    }

    console.log(`✅ Found ${items?.length || 0} items for user ${userId}`);

    return json({ 
      success: true, 
      userId,
      items: items || [],
      count: items?.length || 0
    });

  } catch (error) {
    console.error('Error in user-items API:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}; 