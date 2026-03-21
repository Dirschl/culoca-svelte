import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { resizeJPG, getImageQualitySettings } from '$lib/image';
import sharp from 'sharp';
import exifr from 'exifr';
import { Buffer } from 'buffer';
import { createClient as createWebdavClient } from 'webdav';
import dotenv from 'dotenv';
import { jwtDecode } from 'jwt-decode'; // npm install jwt-decode, Typ: any
import {
  analyzeImageModeration,
  refreshSimilarityVectorForItem,
  resolveLocationFieldsFromOriginalName
} from '$lib/server/itemProcessing';
import { sanitizeKeywords } from '$lib/content/keywords';
import { extractPhotoMetadataFields } from '$lib/metadata/photoMetadata';
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

// Verbesserte Slugify-Funktion für deutsche Umlaute und bessere SEO
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    // Deutsche Umlaute korrekt ersetzen
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    // Weitere europäische Zeichen
    .replace(/à/g, 'a')
    .replace(/á/g, 'a')
    .replace(/â/g, 'a')
    .replace(/ã/g, 'a')
    .replace(/å/g, 'a')
    .replace(/è/g, 'e')
    .replace(/é/g, 'e')
    .replace(/ê/g, 'e')
    .replace(/ë/g, 'e')
    .replace(/ì/g, 'i')
    .replace(/í/g, 'i')
    .replace(/î/g, 'i')
    .replace(/ï/g, 'i')
    .replace(/ò/g, 'o')
    .replace(/ó/g, 'o')
    .replace(/ô/g, 'o')
    .replace(/õ/g, 'o')
    .replace(/ù/g, 'u')
    .replace(/ú/g, 'u')
    .replace(/û/g, 'u')
    .replace(/ý/g, 'y')
    .replace(/ÿ/g, 'y')
    .replace(/ñ/g, 'n')
    .replace(/ç/g, 'c')
    // Unicode-Normalisierung für verbleibende Zeichen
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    // Nur erlaubte Zeichen behalten
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-')
    .substring(0, 100);
}

function hasCompleteGeoFields(source: { country_slug?: string | null; district_slug?: string | null; municipality_slug?: string | null }) {
  return !!(source.country_slug && source.district_slug && source.municipality_slug);
}

