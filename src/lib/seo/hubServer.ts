import { createClient } from '@supabase/supabase-js';
import { error } from '@sveltejs/kit';
import { getPublicItemHref } from '$lib/content/routing';
import { normalizeAdminDisplayLabel } from '$lib/content/locationTaxonomy';
import { decodeHubSlug, normalizeHubToken } from '$lib/seo/hubs';
import {
  buildGeoHierarchy,
  getDeepestGeoLevel,
  getGeoChildLevelKey,
  getGeoLevel,
  type GeoHierarchyInput,
  type GeoHierarchyLevel,
  type GeoLevelKey
} from '$lib/geo/hierarchy';

export type HubItem = {
  id: string;
  slug: string;
  title: string | null;
  description: string | null;
  caption: string | null;
  canonical_path: string | null;
  path_512: string | null;
  width: number | null;
  height: number | null;
  created_at: string | null;
  keywords?: string[] | null;
  profile_id?: string | null;
  page_settings?: Record<string, unknown> | null;
  country_slug?: string | null;
  country_name?: string | null;
  state_slug?: string | null;
  state_name?: string | null;
  region_slug?: string | null;
  region_name?: string | null;
  district_slug?: string | null;
  district_name?: string | null;
  municipality_slug?: string | null;
  municipality_name?: string | null;
  lat?: number | null;
  lon?: number | null;
  child_count?: number;
  variants?: Array<{
    id: string;
    slug: string;
    path_512: string | null;
    width: number | null;
    height: number | null;
  }>;
};

const HUB_SELECT =
  'id, slug, title, description, caption, canonical_path, path_512, width, height, created_at, keywords, profile_id, page_settings, country_slug, country_name, state_slug, state_name, region_slug, region_name, district_slug, district_name, municipality_slug, municipality_name, lat, lon';

const GEO_FILTER_SELECT =
  'country_slug, country_name, state_slug, state_name, region_slug, region_name, district_slug, district_name, municipality_slug, municipality_name';

const COUNTRY_LABELS: Record<string, string> = {
  de: 'Deutschland',
  at: 'Oesterreich',
  ch: 'Schweiz',
  lu: 'Luxemburg',
  mc: 'Monaco'
};

function getCountryLabel(countrySlug: string | null | undefined, countryName: string | null | undefined): string {
  const normalizedSlug = String(countrySlug || '').trim().toLowerCase();
  const normalizedName = normalizeAdminDisplayLabel(countryName || undefined);
  if (normalizedName) return normalizedName;
  return COUNTRY_LABELS[normalizedSlug] || normalizedSlug.toUpperCase();
}

function createServerSupabase() {
  const supabaseUrl = (
    process.env.PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    import.meta.env.PUBLIC_SUPABASE_URL ||
    import.meta.env.VITE_SUPABASE_URL
  ) as string;
  const supabaseKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY
  ) as string;

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });
}

async function fetchAllPublicRootItems() {
  const supabase = createServerSupabase();
  const allItems: HubItem[] = [];
  let from = 0;
  const batchSize = 1000;

  while (true) {
    const { data, error: queryError } = await supabase
      .from('items')
      .select(HUB_SELECT)
      .eq('admin_hidden', false)
      .is('group_root_item_id', null)
      .not('slug', 'is', null)
      .or('is_private.eq.false,is_private.is.null')
      .order('created_at', { ascending: false })
      .range(from, from + batchSize - 1);

    if (queryError) {
      throw error(500, queryError.message);
    }

    const rows = (data || []) as HubItem[];
    allItems.push(...rows);
    if (rows.length < batchSize) break;
    from += batchSize;
  }

  return allItems.map((item) => ({
    ...item,
    canonical_path: getPublicItemHref(item)
  }));
}

