import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import { safeFunctionCall } from '$lib/databaseConfig';

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

export async function GET({ params }) {
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
            .select('id, slug, path_512, path_2048, path_64, original_name, title, description, caption, lat, lon, width, height, is_private, gallery')
            .not('lat', 'is', null)
            .not('lon', 'is', null)
            .not('path_512', 'is', null)
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
                return {
                  id: item.id,
                  slug: item.slug,
                  lat: item.lat,
                  lon: item.lon,
                  distance,
                  src: `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${item.path_512}`,
                  srcHD: `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${item.path_2048}`,
                  src64: item.path_64 ? `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-64/${item.path_64}` : `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${item.path_512}`,
                  width: item.width,
                  height: item.height,
                  title: item.title || item.original_name || 'Bild',
                  description: item.description || `Bild aus der Nähe von ${image.title}`,
                  caption: item.caption || item.description || `Bild aus der Nähe von ${image.title}`,
                  gallery: item.gallery ?? true
                };
              })
              .filter((item: any) => item.distance <= maxRadius)
              .sort((a: any, b: any) => a.distance - b.distance)
              .slice(0, 300);
          }
        } else {
          nearby = (nearbyData || [])
            .filter((item: any) => item.id !== image.id)
            .map((item: any) => ({
              id: item.id,
              slug: item.slug,
              lat: item.lat,
              lon: item.lon,
              distance: item.distance,
              src: `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${item.path_512}`,
              srcHD: `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${item.path_2048}`,
              src64: item.path_64 ? `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-64/${item.path_64}` : `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${item.path_512}`,
              width: item.width,
              height: item.height,
              title: item.title || item.original_name || 'Bild',
              description: item.description || `Bild aus der Nähe von ${image.title}`,
              caption: item.caption || item.description || `Bild aus der Nähe von ${image.title}`,
              gallery: item.gallery ?? true
            }))
            .filter((item: any) => item.distance <= 2000)
            .slice(0, 300);
        }
      } catch (error) {
        console.error('[Nearby API] Error fetching nearby items:', error);
      }
    }

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
