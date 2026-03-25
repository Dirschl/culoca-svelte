/**
 * Öffentliche Bild-Auslieferung (Supabase Storage → Browser)
 *
 * | Modus              | URL / Verwendung                         | X-Robots-Tag (Bild) |
 * |--------------------|------------------------------------------|----------------------|
 * | indexable          | /images/{slug}-2048… (Hauptbild)         | index, max-image-preview:large |
 * | embed_noimageindex | /images/{slug}-512…, /images/similar/…   | noimageindex         |
 * | (legacy)           | ?context=similar auf /images/…           | noimageindex         |
 *
 * HTML-Item-Links bleiben normal crawlbar; nur die Bild-Response trägt noimageindex.
 * ETag enthält ix|ni, damit CDN/304 nicht die falsche Robot-Variante cacht.
 *
 * Mini-Thumbs: /images/embed/images-64/… und /images/embed/images-512/… (separate Datei, noimageindex).
 *
 * Fazit: Nur /images/{slug}-2048… bleibt explizit indexierbar; 512er, Similar und Embed-Proxys liefern
 * noimageindex, damit Google Bilder ein klares Hauptmotiv pro Item-URL sieht — Zielseiten bleiben über <a href> crawlbar.
 */
import type { RequestEvent } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import { supabaseAdmin } from '$lib/supabaseAdmin';

const dbForPublicImages = supabaseAdmin ?? supabase;

const SUPABASE_STORAGE_URL = 'https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public';

const IMAGE_EXTS = ['.webp', '.jpg', '.jpeg', '.png'] as const;

function normalizeStorageKey(path: string | null | undefined): string | null {
  if (!path) return null;
  const t = path.trim().replace(/^\/+/, '');
  return t || null;
}

function encodeStorageObjectPath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

