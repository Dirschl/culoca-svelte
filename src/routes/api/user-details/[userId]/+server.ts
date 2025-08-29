import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from './$types';

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

    const targetUserId = params.userId;
    
    if (!targetUserId) {
      return json({ error: 'Benutzer-ID fehlt' }, { status: 400 });
    }

    // Benutzerdetails abrufen
    const { data: userDetails, error } = await supabase
      .from('public_profiles')
      .select('id, full_name, email')
      .eq('id', targetUserId)
      .single();

    if (error) {
      console.error('Error fetching user details:', error);
      return json({ error: 'Benutzer nicht gefunden' }, { status: 404 });
    }

    return json({ user: userDetails });
    
  } catch (error) {
    console.error('Error in GET /api/user-details:', error);
    return json({ error: 'Server-Fehler' }, { status: 500 });
  }
};
