import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from './$types';

// GET: Alle Profilrechte des aktuellen Benutzers abrufen
export const GET: RequestHandler = async ({ request }) => {
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
    console.log('🔍 GET profile-rights for user:', userId);
    
    // Profilrechte des angemeldeten Benutzers abrufen
    const { data: profileRights, error } = await supabase
      .from('profile_rights')
      .select('*')
      .eq('profile_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching profile rights:', error);
      return json({ error: 'Fehler beim Abrufen der Profilrechte', details: error.message }, { status: 500 });
    }
    
    console.log('✅ Profile rights fetched:', profileRights?.length || 0, 'records');
    return json({ profileRights: profileRights || [] });
  } catch (error) {
    console.error('Error in GET /api/profile-rights:', error);
    return json({ error: 'Server-Fehler' }, { status: 500 });
  }
};

// POST: Neue Profilrechte erstellen oder aktualisieren
export const POST: RequestHandler = async ({ request }) => {
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
    const { targetUserId, rights } = await request.json();

    if (!targetUserId || !rights) {
      return json({ error: 'Fehlende Parameter' }, { status: 400 });
    }

    // Prüfen, ob der Zielbenutzer existiert
    const { data: targetUser, error: targetUserError } = await supabase
      .from('public_profiles')
      .select('id, full_name')
      .eq('id', targetUserId)
      .single();

    if (targetUserError || !targetUser) {
      return json({ error: 'Benutzer nicht gefunden' }, { status: 404 });
    }

    // Rechte erstellen oder aktualisieren (INSERT oder UPDATE)
    try {
      console.log('🔍 Attempting to save profile rights:', {
        profile_id: userId,
        target_user_id: targetUserId,
        rights: rights
      });
      
      // Erst prüfen, ob der Eintrag bereits existiert
      const { data: existingRight, error: checkError } = await supabase
        .from('profile_rights')
        .select('id')
        .eq('profile_id', userId)
        .eq('target_user_id', targetUserId)
        .single();

      let data, error;

      if (checkError && checkError.code === 'PGRST116') {
        // Eintrag existiert nicht - INSERT
        console.log('🔍 No existing right found, creating new one');
        const { data: insertData, error: insertError } = await supabase
          .from('profile_rights')
          .insert({
            profile_id: userId,
            target_user_id: targetUserId,
            rights: rights
          })
          .select()
          .single();
        
        data = insertData;
        error = insertError;
      } else if (checkError) {
        // Anderer Fehler beim Prüfen
        console.error('❌ Error checking existing rights:', checkError);
        error = checkError;
      } else {
        // Eintrag existiert - UPDATE
        console.log('🔍 Existing right found, updating');
        const { data: updateData, error: updateError } = await supabase
          .from('profile_rights')
          .update({
            rights: rights,
            updated_at: new Date().toISOString()
          })
          .eq('profile_id', userId)
          .eq('target_user_id', targetUserId)
          .select()
          .single();
        
        data = updateData;
        error = updateError;
      }

      if (error) {
        console.error('❌ Supabase error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        
        if (error.code === '42P01') { // relation does not exist
          return json({ error: 'Rechteverwaltung ist noch nicht verfügbar. Bitte führen Sie zuerst die Datenbank-Migration aus.' }, { status: 503 });
        } else if (error.code === '42501') { // RLS policy violation
          console.error('RLS policy violation:', error);
          return json({ error: 'Berechtigungsfehler. RLS-Policies müssen angepasst werden.' }, { status: 403 });
        } else {
          console.error('Error saving profile rights:', error);
          return json({ error: 'Fehler beim Speichern der Rechte', details: error.message }, { status: 500 });
        }
      }

      console.log('✅ Profile rights saved successfully:', data);
      return json({ 
        success: true, 
        profileRight: data,
        targetUser: targetUser
      });
    } catch (error) {
      console.error('❌ Exception in profile rights save:', error);
      return json({ error: 'Fehler beim Speichern der Rechte', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in POST /api/profile-rights:', error);
    return json({ error: 'Server-Fehler' }, { status: 500 });
  }
};

// DELETE: Profilrechte löschen
export const DELETE: RequestHandler = async ({ request }) => {
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
    const { targetUserId } = await request.json();

    if (!targetUserId) {
      return json({ error: 'Fehlende Parameter' }, { status: 400 });
    }

    // Profilrechte löschen
    try {
      const { error } = await supabase
        .from('profile_rights')
        .delete()
        .eq('profile_id', userId)
        .eq('target_user_id', targetUserId);

      if (error) {
        if (error.code === '42P01') { // relation does not exist
          return json({ error: 'Rechteverwaltung ist noch nicht verfügbar. Bitte führen Sie zuerst die Datenbank-Migration aus.' }, { status: 503 });
        } else {
          console.error('Error deleting profile rights:', error);
          return json({ error: 'Fehler beim Löschen der Rechte' }, { status: 500 });
        }
      }
    } catch (error) {
      console.error('Error in profile rights delete:', error);
      return json({ error: 'Fehler beim Löschen der Rechte' }, { status: 500 });
    }

    return json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/profile-rights:', error);
    return json({ error: 'Server-Fehler' }, { status: 500 });
  }
};