export async function loadKeywordHub(keywordSlug: string) {
  const keywordLabel = decodeHubSlug(keywordSlug);
  const keywordToken = normalizeHubToken(keywordLabel);
  const items = await fetchAllPublicRootItems();

  const matching = items.filter((item) =>
    (item.keywords || []).some((keyword) => normalizeHubToken(keyword) === keywordToken)
  );

  return {
    title: keywordLabel,
    normalizedToken: keywordToken,
    items: matching
  };
}

export async function loadPlaceHub(placeSlug: string) {
  const placeLabel = decodeHubSlug(placeSlug);
  const placeToken = normalizeHubToken(placeLabel);
  const items = await fetchAllPublicRootItems();

  const matching = items.filter((item) => {
    const eventPlace = String((item.page_settings as Record<string, unknown> | null)?.location_name || '');
    if (normalizeHubToken(eventPlace) === placeToken) return true;
    return (item.keywords || []).some((keyword) => normalizeHubToken(keyword) === placeToken);
  });

  return {
    title: placeLabel,
    normalizedToken: placeToken,
    items: matching
  };
}

export async function loadGeoHomeOverview() {
  const items = await fetchAllPublicRootItems();
  const countryMap = new Map<
    string,
    {
      label: string;
      path: string;
      count: number;
    }
  >();

  for (const item of items) {
    const hierarchy = buildGeoHierarchy({
      countrySlug: item.country_slug,
      countryName: item.country_name,
      stateSlug: item.state_slug,
      stateName: item.state_name,
      regionSlug: item.region_slug,
      regionName: item.region_name,
      districtSlug: item.district_slug,
      districtName: item.district_name,
      municipalitySlug: item.municipality_slug,
      municipalityName: item.municipality_name
    });
    const countryLevel = getGeoLevel(hierarchy, 'country');
    if (!countryLevel) continue;
    const current = countryMap.get(countryLevel.path);
    if (current) {
      current.count += 1;
    } else {
      countryMap.set(countryLevel.path, {
        label: getCountryLabel(item.country_slug, item.country_name),
        path: countryLevel.path,
        count: 1
      });
    }
  }

  return Array.from(countryMap.values()).sort((left, right) => right.count - left.count);
}

function getRowLevelSlug(row: GeoHierarchyInput, key: GeoLevelKey): string | null {
  const hierarchy = buildGeoHierarchy(row);
  return getGeoLevel(hierarchy, key)?.slug || null;
}

function resolveGeoSegments(
  countrySlug: string,
  rows: GeoHierarchyInput[],
  segments: string[]
): {
  countrySlug: string;
  stateSlug?: string;
  regionSlug?: string;
  districtSlug?: string;
  municipalitySlug?: string;
} | null {
  let filteredRows = rows.filter((row) => getRowLevelSlug(row, 'country') === countrySlug);
  if (!filteredRows.length) return null;

  const resolved: {
    countrySlug: string;
    stateSlug?: string;
    regionSlug?: string;
    districtSlug?: string;
    municipalitySlug?: string;
  } = { countrySlug };

  let currentKey: GeoLevelKey = 'country';

  for (const segment of segments) {
    const childKey = getGeoChildLevelKey(filteredRows, currentKey);
    if (!childKey) return null;

    const matchingRows = filteredRows.filter((row) => getRowLevelSlug(row, childKey) === segment);
    if (!matchingRows.length) return null;

    if (childKey === 'state') resolved.stateSlug = segment;
    if (childKey === 'region') resolved.regionSlug = segment;
    if (childKey === 'district') resolved.districtSlug = segment;
    if (childKey === 'municipality') resolved.municipalitySlug = segment;

    filteredRows = matchingRows;
    currentKey = childKey;
  }

  return resolved;
}

