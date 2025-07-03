import { json, error } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import { resizeJPG } from '$lib/image';
import sharp from 'sharp';
import { Buffer } from 'buffer';

// -- Helper: fix IPTC strings that were decoded as Latin-1 instead of UTF-8
function fixEncoding(str: string | null): string | null {
  if (!str) return str;
  // Heuristic: if the string contains the replacement pattern "Ã" it is likely mis-decoded
  if (str.includes('Ã')) {
    try {
      return Buffer.from(str, 'latin1').toString('utf8');
    } catch { /* ignore */ }
  }
  return str;
}

export const POST = async ({ request }) => {
  try {
    const form = await request.formData();
    const files = form.getAll('files') as File[];
    const passedProfileId = form.get('profile_id') as string | null;
    if (!files.length) {
      throw error(400, 'No files received');
    }
    const results = [];
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw error(401, 'Nicht angemeldet. Bitte zuerst einloggen.');
    }
    const profile_id = passedProfileId || user?.id || null;
    for (const file of files) {
      console.log(`Processing file: ${file.name}`);
      const buf = Buffer.from(await file.arrayBuffer());
      const id = crypto.randomUUID();
      const filename = `${id}.jpg`;
      const baseName = file.name.replace(/\.[^/.]+$/, '');
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
        const originalMetadata = await sharp(buf).metadata();
        width = originalMetadata.width || 2048;
        height = originalMetadata.height || 2048;
        console.log(`Original image dimensions: ${width} x ${height}`);
      } catch (metaError) {
        console.log('Failed to get original image metadata, using defaults');
      }
      // --- EXIF-Logik entfernt ---
      // Die Metadaten werden nicht mehr aus EXIF gelesen
      // Stattdessen: Lese Metadaten ggf. aus FormData oder anderen Quellen
      // Beispiel: (hier als Platzhalter, ggf. anpassen)
      let lat = form.get('lat') ? Number(form.get('lat')) : null;
      let lon = form.get('lon') ? Number(form.get('lon')) : null;
      let title = form.get('title') as string | null;
      let description = form.get('description') as string | null;
      let keywords = form.get('keywords') as string | null;
      let camera = form.get('camera') as string | null;
      let lens = form.get('lens') as string | null;
      // Keywords-Array für Postgres
      let keywordsArray: string[] | null = null;
      if (keywords) {
        keywordsArray = keywords.split(',').map((k) => k.trim()).filter(Boolean);
      }
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
      // Insert into database
      const dbRecord: any = {
        id,
        profile_id,
        path_512: filename,
        path_2048: upload2048Error ? null : filename,
        width,
        height,
        lat,
        lon,
        camera,
        lens,
        original_name: baseName,
        ...(keywordsArray ? { keywords: keywordsArray } : {})
      };
      if (title) dbRecord.title = title;
      if (description) dbRecord.description = description;
      if (camera) dbRecord.camera = camera;
      console.log('Inserting database record:', JSON.stringify(dbRecord, null, 2));
      let { data: dbData, error: dbError } = await supabase
        .from('images')
        .insert(dbRecord)
        .select()
        .single();
      if (dbError) {
        console.error('Database error:', dbError);
        console.error('Failed record:', JSON.stringify(dbRecord, null, 2));
        console.error('Error details:', {
          message: dbError.message,
          details: dbError.details,
          hint: dbError.hint
        });
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
