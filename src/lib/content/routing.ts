import {
  DEFAULT_CONTENT_TYPE_BY_ID,
  DEFAULT_CONTENT_TYPE_BY_SLUG,
  VALID_CONTENT_TYPE_SLUGS,
  type ContentTypeDefinition
} from '$lib/content/types';
import { hasPersistentEventLandingPage } from '$lib/events';
import {
  buildGeoHubPath as buildFlexibleGeoHubPath,
  buildGeoItemPath as buildFlexibleGeoItemPath,
  hasGeoItemHierarchy
} from '$lib/geo/hierarchy';

export type ContentItemLike = {
  id: string;
  slug: string | null;
  type_id: number | null;
  group_root_item_id?: string | null;
  group_slug?: string | null;
  canonical_path?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  is_private?: boolean | null;
  show_in_main_feed?: boolean | null;
  country_slug?: string | null;
  state_slug?: string | null;
  region_slug?: string | null;
  district_slug?: string | null;
  municipality_slug?: string | null;
};

export type GeoPathLike = {
  country_slug?: string | null;
  state_slug?: string | null;
  region_slug?: string | null;
  district_slug?: string | null;
  municipality_slug?: string | null;
  slug?: string | null;
  canonical_path?: string | null;
  canonicalPath?: string | null;
};

const CONTENT_TYPE_SLUG_SET = new Set(VALID_CONTENT_TYPE_SLUGS);

export function normalizePath(path: string): string {
  if (!path) return '/';
  const value = path.startsWith('/') ? path : `/${path}`;
  return value !== '/' && value.endsWith('/') ? value.slice(0, -1) : value;
}

/** Foto-Typ-Hub (Suche, Varianten, Upload); gleiche Seite wie unter `/foto`. */
export const FOTO_SEARCH_LANDING_PATH = '/foto';

/**
 * Region-Hub (Navigation für Crawler: Land → Bundesland → …).
 * Item-Kanonikal-URLs bleiben kurz: `/de/landkreis/gemeinde/slug` (siehe {@link buildGeoItemPath}).
 */
export const PRIMARY_REGIONAL_FEED_PATH = '/region';

/** Alte Typ-URLs wie /foto/slug – für öffentliche Item-Links durch Geo- oder /item/-Pfad ersetzen. */
function shouldIgnoreLegacyTypeCanonicalPath(
  canonicalPath: string | null | undefined,
  slug: string | null | undefined
): boolean {
  if (!canonicalPath || !slug) return false;
  const normalized = normalizePath(canonicalPath);
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length < 2) return false;
  if (!CONTENT_TYPE_SLUG_SET.has(parts[0])) return false;
  return parts[parts.length - 1] === slug;
}

