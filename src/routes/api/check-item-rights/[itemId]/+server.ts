import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import type { RequestHandler } from './$types';

// GET: Rechte für ein spezifisches Item prüfen
export const GET: RequestHandler = async ({ params, url, locals }) => {
  try {
    const session = await locals.getSession();
    if (!session) {
      return json({ error: 'Nicht angemeldet' }, { status: 401 });
    }

    const itemId = params.itemId;
    const userId = session.user.id;
    const rightType = url.searchParams.get('type') || 'download'; // 'download', 'edit', 'delete'

    if (!itemId) {
      return json({ error: 'Item-ID erforderlich' }, { status: 400 });
    }

    // Prüfe Rechte mit der Datenbank-Funktion
    const { data, error } = await supabase.rpc('check_item_rights', {
      p_item_id: itemId,
      p_user_id: userId,
      p_right_type: rightType
    });

    if (error) {
      console.error('Error checking item rights:', error);
      return json({ error: 'Fehler bei der Rechte-Prüfung' }, { status: 500 });
    }

    return json({ 
      hasRight: data,
      itemId,
      userId,
      rightType
    });
  } catch (error) {
    console.error('Error in GET /api/check-item-rights/[itemId]:', error);
    return json({ error: 'Server-Fehler' }, { status: 500 });
  }
};

// GET: Alle Rechte für ein Item abrufen
export const POST: RequestHandler = async ({ params, request, locals }) => {
  try {
    const session = await locals.getSession();
    if (!session) {
      return json({ error: 'Nicht angemeldet' }, { status: 401 });
    }

    const itemId = params.itemId;
    const userId = session.user.id;

    if (!itemId) {
      return json({ error: 'Item-ID erforderlich' }, { status: 400 });
    }

    // Alle Rechte für den Benutzer abrufen
    const { data, error } = await supabase.rpc('get_user_item_rights', {
      p_item_id: itemId,
      p_user_id: userId
    });

    if (error) {
      console.error('Error getting user item rights:', error);
      return json({ error: 'Fehler beim Abrufen der Rechte' }, { status: 500 });
    }

    return json({ 
      rights: data,
      itemId,
      userId
    });
  } catch (error) {
    console.error('Error in POST /api/check-item-rights/[itemId]:', error);
    return json({ error: 'Server-Fehler' }, { status: 500 });
  }
};
