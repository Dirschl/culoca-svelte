import type { PageServerLoad } from './$types';
import { createClient } from '@supabase/supabase-js';

// Disable caching for this page to ensure fresh data
export const csr = true;
export const ssr = true;

export const load: PageServerLoad = async ({ url, request }) => {
  // Get page parameter for pagination
  const page = parseInt(url.searchParams.get('page') || '1');
  const itemsPerPage = 50;
  
  // Bot detection for enhanced SEO
  const userAgent = request.headers.get('user-agent') || '';
  const isBot = userAgent.toLowerCase().includes('googlebot') ||
                userAgent.toLowerCase().includes('bingbot') ||
                userAgent.toLowerCase().includes('slurp') ||
                userAgent.toLowerCase().includes('duckduckbot') ||
                userAgent.toLowerCase().includes('facebookexternalhit') ||
                userAgent.toLowerCase().includes('twitterbot') ||
                userAgent.toLowerCase().includes('linkedinbot') ||
                userAgent.toLowerCase().includes('yandexbot') ||
                userAgent.toLowerCase().includes('baiduspider') ||
                userAgent.toLowerCase().includes('rogerbot') ||
                userAgent.toLowerCase().includes('dotbot') ||
                userAgent.toLowerCase().includes('ia_archiver') ||
                userAgent.toLowerCase().includes('google-inspectiontool') ||
                userAgent.toLowerCase().includes('inspectiontool');

  // Supabase client für serverseitige Daten
  const supabaseUrl = (process.env.PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL) as string;
  const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  // Newsflash-Daten serverseitig laden für Bots
  let newsFlashItems = [];
  let totalCount = 0;
  
  try {
    const { data, error } = await supabase.rpc('newsflash_items_postgis', {
      page_value: page - 1, // 0-basiert
      page_size_value: itemsPerPage,
      current_user_id: null, // Für Bots: alle öffentlichen Bilder
      mode: 'alle'
    });

    if (!error && data) {
      newsFlashItems = data.map(item => ({
        id: item.id,
        slug: item.slug,
        lat: item.lat,
        lon: item.lon,
        path_512: item.path_512,
        path_2048: item.path_2048, // Add 2048px path for better SEO
        width: item.width,
        height: item.height,
        title: item.title,
        description: item.description,
        original_name: item.original_name,
        created_at: item.created_at,
        accountname: item.accountname,
        full_name: item.full_name
      }));
      
      // Total count aus erstem Item extrahieren
      if (data.length > 0 && data[0].total_count) {
        totalCount = data[0].total_count;
      }
    }
  } catch (error) {
    console.error('[Server] Error loading newsflash items:', error);
  }

  // Welcome-Content serverseitig laden für Bots
  let welcomeContent: any = {};
  try {
    const { data, error } = await supabase
      .from('welcome_content')
      .select('*')
      .eq('is_active', true)
      .order('id');
    
    if (!error && data) {
      const content = data || [];
      welcomeContent = {
        greeting: content.find(item => item.section_key === 'greeting'),
        gps: content.find(item => item.section_key === 'gps_feature'),
        discover: content.find(item => item.section_key === 'discover')
      };
      console.log('[Server] Loaded welcome content for SSR:', Object.keys(welcomeContent));
    }
  } catch (error) {
    console.error('[Server] Error loading welcome content:', error);
  }

  // 3 echte zufällige Items über die gesamte Datenbank für WelcomeSection laden (für SEO)
  let featuredItems: any[] = [];
  try {
    // Verwende SQL RANDOM() für echte Zufälligkeit über gesamte Sammlung
    // Füge einen Timestamp hinzu um Caching zu vermeiden
    const timestamp = Date.now();
    console.log('[Server] Requesting random items at:', timestamp);
    
    const { data, error } = await supabase.rpc('get_random_items', {
      item_limit: 3
    });
    
    if (error) {
      console.error('[Server] Error with RPC, using direct query with RANDOM():', error);
      // Fallback: Direkte Query mit zufälligen IDs
      // Erst Gesamt-Count holen (ohne path_2048_og Filter)
      const { count } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .not('slug', 'is', null)
        .eq('is_private', false);
      
      console.log('[Server] Total public items count:', count);
      
      if (count && count > 3) {
        // Generiere 3 zufällige Offsets
        const randomOffsets = Array.from({ length: 3 }, () => 
          Math.floor(Math.random() * Math.max(1, count - 1))
        ).sort((a, b) => a - b); // Sortiere für bessere Performance
        
        console.log('[Server] Random offsets:', randomOffsets);
        
        // Lade Items an den zufälligen Positionen
        const promises = randomOffsets.map(offset => 
          supabase
            .from('items')
            .select('id, title, slug, description, path_2048_og, path_512, width, height')
            .not('slug', 'is', null)
            .eq('is_private', false)
            .order('created_at', { ascending: false })
            .range(offset, offset)
            .single()
        );
        
        const results = await Promise.all(promises);
        console.log('[Server] Query results:', results.map(r => ({ error: r.error, hasData: !!r.data })));
        
        const fallbackData = results
          .filter(r => !r.error && r.data)
          .map(r => r.data);
      
        if (fallbackData.length > 0) {
          featuredItems = fallbackData.map(item => ({
            id: item.id,
            slug: item.slug,
            title: item.title || 'Unbenanntes Item',
            description: item.description || '',
            path_2048_og: item.path_2048_og || item.path_512, // Fallback to path_512
            width: item.width,
            height: item.height
          }));
          console.log('[Server] Fallback featured items:', featuredItems);
        }
      }
    } else if (data && data.length > 0) {
      featuredItems = data.map((item: any) => ({
        id: item.id,
        slug: item.slug,
        title: item.title || 'Unbenanntes Item',
        description: item.description || '',
        path_2048_og: item.path_2048_og,
        width: item.width,
        height: item.height
      }));
      console.log('[Server] Loaded featured items for SEO:', featuredItems.length);
    }
  } catch (error) {
    console.error('[Server] Error loading featured items:', error);
  }

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

  console.log('[Server] Loading page data with SSR newsflash items:', newsFlashItems.length);
  console.log('[Server] Bot detection:', { isBot, userAgent: userAgent.substring(0, 100) });
  
  return {
    seo,
    newsFlashItems,
    welcomeContent,
    featuredItems,
    page,
    totalPages: Math.ceil(totalCount / itemsPerPage),
    totalCount,
    dbConnectionOk: true,
    isBot,
    userAgent: userAgent.substring(0, 100) // For debugging
  };
};