export function slugifySegment(value: string): string {
  return value
    .replace(/Ä/g, 'Ae')
    .replace(/Ö/g, 'Oe')
    .replace(/Ü/g, 'Ue')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function getTypeForItem(
  item: Pick<ContentItemLike, 'type_id'>,
  explicitType?: Partial<ContentTypeDefinition> | null
): Partial<ContentTypeDefinition> | null {
  if (explicitType?.slug) return explicitType;
  if (!item.type_id) return null;
  return DEFAULT_CONTENT_TYPE_BY_ID.get(item.type_id) ?? null;
}

export function getTypeBySlug(typeSlug: string): Partial<ContentTypeDefinition> | null {
  return DEFAULT_CONTENT_TYPE_BY_SLUG.get(typeSlug) ?? null;
}

export function computeCanonicalPath(args: {
  item: ContentItemLike;
  rootItem?: ContentItemLike | null;
  type?: Partial<ContentTypeDefinition> | null;
}): string | null {
  const { item, rootItem } = args;
  const resolvedType = args.type ?? getTypeForItem(item);
  const typeSlug = resolvedType?.slug;

  if (!item.slug || !typeSlug) {
    return item.slug ? `/item/${item.slug}` : null;
  }

  const groupRoot = rootItem ?? null;
  const isRootItem = !item.group_root_item_id || groupRoot?.id === item.id;
  const visibleGroupSlug = isRootItem
    ? item.group_slug || null
    : groupRoot?.group_slug || null;

  if (isRootItem && visibleGroupSlug) {
    return `/${typeSlug}/${visibleGroupSlug}`;
  }

  if (!isRootItem && visibleGroupSlug) {
    return `/${typeSlug}/${visibleGroupSlug}/${item.slug}`;
  }

  // Unnamed child variants intentionally collapse to the same clean pattern as standalone items.
  return `/${typeSlug}/${item.slug}`;
}

export function hasGeoHierarchy(
  item: Pick<GeoPathLike, 'country_slug' | 'state_slug' | 'region_slug' | 'district_slug' | 'municipality_slug'>
): boolean {
  return hasGeoItemHierarchy({
    countrySlug: item.country_slug,
    stateSlug: item.state_slug,
    regionSlug: item.region_slug,
    districtSlug: item.district_slug,
    municipalitySlug: item.municipality_slug
  });
}

export function buildGeoHubPath(args: {
  countrySlug: string;
  stateSlug?: string | null;
  regionSlug?: string | null;
  districtSlug?: string | null;
  municipalitySlug?: string | null;
}): string {
  return (
    buildFlexibleGeoHubPath({
      countrySlug: args.countrySlug,
      stateSlug: args.stateSlug,
      regionSlug: args.regionSlug,
      districtSlug: args.districtSlug,
      municipalitySlug: args.municipalitySlug
    }) || '/'
  );
}

export function buildGeoItemPath(args: {
  countrySlug: string;
  stateSlug?: string | null;
  regionSlug?: string | null;
  districtSlug: string;
  municipalitySlug: string;
  itemSlug: string;
}): string {
  return (
    buildFlexibleGeoItemPath({
      countrySlug: args.countrySlug,
      stateSlug: args.stateSlug,
      regionSlug: args.regionSlug,
      districtSlug: args.districtSlug,
      municipalitySlug: args.municipalitySlug,
      itemSlug: args.itemSlug
    }) || `/item/${slugifySegment(args.itemSlug)}`
  );
}

export function computeGeoAwareCanonicalPath(args: {
  item: ContentItemLike;
  rootItem?: ContentItemLike | null;
  type?: Partial<ContentTypeDefinition> | null;
}): string | null {
  const { item, rootItem } = args;
  const geoSource = hasGeoHierarchy(item)
    ? item
    : rootItem && hasGeoHierarchy(rootItem)
      ? rootItem
      : null;

  if (item.slug && geoSource) {
    return buildGeoItemPath({
      countrySlug: geoSource.country_slug as string,
      stateSlug: geoSource.state_slug,
      regionSlug: geoSource.region_slug,
      districtSlug: geoSource.district_slug as string,
      municipalitySlug: geoSource.municipality_slug as string,
      itemSlug: item.slug
    });
  }

  return computeCanonicalPath(args);
}

export function getStoredOrComputedCanonicalPath(args: {
  item: ContentItemLike;
  rootItem?: ContentItemLike | null;
  type?: Partial<ContentTypeDefinition> | null;
}): string | null {
  const computed = computeGeoAwareCanonicalPath(args);
  const prefersGeoPath = hasGeoHierarchy(args.item) || (!!args.rootItem && hasGeoHierarchy(args.rootItem));
  if (prefersGeoPath && computed) {
    return normalizePath(computed);
  }
  return normalizePath(args.item.canonical_path || computed || '');
}

export function getPublicItemHref(item: {
  slug?: string | null;
  canonical_path?: string | null;
  canonicalPath?: string | null;
  country_slug?: string | null;
  state_slug?: string | null;
  region_slug?: string | null;
  district_slug?: string | null;
  municipality_slug?: string | null;
}): string {
  const slug = item.slug ?? null;
  if (slug && hasGeoHierarchy(item)) {
    return normalizePath(
      buildGeoItemPath({
        countrySlug: item.country_slug as string,
        stateSlug: item.state_slug,
        regionSlug: item.region_slug,
        districtSlug: item.district_slug as string,
        municipalitySlug: item.municipality_slug as string,
        itemSlug: slug
      })
    );
  }
  let canonicalPath = item.canonicalPath || item.canonical_path;
  if (canonicalPath && slug && shouldIgnoreLegacyTypeCanonicalPath(canonicalPath, slug)) {
    canonicalPath = null;
  }
  if (canonicalPath) return normalizePath(canonicalPath);
  return slug ? `/item/${slug}` : '/';
}

/** Öffentliche Download-Seite zum Item — gleiche Pfadlogik wie {@link getPublicItemHref}. */
export function getPublicItemDownloadHref(
  item: Parameters<typeof getPublicItemHref>[0]
): string {
  const base = getPublicItemHref(item);
  if (!base || base === '/') return '/';
  return `${normalizePath(base)}/download`;
}

export function appendReturnTo(href: string, returnTo: string | null | undefined): string {
  const normalizedHref = normalizePath(href);
  if (!returnTo) return normalizedHref;

  const normalizedReturnTo = normalizePath(returnTo);
  if (!normalizedReturnTo.startsWith('/')) return normalizedHref;

  const separator = normalizedHref.includes('?') ? '&' : '?';
  return `${normalizedHref}${separator}returnTo=${encodeURIComponent(normalizedReturnTo)}`;
}

export function isEventExpired(item: Pick<ContentItemLike, 'type_id' | 'ends_at'>): boolean {
  const type = getTypeForItem(item);
  if (type?.slug !== 'event' || !item.ends_at) return false;
  return new Date(item.ends_at).getTime() < Date.now();
}

export function isPubliclyVisibleItem(item: ContentItemLike): boolean {
  if (item.is_private) return false;
  return true;
}

export function isExpiredEventHiddenFromFeeds(
  item: Pick<ContentItemLike, 'type_id' | 'ends_at' | 'group_slug'>
): boolean {
  return isEventExpired(item) && !hasPersistentEventLandingPage(item);
}

export function isVisibleInMainFeed(item: ContentItemLike): boolean {
  return isPubliclyVisibleItem(item) && !isExpiredEventHiddenFromFeeds(item) && item.show_in_main_feed !== false;
}
