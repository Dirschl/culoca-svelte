import { slugifySegment } from '$lib/content/routing';

export type ParsedFilenameLocation = {
  countryCode: string;
  districtCode: string;
  municipalityName: string;
  motifLabel: string;
  photographerLabel: string | null;
  sourceFilename: string;
};

export type ItemLocationInference = ParsedFilenameLocation & {
  countryName: string | null;
  countrySlug: string;
  stateName: string | null;
  stateSlug: string | null;
  regionName: string | null;
  regionSlug: string | null;
  districtName: string | null;
  districtPublicName: string | null;
  municipalitySlug: string;
  localityName?: string | null;
  districtSlug: string;
  motifSlug: string;
  confidence: number;
  source: 'original_name';
};

type CountryMetadata = { name: string; slug: string };
type DistrictMetadata = {
  name: string;
  slug: string;
  stateName?: string | null;
  stateSlug?: string | null;
  regionName?: string | null;
  regionSlug?: string | null;
};

const COUNTRY_METADATA: Record<string, CountryMetadata> = {
  D: { name: 'Deutschland', slug: 'de' },
  A: { name: 'Österreich', slug: 'at' },
  CH: { name: 'Schweiz', slug: 'ch' }
};

const DISTRICT_METADATA: Record<string, DistrictMetadata> = {
  'AÖ': { name: 'Landkreis Altötting', slug: 'altoetting', stateName: 'Bayern', stateSlug: 'bayern', regionName: 'Oberbayern', regionSlug: 'oberbayern' },
  'AÖ': { name: 'Landkreis Altötting', slug: 'altoetting', stateName: 'Bayern', stateSlug: 'bayern', regionName: 'Oberbayern', regionSlug: 'oberbayern' },
  PAN: { name: 'Landkreis Rottal-Inn', slug: 'rottal-inn', stateName: 'Bayern', stateSlug: 'bayern', regionName: 'Niederbayern', regionSlug: 'niederbayern' },
  FRG: { name: 'Landkreis Freyung-Grafenau', slug: 'freyung-grafenau', stateName: 'Bayern', stateSlug: 'bayern', regionName: 'Niederbayern', regionSlug: 'niederbayern' },
  PA: { name: 'Landkreis Passau', slug: 'passau', stateName: 'Bayern', stateSlug: 'bayern', regionName: 'Niederbayern', regionSlug: 'niederbayern' },
  MUE: { name: 'Landkreis Mühldorf am Inn', slug: 'muehldorf-am-inn', stateName: 'Bayern', stateSlug: 'bayern', regionName: 'Oberbayern', regionSlug: 'oberbayern' },
  MÜ: { name: 'Landkreis Mühldorf am Inn', slug: 'muehldorf-am-inn', stateName: 'Bayern', stateSlug: 'bayern', regionName: 'Oberbayern', regionSlug: 'oberbayern' },
  REG: { name: 'Landkreis Regen', slug: 'regen', stateName: 'Bayern', stateSlug: 'bayern', regionName: 'Niederbayern', regionSlug: 'niederbayern' },
  TS: { name: 'Landkreis Traunstein', slug: 'traunstein', stateName: 'Bayern', stateSlug: 'bayern', regionName: 'Oberbayern', regionSlug: 'oberbayern' },
  BGL: { name: 'Landkreis Berchtesgadener Land', slug: 'berchtesgadener-land', stateName: 'Bayern', stateSlug: 'bayern', regionName: 'Oberbayern', regionSlug: 'oberbayern' },
  ED: { name: 'Landkreis Erding', slug: 'erding', stateName: 'Bayern', stateSlug: 'bayern', regionName: 'Oberbayern', regionSlug: 'oberbayern' },
  DEG: { name: 'Landkreis Deggendorf', slug: 'deggendorf', stateName: 'Bayern', stateSlug: 'bayern', regionName: 'Niederbayern', regionSlug: 'niederbayern' },
  CHA: { name: 'Landkreis Cham', slug: 'cham', stateName: 'Bayern', stateSlug: 'bayern', regionName: 'Oberpfalz', regionSlug: 'oberpfalz' },
  PI: { name: 'Kreis Pinneberg', slug: 'pinneberg', stateName: 'Schleswig-Holstein', stateSlug: 'schleswig-holstein', regionName: null, regionSlug: null },
  RÜG: { name: 'Landkreis Vorpommern-Rügen', slug: 'vorpommern-ruegen', stateName: 'Mecklenburg-Vorpommern', stateSlug: 'mecklenburg-vorpommern', regionName: null, regionSlug: null },
  'RÜG': { name: 'Landkreis Vorpommern-Rügen', slug: 'vorpommern-ruegen', stateName: 'Mecklenburg-Vorpommern', stateSlug: 'mecklenburg-vorpommern', regionName: null, regionSlug: null },
  M: { name: 'München', slug: 'muenchen', stateName: 'Bayern', stateSlug: 'bayern', regionName: 'Oberbayern', regionSlug: 'oberbayern' },
  R: { name: 'Landkreis Regensburg', slug: 'regensburg', stateName: 'Bayern', stateSlug: 'bayern', regionName: 'Oberpfalz', regionSlug: 'oberpfalz' },
  BR: { name: 'Bezirk Braunau am Inn', slug: 'braunau-am-inn', stateName: 'Oberösterreich', stateSlug: 'oberoesterreich', regionName: 'Innviertel', regionSlug: 'innviertel' },
  RI: { name: 'Bezirk Ried im Innkreis', slug: 'ried-im-innkreis', stateName: 'Oberösterreich', stateSlug: 'oberoesterreich', regionName: 'Innviertel', regionSlug: 'innviertel' },
  JO: { name: 'Bezirk St. Johann im Pongau', slug: 'st-johann-im-pongau', stateName: 'Salzburg', stateSlug: 'salzburg', regionName: 'Pongau', regionSlug: 'pongau' },
  KB: { name: 'Bezirk Kitzbühel', slug: 'kitzbuehel', stateName: 'Tirol', stateSlug: 'tirol', regionName: 'Unterland', regionSlug: 'unterland' },
  BERLIN: { name: 'Berlin', slug: 'berlin', stateName: 'Berlin', stateSlug: 'berlin', regionName: 'Berlin', regionSlug: 'berlin' },
  HAMBURG: { name: 'Hamburg', slug: 'hamburg', stateName: 'Hamburg', stateSlug: 'hamburg', regionName: 'Hamburg', regionSlug: 'hamburg' },
  BREMEN: { name: 'Bremen', slug: 'bremen', stateName: 'Bremen', stateSlug: 'bremen', regionName: 'Bremen', regionSlug: 'bremen' }
};

