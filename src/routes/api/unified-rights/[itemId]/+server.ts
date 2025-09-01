import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

export async function GET({ params, request }) {
  console.log('🔍 [UnifiedRights API] GET request for item:', params.itemId);
  
  try {
    // Extract authorization header
    const authHeader = request.headers.get('authorization');
    console.log('🔍 [UnifiedRights API] Auth header present:', !!authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ [UnifiedRights API] No valid authorization header');
      return json({ error: 'Nicht angemeldet' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    console.log('🔍 [UnifiedRights API] Token extracted, length:', token.length);

    // Create Supabase client
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('❌ [UnifiedRights API] Missing environment variables');
      return json({ error: 'Server-Konfigurationsfehler' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    // Get user session
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.log('❌ [UnifiedRights API] User authentication failed:', userError?.message);
      return json({ error: 'Nicht angemeldet' }, { status: 401 });
    }

    console.log('🔍 [UnifiedRights API] User authenticated:', user.id);

    // Check if item exists
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('id, user_id')
      .eq('id', params.itemId)
      .single();

    if (itemError || !item) {
      console.log('❌ [UnifiedRights API] Item not found:', itemError?.message);
      return json({ error: 'Item nicht gefunden' }, { status: 404 });
    }

    console.log('🔍 [UnifiedRights API] Item found:', item.id, 'Owner:', item.user_id);

    // Call the unified rights function
    console.log('🔍 [UnifiedRights API] Calling get_unified_item_rights function...');
    const { data: unifiedRights, error: rightsError } = await supabase
      .rpc('get_unified_item_rights', {
        p_item_id: params.itemId,
        p_user_id: user.id
      });

    if (rightsError) {
      console.log('❌ [UnifiedRights API] Function error:', rightsError.message);
      return json({ error: 'Fehler beim Laden der Rechte' }, { status: 500 });
    }

    console.log('🔍 [UnifiedRights API] Function result:', unifiedRights);

    // Get user role info
    console.log('🔍 [UnifiedRights API] Getting user role info...');
    const { data: roleInfoArray, error: roleError } = await supabase
      .rpc('get_user_role_info', {
        user_id: user.id
      });

    if (roleError) {
      console.log('❌ [UnifiedRights API] Role info error:', roleError.message);
      // Continue without role info
    }

    console.log('🔍 [UnifiedRights API] Role info array:', roleInfoArray);
    
    // Extract the first element from the array
    const roleInfo = roleInfoArray && roleInfoArray.length > 0 ? roleInfoArray[0] : null;
    console.log('🔍 [UnifiedRights API] Extracted role info:', roleInfo);

    // Check if user is owner
    const isOwner = item.user_id === user.id;
    console.log('🔍 [UnifiedRights API] Is owner:', isOwner);

    const response = {
      rights: unifiedRights,
      roleInfo: roleInfo,
      isOwner
    };

    console.log('🔍 [UnifiedRights API] Final response:', response);
    return json(response);

  } catch (error) {
    console.error('❌ [UnifiedRights API] Unexpected error:', error);
    return json({ error: 'Interner Server-Fehler' }, { status: 500 });
  }
}
