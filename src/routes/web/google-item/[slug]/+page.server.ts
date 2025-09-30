import type { PageServerLoad } from './$types';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

export const load: PageServerLoad = async ({ params }) => {
  try {
    // Supabase Client erstellen
    const supabaseUrl = env.VITE_SUPABASE_URL;
    const supabaseKey = env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Item aus der Datenbank laden
    const { data: item, error } = await supabase
      .from('items')
      .select(`
        id, title, description, caption, slug, lat, lon, path_2048, created_at, user_id,
        profiles!inner(full_name)
      `)
      .eq('slug', params.slug)
      .eq('is_private', false)
      .eq('gallery', true)
      .single();

    if (error || !item) {
      throw new Error('Item not found');
    }

    return {
      item: {
        id: item.id,
        title: item.title,
        description: item.description,
        caption: item.caption,
        slug: item.slug,
        lat: item.lat,
        lon: item.lon,
        path_2048: item.path_2048,
        created_at: item.created_at,
        creator: item.profiles?.full_name || 'Unbekannt',
        culoca_url: `https://culoca.com/item/${item.slug}`
      }
    };

  } catch (error) {
    console.error('Error loading item:', error);
    throw error;
  }
};
