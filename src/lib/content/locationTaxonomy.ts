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
  BRAUNAU: { name: 'Bezirk Braunau am Inn', slug: 'braunau', stateName: 'Oberösterreich', stateSlug: 'oberoesterreich', regionName: 'Innviertel', regionSlug: 'innviertel' },
  BR: { name: 'Bezirk Braunau am Inn', slug: 'braunau', stateName: 'Oberösterreich', stateSlug: 'oberoesterreich', regionName: 'Innviertel', regionSlug: 'innviertel' },
  RI: { name: 'Bezirk Ried im Innkreis', slug: 'ried-im-innkreis', stateName: 'Oberösterreich', stateSlug: 'oberoesterreich', regionName: 'Innviertel', regionSlug: 'innviertel' },
  JO: { name: 'Bezirk St. Johann im Pongau', slug: 'st-johann-im-pongau', stateName: 'Salzburg', stateSlug: 'salzburg', regionName: 'Pongau', regionSlug: 'pongau' },
  KB: { name: 'Bezirk Kitzbühel', slug: 'kitzbuehel', stateName: 'Tirol', stateSlug: 'tirol', regionName: 'Unterland', regionSlug: 'unterland' },
  BERLIN: { name: 'Berlin', slug: 'berlin', stateName: 'Berlin', stateSlug: 'berlin', regionName: 'Berlin', regionSlug: 'berlin' },
  HAMBURG: { name: 'Hamburg', slug: 'hamburg', stateName: 'Hamburg', stateSlug: 'hamburg', regionName: 'Hamburg', regionSlug: 'hamburg' },
  BREMEN: { name: 'Bremen', slug: 'bremen', stateName: 'Bremen', stateSlug: 'bremen', regionName: 'Bremen', regionSlug: 'bremen' }
};

/** Landkreis-/Bezirksslugs aus der statischen Taxonomie (wenn `state_slug` in der DB fehlt). */
export function getDistrictSlugsForBundesland(stateSlug: string): string[] {
  const want = stateSlug.trim().toLowerCase();
  const out = new Set<string>();
  for (const meta of Object.values(DISTRICT_METADATA)) {
    if (meta.stateSlug?.toLowerCase() === want && meta.slug) out.add(meta.slug);
  }
  return Array.from(out);
}

/** Landkreise, die einer Region (Regierungsbezirk o. ä.) in der Taxonomie zugeordnet sind. */
export function getDistrictSlugsForRegion(stateSlug: string, regionSlug: string): string[] {
  const wantState = stateSlug.trim().toLowerCase();
  const wantRegion = regionSlug.trim().toLowerCase();
  const out = new Set<string>();
  for (const meta of Object.values(DISTRICT_METADATA)) {
    if (
      meta.stateSlug?.toLowerCase() === wantState &&
      meta.regionSlug?.toLowerCase() === wantRegion &&
      meta.slug
    ) {
      out.add(meta.slug);
    }
  }
  return Array.from(out);
}

export type AdministrativeHierarchy = {
  countryName: string | null;
  countrySlug: string | null;
  countryResolved: boolean;
  stateName: string | null;
  stateSlug: string | null;
  regionName: string | null;
  regionSlug: string | null;
  districtName: string | null;
  districtSlug: string | null;
  districtResolved: boolean;
};

export type NormalizedCountryInput = {
  slug: string;
  code: string;
  name: string;
};

export type NormalizedGeoDraft = {
  countryCode: string | null;
  countryName: string | null;
  countrySlug: string | null;
  stateName: string | null;
  stateSlug: string | null;
  regionName: string | null;
  regionSlug: string | null;
  districtCode: string | null;
  districtName: string | null;
  districtSlug: string | null;
  municipalityName: string | null;
  municipalitySlug: string | null;
  localityName: string | null;
  taxonomySlugSuffix: string | null;
  locationNeedsReview: boolean;
  hasKnownAdministrativeHierarchy: boolean;
};

const COUNTRY_INPUT_METADATA: Record<string, NormalizedCountryInput> = {
  deutschland: { slug: 'de', code: 'D', name: 'Deutschland' },
  de: { slug: 'de', code: 'D', name: 'Deutschland' },
  oesterreich: { slug: 'at', code: 'A', name: 'Österreich' },
  österreich: { slug: 'at', code: 'A', name: 'Österreich' },
  at: { slug: 'at', code: 'A', name: 'Österreich' },
  schweiz: { slug: 'ch', code: 'CH', name: 'Schweiz' },
  ch: { slug: 'ch', code: 'CH', name: 'Schweiz' }
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
    Object.values(COUNTRY_METADATA).find(
      (entry) =>
        entry.slug === args.countrySlug ||
        normalizeComparableSlug(entry.name) === normalizeComparableSlug(args.countryName || '')
    ) ||
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
    countryResolved: !!countryMeta,
    stateName: normalizeAdminDisplayLabel(districtMeta?.stateName || null),
    stateSlug: districtMeta?.stateSlug || null,
    regionName: normalizeAdminDisplayLabel(districtMeta?.regionName || null),
    regionSlug: districtMeta?.regionSlug || null,
    districtName: normalizeAdminDisplayLabel(args.districtName || districtMeta?.name || null),
    districtSlug: args.districtSlug || districtMeta?.slug || null,
    districtResolved: !!districtMeta
  };
}

