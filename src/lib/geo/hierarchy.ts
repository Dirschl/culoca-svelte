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

function normalizeGeoSlug(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
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

function normalizeGeoLabel(value: string | null | undefined): string | null {
  const normalized = value?.normalize('NFC').replace(/\s+/g, ' ').trim();
  return normalized || null;
}

function buildLevelDescriptor(
  key: GeoLevelKey,
  slug: string | null | undefined,
  label: string | null | undefined
) {
  const normalizedSlug = normalizeGeoSlug(slug);
  if (!normalizedSlug) return null;

  const normalizedLabel = normalizeGeoLabel(label) || labelFallback(key, normalizedSlug);
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

  const hubPath = buildGeoHubPath(input, 'municipality');
  if (!hubPath) return null;

  return `${hubPath}/${itemSlug}`;
}

export function hasGeoItemHierarchy(input: GeoHierarchyInput): boolean {
  return !!(
    normalizeGeoSlug(input.countrySlug) &&
    normalizeGeoSlug(input.districtSlug) &&
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
