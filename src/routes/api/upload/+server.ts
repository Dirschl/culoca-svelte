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

      // Resize image to 512px for gallery
      const sizes = await resizeJPG(buf);
      
      // Get ACTUAL dimensions of the processed 512px image
      let width = 512;
      let height = 512;
      
      try {
        // Get metadata from the processed 512px image
        const metadata = await sharp(sizes.jpg512).metadata();
        width = metadata.width || 512;
        height = metadata.height || 512;
        
        console.log(`Processed image dimensions: ${width} x ${height}`);
      } catch (metaError) {
        console.log('Failed to get processed image metadata, using defaults');
      }

      // Upload to both storage buckets
      const filename2048 = `${id}_2048.jpg`;
      
      // Upload 2048px version
      const { error: upload2048Error } = await supabase.storage
        .from('images-2048')
        .upload(filename2048, sizes.jpg2048, { 
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
          path_2048: upload2048Error ? null : filename2048,
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
