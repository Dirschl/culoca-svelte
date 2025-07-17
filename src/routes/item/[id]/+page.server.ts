import type { PageServerLoad } from './$types';
import { supabase } from '$lib/supabaseClient';

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
      .single();

    if (error) {
      return {
        image: null,
        error: error.message,
        nearby: []
      };
    }

    // Fetch nearby items if image has GPS coordinates
    let nearby: any[] = [];
    if (image && image.lat && image.lon) {
      try {
        // Get all items with GPS coordinates
        const { data: allItems, error: nearbyError } = await supabase
          .from('items')
          .select('id, path_512, path_2048, path_64, original_name, title, description, lat, lon, width, height, is_private')
          .not('lat', 'is', null)
          .not('lon', 'is', null)
          .not('path_512', 'is', null)
          .or('is_private.eq.false,is_private.is.null'); // Only public items

        if (!nearbyError && allItems) {
          // Calculate distances and filter by radius (default 1000m)
          const maxRadius = 1000;
          nearby = allItems
            .filter((item: any) => item.id !== id && item.lat && item.lon)
            .map((item: any) => {
              const distance = getDistanceInMeters(image.lat, image.lon, item.lat, item.lon);
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
                title: item.title || null
              };
            })
            .filter((item: any) => item.distance <= maxRadius)
            .sort((a: any, b: any) => a.distance - b.distance); // Return all items within radius
        }
      } catch (nearbyErr) {
        console.error('Error fetching nearby items:', nearbyErr);
      }
    }

    return {
      image,
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