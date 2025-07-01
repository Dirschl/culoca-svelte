import { json, error } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import { resizeJPG } from '$lib/image';
import exifr from 'exifr';
import sharp from 'sharp';

export const POST = async ({ request }) => {
  try {
    const form = await request.formData();
    const files = form.getAll('files') as File[];

    if (!files.length) {
      throw error(400, 'No files received');
    }

    const results = [];

    for (const file of files) {
      console.log(`Processing file: ${file.name}`);
      
      const buf = Buffer.from(await file.arrayBuffer());
      const id = crypto.randomUUID();
      const filename = `${id}.jpg`;

      // Resize image to multiple sizes
      const sizes = await resizeJPG(buf);
      
      // Get ACTUAL dimensions of the original image
      let width = 2048;
      let height = 2048;
      
      try {
        // Get metadata from the original image
        const originalMetadata = await sharp(buf).metadata();
        width = originalMetadata.width || 2048;
        height = originalMetadata.height || 2048;
        
        console.log(`Original image dimensions: ${width} x ${height}`);
      } catch (metaError) {
        console.log('Failed to get original image metadata, using defaults');
      }

      // Upload to both storage buckets with same filename
      // Upload 2048px version
      const { error: upload2048Error } = await supabase.storage
        .from('images-2048')
        .upload(filename, sizes.jpg2048, { 
          contentType: 'image/jpeg',
          upsert: false
        });

      if (upload2048Error) {
        console.warn('2048px upload failed:', upload2048Error);
      }

      // Upload 512px version
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('images-512')
        .upload(filename, sizes.jpg512, { 
          contentType: 'image/jpeg',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw error(500, `Upload failed: ${uploadError.message}`);
      }

      // Insert into database with both paths
      const { data: dbData, error: dbError } = await supabase
        .from('images')
        .insert({
          id,
          path_512: filename,
          path_2048: upload2048Error ? null : filename,
          width,
          height,
        })
        .select()
        .single();

      if (dbError) {
        console.error('Database error:', dbError);
        // Clean up uploaded file if database insert fails
        await supabase.storage.from('images-512').remove([filename]);
        throw error(500, `Database error: ${dbError.message}`);
      }

      results.push(dbData);
      console.log(`Successfully processed: ${file.name}`);
    }

    return json({ 
      status: 'success', 
      message: `Successfully uploaded ${results.length} images`,
      images: results
    });

  } catch (err) {
    console.error('Upload error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Upload failed';
    const statusCode = (err as any)?.status || 500;
    return json({ 
      status: 'error', 
      message: errorMessage 
    }, { status: statusCode });
  }
};
