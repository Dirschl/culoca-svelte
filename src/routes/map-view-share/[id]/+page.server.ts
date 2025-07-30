import type { PageServerLoad } from './$types';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const load: PageServerLoad = async ({ params }) => {
  try {
    // Get share data from database
    const { data: shareData } = await supabase
      .from('map_shares')
      .select('*')
      .eq('id', params.id)
      .single();
    
    if (!shareData) {
      return {
        ogTitle: 'CULOCA - Map View Share',
        ogDescription: 'Map View Snippet - CULOCA.com',
        ogImage: '/culoca-logo-512px.png',
        ogUrl: 'https://culoca.com/map-view'
      };
    }
    
    // Convert base64 screenshot to data URL if it exists
    let ogImage = '/culoca-logo-512px.png';
    if (shareData.screenshot && shareData.screenshot.startsWith('data:image')) {
      ogImage = shareData.screenshot;
    }
    
    return {
      ogTitle: shareData.title || 'CULOCA - Map View Share',
      ogDescription: shareData.description || 'Map View Snippet - CULOCA.com',
      ogImage: ogImage,
      ogUrl: `https://culoca.com/map-view?${shareData.params}`,
      shareData
    };
  } catch (error) {
    console.error('Error loading share data:', error);
    return {
      ogTitle: 'CULOCA - Map View Share',
      ogDescription: 'Map View Snippet - CULOCA.com',
      ogImage: '/culoca-logo-512px.png',
      ogUrl: 'https://culoca.com/map-view'
    };
  }
}; 