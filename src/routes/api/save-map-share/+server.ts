import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import sharp from 'sharp';

// Validate environment variables
if (!VITE_SUPABASE_URL) {
  throw new Error('VITE_SUPABASE_URL is required');
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { title, description, params } = await request.json();
    
    console.log('Saving map share:', { title, description, params });
    
    // Validate required fields
    if (!params) {
      return json({ error: 'Missing required params' }, { status: 400 });
    }
    
    // Get current user if authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    console.log('Auth result:', { user: user?.id, error: authError });
    
    // Generate screenshot and save to bucket
    let screenshotUrl = null;
    try {
      const urlParams = new URLSearchParams(params);
      const lat = urlParams.get('lat');
      const lon = urlParams.get('lon');
      const zoom = urlParams.get('zoom');
      const mapType = urlParams.get('map_type');
      
      if (lat && lon) {
        screenshotUrl = await generateAndSaveScreenshot(lat, lon, zoom, mapType);
      }
    } catch (error) {
      console.error('Error generating screenshot:', error);
    }
    
    // Save to database with screenshot URL
    const insertData = {
      title: title || 'CULOCA - Map View Share',
      description: description || 'Map View Snippet - CULOCA.com',
      screenshot_url: screenshotUrl,
      params: params,
      created_by: user?.id || null,
      last_visit: new Date().toISOString()
    };
    
    console.log('Inserting data:', { ...insertData, hasScreenshot: !!screenshotUrl });
    
    const { data, error } = await supabase
      .from('map_shares')
      .insert(insertData)
      .select()
      .single();
    
    if (error) {
      console.error('Error saving map share:', error);
      return json({ error: 'Failed to save share' }, { status: 500 });
    }
    
    console.log('Share saved successfully:', data);
    
    return json({ 
      success: true, 
      shareId: data.id,
      shareUrl: `https://culoca.com/map-view-share/${data.id}`
    });
    
  } catch (error) {
    console.error('Error in save-map-share:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};

async function generateAndSaveScreenshot(lat: string, lon: string, zoom: string, mapType: string) {
  try {
    const width = 1200;
    const height = 630;
    
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f8f9fa"/>
        <rect x="0" y="0" width="100%" height="100%" fill="url(#mapGradient)"/>
        
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
        
        <circle cx="50%" cy="50%" r="8" fill="#ee7221" stroke="#ffffff" stroke-width="3"/>
        <circle cx="50%" cy="50%" r="3" fill="#ffffff"/>
        
        <text x="50%" y="85%" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#333" font-weight="bold">
          ${lat}, ${lon}
        </text>
        <text x="50%" y="95%" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#666">
          Zoom: ${zoom} | ${mapType === 'satellite' ? 'Satellit' : 'Standard'}
        </text>
        
        <text x="20" y="30" font-family="Arial, sans-serif" font-size="16" fill="#ee7221" font-weight="bold">
          CULOCA
        </text>
      </svg>
    `;
    
    const buffer = await sharp(Buffer.from(svg))
      .resize(width, height)
      .jpeg({ quality: 75 })
      .toBuffer();
    
    // Generate unique filename
    const timestamp = Date.now();
    const filename = `map-share-${timestamp}.jpg`;
    
    // Upload to bucket-map
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('bucket-map')
      .upload(filename, buffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600'
      });
    
    if (uploadError) {
      console.error('Error uploading screenshot:', uploadError);
      return null;
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('bucket-map')
      .getPublicUrl(filename);
    
    console.log('Screenshot saved to bucket:', urlData.publicUrl);
    return urlData.publicUrl;
    
  } catch (error) {
    console.error('Error generating and saving screenshot:', error);
    return null;
  }
} 