type GeoHubResult = {
  items: HubItem[];
  totalCount: number;
  countrySlug: string;
  stateSlug?: string;
  regionSlug?: string;
  districtSlug?: string;
  municipalitySlug?: string;
  countryName: string;
  stateName?: string;
  regionName?: string;
  districtName?: string;
  municipalityName?: string;
  hierarchy: GeoHierarchyLevel[];
  currentLevelKey: GeoLevelKey;
  childLevelKey: GeoLevelKey | null;
  childLinks: Array<{
    key: GeoLevelKey;
    label: string;
    path: string;
    count: number;
  }>;
};

function applyGeoFilters<T extends { eq: (column: string, value: string) => T }>(
  query: T,
  args: {
    countrySlug: string;
    stateSlug?: string;
    regionSlug?: string;
    districtSlug?: string;
    municipalitySlug?: string;
  }
) {
  let next = query.eq('country_slug', args.countrySlug);
  if (args.stateSlug) next = next.eq('state_slug', args.stateSlug);
  if (args.regionSlug) next = next.eq('region_slug', args.regionSlug);
  if (args.districtSlug) next = next.eq('district_slug', args.districtSlug);
  if (args.municipalitySlug) next = next.eq('municipality_slug', args.municipalitySlug);
  return next;
}

function getCurrentGeoLevelKey(args: {
  municipalitySlug?: string;
  districtSlug?: string;
  regionSlug?: string;
  stateSlug?: string;
}): GeoLevelKey {
  if (args.municipalitySlug) return 'municipality';
  if (args.districtSlug) return 'district';
  if (args.regionSlug) return 'region';
  if (args.stateSlug) return 'state';
  return 'country';
}

function sortGeoChildLinks(
  links: Array<{
    key: GeoLevelKey;
    label: string;
    path: string;
    count: number;
  }>
) {
  return links.sort((left, right) => left.label.localeCompare(right.label, 'de-DE'));
}

function geoKicker(level: GeoLevelKey): string {
  switch (level) {
    case 'country':
      return 'Land-Hub';
    case 'state':
      return 'Bundesland-Hub';
    case 'region':
      return 'Region-Hub';
    case 'district':
      return 'Landkreis-Hub';
    case 'municipality':
      return 'Gemeinde-Hub';
  }
}

function geoPlural(level: GeoLevelKey): string {
  switch (level) {
    case 'country':
      return 'Länder';
    case 'state':
      return 'Bundesländer';
    case 'region':
      return 'Regionen';
    case 'district':
      return 'Landkreise';
    case 'municipality':
      return 'Gemeinden';
  }
}

function buildGeoHubSeoText(hub: GeoHubResult, page: number) {
  const locationTrail = hub.hierarchy.map((level) => level.label).reverse().join(', ');
  const hubLabel = getDeepestGeoLevel(hub.hierarchy)?.label || hub.countryName;

  return {
    seoTitle:
      page > 1
        ? `${hubLabel}: Seite ${page} | Culoca`
        : `${hubLabel}: Fotos, Orte und Inhalte aus ${locationTrail} | Culoca`,
    intro:
      page > 1
        ? `Seite ${page} ergänzt diesen Geo-Hub um weitere öffentliche Inhalte aus ${locationTrail}.`
        : `Diese Seite bündelt öffentliche Inhalte aus ${locationTrail} und führt Besucher wie Suchmaschinen gezielt tiefer in die regionale Struktur von Culoca.`,
    fallbackDescription: `Mehr Inhalte aus ${locationTrail}.`,
    metaDescription:
      page > 1
        ? `Weitere öffentliche Inhalte aus ${locationTrail} auf Culoca.`
        : `Entdecke ${hub.totalCount} öffentliche Inhalte aus ${locationTrail} auf Culoca. Mit direkter Navigation zu tieferen Orts- und Regionenebenen.`
  };
}

