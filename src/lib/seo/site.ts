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
  statePath?: string | null;
  regionName?: string | null;
  regionPath?: string | null;
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

/** Einheitlich Trailing Slash für Content-URLs (canonical / JSON-LD / Breadcrumbs). */
export function withTrailingSlash(path: string): string {
  if (!path) return '/';
  const qIndex = path.indexOf('?');
  const pathname = qIndex === -1 ? path : path.slice(0, qIndex);
  const query = qIndex === -1 ? '' : path.slice(qIndex);
  if (!pathname || pathname === '/') return `/${query}`;
  if (pathname.endsWith('/')) return pathname + query;
  return `${pathname}/${query}`;
}

export function toCanonicalAbsoluteUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return `${SITE_URL}/`;
  try {
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      const u = new URL(pathOrUrl);
      u.pathname = withTrailingSlash(u.pathname);
      return u.toString();
    }
  } catch {
    /* use relative path below */
  }
  return absoluteUrl(withTrailingSlash(pathOrUrl));
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
      item: toCanonicalAbsoluteUrl(item.path)
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
  return `${toCanonicalAbsoluteUrl(path)}#${suffix}`;
}

export function buildGeoPlaceGraph(input: GeoPlaceJsonLdInput) {
  const currentPath = toCanonicalAbsoluteUrl(input.currentPath);
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
      url: toCanonicalAbsoluteUrl(level.path)
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
  const pageUrl = toCanonicalAbsoluteUrl(args.path);
  return {
    '@type': 'CollectionPage',
    '@id': pageUrl,
    url: pageUrl,
    name: args.name,
    ...(args.description ? { description: args.description } : {}),
    ...(args.placeId ? { about: { '@id': args.placeId } } : {}),
    ...(args.breadcrumbPath ? { breadcrumb: toCanonicalAbsoluteUrl(args.breadcrumbPath) } : {})
  };
}

/**
 * Länder-Foto-Hub: SearchAction für die interne Fotosuche (hilft Google Sitelinks / Suchfeld zu verstehen).
 * Nur auf reinen Country-Hubs einbinden (z. B. /de, /at, /ch).
 */
export function buildCountryPhotoHubSearchJsonLd(args: { hubPath: string; pageName: string }) {
  const path = args.hubPath.startsWith('/') ? args.hubPath : `/${args.hubPath}`;
  const template = `${SITE_URL}${path}?suche={search_term_string}`;
  const pageUrl = toCanonicalAbsoluteUrl(path);
  return {
    '@type': 'WebPage',
    '@id': `${pageUrl}#photo-hub-search`,
    url: pageUrl,
    name: args.pageName,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: template
      },
      'query-input': 'required name=search_term_string'
    }
  };
}

export function trimText(value: string | null | undefined, maxLength = 155): string {
  if (!value) return '';
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1).trimEnd()}…`;
}
