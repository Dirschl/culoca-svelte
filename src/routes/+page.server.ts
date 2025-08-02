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

  // Load NewsFlash items for SEO
  console.log('[Server] Loading NewsFlash items for SEO (page 1, offset 0)...');
  
  // Use dedicated SQL function for NewsFlash with proper sorting
  const { data: newsFlashData, error: newsFlashError } = await supabase.rpc('newsflash_items_postgis', {
    page_value: 0, // First page
    page_size_value: 50, // First 50 items for SEO
    current_user_id: null, // For SEO only public items
    mode: 'aus' // Only public items for SEO
  });
  
  let newsFlashItems = [];
  if (newsFlashError) {
    console.error('[Server] Error loading NewsFlash items:', newsFlashError);
    newsFlashItems = [];
  } else {
    console.log('[Server] Successfully loaded NewsFlash items:', newsFlashData?.length || 0, '(page 1)');
    if (newsFlashData && newsFlashData.length > 0) {
      console.log('[Server] First item:', newsFlashData[0]);
    }
    
    // Format items for NewsFlash component
    const formattedItems = (newsFlashData || []).map(item => ({
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
    
    console.log('[Server] Formatted items:', formattedItems.length);
    if (formattedItems.length > 0) {
      console.log('[Server] First formatted item:', formattedItems[0]);
    }
    
    newsFlashItems = formattedItems;
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