import { fixTextEncodingIfNeeded } from '$lib/utils/utf8Mojibake';
import { extractPhotoMetadataFields } from '$lib/metadata/photoMetadata';

export type AttributionProfileSettings = {
  display_name_public?: string | null;
  legal_entity_name?: string | null;
  copyright_holder_name?: string | null;
  default_creator_name?: string | null;
  default_credit_text?: string | null;
  default_copyright_notice?: string | null;
  default_license_url?: string | null;
  default_author_meta?: string | null;
  organization_name?: string | null;
  use_exif_creator_override?: boolean | null;
  use_exif_credit_override?: boolean | null;
  use_exif_copyright_override?: boolean | null;
  photographer_label_mode?: string | null;
  public_contact_name?: string | null;
  // Legacy fallbacks (bereits vorhanden)
  full_name?: string | null;
  accountname?: string | null;
} | null;

export type AttributionMode = 'culoca' | 'original' | 'none';

export type ResolvedAttribution = {
  creatorName: string;
  photographerName: string;
  creatorIsOrganization: boolean;
  creditText: string;
  authorMeta: string;
  copyrightHolderName: string;
  copyrightNotice: string;
  licenseUrl: string;
};

function fixEncoding(value: string | null | undefined): string | null {
  if (!value) return null;
  return fixTextEncodingIfNeeded(value) ?? value;
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    const fixed = fixEncoding(v);
    if (fixed && fixed.trim()) return fixed.trim();
  }
  return null;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function splitTokens(value: string): string[] {
  return normalizeWhitespace(value)
    .split(' ')
    .map((t) => t.trim())
    .filter(Boolean);
}

function isProbablyOrganizationName(value: string): boolean {
  const v = value.trim();
  // Heuristik: typische Rechtsformen
  return /(GmbH|AG|KG|OHG|e\.?V\.?|Stiftung|Verband|Ltd\.?|LLC|S\.?A\.?)/i.test(v);
}

function isProbablyUrlOrDomain(value: string): boolean {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return true;
  if (/^www\./i.test(v)) return true;
  if (v.includes('/')) return true;
  // Domain ohne Leerzeichen ist sehr wahrscheinlich „URL-only“ (nicht Firmenname)
  if (!v.includes(' ') && /\w+\.\w+/.test(v)) return true;
  return false;
}

function sanitizeCopyrightHolderCandidate(exifValue: string, fallback: string): string {
  let v = fixEncoding(exifValue) ?? exifValue;
  v = v.replace(/\s*\|\s*culoca\.com\s*$/i, '').trim();
  // Falls noch immer „… | …“ drin ist: ersten Block nutzen (Domain-Müll vermeiden)
  if (v.includes('|')) v = v.split('|')[0].trim();
  v = normalizeWhitespace(v);
  if (!v) return fallback;

  // Domain/URL-like Strings verwerfen, sofern es kein offensichtlicher Rechtsform-Titel ist
  if (isProbablyUrlOrDomain(v) && !isProbablyOrganizationName(v)) return fallback;
  return v;
}

function normalizePersonOrder(candidate: string, expected: string | null | undefined): string {
  const c = normalizeWhitespace(fixEncoding(candidate) ?? candidate);
  if (!expected) return c;

  const e = normalizeWhitespace(fixEncoding(expected) ?? expected);
  const eTokens = splitTokens(e);
  const cTokens = splitTokens(c);
  if (c.includes(',')) {
    // „Last, First“ -> „First Last“
    const [lastPart, firstPart] = c.split(',', 2);
    const last = normalizeWhitespace(lastPart || '');
    const first = normalizeWhitespace(firstPart || '');
    if (last && first) return `${first} ${last}`;
  }

  if (eTokens.length >= 2 && cTokens.length === 2) {
    const firstExpected = eTokens[0];
    const lastExpected = eTokens[eTokens.length - 1];
    const [t1, t2] = cTokens;
    if (t1.toLowerCase() === lastExpected.toLowerCase() && t2.toLowerCase() === firstExpected.toLowerCase()) {
      return `${t2} ${t1}`;
    }
  }

  return c;
}

function applySimpleTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = vars[String(key)];
    return v ?? '';
  });
}

