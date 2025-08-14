import { error } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

export const GET = async ({ params }) => {
  const { slug } = params;

  if (!slug) {
    return new Response(null, {
      status: 400,
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }

  // Vercel-spezifische Optimierungen
  const startTime = Date.now();

  try {
    // 1. Hole das Item aus der DB
    const { data: item, error: dbError } = await supabase
      .from('items')
      .select('id, path_512, title, original_name')
      .eq('slug', slug)
      .single();

    if (dbError || !item) {
      // Return 404 instead of throwing error to prevent 500
      return new Response(null, {
        status: 404,
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    // 2. Wenn kein 512px-Bild vorhanden ist, verwende das Standard-Favicon
    if (!item.path_512) {
      // Return 404 instead of throwing error to prevent 500
      return new Response(null, {
        status: 404,
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    // 3. Generiere die URL für das 512px-Bild
    const baseUrl = 'https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public';
    const imageUrl = `${baseUrl}/images-512/${item.path_512}`;

    // 4. Hole das Bild von Supabase
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      // Return 404 instead of throwing error to prevent 500
      return new Response(null, {
        status: 404,
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    const imageBuffer = await response.arrayBuffer();

    // 5. Konvertiere zu PNG für bessere Browser-Kompatibilität
    try {
      const sharp = (await import('sharp')).default;
      
      // Vercel-optimierte Sharp-Konfiguration mit zusätzlichen Sicherheitsmaßnahmen
      const pngBuffer = await sharp(imageBuffer, { 
        failOnError: false,
        limitInputPixels: false,
        pages: -1 // Process all pages
      })
        .resize(512, 512, { fit: 'cover' })
        .png({ quality: 90 })
        .toBuffer();
      
      const processingTime = Date.now() - startTime;
      console.log(`Favicon generated in ${processingTime}ms for slug: ${slug}`);
      
      // Validate buffer before creating response
      if (!pngBuffer || pngBuffer.length === 0) {
        throw new Error('Empty PNG buffer generated');
      }
      
      // Create response with proper headers for favicon
      const response = new Response(pngBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=3600, s-maxage=86400',
          'Content-Disposition': 'inline',
          'Access-Control-Allow-Origin': '*'
        }
      });
      
      return response;
    } catch (sharpError) {
      console.error('Sharp conversion error:', sharpError);
      const processingTime = Date.now() - startTime;
      console.log(`Favicon fallback in ${processingTime}ms for slug: ${slug}`);
      
      // Validate imageBuffer before fallback
      if (!imageBuffer || imageBuffer.byteLength === 0) {
        throw new Error('Empty image buffer');
      }
      
      // Fallback: Original JPEG zurückgeben mit proper headers
      const response = new Response(imageBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=3600, s-maxage=86400',
          'Content-Disposition': 'inline',
          'Access-Control-Allow-Origin': '*'
        }
      });
      
      return response;
    }

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