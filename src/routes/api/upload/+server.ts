import { json, error } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import { resizeJPG } from '$lib/image';
import sharp from 'sharp';
import * as exifr from 'exifr';
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

    // NEW: Allow profile_id to be passed explicitly from the client.
    const passedProfileId = form.get('profile_id') as string | null;

    if (!files.length) {
      throw error(400, 'No files received');
    }

    // Get current user (from Supabase auth cookie) – may be null when using anon key
    const { data: { user } } = await supabase.auth.getUser();
    
    // Debug: Log authentication status
    console.log('Auth check - User from cookie:', user ? user.id : 'null');
    
    // Check Authorization header as fallback
    const authHeader = request.headers.get('authorization');
    console.log('Auth header:', authHeader ? 'present' : 'missing');
    
    let authenticatedUser = user;
    
    if (!user && authHeader) {
      // Try to get user from token in Authorization header
      const token = authHeader.replace('Bearer ', '');
      const { data: { user: tokenUser }, error: tokenError } = await supabase.auth.getUser(token);
      if (tokenUser) {
        console.log('User from token:', tokenUser.id);
        authenticatedUser = tokenUser;
      } else {
        console.log('Token auth failed:', tokenError);
      }
    }
    
    if (!authenticatedUser) {
      throw error(401, 'Nicht angemeldet. Bitte zuerst einloggen.');
    }
    // Prefer value coming from form; fall back to authenticated user id, otherwise null
    const profile_id = passedProfileId || authenticatedUser?.id || null;

    const results = [];
    const successfulUploads: string[] = [];
    const failedUploads: string[] = [];
    const totalFiles = files.length;

    console.log(`=== UPLOAD START: Processing ${totalFiles} files ===`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`\n[${i + 1}/${totalFiles}] Processing file: ${file.name}`);
      
      try {
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
          // Get metadata from the original image
          const originalMetadata = await sharp(buf).metadata();
          width = originalMetadata.width || 2048;
          height = originalMetadata.height || 2048;
          
          console.log(`Original image dimensions: ${width} x ${height}`);
        } catch (metaError) {
          console.log('Failed to get original image metadata, using defaults');
        }

        // --- EXIF Daten auslesen (aktiviert) ---
        let lat: number | null = null;
        let lon: number | null = null;
        let title: string | null = null;
        let description: string | null = null;
        let keywords: string | null = null;
        let camera: string | null = null;
        let lens: string | null = null;

        let exif: any = null;
        try {
          exif = await exifr.parse(buf, { iptc: true });
          if (exif) {
            // GPS coordinates
            if (exif.latitude && exif.longitude) {
              lat = exif.latitude;
              lon = exif.longitude;
            }

            // Title - unterstützen mehrere Quellen (EXIF, IPTC)
            if (!title) {
              if (exif.ImageDescription) {
                title = exif.ImageDescription;
              } else if (exif.iptc && (exif.iptc as any).ObjectName) {
                title = (exif.iptc as any).ObjectName;
              } else if (exif['IPTC:ObjectName']) {
                title = exif['IPTC:ObjectName'];
              }
            }

            // Heuristische Suche: jedes Feld, das auf 'title' oder 'headline' endet
            if (!title) {
              for (const [k, v] of Object.entries(exif)) {
                const keyLower = k.toLowerCase();
                if (keyLower.endsWith('title') || keyLower.endsWith('headline') || keyLower.endsWith('objectname')) {
                  title = v as string;
                  break;
                }
              }
            }

            // Description - unterstützen mehrere Quellen (EXIF, IPTC)
            if (!description) {
              if (exif.iptc && (exif.iptc as any).CaptionAbstract) {
                description = (exif.iptc as any).CaptionAbstract;
              } else if (exif['IPTC:CaptionAbstract']) {
                description = exif['IPTC:CaptionAbstract'];
              }
            }

            // Camera info
            if (exif.Make && exif.Model) {
              camera = `${fixEncoding(exif.Make)} ${fixEncoding(exif.Model)}`;
            }

            // Lens info
            if (exif.LensModel) {
              lens = fixEncoding(exif.LensModel);
            }

            // Keywords – unterstützen mehrere Quellen (EXIF, IPTC)
            if (!keywords) {
              if (Array.isArray(exif.Keywords)) {
                keywords = exif.Keywords.join(', ');
              } else if (typeof exif.Keywords === 'string') {
                keywords = exif.Keywords;
              }
            }

            if (!keywords && exif.iptc && Array.isArray((exif.iptc as any).Keywords)) {
              keywords = (exif.iptc as any).Keywords.join(', ');
            }

            if (!keywords && typeof exif['IPTC:Keywords'] === 'string') {
              keywords = exif['IPTC:Keywords'];
            }
            // Heuristische Suche: jedes Feld, das auf 'keywords' endet und ein Array/String ist
            if (!keywords) {
              for (const [k, v] of Object.entries(exif)) {
                if (k.toLowerCase().endsWith('keywords')) {
                  if (Array.isArray(v)) {
                    keywords = (v as any).join(', ');
                  } else if (typeof v === 'string') {
                    keywords = v as string;
                  }
                  if (keywords) break;
                }
              }
            }

            keywords = fixEncoding(keywords);
          }
        } catch (exifErr) {
          console.warn('⚠️ EXIF parsing failed:', exifErr);
        }
        // --- ENDE EXIF ---

        // Wenn Keywords-String vorhanden → in Array umwandeln (Postgres text[] erwartet JS-Array)
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

        // --- Build condensed EXIF data to store as JSON ---
        const exifData: Record<string, any> = {};
        if (width && height) { exifData.ImageWidth = width; exifData.ImageHeight = height; }
        if (exif?.Make) exifData.Make = fixEncoding(exif.Make);
        if (exif?.Model) exifData.Model = fixEncoding(exif.Model);
        if (lens) exifData.LensModel = lens;
        if (exif?.Orientation) exifData.Orientation = exif.Orientation;
        if (exif?.ExposureTime) exifData.ExposureTime = exif.ExposureTime;
        if (exif?.FNumber) exifData.FNumber = exif.FNumber;
        if (exif?.ISO) exifData.ISO = exif.ISO;
        if (exif?.FocalLength) exifData.FocalLength = exif.FocalLength;
        if (exif?.ApertureValue) exifData.ApertureValue = exif.ApertureValue;
        if (exif?.DateTimeOriginal || exif?.CreateDate) {
          exifData.CreateDate = exif?.DateTimeOriginal || exif?.CreateDate;
        }
        if (exif?.Artist) exifData.Artist = fixEncoding(exif.Artist);
        if (exif?.Copyright) exifData.Copyright = fixEncoding(exif.Copyright);
        // Original file size in bytes
        exifData.FileSize = file.size;

        // Insert into database with both paths and EXIF data
        const dbRecord: any = {
          id,
          profile_id,
          user_id: authenticatedUser.id,
          path_512: filename,
          path_2048: upload2048Error ? null : filename,
          width,
          height,
          lat,
          lon,
          camera,
          lens,
          original_name: baseName,
          ...(keywordsArray ? { keywords: keywordsArray } : {}),
          exif_data: Object.keys(exifData).length ? exifData : null
        };

        // Füge EXIF-Felder nur hinzu, wenn sie nicht null sind
        if (title) dbRecord.title = title;
        if (description) dbRecord.description = description;
        if (camera) dbRecord.camera = camera;
        console.log('Inserting database record:', JSON.stringify(dbRecord, null, 2));
        
        // Versuche zuerst mit allen Feldern zu inserten
        let { data: dbData, error: dbError } = await supabase
          .from('images')
          .insert(dbRecord)
          .select()
          .single();

        // Falls das fehlschlägt, versuche es ohne EXIF-Felder
        if (dbError && (dbError.message.includes('column') || dbError.message.includes('does not exist'))) {
          console.log('EXIF fields not available, trying without them...');
          const fallbackRecord = {
            id,
            profile_id,
            user_id: authenticatedUser.id,
            path_512: filename,
            path_2048: upload2048Error ? null : filename,
            width,
            height,
            lat,
            lon,
            original_name: baseName,
            ...(keywordsArray ? { keywords: keywordsArray } : {}),
            exif_data: Object.keys(exifData).length ? exifData : null
          };
          
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('images')
            .insert(fallbackRecord)
            .select()
            .single();
            
          if (fallbackError) {
            console.error('Fallback insert also failed:', fallbackError);
            throw error(500, `Database error: ${fallbackError.message}`);
          }
          
          dbData = fallbackData;
          dbError = null;
          console.log('Successfully inserted without EXIF fields');
          
          // Füge eine Warnung hinzu, dass EXIF-Felder fehlen
          console.warn('⚠️ EXIF fields (title, description, keywords) are not available in the database. Please run the SQL script to add them.');
        }

        if (dbError) {
          console.error('Database error:', dbError);
          console.error('Failed record:', JSON.stringify(dbRecord, null, 2));
          console.error('Error details:', {
            message: dbError.message,
            details: dbError.details,
            hint: dbError.hint
          });
          // Clean up uploaded file if database insert fails
          await supabase.storage.from('images-512').remove([filename]);
          throw error(500, `Database error: ${dbError.message}`);
        }

        results.push(dbData);
        successfulUploads.push(file.name);
        console.log(`✅ Successfully processed: ${file.name}`);
        
      } catch (fileError) {
        console.error(`❌ Failed to process file: ${file.name}`, fileError);
        failedUploads.push(file.name);
        
        // Continue with next file instead of stopping the entire upload
        continue;
      }
    }

    // Upload Summary
    console.log(`\n=== UPLOAD SUMMARY ===`);
    console.log(`Total files: ${totalFiles}`);
    console.log(`Successful: ${successfulUploads.length}`);
    console.log(`Failed: ${failedUploads.length}`);
    
    if (successfulUploads.length > 0) {
      console.log(`\n✅ Successfully uploaded:`);
      successfulUploads.forEach((filename, index) => {
        console.log(`  ${index + 1}. ${filename}`);
      });
    }
    
    if (failedUploads.length > 0) {
      console.log(`\n❌ Failed uploads:`);
      failedUploads.forEach((filename, index) => {
        console.log(`  ${index + 1}. ${filename}`);
      });
    }

    return json({ 
      status: 'success', 
      message: `Successfully uploaded ${results.length} of ${totalFiles} images`,
      images: results,
      summary: {
        total: totalFiles,
        successful: successfulUploads.length,
        failed: failedUploads.length,
        successfulFiles: successfulUploads,
        failedFiles: failedUploads
      }
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
