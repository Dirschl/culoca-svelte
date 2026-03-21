import sharp from 'sharp';
import { createClient as createWebDavClient } from 'webdav';
import { extractPhotoMetadataFields } from '$lib/metadata/photoMetadata';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export type DownloadExportMetadataMode = 'original' | 'culoca' | 'none';
export type DownloadExportFormat = 'jpg' | 'webp';
export type DownloadExportSizeMode = 'full' | 'custom';
export type DownloadExportFilenameMode = 'original' | 'web';

export type DownloadExportOptions = {
  sizeMode: DownloadExportSizeMode;
  width?: number | null;
  height?: number | null;
  cropEnabled?: boolean;
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  format: DownloadExportFormat;
  compression?: number | null;
  metadataMode?: DownloadExportMetadataMode;
  filenameMode?: DownloadExportFilenameMode;
};

export type DownloadableItem = {
  id: string;
  short_id?: string | null;
  original_url?: string | null;
  path_2048?: string | null;
  path_512?: string | null;
  original_name?: string | null;
  title?: string | null;
  caption?: string | null;
  description?: string | null;
  keywords?: string[] | null;
  profile?: {
    full_name?: string | null;
    accountname?: string | null;
  } | null;
  exif_data?: Record<string, unknown> | null;
  lat?: number | null;
  lon?: number | null;
};

const DEFAULT_OPTIONS: Required<Pick<DownloadExportOptions, 'sizeMode' | 'format' | 'metadataMode' | 'filenameMode'>> = {
  sizeMode: 'full',
  format: 'jpg',
  metadataMode: 'original',
  filenameMode: 'original'
};
const execFileAsync = promisify(execFile);

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

function sanitizeBaseName(value: string | null | undefined, fallback: string) {
  const trimmed = (value || '').trim();
  if (!trimmed) return fallback;
  return trimmed.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
}

function slugifySegment(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function normalizeFileExtension(format: DownloadExportFormat) {
  return format === 'webp' ? 'webp' : 'jpg';
}

function getFilePathFromOriginalUrl(originalUrl: string | null | undefined, itemId: string) {
  let filePath = originalUrl || '';
  if (filePath.startsWith('http')) {
    const url = new URL(filePath);
    filePath = url.pathname;
  }
  if (filePath.startsWith('/')) {
    filePath = filePath.slice(1);
  }
  return filePath || `items/${itemId}.jpg`;
}

export function normalizeDownloadExportOptions(input: unknown): DownloadExportOptions {
  const source = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const sizeMode = source.sizeMode === 'custom' ? 'custom' : DEFAULT_OPTIONS.sizeMode;
  const format = source.format === 'webp' ? 'webp' : DEFAULT_OPTIONS.format;
  const metadataMode =
    source.metadataMode === 'none' || source.metadataMode === 'culoca' || source.metadataMode === 'original'
      ? source.metadataMode
      : DEFAULT_OPTIONS.metadataMode;
  const filenameMode = source.filenameMode === 'web' ? 'web' : DEFAULT_OPTIONS.filenameMode;
  const compressionRaw = source.compression;
  const compression =
    compressionRaw == null || compressionRaw === '' ? null : clampNumber(compressionRaw, 15, 75, 15);
  const width = source.width == null || source.width === '' ? null : clampNumber(source.width, 32, 12000, 2048);
  const height = source.height == null || source.height === '' ? null : clampNumber(source.height, 32, 12000, 2048);
  const cropSource = (source.crop && typeof source.crop === 'object' ? source.crop : null) as Record<string, unknown> | null;

  return {
    sizeMode,
    format,
    compression,
    metadataMode,
    filenameMode,
    width,
    height,
    cropEnabled: Boolean(source.cropEnabled),
    crop:
      cropSource
        ? {
            x: clampNumber(cropSource.x, 0, 1, 0),
            y: clampNumber(cropSource.y, 0, 1, 0),
            width: clampNumber(cropSource.width, 0.01, 1, 1),
            height: clampNumber(cropSource.height, 0.01, 1, 1)
          }
        : null
  };
}

export async function fetchOriginalItemBuffer(
  item: Pick<DownloadableItem, 'id' | 'original_url' | 'path_2048' | 'path_512'>,
  options?: {
    allowPublicFallback?: boolean;
  }
) {
  const allowPublicFallback = options?.allowPublicFallback ?? true;
  const originalUrl = item.original_url?.trim() || null;

  if (originalUrl) {
    try {
      const directResponse = await fetch(originalUrl);
      if (directResponse.ok) {
        return Buffer.from(await directResponse.arrayBuffer());
      }
    } catch (directError) {
      console.warn('Direct original fetch failed, falling back to WebDAV:', directError);
    }

    if (process.env.HETZNER_WEBDAV_USER && process.env.HETZNER_WEBDAV_PASSWORD) {
      try {
        const auth = Buffer.from(
          `${process.env.HETZNER_WEBDAV_USER}:${process.env.HETZNER_WEBDAV_PASSWORD}`
        ).toString('base64');
        const authResponse = await fetch(originalUrl, {
          headers: {
            Authorization: `Basic ${auth}`
          }
        });
        if (authResponse.ok) {
          return Buffer.from(await authResponse.arrayBuffer());
        }
      } catch (authFetchError) {
        console.warn('Authenticated original fetch failed, falling back to WebDAV:', authFetchError);
      }
    }
  }

  if (!process.env.HETZNER_WEBDAV_URL || !process.env.HETZNER_WEBDAV_USER || !process.env.HETZNER_WEBDAV_PASSWORD) {
    const fallbackBuffer = allowPublicFallback ? await fetchPublicVariantBuffer(item) : null;
    if (fallbackBuffer) return fallbackBuffer;
    throw new Error(
      originalUrl
        ? 'Original konnte weder direkt noch per WebDAV geladen werden. Fuer Original-EXIF wird kein metadatenreduzierter Fallback verwendet.'
        : 'Kein echtes Original verfuegbar. Fuer Original-EXIF wird kein metadatenreduzierter Fallback verwendet.'
    );
  }

  const webdav = createWebDavClient(process.env.HETZNER_WEBDAV_URL, {
    username: process.env.HETZNER_WEBDAV_USER,
    password: process.env.HETZNER_WEBDAV_PASSWORD
  });

  const filePath = getFilePathFromOriginalUrl(originalUrl, item.id);
  try {
    const fileBuffer = await webdav.getFileContents(filePath, { format: 'binary' });
    return Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer as ArrayBuffer);
  } catch (webdavError) {
    const fallbackBuffer = allowPublicFallback ? await fetchPublicVariantBuffer(item) : null;
    if (fallbackBuffer) return fallbackBuffer;
    throw webdavError;
  }
}

