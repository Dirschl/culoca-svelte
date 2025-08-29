import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from './$types';

// GET: Alle Item-Rechte für ein bestimmtes Item abrufen
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
    
    console.log('🔍 GET item-rights for user:', userId, 'item:', itemId);
    
    // Prüfen, ob der Benutzer der Ersteller des Items ist
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('user_id, title')
      .eq('id', itemId)
      .single();

    if (itemError) {
      console.error('Error fetching item:', itemError);
      if (itemError.code === 'PGRST116') { // No rows returned
        return json({ error: 'Item nicht gefunden' }, { status: 404 });
      }
      return json({ error: 'Datenbankfehler beim Abrufen des Items' }, { status: 500 });
    }

    if (!item) {
      return json({ error: 'Item nicht gefunden' }, { status: 404 });
    }

    console.log('🔍 Item found:', { itemId, itemUserId: item.user_id, currentUserId: userId });

    if (item.user_id !== userId) {
      return json({ error: 'Keine Berechtigung für dieses Item' }, { status: 403 });
    }

    // Item-Rechte des angemeldeten Benutzers abrufen
    const { data: itemRights, error } = await supabase
      .from('item_rights')
      .select(`
        id,
        target_user_id,
        rights,
        created_at,
        updated_at
      `)
      .eq('item_id', itemId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching item rights:', error);
      if (error.code === '42P01') { // relation does not exist
        return json({ error: 'Rechteverwaltung ist noch nicht verfügbar. Bitte führen Sie zuerst die Datenbank-Migration aus.' }, { status: 503 });
      }
      return json({ error: 'Fehler beim Abrufen der Item-Rechte', details: error.message }, { status: 500 });
    }
    
    console.log('✅ Item rights fetched:', itemRights?.length || 0, 'records');
    return json({ itemRights: itemRights || [] });
  } catch (error) {
    console.error('Error in GET /api/item-rights:', error);
    return json({ error: 'Server-Fehler' }, { status: 500 });
  }
};

// POST: Neue Item-Rechte erstellen oder aktualisieren
export const POST: RequestHandler = async ({ params, request }) => {
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
    const { targetUserId, rights } = await request.json();

    if (!targetUserId || !rights) {
      return json({ error: 'Fehlende Parameter' }, { status: 400 });
    }

    // Prüfen, ob der Benutzer der Ersteller des Items ist
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('user_id, title')
      .eq('id', itemId)
      .single();

    if (itemError) {
      console.error('Error fetching item:', itemError);
      if (itemError.code === 'PGRST116') { // No rows returned
        return json({ error: 'Item nicht gefunden' }, { status: 404 });
      }
      return json({ error: 'Datenbankfehler beim Abrufen des Items' }, { status: 500 });
    }

    if (!item) {
      return json({ error: 'Item nicht gefunden' }, { status: 404 });
    }

    if (item.user_id !== userId) {
      return json({ error: 'Keine Berechtigung für dieses Item' }, { status: 403 });
    }

    // Prüfen, ob der Zielbenutzer existiert
    const { data: targetUser, error: targetUserError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id', targetUserId)
      .single();

    if (targetUserError || !targetUser) {
      return json({ error: 'Benutzer nicht gefunden' }, { status: 404 });
    }

    // Rechte erstellen oder aktualisieren (UPSERT)
    try {
      const { data, error } = await supabase
        .from('item_rights')
        .upsert({
          item_id: itemId,
          target_user_id: targetUserId,
          rights: rights
        })
        .select()
        .single();

      if (error) {
        if (error.code === '42P01') { // relation does not exist
          return json({ error: 'Rechteverwaltung ist noch nicht verfügbar. Bitte führen Sie zuerst die Datenbank-Migration aus.' }, { status: 503 });
        } else if (error.code === '42501') { // RLS policy violation
          console.error('RLS policy violation:', error);
          return json({ error: 'Berechtigungsfehler. RLS-Policies müssen angepasst werden.' }, { status: 403 });
        } else {
          console.error('Error upserting item rights:', error);
          return json({ error: 'Fehler beim Speichern der Rechte' }, { status: 500 });
        }
      }

      return json({ 
        success: true, 
        itemRight: data,
        targetUser: targetUser
      });
    } catch (error) {
      console.error('Error in item rights upsert:', error);
      return json({ error: 'Fehler beim Speichern der Rechte' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in POST /api/item-rights:', error);
    return json({ error: 'Server-Fehler' }, { status: 500 });
  }
};

// DELETE: Item-Rechte löschen
export const DELETE: RequestHandler = async ({ params, request }) => {
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
    const { targetUserId } = await request.json();

    if (!targetUserId) {
      return json({ error: 'Fehlende Parameter' }, { status: 400 });
    }

    // Prüfen, ob der Benutzer der Ersteller des Items ist
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('user_id')
      .eq('id', itemId)
      .single();

    if (itemError || !item) {
      return json({ error: 'Item nicht gefunden' }, { status: 404 });
    }

    if (item.user_id !== userId) {
      return json({ error: 'Keine Berechtigung für dieses Item' }, { status: 403 });
    }

    // Item-Rechte löschen
    try {
      const { error } = await supabase
        .from('item_rights')
        .delete()
        .eq('item_id', itemId)
        .eq('target_user_id', targetUserId);

      if (error) {
        if (error.code === '42P01') { // relation does not exist
          return json({ error: 'Rechteverwaltung ist noch nicht verfügbar. Bitte führen Sie zuerst die Datenbank-Migration aus.' }, { status: 503 });
        } else {
          console.error('Error deleting item rights:', error);
          return json({ error: 'Fehler beim Löschen der Rechte' }, { status: 500 });
        }
      }
    } catch (error) {
      console.error('Error in item rights delete:', error);
      return json({ error: 'Fehler beim Löschen der Rechte' }, { status: 500 });
    }

    return json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/item-rights:', error);
    return json({ error: 'Server-Fehler' }, { status: 500 });
  }
};
