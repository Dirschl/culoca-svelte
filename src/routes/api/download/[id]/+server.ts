import { error } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import { createClient } from 'webdav';
import dotenv from 'dotenv';
dotenv.config();

export const GET = async ({ params, request }) => {
  const { id } = params;

  // 1. Hole das Item aus der DB
  const { data: item, error: dbError } = await supabase
    .from('items')
    .select('id, profile_id, original_url, original_name')
    .eq('id', id)
    .single();

  if (dbError || !item) {
    throw error(404, 'Bild nicht gefunden');
  }

  // 2. Prüfe die vereinten Rechte des Users
  let userId = null;
  
  // Versuche zuerst den Authorization Header zu verwenden
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: tokenError } = await supabase.auth.getUser(token);
    if (user) {
      userId = user.id;
      console.log('🔍 User from Authorization header:', userId);
    } else {
      console.log('🔍 Token auth failed:', tokenError);
    }
  }
  
  // Fallback: Supabase-Auth prüfen (Client-Side)
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id;
    console.log('🔍 User from Supabase auth:', userId);
  }
  
  if (!userId) {
    console.log('❌ No authenticated user found');
    throw error(401, 'Nicht angemeldet. Bitte zuerst einloggen.');
  }

  // 3. Prüfe die vereinten Rechte mit der neuen Funktion
  console.log('🔍 Checking unified rights for download:', { userId, itemId: id });
  
  const { data: unifiedRights, error: rightsError } = await supabase
    .rpc('get_unified_item_rights', {
      p_item_id: id,
      p_user_id: userId
    });

  if (rightsError) {
    console.log('❌ Error getting unified rights:', rightsError.message);
    throw error(500, 'Fehler beim Prüfen der Rechte');
  }

  console.log('🔍 Unified rights result:', unifiedRights);
  
  // Prüfe ob der User Download-Rechte hat
  const hasDownloadRights = unifiedRights?.download || unifiedRights?.download_original;
  
  console.log('🔍 Download access check:', {
    userId,
    itemProfileId: item.profile_id,
    isOwner: userId === item.profile_id,
    hasDownloadRights,
    unifiedRights
  });
  
  if (!hasDownloadRights) {
    console.log('❌ Access denied - no download rights:', { userId, itemProfileId: item.profile_id });
    throw error(403, 'Kein Download-Zugriff auf diese Datei');
  }

  // 4. Hole die Datei per WebDAV
  try {
    console.log('🔍 Download Debug:', {
      itemId: id,
      originalUrl: item.original_url,
      originalName: item.original_name,
      userId: userId,
      profileId: item.profile_id,
      hasDownloadRights
    });
    
    const webdav = createClient(
      process.env.HETZNER_WEBDAV_URL!,
      {
        username: process.env.HETZNER_WEBDAV_USER!,
        password: process.env.HETZNER_WEBDAV_PASSWORD!
      }
    );
    
    // Extrahiere den Pfad aus der original_url
    let filePath = item.original_url;
    if (filePath && filePath.startsWith('http')) {
      const url = new URL(filePath);
      filePath = url.pathname;
    }
    if (filePath && filePath.startsWith('/')) {
      filePath = filePath.slice(1);
    }
    
    // Fallback: Wenn keine original_url vorhanden ist, verwende den Standard-Pfad
    if (!filePath) {
      filePath = `items/${id}.jpg`;
    }
    
    console.log('🔍 WebDAV file path:', filePath);
    
    // Datei als Buffer holen
    const fileBuffer = await webdav.getFileContents(filePath, { format: 'binary' });
    
    // Stelle sicher, dass wir einen Buffer haben
    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer as any);
    
    // 5. Log download for analytics
    try {
      const downloadType = unifiedRights?.download_original ? 'full_resolution' : 'preview';
      const downloadSource = userId === item.profile_id ? 'owner' : 'rights';
      
      console.log('🔍 Logging download:', {
        itemId: id,
        userId,
        downloadType,
        downloadSource
      });
      
      const { data: downloadLog, error: logError } = await supabase
        .rpc('log_item_download', {
          p_item_id: id,
          p_user_id: userId,
          p_download_type: downloadType,
          p_download_source: downloadSource
        });
      
      if (logError) {
        console.warn('⚠️ Failed to log download:', logError);
      } else {
        console.log('✅ Download logged successfully:', downloadLog);
      }
    } catch (logErr) {
      console.warn('⚠️ Error logging download:', logErr);
    }
    
    // Content-Type bestimmen (hier JPEG, kann ggf. erweitert werden)
    const contentType = 'image/jpeg';
    // Originaldateiname
    const filename = item.original_name || `image-${item.id}.jpg`;
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'private, max-age=0, must-revalidate'
      }
    });
  } catch (err) {
    console.error('Download-Proxy Fehler:', err);
    console.error('Error details:', {
      name: err instanceof Error ? err.name : 'Unknown',
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : 'No stack'
    });
    throw error(500, 'Download fehlgeschlagen: ' + (err instanceof Error ? err.message : String(err)));
  }
}; 