import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL) || 'https://caskhmcbvtevdwsolvwk.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseService = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : supabase;

function applyMultiWordSearch<T>(query: T, search: string) {
  const words = search
    .trim()
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  const clauses = words.flatMap((word) => {
    const escaped = word.replace(/%/g, '\\%').replace(/_/g, '\\_');
    return [
      `title.ilike.%${escaped}%`,
      `description.ilike.%${escaped}%`,
      `caption.ilike.%${escaped}%`,
      `slug.ilike.%${escaped}%`,
      `keywords.ilike.%${escaped}%`,
      `original_name.ilike.%${escaped}%`
    ];
  });

  if (!clauses.length) return query;
  return (query as any).or(clauses.join(','));
}

function getDistanceInMeters(userLat: number, userLon: number, itemLat: number, itemLon: number) {
  const earthRadius = 6371000;
  const lat1 = (userLat * Math.PI) / 180;
  const lat2 = (itemLat * Math.PI) / 180;
  const dLat = ((itemLat - userLat) * Math.PI) / 180;
  const dLon = ((itemLon - userLon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

export async function GET({ url }: any) {
  try {
    const page = Math.max(0, parseInt(url.searchParams.get('page') || '0'));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('page_size') || '24')));
    const search = (url.searchParams.get('search') || '').trim();
    const lat = Number(url.searchParams.get('lat') || '0');
    const lon = Number(url.searchParams.get('lon') || '0');
    const hasGps = Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0);

    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = user?.id || null;

    let countQuery = supabaseService
      .from('items')
      .select('id', { count: 'exact', head: true })
      .eq('type_id', 1)
      .eq('admin_hidden', false)
      .is('group_root_item_id', null)
      .not('slug', 'is', null)
      .not('path_512', 'is', null);

    if (search) {
      countQuery = applyMultiWordSearch(countQuery, search);
    }

    const { count, error: countError } = await countQuery;
    if (countError) {
      return json({ error: 'Failed to count foto items', details: countError }, { status: 500 });
    }

    const totalMatching = count || 0;
    const fetchSize = 1000;
    let from = 0;
    const allRows: any[] = [];

    while (from < totalMatching) {
      let dataQuery = supabaseService
        .from('items')
        .select('id, slug, title, description, caption, canonical_path, path_512, path_2048, path_64, width, height, created_at, starts_at, ends_at, external_url, lat, lon, is_private, profile_id, original_name, keywords')
        .eq('type_id', 1)
        .eq('admin_hidden', false)
        .is('group_root_item_id', null)
        .not('slug', 'is', null)
        .not('path_512', 'is', null)
        .range(from, from + fetchSize - 1);

      if (search) {
        dataQuery = applyMultiWordSearch(dataQuery, search);
      }

      const { data, error } = await dataQuery;
      if (error) {
        return json({ error: 'Failed to load foto items', details: error }, { status: 500 });
      }

      if (!data || data.length === 0) break;
      allRows.push(...data);
      from += fetchSize;
    }

    const visibleRows = allRows.filter((item) => {
      if (currentUserId && item.profile_id === currentUserId) return true;
      return item.is_private === false || item.is_private == null;
    });

    const rootIds = visibleRows.map((item) => item.id);
    const { data: variantRows } = rootIds.length
      ? await supabaseService
          .from('items')
          .select('id, slug, path_512, width, height, group_root_item_id, is_private, profile_id')
          .in('group_root_item_id', rootIds)
          .eq('admin_hidden', false)
          .not('slug', 'is', null)
          .not('path_512', 'is', null)
          .order('created_at', { ascending: false })
      : { data: [], error: null };

    const variantsByRoot = new Map<string, any[]>();
    for (const row of variantRows || []) {
      const isVisible = (currentUserId && row.profile_id === currentUserId) || row.is_private === false || row.is_private == null;
      if (!isVisible || !row.group_root_item_id) continue;
      const current = variantsByRoot.get(row.group_root_item_id) || [];
      if (current.length >= 5) continue;
      current.push(row);
      variantsByRoot.set(row.group_root_item_id, current);
    }

    const preparedRows = visibleRows
      .map((item) => {
        const itemLat = Number(item.lat);
        const itemLon = Number(item.lon);
        const hasCoordinates = Number.isFinite(itemLat) && Number.isFinite(itemLon);
        return {
          ...item,
          lat: hasCoordinates ? itemLat : item.lat,
          lon: hasCoordinates ? itemLon : item.lon,
          distance: hasGps && hasCoordinates ? getDistanceInMeters(lat, lon, itemLat, itemLon) : null,
          variants: variantsByRoot.get(item.id) || [],
          child_count: (variantsByRoot.get(item.id) || []).length
        };
      })
      .sort((a, b) => {
        if (hasGps) {
          const aDistance = a.distance ?? Number.POSITIVE_INFINITY;
          const bDistance = b.distance ?? Number.POSITIVE_INFINITY;
          if (aDistance !== bDistance) return aDistance - bDistance;
        }

        const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bCreated - aCreated;
      });

    const pageStart = page * pageSize;
    const items = preparedRows.slice(pageStart, pageStart + pageSize);

    return json({
      items,
      totalCount: preparedRows.length,
      page,
      pageSize,
      hasGps
    });
  } catch (error) {
    console.error('[foto-items API] Unexpected error:', error);
    return json({ error: 'Failed to load foto items' }, { status: 500 });
  }
}
