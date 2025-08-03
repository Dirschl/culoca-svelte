import type { PageServerLoad } from './$types';
import { createClient } from '@supabase/supabase-js';

// Use environment variables with fallbacks for build process
const supabaseUrl = (typeof process !== 'undefined' && process.env?.PUBLIC_SUPABASE_URL) || 
                   (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
                   (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_SUPABASE_URL) ||
                   (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
                   'https://caskhmcbvtevdwsolvwk.supabase.co';

const supabaseServiceKey = (typeof process !== 'undefined' && process.env?.SUPABASE_SERVICE_ROLE_KEY) ||
                          (typeof import.meta !== 'undefined' && import.meta.env?.SUPABASE_SERVICE_ROLE_KEY);

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const load: PageServerLoad = async ({ params }) => {
  try {
    const { id } = params;
    
    console.log('Loading share data for ID:', id);
    
    // Update last_visit timestamp
    await supabase
      .from('map_shares')
      .update({ last_visit: new Date().toISOString() })
      .eq('id', id);
    
    // Fetch share data from database
    const { data: shareData, error } = await supabase
      .from('map_shares')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('Database error:', error);
      return {
        ogTitle: 'CULOCA - Map View Share',
        ogDescription: 'Map View Snippet - CULOCA.com',
        ogImage: 'https://culoca.com/culoca-see-you-local-map-view.jpg',
        ogUrl: `https://culoca.com/map-view-share/${id}`,
        mapParams: null
      };
    }
    
    console.log('Share data loaded:', shareData);
    
    // Use screenshot URL from database or fallback
    let ogImage = 'https://culoca.com/culoca-see-you-local-map-view.jpg'; // Default fallback
    if (shareData.screenshot_url) {
      ogImage = shareData.screenshot_url;
    }
    
    return {
      ogTitle: shareData.title || 'CULOCA - Map View Share',
      ogDescription: shareData.description || 'Map View Snippet - CULOCA.com',
      ogImage: ogImage,
      ogUrl: `https://culoca.com/map-view-share/${id}`,
      mapParams: shareData.params || null
    };
    
  } catch (error) {
    console.error('Error in load function:', error);
    return {
      ogTitle: 'CULOCA - Map View Share',
      ogDescription: 'Map View Snippet - CULOCA.com',
      ogImage: 'https://culoca.com/culoca-see-you-local-map-view.jpg',
      ogUrl: `https://culoca.com/map-view-share/${id}`,
      mapParams: null
    };
  }
}; 