export function buildGeoHubPageData(hub: GeoHubResult, page: number, pageSize: number) {
  const deepestLevel = getDeepestGeoLevel(hub.hierarchy);
  if (!deepestLevel) {
    throw error(404, 'Geo-Hub nicht gefunden');
  }

  const seoText = buildGeoHubSeoText(hub, page);
  const breadcrumbs = [{ name: 'Culoca', path: '/' }].concat(
    hub.hierarchy.map((level) => ({ name: level.label, path: level.path }))
  );

  return {
    hubType: `geo-${deepestLevel.key}`,
    kicker: geoKicker(deepestLevel.key),
    hubLabel: deepestLevel.label,
    hubPath: deepestLevel.path,
    hierarchy: hub.hierarchy,
    countryName: getGeoLevel(hub.hierarchy, 'country')?.label || hub.countryName,
    countryPath: getGeoLevel(hub.hierarchy, 'country')?.path || null,
    stateName: getGeoLevel(hub.hierarchy, 'state')?.label || null,
    statePath: getGeoLevel(hub.hierarchy, 'state')?.path || null,
    regionName: getGeoLevel(hub.hierarchy, 'region')?.label || null,
    regionPath: getGeoLevel(hub.hierarchy, 'region')?.path || null,
    districtName: getGeoLevel(hub.hierarchy, 'district')?.label || null,
    districtPath: getGeoLevel(hub.hierarchy, 'district')?.path || null,
    municipalityName: getGeoLevel(hub.hierarchy, 'municipality')?.label || null,
    municipalityPath: getGeoLevel(hub.hierarchy, 'municipality')?.path || null,
    items: hub.items,
    totalCount: hub.totalCount,
    page,
    totalPages: Math.max(1, Math.ceil(hub.totalCount / pageSize)),
    breadcrumbs,
    geoChildren: hub.childLinks,
    geoChildLevelKey: hub.childLevelKey,
    geoChildLevelLabel: hub.childLevelKey ? geoPlural(hub.childLevelKey) : null,
    seoTitle: seoText.seoTitle,
    intro: seoText.intro,
    fallbackDescription: seoText.fallbackDescription,
    metaDescription: seoText.metaDescription
  };
}

