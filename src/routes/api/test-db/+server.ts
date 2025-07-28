import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

export async function GET() {
  try {
    console.log('[Test DB] Starting database test...');

    // 1. Test basic connection
    const { data: connectionTest, error: connectionError } = await supabase
      .from('items')
      .select('count(*)', { count: 'exact', head: true });

    if (connectionError) {
      console.error('[Test DB] Connection error:', connectionError);
      return json({ error: 'Database connection failed', details: connectionError }, { status: 500 });
    }

    console.log('[Test DB] Connection successful');

    // 2. Test if function exists
    const { data: functionTest, error: functionError } = await supabase
      .rpc('gallery_items_normal_postgis', {
        user_lat: 0,
        user_lon: 0,
        page_value: 0,
        page_size_value: 1,
        current_user_id: null
      });

    if (functionError) {
      console.error('[Test DB] Function error:', functionError);
      return json({ 
        error: 'Function call failed', 
        details: functionError,
        connection: 'OK'
      }, { status: 500 });
    }

    console.log('[Test DB] Function call successful, returned:', functionTest?.length || 0, 'items');

    // 3. Check basic data
    const { data: itemsData, error: itemsError } = await supabase
      .from('items')
      .select('id, title, gallery, path_512, lat, lon, is_private')
      .not('path_512', 'is', null)
      .eq('gallery', true)
      .limit(5);

    if (itemsError) {
      console.error('[Test DB] Items query error:', itemsError);
    }

    return json({
      success: true,
      connection: 'OK',
      function: 'OK',
      functionResult: functionTest?.length || 0,
      basicItems: itemsData?.length || 0,
      sampleItems: itemsData || []
    });

  } catch (error) {
    console.error('[Test DB] Unexpected error:', error);
    return json({ error: 'Test failed', details: error }, { status: 500 });
  }
} 