function computeDefaultCopyrightNotice(holderName: string): string {
  const year = new Date().getFullYear();
  return `© ${year} ${holderName}. Alle Rechte vorbehalten.`;
}

/**
 * Public Attribution-Resolver für Item-Seiten.
 * - mode='culoca' nutzt Profil-Defaults und optionale EXIF-Overrides (per Booleans).
 * - mode='original' nutzt hauptsächlich EXIF (keine Culoca-„| culoca.com“-Strings), bleibt aber robust gegen Encoding/Müll.
 */
export function resolveAttribution(params: {
  exifData: Record<string, unknown> | null | undefined;
  profile: AttributionProfileSettings;
  mode: AttributionMode;
}): ResolvedAttribution {
  const { exifData, profile, mode } = params;
  const extracted = extractPhotoMetadataFields(exifData || {});

  const profileCreatorDefault =
    firstNonEmpty(profile?.default_creator_name, profile?.display_name_public, profile?.full_name, profile?.accountname) ||
    'Unbekannt';

  const profileHolderDefault =
    firstNonEmpty(profile?.copyright_holder_name, profile?.legal_entity_name, profile?.organization_name) ||
    profileCreatorDefault;

  const expectedName = firstNonEmpty(profileCreatorDefault, profile?.display_name_public, profile?.full_name, profile?.accountname);

  const exifCreatorRaw = extracted.creator ?? null;
  const exifCreatorNorm = exifCreatorRaw
    ? normalizePersonOrder(exifCreatorRaw, expectedName)
    : null;

  const exifCopyrightRaw = extracted.copyright ?? null;

  const creatorFromProfile = profileCreatorDefault;
  const creatorFromExif = exifCreatorNorm ?? creatorFromProfile;

  const useExifCreator = mode === 'culoca' && !!profile?.use_exif_creator_override && !!exifCreatorRaw;
  const creatorName = useExifCreator ? creatorFromExif : creatorFromProfile;

  const useExifCredit = mode === 'culoca' && !!profile?.use_exif_credit_override && !!exifCreatorRaw;
  const creatorForCredit = useExifCredit ? creatorFromExif : creatorName;

  const creditTextTemplate = mode === 'culoca' ? profile?.default_credit_text : null;
  const creditText =
    (creditTextTemplate && creditTextTemplate.trim().length > 0
      ? applySimpleTemplate(creditTextTemplate, { creator: creatorForCredit })
      : `Foto: ${creatorForCredit}`) || `Foto: ${creatorForCredit}`;

  const useExifCopyright = mode === 'culoca' && !!profile?.use_exif_copyright_override && !!exifCopyrightRaw;
  const copyrightHolderName = useExifCopyright && exifCopyrightRaw
    ? sanitizeCopyrightHolderCandidate(exifCopyrightRaw, profileHolderDefault)
    : profileHolderDefault;

  const copyrightNoticeTemplate = mode === 'culoca' ? profile?.default_copyright_notice : null;
  const copyrightNotice =
    (copyrightNoticeTemplate && copyrightNoticeTemplate.trim().length > 0
      ? applySimpleTemplate(copyrightNoticeTemplate, { year: String(new Date().getFullYear()), copyrightHolder: copyrightHolderName, holder: copyrightHolderName, creator: creatorName })
      : computeDefaultCopyrightNotice(copyrightHolderName)) || computeDefaultCopyrightNotice(copyrightHolderName);

  const authorMetaTemplate = mode === 'culoca' ? profile?.default_author_meta : null;
  const authorMeta =
    (authorMetaTemplate && authorMetaTemplate.trim().length > 0
      ? applySimpleTemplate(authorMetaTemplate, { creator: creatorName, copyrightHolder: copyrightHolderName })
      : creatorName) || creatorName;

  const licenseUrl =
    firstNonEmpty(profile?.default_license_url) || 'https://culoca.com/web/license';

  return {
    creatorName,
    photographerName: creatorName,
    creatorIsOrganization: isProbablyOrganizationName(creatorName),
    creditText: creditText,
    authorMeta,
    copyrightHolderName,
    copyrightNotice,
    licenseUrl
  };
}

