export type GeoLevelKey = 'country' | 'state' | 'region' | 'district' | 'municipality';

export type GeoHierarchyInput = {
  countrySlug?: string | null;
  countryName?: string | null;
  stateSlug?: string | null;
  stateName?: string | null;
  regionSlug?: string | null;
  regionName?: string | null;
  districtSlug?: string | null;
  districtName?: string | null;
  municipalitySlug?: string | null;
  municipalityName?: string | null;
};

export type GeoHierarchyLevel = {
  key: GeoLevelKey;
  slug: string;
  label: string;
  path: string;
};

const GEO_LEVEL_ORDER: GeoLevelKey[] = ['country', 'state', 'region', 'district', 'municipality'];
const COUNTRY_SLUG_ALIASES: Record<string, string> = {
  deutschland: 'de',
  germany: 'de',
  osterreich: 'at',
  oesterreich: 'at',
  austria: 'at',
  schweiz: 'ch',
  switzerland: 'ch',
  suisse: 'ch',
  svizzera: 'ch',
  luxemburg: 'lu',
  luxembourg: 'lu',
  monaco: 'mc'
};
const GEO_SLUG_ALIASES: Partial<Record<GeoLevelKey, Record<string, string>>> = {
  district: {
    altotting: 'altoetting'
  }
};

function transliterateGerman(value: string): string {
  return value
    .replace(/Ä/g, 'Ae')
    .replace(/Ö/g, 'Oe')
    .replace(/Ü/g, 'Ue')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

function stripGeoDecorators(value: string, key: GeoLevelKey): string {
  if (key !== 'district') return value;
  return value
    .replace(/\b(Landkreis|Kreis|Bezirk|Region)\b/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeGeoSlug(value: string | null | undefined, key?: GeoLevelKey): string {
  const normalizedValue = key ? stripGeoDecorators(value || '', key) : value || '';
  const normalized = transliterateGerman(normalizedValue)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  if (key === 'country') {
    return COUNTRY_SLUG_ALIASES[normalized] || normalized;
  }

  if (key) {
    return GEO_SLUG_ALIASES[key]?.[normalized] || normalized;
  }

  return normalized;
}

function labelFallback(key: GeoLevelKey, slug: string): string {
  switch (key) {
    case 'country':
      return slug.toUpperCase();
    case 'state':
      return 'Bundesland';
    case 'region':
      return 'Region';
    case 'district':
      return 'Landkreis';
    case 'municipality':
      return 'Gemeinde';
  }
}

function normalizeGeoLabel(value: string | null | undefined, key?: GeoLevelKey): string | null {
  const normalized = (key ? stripGeoDecorators(value || '', key) : value || '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || null;
}

/** Anzeigename ohne „Landkreis/Kreis/Bezirk/Region“ im Namen (wie in {@link buildGeoHierarchy}). */
export function formatGeoDistrictDisplayName(value: string | null | undefined): string | null {
  return normalizeGeoLabel(value, 'district');
}

function buildLevelDescriptor(
  key: GeoLevelKey,
  slug: string | null | undefined,
  label: string | null | undefined
) {
  const normalizedSlug = normalizeGeoSlug(slug, key);
  if (!normalizedSlug) return null;

  const normalizedLabel = normalizeGeoLabel(label, key) || labelFallback(key, normalizedSlug);
  return {
    key,
    slug: normalizedSlug,
    label: normalizedLabel
  };
}

export function buildGeoHierarchy(input: GeoHierarchyInput): GeoHierarchyLevel[] {
  const candidates = [
    buildLevelDescriptor('country', input.countrySlug, input.countryName),
    buildLevelDescriptor('state', input.stateSlug, input.stateName),
    buildLevelDescriptor('region', input.regionSlug, input.regionName),
    buildLevelDescriptor('district', input.districtSlug, input.districtName),
    buildLevelDescriptor('municipality', input.municipalitySlug, input.municipalityName)
  ].filter(Boolean) as Array<{ key: GeoLevelKey; slug: string; label: string }>;

  const deduped: Array<{ key: GeoLevelKey; slug: string; label: string }> = [];
  for (const candidate of candidates) {
    const previous = deduped[deduped.length - 1];
    if (previous?.slug === candidate.slug) continue;
    deduped.push(candidate);
  }

  const parts: string[] = [];
  return deduped.map((level) => {
    parts.push(level.slug);
    return {
      ...level,
      path: `/${parts.join('/')}`
    };
  });
}

export function getGeoLevelOrderIndex(key: GeoLevelKey): number {
  return GEO_LEVEL_ORDER.indexOf(key);
}

export function getDeepestGeoLevel(levels: GeoHierarchyLevel[]): GeoHierarchyLevel | null {
  return levels.length ? levels[levels.length - 1] : null;
}

export function getGeoLevel(levels: GeoHierarchyLevel[], key: GeoLevelKey): GeoHierarchyLevel | null {
  return levels.find((level) => level.key === key) || null;
}

export function buildGeoHubPath(input: GeoHierarchyInput, deepestKey?: GeoLevelKey | null): string | null {
  const levels = buildGeoHierarchy(input);
  if (!levels.length) return null;
  if (!deepestKey) return levels[levels.length - 1].path;

  const target = getGeoLevel(levels, deepestKey);
  return target?.path || null;
}

export function buildGeoItemPath(
  input: GeoHierarchyInput & {
    itemSlug?: string | null;
  }
): string | null {
  const itemSlug = normalizeGeoSlug(input.itemSlug);
  if (!itemSlug) return null;

  const countrySlug = normalizeGeoSlug(input.countrySlug);
  const districtSlug = normalizeGeoSlug(input.districtSlug, 'district');
  const municipalitySlug = normalizeGeoSlug(input.municipalitySlug);

  if (!countrySlug || !districtSlug || !municipalitySlug) return null;

  return `/${countrySlug}/${districtSlug}/${municipalitySlug}/${itemSlug}`;
}

export function hasGeoItemHierarchy(input: GeoHierarchyInput): boolean {
  return !!(
    normalizeGeoSlug(input.countrySlug) &&
    normalizeGeoSlug(input.districtSlug, 'district') &&
    normalizeGeoSlug(input.municipalitySlug)
  );
}

export function getGeoChildLevelKey(
  rows: GeoHierarchyInput[],
  currentKey: GeoLevelKey
): GeoLevelKey | null {
  const startIndex = getGeoLevelOrderIndex(currentKey) + 1;
  if (startIndex <= 0) return null;

  for (const key of GEO_LEVEL_ORDER.slice(startIndex)) {
    const hasAnyValue = rows.some((row) => {
      const levels = buildGeoHierarchy(row);
      return levels.some((level) => level.key === key);
    });
    if (hasAnyValue) return key;
  }

  return null;
}