export function normalizeCountryInputValue(value: unknown): NormalizedCountryInput | null {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return null;

  const directMatch = COUNTRY_INPUT_METADATA[slugifySegment(text)];
  if (directMatch) return directMatch;

  const countryEntry = Object.entries(COUNTRY_METADATA).find(
    ([code, entry]) =>
      code === text.toUpperCase() ||
      entry.slug === slugifySegment(text) ||
      normalizeComparableSlug(entry.name) === normalizeComparableSlug(text)
  );

  if (countryEntry) {
    const [code, entry] = countryEntry;
    return {
      slug: entry.slug,
      code,
      name: entry.name
    };
  }

  return {
    slug: slugifySegment(text),
    code: text.toUpperCase(),
    name: text
  };
}

export function normalizeGeoDraft(args: {
  countryCode?: string | null;
  countryName?: string | null;
  countrySlug?: string | null;
  districtCode?: string | null;
  districtName?: string | null;
  districtSlug?: string | null;
  municipalityName?: string | null;
  municipalitySlug?: string | null;
  localityName?: string | null;
}): NormalizedGeoDraft | null {
  const normalizedCountry = normalizeCountryInputValue(
    args.countryName || args.countrySlug || args.countryCode
  );
  const districtName = normalizeAdminDisplayLabel(args.districtName) || null;
  const districtSlug = args.districtSlug ? slugifySegment(args.districtSlug) : slugifySegment(districtName || '');
  const municipalityName = normalizeAdminDisplayLabel(args.municipalityName) || null;
  const municipalitySlug = args.municipalitySlug
    ? slugifySegment(args.municipalitySlug)
    : slugifySegment(municipalityName || '');
  const localityName = normalizeAdminDisplayLabel(args.localityName) || null;

  if (!normalizedCountry && !districtName && !districtSlug && !municipalityName && !municipalitySlug) {
    return null;
  }

  const administrativeHierarchy = getAdministrativeHierarchy({
    countryCode: normalizedCountry?.code || args.countryCode || null,
    countrySlug: normalizedCountry?.slug || args.countrySlug || null,
    countryName: normalizedCountry?.name || args.countryName || null,
    districtCode: args.districtCode || null,
    districtSlug: districtSlug || null,
    districtName
  });

  const resolvedCountrySlug = normalizedCountry?.slug || administrativeHierarchy.countrySlug || null;
  const resolvedDistrictSlug = administrativeHierarchy.districtSlug || districtSlug || null;
  const resolvedMunicipalitySlug = municipalitySlug || null;
  const hasKnownAdministrativeHierarchy = administrativeHierarchy.districtResolved;
  const locationNeedsReview = !!(
    !resolvedCountrySlug ||
    !resolvedDistrictSlug ||
    !resolvedMunicipalitySlug ||
    !hasKnownAdministrativeHierarchy
  );

  return {
    countryCode: normalizedCountry?.code || args.countryCode || null,
    countryName:
      normalizeAdminDisplayLabel(normalizedCountry?.name || administrativeHierarchy.countryName || args.countryName) ||
      null,
    countrySlug: resolvedCountrySlug,
    stateName: administrativeHierarchy.stateName,
    stateSlug: administrativeHierarchy.stateSlug,
    regionName: administrativeHierarchy.regionName,
    regionSlug: administrativeHierarchy.regionSlug,
    districtCode: args.districtCode || null,
    districtName: normalizeAdminDisplayLabel(administrativeHierarchy.districtName || districtName) || null,
    districtSlug: resolvedDistrictSlug,
    municipalityName,
    municipalitySlug: resolvedMunicipalitySlug,
    localityName,
    taxonomySlugSuffix:
      [resolvedCountrySlug, resolvedDistrictSlug, resolvedMunicipalitySlug].filter(Boolean).join('-') || null,
    locationNeedsReview,
    hasKnownAdministrativeHierarchy
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

export function getDistrictFilenameToken(token: string | null | undefined): string | null {
  const normalizedToken = sanitizeToken(token || '');
  if (!normalizedToken) return null;

  const exactKey = Object.keys(DISTRICT_METADATA).find((key) => key.toUpperCase() === normalizedToken.toUpperCase());
  if (exactKey) {
    return exactKey;
  }

  const metadata = resolveDistrictMetadata(normalizedToken);
  if (!metadata) {
    return stripDistrictDecorators(normalizedToken) || null;
  }

  const metadataKey = Object.entries(DISTRICT_METADATA).find(([, value]) => value === metadata)?.[0];
  return metadataKey || stripDistrictDecorators(normalizedToken) || null;
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
