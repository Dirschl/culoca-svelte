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

// Entfernt: Keine Slug-Übersetzungen oder -Überprüfungen mehr
// Datenbank-Slugs sind IMMER korrekt und dürfen nicht geändert werden

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
  
  // Entfernt: Keine Slug-Überprüfungen oder -Umleitungen mehr
  // Alle Slugs werden direkt in der Datenbank gesucht
  
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
      
      // Check if this is a database error or truly non-existent slug
      if (error) {
        // Database error - use 404 (temporary problem)
        console.log('🔍 [DetailPage] Database error, using 404:', error);
        throw error(404, {
          message: 'Temporär nicht verfügbar - Datenbankfehler',
          slug: slug,
          dbError: error.message
        });
      } else {
        // Slug truly doesn't exist in database - use 410 (permanently gone)
        console.log('🔍 [DetailPage] Slug truly doesn\'t exist, using 410 Gone');
        throw error(410, {
          message: 'Diese URL existiert nicht mehr - falsch indexiert von Google',
          slug: slug
        });
      }
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