async function fetchGeoHub(args: {
  countrySlug: string;
  stateSlug?: string;
  regionSlug?: string;
  districtSlug?: string;
  municipalitySlug?: string;
  page: number;
  pageSize: number;
}): Promise<GeoHubResult> {
  const supabase = createServerSupabase();
  const countQuery = applyGeoFilters(
    supabase
      .from('items')
      .select('*', { count: 'exact', head: true })
      .eq('admin_hidden', false)
      .is('group_root_item_id', null)
      .not('slug', 'is', null)
      .or('is_private.eq.false,is_private.is.null'),
    args
  );

  const itemsQuery = applyGeoFilters(
    supabase
      .from('items')
      .select(HUB_SELECT)
      .eq('admin_hidden', false)
      .is('group_root_item_id', null)
      .not('slug', 'is', null)
      .or('is_private.eq.false,is_private.is.null'),
    args
  );

  const metaQuery = applyGeoFilters(
    supabase
      .from('items')
      .select(HUB_SELECT)
      .eq('admin_hidden', false)
      .is('group_root_item_id', null)
      .not('slug', 'is', null)
      .or('is_private.eq.false,is_private.is.null')
      .limit(1),
    args
  );

  const [{ count, error: countError }, { data: metaItems, error: metaError }] = await Promise.all([
    countQuery,
    metaQuery
  ]);

  if (countError) throw error(500, countError.message);
  if (metaError) throw error(500, metaError.message);

  const totalCount = count || 0;
  const meta = (metaItems?.[0] || null) as HubItem | null;

  if (!totalCount || !meta) {
    throw error(404, 'Geo-Hub nicht gefunden');
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / args.pageSize));
  const page = Math.min(Math.max(1, args.page), totalPages);
  const { data: items, error: itemsError } = await itemsQuery
    .order('created_at', { ascending: false })
    .range((page - 1) * args.pageSize, page * args.pageSize - 1);

  if (itemsError) throw error(500, itemsError.message);

  const { data: navRows, error: navError } = await applyGeoFilters(
    supabase
      .from('items')
      .select(GEO_FILTER_SELECT)
      .eq('admin_hidden', false)
      .is('group_root_item_id', null)
      .not('slug', 'is', null)
      .or('is_private.eq.false,is_private.is.null'),
    args
  );

  if (navError) throw error(500, navError.message);

  const baseItems = (items || []) as HubItem[];
  const geoMeta = meta as HubItem;
  const hierarchy = buildGeoHierarchy({
    countrySlug: geoMeta.country_slug || args.countrySlug,
    countryName: geoMeta.country_name,
    stateSlug: geoMeta.state_slug || args.stateSlug,
    stateName: geoMeta.state_name,
    regionSlug: geoMeta.region_slug || args.regionSlug,
    regionName: geoMeta.region_name,
    districtSlug: geoMeta.district_slug || args.districtSlug,
    districtName: geoMeta.district_name,
    municipalitySlug: geoMeta.municipality_slug || args.municipalitySlug,
    municipalityName: geoMeta.municipality_name
  });
  const currentLevelKey = getCurrentGeoLevelKey(args);
  const currentLevel = getGeoLevel(hierarchy, currentLevelKey) || getDeepestGeoLevel(hierarchy);
  const geoRows = ((navRows || []) as HubItem[]).map((row) => ({
    countrySlug: row.country_slug,
    countryName: row.country_name,
    stateSlug: row.state_slug,
    stateName: row.state_name,
    regionSlug: row.region_slug,
    regionName: row.region_name,
    districtSlug: row.district_slug,
    districtName: row.district_name,
    municipalitySlug: row.municipality_slug,
    municipalityName: row.municipality_name
  }));
  const childLevelKey = currentLevel ? getGeoChildLevelKey(geoRows, currentLevel.key) : null;
  const childMap = new Map<string, { key: GeoLevelKey; label: string; path: string; count: number }>();

  if (childLevelKey) {
    for (const row of geoRows) {
      const rowHierarchy = buildGeoHierarchy(row);
      const childLevel = getGeoLevel(rowHierarchy, childLevelKey);
      if (!childLevel) continue;

      const entry = childMap.get(childLevel.path);
      if (entry) {
        entry.count += 1;
      } else {
        childMap.set(childLevel.path, {
          key: childLevel.key,
          label: childLevel.label,
          path: childLevel.path,
          count: 1
        });
      }
    }
  }

  const rootIds = baseItems.map((item) => item.id);
  const variantsByRoot = new Map<
    string,
    Array<{
      id: string;
      slug: string;
      path_512: string | null;
      width: number | null;
      height: number | null;
    }>
  >();

  if (rootIds.length) {
    const { data: variantRows, error: variantsError } = await supabase
      .from('items')
      .select('id, slug, path_512, width, height, group_root_item_id')
      .in('group_root_item_id', rootIds)
      .eq('admin_hidden', false)
      .or('is_private.eq.false,is_private.is.null')
      .not('slug', 'is', null)
      .not('path_512', 'is', null)
      .order('created_at', { ascending: false });

    if (variantsError) throw error(500, variantsError.message);

    for (const row of variantRows || []) {
      const rootId = row.group_root_item_id as string | null;
      if (!rootId) continue;
      const current = variantsByRoot.get(rootId) || [];
      if (current.length >= 5) continue;
      current.push({
        id: row.id as string,
        slug: row.slug as string,
        path_512: (row.path_512 || null) as string | null,
        width: (row.width || null) as number | null,
        height: (row.height || null) as number | null
      });
      variantsByRoot.set(rootId, current);
    }
  }

  return {
    items: baseItems.map((item) => ({
      ...item,
      canonical_path: getPublicItemHref(item),
      variants: variantsByRoot.get(item.id) || [],
      child_count: (variantsByRoot.get(item.id) || []).length
    })),
    totalCount,
    countrySlug: hierarchy[0]?.slug || args.countrySlug,
    stateSlug: getGeoLevel(hierarchy, 'state')?.slug,
    regionSlug: getGeoLevel(hierarchy, 'region')?.slug,
    districtSlug: getGeoLevel(hierarchy, 'district')?.slug,
    municipalitySlug: getGeoLevel(hierarchy, 'municipality')?.slug,
    countryName:
      normalizeAdminDisplayLabel(meta.country_name || args.countrySlug.toUpperCase()) ||
      args.countrySlug.toUpperCase(),
    stateName: normalizeAdminDisplayLabel(meta.state_name || undefined) || undefined,
    regionName: normalizeAdminDisplayLabel(meta.region_name || undefined) || undefined,
    districtName: normalizeAdminDisplayLabel(meta.district_name || undefined) || undefined,
    municipalityName: normalizeAdminDisplayLabel(meta.municipality_name || undefined) || undefined,
    hierarchy,
    currentLevelKey: currentLevel?.key || currentLevelKey,
    childLevelKey,
    childLinks: sortGeoChildLinks(Array.from(childMap.values()))
  };
}

