import { json, error } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import { createClient } from 'webdav';

export const DELETE = async ({ params }) => {
  const { id } = params;
  if (!id) {
    throw error(400, 'Missing id');
  }

  // 1. Hole Item aus DB
  const { data: item, error: fetchError } = await supabase
    .from('items')
    .select('id, path_512, path_2048, path_64, original_url')
    .eq('id', id)
    .single();

  if (fetchError || !item) {
    throw error(404, 'Item not found');
  }

  // 2. Lösche Bilder aus Supabase Storage
  const filesToDelete = [];
  if (item.path_512) filesToDelete.push(item.path_512);
  if (item.path_2048) filesToDelete.push(item.path_2048);
  if (item.path_64) filesToDelete.push(item.path_64);

  if (filesToDelete.length > 0) {
    await supabase.storage.from('images-512').remove([item.path_512]);
    await supabase.storage.from('images-2048').remove([item.path_2048]);
    await supabase.storage.from('images-64').remove([item.path_64]);
  }

  // 3. Lösche Original von Hetzner (WebDAV)
  let hetznerDeleted = false;
  if (item.original_url) {
    try {
      const webdav = createClient(
        process.env.HETZNER_WEBDAV_URL!,
        {
          username: process.env.HETZNER_WEBDAV_USER!,
          password: process.env.HETZNER_WEBDAV_PASSWORD!
        }
      );
      // Extrahiere Pfad aus URL
      const url = new URL(item.original_url);
      const hetznerPath = url.pathname;
      await webdav.deleteFile(hetznerPath);
      hetznerDeleted = true;
    } catch (e) {
      hetznerDeleted = false;
    }
  }

  // 4. Lösche DB-Eintrag
  const { error: deleteError } = await supabase
    .from('items')
    .delete()
    .eq('id', id);

  if (deleteError) {
    throw error(500, 'Failed to delete item from database');
  }

  return json({ success: true, hetznerDeleted });
};

export const PATCH = async ({ params, request, locals }) => {
  const { id } = params;
  if (!id) {
    throw error(400, 'Missing id');
  }

  // Parse JSON body
  let body;
  try {
    body = await request.json();
  } catch (e) {
    throw error(400, 'Invalid JSON');
  }

  // Erlaubte Felder
  const allowedFields = ['title', 'description', 'keywords', 'original_name', 'gallery', 'lat', 'lon', 'slug'];
  const updateData = {};
  for (const key of allowedFields) {
    if (body[key] !== undefined) {
      updateData[key] = body[key];
    }
  }
  if (Object.keys(updateData).length === 0) {
    throw error(400, 'No valid fields to update');
  }

  // Optional: Authentifizierung und Besitz prüfen (hier nur als Beispiel, ggf. anpassen)
  // const user = locals.user; // oder aus JWT, falls vorhanden
  // const { data: item } = await supabase.from('items').select('profile_id').eq('id', id).single();
  // if (!item || item.profile_id !== user.id) throw error(403, 'Not allowed');

  // Update in DB
  const { data, error: updateError } = await supabase
    .from('items')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    console.error('Database update error:', updateError);
    
    // Spezielle Behandlung für Slug-Konflikte
    if (updateError.code === '23505' && updateError.message.includes('slug')) {
      throw error(409, 'Slug already exists. Please choose a different slug.');
    }
    
    throw error(500, updateError.message);
  }

  return json({ success: true, item: data });
}; 