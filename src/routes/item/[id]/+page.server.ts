import type { PageServerLoad } from './$types';
import { createClient } from '@supabase/supabase-js';

// Use dedicated server-side client with Service Role key for unrestricted read access (RLS still applies)
const supabase = createClient(
  (process.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL) as string,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string,
  {
    auth: { persistSession: false }
  }
);

// Helper function to calculate distance between two points
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export const load: PageServerLoad = async ({ params }) => {
  const { id } = params;
  
  try {
    // Fetch image data server-side
    const { data: image, error } = await supabase
      .from('items')
      .select('*')
      .eq('id', id)
      .or('is_private.eq.false,is_private.is.null');
    const img = Array.isArray(image) ? image[0] : image;

    console.log('SSR loader fetched image:', img ? img.id : null);

    if (error) {
      return {
        image: null,
        error: error.message,
        nearby: []
      };
    }

    // Wenn kein Bild gefunden wurde
    if (!img) {
      return {
        image: null,
        error: 'Bild nicht gefunden',
        nearby: []
      };
    }

    // Fetch nearby items if image has GPS coordinates
    let nearby: any[] = [];
    if (img && img.lat && img.lon) {
      try {
        // Bounding box to reduce row count before distance calculation
        const maxRadius = 1000; // meters – initial radius; client can filter smaller later
        const degOffset = maxRadius / 111000; // rough deg per meter
        const latMin = img.lat - degOffset;
        const latMax = img.lat + degOffset;
        const lonMin = img.lon - degOffset;
        const lonMax = img.lon + degOffset;

        const pageSize = 1000;
        let offset = 0;
        let fetched: any[] = [];
        while (true) {
          const { data: batch, error: nearbyError } = await supabase
          .from('items')
          .select('id, path_512, path_2048, path_64, original_name, title, description, lat, lon, width, height, is_private, gallery')
          .not('lat', 'is', null)
          .not('lon', 'is', null)
          .not('path_512', 'is', null)
          .or('is_private.eq.false,is_private.is.null')
          .gte('lat', latMin)
          .lte('lat', latMax)
          .gte('lon', lonMin)
          .lte('lon', lonMax)
          .range(offset, offset + pageSize - 1);

          if (nearbyError) {
            console.error('Nearby fetch error:', nearbyError);
            break;
          }
          if (!batch || batch.length === 0) break;
          fetched = fetched.concat(batch);
          if (batch.length < pageSize) break;
          offset += pageSize;
        }

        nearby = fetched
            .filter((item: any) => item.id !== id && item.lat && item.lon)
            .map((item: any) => {
            const distance = getDistanceInMeters(img.lat, img.lon, item.lat, item.lon);
              return {
                id: item.id,
                lat: item.lat,
                lon: item.lon,
                distance,
                src: `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${item.path_512}`,
                srcHD: `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${item.path_2048}`,
                src64: item.path_64 ? `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-64/${item.path_64}` : `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${item.path_512}`,
                width: item.width,
                height: item.height,
                title: item.title || null,
                gallery: item.gallery ?? true
              };
            })
            .filter((item: any) => item.distance <= maxRadius)
          .sort((a: any, b: any) => a.distance - b.distance);
      } catch (nearbyErr) {
        console.error('Error fetching nearby items:', nearbyErr);
      }
    }

    return {
      image: img,
      error: null,
      nearby
    };
  } catch (err) {
    return {
      image: null,
      error: 'Failed to load image',
      nearby: []
    };
  }
}; 