export async function loadGeoCountryHub(countrySlug: string, page: number, pageSize: number) {
  return fetchGeoHub({ countrySlug, page, pageSize });
}

export async function loadGeoStateHub(
  countrySlug: string,
  stateSlug: string,
  page: number,
  pageSize: number
) {
  return fetchGeoHub({ countrySlug, stateSlug, page, pageSize });
}

export async function loadGeoRegionHub(
  countrySlug: string,
  stateSlug: string,
  regionSlug: string,
  page: number,
  pageSize: number
) {
  return fetchGeoHub({ countrySlug, stateSlug, regionSlug, page, pageSize });
}

export async function loadGeoDistrictHub(countrySlug: string, districtSlug: string, page: number, pageSize: number) {
  return fetchGeoHub({ countrySlug, districtSlug, page, pageSize });
}

export async function loadGeoDeepDistrictHub(
  countrySlug: string,
  stateSlug: string,
  regionSlug: string,
  districtSlug: string,
  page: number,
  pageSize: number
) {
  return fetchGeoHub({ countrySlug, stateSlug, regionSlug, districtSlug, page, pageSize });
}

export async function loadGeoMunicipalityHub(
  countrySlug: string,
  districtSlug: string,
  municipalitySlug: string,
  page: number,
  pageSize: number
) {
  return fetchGeoHub({ countrySlug, districtSlug, municipalitySlug, page, pageSize });
}

export async function loadGeoDeepMunicipalityHub(
  countrySlug: string,
  stateSlug: string,
  regionSlug: string,
  districtSlug: string,
  municipalitySlug: string,
  page: number,
  pageSize: number
) {
  return fetchGeoHub({ countrySlug, stateSlug, regionSlug, districtSlug, municipalitySlug, page, pageSize });
}

export async function loadGeoHubBySegments(
  countrySlug: string,
  segments: string[],
  page: number,
  pageSize: number
) {
  const normalized = segments.filter(Boolean);
  if (!normalized.length) {
    return loadGeoCountryHub(countrySlug, page, pageSize);
  }

  const requestedPath = `/${[countrySlug, ...normalized].join('/')}`;
  const supabase = createServerSupabase();
  const { data, error: queryError } = await supabase
    .from('items')
    .select(GEO_FILTER_SELECT)
    .eq('admin_hidden', false)
    .is('group_root_item_id', null)
    .not('slug', 'is', null)
    .or('is_private.eq.false,is_private.is.null')
    .eq('country_slug', countrySlug);

  if (queryError) {
    throw error(500, queryError.message);
  }

  const rows = ((data || []) as HubItem[]).map((row) => ({
    countrySlug: row.country_slug,
    countryName: row.country_name,
    stateSlug: row.state_slug,
    stateName: row.state_name,
    regionSlug: row.region_slug,
    regionName: row.region_name,
    districtSlug: row.district_slug,
    districtName: row.district_name,
    municipalitySlug: row.municipality_slug,
    municipalityName: row.municipality_name
  }));
  const resolved = resolveGeoSegments(countrySlug, rows, normalized);
  if (resolved) {
    return fetchGeoHub({
      ...resolved,
      page,
      pageSize
    });
  }

  throw error(404, 'Geo-Hub nicht gefunden');
}

