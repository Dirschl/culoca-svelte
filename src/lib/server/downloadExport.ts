import type { Gravity, Metadata, Sharp, Strategy } from 'sharp';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient as createWebDavClient } from 'webdav';
import { extractPhotoMetadataFields } from '$lib/metadata/photoMetadata';

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
  width?: number | null;
  height?: number | null;
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

let sharpFactoryPromise: Promise<(typeof import('sharp'))['default']> | null = null;

async function getSharp() {
  if (!sharpFactoryPromise) {
    sharpFactoryPromise = import('sharp').then((module) => module.default);
  }

  return sharpFactoryPromise;
}

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

  const toExifCoordinate = (value: number) => {
    const absolute = Math.abs(value);
    const degrees = Math.floor(absolute);
    const minutesFloat = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesFloat);
    const seconds = (minutesFloat - minutes) * 60;
    const secondsNumerator = Math.round(seconds * 10000);
    return `${degrees}/1 ${minutes}/1 ${secondsNumerator}/10000`;
  };

  return {
    GPSLatitudeRef: latitude >= 0 ? 'N' : 'S',
    GPSLatitude: toExifCoordinate(latitude),
    GPSLongitudeRef: longitude >= 0 ? 'E' : 'W',
    GPSLongitude: toExifCoordinate(longitude)
  };
}

function getAutoOrientedDimensions(metadata: Metadata) {
  const width = metadata.width || 0;
  const height = metadata.height || 0;

  if (!width || !height) {
    return { width, height };
  }

  const orientation = metadata.orientation || 1;
  if ([5, 6, 7, 8].includes(orientation)) {
    return {
      width: height,
      height: width
    };
  }

  return { width, height };
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

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function buildLangAlt(tagName: string, value: string | null) {
  if (!value) return '';
  return `<${tagName}><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(value)}</rdf:li></rdf:Alt></${tagName}>`;
}

function buildSeq(tagName: string, values: string[]) {
  if (!values.length) return '';
  const items = values.map((value) => `<rdf:li>${escapeXml(value)}</rdf:li>`).join('');
  return `<${tagName}><rdf:Seq>${items}</rdf:Seq></${tagName}>`;
}

function buildBag(tagName: string, values: string[]) {
  if (!values.length) return '';
  const items = values.map((value) => `<rdf:li>${escapeXml(value)}</rdf:li>`).join('');
  return `<${tagName}><rdf:Bag>${items}</rdf:Bag></${tagName}>`;
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
    IFD3: stringifyExifValues(
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
    ? `${originalCopyright} | culoca.com`
    : `${artist} | culoca.com`;
  const title = firstString(item.title, original.IFD0.XPTitle);
  const caption = firstString(item.caption, original.IFD0.XPSubject, original.IFD0.XPComment);
  const description = firstString(item.description, original.IFD0.ImageDescription, caption, 'Culoca Export');
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
      XPSubject: firstString(caption, title, description)
    }),
    ExifIFD: stringifyExifValues({
      ...original.ExifIFD,
      PixelXDimension: String(width),
      PixelYDimension: String(height)
    }),
    IFD3: stringifyExifValues(buildGpsInfo(item.lat, item.lon))
  };
}

function buildCulocaXmp(item: DownloadableItem) {
  const creator = firstString(item.profile?.full_name, item.profile?.accountname, 'Unbekannt');
  const original = buildOriginalExif(item, item.width || 0, item.height || 0);
  const title = firstString(item.title);
  const caption = firstString(item.caption, original.IFD0.XPSubject, original.IFD0.XPComment);
  const description = firstString(item.description, caption, 'Culoca Export');
  const copyright = firstString(original.IFD0.Copyright)
    ? `${firstString(original.IFD0.Copyright)} | culoca.com`
    : `${creator} | culoca.com`;
  const keywords = Array.isArray(item.keywords)
    ? item.keywords.filter((keyword): keyword is string => typeof keyword === 'string' && keyword.trim().length > 0)
    : [];

  return `<?xml version="1.0" encoding="UTF-8"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description
      rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
      xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/">
      ${buildLangAlt('dc:title', title)}
      ${buildLangAlt('dc:description', description)}
      ${buildSeq('dc:creator', [creator])}
      ${buildBag('dc:subject', keywords)}
      ${buildLangAlt('dc:rights', copyright)}
      ${buildLangAlt('photoshop:Headline', caption)}
      ${buildLangAlt('xmpRights:UsageTerms', copyright)}
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>`;
}

