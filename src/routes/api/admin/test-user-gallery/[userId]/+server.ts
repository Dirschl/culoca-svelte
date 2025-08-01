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

    console.log(`🔍 Testing gallery for user: ${userId}`);

    // Test the gallery function with admin privileges
    const { data: items, error } = await supabaseAdmin
      .rpc('gallery_items_normal_postgis', {
        user_lat: 48.31937935887211,
        user_lon: 12.718426347450462,
        page_value: 0,
        page_size_value: 50,
        current_user_id: userId
      });

    if (error) {
      console.error('Error calling gallery function:', error);
      return json({ error: `Failed to call gallery function: ${error.message}` }, { status: 500 });
    }

    console.log(`✅ Gallery function returned ${items?.length || 0} items for user ${userId}`);

    return json({ 
      success: true, 
      userId,
      items: items || [],
      count: items?.length || 0,
      sampleItems: items?.slice(0, 3) || []
    });

  } catch (error) {
    console.error('Error in test-user-gallery API:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}; 