import { error } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

export const GET = async ({ params }) => {
  const { slug } = params;

  if (!slug) {
    throw error(400, 'Missing slug');
  }

  try {
    // 1. Hole das Item aus der DB
    const { data: item, error: dbError } = await supabase
      .from('items')
      .select('id, path_512, title, original_name')
      .eq('slug', slug)
      .single();

    if (dbError || !item) {
      throw error(404, 'Bild nicht gefunden');
    }

    // 2. Wenn kein 512px-Bild vorhanden ist, verwende das Standard-Favicon
    if (!item.path_512) {
      // Redirect to default favicon
      throw error(404, 'Kein 512px-Bild verfügbar');
    }

    // 3. Generiere die URL für das 512px-Bild
    const baseUrl = 'https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public';
    const imageUrl = `${baseUrl}/images-512/${item.path_512}`;

    // 4. Hole das Bild von Supabase
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      throw error(404, 'Bild nicht gefunden');
    }

    const imageBuffer = await response.arrayBuffer();

    // 5. Konvertiere zu PNG für bessere Browser-Kompatibilität
    const sharp = (await import('sharp')).default;
    
    try {
      const pngBuffer = await sharp(imageBuffer)
        .resize(512, 512, { fit: 'cover' })
        .png({ quality: 90 })
        .toBuffer();
      
      return new Response(pngBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=3600, s-maxage=86400', // 1 Stunde Browser, 24 Stunden CDN
          'Content-Disposition': 'inline',
          'Access-Control-Allow-Origin': '*',
          'X-Favicon-Source': `Item: ${item.title || item.original_name || item.id}` // Debug-Header
        }
      });
    } catch (sharpError) {
      console.error('Sharp conversion error:', sharpError);
      // Fallback: Original JPEG zurückgeben
      return new Response(imageBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=3600, s-maxage=86400',
          'Content-Disposition': 'inline',
          'Access-Control-Allow-Origin': '*',
          'X-Favicon-Source': `Item: ${item.title || item.original_name || item.id}`
        }
      });
    }

  } catch (err) {
    console.error('Favicon generation error:', err);
    
    // Fallback: Redirect to default favicon
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/favicon.svg'
      }
    });
  }
}; 