function buildStorageFetchPlan(
  itemId: string,
  path512: string | null | undefined,
  path2048: string | null | undefined,
  requestedSize: '512' | '2048' | null
): { bucket: string; path: string }[] {
  const out: { bucket: string; path: string }[] = [];
  const seen = new Set<string>();
  const add = (bucket: string, path: string) => {
    const k = `${bucket}|${path}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ bucket, path });
  };

  const p512 = normalizeStorageKey(path512);
  const p2048 = normalizeStorageKey(path2048);

  const push512First = () => {
    if (p512) {
      add('images-512', p512);
      const base = p512.includes('/') ? p512.split('/').pop() : null;
      if (base && base !== p512) add('images-512', base);
    }
    for (const ext of IMAGE_EXTS) {
      add('images-512', `${itemId}${ext}`);
    }
  };

  const push2048First = () => {
    if (p2048) {
      add('images-2048', p2048);
      const base = p2048.includes('/') ? p2048.split('/').pop() : null;
      if (base && base !== p2048) add('images-2048', base);
    }
    for (const ext of IMAGE_EXTS) {
      add('images-2048', `${itemId}${ext}`);
    }
  };

  if (requestedSize === '512') {
    push512First();
    push2048First();
  } else if (requestedSize === '2048') {
    push2048First();
    push512First();
  } else {
    if (p2048) {
      push2048First();
      push512First();
    } else {
      push512First();
      push2048First();
    }
  }

  return out;
}

async function fetchFirstAvailableImage(
  plan: { bucket: string; path: string }[]
): Promise<{ bucket: string; path: string; response: Response } | null> {
  for (const { bucket, path } of plan) {
    const url = `${SUPABASE_STORAGE_URL}/${bucket}/${encodeStorageObjectPath(path)}`;
    try {
      const response = await fetch(url);
      if (response.ok) {
        return { bucket, path, response };
      }
      console.warn(`⚠️ [Images] Miss ${bucket}/${path}: ${response.status}`);
    } catch (e) {
      console.warn(`⚠️ [Images] Fetch error ${bucket}/${path}:`, e);
    }
  }
  return null;
}

export type PublicImageRobotMode = 'indexable' | 'embed_noimageindex';

/**
 * Shared handler for /images/... and /images/similar/...
 * embed_noimageindex: Thumbnails in „Ähnliche Motive“ — nicht in Google Bildersuche
 * dem Host-Item zuordnen (X-Robots-Tag + eigener Cache-ETag).
 */
export async function respondPublicImage(
  { params, url, request }: Pick<RequestEvent, 'params' | 'url' | 'request'>,
  robotMode: PublicImageRobotMode
): Promise<Response> {
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

  let slugPath = Array.isArray(slug) ? slug.join('/') : slug;
  try {
    slugPath = decodeURIComponent(slugPath.replace(/\+/g, ' '));
  } catch {
    /* keep raw */
  }

  console.log(`🔍 [Images] Request for slug path: ${slugPath} (robotMode=${robotMode})`);

  try {
    let actualSlug = slugPath;
    let requestedExtension = '';
    let requestedSize: '512' | '2048' | null = null;

    const sizeSuffixMatch = slugPath.match(/-(2048|512)\.(jpg|jpeg|webp|png)$/i);
    if (sizeSuffixMatch) {
      requestedSize = sizeSuffixMatch[1] as '512' | '2048';
      requestedExtension = '.' + sizeSuffixMatch[2].toLowerCase();
      actualSlug = slugPath.slice(0, -(`-${requestedSize}${requestedExtension}`.length));
    } else {
      const extensionMatch = slugPath.match(/\.(jpg|jpeg|webp|png)$/i);
      if (extensionMatch) {
        requestedExtension = extensionMatch[0].toLowerCase();
        actualSlug = slugPath.slice(0, -requestedExtension.length);
      }
    }

    actualSlug = actualSlug.trim();
    console.log(
      `🔍 [Images] Extracted slug: ${actualSlug}, size: ${requestedSize || 'default'}, extension: ${requestedExtension || 'none'}`
    );

    const { data: rows, error: dbError } = await dbForPublicImages
      .from('items')
      .select('id, slug, path_2048, path_512, title, description, is_private, created_at, updated_at')
      .eq('slug', actualSlug)
      .limit(1);

    const item = rows?.[0];

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

    const sizeParam = url.searchParams.get('size');
    if (!requestedSize && (sizeParam === '512' || sizeParam === '2048')) {
      requestedSize = sizeParam;
    }

    const noImageIndex = robotMode === 'embed_noimageindex' || requestedSize === '512';
    const xRobotsTag = noImageIndex
      ? 'noimageindex, noarchive, nosnippet'
      : 'index, follow, max-image-preview:large';

    const plan = buildStorageFetchPlan(item.id, item.path_512, item.path_2048, requestedSize);
    const hit = await fetchFirstAvailableImage(plan);

    if (!hit) {
      console.error(`❌ [Images] No object found in storage for item ${item.id} (slug ${actualSlug})`);
      return new Response('Image not found', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    const { bucket, path: imagePath, response: imageResponse } = hit;
    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('Content-Type') || 'image/jpeg';

    console.log(
      `✅ [Images] Served ${bucket}/${imagePath} (${imageBuffer.byteLength} bytes) for slug ${actualSlug}`
    );

    let fileExtension = requestedExtension;
    if (!fileExtension) {
      const pathExtensionMatch = imagePath.match(/\.(jpg|jpeg|webp|png)$/i);
      fileExtension = pathExtensionMatch ? pathExtensionMatch[0].toLowerCase() : '.jpg';
    }

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

    const cacheVersion = item.updated_at || item.created_at || imagePath;
    const robotKey = noImageIndex ? 'ni' : 'ix';
    const etag = `"${actualSlug}-${requestedSize || 'default'}-${bucket}-${imagePath}-${cacheVersion}-${robotKey}"`;

    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          ETag: etag,
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
          'X-Robots-Tag': xRobotsTag,
          'X-Content-Type-Options': 'nosniff'
        }
      });
    }

    const lastModified = item.updated_at || item.created_at;
    const lastModifiedDate = lastModified ? new Date(lastModified) : new Date();

    const headers = new Headers({
      'Content-Type': finalContentType,
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'Content-Disposition': `inline; filename="${actualSlug}${fileExtension}"`,
      'Access-Control-Allow-Origin': '*',
      ETag: etag,
      'Last-Modified': lastModifiedDate.toUTCString(),
      'X-Robots-Tag': xRobotsTag,
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
}
