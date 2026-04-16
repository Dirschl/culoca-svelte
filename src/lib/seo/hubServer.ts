import { createClient } from '@supabase/supabase-js';
import { error } from '@sveltejs/kit';
import { getPublicItemHref } from '$lib/content/routing';
import {
  getAdministrativeHierarchy,
  getDistrictSlugsForBundesland,
  getDistrictSlugsForRegion,
  normalizeAdminDisplayLabel
} from '$lib/content/locationTaxonomy';
import { decodeHubSlug, normalizeHubToken } from '$lib/seo/hubs';
import {
  buildGeoHierarchy,
  GEO_ROUTE_PREFIX,
  getDeepestGeoLevel,
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
  group_root_item_id?: string | null;
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
  'id, slug, title, description, caption, canonical_path, path_512, width, height, created_at, keywords, profile_id, page_settings, group_root_item_id, country_slug, country_name, state_slug, state_name, region_slug, region_name, district_slug, district_name, municipality_slug, municipality_name, lat, lon';

const GEO_FILTER_SELECT =
  'country_slug, country_name, state_slug, state_name, region_slug, region_name, district_slug, district_name, municipality_slug, municipality_name';

const COUNTRY_LABELS: Record<string, string> = {
  de: 'Deutschland',
  at: 'Österreich',
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

function enrichGeoInput<T extends GeoHierarchyInput>(input: T): T {
  const administrativeHierarchy = getAdministrativeHierarchy({
    countrySlug: input.countrySlug,
    countryName: input.countryName,
    districtSlug: input.districtSlug,
    districtName: input.districtName
  });

  return {
    ...input,
    countryName: input.countryName || administrativeHierarchy.countryName,
    countrySlug: input.countrySlug || administrativeHierarchy.countrySlug,
    stateName: input.stateName || administrativeHierarchy.stateName,
    stateSlug: input.stateSlug || administrativeHierarchy.stateSlug,
    regionName: input.regionName || administrativeHierarchy.regionName,
    regionSlug: input.regionSlug || administrativeHierarchy.regionSlug,
    districtName: input.districtName || administrativeHierarchy.districtName,
    districtSlug: input.districtSlug || administrativeHierarchy.districtSlug
  };
}

const GEO_LEVEL_SEQUENCE: GeoLevelKey[] = ['country', 'state', 'region', 'district', 'municipality'];

/** Nächste Geo-Ebene — immer mit {@link enrichGeoInput}, damit Bundesland/Region aus Landkreis-Taxonomie zählen. */
function getGeoChildLevelKeyEnriched(rows: GeoHierarchyInput[], currentKey: GeoLevelKey): GeoLevelKey | null {
  const startIndex = GEO_LEVEL_SEQUENCE.indexOf(currentKey) + 1;
  if (startIndex <= 0) return null;
  for (const key of GEO_LEVEL_SEQUENCE.slice(startIndex)) {
    const hasAnyValue = rows.some((row) => {
      const levels = buildGeoHierarchy(enrichGeoInput(row));
      return levels.some((level) => level.key === key);
    });
    if (hasAnyValue) return key;
  }
  return null;
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

function getRowLevelSlug(row: GeoHierarchyInput, key: GeoLevelKey): string | null {
  const hierarchy = buildGeoHierarchy(enrichGeoInput(row));
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
    const childKey = getGeoChildLevelKeyEnriched(filteredRows, currentKey);
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
  countryLinks: Array<{
    label: string;
    path: string;
    count: number;
  }>;
  childLinks: Array<{
    key: GeoLevelKey;
    label: string;
    path: string;
    count: number;
  }>;
};

function applyGeoFilters<T extends { eq: (column: string, value: string) => T; or: (filter: string) => T }>(
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
  if (args.stateSlug) {
    const inferredDistricts = getDistrictSlugsForBundesland(args.stateSlug);
    if (inferredDistricts.length > 0) {
      next = next.or(`state_slug.eq.${args.stateSlug},district_slug.in.(${inferredDistricts.join(',')})`);
    } else {
      next = next.eq('state_slug', args.stateSlug);
    }
  }
  if (args.regionSlug) {
    const inferredDistricts =
      args.stateSlug != null && args.stateSlug !== ''
        ? getDistrictSlugsForRegion(args.stateSlug, args.regionSlug)
        : [];
    if (inferredDistricts.length > 0) {
      next = next.or(`region_slug.eq.${args.regionSlug},district_slug.in.(${inferredDistricts.join(',')})`);
    } else {
      next = next.eq('region_slug', args.regionSlug);
    }
  }
  if (args.districtSlug) next = next.eq('district_slug', args.districtSlug);
  if (args.municipalitySlug) next = next.eq('municipality_slug', args.municipalitySlug);
  return next;
}

type GeoSelectRow = {
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
};

function mapGeoSelectRowToInput(row: GeoSelectRow): GeoHierarchyInput {
  return {
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
  };
}

/**
 * PostgREST liefert pro Request oft nur ~1000 Zeilen — für Zählungen und Navigation müssen wir alle
 * passenden Zeilen in sortierten Batches laden.
 */
async function fetchAllGeoInputsGlobalBatched(): Promise<GeoHierarchyInput[]> {
  const supabase = createServerSupabase();
  const out: GeoHierarchyInput[] = [];
  let from = 0;
  /** PostgREST `max-rows` ist oft 1000 — Seitengröße anpassen, sonst bricht die Schleife nach dem ersten Teilbatch ab. */
  const pageSize = 1000;
  while (true) {
    const { data, error: qError } = await supabase
      .from('items')
      .select(GEO_FILTER_SELECT)
      .eq('admin_hidden', false)
      .is('group_root_item_id', null)
      .not('slug', 'is', null)
      .or('is_private.eq.false,is_private.is.null')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (qError) {
      throw error(500, qError.message);
    }
    const rows = (data || []) as GeoSelectRow[];
    if (!rows.length) break;
    for (const row of rows) {
      out.push(mapGeoSelectRowToInput(row));
    }
    from += rows.length;
    if (rows.length < pageSize) break;
  }
  return out;
}

async function fetchAllGeoInputsForHubBatched(args: {
  countrySlug: string;
  stateSlug?: string;
  regionSlug?: string;
  districtSlug?: string;
  municipalitySlug?: string;
}): Promise<GeoHierarchyInput[]> {
  const supabase = createServerSupabase();
  const out: GeoHierarchyInput[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const q = applyGeoFilters(
      supabase
        .from('items')
        .select(GEO_FILTER_SELECT)
        .eq('admin_hidden', false)
        .is('group_root_item_id', null)
        .not('slug', 'is', null)
        .or('is_private.eq.false,is_private.is.null')
        .order('id', { ascending: true })
        .range(from, from + pageSize - 1),
      args
    );
    const { data, error: qError } = await q;
    if (qError) {
      throw error(500, qError.message);
    }
    const rows = (data || []) as GeoSelectRow[];
    if (!rows.length) break;
    for (const row of rows) {
      out.push(mapGeoSelectRowToInput(row));
    }
    from += rows.length;
    if (rows.length < pageSize) break;
  }
  return out;
}

export async function loadGeoHomeOverview() {
  const rows = await fetchAllGeoInputsGlobalBatched();
  const countryMap = new Map<string, { label: string; path: string; count: number }>();

  for (const row of rows) {
    const hierarchy = buildGeoHierarchy(enrichGeoInput(row));
    const countryLevel = getGeoLevel(hierarchy, 'country');
    if (!countryLevel) continue;
    const current = countryMap.get(countryLevel.path);
    if (current) {
      current.count += 1;
    } else {
      countryMap.set(countryLevel.path, {
        label: getCountryLabel(row.countrySlug, row.countryName),
        path: countryLevel.path,
        count: 1
      });
    }
  }

  return Array.from(countryMap.values()).sort((left, right) => right.count - left.count);
}

/** Volltext-Filter für Geo-Hub-Itemlisten (`/region/...`; alle Typen, nicht nur Fotos). */
function applyOptionalHubItemSearch<T extends { or: (filters: string) => T }>(
  query: T,
  rawSearch: string | undefined | null
): T {
  const s = (rawSearch ?? '').trim();
  if (s.length < 2) return query;
  const safe = s.replace(/"/g, '').replace(/,/g, ' ').slice(0, 120);
  const p = `%${safe}%`;
  return query.or(`title.ilike."${p}",description.ilike."${p}",caption.ilike."${p}"`);
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

/** Länder-Einstieg (DACH): Foto-fokussierte Titel, Intro und Metadaten für maximale Klarheit (SEO + UX). */
function buildCountryPhotoHubSeoText(hub: GeoHubResult, page: number) {
  const n = hub.totalCount.toLocaleString('de-DE');
  const slug = hub.countrySlug;

  if (slug === 'de') {
    return {
      seoTitle:
        page > 1
          ? `Regionale Fotos Deutschland – Seite ${page} | Culoca`
          : 'Regionale Fotos in Deutschland: GPS-Bilder, Orte & Motive | Culoca',
      intro:
        page > 1
          ? `Weitere Fotos und Inhalte aus Deutschland – Seite ${page}. Zurück zur ersten Seite für den vollen Überblick.`
          : `Hier findest du ${n} öffentliche Fotos und Motive mit Ortsbezug – strukturiert von Region bis Gemeinde. Nutze die Suche oder klicke dich durch Bundesländer und Landkreise. Eigene Aufnahmen lädst du hoch und verwaltest sie zentral im Dashboard (Metadaten, Varianten, Freigaben).`,
      metaDescription:
        page > 1
          ? `Weitere regionale Fotos in Deutschland auf Culoca – Seite ${page}.`
          : `${n} regionale Fotos in Deutschland mit GPS & Schlagwörtern. Landkreise, Gemeinden, Suche. Bilder hochladen und verwalten bei Culoca.`,
      fallbackDescription: 'Weitere regionale Motive aus Deutschland.',
      displayHubTitle: 'Regionale Fotos in Deutschland',
      hubKicker: 'Fotos · regionale Entdeckung'
    };
  }

  if (slug === 'at') {
    return {
      seoTitle:
        page > 1
          ? `Regionale Fotos Österreich – Seite ${page} | Culoca`
          : 'Regionale Fotos in Österreich: GPS-Bilder & Motive | Culoca',
      intro:
        page > 1
          ? `Weitere Fotos aus Österreich – Seite ${page}.`
          : `${n} öffentliche Fotos mit regionalem Bezug. Suche oder Navigation nach Bundesland und Region. Upload und Verwaltung im Dashboard.`,
      metaDescription:
        page > 1
          ? `Weitere Fotos in Österreich auf Culoca – Seite ${page}.`
          : `${n} regionale Fotos in Österreich. GPS, Orte, Suche. Culoca – Fotos entdecken und verwalten.`,
      fallbackDescription: 'Weitere Motive aus Österreich.',
      displayHubTitle: 'Regionale Fotos in Österreich',
      hubKicker: 'Fotos · regionale Entdeckung'
    };
  }

  if (slug === 'ch') {
    return {
      seoTitle:
        page > 1
          ? `Regionale Fotos Schweiz – Seite ${page} | Culoca`
          : 'Regionale Fotos in der Schweiz: GPS-Bilder & Motive | Culoca',
      intro:
        page > 1
          ? `Weitere Fotos aus der Schweiz – Seite ${page}.`
          : `${n} öffentliche Fotos mit regionalem Bezug. Suche oder Navigation nach Kanton und Region. Upload und Verwaltung im Dashboard.`,
      metaDescription:
        page > 1
          ? `Weitere Fotos in der Schweiz auf Culoca – Seite ${page}.`
          : `${n} regionale Fotos in der Schweiz. GPS, Orte, Suche. Culoca – Fotos entdecken und verwalten.`,
      fallbackDescription: 'Weitere Motive aus der Schweiz.',
      displayHubTitle: 'Regionale Fotos in der Schweiz',
      hubKicker: 'Fotos · regionale Entdeckung'
    };
  }

  return null;
}

function buildGeoHubSeoText(hub: GeoHubResult, page: number) {
  const locationTrail = hub.hierarchy.map((level) => level.label).reverse().join(', ');
  const hubLabel = getDeepestGeoLevel(hub.hierarchy)?.label || hub.countryName;

  if (hub.currentLevelKey === 'country') {
    const countryPack = buildCountryPhotoHubSeoText(hub, page);
    if (countryPack) {
      return countryPack;
    }
  }

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
        : `Entdecke ${hub.totalCount} öffentliche Inhalte aus ${locationTrail} auf Culoca. Mit direkter Navigation zu tieferen Orts- und Regionenebenen.`,
    displayHubTitle: undefined as string | undefined,
    hubKicker: undefined as string | undefined
  };
}

export function buildGeoHubPageData(
  hub: GeoHubResult,
  page: number,
  pageSize: number,
  hubSearch: string = ''
) {
  const deepestLevel = getDeepestGeoLevel(hub.hierarchy);
  if (!deepestLevel) {
    throw error(404, 'Geo-Hub nicht gefunden');
  }

  const hasItemFeed = !hub.childLevelKey;
  const totalPages = hasItemFeed ? Math.max(1, Math.ceil(hub.totalCount / pageSize)) : 1;
  const resolvedPage = Math.min(Math.max(1, page), totalPages);
  const seoText = buildGeoHubSeoText(hub, resolvedPage);
  const breadcrumbs = [
    { name: 'Culoca', path: '/' },
    { name: 'Region', path: GEO_ROUTE_PREFIX },
    ...hub.hierarchy.map((level) => ({ name: level.label, path: level.path }))
  ];
  const visibleCount = hasItemFeed ? hub.totalCount : hub.childLinks.length;

  return {
    hubType: `geo-${deepestLevel.key}`,
    currentLevelKey: deepestLevel.key,
    kicker: seoText.hubKicker ?? geoKicker(deepestLevel.key),
    hubLabel: deepestLevel.label,
    hubDisplayTitle: seoText.displayHubTitle ?? deepestLevel.label,
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
    hasItemFeed,
    totalCount: hub.totalCount,
    visibleCount,
    page: resolvedPage,
    totalPages,
    breadcrumbs,
    countryLinks: hub.countryLinks,
    geoChildren: hub.childLinks,
    geoChildLevelKey: hub.childLevelKey,
    geoChildLevelLabel: hub.childLevelKey ? geoPlural(hub.childLevelKey) : null,
    seoTitle: seoText.seoTitle,
    intro: seoText.intro,
    fallbackDescription: seoText.fallbackDescription,
    metaDescription: seoText.metaDescription,
    hubSearch: hubSearch.trim(),
    countrySlug: hub.countrySlug
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
  /** Filtert die Itemliste (Titel/Beschreibung/Caption); Canonical bleibt der reine Geo-Pfad. */
  search?: string;
}): Promise<GeoHubResult> {
  const supabase = createServerSupabase();
  const currentLevelKey = getCurrentGeoLevelKey(args);
  const rootCountQuery = applyGeoFilters(
    supabase
      .from('items')
      .select('*', { count: 'exact', head: true })
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

  const [{ count: rootCount, error: countError }, { data: metaItems, error: metaError }] = await Promise.all([
    rootCountQuery,
    metaQuery
  ]);

  if (countError) throw error(500, countError.message);
  if (metaError) throw error(500, metaError.message);

  const totalRootCount = rootCount || 0;
  const meta = (metaItems?.[0] || null) as HubItem | null;

  if (!totalRootCount || !meta) {
    throw error(404, 'Geo-Hub nicht gefunden');
  }
  const geoRows = await fetchAllGeoInputsForHubBatched(args);
  const geoMeta = meta as HubItem;
  const fullHierarchy = buildGeoHierarchy(enrichGeoInput({
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
  }));
  const currentLevel = getGeoLevel(fullHierarchy, currentLevelKey) || getDeepestGeoLevel(fullHierarchy);
  const hierarchy = currentLevel
    ? fullHierarchy.slice(0, fullHierarchy.findIndex((level) => level.key === currentLevel.key) + 1)
    : fullHierarchy;
  const childLevelKey = currentLevel ? getGeoChildLevelKeyEnriched(geoRows, currentLevel.key) : null;
  const shouldLoadItems = !childLevelKey;
  let totalCount = totalRootCount;
  let items: HubItem[] = [];

  if (shouldLoadItems) {
    const itemCountQuery = applyOptionalHubItemSearch(
      applyGeoFilters(
        supabase
          .from('items')
          .select('*', { count: 'exact', head: true })
          .eq('admin_hidden', false)
          .not('slug', 'is', null)
          .or('is_private.eq.false,is_private.is.null'),
        args
      ),
      args.search
    );

    const { count: itemCount, error: itemCountError } = await itemCountQuery;
    if (itemCountError) throw error(500, itemCountError.message);

    totalCount = itemCount || 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / args.pageSize));
    const page = Math.min(Math.max(1, args.page), totalPages);

    const itemsQuery = applyOptionalHubItemSearch(
      applyGeoFilters(
        supabase
          .from('items')
          .select(HUB_SELECT)
          .eq('admin_hidden', false)
          .not('slug', 'is', null)
          .or('is_private.eq.false,is_private.is.null'),
        args
      ),
      args.search
    );

    const { data: itemRows, error: itemsError } = await itemsQuery
      .order('created_at', { ascending: false })
      .range((page - 1) * args.pageSize, page * args.pageSize - 1);

    if (itemsError) throw error(500, itemsError.message);
    items = (itemRows || []) as HubItem[];
  }
  const countryLinks = sortGeoChildLinks(
    Array.from(
      geoRows.reduce((map, row) => {
        const rowHierarchy = buildGeoHierarchy(enrichGeoInput(row));
        const countryLevel = getGeoLevel(rowHierarchy, 'country');
        if (!countryLevel) return map;
        const entry = map.get(countryLevel.path);
        if (entry) {
          entry.count += 1;
        } else {
          map.set(countryLevel.path, {
            key: countryLevel.key,
            label: countryLevel.label,
            path: countryLevel.path,
            count: 1
          });
        }
        return map;
      }, new Map<string, { key: GeoLevelKey; label: string; path: string; count: number }>()).values()
    )
  ).map(({ label, path, count }) => ({ label, path, count }));
  const childMap = new Map<string, { key: GeoLevelKey; label: string; path: string; count: number }>();

  if (childLevelKey) {
    for (const row of geoRows) {
      const rowHierarchy = buildGeoHierarchy(enrichGeoInput(row));
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

  return {
    items: items.map((item) => ({
      ...item,
      canonical_path: getPublicItemHref(item)
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
    countryLinks,
    childLinks: sortGeoChildLinks(Array.from(childMap.values()))
  };
}

export async function loadGeoCountryHub(
  countrySlug: string,
  page: number,
  pageSize: number,
  search?: string
) {
  return fetchGeoHub({ countrySlug, page, pageSize, search });
}

export async function loadGeoStateHub(
  countrySlug: string,
  stateSlug: string,
  page: number,
  pageSize: number,
  search?: string
) {
  return fetchGeoHub({ countrySlug, stateSlug, page, pageSize, search });
}

export async function loadGeoRegionHub(
  countrySlug: string,
  stateSlug: string,
  regionSlug: string,
  page: number,
  pageSize: number,
  search?: string
) {
  return fetchGeoHub({ countrySlug, stateSlug, regionSlug, page, pageSize, search });
}

export async function loadGeoDistrictHub(
  countrySlug: string,
  districtSlug: string,
  page: number,
  pageSize: number,
  search?: string
) {
  return fetchGeoHub({ countrySlug, districtSlug, page, pageSize, search });
}

export async function loadGeoDeepDistrictHub(
  countrySlug: string,
  stateSlug: string,
  regionSlug: string,
  districtSlug: string,
  page: number,
  pageSize: number,
  search?: string
) {
  return fetchGeoHub({ countrySlug, stateSlug, regionSlug, districtSlug, page, pageSize, search });
}

export async function loadGeoMunicipalityHub(
  countrySlug: string,
  districtSlug: string,
  municipalitySlug: string,
  page: number,
  pageSize: number,
  search?: string
) {
  return fetchGeoHub({ countrySlug, districtSlug, municipalitySlug, page, pageSize, search });
}

export async function loadGeoDeepMunicipalityHub(
  countrySlug: string,
  stateSlug: string,
  regionSlug: string,
  districtSlug: string,
  municipalitySlug: string,
  page: number,
  pageSize: number,
  search?: string
) {
  return fetchGeoHub({
    countrySlug,
    stateSlug,
    regionSlug,
    districtSlug,
    municipalitySlug,
    page,
    pageSize,
    search
  });
}

export async function loadGeoHubBySegments(
  countrySlug: string,
  segments: string[],
  page: number,
  pageSize: number,
  search?: string
) {
  const normalized = segments.filter(Boolean);
  if (!normalized.length) {
    return loadGeoCountryHub(countrySlug, page, pageSize, search);
  }

  const rows = await fetchAllGeoInputsForHubBatched({ countrySlug });
  const resolved = resolveGeoSegments(countrySlug, rows, normalized);
  if (resolved) {
    return fetchGeoHub({
      ...resolved,
      page,
      pageSize,
      search
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
    const hierarchy = buildGeoHierarchy(enrichGeoInput({
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
    }));
    return {
      path:
        getGeoLevel(hierarchy, 'municipality')?.path ||
        `${GEO_ROUTE_PREFIX}/${municipalityMatch.country_slug}/${municipalityMatch.district_slug}/${municipalityMatch.municipality_slug}`,
      level: 'municipality' as const,
      label:
        normalizeAdminDisplayLabel(municipalityMatch.municipality_name || municipalityMatch.municipality_slug) ||
        municipalityMatch.municipality_slug
    };
  }

  const districtMatch = await findMatch('district_slug');
  if (districtMatch?.country_slug && districtMatch.district_slug) {
    const hierarchy = buildGeoHierarchy(enrichGeoInput({
      countrySlug: districtMatch.country_slug,
      countryName: districtMatch.country_name,
      stateSlug: districtMatch.state_slug,
      stateName: districtMatch.state_name,
      regionSlug: districtMatch.region_slug,
      regionName: districtMatch.region_name,
      districtSlug: districtMatch.district_slug,
      districtName: districtMatch.district_name
    }));
    return {
      path:
        getGeoLevel(hierarchy, 'district')?.path ||
        `${GEO_ROUTE_PREFIX}/${districtMatch.country_slug}/${districtMatch.district_slug}`,
      level: 'district' as const,
      label:
        normalizeAdminDisplayLabel(districtMatch.district_name || districtMatch.district_slug) ||
        districtMatch.district_slug
    };
  }

  const countryMatch = await findMatch('country_slug');
  if (countryMatch?.country_slug) {
    return {
      path: `${GEO_ROUTE_PREFIX}/${countryMatch.country_slug}`,
      level: 'country' as const,
      label:
        normalizeAdminDisplayLabel(countryMatch.country_name || countryMatch.country_slug.toUpperCase()) ||
        countryMatch.country_slug.toUpperCase()
    };
  }

  return null;
}
