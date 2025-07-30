import type { PageServerLoad } from './$types';
import { createClient } from '@supabase/supabase-js';
import { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
        ogUrl: `https://culoca.com/map-view-share/${id}`
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
      ogUrl: `https://culoca.com/map-view-share/${id}`
    };
    
  } catch (error) {
    console.error('Error in load function:', error);
    return {
      ogTitle: 'CULOCA - Map View Share',
      ogDescription: 'Map View Snippet - CULOCA.com',
      ogImage: 'https://culoca.com/culoca-see-you-local-map-view.jpg',
      ogUrl: `https://culoca.com/map-view-share/${id}`
    };
  }
}; 