import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const supabaseUrl = (process.env.PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL)!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const POST: RequestHandler = async ({ params, request }) => {
  try {
    const { id } = params;
    // Token aus dem Header extrahieren
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    // Supabase-Client mit Service Role Key für Storage-Operationen
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // User prüfen mit separatem Client für Auth
    const authSupabase = createClient(supabaseUrl, (process.env.PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY)!, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    
    const { data: { user }, error: authError } = await authSupabase.auth.getUser();
    if (authError || !user) {
      return json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // Bilddaten holen (Service Role Key umgeht RLS)
    const { data: image, error: dbError } = await supabase
      .from('items')
      .select('*')
      .eq('id', id)
      .single();
    if (dbError || !image) {
      return json({ success: false, error: 'Image not found' }, { status: 404 });
    }
    // Berechtigung prüfen
    const isCreator = user.id === image.profile_id;
    const isDeveloper = user.id === '0ceb2320-0553-463b-971a-a0eef5ecdf09';
    if (!isCreator && !isDeveloper) {
      return json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    // Bilder rotieren
    const sizes = [
      { bucket: 'images-64', path: image.path_64 },
      { bucket: 'images-512', path: image.path_512 },
      { bucket: 'images-2048', path: image.path_2048 }
    ];
    let successCount = 0;
    let totalCount = 0;
    console.log('Starting rotation for image:', id);
    console.log('Available sizes:', sizes.filter(s => s.path).map(s => `${s.bucket}/${s.path}`));
    
    for (const size of sizes) {
      if (!size.path) {
        console.log(`Skipping ${size.bucket} - no path`);
        continue;
      }
      totalCount++;
      console.log(`Processing ${size.bucket}/${size.path}...`);
      
      try {
        // Download
        const { data: imageData, error: downloadError } = await supabase.storage
          .from(size.bucket)
          .download(size.path);
        if (downloadError) {
          console.error(`Download error for ${size.bucket}/${size.path}:`, downloadError);
          continue;
        }
        console.log(`Downloaded ${size.bucket}/${size.path}, size:`, imageData.size);
        
        // Rotate
        const buffer = Buffer.from(await imageData.arrayBuffer());
        console.log(`Original buffer size:`, buffer.length);
        
        const rotatedBuffer = await sharp(buffer)
          .rotate(270)
          .jpeg({ quality: 90 })
          .toBuffer();
        console.log(`Rotated buffer size:`, rotatedBuffer.length);
        
        // Upload
        const { error: uploadError } = await supabase.storage
          .from(size.bucket)
          .upload(size.path, rotatedBuffer, {
            upsert: true,
            contentType: 'image/jpeg'
          });
        if (uploadError) {
          console.error(`Upload error for ${size.bucket}/${size.path}:`, uploadError);
        } else {
          console.log(`Successfully rotated ${size.bucket}/${size.path}`);
          successCount++;
        }
      } catch (error) {
        console.error(`Error rotating ${size.bucket}/${size.path}:`, error);
      }
    }
    console.log(`Rotation complete: ${successCount}/${totalCount} images rotated`);
    
    // Return success even if only some images were rotated
    if (successCount > 0) {
      return json({ 
        success: true, 
        message: `Successfully rotated ${successCount}/${totalCount} images`,
        totalCount,
        successCount,
        sizes: sizes.filter(s => s.path).map(s => `${s.bucket}/${s.path}`)
      });
    } else {
      return json({ 
        success: false, 
        error: 'Failed to rotate any images',
        totalCount,
        successCount
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Rotation error:', error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}; 