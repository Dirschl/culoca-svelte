import type { RequestHandler } from '@sveltejs/kit';

const SUPABASE_STORAGE_URL = 'https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public';

/** Nur Buckets, die als Mini-Thumbnails ohne Bild-Index ausgeliefert werden. */
const ALLOWED_BUCKETS = new Set(['images-64', 'images-512']);

function encodeStorageObjectPath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

/**
 * Proxy für Storage-Thumbnails (64px, 512px) mit X-Robots-Tag: noimageindex.
 * Verhindert, dass direkte Supabase-64px-URLs in Google Bilder mit der Host-Item-Seite verknüpft werden.
 */
export const GET: RequestHandler = async ({ params }) => {
  const bucket = params.bucket || '';
  const keyRaw = params.key || '';

  if (!ALLOWED_BUCKETS.has(bucket)) {
    return new Response('Not found', { status: 404 });
  }

  let objectPath: string;
  try {
    objectPath = decodeURIComponent(keyRaw);
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  if (!objectPath || objectPath.includes('..') || objectPath.startsWith('/')) {
    return new Response('Bad request', { status: 400 });
  }

  const url = `${SUPABASE_STORAGE_URL}/${bucket}/${encodeStorageObjectPath(objectPath)}`;
  try {
    const upstream = await fetch(url);
    if (!upstream.ok) {
      return new Response('Not found', { status: 404 });
    }
    const buf = await upstream.arrayBuffer();
    const contentType = upstream.headers.get('Content-Type') || 'image/jpeg';

    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'X-Robots-Tag': 'noimageindex',
        'X-Content-Type-Options': 'nosniff',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch {
    return new Response('Bad gateway', { status: 502 });
  }
};
