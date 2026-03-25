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

const UNKNOWN = 'Unbekannt';

/** Werte, die nicht als echte Attribution-Quelle gelten (auch nicht statt EXIF). */
export function isMeaningfulAttributionValue(value: unknown): boolean {
  if (value == null) return false;
  const s = typeof value === 'string' ? value.trim() : String(value).trim();
  if (!s) return false;
  const lower = s.toLowerCase();
  if (lower === UNKNOWN.toLowerCase()) return false;
  if (lower === 'unknown') return false;
  if (lower === 'n/a' || lower === 'n.a.' || lower === 'na') return false;
  if (lower === '-' || lower === '—' || lower === 'tbd') return false;
  return true;
}

function fixEncoding(value: string | null | undefined): string | null {
  if (!value) return null;
  return fixTextEncodingIfNeeded(value) ?? value;
}

function firstMeaningfulString(...values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    const fixed = fixEncoding(v);
    if (isMeaningfulAttributionValue(fixed)) return normalizeWhitespace(fixed!);
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
  return /(GmbH|AG|KG|OHG|e\.?V\.?|Stiftung|Verband|Ltd\.?|LLC|S\.?A\.?)/i.test(v);
}

/**
 * EXIF-/XMP-Copyright-Zeile für den Halter-Namen normalisieren.
 * Domains und URLs sind gültige Halter (z. B. www.dirschl.com); nur Platzhalter wie „Unbekannt“ verwerfen.
 */
function normalizeCopyrightHolderFromExif(exifValue: string | null | undefined): string | null {
  let v = fixEncoding(exifValue) ?? (exifValue != null ? String(exifValue) : '');
  v = v.replace(/\s*\|\s*culoca\.com\s*$/i, '').trim();
  if (v.includes('|')) v = v.split('|')[0].trim();
  v = normalizeWhitespace(v);
  if (!isMeaningfulAttributionValue(v)) return null;
  return v;
}

function normalizePersonOrder(candidate: string, expected: string | null | undefined): string {
  const c = normalizeWhitespace(fixEncoding(candidate) ?? candidate);
  if (!isMeaningfulAttributionValue(c)) return c;
  if (!isMeaningfulAttributionValue(expected)) return c;

  const e = normalizeWhitespace((fixEncoding(expected) ?? expected) ?? '');
  const eTokens = splitTokens(e);
  const cTokens = splitTokens(c);
  if (c.includes(',')) {
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

export function resolveAttribution(params: {
  exifData: Record<string, unknown> | null | undefined;
  profile: AttributionProfileSettings;
  mode: AttributionMode;
  itemFullNameFallback?: string | null;
}): ResolvedAttribution {
  const { exifData, profile, mode, itemFullNameFallback } = params;
  const extracted = extractPhotoMetadataFields(exifData || {});

  const profileCreator = firstMeaningfulString(
    profile?.default_creator_name,
    profile?.display_name_public,
    profile?.public_contact_name,
    profile?.full_name,
    profile?.accountname
  );

  const exifCreatorRaw = firstMeaningfulString(extracted.creator);

  const expectedForOrder = firstMeaningfulString(
    profile?.default_creator_name,
    profile?.display_name_public,
    profile?.full_name
  );

  const exifCreatorNormalized = exifCreatorRaw
    ? normalizePersonOrder(exifCreatorRaw, expectedForOrder)
    : null;

  const itemFallback = firstMeaningfulString(itemFullNameFallback);

  const useExifCreator = !!profile?.use_exif_creator_override;
  let creatorName: string;
  if (useExifCreator && exifCreatorNormalized) {
    creatorName = exifCreatorNormalized;
  } else if (profileCreator) {
    creatorName = profileCreator;
  } else if (exifCreatorNormalized) {
    creatorName = exifCreatorNormalized;
  } else if (itemFallback) {
    creatorName = itemFallback;
  } else {
    creatorName = UNKNOWN;
  }

  const useExifCredit = !!profile?.use_exif_credit_override;
  const creatorForCredit =
    useExifCredit && exifCreatorNormalized ? exifCreatorNormalized : creatorName;

  const creditTextTemplate = mode === 'culoca' ? profile?.default_credit_text : null;
  const creditText =
    creditTextTemplate && creditTextTemplate.trim().length > 0
      ? applySimpleTemplate(creditTextTemplate, { creator: creatorForCredit })
      : `Foto: ${creatorForCredit}`;

  const profileHolderExplicit = firstMeaningfulString(
    profile?.copyright_holder_name,
    profile?.legal_entity_name,
    profile?.organization_name
  );

  const exifCopyrightNoticeHolder = normalizeCopyrightHolderFromExif(extracted.copyrightNotice);
  const exifCopyrightTagHolder = normalizeCopyrightHolderFromExif(extracted.copyrightFromTag);

  const profileHolderFallback = firstMeaningfulString(
    profile?.display_name_public,
    profile?.full_name,
    profile?.accountname,
    profile?.public_contact_name
  );

  const useExifCopyright = !!profile?.use_exif_copyright_override;
  let copyrightHolderName: string;
  if (useExifCopyright) {
    copyrightHolderName =
      exifCopyrightNoticeHolder ??
      exifCopyrightTagHolder ??
      profileHolderExplicit ??
      profileHolderFallback ??
      UNKNOWN;
  } else {
    copyrightHolderName =
      profileHolderExplicit ??
      exifCopyrightNoticeHolder ??
      exifCopyrightTagHolder ??
      profileHolderFallback ??
      UNKNOWN;
  }

  const copyrightNoticeTemplate = mode === 'culoca' ? profile?.default_copyright_notice : null;
  const copyrightNotice =
    copyrightNoticeTemplate && copyrightNoticeTemplate.trim().length > 0
      ? applySimpleTemplate(copyrightNoticeTemplate, {
          year: String(new Date().getFullYear()),
          copyrightHolder: copyrightHolderName,
          holder: copyrightHolderName,
          creator: creatorName
        })
      : computeDefaultCopyrightNotice(copyrightHolderName);

  const authorMetaTemplate = mode === 'culoca' ? profile?.default_author_meta : null;
  const authorMeta =
    authorMetaTemplate && authorMetaTemplate.trim().length > 0
      ? applySimpleTemplate(authorMetaTemplate, { creator: creatorName, copyrightHolder: copyrightHolderName })
      : creatorName;

  const licenseUrl =
    firstMeaningfulString(profile?.default_license_url) || 'https://culoca.com/web/license';

  return {
    creatorName,
    photographerName: creatorName,
    creatorIsOrganization: isProbablyOrganizationName(creatorName),
    creditText,
    authorMeta,
    copyrightHolderName,
    copyrightNotice,
    licenseUrl
  };
}
