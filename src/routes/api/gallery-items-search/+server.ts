import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

export async function GET({ url }) {
  try {
    const page = parseInt(url.searchParams.get('page') || '0');
    const search = url.searchParams.get('search') || '';
    const lat = parseFloat(url.searchParams.get('lat') || '0');
    const lon = parseFloat(url.searchParams.get('lon') || '0');
    const locationFilterLat = parseFloat(url.searchParams.get('locationFilterLat') || '0');
    const locationFilterLon = parseFloat(url.searchParams.get('locationFilterLon') || '0');
    
    console.log('[Search API] Request params:', { page, search, lat, lon, locationFilterLat, locationFilterLon });

    // Hole aktuelle User-ID für Privacy-Filter
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = user?.id || null;

    // TEMPORÄR: Verwende einfache SQL-Abfrage statt PostGIS-Funktion
    let query = supabase
      .from('items')
      .select('*', { count: 'exact' })
      .not('path_512', 'is', null)
      .eq('gallery', true);

    // Privacy-Filter
    if (currentUserId) {
      query = query.or(`profile_id.eq.${currentUserId},is_private.eq.false,is_private.is.null`);
    } else {
      query = query.or('is_private.eq.false,is_private.is.null');
    }

    // Search-Filter
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Pagination
    const pageSize = 50;
    const offset = page * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    // Order by created_at (temporär ohne Distance-Sortierung)
    query = query.order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      console.error('[Search API] SQL error:', error);
      return json({ error: 'Failed to fetch gallery items', details: error }, { status: 500 });
    }

    console.log('[Search API] SQL success, items:', data?.length || 0);

    // Map items to include distance (temporär 0)
    const items = data?.map(item => ({
      ...item,
      distance: 0 // Temporär ohne Distance-Berechnung
    })) || [];

    const totalCount = count || 0;

    return json({
      items,
      totalCount,
      page,
      search,
      hasGPS: lat !== 0 && lon !== 0,
      hasLocationFilter: locationFilterLat !== 0 && locationFilterLon !== 0
    });

  } catch (error) {
    console.error('[Search API] Unexpected error:', error);
    return json({ error: 'Failed to fetch gallery items' }, { status: 500 });
  }
} 