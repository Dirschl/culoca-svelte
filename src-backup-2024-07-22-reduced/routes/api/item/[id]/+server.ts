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