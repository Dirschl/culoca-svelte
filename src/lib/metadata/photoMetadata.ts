import { fixTextEncodingIfNeeded } from '$lib/utils/utf8Mojibake';

export type PhotoMetadataFields = {
  title: string | null;
  caption: string | null;
  description: string | null;
  keywords: string | null;
  creator: string | null;
  copyright: string | null;
  gps: {
    lat: number | null;
    lon: number | null;
  };
};

function fixMetadataEncoding(value: string | null | undefined) {
  if (!value) return null;
  return fixTextEncodingIfNeeded(value) ?? value;
}

function firstText(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return fixMetadataEncoding(value.trim());
    }
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

function joinedKeywords(value: unknown) {
  if (Array.isArray(value)) {
    const joined = value.filter((entry) => typeof entry === 'string' && entry.trim()).join(', ');
    return firstText(joined);
  }
  return firstText(value);
}

function findNestedText(source: unknown, matchers: Array<(key: string) => boolean>): string | null {
  const seen = new WeakSet<object>();

  function visit(value: unknown): string | null {
    if (!value || typeof value !== 'object') return null;
    if (seen.has(value as object)) return null;
    seen.add(value as object);

    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === 'string' && entry.trim()) return firstText(entry);
        const nested = visit(entry);
        if (nested) return nested;
      }
      return null;
    }

    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const normalizedKey = key.toLowerCase();

      if (matchers.some((matcher) => matcher(normalizedKey))) {
        const directText = joinedKeywords(entry);
        if (directText) return directText;
      }

      const nested = visit(entry);
      if (nested) return nested;
    }

    return null;
  }

  return visit(source);
}

export function extractPhotoMetadataFields(exifData: Record<string, unknown> | null | undefined): PhotoMetadataFields {
  const exif = (exifData || {}) as Record<string, unknown>;
  const iptc = (exif.iptc && typeof exif.iptc === 'object' ? exif.iptc : {}) as Record<string, unknown>;

  const title = firstText(
    exif['XMP-photoshop:Headline'],
    exif['XMP:Headline'],
    exif['photoshop:headline'],
    exif['IPTC:Headline'],
    iptc.Headline,
    exif['XMP-dc:Title'],
    exif['XMP:Title'],
    exif['dc:title'],
    exif['IPTC:ObjectName'],
    iptc.ObjectName,
    findNestedText(exif, [
      (key) => key === 'headline',
      (key) => key.endsWith(':headline'),
      (key) => key.endsWith(':title'),
      (key) => key === 'objectname',
      (key) => key.endsWith(':objectname')
    ])
  );

  const caption = firstText(
    exif['XMP-photoshop:Headline'],
    exif['XMP:Headline'],
    exif['photoshop:headline'],
    exif['IPTC:Headline'],
    iptc.Headline,
    exif['XMP:Caption'],
    exif['XMP-dc:Caption'],
    exif['dc:caption'],
    exif.Caption,
    findNestedText(exif, [
      (key) => key === 'headline',
      (key) => key.endsWith(':headline'),
      (key) => key === 'caption',
      (key) => key.endsWith(':caption')
    ])
  );

  const description = firstText(
    exif['XMP-dc:Description'],
    exif['XMP:Description'],
    exif['dc:description'],
    exif['IPTC:Description'],
    iptc.Description,
    exif['IPTC:CaptionAbstract'],
    exif['IPTC:Caption-Abstract'],
    iptc.CaptionAbstract,
    exif.ImageDescription,
    exif.description,
    exif.Description,
    findNestedText(exif, [
      (key) => key === 'description',
      (key) => key.endsWith(':description'),
      (key) => key === 'captionabstract',
      (key) => key.endsWith(':captionabstract'),
      (key) => key === 'caption-abstract',
      (key) => key.endsWith(':caption-abstract'),
      (key) => key === 'imagedescription',
      (key) => key.endsWith(':imagedescription')
    ])
  );

  const keywords = firstText(
    joinedKeywords(exif['XMP-dc:Subject']),
    joinedKeywords(exif['dc:subject']),
    joinedKeywords(exif.Keywords),
    joinedKeywords(iptc.Keywords),
    joinedKeywords(exif['IPTC:Keywords']),
    findNestedText(exif, [
      (key) => key === 'keywords',
      (key) => key.endsWith(':keywords'),
      (key) => key === 'subject',
      (key) => key.endsWith(':subject')
    ])
  );

  return {
    title,
    caption,
    description,
    keywords,
    creator: firstText(
      exif['XMP-dc:Creator'],
      exif['dc:creator'],
      exif.Artist,
      exif.Creator,
      findNestedText(exif, [
        (key) => key === 'creator',
        (key) => key.endsWith(':creator'),
        (key) => key === 'artist',
        (key) => key.endsWith(':artist')
      ])
    ),
    copyright: firstText(
      exif['XMP-dc:Rights'],
      exif['dc:rights'],
      exif.Copyright,
      findNestedText(exif, [
        (key) => key === 'copyright',
        (key) => key.endsWith(':copyright'),
        (key) => key === 'rights',
        (key) => key.endsWith(':rights')
      ])
    ),
    gps: {
      lat: firstNumber(exif.latitude, exif.Latitude),
      lon: firstNumber(exif.longitude, exif.Longitude)
    }
  };
}

/** Profil wie auf der Item-/Download-Seite (öffentliche Felder). */
export type CulocaAttributionProfile = {
  full_name?: string | null;
  accountname?: string | null;
} | null;

/**
 * Gleiche Logik wie Download-Vorschau „Culoca“: Ersteller + Copyright-Zeile für eingebettete Metadaten.
 * Reihenfolge Ersteller: Profil → EXIF/XMP-Creator → „Unbekannt“.
 * Copyright: EXIF-Rechtezeile + „ | culoca.com“, sonst Ersteller + „ | culoca.com“.
 */
export function getCulocaDownloadMetadataAttribution(
  exifData: Record<string, unknown> | null | undefined,
  profile: CulocaAttributionProfile
): { creator: string; copyright: string } {
  const extracted = extractPhotoMetadataFields(exifData || {});
  const originalCreator = firstText(
    extracted.creator,
    profile?.full_name,
    profile?.accountname
  );
  const originalCopyright = firstText(extracted.copyright);

  const creator =
    firstText(profile?.full_name, profile?.accountname, originalCreator, 'Unbekannt') || 'Unbekannt';
  const copyright = originalCopyright
    ? `${originalCopyright} | culoca.com`
    : `${creator} | culoca.com`;

  return { creator, copyright };
}