function buildCulocaExiftoolTags(item: DownloadableItem) {
  const extracted = extractPhotoMetadataFields(item.exif_data || {});
  const title = firstString(item.title, extracted.title);
  const caption = firstString(item.caption, extracted.caption, extracted.title);
  const description = firstString(item.description, extracted.description, caption, 'Culoca Export');
  const creator = firstString(item.profile?.full_name, item.profile?.accountname, extracted.creator, 'Unbekannt');
  const originalCopyright = firstString(item.exif_data?.Copyright, extracted.copyright);
  const copyright = originalCopyright ? `${originalCopyright} | culoca.com` : `${creator} | culoca.com`;
  const keywords = Array.isArray(item.keywords)
    ? item.keywords.filter((keyword): keyword is string => typeof keyword === 'string' && keyword.trim().length > 0)
    : [];
  const gpsLat = firstNumber(item.lat, item.exif_data?.latitude, item.exif_data?.Latitude);
  const gpsLon = firstNumber(item.lon, item.exif_data?.longitude, item.exif_data?.Longitude);

  return compactObject({
    Artist: creator,
    Creator: creator,
    Copyright: copyright,
    'IPTC:CopyrightNotice': copyright,
    'XMP-dc:Rights': copyright,
    Headline: caption,
    'IPTC:Headline': caption,
    'XMP-photoshop:Headline': caption,
    Title: title,
    'XMP-dc:Title': title,
    ImageDescription: description,
    Description: description,
    'IPTC:Caption-Abstract': description,
    'XMP-dc:Description': description,
    XPTitle: title,
    XPComment: caption || description,
    XPAuthor: creator,
    XPKeywords: keywords.length ? keywords.join('; ') : null,
    XPSubject: firstString(caption, title, description),
    Keywords: keywords.length ? keywords : null,
    Subject: keywords.length ? keywords : null,
    GPSLatitude: gpsLat,
    GPSLongitude: gpsLon
  });
}

