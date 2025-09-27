import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from './$types';

// GET: Download-Statistiken für ein bestimmtes Item oder alle Items
export const GET: RequestHandler = async ({ params, request }) => {
  // Create Supabase client directly
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    return json({ error: 'Missing Supabase environment variables' }, { status: 500 });
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Get session from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return json({ error: 'Nicht angemeldet' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return json({ error: 'Nicht angemeldet' }, { status: 401 });
    }

    const userId = user.id;
    const itemId = params.itemId;
    
    console.log('🔍 GET download-stats for user:', userId, 'item:', itemId);
    
    // If specific item requested, check permissions
    if (itemId && itemId !== 'all') {
      const { data: item, error: itemError } = await supabase
        .from('items')
        .select('profile_id, title')
        .eq('id', itemId)
        .single();

      if (itemError || !item) {
        return json({ error: 'Item nicht gefunden' }, { status: 404 });
      }

      // Check if user is owner or has admin rights
      if (item.profile_id !== userId) {
        // Check if user has admin role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role_id')
          .eq('id', userId)
          .single();
        
        if (!profile || profile.role_id !== 3) { // 3 = admin role
          return json({ error: 'Keine Berechtigung für diese Statistiken' }, { status: 403 });
        }
      }
    } else {
      // For 'all' stats, check if user is admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role_id')
        .eq('id', userId)
        .single();
      
      if (!profile || profile.role_id !== 3) { // 3 = admin role
        return json({ error: 'Nur Administratoren können alle Statistiken einsehen' }, { status: 403 });
      }
    }
    
    // Get download statistics
    const { data: downloadStats, error } = await supabase
      .rpc('get_item_download_stats', {
        p_item_id: itemId === 'all' ? null : itemId
      });

    if (error) {
      console.error('Error fetching download stats:', error);
      return json({ error: 'Fehler beim Abrufen der Download-Statistiken', details: error.message }, { status: 500 });
    }
    
    // Get detailed download history with user information
    let downloadHistory: any[] = [];
    if (itemId && itemId !== 'all') {
      const { data: history, error: historyError } = await supabase
        .from('item_downloads')
        .select(`
          id,
          download_type,
          download_source,
          created_at,
          user_id,
          profiles!inner(full_name, accountname)
        `)
        .eq('item_id', itemId)
        .order('created_at', { ascending: false });
      
      if (historyError) {
        console.error('Error getting download history:', historyError);
      } else {
        downloadHistory = history || [];
      }
    } else {
      // For 'all' stats, get recent downloads across all items
      const { data: history, error: historyError } = await supabase
        .from('item_downloads')
        .select(`
          id,
          download_type,
          download_source,
          created_at,
          user_id,
          item_id,
          profiles!inner(full_name, accountname),
          items!inner(title, slug)
        `)
        .order('created_at', { ascending: false })
        .limit(100); // Limit to last 100 downloads
      
      if (historyError) {
        console.error('Error getting download history:', historyError);
      } else {
        downloadHistory = history || [];
      }
    }
    
    console.log('✅ Download stats fetched:', downloadStats?.length || 0, 'records');
    console.log('✅ Download history fetched:', downloadHistory?.length || 0, 'records');
    
    return json({ 
      downloadStats: downloadStats || [],
      downloadHistory: downloadHistory || [],
      itemId: itemId === 'all' ? null : itemId
    });
  } catch (error) {
    console.error('Error in GET /api/download-stats:', error);
    return json({ error: 'Server-Fehler' }, { status: 500 });
  }
};
