import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import { safeFunctionCall } from '$lib/databaseConfig';
import { getSeoImageUrl } from '$lib/utils/seoImageUrl';
import { getPublicItemHref } from '$lib/content/routing';

function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export async function GET({ params }: any) {
  try {
    const { slug } = params;
    
    // Get the main image first
    const { data: image, error: imageError } = await supabase
      .from('items')
      .select('*')
      .eq('slug', slug)
      .or('is_private.eq.false,is_private.is.null')
      .single();

    if (imageError || !image) {
      return new Response(JSON.stringify({ error: 'Image not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Robots-Tag': 'noindex, nosnippet'
        }
      });
    }

    async function attachVariantMeta(items: any[]) {
      if (!items.length) return items;

      const { data: itemMeta, error: itemMetaError } = await supabase
        .from('items')
        .select('id, group_root_item_id')
        .in('id', items.map((item) => item.id));

      const metaById = new Map((itemMeta || []).map((item) => [item.id, item]));
      const withMeta = items.map((item) => ({
        ...item,
        group_root_item_id: metaById.get(item.id)?.group_root_item_id ?? item.group_root_item_id ?? null
      }));

      if (itemMetaError) {
        return withMeta;
      }

      const rootIds = withMeta.filter((item) => !item.group_root_item_id).map((item) => item.id);
      if (!rootIds.length) return withMeta;

      const { data, error } = await supabase
        .from('items')
        .select('group_root_item_id')
        .in('group_root_item_id', rootIds);

      if (error || !data) {
        return withMeta.map((item) => ({ ...item, child_count: 0 }));
      }

      const counts = new Map<string, number>();
      for (const row of data) {
        if (!row.group_root_item_id) continue;
        counts.set(row.group_root_item_id, (counts.get(row.group_root_item_id) || 0) + 1);
      }

      return withMeta.map((item) => ({
        ...item,
        child_count: counts.get(item.id) || 0
      }));
    }

    // Fetch nearby items using PostGIS
    let nearby: any[] = [];
    if (image && image.lat && image.lon) {
      try {
        const { data: nearbyData, error: nearbyError } = await supabase.rpc('gallery_items_unified_postgis', {
          user_lat: image.lat,
          user_lon: image.lon,
          page_value: 0,
          page_size_value: 300,
          current_user_id: null,
          search_term: null,
          location_filter_lat: null,
          location_filter_lon: null
        }, { head: false });

        if (nearbyError) {
          // Fallback to direct query
          const maxRadius = 2000;
          const degOffset = maxRadius / 111000;
          const latMin = image.lat - degOffset;
          const latMax = image.lat + degOffset;
          const lonMin = image.lon - degOffset;
          const lonMax = image.lon + degOffset;
          
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('items')
            .select('id, slug, canonical_path, country_slug, district_slug, municipality_slug, path_512, path_2048, path_64, original_name, title, description, caption, lat, lon, width, height, is_private, gallery, group_root_item_id, profile_id')
            .not('lat', 'is', null)
            .not('lon', 'is', null)
            .not('path_512', 'is', null)
            .eq('admin_hidden', false)
            .or('is_private.eq.false,is_private.is.null')
            .gte('lat', latMin)
            .lte('lat', latMax)
            .gte('lon', lonMin)
            .lte('lon', lonMax)
            .limit(300);

          if (!fallbackError && fallbackData) {
            nearby = fallbackData
              .filter((item: any) => item.id !== image.id && item.lat && item.lon)
              .map((item: any) => {
                const distance = getDistanceInMeters(image.lat, image.lon, item.lat, item.lon);
                // Use SEO-friendly URLs for better Google indexing
                const seoSrc = getSeoImageUrl(item.slug, item.path_512, '512');
                const seoSrcHD = getSeoImageUrl(item.slug, item.path_2048 || item.path_512, '2048');
                const fallbackSrc = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${item.path_512}`;
                const fallbackSrcHD = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${item.path_2048}`;
                return {
                  id: item.id,
                  slug: item.slug,
                  canonical_path: getPublicItemHref(item),
                  country_slug: item.country_slug ?? null,
                  district_slug: item.district_slug ?? null,
                  municipality_slug: item.municipality_slug ?? null,
                  lat: item.lat,
                  lon: item.lon,
                  distance,
                  src: seoSrc || fallbackSrc,
                  srcHD: seoSrcHD || fallbackSrcHD,
                  src64: item.path_64 ? `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-64/${item.path_64}` : fallbackSrc,
                  width: item.width,
                  height: item.height,
                  title: item.title || item.original_name || 'Bild',
                  description: item.description || `Bild aus der Nähe von ${image.title}`,
                  caption: item.caption || item.description || `Bild aus der Nähe von ${image.title}`,
                  gallery: item.gallery ?? true,
                  group_root_item_id: item.group_root_item_id ?? null,
                  profile_id: item.profile_id ?? null
                };
              })
              .filter((item: any) => item.distance <= maxRadius)
              .sort((a: any, b: any) => a.distance - b.distance)
              .slice(0, 300);
          }
        } else {
          const nearbyIds = (nearbyData || []).map((item: any) => item.id).filter(Boolean);
          const { data: geoData } = nearbyIds.length
            ? await supabase
                .from('items')
                .select('id, slug, canonical_path, country_slug, district_slug, municipality_slug')
                .in('id', nearbyIds)
            : { data: [] as any[] };
          const geoById = new Map((geoData || []).map((item: any) => [item.id, item]));

          nearby = (nearbyData || [])
            .filter((item: any) => item.id !== image.id)
            .map((item: any) => {
              const geoItem = geoById.get(item.id) || item;
              // Use SEO-friendly URLs for better Google indexing
              const seoSrc = getSeoImageUrl(item.slug, item.path_512, '512');
              const seoSrcHD = getSeoImageUrl(item.slug, item.path_2048 || item.path_512, '2048');
              const fallbackSrc = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${item.path_512}`;
              const fallbackSrcHD = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${item.path_2048}`;
              return {
                id: item.id,
                slug: item.slug,
                canonical_path: getPublicItemHref(geoItem),
                country_slug: geoItem.country_slug ?? null,
                district_slug: geoItem.district_slug ?? null,
                municipality_slug: geoItem.municipality_slug ?? null,
                lat: item.lat,
                lon: item.lon,
                distance: item.distance,
                src: seoSrc || fallbackSrc,
                srcHD: seoSrcHD || fallbackSrcHD,
                src64: item.path_64 ? `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-64/${item.path_64}` : fallbackSrc,
                width: item.width,
                height: item.height,
                title: item.title || item.original_name || 'Bild',
                description: item.description || `Bild aus der Nähe von ${image.title}`,
                caption: item.caption || item.description || `Bild aus der Nähe von ${image.title}`,
                gallery: item.gallery ?? true,
                group_root_item_id: item.group_root_item_id ?? null,
                profile_id: item.profile_id ?? null
              };
            })
            .filter((item: any) => item.distance <= 2000)
            .slice(0, 300);
        }
      } catch (error) {
        console.error('[Nearby API] Error fetching nearby items:', error);
      }
    }

    nearby = (await attachVariantMeta(nearby)).filter((item) => item.group_root_item_id == null);

    return new Response(JSON.stringify({ nearby }), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Robots-Tag': 'noindex, nosnippet'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch nearby items' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Robots-Tag': 'noindex, nosnippet'
      }
    });
  }
}
