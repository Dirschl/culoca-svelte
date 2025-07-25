import type { PageServerLoad } from './$types';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  (process.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL) as string,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string,
  {
    auth: { persistSession: false }
  }
);

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

export const load: PageServerLoad = async ({ params, url }) => {
  const { slug } = params;
  console.log('🔍 [DetailPage] Loading item with slug:', slug);
  
  try {
    // Fetch image data by slug
    const { data: image, error } = await supabase
      .from('items')
      .select('*')
      .eq('slug', slug)
      .or('is_private.eq.false,is_private.is.null');
    
    console.log('🔍 [DetailPage] Supabase query result:', { 
      hasData: !!image, 
      dataLength: Array.isArray(image) ? image.length : (image ? 1 : 0),
      error: error?.message,
      slug
    });
    
    const img = Array.isArray(image) ? image[0] : image;
    
    console.log('🔍 [DetailPage] Processed image:', { 
      hasImage: !!img, 
      imageId: img?.id,
      imageTitle: img?.title,
      imageSlug: img?.slug
    });

    if (error) {
      console.error('🔍 [DetailPage] Supabase error:', error);
      return {
        image: null,
        error: error.message,
        nearby: []
      };
    }
    if (!img) {
      console.log('🔍 [DetailPage] No image found for slug:', slug);
      return {
        image: null,
        error: 'Bild nicht gefunden',
        nearby: []
      };
    }

    console.log('🔍 [DetailPage] Successfully loaded image:', { 
      id: img.id, 
      title: img.title, 
      slug: img.slug 
    });

    // Lade das Profil des Erstellers
    let profile = null;
    if (img?.profile_id) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', img.profile_id)
        .single();
      profile = profileData;
    }

    // Fetch nearby items if image has GPS coordinates
    let nearby: any[] = [];
    if (img && img.lat && img.lon) {
      try {
        const maxRadius = 5000;
        const degOffset = maxRadius / 111000;
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
            .select('id, slug, path_512, path_2048, path_64, original_name, title, description, lat, lon, width, height, is_private, gallery')
            .not('lat', 'is', null)
            .not('lon', 'is', null)
            .not('path_512', 'is', null)
            .or('is_private.eq.false,is_private.is.null')
            .gte('lat', latMin)
            .lte('lat', latMax)
            .gte('lon', lonMin)
            .lte('lon', lonMax)
            .range(offset, offset + pageSize - 1);
          if (nearbyError) break;
          if (!batch || batch.length === 0) break;
          fetched = fetched.concat(batch);
          if (batch.length < pageSize) break;
          offset += pageSize;
        }
        nearby = fetched
          .filter((item: any) => item.slug !== img.id && item.lat && item.lon)
          .map((item: any) => {
            const distance = getDistanceInMeters(img.lat, img.lon, item.lat, item.lon);
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
              title: item.title || null,
              gallery: item.gallery ?? true
            };
          })
          .filter((item: any) => item.distance <= maxRadius)
          .sort((a: any, b: any) => a.distance - b.distance);
      } catch (nearbyErr) {}
    }
    return {
      image: { ...img, profile },
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