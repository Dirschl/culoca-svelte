import { error } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

export const GET = async ({ params }) => {
  const { slug } = params;

  console.log('🔍 Favicon API called with slug:', slug);

  if (!slug) {
    return new Response(null, {
      status: 400,
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }

  try {
    // 1. Hole das Item aus der DB
    console.log('🔍 Querying database for slug:', slug);
    const { data: item, error: dbError } = await supabase
      .from('items')
      .select('id, path_64, path_512, title, original_name')
      .eq('slug', slug)
      .single();

    console.log('🔍 Database result:', { item, dbError });

    if (dbError || !item) {
      console.log('🔍 Item not found for slug:', slug);
      return new Response(null, {
        status: 404,
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    // 2. Verwende 64px-Bild falls verfügbar, sonst 512px
    let imagePath = item.path_64 || item.path_512;
    console.log('🔍 Image paths:', { path_64: item.path_64, path_512: item.path_512, selectedPath: imagePath });
    
    if (!imagePath) {
      console.log('🔍 No image path available');
      return new Response(null, {
        status: 404,
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    // 3. Generiere die URL für das Bild
    const baseUrl = 'https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public';
    const bucket = item.path_64 ? 'images-64' : 'images-512';
    const imageUrl = `${baseUrl}/${bucket}/${imagePath}`;
    console.log('🔍 Generated image URL:', imageUrl);

    // 4. Hole das Bild von Supabase
    console.log('🔍 Fetching image from Supabase...');
    const response = await fetch(imageUrl);
    
    console.log('🔍 Supabase response:', { status: response.status, ok: response.ok, headers: Object.fromEntries(response.headers.entries()) });
    
    if (!response.ok) {
      console.log('🔍 Failed to fetch image from Supabase');
      return new Response(null, {
        status: 404,
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    const imageBuffer = await response.arrayBuffer();
    console.log('🔍 Image buffer size:', imageBuffer.byteLength);

    // 5. Gib das Bild als Favicon zurück
    return new Response(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        'Content-Disposition': 'inline',
        'Access-Control-Allow-Origin': '*',
        'X-Favicon-Source': `Item: ${item.title || item.original_name || item.id} (${bucket})`
      }
    });

  } catch (err) {
    console.error('Favicon generation error:', err);
    
    // Fallback: Return 404 instead of redirect to prevent 500 errors
    return new Response(null, {
      status: 404,
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }
}; 