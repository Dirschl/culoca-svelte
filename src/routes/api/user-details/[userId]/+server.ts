import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/supabaseAdmin.js';

export const GET: RequestHandler = async ({ params, request }) => {
  try {
    // Get session from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return json({ error: 'Nicht angemeldet' }, { status: 401 });
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return json({ error: 'Missing Supabase environment variables' }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

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

    let resolvedEmail = userDetails.email || '';

    // Many profiles do not persist the auth email into public_profiles.
    // Fall back to the auth user record when admin access is available.
    if (!resolvedEmail && supabaseAdmin) {
      const { data: authUserData, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
      if (authUserError) {
        console.error('Error fetching auth user email:', authUserError);
      } else {
        resolvedEmail = authUserData.user?.email || '';
      }
    }

    return json({ user: { ...userDetails, email: resolvedEmail } });
    
  } catch (error) {
    console.error('Error in GET /api/user-details:', error);
    return json({ error: 'Server-Fehler' }, { status: 500 });
  }
};