async function fetchPublicVariantBuffer(item: Pick<DownloadableItem, 'path_2048' | 'path_512'>) {
  const supabaseUrl =
    process.env.PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    import.meta.env.PUBLIC_SUPABASE_URL ||
    import.meta.env.VITE_SUPABASE_URL ||
    'https://caskhmcbvtevdwsolvwk.supabase.co';

  const candidates = [
    item.path_2048 ? `${supabaseUrl}/storage/v1/object/public/images-2048/${item.path_2048}` : null,
    item.path_512 ? `${supabaseUrl}/storage/v1/object/public/images-512/${item.path_512}` : null
  ].filter(Boolean) as string[];

  for (const url of candidates) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return Buffer.from(await response.arrayBuffer());
      }
    } catch (error) {
      console.warn('Public variant fetch failed:', error);
    }
  }

  return null;
}

function firstString(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function firstNumber(...values: Array<unknown>) {
  for (const value of values) {
    const num = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

function asJoinedKeywords(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((entry) => typeof entry === 'string' && entry.trim()).join(', ');
  }
  if (typeof value === 'string') return value.trim() || null;
  return null;
}

function buildGpsInfo(lat: unknown, lon: unknown) {
  const latitude = firstNumber(lat);
  const longitude = firstNumber(lon);

  if (latitude == null || longitude == null) {
    return {};
  }

  return {
    GPSLatitudeRef: latitude >= 0 ? 'N' : 'S',
    GPSLatitude: Math.abs(latitude).toFixed(6),
    GPSLongitudeRef: longitude >= 0 ? 'E' : 'W',
    GPSLongitude: Math.abs(longitude).toFixed(6)
  };
}

function compactObject<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== null && value !== undefined && value !== '')
  );
}

function stringifyExifValues(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input)
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => [key, typeof value === 'string' ? value : String(value)])
  );
}

function buildOriginalExif(item: DownloadableItem, width: number, height: number) {
  const exif = item.exif_data || {};
  const extracted = extractPhotoMetadataFields(exif);
  const title = firstString(extracted.title, item.title);
  const caption = firstString(extracted.caption, item.caption);
  const description = firstString(extracted.description, item.description, caption);
  const artist = firstString(exif.Artist, item.profile?.full_name, item.profile?.accountname);
  const copyright = firstString(exif.Copyright);
  const keywords = asJoinedKeywords(extracted.keywords ?? item.keywords);

  return {
    IFD0: stringifyExifValues({
      Make: firstString(exif.Make),
      Model: firstString(exif.Model),
      Software: firstString(exif.Software),
      Artist: artist,
      Copyright: copyright,
      ImageDescription: description,
      XPTitle: title,
      XPComment: description,
      XPAuthor: artist,
      XPKeywords: keywords,
      XPSubject: firstString(caption, title, description)
    }),
    ExifIFD: stringifyExifValues({
      DateTimeOriginal: firstString(exif.DateTimeOriginal, exif.CreateDate),
      CreateDate: firstString(exif.CreateDate, exif.DateTimeOriginal),
      LensModel: firstString(exif.LensModel),
      ExposureTime: firstNumber(exif.ExposureTime),
      FNumber: firstNumber(exif.FNumber),
      ISO: firstNumber(exif.ISO),
      FocalLength: firstNumber(exif.FocalLength),
      FocalLengthIn35mmFilm: firstNumber(exif.FocalLengthIn35mmFormat),
      Flash: firstString(exif.Flash),
      PixelXDimension: String(width),
      PixelYDimension: String(height)
    }),
    GPSInfo: stringifyExifValues(
      buildGpsInfo(exif.latitude ?? exif.Latitude ?? item.lat, exif.longitude ?? exif.Longitude ?? item.lon)
    )
  };
}

