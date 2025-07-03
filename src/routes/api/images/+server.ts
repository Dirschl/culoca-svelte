import { json, error } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

export const GET = async ({ url }) => {
  try {
    // Query-Parameter: limit (default 12), user_id (optional)
    const limit = parseInt(url.searchParams.get('limit') || '12', 10);
    const user_id = url.searchParams.get('user_id');

    let query = supabase
      .from('images')
      .select('id, path_512, path_2048, original_name, created_at, user_id, profile_id, title, description')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    const { data, error: dbError } = await query;
    if (dbError) {
      throw error(500, dbError.message);
    }

    return json({ status: 'success', images: data });
  } catch (err) {
    console.error('API /api/images error:', err);
    const message = (err instanceof Error) ? err.message : 'Unknown error';
    return json({ status: 'error', message }, { status: 500 });
  }
}; 