export const POST = async ({ request }) => {
  try {
    console.log('=== UPLOAD API CALLED ===');
    console.log('🔍 DEBUG: Environment variables check:');
    console.log('  PUBLIC_SUPABASE_URL:', process.env.PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET');
    console.log('  VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? 'SET' : 'NOT SET');
    console.log('  PUBLIC_SUPABASE_ANON_KEY:', process.env.PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');
    console.log('  VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');
    console.log('  NODE_ENV:', process.env.NODE_ENV);
    console.log('  VERCEL_URL:', process.env.VERCEL_URL);
    
    const form = await request.formData();
    const filenames = form.getAll('filename') as string[];
    const originalPaths = form.getAll('original_path') as string[];
    const originalFilenames = form.getAll('original_filename') as string[];
    const clientExifJsonRaw = form.get('exif_json') as string | null;

    // NEW: Allow profile_id to be passed explicitly from the client.
    const passedProfileId = form.get('profile_id') as string | null;

    if (!filenames.length) {
      console.log('No filenames received');
      throw error(400, 'No filenames received');
    }

    console.log(`Received ${filenames.length} filenames to process`);

    // Supabase-Client dynamisch mit JWT initialisieren
    const supabaseUrl = (process.env.PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL) as string;
    const supabaseAnonKey = (process.env.PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY) as string;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw error(500, 'Supabase-Umgebungsvariablen fehlen!');
    }
    const authHeader = request.headers.get('authorization');
    const jwt = authHeader ? authHeader.replace('Bearer ', '') : null;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : {}
      }
    });
    
    // Debug: Log authentication status
    console.log('Auth check - User from cookie:', jwt ? 'JWT present' : 'No JWT');
    
    // Check Authorization header as fallback
    const authHeaderFallback = request.headers.get('authorization');
    console.log('Auth header:', authHeaderFallback ? 'present' : 'missing');
    
    // JWT im Backend direkt dekodieren
    let authenticatedUser = null;
    if (jwt) {
      try {
        const decoded: any = jwtDecode(jwt);
        // Supabase verwendet "sub" als User-ID im JWT
        authenticatedUser = { id: decoded.sub };
        console.log('User from JWT:', authenticatedUser.id);
      } catch (err) {
        console.log('JWT decode failed:', err);
      }
    }
    // Überall, wo authenticatedUser?.id verwendet wird, prüfe auf null
    if (!authenticatedUser || !authenticatedUser.id) {
      console.log('No authenticated user found');
      throw error(401, 'Nicht angemeldet. Bitte zuerst einloggen.');
    }
    
    // SECURITY: Additional check for user profile completeness
    let userProfile = null;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, accountname, created_at')
        .eq('id', authenticatedUser.id)
        .single();
      userProfile = data;
    } catch (err) {
      console.warn('⚠️  Konnte Profil nicht laden:', err);
    }
    console.log('DEBUG: userProfile loaded from DB:', userProfile);
    // Require users to have at least set up their profile with a name
    if (!userProfile || (!userProfile.full_name && !userProfile.accountname)) {
      console.log('User has incomplete profile, redirecting to setup');
      throw error(403, 'Bitte vervollständige dein Profil bevor du Bilder hochlädst. Gehe zu den Einstellungen.');
    }
    
    // Log security-relevant information
    console.log('Security check passed:', {
      userId: authenticatedUser?.id,
      hasName: !!userProfile.full_name,
      hasAccountname: !!userProfile.accountname,
      profileCreated: userProfile.created_at
    });
    
    console.log('Authenticated user:', authenticatedUser?.id);
    console.log('User details:', {
      id: authenticatedUser?.id
    });
    
    // Nach erfolgreicher Authentifizierung:
    let saveOriginalsPref = true; // Standard: Originale sichern
    let privacyMode = 'public'; // Standard: Public
    try {
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('save_originals, privacy_mode')
        .eq('id', authenticatedUser.id)
        .single();
      console.log('DEBUG: userProfile loaded from DB:', profileRow);
      if (profileRow) {
        if (typeof profileRow.save_originals === 'boolean') {
          saveOriginalsPref = profileRow.save_originals;
        }
        if (profileRow.privacy_mode) {
          privacyMode = profileRow.privacy_mode;
        }
      }
    } catch (prefErr) {
      console.warn('⚠️  Konnte Profileinstellungen nicht laden, verwende Defaults:', prefErr);
    }
    console.log('save_originals Pref:', saveOriginalsPref);
    console.log('privacy_mode:', privacyMode);

    // Prefer value coming from form; fall back to authenticated user id, otherwise null
    const profile_id = passedProfileId || authenticatedUser?.id || null;
    console.log('Using profile_id:', profile_id);

    const results = [];
    const successfulUploads: string[] = [];
    const failedUploads: string[] = [];
    const totalFiles = filenames.length;

    console.log(`=== UPLOAD START: Processing ${totalFiles} files ===`);

    for (let i = 0; i < filenames.length; i++) {
      const filename = filenames[i];
      const originalPath = originalPaths[i] || filename;
      const originalFilename = originalFilenames[i] || filename; // Ursprünglicher Dateiname
      console.log(`\n[${i + 1}/${totalFiles}] Processing file: ${filename}`);
      
      try {
        // Download original from Supabase storage
        console.log('📥 Downloading original from Supabase storage...');
        const { data: originalData, error: downloadError } = await supabase.storage
          .from('originals')
          .download(originalPath);
        
        if (downloadError) {
          console.error('❌ Download from Supabase failed:', downloadError);
          throw downloadError;
        }
        
        const buf = Buffer.from(await originalData.arrayBuffer());
        const id = filename.replace('.jpg', '');
        const baseName = originalFilename; // Ursprünglicher Dateiname mit Endung

        // STEP 1: Original is already uploaded to Supabase storage
        console.log('📤 STEP 1: Original already uploaded to Supabase storage');
        let originalSupabasePath = originalPath;

        // STEP 2: Extract EXIF data from original
        console.log('📤 STEP 2: Extracting EXIF data from original...');
        let exif: any = null;
        if (clientExifJsonRaw) {
          try {
            const clientExif = JSON.parse(clientExifJsonRaw);
            console.log('✅ Using client-provided EXIF data');
            exif = cleanExifData(clientExif);
          } catch (parseErr) {
            console.warn('Client EXIF JSON parsing failed:', parseErr);
            // Fallback to server-side parsing below
          }
        }

        // Fallback: server-side EXIF parsing
        if (!exif) {
          try {
            exif = await exifr.parse(buf, { iptc: true });
            console.log('✅ EXIF data extracted from original (server)');
          } catch (exifErr) {
            console.warn('EXIF parsing failed:', exifErr);
          }
        }

        // STEP 3: Resize image using the original buffer
        console.log('📤 STEP 3: Resizing image...');
        const qualitySettings = getImageQualitySettings();
        const sizes = await resizeJPG(buf);
        console.log('✅ Image resized successfully');

        // NEU: Get ACTUAL dimensions after EXIF orientation is applied
        let width = 2048;
        let height = 2048;
        
        try {
          // Get metadata from the image with EXIF orientation applied
          // Sharp wendet automatisch die EXIF-Orientierung an, wenn .rotate() ohne Parameter aufgerufen wird
          const originalMetadata = await sharp(buf).rotate().metadata();
          width = originalMetadata.width || 2048;
          height = originalMetadata.height || 2048;
          console.log(`✅ Image dimensions after EXIF orientation: ${width}x${height}`);
        } catch (metaError) {
          console.warn('Failed to get image metadata with EXIF orientation, using defaults');
          // Use defaults if metadata extraction fails
        }

        // --- EXIF Daten auslesen ---
        let lat: number | null = null;
        let lon: number | null = null;
        let title: string | null = null;
        let caption: string | null = null;
        let description: string | null = null;
        let keywords: string | null = null;
        let camera: string | null = null;
        let lens: string | null = null;

        // Funktion zum Bereinigen von EXIF-Daten (entfernt Null-Bytes und andere problematische Zeichen)
        function cleanExifData(obj: any): any {
          if (typeof obj === 'string') {
            // Entferne Null-Bytes und andere Steuerzeichen
            return obj.replace(/\u0000/g, '').replace(/[\x00-\x1F\x7F]/g, '');
          } else if (Array.isArray(obj)) {
            return obj.map(cleanExifData);
          } else if (obj && typeof obj === 'object') {
            const cleaned: any = {};
            for (const [key, value] of Object.entries(obj)) {
              cleaned[key] = cleanExifData(value);
            }
            return cleaned;
          }
          return obj;
        }

        // Bereite EXIF-Daten für die Datenbank vor
        const { MakerNote, ...exifWithoutMakerNote } = exif || {};
        const rawExifData = {
          ...exifWithoutMakerNote,
          width: sizes.width,
          height: sizes.height,
          FileSize: buf.length
        };
        // Bereinige die EXIF-Daten von Null-Bytes und Steuerzeichen
        const exifToStore = cleanExifData(rawExifData);

        // Check for manual input from FormData (bulk upload)
        const formTitle = form.get('title') as string;
        const formCaption = form.get('caption') as string;
        const formDescription = form.get('description') as string;
        const formKeywords = form.get('keywords') as string;
        const formTypeId = form.get('type_id') as string;
        const formLat = form.get('lat') as string;
        const formLon = form.get('lon') as string;
        const formContent = form.get('content') as string;
        const formExternalUrl = form.get('external_url') as string;
        const formVideoUrl = form.get('video_url') as string;
        const formGroupSlug = form.get('group_slug') as string;
        const formCountryName = form.get('country_name') as string;
        const formStateName = form.get('state_name') as string;
        const formRegionName = form.get('region_name') as string;
        const formDistrictName = form.get('district_name') as string;
        const formMunicipalityName = form.get('municipality_name') as string;
        const formLocalityName = form.get('locality_name') as string;

        if (formTitle) title = formTitle;
        if (formCaption) caption = formCaption;
        if (formDescription) description = formDescription;
        if (formKeywords) keywords = formKeywords;
        if (formTypeId) {
          const typeId = parseInt(formTypeId);
          if (typeId >= 1 && typeId <= 8) {
            // type_id wird später in der Datenbank gespeichert
          }
        }
        if (formLat && formLon) {
          lat = parseFloat(formLat);
          lon = parseFloat(formLon);
        }

        try {
          if (exif) {
            const extracted = extractPhotoMetadataFields(exif);

            // GPS coordinates
            if (typeof extracted.gps.lat === 'number' && typeof extracted.gps.lon === 'number') {
              lat = extracted.gps.lat;
              lon = extracted.gps.lon;
            }

            if (!title) {
              title = extracted.title;
            }

            if (!caption) {
              caption = extracted.caption;
            }

            if (!description) {
              description = extracted.description;
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
              keywords = extracted.keywords;
            }

            keywords = fixEncoding(keywords);
          }
        } catch (exifErr) {
          console.warn('EXIF parsing failed:', exifErr);
        }

        // Wenn Keywords-String vorhanden → in Array umwandeln (Postgres text[] erwartet JS-Array)
        let keywordsArray: string[] | null = null;
        if (keywords) {
          keywordsArray = sanitizeKeywords(keywords);
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

        // === SLUG-GENERIERUNG ===
        let creatorName = userProfile?.full_name || userProfile?.accountname || 'user';
        let slugBase = slugify(`${title}-${creatorName}`);
        let slug = slugBase;
        let counter = 2;
        // Prüfe, ob Slug schon existiert (Supabase Query)
        while (true) {
          const { data: existing, error: slugError } = await supabase
            .from('items')
            .select('id')
            .eq('slug', slug)
            .maybeSingle();
          if (!existing) break;
          slug = `${slugBase}-${counter++}`;
        }
        // === ENDE SLUG-GENERIERUNG ===

        // STEP 4: Upload resized versions to Supabase storage
        console.log('📤 STEP 4: Uploading resized versions to Supabase storage...');
        
        // Bestimme die tatsächlichen Formate und Buffer-Keys
        const format2048Key = `${qualitySettings.format2048}2048`;
        const format512Key = `${qualitySettings.format512}512`;
        const format64Key = `${qualitySettings.format64}64`;
        
        const contentType2048 = qualitySettings.format2048 === 'webp' ? 'image/webp' : 'image/jpeg';
        const contentType512 = qualitySettings.format512 === 'webp' ? 'image/webp' : 'image/jpeg';
        const contentType64 = qualitySettings.format64 === 'webp' ? 'image/webp' : 'image/jpeg';
        
        // Bestimme die Dateiendungen
        const extension2048 = qualitySettings.format2048 === 'webp' ? '.webp' : '.jpg';
        const extension512 = qualitySettings.format512 === 'webp' ? '.webp' : '.jpg';
        const extension64 = qualitySettings.format64 === 'webp' ? '.webp' : '.jpg';
        
        // Erstelle Dateinamen mit korrekten Endungen
        const filename2048 = filename.replace(/\.[^.]+$/, extension2048);
        const filename512 = filename.replace(/\.[^.]+$/, extension512);
        const filename64 = filename.replace(/\.[^.]+$/, extension64);
        
        // Upload 2048px version
        let upload2048Error = null;
        let uploadFilename = filename2048;
        
        console.log(`📸 Uploading 2048px version: ${uploadFilename} (format: ${qualitySettings.format2048}, quality: ${qualitySettings.quality2048})`);
        
        try {
          const { error: error2048 } = await supabase.storage
            .from('images-2048')
            .upload(uploadFilename, sizes[format2048Key], { 
              contentType: contentType2048,
              upsert: false
            });
          upload2048Error = error2048;
        } catch (storageError) {
          console.error('Storage upload error (2048px):', storageError);
          upload2048Error = storageError;
        }

        if (upload2048Error) {
          console.error('2048px upload failed:', upload2048Error);
          const errorMessage = upload2048Error instanceof Error ? upload2048Error.message : String(upload2048Error);
          throw error(500, `2048px upload failed: ${errorMessage}`);
        } else {
          console.log('2048px upload successful');
        }

        // Upload 512px version
        let uploadError = null;
        let uploadData = null;
        
        console.log(`📸 Uploading 512px version: ${filename512} (format: ${qualitySettings.format512}, quality: ${qualitySettings.quality512})`);
        
        try {
          const { data, error } = await supabase.storage
            .from('images-512')
            .upload(filename512, sizes[format512Key], { 
              contentType: contentType512,
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
        
        console.log(`📸 Uploading 64px version: ${filename64} (format: ${qualitySettings.format64}, quality: ${qualitySettings.quality64})`);
        
        try {
          const { error: error64 } = await supabase.storage
            .from('images-64')
            .upload(filename64, sizes[format64Key], { 
              contentType: contentType64,
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

        // STEP 5: Hetzner WebDAV Upload (abhängig von save_originals)
        console.log('📤 STEP 5: Handling original file (Hetzner)...');
        let originalUrl = null;

        let shouldDeleteOriginal = false; // Flag zum Löschen aus Supabase

        if (saveOriginalsPref) {
          // Originale sollen gesichert werden → versuche Upload zu Hetzner
          try {
            // Debug: Log environment variables (without sensitive data)
            console.log('🔍 DEBUG: Hetzner environment variables:');
            console.log('  HETZNER_WEBDAV_URL:', process.env.HETZNER_WEBDAV_URL ? 'SET' : 'NOT SET');
            console.log('  HETZNER_WEBDAV_USER:', process.env.HETZNER_WEBDAV_USER ? 'SET' : 'NOT SET');
            console.log('  HETZNER_WEBDAV_PASSWORD:', process.env.HETZNER_WEBDAV_PASSWORD ? 'SET' : 'NOT SET');
            console.log('  HETZNER_WEBDAV_PUBLIC_URL:', process.env.HETZNER_WEBDAV_PUBLIC_URL ? 'SET' : 'NOT SET');
            
            if (!process.env.HETZNER_WEBDAV_URL || !process.env.HETZNER_WEBDAV_USER || !process.env.HETZNER_WEBDAV_PASSWORD) {
              console.warn('⚠️ Missing Hetzner environment variables - skipping Hetzner upload');
              console.warn('⚠️ Original will remain in Supabase storage as fallback');
              originalUrl = null;
              shouldDeleteOriginal = false; // Keep original in Supabase
              throw new Error('Missing Hetzner environment variables');
            }
            
            console.log('🔍 DEBUG: Creating WebDAV client...');
            const webdav = createWebdavClient(
              process.env.HETZNER_WEBDAV_URL!,
              {
                username: process.env.HETZNER_WEBDAV_USER!,
                password: process.env.HETZNER_WEBDAV_PASSWORD!
              }
            );
            
            console.log('🔍 DEBUG: WebDAV client created, testing connection...');
            
            // Test connection first
            try {
              const contents = await webdav.getDirectoryContents('/');
              const itemCount = Array.isArray(contents) ? contents.length : 0;
              console.log('✅ WebDAV connection successful, root contents:', itemCount, 'items');
            } catch (testErr) {
              console.error('❌ WebDAV connection test failed:', testErr);
              throw testErr;
            }
            
            // Create items directory if it doesn't exist
            try {
              console.log('🔍 DEBUG: Creating items directory...');
              await webdav.createDirectory('items');
              console.log('✅ Created items directory');
            } catch (dirErr) {
              // Directory might already exist, that's okay
              console.log('ℹ️ Items directory already exists or creation failed:', dirErr);
            }
            
            const hetznerPath = `items/${id}.jpg`;
            console.log('🔍 DEBUG: Uploading to Hetzner path:', hetznerPath);
            console.log('🔍 DEBUG: File buffer size:', buf.length, 'bytes');
            
            await webdav.putFileContents(hetznerPath, buf, { overwrite: true });
            originalUrl = `${process.env.HETZNER_WEBDAV_PUBLIC_URL || process.env.HETZNER_WEBDAV_URL}/items/${id}.jpg`;
            console.log('✅ Hetzner WebDAV upload successful:', hetznerPath);
            console.log('✅ Original URL set to:', originalUrl);
            shouldDeleteOriginal = true; // nach erfolgreichem Upload löschen

          } catch (hetznerErr) {
            console.error('❌ Hetzner WebDAV upload failed:', hetznerErr);
            console.error('❌ Hetzner error details:', {
              name: hetznerErr instanceof Error ? hetznerErr.name : 'Unknown',
              message: hetznerErr instanceof Error ? hetznerErr.message : String(hetznerErr),
              stack: hetznerErr instanceof Error ? hetznerErr.stack : 'No stack'
            });
            originalUrl = null;
            shouldDeleteOriginal = false; // Bei Fehler kein Löschen, Original bleibt in Supabase als Fallback
            console.log('ℹ️ Continuing with upload - original remains in Supabase storage');
          }

        } else {
          console.log('ℹ️ save_originals == false → Überspringe Hetzner-Upload');
          shouldDeleteOriginal = true; // trotzdem in Supabase löschen
        }

        // Original ggf. aus Supabase löschen
        if (shouldDeleteOriginal) {
          try {
            await supabase.storage.from('originals').remove([originalSupabasePath]);
            console.log('🗑️ Original deleted from Supabase (save_originals false oder Hetzner ok)');
          } catch (deleteErr) {
            console.error('⚠️ Could not delete original from Supabase:', deleteErr);
          }
        }

        // STEP 6: Insert into database
        console.log('📤 STEP 6: Inserting into database...');
        
        const dbRecord: any = {
          id,
          profile_id: authenticatedUser?.id, // Use authenticatedUser.id as profile_id
          user_id: authenticatedUser?.id,
          path_512: filename512,
          path_2048: upload2048Error ? null : uploadFilename,
          path_64: upload64Error ? null : filename64,
          width,
          height,
          lat,
          lon,
          original_name: baseName,
          image_format: qualitySettings.format512, // Use actual format from settings
          original_url: originalUrl, // Include original_url in main record
          is_private: privacyMode === 'private', // Set is_private based on user's privacy mode
          type_id: formTypeId ? parseInt(formTypeId) : 1, // Default: 1 = Foto
          content: formContent?.trim() || null,
          external_url: formExternalUrl?.trim() || null,
          video_url: formVideoUrl?.trim() || null,
          group_slug: formGroupSlug?.trim() || null,
          country_name: formCountryName?.trim() || null,
          state_name: formStateName?.trim() || null,
          region_name: formRegionName?.trim() || null,
          district_name: formDistrictName?.trim() || null,
          municipality_name: formMunicipalityName?.trim() || null,
          locality_name: formLocalityName?.trim() || null,
          ...(keywordsArray ? { keywords: keywordsArray } : {}),
          exif_data: Object.keys(exifToStore).length ? exifToStore : null,
          slug // <--- Slug speichern
        };

        try {
          const moderation = await analyzeImageModeration(buf, originalData.type || 'image/jpeg');
          if (moderation) {
            dbRecord.page_settings = {
              moderation
            };
          }
        } catch (moderationError) {
          console.warn('⚠️ Moderation check failed, continuing without moderation payload:', moderationError);
        }

        const locationFields = await resolveLocationFieldsFromOriginalName(supabase, baseName);
        if (locationFields) {
          for (const [key, value] of Object.entries(locationFields)) {
            if (dbRecord[key] == null || dbRecord[key] === '') {
              dbRecord[key] = value;
            }
          }
        } else {
          dbRecord.location_needs_review = true;
        }

        if (hasCompleteGeoFields(dbRecord)) {
          dbRecord.location_needs_review = false;
        }

        if (keywordsArray) {
          keywordsArray = sanitizeKeywords(keywordsArray, {
            countryName: dbRecord.country_name,
            stateName: dbRecord.state_name,
            regionName: dbRecord.region_name,
            districtName: dbRecord.district_name,
            municipalityName: dbRecord.municipality_name,
            localityName: dbRecord.locality_name
          });
          dbRecord.keywords = keywordsArray;
        }

        // Füge EXIF-Felder nur hinzu, wenn sie nicht null sind
        if (title) dbRecord.title = title;
        if (caption) dbRecord.caption = caption;
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
            profile_id: authenticatedUser?.id, // Use authenticatedUser.id as profile_id
            user_id: authenticatedUser?.id,
            path_512: filename512,
            path_2048: upload2048Error ? null : uploadFilename,
            path_64: upload64Error ? null : filename64,
            width,
            height,
            lat,
            lon,
            original_name: baseName,
            image_format: qualitySettings.format512,
            original_url: originalUrl, // Include original_url in fallback record
            is_private: privacyMode === 'private', // Set is_private based on user's privacy mode
            type_id: formTypeId ? parseInt(formTypeId) : 1, // Default: 1 = Foto
            content: formContent?.trim() || null,
            external_url: formExternalUrl?.trim() || null,
            video_url: formVideoUrl?.trim() || null,
            group_slug: formGroupSlug?.trim() || null,
            ...(keywordsArray ? { keywords: keywordsArray } : {}),
            exif_data: Object.keys(exifToStore).length ? exifToStore : null,
            slug,
            page_settings: dbRecord.page_settings || null
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
          await supabase.storage.from('images-512').remove([filename512]);
          throw error(500, `Database error: ${(dbError as any).message}`);
        }

        console.log('Database insert successful:', dbData);

        try {
          await refreshSimilarityVectorForItem(dbData as any);
        } catch (vectorError) {
          console.warn('Failed to refresh similarity vector after upload:', vectorError);
        }

        results.push(dbData);
        successfulUploads.push(filename);
        console.log(`✅ Successfully processed: ${filename}`);
        
        // Token-Erneuerung nach erfolgreichem Upload für nächste Datei
        if (i < totalFiles - 1) { // Nicht nach der letzten Datei
          try {
            console.log('🔄 Attempting token refresh for next upload...');
            
            // Erstelle neuen Supabase-Client mit aktuellem JWT für Token-Erneuerung
            const refreshSupabase = createClient(supabaseUrl, supabaseAnonKey, {
              global: {
                headers: jwt ? { Authorization: `Bearer ${jwt}` } : {}
              }
            });
            
            // Versuche Token-Erneuerung
            const { data: refreshData, error: refreshError } = await refreshSupabase.auth.refreshSession();
            
            if (refreshError) {
              console.warn('⚠️ Token refresh failed for next upload:', refreshError);
            } else {
              console.log('🔄 Token refreshed successfully for next upload');
            }
          } catch (refreshErr) {
            console.warn('⚠️ Token refresh attempt failed:', refreshErr);
          }
        }
        
        } catch (fileError) {
          console.error(`❌ Failed to process file: ${filename}`, fileError);
          failedUploads.push(filename);
          
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
