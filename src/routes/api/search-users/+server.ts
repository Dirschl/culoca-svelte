import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from './$types';

// GET: Benutzer nach Name oder E-Mail suchen
export const GET: RequestHandler = async ({ url, request }) => {
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

    const currentUserId = user.id;
    const query = url.searchParams.get('q');
    
    console.log('🔍 GET search-users for user:', currentUserId, 'query:', query);
    
    if (!query || query.length < 2) {
      return json({ users: [] });
    }

    // Benutzer suchen
    try {
      // Benutzer suchen (außer sich selbst) - verwende public_profiles View
      const { data: users, error } = await supabase
        .from('public_profiles')
        .select('id, full_name, email')
        .ilike('full_name', `%${query}%`)
        .neq('id', currentUserId)
        .limit(10);

      if (error) {
        console.error('Error searching users:', error);
        console.error('Error details:', { code: error.code, message: error.message, details: error.details });
        // Bei RLS-Fehlern geben wir ein leeres Array zurück
        if (error.code === '42501' || error.message?.includes('permission')) {
          console.log('Permission issue with profiles table, returning empty array');
          return json({ users: [], error: 'Permission denied' });
        } else {
          return json({ error: 'Fehler bei der Benutzersuche', details: error.message }, { status: 500 });
        }
      }

      console.log('Search results:', users?.length || 0, 'users found');
      return json({ users: users || [] });
    } catch (error) {
      console.error('Error in user search:', error);
      return json({ users: [] });
    }

    return json({ users: users || [] });
  } catch (error) {
    console.error('Error in GET /api/search-users:', error);
    return json({ error: 'Server-Fehler' }, { status: 500 });
  }
};
