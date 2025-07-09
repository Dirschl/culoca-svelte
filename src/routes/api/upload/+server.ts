import { json, error } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import { resizeJPG, getImageQualitySettings } from '$lib/image';
import sharp from 'sharp';
import * as exifr from 'exifr';
import { Buffer } from 'buffer';
import { createClient } from 'webdav';
import dotenv from 'dotenv';
dotenv.config();

// -- Helper: fix IPTC strings that were decoded as Latin-1 instead of UTF-8
function fixEncoding(str: string | null): string | null {
  if (!str) return str;
  
  // Einfache, saubere UTF-8 Konvertierung
  try {
    // Wenn der String Umlaut-Probleme hat, konvertiere von Latin1 zu UTF-8
    if (str.includes('Ã')) {
      const fixed = Buffer.from(str, 'latin1').toString('utf8');
      console.log('🔧 Fixed encoding:', str, '->', fixed);
      return fixed;
    }
  } catch (e) {
    console.log('🔧 Encoding fix failed for:', str);
  }
  
  return str;
}

export const POST = async ({ request }) => {
  try {
    console.log('=== UPLOAD API CALLED ===');
    console.log('🔍 DEBUG: Environment variables check:');
    console.log('  VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? 'SET' : 'NOT SET');
    console.log('  VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');
    console.log('  NODE_ENV:', process.env.NODE_ENV);
    console.log('  VERCEL_URL:', process.env.VERCEL_URL);
    
    const form = await request.formData();
    const files = form.getAll('files') as File[];

    // NEW: Allow profile_id to be passed explicitly from the client.
    const passedProfileId = form.get('profile_id') as string | null;

    if (!files.length) {
      console.log('No files received');
      throw error(400, 'No files received');
    }

    console.log(`Received ${files.length} files`);

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
      console.log('No authenticated user found');
      throw error(401, 'Nicht angemeldet. Bitte zuerst einloggen.');
    }
    
    console.log('Authenticated user:', authenticatedUser.id);
    console.log('User details:', {
      id: authenticatedUser.id,
      email: authenticatedUser.email,
      role: authenticatedUser.role
    });
    
    // Prefer value coming from form; fall back to authenticated user id, otherwise null
    const profile_id = passedProfileId || authenticatedUser?.id || null;
    console.log('Using profile_id:', profile_id);

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
        const baseName = file.name; // Vollständiger Dateiname mit Endung

        // Load user's save_originals setting from database
        let saveOriginals = true;
        
        // Get settings from FormData (sent by frontend) - legacy support
        const formImageFormat = form.get('user_image_format') as string;
        const formImageQuality = form.get('user_image_quality') as string;
        
        // Debug: Log all FormData entries BEFORE consuming them
        console.log('🔍 DEBUG: All FormData entries:');
        const formEntries = Array.from(form.entries());
        for (const [key, value] of formEntries) {
          console.log(`  ${key}: ${value}`);
        }
        
        console.log('🔍 DEBUG: FormData received:', {
          formImageFormat,
          formImageQuality,
          allFormData: formEntries
        });
        
        console.log(`🔍 DEBUG: Legacy FormData settings (ignored): format=${formImageFormat}, quality=${formImageQuality}`);
        
        // ALWAYS load from database to ensure we get the correct settings
        try {
          console.log('🔍 DEBUG: Loading profile from database...');
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('save_originals')
            .eq('id', authenticatedUser.id)
            .maybeSingle();
          
          if (profileError) {
            console.log('🔍 DEBUG: Profile query error:', profileError);
          }
          
          if (profileData) {
            console.log('🔍 DEBUG: Profile data from database:', profileData);
            // Use save_originals setting from database
            if (typeof profileData.save_originals === 'boolean') {
              saveOriginals = profileData.save_originals;
            }
            console.log(`🔍 DEBUG: Final save_originals setting from database: ${saveOriginals}`);
          } else {
            console.log('🔍 DEBUG: No profile data found, using defaults');
          }
        } catch (profileError) {
          console.log('🔍 DEBUG: Could not load user profile settings, using defaults:', profileError);
        }

        // 1. Prüfe, ob das Original gespeichert werden soll (Profil-Einstellung)
        try {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('save_originals')
            .eq('id', authenticatedUser.id)
            .maybeSingle();
          if (profileData && typeof profileData.save_originals === 'boolean') {
            saveOriginals = profileData.save_originals;
          }
        } catch (e) {
          // Default bleibt true
        }

        // 2. Original ggf. in Supabase 'originals' speichern
        let originalSupabasePath = null;
        if (saveOriginals) {
          try {
            const { error: origError } = await supabase.storage
              .from('originals')
              .upload(`${id}.jpg`, buf, {
                contentType: file.type || 'image/jpeg',
                upsert: false
              });
            if (!origError) {
              originalSupabasePath = `${id}.jpg`;
              console.log('✅ Original erfolgreich in Supabase gespeichert:', originalSupabasePath);
            } else {
              console.error('❌ Fehler beim Upload des Originals zu Supabase:', origError);
            }
          } catch (e) {
            console.error('❌ Fehler beim Upload des Originals zu Supabase:', e);
          }
        }

        // Resize image to multiple sizes with environment-based settings
        console.log('🔍 DEBUG: About to call resizeJPG with environment-based settings');
        
        const sizes = await resizeJPG(buf);
        
        console.log('🔍 DEBUG: resizeJPG returned keys:', Object.keys(sizes));
        console.log('🔍 DEBUG: sizes object:', sizes);
        
        // Get quality settings to determine correct filenames
        const qualitySettings = getImageQualitySettings();
        
        // Get ACTUAL dimensions of the original image
        let width = 2048;
        let height = 2048;
        
        try {
          // Get metadata from the original image
          const originalMetadata = await sharp(buf).metadata();
          width = originalMetadata.width || 2048;
          height = originalMetadata.height || 2048;
        } catch (metaError) {
          // Use defaults if metadata extraction fails
        }

        // --- EXIF Daten auslesen ---
        let lat: number | null = null;
        let lon: number | null = null;
        let title: string | null = null;
        let description: string | null = null;
        let keywords: string | null = null;
        let camera: string | null = null;
        let lens: string | null = null;

        // Check for manual input from FormData (bulk upload)
        const formTitle = form.get('title') as string;
        const formDescription = form.get('description') as string;
        const formKeywords = form.get('keywords') as string;
        const formLat = form.get('lat') as string;
        const formLon = form.get('lon') as string;

        if (formTitle) title = formTitle;
        if (formDescription) description = formDescription;
        if (formKeywords) keywords = formKeywords;
        if (formLat && formLon) {
          lat = parseFloat(formLat);
          lon = parseFloat(formLon);
        }

        let exif: any = null;
        try {
          exif = await exifr.parse(buf, { iptc: true });
          if (exif) {
            // GPS coordinates
            if (exif.latitude && exif.longitude) {
              lat = exif.latitude;
              lon = exif.longitude;
            }

            // Title - IPTC Headline hat Priorität, dann andere Quellen
            if (!title) {
              // KORREKTUR: IPTC Headline hat höchste Priorität
              if (exif['IPTC:Headline']) {
                title = fixEncoding(exif['IPTC:Headline']);
              } else if (exif.iptc && (exif.iptc as any).Headline) {
                title = fixEncoding((exif.iptc as any).Headline);
              } else if (exif.iptc && (exif.iptc as any).ObjectName) {
                title = fixEncoding((exif.iptc as any).ObjectName);
              } else if (exif['IPTC:ObjectName']) {
                title = fixEncoding(exif['IPTC:ObjectName']);
              }
              // ENTFERNT: ImageDescription wird nicht mehr als title verwendet!
              // ImageDescription ist eine Beschreibung, kein Titel
            }

            // Heuristische Suche: jedes Feld, das auf 'title' oder 'headline' endet
            if (!title) {
              for (const [k, v] of Object.entries(exif)) {
                const keyLower = k.toLowerCase();
                if (keyLower.endsWith('title') || keyLower.endsWith('headline') || keyLower.endsWith('objectname')) {
                  title = fixEncoding(v as string);
                  break;
                }
              }
            }

            // Description - IPTC Description hat Priorität, dann andere Quellen
            if (!description) {
              if (exif['IPTC:Description']) {
                description = fixEncoding(exif['IPTC:Description']);
              } else if (exif.iptc && (exif.iptc as any).Description) {
                description = fixEncoding((exif.iptc as any).Description);
              } else if (exif.iptc && (exif.iptc as any).CaptionAbstract) {
                description = fixEncoding((exif.iptc as any).CaptionAbstract);
              } else if (exif['IPTC:CaptionAbstract']) {
                description = fixEncoding(exif['IPTC:CaptionAbstract']);
              } else if (exif.ImageDescription) {
                // ImageDescription ist eine Beschreibung, nicht ein Titel
                description = fixEncoding(exif.ImageDescription);
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
          console.warn('EXIF parsing failed:', exifErr);
        }

        // Wenn Keywords-String vorhanden → in Array umwandeln (Postgres text[] erwartet JS-Array)
        let keywordsArray: string[] | null = null;
        if (keywords) {
          keywordsArray = keywords.split(',').map((k) => k.trim()).filter(Boolean);
          // Begrenze Keywords auf maximal 20 Stück, um Check-Constraint-Probleme zu vermeiden
          if (keywordsArray.length > 20) {
            keywordsArray = keywordsArray.slice(0, 20);
            console.log('⚠️ Keywords truncated to 20 items to avoid constraint violation');
          }
        }

        // --- Fallback-Logik für title und description ---
        // KORREKTUR: Wenn title zu lang ist (wie eine Beschreibung), könnte es ein Fehler sein
        if (title && title.length > 100 && !description) {
          description = title;
          title = baseName;
        }
        
        // Fallback für title: Dateiname verwenden, wenn kein Titel gefunden wurde
        if (!title) {
          title = baseName;
        }
        
        // Sicherheitskürzung: Titel auf 200 Zeichen begrenzen (statt 255 für Sicherheit)
        if (title && title.length > 200) {
          title = title.slice(0, 200);
          console.log('⚠️ Truncated title to 200 chars:', title);
        }
        
        // Sicherheitskürzung: Beschreibung auf 200 Zeichen begrenzen (statt 255 für Sicherheit)
        if (description && description.length > 200) {
          description = description.slice(0, 200);
          console.log('⚠️ Truncated description to 200 chars:', description);
        }

        // Upload to storage bucket (all formats are jpg now)
        let upload2048Error = null;
        let uploadFilename = filename;
        
        console.log(`📸 Uploading 2048px version: ${uploadFilename} (format: jpg)`);
        
        try {
          const { error: error2048 } = await supabase.storage
            .from('images-2048')
            .upload(uploadFilename, sizes.jpg2048, { 
              contentType: 'image/jpeg',
              upsert: false
            });
          upload2048Error = error2048;
        } catch (storageError) {
          console.error('Storage upload error (2048px):', storageError);
          upload2048Error = storageError;
        }

        if (upload2048Error) {
          console.error('2048px upload failed:', upload2048Error);
        } else {
          console.log('2048px upload successful');
        }

        // Upload 512px version
        let uploadError = null;
        let uploadData = null;
        
        console.log(`📸 Uploading 512px version: ${filename} (format: jpg)`);
        
        try {
          const { data, error } = await supabase.storage
            .from('images-512')
            .upload(filename, sizes.jpg512, { 
              contentType: 'image/jpeg',
              upsert: false
            });
          uploadData = data;
          uploadError = error;
        } catch (storageError) {
          console.error('Storage upload error (512px):', storageError);
          uploadError = storageError;
        }

        if (uploadError) {
          console.error('Upload error:', uploadError);
          const errorMessage = uploadError instanceof Error ? uploadError.message : String(uploadError);
          throw error(500, `Upload failed: ${errorMessage}`);
        }

        // Upload 64px version for map markers
        let upload64Error = null;
        
        console.log(`📸 Uploading 64px version: ${filename} (format: jpg)`);
        
        try {
          const { error: error64 } = await supabase.storage
            .from('images-64')
            .upload(filename, sizes.jpg64, { 
              contentType: 'image/jpeg',
              upsert: false
            });
          upload64Error = error64;
        } catch (storageError) {
          console.error('Storage upload error (64px):', storageError);
          upload64Error = storageError;
        }

        if (upload64Error) {
          console.error('64px upload failed:', upload64Error);
        } else {
          console.log('64px upload successful');
        }

        // --- Build comprehensive EXIF data to store as JSON ---
        const exifData: Record<string, any> = {};
        
        // Basic image information
        if (width && height) { 
          exifData.ImageWidth = width; 
          exifData.ImageHeight = height; 
        }
        
        // Camera information
        if (exif?.Make) exifData.Make = fixEncoding(exif.Make);
        if (exif?.Model) exifData.Model = fixEncoding(exif.Model);
        if (lens) exifData.LensModel = lens;
        
        // Exposure settings
        if (exif?.ExposureTime) exifData.ExposureTime = exif.ExposureTime;
        if (exif?.FNumber) exifData.FNumber = exif.FNumber;
        if (exif?.ISO) exifData.ISO = exif.ISO;
        if (exif?.FocalLength) exifData.FocalLength = exif.FocalLength;
        if (exif?.ApertureValue) exifData.ApertureValue = exif.ApertureValue;
        
        // Additional exposure settings
        if (exif?.ExposureMode) exifData.ExposureMode = exif.ExposureMode;
        if (exif?.ExposureProgram) exifData.ExposureProgram = exif.ExposureProgram;
        if (exif?.ExposureBiasValue) exifData.ExposureBiasValue = exif.ExposureBiasValue;
        if (exif?.MeteringMode) exifData.MeteringMode = exif.MeteringMode;
        if (exif?.Flash) exifData.Flash = exif.Flash;
        
        // Image settings
        if (exif?.Orientation) exifData.Orientation = exif.Orientation;
        if (exif?.ColorSpace) exifData.ColorSpace = exif.ColorSpace;
        if (exif?.WhiteBalance) exifData.WhiteBalance = exif.WhiteBalance;
        if (exif?.DigitalZoomRatio) exifData.DigitalZoomRatio = exif.DigitalZoomRatio;
        
        // Date and time
        if (exif?.DateTimeOriginal || exif?.CreateDate) {
          exifData.CreateDate = exif?.DateTimeOriginal || exif?.CreateDate;
        }
        if (exif?.DateTime) exifData.DateTime = exif.DateTime;
        if (exif?.SubSecTimeOriginal) exifData.SubSecTimeOriginal = exif.SubSecTimeOriginal;
        
        // Artist and copyright information
        if (exif?.Artist) exifData.Artist = fixEncoding(exif.Artist);
        if (exif?.Copyright) exifData.Copyright = fixEncoding(exif.Copyright);
        if (exif?.Software) exifData.Software = fixEncoding(exif.Software);
        
        // GPS information (if not already stored in lat/lon fields)
        if (exif?.GPSLatitude && exif?.GPSLongitude) {
          exifData.GPSLatitude = exif.GPSLatitude;
          exifData.GPSLongitude = exif.GPSLongitude;
        }
        if (exif?.GPSAltitude) exifData.GPSAltitude = exif.GPSAltitude;
        if (exif?.GPSTimeStamp) exifData.GPSTimeStamp = exif.GPSTimeStamp;
        
        // Lens information
        if (exif?.LensMake) exifData.LensMake = fixEncoding(exif.LensMake);
        if (exif?.LensModel) exifData.LensModel = fixEncoding(exif.LensModel);
        if (exif?.LensSerialNumber) exifData.LensSerialNumber = fixEncoding(exif.LensSerialNumber);
        if (exif?.FocalLengthIn35mmFormat) exifData.FocalLengthIn35mmFormat = exif.FocalLengthIn35mmFormat;
        
        // File information
        exifData.FileSize = file.size;
        if (exif?.ImageSize) exifData.ImageSize = exif.ImageSize;
        if (exif?.Megapixels) exifData.Megapixels = exif.Megapixels;
        
        // Additional metadata
        if (exif?.SceneType) exifData.SceneType = exif.SceneType;
        if (exif?.CustomRendered) exifData.CustomRendered = exif.CustomRendered;
        if (exif?.GainControl) exifData.GainControl = exif.GainControl;
        if (exif?.Contrast) exifData.Contrast = exif.Contrast;
        if (exif?.Saturation) exifData.Saturation = exif.Saturation;
        if (exif?.Sharpness) exifData.Sharpness = exif.Sharpness;
        if (exif?.SubjectDistanceRange) exifData.SubjectDistanceRange = exif.SubjectDistanceRange;

        // 3. Versuche, das Original zu Hetzner zu verschieben
        let originalUrl = null;
        if (saveOriginals && originalSupabasePath) {
          let originalBuffer = buf;
          let hetznerSuccess = false;
          if (process.env.HETZNER_WEBDAV_URL && process.env.HETZNER_WEBDAV_USER && process.env.HETZNER_WEBDAV_PASSWORD) {
            try {
              const webdav = createClient(
                process.env.HETZNER_WEBDAV_URL!,
                {
                  username: process.env.HETZNER_WEBDAV_USER!,
                  password: process.env.HETZNER_WEBDAV_PASSWORD!
                }
              );
              // Test connection
              await webdav.getDirectoryContents('/');
              // Create items dir if needed
              try { await webdav.createDirectory('items'); } catch {}
              const hetznerPath = `items/${id}.jpg`;
              await webdav.putFileContents(hetznerPath, originalBuffer, { overwrite: true });
              originalUrl = `${process.env.HETZNER_WEBDAV_PUBLIC_URL || process.env.HETZNER_WEBDAV_URL}/items/${id}.jpg`;
              hetznerSuccess = true;
              console.log('✅ Original zu Hetzner verschoben:', hetznerPath);
            } catch (err) {
              console.error('❌ Hetzner-Upload fehlgeschlagen, Original bleibt in Supabase:', err);
              hetznerSuccess = false;
            }
          }
          // Wenn Hetzner erfolgreich, lösche Original aus Supabase
          if (hetznerSuccess) {
            try {
              await supabase.storage.from('originals').remove([originalSupabasePath]);
              console.log('🗑️ Original aus Supabase gelöscht:', originalSupabasePath);
            } catch (e) {
              console.error('⚠️ Konnte Original nicht aus Supabase löschen:', e);
            }
          } else {
            // Optional: originalUrl auf Supabase-URL setzen, falls Hetzner nicht erreichbar
            // originalUrl = `https://.../storage/v1/object/public/originals/${originalSupabasePath}`;
          }
        }

        // Insert into database with all paths and EXIF data
        console.log('🔍 DEBUG: Creating database record with environment-based settings');
        
        const dbRecord: any = {
          id,
          profile_id: authenticatedUser.id, // Use authenticatedUser.id as profile_id
          user_id: authenticatedUser.id,
          path_512: filename,
          path_2048: upload2048Error ? null : uploadFilename,
          path_64: upload64Error ? null : filename,
          width,
          height,
          lat,
          lon,
          original_name: baseName,
          image_format: 'jpg', // Always jpg now
          original_url: originalUrl, // Include original_url in main record
          ...(keywordsArray ? { keywords: keywordsArray } : {}),
          exif_data: Object.keys(exifData).length ? exifData : null
        };

        // Füge EXIF-Felder nur hinzu, wenn sie nicht null sind
        if (title) dbRecord.title = title;
        if (description) dbRecord.description = description;
        console.log('Inserting database record:', JSON.stringify(dbRecord, null, 2));
        
        // Versuche zuerst mit allen Feldern zu inserten
        console.log('Attempting database insert...');
        console.log('Record to insert:', JSON.stringify(dbRecord, null, 2));
        let dbData = null;
        let dbError = null;
        
        try {
          const { data, error } = await supabase
            .from('items')
            .insert(dbRecord)
            .select()
            .single();
          dbData = data;
          dbError = error;
          
          console.log('Supabase insert response:', { data, error });
        } catch (insertError) {
          console.error('Database insert exception:', insertError);
          console.error('Exception details:', {
            name: insertError instanceof Error ? insertError.name : 'Unknown',
            message: insertError instanceof Error ? insertError.message : String(insertError),
            stack: insertError instanceof Error ? insertError.stack : 'No stack'
          });
          dbError = insertError;
        }

        console.log('Database insert result:', { data: dbData, error: dbError });

        // Falls das fehlschlägt, versuche es ohne EXIF-Felder
        if (dbError && (dbError as any).message && ((dbError as any).message.includes('column') || (dbError as any).message.includes('does not exist'))) {
          console.log('EXIF fields not available, trying without them...');
          const fallbackRecord = {
            id,
            profile_id: authenticatedUser.id, // Use authenticatedUser.id as profile_id
            user_id: authenticatedUser.id,
            path_512: filename,
            path_2048: upload2048Error ? null : uploadFilename,
            path_64: upload64Error ? null : filename,
            width,
            height,
            lat,
            lon,
            original_name: baseName,
            image_format: 'jpg',
            original_url: originalUrl, // Include original_url in fallback record
            ...(keywordsArray ? { keywords: keywordsArray } : {}),
            exif_data: Object.keys(exifData).length ? exifData : null
          };
          
          console.log('Attempting fallback insert with:', JSON.stringify(fallbackRecord, null, 2));
          
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('items')
            .insert(fallbackRecord)
            .select()
            .single();
            
          console.log('Fallback insert result:', { data: fallbackData, error: fallbackError });
            
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
            message: (dbError as any).message,
            details: (dbError as any).details,
            hint: (dbError as any).hint
          });
          // Clean up uploaded file if database insert fails
          console.log('Cleaning up uploaded file due to database error...');
          await supabase.storage.from('images-512').remove([filename]);
          throw error(500, `Database error: ${(dbError as any).message}`);
        }

        console.log('Database insert successful:', dbData);
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
    console.error('Error stack:', err instanceof Error ? err.stack : 'No stack trace');
    console.error('Error details:', {
      name: err instanceof Error ? err.name : 'Unknown',
      message: err instanceof Error ? err.message : String(err),
      cause: err instanceof Error ? err.cause : undefined
    });
    
    const errorMessage = err instanceof Error ? err.message : 'Upload failed';
    const statusCode = (err as any)?.status || 500;
    
    return json({ 
      status: 'error', 
      message: errorMessage,
      details: err instanceof Error ? {
        name: err.name,
        message: err.message,
        stack: err.stack
      } : undefined
    }, { status: statusCode });
  }
};