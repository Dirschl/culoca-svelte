import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/supabaseClient';
import sharp from 'sharp';

export const POST: RequestHandler = async ({ params, request }) => {
  try {
    const { id } = params;
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // Check if user is the creator or developer
    const { data: image, error: dbError } = await supabase
      .from('items')
      .select('*')
      .eq('id', id)
      .single();

    if (dbError || !image) {
      return json({ success: false, error: 'Image not found' }, { status: 404 });
    }

    // Check permissions
    const isCreator = user.id === image.profile_id;
    const isDeveloper = user.id === '0ceb2320-0553-463b-971a-a0eef5ecdf09';
    
    if (!isCreator && !isDeveloper) {
      return json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    console.log('[Rotate API] Processing image:', id);

    // Rotate images for all three sizes
    const sizes = [
      { bucket: 'images-64', path: image.path_64 },
      { bucket: 'images-512', path: image.path_512 },
      { bucket: 'images-2048', path: image.path_2048 }
    ];

    let successCount = 0;
    let totalCount = 0;

    for (const size of sizes) {
      if (!size.path) continue;
      totalCount++;

      try {
        console.log(`[Rotate API] Processing ${size.bucket}/${size.path}`);
        
        // Download the image
        const { data: imageData, error: downloadError } = await supabase.storage
          .from(size.bucket)
          .download(size.path);

        if (downloadError) {
          console.error(`[Rotate API] Download error for ${size.bucket}/${size.path}:`, downloadError);
          continue;
        }

        // Convert ArrayBuffer to Buffer
        const buffer = Buffer.from(await imageData.arrayBuffer());

        // Rotate the image 90 degrees counterclockwise using sharp
        const rotatedBuffer = await sharp(buffer)
          .rotate(270) // 270 degrees = 90 degrees counterclockwise
          .jpeg({ quality: 90 })
          .toBuffer();

        // Upload the rotated image back to storage
        const { error: uploadError } = await supabase.storage
          .from(size.bucket)
          .upload(size.path, rotatedBuffer, {
            upsert: true,
            contentType: 'image/jpeg'
          });

        if (uploadError) {
          console.error(`[Rotate API] Upload error for ${size.bucket}/${size.path}:`, uploadError);
        } else {
          console.log(`[Rotate API] Successfully rotated ${size.bucket}/${size.path}`);
          successCount++;
        }
      } catch (error) {
        console.error(`[Rotate API] Error processing ${size.bucket}/${size.path}:`, error);
      }
    }

    if (successCount === 0) {
      return json({ success: false, error: 'Failed to rotate any images' }, { status: 500 });
    }

    return json({ 
      success: true, 
      message: `Successfully rotated ${successCount}/${totalCount} images` 
    });
  } catch (error) {
    console.error('[Rotate API] Unexpected error:', error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}; 