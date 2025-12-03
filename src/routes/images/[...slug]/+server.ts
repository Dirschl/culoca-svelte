import type { RequestHandler } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

const SUPABASE_STORAGE_URL = 'https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public';

/**
 * SEO-friendly image route that serves 2048px images with slug-based filenames
 * URLs: /images/{slug}.jpg or /images/{slug}.webp
 * Example: /images/my-awesome-photo-user.jpg
 */
export const GET: RequestHandler = async ({ params, url, request }) => {
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
    // Extract size suffix and extension from slug path
    // Examples:
    // - "my-slug-2048.jpg" -> slug: "my-slug", size: "2048", extension: ".jpg"
    // - "my-slug-512.jpg" -> slug: "my-slug", size: "512", extension: ".jpg"
    // - "my-slug.jpg" -> slug: "my-slug", size: null, extension: ".jpg"
    let actualSlug = slugPath;
    let requestedExtension = '';
    let requestedSize: '512' | '2048' | null = null;
    
    // Check for size suffix pattern: -2048.jpg or -512.jpg
    const sizeSuffixMatch = slugPath.match(/-(2048|512)\.(jpg|jpeg|webp|png)$/i);
    if (sizeSuffixMatch) {
      requestedSize = sizeSuffixMatch[1] as '512' | '2048';
      requestedExtension = '.' + sizeSuffixMatch[2].toLowerCase();
      actualSlug = slugPath.slice(0, -(`-${requestedSize}${requestedExtension}`.length));
    } else {
      // Check if slug path ends with .jpg, .jpeg, .webp, or .png (without size suffix)
      const extensionMatch = slugPath.match(/\.(jpg|jpeg|webp|png)$/i);
      if (extensionMatch) {
        requestedExtension = extensionMatch[0].toLowerCase();
        actualSlug = slugPath.slice(0, -requestedExtension.length);
      }
    }

    console.log(`🔍 [Images] Extracted slug: ${actualSlug}, size: ${requestedSize || 'default'}, extension: ${requestedExtension || 'none'}`);

    // 1. Query database for item with this slug
    const { data: item, error: dbError } = await supabase
      .from('items')
      .select('id, slug, path_2048, path_512, title, description, is_private, created_at, updated_at')
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

    // 3. Check for size parameter (fallback for query parameter: ?size=512 or ?size=2048)
    // Priority: size suffix in URL > query parameter > default (2048px)
    const sizeParam = url.searchParams.get('size');
    if (!requestedSize && (sizeParam === '512' || sizeParam === '2048')) {
      requestedSize = sizeParam;
    }

    // 4. Determine which image to serve based on size suffix/parameter
    let imagePath: string | null = null;
    let bucket: string | null = null;
    
    if (requestedSize === '512' && item.path_512) {
      imagePath = item.path_512;
      bucket = 'images-512';
    } else if (requestedSize === '2048' && item.path_2048) {
      imagePath = item.path_2048;
      bucket = 'images-2048';
    } else {
      // Default: prefer 2048px, fallback to 512px
      if (item.path_2048) {
        imagePath = item.path_2048;
        bucket = 'images-2048';
        requestedSize = '2048'; // Set for consistent behavior
      } else if (item.path_512) {
        imagePath = item.path_512;
        bucket = 'images-512';
        requestedSize = '512'; // Set for consistent behavior
      }
    }

    if (!imagePath || !bucket) {
      console.error(`❌ [Images] No image path found for slug: ${actualSlug}`);
      return new Response('Image not found', { 
        status: 404,
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    const imageUrl = `${SUPABASE_STORAGE_URL}/${bucket}/${imagePath}`;
    
    console.log(`📥 [Images] Fetching image from: ${imageUrl} (size: ${requestedSize || 'default'})`);

    // 5. Fetch image from Supabase Storage
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

    // 6. Get image buffer
    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('Content-Type') || 'image/jpeg';
    
    console.log(`✅ [Images] Image loaded successfully: ${imageBuffer.byteLength} bytes, Content-Type: ${contentType}`);

    // 7. Determine file extension from actual file path if not requested
    let fileExtension = requestedExtension;
    if (!fileExtension) {
      // Extract extension from actual file path (e.g., "abc123.jpg" -> ".jpg")
      const pathExtensionMatch = imagePath.match(/\.(jpg|jpeg|webp|png)$/i);
      fileExtension = pathExtensionMatch ? pathExtensionMatch[0].toLowerCase() : '.jpg';
    }

    // 8. Determine final Content-Type based on file extension or actual file
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

    // 9. Generate ETag for caching (based on image hash or slug + size)
    const etag = `"${actualSlug}-${requestedSize || 'default'}-${imagePath}"`;
    
    // 10. Check if client has cached version (If-None-Match header)
    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          'ETag': etag,
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      });
    }

    // 11. Get Last-Modified from item (if available)
    const lastModified = item.updated_at || item.created_at;
    const lastModifiedDate = lastModified ? new Date(lastModified) : new Date();

    // 12. Return image with SEO-friendly headers
    const headers = new Headers({
      'Content-Type': finalContentType,
      'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year (immutable)
      'Content-Disposition': `inline; filename="${actualSlug}${fileExtension}"`,
      'Access-Control-Allow-Origin': '*',
      'ETag': etag,
      'Last-Modified': lastModifiedDate.toUTCString(),
      // Explicitly allow Google to index images for Google Image Search
      'X-Robots-Tag': 'index, follow, max-image-preview:large',
      // Add SEO-friendly headers
      'X-Content-Type-Options': 'nosniff'
    });

    return new Response(imageBuffer, {
      status: 200,
      headers
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