function buildCulocaExif(item: DownloadableItem, width: number, height: number) {
  const original = buildOriginalExif(item, width, height);
  const originalArtist = firstString(original.IFD0.Artist, original.IFD0.XPAuthor);
  const originalCopyright = firstString(original.IFD0.Copyright);
  const artist = firstString(item.profile?.full_name, item.profile?.accountname, originalArtist, 'Unbekannt');
  const copyright = originalCopyright
    ? `${originalCopyright} | Culoca`
    : `${artist} | Culoca`;
  const title = firstString(item.title, original.IFD0.XPTitle);
  const caption = firstString(item.caption, original.IFD0.XPComment, original.IFD0.ImageDescription);
  const description = firstString(item.description, caption, original.IFD0.ImageDescription, 'Culoca Export');
  const keywords = asJoinedKeywords(item.keywords) || firstString(original.IFD0.XPKeywords);

  return {
    IFD0: stringifyExifValues({
      ...original.IFD0,
      Software: 'Culoca Download Export',
      Artist: artist,
      Copyright: copyright,
      ImageDescription: description,
      XPTitle: title,
      XPComment: caption || description,
      XPAuthor: artist,
      XPKeywords: keywords,
      XPSubject: firstString(title, description)
    }),
    ExifIFD: stringifyExifValues({
      ...original.ExifIFD,
      PixelXDimension: String(width),
      PixelYDimension: String(height)
    }),
    GPSInfo: stringifyExifValues(buildGpsInfo(item.lat, item.lon))
  };
}

function applyFormat(pipeline: sharp.Sharp, format: DownloadExportFormat, compression: number | null | undefined) {
  if (format === 'webp') {
    if (compression == null) {
      return pipeline.webp({ lossless: true, effort: 6 });
    }

    const quality = Math.max(1, Math.min(100, 100 - compression));
    return pipeline.webp({
      quality,
      effort: 6,
      smartSubsample: true
    });
  }

  const quality = compression == null ? 100 : Math.max(1, Math.min(100, 100 - compression));
  return pipeline.jpeg({
    quality,
    mozjpeg: true,
    progressive: true,
    chromaSubsampling: '4:2:0',
    trellisQuantisation: true,
    overshootDeringing: true,
    optimizeScans: true
  });
}

function canReturnOriginalBufferUnchanged(
  metadata: sharp.Metadata,
  options: DownloadExportOptions
) {
  return (
    options.sizeMode === 'full' &&
    options.format === 'jpg' &&
    options.metadataMode === 'original' &&
    metadata.format === 'jpeg'
  );
}

