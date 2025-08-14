import type { PageServerLoad } from './$types';
import { createClient } from '@supabase/supabase-js';
import { redirect, error } from '@sveltejs/kit';

const supabase = createClient(
  (process.env.PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL) as string,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string,
  {
    auth: { persistSession: false }
  }
);

// Funktion zur Umleitung spezifischer Städtenamen
function getRedirectSlug(slug: string): string | null {
  const cityMappings = {
    'altotting': 'altoetting',
    'muhldorf': 'muehldorf', 
    'toging': 'toeging',
    'neuotting': 'neuoetting',
    'wohrsee': 'woehrsee',
    'badhoring': 'badhöring'
  };

  // Prüfe, ob der Slug einen der alten Städtenamen enthält
  for (const [oldCity, newCity] of Object.entries(cityMappings)) {
    if (slug.includes(oldCity)) {
      const newSlug = slug.replace(oldCity, newCity);
      console.log('🔍 [DetailPage] City redirect:', oldCity, '->', newCity);
      console.log('🔍 [DetailPage] Slug redirect:', slug, '->', newSlug);
      return newSlug;
    }
  }
  
  return null;
}

// Funktion zur Prüfung auf bekannte falsche Slugs
function isKnownIncorrectSlug(slug: string): boolean {
  const incorrectWords = [
    'altotting',
    'muhldorf',
    'toging',
    'neuotting',
    'wohrsee',
    'badhoring',
    'sigrun'
  ];
  
  // Prüfe, ob der Slug einen der falschen Wörter enthält (case-insensitive)
  const slugLower = slug.toLowerCase();
  const hasIncorrectWord = incorrectWords.some(word => slugLower.includes(word.toLowerCase()));
  
  // Debug logging
  if (hasIncorrectWord) {
    console.log('🔍 [DetailPage] Incorrect word found in slug:', slug);
    incorrectWords.forEach(word => {
      if (slugLower.includes(word.toLowerCase())) {
        console.log(`🔍 [DetailPage] Found incorrect word: "${word}" in slug`);
      }
    });
  }
  
  return hasIncorrectWord;
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

export const load: PageServerLoad = async ({ params, url, depends }) => {
  const { slug } = params;
  
  // Mark dependency for proper invalidation (stable key)
  depends('app:item');
  
  // Load function called (debug removed)
  
  // Prüfe auf bekannte falsche Slugs VOR allem anderen
  if (isKnownIncorrectSlug(slug)) {
    console.log('🔍 [DetailPage] Known incorrect slug detected:', slug);
    console.log('🔍 [DetailPage] Slug contains incorrect pattern, returning 410 Gone');
    // Return 410 Gone with special headers to help Google understand this URL is permanently gone
    throw error(410, {
      message: 'Diese URL existiert nicht mehr aufgrund von Korrekturen in der Schreibweise.',
      slug: slug
    });
  } else {
    console.log('🔍 [DetailPage] Slug passed incorrect pattern check:', slug);
  }
  
  // Prüfe auf Städtenamen-Umleitung VOR der Datenbank-Abfrage
  const redirectSlug = getRedirectSlug(slug);
  if (redirectSlug) {
    // Found city redirect (debug removed)
    // Add additional headers for better SEO handling of redirects
    const response = redirect(301, `/item/${redirectSlug}`);
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    response.headers.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    return response;
  }
  
  try {
    // Erst versuchen, das Item mit dem ursprünglichen Slug zu finden
    let { data: image, error } = await supabase
      .from('items')
      .select('*')
      .eq('slug', slug)
      .or('is_private.eq.false,is_private.is.null');
    
    // Wenn nicht gefunden, versuche Umleitung von altem Slug zu neuem
    if (!image || image.length === 0) {
      // Item not found with original slug (debug removed)
    }
    
    // Supabase query result (debug removed)
    
    const img = Array.isArray(image) ? image[0] : image;
    
    // Processed image (debug removed)

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

    // Successfully loaded image (debug removed)

    // Lade das Profil des Erstellers
    let profile = null;
    let full_name = 'Culoca User';
    if (img?.profile_id) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', img.profile_id)
        .single();
      profile = profileData;
      if (profileData?.full_name) {
        full_name = profileData.full_name;
      }
    }

    // Nearby items are now loaded client-side to prevent Google from "stealing" nearby titles/descriptions
    // This prevents SEO issues where Google assigns nearby image titles to the main image
    let nearby: any[] = [];
    return {
      image: { ...img, profile, full_name },
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