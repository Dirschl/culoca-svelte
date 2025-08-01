import type { PageServerLoad } from './$types';
import { createClient } from '@supabase/supabase-js';
import { redirect } from '@sveltejs/kit';

const supabase = createClient(
  (process.env.PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL) as string,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string,
  {
    auth: { persistSession: false }
  }
);

// Funktion zur Suche nach Items mit verschiedenen Slug-Varianten
async function findItemBySlugVariations(slug: string): Promise<any> {
  // Liste von möglichen Slug-Varianten basierend auf verschiedenen Umlaute-Behandlungen
  const slugVariations = [
    slug, // Original
    // Alte Umlaute-Behandlung (wie vor der Korrektur)
    slug.replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u').replace(/ss/g, '-'),
    // Neue Umlaute-Behandlung (aktuelle Korrektur)
    slug.replace(/a/g, 'ae').replace(/o/g, 'oe').replace(/u/g, 'ue').replace(/-/g, 'ss'),
    // Weitere Variationen
    slug.replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u'),
    slug.replace(/a/g, 'ae').replace(/o/g, 'oe').replace(/u/g, 'ue'),
    // Spezielle deutsche Umlaute - ß wurde zu - konvertiert
    slug.replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u').replace(/-/g, 'ss'),
    slug.replace(/a/g, 'ae').replace(/o/g, 'oe').replace(/u/g, 'ue').replace(/ss/g, '-'),
    // Zusätzliche Variationen für ß -> - Fall
    slug.replace(/ss/g, '-'),
    slug.replace(/-/g, 'ss'),
    // Kombinationen für komplexe Fälle
    slug.replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u').replace(/ss/g, '-').replace(/-/g, 'ss'),
    slug.replace(/a/g, 'ae').replace(/o/g, 'oe').replace(/u/g, 'ue').replace(/-/g, 'ss').replace(/ss/g, '-'),
  ];

  console.log('🔍 [DetailPage] Trying slug variations:', slugVariations);

  // Versuche jede Variation
  for (const variation of slugVariations) {
    if (variation === slug) continue; // Original bereits versucht
    
    const { data: image, error } = await supabase
      .from('items')
      .select('*')
      .eq('slug', variation)
      .or('is_private.eq.false,is_private.is.null');
    
    if (image && image.length > 0) {
      console.log('🔍 [DetailPage] Found item with slug variation:', variation);
      return image[0];
    }
  }
  
  return null;
}

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
    // Erst versuchen, das Item mit dem ursprünglichen Slug zu finden
    let { data: image, error } = await supabase
      .from('items')
      .select('*')
      .eq('slug', slug)
      .or('is_private.eq.false,is_private.is.null');
    
    // Wenn nicht gefunden, versuche Umleitung von altem Slug zu neuem
    if (!image || image.length === 0) {
      console.log('🔍 [DetailPage] Item not found with original slug, trying slug variations:', slug);
      
      // Suche nach Item mit verschiedenen Slug-Varianten
      const foundItem = await findItemBySlugVariations(slug);
      
      if (foundItem) {
        console.log('🔍 [DetailPage] Found item with slug variation, redirecting:', foundItem.slug);
        // Umleitung zur neuen URL
        throw redirect(301, `/item/${foundItem.slug}`);
      } else {
        console.log('🔍 [DetailPage] No item found with any slug variation');
      }
    }
    
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
        // NEU: Verwende PostGIS-Funktion für effiziente Nearby-Suche
        const { data: nearbyData, error: nearbyError } = await supabase.rpc('gallery_items_unified_postgis', {
          user_lat: img.lat,
          user_lon: img.lon,
          page_value: 0,
          page_size_value: 1000, // Alle Nearby-Items laden für Kartenansicht
          current_user_id: null, // Alle öffentlichen Items
          search_term: null, // Keine Suche für Nearby
          location_filter_lat: null, // Kein LocationFilter für Nearby
          location_filter_lon: null
        }, { head: false });

        if (nearbyError) {
          console.error('[DetailPage] PostGIS nearby error:', nearbyError);
          // Fallback auf alte Methode
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
        } else {
          // NEU: Verwende PostGIS-Ergebnisse
          console.log('[DetailPage] PostGIS nearby success, items:', nearbyData?.length || 0);
          
          nearby = (nearbyData || [])
            .filter((item: any) => item.id !== img.id) // Aktuelles Bild ausschließen
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
              title: item.title || null,
              gallery: item.gallery ?? true
            }))
            .filter((item: any) => item.distance <= 5000); // 5km Radius
        }
      } catch (nearbyErr) {
        console.error('[DetailPage] Nearby error:', nearbyErr);
      }
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