function isJpegBuffer(buffer: Buffer) {
  return buffer.byteLength >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

export function canRewriteMetadataWithoutSharp(originalBuffer: Buffer, rawOptions: DownloadExportOptions) {
  const options = normalizeDownloadExportOptions(rawOptions);
  if (options.sizeMode !== 'full' || options.format !== 'jpg') return false;
  if (options.metadataMode !== 'culoca' && options.metadataMode !== 'none') return false;
  return isJpegBuffer(originalBuffer);
}

export async function rewriteJpegMetadataWithoutSharp(
  originalBuffer: Buffer,
  item: DownloadableItem,
  rawOptions: DownloadExportOptions
) {
  const options = normalizeDownloadExportOptions(rawOptions);

  if (!canRewriteMetadataWithoutSharp(originalBuffer, options)) {
    throw new Error('Exiftool-Fallback ist fuer diese Exportvariante nicht verfuegbar');
  }

  const tempFile = join(tmpdir(), `culoca-download-${randomUUID()}.jpg`);
  const tempOriginalFile = `${tempFile}_original`;

  try {
    const { exiftool } = await import('exiftool-vendored');

    await fs.writeFile(tempFile, originalBuffer);

    if (options.metadataMode === 'none') {
      await exiftool.deleteAllTags(tempFile);
    } else {
      await exiftool.write(tempFile, buildCulocaExiftoolTags(item));
    }

    const buffer = await fs.readFile(tempFile);

    return {
      buffer,
      contentType: 'image/jpeg',
      filename: buildDownloadFilename(item, options),
      outputWidth: item.width || null,
      outputHeight: item.height || null
    };
  } finally {
    await Promise.allSettled([fs.unlink(tempFile), fs.unlink(tempOriginalFile)]);
  }
}

function applyFormat(pipeline: Sharp, format: DownloadExportFormat, compression: number | null | undefined) {
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
  metadata: Metadata,
  options: DownloadExportOptions
) {
  return (
    options.sizeMode === 'full' &&
    options.format === 'jpg' &&
    options.metadataMode === 'original' &&
    metadata.format === 'jpeg'
  );
}

export function canBypassImageProcessing(options: DownloadExportOptions) {
  return options.sizeMode === 'full' && options.format === 'jpg' && options.metadataMode === 'original';
}

export async function renderDownloadExport(
  originalBuffer: Buffer,
  item: DownloadableItem,
  rawOptions: DownloadExportOptions
) {
  const options = normalizeDownloadExportOptions(rawOptions);
  const sharp = await getSharp();
  const baseImage = sharp(originalBuffer).rotate();
  const metadata = await baseImage.metadata();
  const orientedDimensions = getAutoOrientedDimensions(metadata);
  const baseWidth = orientedDimensions.width || 0;
  const baseHeight = orientedDimensions.height || 0;

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

  const createBasePipeline = () => sharp(originalBuffer).rotate();
  let pipeline = createBasePipeline();
  let outputWidth = baseWidth;
  let outputHeight = baseHeight;
  let resizeConfig:
    | {
        width: number;
        height: number;
        fit: 'cover' | 'inside';
        position?: Gravity | Strategy;
        withoutEnlargement?: boolean;
      }
    | null = null;
  let extractConfig:
    | {
        left: number;
        top: number;
        width: number;
        height: number;
      }
    | null = null;

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

      extractConfig = {
        left: Math.max(0, cropLeft),
        top: Math.max(0, cropTop),
        width: Math.max(1, boundedWidth),
        height: Math.max(1, boundedHeight)
      };
      pipeline = pipeline.extract(extractConfig);

      resizeConfig = {
        width: requestedWidth,
        height: requestedHeight,
        fit: 'cover',
        position: 'centre'
      };
      pipeline = pipeline.resize(requestedWidth, requestedHeight, {
        fit: 'cover',
        position: 'centre'
      });

      outputWidth = requestedWidth;
      outputHeight = requestedHeight;
    } else {
      resizeConfig = {
        width: requestedWidth,
        height: requestedHeight,
        fit: 'inside',
        withoutEnlargement: false
      };
      pipeline = pipeline.resize(requestedWidth, requestedHeight, {
        fit: 'inside',
        withoutEnlargement: false
      });

      const ratio = Math.min(requestedWidth / baseWidth, requestedHeight / baseHeight);
      outputWidth = Math.max(1, Math.round(baseWidth * ratio));
      outputHeight = Math.max(1, Math.round(baseHeight * ratio));
    }
  }

  const rebuildProcessedPipeline = () => {
    let nextPipeline = createBasePipeline();
    if (extractConfig) {
      nextPipeline = nextPipeline.extract(extractConfig);
    }
    if (resizeConfig) {
      nextPipeline = nextPipeline.resize(resizeConfig.width, resizeConfig.height, {
        fit: resizeConfig.fit,
        position: resizeConfig.position,
        withoutEnlargement: resizeConfig.withoutEnlargement
      });
    }
    return nextPipeline;
  };

  const renderTransformedBuffer = async (inputPipeline: Sharp) => {
    const transformed = applyFormat(inputPipeline, options.format, options.compression);
    return transformed.toBuffer({ resolveWithObject: true });
  };

  let result: Awaited<ReturnType<typeof renderTransformedBuffer>>;

  if (options.metadataMode === 'original' && options.format === 'jpg') {
    // Preserve the original embedded metadata as-is.
    // This is the safest path for now so camera-specific EXIF fields
    // like ISO, aperture, shutter speed, lens, timestamps and GPS are not lost.
    result = await renderTransformedBuffer(pipeline.withMetadata());
  } else if (options.metadataMode === 'culoca' && options.format === 'jpg') {
    const culocaExif = buildCulocaExif(item, outputWidth, outputHeight);
    const culocaXmp = buildCulocaXmp(item);

    try {
      result = await renderTransformedBuffer(
        pipeline.withMetadata({
          exif: culocaExif
        }).withXmp(culocaXmp)
      );
    } catch (xmpError) {
      console.warn('Culoca XMP export failed, retrying with EXIF-only metadata:', xmpError);
      result = await renderTransformedBuffer(
        rebuildProcessedPipeline()
          .withMetadata({
            exif: culocaExif
          })
      );
    }
  } else {
    result = await renderTransformedBuffer(pipeline);
  }

  return {
    buffer: result.data,
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