export type AdministrativeHierarchy = {
  countryName: string | null;
  countrySlug: string | null;
  stateName: string | null;
  stateSlug: string | null;
  regionName: string | null;
  regionSlug: string | null;
  districtName: string | null;
  districtSlug: string | null;
};

const DISPLAY_LABEL_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bOesterreich\b/gu, 'Österreich'],
  [/\bOberoesterreich\b/gu, 'Oberösterreich'],
  [/\bMuehldorf\b/gu, 'Mühldorf'],
  [/\bMuenchen\b/gu, 'München'],
  [/\bKitzbuehel\b/gu, 'Kitzbühel'],
  [/\bAlt[oö]tting\b/gu, 'Altötting']
];

export function normalizeAdminDisplayLabel(value: string | null | undefined): string | null {
  if (!value) return null;

  let normalized = normalizeUnicode(value);
  for (const [pattern, replacement] of DISPLAY_LABEL_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized || null;
}

export function getAdministrativeHierarchy(args: {
  countryCode?: string | null;
  countrySlug?: string | null;
  countryName?: string | null;
  districtCode?: string | null;
  districtSlug?: string | null;
  districtName?: string | null;
}): AdministrativeHierarchy {
  const countryMeta =
    (args.countryCode ? COUNTRY_METADATA[args.countryCode] : null) ||
    Object.values(COUNTRY_METADATA).find((entry) => entry.slug === args.countrySlug) ||
    null;
  const districtMeta =
    (args.districtCode ? DISTRICT_METADATA[args.districtCode] : null) ||
    Object.values(DISTRICT_METADATA).find(
      (entry) => entry.slug === args.districtSlug || entry.name === args.districtName
    ) ||
    null;

  return {
    countryName: normalizeAdminDisplayLabel(args.countryName || countryMeta?.name || null),
    countrySlug: args.countrySlug || countryMeta?.slug || null,
    stateName: normalizeAdminDisplayLabel(districtMeta?.stateName || null),
    stateSlug: districtMeta?.stateSlug || null,
    regionName: normalizeAdminDisplayLabel(districtMeta?.regionName || null),
    regionSlug: districtMeta?.regionSlug || null,
    districtName: normalizeAdminDisplayLabel(args.districtName || districtMeta?.name || null),
    districtSlug: args.districtSlug || districtMeta?.slug || null
  };
}

function stripExtension(value: string): string {
  return value.replace(/\.[a-z0-9]{2,5}$/i, '');
}

function normalizeUnicode(value: string): string {
  return value.normalize('NFC').replace(/\s+/g, ' ').trim();
}

function sanitizeToken(value: string): string {
  return normalizeUnicode(value)
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeComparableSlug(value: string): string {
  return slugifySegment(value || '');
}

function stripDistrictDecorators(value: string): string {
  return normalizeUnicode(value)
    .replace(/\b(Landkreis|Kreis|Bezirk|Region)\b/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveDistrictMetadata(token: string | null | undefined): DistrictMetadata | null {
  const normalizedToken = sanitizeToken(token || '');
  if (!normalizedToken) return null;

  const exact = DISTRICT_METADATA[normalizedToken.toUpperCase()];
  if (exact) return exact;

  const comparable = normalizeComparableSlug(stripDistrictDecorators(normalizedToken));
  if (!comparable) return null;

  return (
    Object.values(DISTRICT_METADATA).find((entry) => {
      const comparableName = normalizeComparableSlug(stripDistrictDecorators(entry.name));
      const comparableSlug = normalizeComparableSlug(entry.slug);
      return comparable === comparableName || comparable === comparableSlug;
    }) || null
  );
}

function extractPhotographerLabel(detail: string): { motifLabel: string; photographerLabel: string | null } {
  const photographerMatch = detail.match(/\(([^)]+)\)/u);
  const photographerLabel = photographerMatch ? sanitizeToken(photographerMatch[1]) : null;

  const withoutPhotographer = detail.replace(/\s*\([^)]*\)\s*/gu, ' ').trim();
  const withoutCameraSuffix = withoutPhotographer
    .replace(/\s+[_-]?\s*[A-Z0-9-]{3,}$/u, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    motifLabel: withoutCameraSuffix || withoutPhotographer || detail,
    photographerLabel
  };
}

export function parseOriginalFilenameLocation(originalName: string | null | undefined): ParsedFilenameLocation | null {
  if (!originalName) return null;

  const normalized = normalizeUnicode(stripExtension(originalName));
  const match = normalized.match(/^([A-Z]{1,3})_([^_]+)_([^_]+)_(.+)$/u);

  if (!match) {
    return null;
  }

  const [, countryCodeRaw, districtCodeRaw, municipalityRaw, detailRaw] = match;
  const detail = sanitizeToken(detailRaw);
  const municipalityName = sanitizeToken(municipalityRaw);
  const districtCode = sanitizeToken(districtCodeRaw).toUpperCase();
  const countryCode = sanitizeToken(countryCodeRaw).toUpperCase();
  const { motifLabel, photographerLabel } = extractPhotographerLabel(detail);

  if (!countryCode || !districtCode || !municipalityName || !motifLabel) {
    return null;
  }

  return {
    countryCode,
    districtCode,
    municipalityName,
    motifLabel,
    photographerLabel,
    sourceFilename: originalName
  };
}

export function inferLocationTaxonomyFromOriginalName(
  originalName: string | null | undefined
): ItemLocationInference | null {
  const parsed = parseOriginalFilenameLocation(originalName);
  if (!parsed) return null;

  const countryMeta = COUNTRY_METADATA[parsed.countryCode] || null;
  const districtMeta = resolveDistrictMetadata(parsed.districtCode);
  const countryName = countryMeta?.name || null;
  const districtName = districtMeta?.name || null;

  let confidence = 0.7;
  if (countryName) confidence += 0.1;
  if (districtName) confidence += 0.1;
  if (parsed.photographerLabel) confidence += 0.05;
  if (parsed.motifLabel.length >= 6) confidence += 0.05;

  return {
    ...parsed,
    countryName: normalizeAdminDisplayLabel(countryName),
    countrySlug: countryMeta?.slug || slugifySegment(parsed.countryCode),
    stateName: normalizeAdminDisplayLabel(districtMeta?.stateName || null),
    stateSlug: districtMeta?.stateSlug || null,
    regionName: normalizeAdminDisplayLabel(districtMeta?.regionName || null),
    regionSlug: districtMeta?.regionSlug || null,
    districtName: normalizeAdminDisplayLabel(districtName),
    districtPublicName: normalizeAdminDisplayLabel(districtName),
    municipalitySlug: slugifySegment(parsed.municipalityName),
    districtSlug: districtMeta?.slug || slugifySegment(districtName || parsed.districtCode),
    motifSlug: slugifySegment(parsed.motifLabel),
    confidence: Math.min(1, confidence),
    source: 'original_name'
  };
}

export function findMunicipalityPrefixCandidate(
  rawMunicipalityName: string | null | undefined,
  candidates: string[]
): string | null {
  const rawSlug = normalizeComparableSlug(rawMunicipalityName || '');
  if (!rawSlug) return null;

  let bestMatch: string | null = null;
  let bestLength = 0;

  for (const candidate of candidates) {
    const candidateSlug = normalizeComparableSlug(candidate);
    if (!candidateSlug) continue;
    const isMatch = rawSlug === candidateSlug || rawSlug.startsWith(`${candidateSlug}-`);
    if (!isMatch) continue;
    if (candidateSlug.length > bestLength) {
      bestMatch = candidate;
      bestLength = candidateSlug.length;
    }
  }

  return bestMatch;
}

export function refineInferenceWithMunicipalityCandidates(
  inference: ItemLocationInference,
  candidates: string[]
): ItemLocationInference {
  const municipalityMatch = findMunicipalityPrefixCandidate(inference.municipalityName, candidates);
  if (!municipalityMatch || municipalityMatch === inference.municipalityName) {
    return inference;
  }

  return {
    ...inference,
    municipalityName: municipalityMatch,
    municipalitySlug: slugifySegment(municipalityMatch),
    confidence: Math.min(1, inference.confidence + 0.08)
  };
}

export function buildStructuredItemSlugParts(inference: ItemLocationInference): string[] {
  const parts = [
    inference.motifSlug,
    inference.municipalitySlug,
    inference.districtSlug,
    inference.countrySlug
  ].filter(Boolean);

  return Array.from(new Set(parts));
}
