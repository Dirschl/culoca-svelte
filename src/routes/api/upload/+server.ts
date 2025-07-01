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
      
      // Prüfe die tatsächlichen Dimensionen der 2048px-Datei
      let jpg2048Width = 0;
      let jpg2048Height = 0;
      try {
        const meta2048 = await sharp(sizes.jpg2048).metadata();
        jpg2048Width = meta2048.width || 0;
        jpg2048Height = meta2048.height || 0;
        console.log(`DEBUG: 2048px resized image dimensions: ${jpg2048Width}x${jpg2048Height}`);
      } catch (e) {
        console.log('DEBUG: Fehler beim Auslesen der 2048px-Dimensionen:', e);
      }

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

      // --- EXIF Daten auslesen ---
      let lat = null, lon = null;
      let title = null, description = null, keywords = null;
      
      try {
        // GPS-Daten
        const gps = await exifr.gps(buf);
        if (gps && gps.latitude && gps.longitude) {
          lat = gps.latitude;
          lon = gps.longitude;
          console.log(`EXIF GPS: lat=${lat}, lon=${lon}`);
        }
        
        // Vollständige EXIF-Daten für Titel, Beschreibung, Keywords
        const exif = await exifr.parse(buf);
        if (exif) {
          // Titel aus verschiedenen EXIF-Feldern
          title = exif.ImageDescription || exif.DocumentName || exif.XPTitle || exif.Title || null;
          
          // Beschreibung aus verschiedenen EXIF-Feldern
          description = exif.UserComment || exif.ImageDescription || exif.XPComment || exif.Comment || null;
          
          // Keywords aus verschiedenen EXIF-Feldern
          keywords = exif.XPKeywords || exif.Keywords || exif.Subject || null;
          
          console.log(`EXIF extracted - Title: ${title}, Description: ${description}, Keywords: ${keywords}`);
        }
      } catch (e) {
        console.log('Error reading EXIF data:', e);
      }
      // --- ENDE EXIF ---

      // Upload to both storage buckets with same filename
      // Upload 2048px version
      console.log(`Uploading 2048px version: ${filename}`);
      const { error: upload2048Error } = await supabase.storage
        .from('images-2048')
        .upload(filename, sizes.jpg2048, { 
          contentType: 'image/jpeg',
          upsert: false
        });

      if (upload2048Error) {
        console.error('2048px upload failed:', upload2048Error);
      } else {
        console.log('2048px upload successful');
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

      // Insert into database with both paths and EXIF data
      const dbRecord: any = {
        id,
        path_512: filename,
        path_2048: upload2048Error ? null : filename,
        width,
        height,
        lat,
        lon
      };

      // Füge EXIF-Felder nur hinzu, wenn sie nicht null sind
      if (title) dbRecord.title = title;
      if (description) dbRecord.description = description;
      if (keywords) dbRecord.keywords = keywords;
      console.log('Inserting database record:', dbRecord);
      
      const { data: dbData, error: dbError } = await supabase
        .from('images')
        .insert(dbRecord)
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