export async function resolveLegacyPlaceSlug(placeSlug: string) {
  const normalizedSlug = normalizeHubToken(decodeHubSlug(placeSlug));
  const supabase = createServerSupabase();
  const visibilityFilter = 'is_private.eq.false,is_private.is.null';

  const findMatch = async (
    field: 'municipality_slug' | 'district_slug' | 'country_slug'
  ): Promise<HubItem | null> => {
    const { data, error: queryError } = await supabase
      .from('items')
      .select(HUB_SELECT)
      .eq('admin_hidden', false)
      .is('group_root_item_id', null)
      .not('slug', 'is', null)
      .or(visibilityFilter)
      .eq(field, normalizedSlug)
      .limit(1)
      .maybeSingle<HubItem>();

    if (queryError) {
      throw error(500, queryError.message);
    }

    return data ?? null;
  };

  const municipalityMatch = await findMatch('municipality_slug');
  if (
    municipalityMatch?.country_slug &&
    municipalityMatch.district_slug &&
    municipalityMatch.municipality_slug
  ) {
    const hierarchy = buildGeoHierarchy({
      countrySlug: municipalityMatch.country_slug,
      countryName: municipalityMatch.country_name,
      stateSlug: municipalityMatch.state_slug,
      stateName: municipalityMatch.state_name,
      regionSlug: municipalityMatch.region_slug,
      regionName: municipalityMatch.region_name,
      districtSlug: municipalityMatch.district_slug,
      districtName: municipalityMatch.district_name,
      municipalitySlug: municipalityMatch.municipality_slug,
      municipalityName: municipalityMatch.municipality_name
    });
    return {
      path: getGeoLevel(hierarchy, 'municipality')?.path || `/${municipalityMatch.country_slug}/${municipalityMatch.district_slug}/${municipalityMatch.municipality_slug}`,
      level: 'municipality' as const,
      label:
        normalizeAdminDisplayLabel(municipalityMatch.municipality_name || municipalityMatch.municipality_slug) ||
        municipalityMatch.municipality_slug
    };
  }

  const districtMatch = await findMatch('district_slug');
  if (districtMatch?.country_slug && districtMatch.district_slug) {
    const hierarchy = buildGeoHierarchy({
      countrySlug: districtMatch.country_slug,
      countryName: districtMatch.country_name,
      stateSlug: districtMatch.state_slug,
      stateName: districtMatch.state_name,
      regionSlug: districtMatch.region_slug,
      regionName: districtMatch.region_name,
      districtSlug: districtMatch.district_slug,
      districtName: districtMatch.district_name
    });
    return {
      path: getGeoLevel(hierarchy, 'district')?.path || `/${districtMatch.country_slug}/${districtMatch.district_slug}`,
      level: 'district' as const,
      label:
        normalizeAdminDisplayLabel(districtMatch.district_name || districtMatch.district_slug) ||
        districtMatch.district_slug
    };
  }

  const countryMatch = await findMatch('country_slug');
  if (countryMatch?.country_slug) {
    return {
      path: `/${countryMatch.country_slug}`,
      level: 'country' as const,
      label:
        normalizeAdminDisplayLabel(countryMatch.country_name || countryMatch.country_slug.toUpperCase()) ||
        countryMatch.country_slug.toUpperCase()
    };
  }

  return null;
}
