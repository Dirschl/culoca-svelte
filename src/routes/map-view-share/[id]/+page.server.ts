import type { PageServerLoad } from './$types';
import { createClient } from '@supabase/supabase-js';
import { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export const load: PageServerLoad = async ({ params }) => {
  try {
    const { id } = params;
    
    console.log('Loading share data for ID:', id);
    
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
        ogImage: null,
        ogUrl: `https://culoca.com/map-view-share/${id}`
      };
    }
    
    console.log('Share data loaded:', shareData);
    
    // Use screenshot from database if available
    let ogImage = null;
    if (shareData.screenshot && shareData.screenshot.startsWith('data:image')) {
      ogImage = shareData.screenshot;
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
      ogImage: null,
      ogUrl: `https://culoca.com/map-view-share/${id}`
    };
  }
}; 