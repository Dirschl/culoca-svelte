import type { PageServerLoad } from './$types';
import { createClient } from '@supabase/supabase-js';
import { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import sharp from 'sharp';

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
    
    // Generate screenshot dynamically based on params
    let ogImage = null;
    if (shareData.params) {
      try {
        // Parse params to get map coordinates
        const urlParams = new URLSearchParams(shareData.params);
        const lat = urlParams.get('lat');
        const lon = urlParams.get('lon');
        const zoom = urlParams.get('zoom');
        const mapType = urlParams.get('map_type');
        
        if (lat && lon) {
          // Generate a map preview using Sharp
          const mapPreview = await generateMapPreview(lat, lon, zoom, mapType);
          ogImage = mapPreview;
        }
      } catch (error) {
        console.error('Error generating screenshot:', error);
      }
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

async function generateMapPreview(lat: string, lon: string, zoom: string, mapType: string) {
  try {
    // Create a map preview using Sharp
    const width = 1200;
    const height = 630;
    
    // Create a map-like background with coordinates
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f8f9fa"/>
        <rect x="0" y="0" width="100%" height="100%" fill="url(#mapGradient)"/>
        
        <!-- Map grid pattern -->
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e0e0e0" stroke-width="1"/>
          </pattern>
          <linearGradient id="mapGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#f0f0f0;stop-opacity:1" />
          </linearGradient>
        </defs>
        
        <rect width="100%" height="100%" fill="url(#grid)"/>
        
        <!-- Center marker -->
        <circle cx="50%" cy="50%" r="8" fill="#ee7221" stroke="#ffffff" stroke-width="3"/>
        <circle cx="50%" cy="50%" r="3" fill="#ffffff"/>
        
        <!-- Coordinates text -->
        <text x="50%" y="85%" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#333" font-weight="bold">
          ${lat}, ${lon}
        </text>
        <text x="50%" y="95%" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#666">
          Zoom: ${zoom} | ${mapType === 'satellite' ? 'Satellit' : 'Standard'}
        </text>
        
        <!-- CULOCA branding -->
        <text x="20" y="30" font-family="Arial, sans-serif" font-size="16" fill="#ee7221" font-weight="bold">
          CULOCA
        </text>
      </svg>
    `;
    
    const buffer = await sharp(Buffer.from(svg))
      .resize(width, height)
      .jpeg({ quality: 75 })
      .toBuffer();
    
    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
    
  } catch (error) {
    console.error('Error generating map preview:', error);
    return null;
  }
} 