async function applyCulocaMetadataUpdate(
  buffer: Buffer,
  item: DownloadableItem
) {
  const title = firstString(item.title);
  const caption = firstString(item.caption);
  const description = firstString(item.description, item.caption);
  const creator = firstString(item.profile?.full_name, item.profile?.accountname);
  const copyright = creator ? `${creator} | Culoca` : 'Culoca';

  const args = ['-overwrite_original', '-P', '-m'];

  if (title) {
    args.push(`-XMP-dc:Title=${title}`);
    args.push(`-IPTC:ObjectName=${title}`);
  }

  if (caption) {
    args.push(`-XMP-photoshop:Headline=${caption}`);
    args.push(`-IPTC:Headline=${caption}`);
  }

  if (description) {
    args.push(`-XMP-dc:Description=${description}`);
    args.push(`-IPTC:Caption-Abstract=${description}`);
    args.push(`-EXIF:ImageDescription=${description}`);
  }

  if (creator) {
    args.push(`-XMP-dc:Creator=${creator}`);
    args.push(`-IPTC:By-line=${creator}`);
    args.push(`-EXIF:Artist=${creator}`);
  }

  args.push(`-XMP-dc:Rights=${copyright}`);
  args.push(`-IPTC:CopyrightNotice=${copyright}`);
  args.push(`-EXIF:Copyright=${copyright}`);

  const tempDir = await mkdtemp(join(tmpdir(), 'culoca-export-'));
  const tempFile = join(tempDir, 'export.jpg');

  try {
    await writeFile(tempFile, buffer);
    await execFileAsync('/usr/local/bin/exiftool', [...args, tempFile], {
      maxBuffer: 10 * 1024 * 1024
    });
    return await readFile(tempFile);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function renderDownloadExport(
  originalBuffer: Buffer,
  item: DownloadableItem,
  rawOptions: DownloadExportOptions
) {
  const options = normalizeDownloadExportOptions(rawOptions);
  const baseImage = sharp(originalBuffer).rotate();
  const metadata = await baseImage.metadata();
  const baseWidth = metadata.width || 0;
  const baseHeight = metadata.height || 0;

  if (!baseWidth || !baseHeight) {
    throw new Error('Bilddimensionen konnten nicht gelesen werden');
  }

  if (canReturnOriginalBufferUnchanged(metadata, options)) {
    return {
      buffer: originalBuffer,
      info: {
        format: metadata.format,
        size: originalBuffer.byteLength,
        width: baseWidth,
        height: baseHeight
      },
      contentType: 'image/jpeg',
      filename: buildDownloadFilename(item, options),
      outputWidth: baseWidth,
      outputHeight: baseHeight
    };
  }

  let pipeline = sharp(originalBuffer).rotate();
  let outputWidth = baseWidth;
  let outputHeight = baseHeight;

  if (options.sizeMode === 'custom') {
    const requestedWidth = options.width || baseWidth;
    const requestedHeight = options.height || baseHeight;

    if (options.cropEnabled && options.crop) {
      const cropLeft = Math.round(baseWidth * options.crop.x);
      const cropTop = Math.round(baseHeight * options.crop.y);
      const cropWidth = Math.max(1, Math.round(baseWidth * options.crop.width));
      const cropHeight = Math.max(1, Math.round(baseHeight * options.crop.height));
      const boundedWidth = Math.min(cropWidth, baseWidth - cropLeft);
      const boundedHeight = Math.min(cropHeight, baseHeight - cropTop);

      pipeline = pipeline.extract({
        left: Math.max(0, cropLeft),
        top: Math.max(0, cropTop),
        width: Math.max(1, boundedWidth),
        height: Math.max(1, boundedHeight)
      });

      pipeline = pipeline.resize(requestedWidth, requestedHeight, {
        fit: 'cover',
        position: 'centre'
      });

      outputWidth = requestedWidth;
      outputHeight = requestedHeight;
    } else {
      pipeline = pipeline.resize(requestedWidth, requestedHeight, {
        fit: 'inside',
        withoutEnlargement: false
      });

      const ratio = Math.min(requestedWidth / baseWidth, requestedHeight / baseHeight);
      outputWidth = Math.max(1, Math.round(baseWidth * ratio));
      outputHeight = Math.max(1, Math.round(baseHeight * ratio));
    }
  }

  if (options.metadataMode === 'original' && options.format === 'jpg') {
    // Preserve the original embedded metadata as-is.
    // This is the safest path for now so camera-specific EXIF fields
    // like ISO, aperture, shutter speed, lens, timestamps and GPS are not lost.
    pipeline = pipeline.withMetadata();
  } else if (options.metadataMode === 'culoca' && options.format === 'jpg') {
    pipeline = pipeline.withMetadata();
  }

  const transformed = applyFormat(pipeline, options.format, options.compression);
  const result = await transformed.toBuffer({ resolveWithObject: true });
  const finalBuffer =
    options.metadataMode === 'culoca' && options.format === 'jpg'
      ? await applyCulocaMetadataUpdate(result.data, item)
      : result.data;

  return {
    buffer: finalBuffer,
    info: result.info,
    contentType: options.format === 'webp' ? 'image/webp' : 'image/jpeg',
    filename: buildDownloadFilename(item, options),
    outputWidth: result.info.width || outputWidth,
    outputHeight: result.info.height || outputHeight
  };
}

export function buildDownloadFilename(item: DownloadableItem, rawOptions: DownloadExportOptions) {
  const options = normalizeDownloadExportOptions(rawOptions);
  const extension = normalizeFileExtension(options.format);

  if (options.filenameMode === 'original') {
    const originalName = sanitizeBaseName(item.original_name, `image-${item.id}`);
    const baseWithoutExt = originalName.replace(/\.[a-z0-9]+$/i, '') || `image-${item.id}`;
    return `${baseWithoutExt}.${extension}`;
  }

  const seed = item.title || item.caption || item.original_name || 'bild';
  const slug = slugifySegment(seed) || 'bild';
  const shortId = slugifySegment(item.short_id || item.id.slice(0, 10)) || item.id.slice(0, 10);
  return `${slug}-culoca-${shortId}.${extension}`;
}
