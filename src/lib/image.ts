import sharp from 'sharp';

// --- Helper --------------------------------------------------------------
/**
 * Normalises the requested image format. Any unexpected value falls back to the default.
 */
function parseFormat(key: string, fallback: 'webp' | 'jpg'): 'webp' | 'jpg' {
  const raw = process.env[key]?.toLowerCase();
  if (raw === 'webp') return 'webp';
  if (raw === 'jpeg' || raw === 'jpg') return 'jpg';
  return fallback;
}

/**
 * Parses an integer between 1-100 from the environment or returns the given default.
 */
function parseQuality(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const val = parseInt(raw, 10);
  if (Number.isFinite(val) && val >= 1 && val <= 100) return val;
  console.warn(`⚠️  Invalid value for ${key}: "${raw}" – using fallback ${fallback}`);
  return fallback;
}

// ------------------------------------------------------------------------
// Public API

export function getImageQualitySettings() {
  // Environment-based settings
  const settings = {
    format2048: parseFormat('IMAGE_FORMAT_2048', 'jpg'),
    quality2048: parseQuality('IMAGE_QUALITY_2048', 85),
    format512: parseFormat('IMAGE_FORMAT_512', 'jpg'),
    quality512: parseQuality('IMAGE_QUALITY_512', 85),
    format64: parseFormat('IMAGE_FORMAT_64', 'jpg'),
    quality64: parseQuality('IMAGE_QUALITY_64', 85)
  } as const;
  console.log('✅ Environment-based Qualitätseinstellungen:', settings);
  return settings;
}

export async function resizeJPG(buffer: Buffer) {
  // Hole die Qualitätseinstellungen aus den Environment-Variablen
  const settings = getImageQualitySettings();
  
  // NEU: Sharp automatisch EXIF-Orientierung anwenden
  // Sharp wendet automatisch die EXIF-Orientierung an, wenn .rotate() ohne Parameter aufgerufen wird
  const sharpBuffer = sharp(buffer).rotate();
  
  const metadata = await sharpBuffer.metadata();
  const { width: originalWidth, height: originalHeight } = metadata;
  
  // Calculate target dimensions to make longest edge 2048px
  let targetWidth2048, targetHeight2048;
  if (originalWidth && originalHeight) {
    if (originalWidth >= originalHeight) {
      // Width is longer - make width 2048
      targetWidth2048 = 2048;
      targetHeight2048 = Math.round((originalHeight / originalWidth) * 2048);
    } else {
      // Height is longer - make height 2048
      targetHeight2048 = 2048;
      targetWidth2048 = Math.round((originalWidth / originalHeight) * 2048);
    }
  } else {
    targetWidth2048 = 2048;
    targetHeight2048 = 2048;
  }

  console.log(`Resizing from ${originalWidth}x${originalHeight} to ${targetWidth2048}x${targetHeight2048} (with EXIF orientation applied)`);

  // Helper function to generate image in the correct format and quality
  const generateImage = async (width: number, height: number, format: 'webp' | 'jpg', quality: number) => {
    // NEU: Verwende sharpBuffer statt buffer, um EXIF-Orientierung zu berücksichtigen
    const sharpInstance = sharpBuffer
      .resize(width, height, { 
        fit: 'inside', 
        withoutEnlargement: true 
      });

    if (format === 'webp') {
      return sharpInstance
        .webp({ 
          quality,
          effort: 6,
          smartSubsample: true
        })
        .toBuffer();
    } else {
      return sharpInstance
        .jpeg({ 
          mozjpeg: true, 
          quality,
          progressive: true,
          chromaSubsampling: '4:2:0',
          trellisQuantisation: true,
          overshootDeringing: true,
          optimizeScans: true
        })
        .toBuffer();
    }
  };

  // Generate all versions with environment-based settings
  const [version2048, version512, version64] = await Promise.all([
    generateImage(targetWidth2048, targetHeight2048, settings.format2048, settings.quality2048),
    generateImage(512, 512, settings.format512, settings.quality512),
    generateImage(64, 64, settings.format64, settings.quality64)
  ]);

  // Return with dynamic keys based on actual formats used
  const result: any = {
    original: buffer,
    [`${settings.format2048}2048`]: version2048,
    [`${settings.format512}512`]: version512,
    [`${settings.format64}64`]: version64
  };

  return result;
}