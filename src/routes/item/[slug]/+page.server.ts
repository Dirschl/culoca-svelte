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
    let { data: image, error: dbError } = await supabase
      .from('items')
      .select('*')
      .eq('slug', slug)
      .or('is_private.eq.false,is_private.is.null');
    
    console.log('🔍 [DetailPage] Database query result:', { slug, image, dbError });
    
    // Wenn nicht gefunden, versuche Umleitung von altem Slug zu neuem
    if (!image || image.length === 0) {
      console.log('🔍 [DetailPage] No image found in database for slug:', slug);
    }
    
    // Supabase query result (debug removed)
    
    const img = Array.isArray(image) ? image[0] : image;
    console.log('🔍 [DetailPage] Processed image object:', img);
    
    // Processed image (debug removed)

    if (dbError) {
      console.error('🔍 [DetailPage] Supabase error:', dbError);
      return {
        image: null,
        error: dbError.message,
        nearby: []
      };
    }
    if (!img) {
      console.log('🔍 [DetailPage] No image found for slug:', slug);
      console.log('🔍 [DetailPage] Error object:', dbError);
      console.log('🔍 [DetailPage] Image array:', image);
      
      // Check if this is a database error or truly non-existent slug
      if (dbError) {
        // Database error - use 404 (temporary problem)
        console.log('🔍 [DetailPage] Database error, using 404:', dbError);
        throw error(404, {
          message: 'Temporär nicht verfügbar - Datenbankfehler',
          slug: slug,
          dbError: dbError.message
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

    // Lightweight internal linking for crawlers/users:
    // previous/next public item by created_at for a stable crawl graph
    let seoLinks: { newer: { slug: string; title: string | null } | null; older: { slug: string; title: string | null } | null } = {
      newer: null,
      older: null
    };

    if (img?.created_at) {
      const { data: newerItem } = await supabase
        .from('items')
        .select('slug, title, created_at')
        .not('slug', 'is', null)
        .not('path_512', 'is', null)
        .or('is_private.eq.false,is_private.is.null')
        .gt('created_at', img.created_at)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      const { data: olderItem } = await supabase
        .from('items')
        .select('slug, title, created_at')
        .not('slug', 'is', null)
        .not('path_512', 'is', null)
        .or('is_private.eq.false,is_private.is.null')
        .lt('created_at', img.created_at)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      seoLinks = {
        newer: newerItem ? { slug: newerItem.slug, title: newerItem.title } : null,
        older: olderItem ? { slug: olderItem.slug, title: olderItem.title } : null
      };
    }
    
    return {
      image: { ...img, profile, full_name },
      error: null,
      nearby,
      seoLinks
    };
  } catch (err) {
    console.error('🔍 [DetailPage] Unexpected error:', err);
    // Re-throw the error instead of returning null image
    throw err;
  }
}; 
