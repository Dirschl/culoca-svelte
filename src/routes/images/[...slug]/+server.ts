import type { RequestHandler } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

const SUPABASE_STORAGE_URL = 'https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public';

/**
 * SEO-friendly image route that serves 2048px images with slug-based filenames
 * URLs: /images/{slug}.jpg or /images/{slug}.webp
 * Example: /images/my-awesome-photo-user.jpg
 */
export const GET: RequestHandler = async ({ params, url }) => {
  const { slug } = params;
  
  if (!slug) {
    return new Response('Missing slug', { 
      status: 400,
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }

  // Catch-All routes return slug as an array (e.g., ['test-slug', 'jpg'] or ['test-slug.jpg'])
  // Join the array to get the full path
  const slugPath = Array.isArray(slug) ? slug.join('/') : slug;
  
  console.log(`🔍 [Images] Request for slug path: ${slugPath}`);

  try {
    // Extract extension from slug path (e.g., "my-slug.jpg" -> slug: "my-slug", extension: ".jpg")
    let actualSlug = slugPath;
    let requestedExtension = '';
    
    // Check if slug path ends with .jpg, .jpeg, .webp, or .png
    const extensionMatch = slugPath.match(/\.(jpg|jpeg|webp|png)$/i);
    if (extensionMatch) {
      requestedExtension = extensionMatch[0].toLowerCase();
      actualSlug = slugPath.slice(0, -requestedExtension.length);
    }

    console.log(`🔍 [Images] Extracted slug: ${actualSlug}, requested extension: ${requestedExtension || 'none'}`);

    // 1. Query database for item with this slug
    const { data: item, error: dbError } = await supabase
      .from('items')
      .select('id, slug, path_2048, path_512, title, description, is_private')
      .eq('slug', actualSlug)
      .single();

    if (dbError || !item) {
      console.error(`❌ [Images] Item not found for slug: ${actualSlug}`, dbError);
      return new Response('Image not found', { 
        status: 404,
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    // 2. Check if item is private (only serve public images)
    if (item.is_private) {
      console.error(`❌ [Images] Item is private: ${actualSlug}`);
      return new Response('Image not found', { 
        status: 404,
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    // 3. Determine which image to serve (prefer 2048px, fallback to 512px)
    const imagePath = item.path_2048 || item.path_512;
    if (!imagePath) {
      console.error(`❌ [Images] No image path found for slug: ${actualSlug}`);
      return new Response('Image not found', { 
        status: 404,
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    const bucket = item.path_2048 ? 'images-2048' : 'images-512';
    const imageUrl = `${SUPABASE_STORAGE_URL}/${bucket}/${imagePath}`;
    
    console.log(`📥 [Images] Fetching image from: ${imageUrl}`);

    // 4. Fetch image from Supabase Storage
    const imageResponse = await fetch(imageUrl);
    
    if (!imageResponse.ok) {
      console.error(`❌ [Images] Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
      return new Response('Image not found', { 
        status: 404,
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    // 5. Get image buffer
    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('Content-Type') || 'image/jpeg';
    
    console.log(`✅ [Images] Image loaded successfully: ${imageBuffer.byteLength} bytes, Content-Type: ${contentType}`);

    // 6. Determine file extension from actual file path if not requested
    let fileExtension = requestedExtension;
    if (!fileExtension) {
      // Extract extension from actual file path (e.g., "abc123.jpg" -> ".jpg")
      const pathExtensionMatch = imagePath.match(/\.(jpg|jpeg|webp|png)$/i);
      fileExtension = pathExtensionMatch ? pathExtensionMatch[0].toLowerCase() : '.jpg';
    }

    // 7. Determine final Content-Type based on file extension or actual file
    let finalContentType = contentType;
    if (fileExtension) {
      if (fileExtension === '.jpg' || fileExtension === '.jpeg') {
        finalContentType = 'image/jpeg';
      } else if (fileExtension === '.webp') {
        finalContentType = 'image/webp';
      } else if (fileExtension === '.png') {
        finalContentType = 'image/png';
      }
    }

    // 8. Return image with SEO-friendly headers
    return new Response(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': finalContentType,
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year (immutable)
        'Content-Disposition': `inline; filename="${actualSlug}${fileExtension}"`,
        'Access-Control-Allow-Origin': '*',
        // Explicitly allow Google to index images (no noindex header)
        // X-Robots-Tag is not set, which means images are indexable by default
        // Add SEO-friendly headers
        'X-Content-Type-Options': 'nosniff'
      }
    });

  } catch (error) {
    console.error(`❌ [Images] Error serving image for slug ${slug}:`, error);
    return new Response('Internal server error', { 
      status: 500,
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }
};
