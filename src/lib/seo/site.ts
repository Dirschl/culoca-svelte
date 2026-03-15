export const SITE_URL = 'https://culoca.com';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/culoca-see-you-local-entdecke-deine-umgebung.jpg`;
export const DEFAULT_SITE_NAME = 'Culoca';

export type BreadcrumbEntry = {
  name: string;
  path: string;
};

export type GeoPlaceJsonLdInput = {
  currentPath: string;
  currentName: string;
  countryName?: string | null;
  countryPath?: string | null;
  stateName?: string | null;
  regionName?: string | null;
  districtName?: string | null;
  districtPath?: string | null;
  municipalityName?: string | null;
  municipalityPath?: string | null;
  localityName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export function absoluteUrl(path: string): string {
  if (!path) return SITE_URL;
  return path.startsWith('http') ? path : `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function normalizeRobots(value: string): string {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');
}

export function buildBreadcrumbJsonLd(items: BreadcrumbEntry[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path)
    }))
  };
}

function normalizePlaceValue(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  return normalized ? normalized : null;
}

function samePlaceValue(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizePlaceValue(a)?.toLocaleLowerCase('de-DE');
  const right = normalizePlaceValue(b)?.toLocaleLowerCase('de-DE');
  return !!left && !!right && left === right;
}

function placeNodeId(path: string, suffix: string): string {
  return `${absoluteUrl(path)}#${suffix}`;
}

export function buildGeoPlaceGraph(input: GeoPlaceJsonLdInput) {
  const currentPath = input.currentPath.startsWith('http') ? input.currentPath : absoluteUrl(input.currentPath);
  const currentId = `${currentPath}#place`;
  const countryName = normalizePlaceValue(input.countryName);
  const stateName = normalizePlaceValue(input.stateName);
  const regionName = normalizePlaceValue(input.regionName);
  const districtName = normalizePlaceValue(input.districtName);
  const municipalityName = normalizePlaceValue(input.municipalityName);
  const localityName = normalizePlaceValue(input.localityName);
  const currentName =
    normalizePlaceValue(input.currentName) ||
    localityName ||
    municipalityName ||
    districtName ||
    countryName ||
    'Ort';

  const nodes: Array<Record<string, unknown>> = [];

  const levelDefs = [
    countryName
      ? {
          key: 'country',
          name: countryName,
          path: input.countryPath || input.currentPath
        }
      : null,
    stateName && !samePlaceValue(stateName, countryName)
      ? {
          key: 'state',
          name: stateName,
          path: input.countryPath || input.currentPath
        }
      : null,
    regionName && !samePlaceValue(regionName, stateName) && !samePlaceValue(regionName, districtName)
      ? {
          key: 'region',
          name: regionName,
          path: input.districtPath || input.countryPath || input.currentPath
        }
      : null,
    districtName
      ? {
          key: 'district',
          name: districtName,
          path: input.districtPath || input.currentPath
        }
      : null,
    municipalityName && !samePlaceValue(municipalityName, districtName)
      ? {
          key: 'municipality',
          name: municipalityName,
          path: input.municipalityPath || input.currentPath
        }
      : null,
    localityName && !samePlaceValue(localityName, municipalityName)
      ? {
          key: 'locality',
          name: localityName,
          path: input.currentPath
        }
      : null
  ].filter(Boolean) as Array<{ key: string; name: string; path: string }>;

  let parentId: string | undefined;
  for (const level of levelDefs) {
    const id = placeNodeId(level.path, `place-${level.key}`);
    const node: Record<string, unknown> = {
      '@type': 'Place',
      '@id': id,
      name: level.name,
      url: absoluteUrl(level.path)
    };
    if (parentId) {
      node.containedInPlace = { '@id': parentId };
    }
    nodes.push(node);
    parentId = id;
  }

  const currentNode: Record<string, unknown> = {
    '@type': 'Place',
    '@id': currentId,
    name: currentName,
    url: currentPath
  };

  if (parentId) {
    currentNode.containedInPlace = { '@id': parentId };
  }

  if (countryName || stateName || municipalityName || localityName) {
    currentNode.address = {
      '@type': 'PostalAddress',
      ...(countryName ? { addressCountry: countryName } : {}),
      ...(stateName || regionName ? { addressRegion: stateName || regionName } : {}),
      ...(municipalityName ? { addressLocality: municipalityName } : {}),
      ...(localityName ? { addressSubLocality: localityName } : {})
    };
  }

  if (typeof input.latitude === 'number' && typeof input.longitude === 'number') {
    currentNode.geo = {
      '@type': 'GeoCoordinates',
      latitude: input.latitude,
      longitude: input.longitude
    };
  }

  nodes.push(currentNode);

  return {
    currentPlaceId: currentId,
    currentPlaceName: currentName,
    nodes
  };
}

export function buildGeoCollectionPageJsonLd(args: {
  path: string;
  name: string;
  description?: string | null;
  breadcrumbPath?: string | null;
  placeId?: string | null;
}) {
  return {
    '@type': 'CollectionPage',
    '@id': absoluteUrl(args.path),
    url: absoluteUrl(args.path),
    name: args.name,
    ...(args.description ? { description: args.description } : {}),
    ...(args.placeId ? { about: { '@id': args.placeId } } : {}),
    ...(args.breadcrumbPath ? { breadcrumb: absoluteUrl(args.breadcrumbPath) } : {})
  };
}

export function trimText(value: string | null | undefined, maxLength = 155): string {
  if (!value) return '';
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1).trimEnd()}…`;
}
