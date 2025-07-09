import { json, error } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

export const GET = async ({ url }) => {
  try {
    // Query-Parameter: limit (default 12), user_id (optional), offset (optional)
    const limit = parseInt(url.searchParams.get('limit') || '12', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const user_id = url.searchParams.get('user_id');

    // Build query for images with title, description, and GPS data
    let imagesQuery = supabase
      .from('items')
      .select('id, path_512, path_2048, path_64, original_name, created_at, user_id, profile_id, title, description, lat, lon')
      .not('title', 'is', null)
      .not('description', 'is', null)
      .not('lat', 'is', null)
      .not('lon', 'is', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (user_id) {
      imagesQuery = imagesQuery.eq('user_id', user_id);
    }

    // Get total count of images with title, description, and GPS data
    let totalQuery = supabase
      .from('items')
      .select('id', { count: 'exact' })
      .not('title', 'is', null)
      .not('description', 'is', null)
      .not('lat', 'is', null)
      .not('lon', 'is', null);

    if (user_id) {
      totalQuery = totalQuery.eq('user_id', user_id);
    }

    const [{ data, error: dbError }, { count, error: countError }] = await Promise.all([
      imagesQuery,
      totalQuery
    ]);

    if (dbError) {
      throw error(500, dbError.message);
    }

    if (countError) {
      throw error(500, countError.message);
    }

    return json({ 
      status: 'success', 
      images: data, 
      totalCount: count || 0,
      loadedCount: data?.length || 0
    });
  } catch (err) {
    console.error('API /api/images error:', err);
    const message = (err instanceof Error) ? err.message : 'Unknown error';
    return json({ status: 'error', message }, { status: 500 });
  }
}; 