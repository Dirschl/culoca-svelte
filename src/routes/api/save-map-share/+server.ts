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
    const { title, description, params, screenshot } = await request.json();
    
    console.log('Saving map share:', { title, description, params, hasScreenshot: !!screenshot });
    
    // Validate required fields
    if (!params) {
      return json({ error: 'Missing required params' }, { status: 400 });
    }
    
    // Get current user if authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    console.log('Auth result:', { user: user?.id, error: authError });
    
    // Save screenshot to bucket if provided
    let screenshotUrl = null;
    if (screenshot) {
      try {
        screenshotUrl = await saveScreenshotToBucket(screenshot);
      } catch (error) {
        console.error('Error saving screenshot to bucket:', error);
      }
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

async function saveScreenshotToBucket(base64Screenshot: string) {
  try {
    // Remove data URL prefix
    const base64Data = base64Screenshot.replace(/^data:image\/[a-z]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Generate unique filename
    const timestamp = Date.now();
    const filename = `map-share-${timestamp}.jpg`;
    
    // Upload to map-share bucket
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('map-share')
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
      .from('map-share')
      .getPublicUrl(filename);
    
    console.log('Screenshot saved to bucket:', urlData.publicUrl);
    return urlData.publicUrl;
    
  } catch (error) {
    console.error('Error saving screenshot to bucket:', error);
    return null;
  }
} 