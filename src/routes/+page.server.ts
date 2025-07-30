import type { PageServerLoad } from './$types';
import { createClient } from '@supabase/supabase-js';
import { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

export const load: PageServerLoad = async ({ url }) => {
  // Get page parameter for pagination
  const page = parseInt(url.searchParams.get('page') || '1');
  const itemsPerPage = 50;
  const offset = (page - 1) * itemsPerPage;

  // SEO-Daten serverseitig laden
  const seo = {
    title: 'Culoca - Entdecke die Welt durch Fotos',
    description: 'Culoca ist eine Plattform zum Entdecken und Teilen von Fotos mit GPS-Daten. Erstelle deine eigene Fotogalerie und erkunde die Welt durch die Augen anderer.',
    keywords: 'Fotografie, GPS, Galerie, Bilder, Entdeckung, Culoca',
    author: 'Culoca',
    robots: 'index, follow',
    language: 'de',
    geoRegion: 'DE',
    geoPosition: '51.1657;10.4515',
    icbm: '51.1657, 10.4515',
    ogTitle: 'Culoca - Entdecke die Welt durch Fotos',
    ogDescription: 'Culoca ist eine Plattform zum Entdecken und Teilen von Fotos mit GPS-Daten. Erstelle deine eigene Fotogalerie und erkunde die Welt durch die Augen anderer.',
    ogImage: '/culoca-logo-512px.png',
    ogImageAlt: 'Culoca Logo',
    ogType: 'website',
    ogUrl: 'https://culoca.com',
    twitterCard: 'summary_large_image',
    twitterTitle: 'Culoca - Entdecke die Welt durch Fotos',
    twitterDescription: 'Culoca ist eine Plattform zum Entdecken und Teilen von Fotos mit GPS-Daten.',
    twitterImage: '/culoca-logo-512px.png',
    canonicalUrl: 'https://culoca.com'
  };

  // Serverseitig NewsFlash-Daten laden (neueste Bilder) für SEO
  let newsFlashItems = [];
  try {
    console.log(`[Server] Loading NewsFlash items for SEO (page ${page}, offset ${offset})...`);

    // Verwende die gleiche Logik wie NewsFlash, aber serverseitig mit Pagination
    const { data, error } = await supabase
      .from('items')
      .select('id, slug, lat, lon, path_512, path_2048, path_64, title, description, original_name, profile_id, is_private, created_at, width, height, gallery')
      .not('path_512', 'is', null)
      .eq('gallery', true) // Nur Galerie-Items
      .or('is_private.eq.false,is_private.is.null') // Nur öffentliche Items für SEO
      .order('created_at', { ascending: false })
      .range(offset, offset + itemsPerPage - 1);

    if (error) {
      console.error('[Server] Error loading NewsFlash items:', error);
    } else {
      console.log(`[Server] Successfully loaded NewsFlash items: ${data?.length || 0} (page ${page})`);
      console.log('[Server] First item:', data?.[0]);
      
      // Formatiere Items für NewsFlash
      newsFlashItems = (data || []).map(item => ({
        id: item.id,
        slug: item.slug,
        title: item.title,
        description: item.description,
        lat: item.lat,
        lon: item.lon,
        path_512: item.path_512,
        original_name: item.original_name,
        created_at: item.created_at
      }));
      
      console.log('[Server] Formatted items:', newsFlashItems.length);
      console.log('[Server] First formatted item:', newsFlashItems[0]);
    }
  } catch (error) {
    console.error('[Server] Unexpected error loading NewsFlash items:', error);
  }

  console.log('[Server] Returning data:', {
    seo: !!seo,
    newsFlashItems: newsFlashItems.length,
    page,
    offset
  });
  
  return {
    seo,
    newsFlashItems,
    page,
    totalPages: Math.ceil(2200 / itemsPerPage) // Approximate total pages
  };
};