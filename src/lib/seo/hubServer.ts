import { createClient } from '@supabase/supabase-js';
import { error } from '@sveltejs/kit';
import { getPublicItemHref } from '$lib/content/routing';
import { normalizeAdminDisplayLabel } from '$lib/content/locationTaxonomy';
import { decodeHubSlug, normalizeHubToken } from '$lib/seo/hubs';

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
  district_slug?: string | null;
  district_name?: string | null;
  municipality_slug?: string | null;
  municipality_name?: string | null;
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
  'id, slug, title, description, caption, canonical_path, path_512, width, height, created_at, keywords, profile_id, page_settings, country_slug, country_name, district_slug, district_name, municipality_slug, municipality_name';

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

type GeoHubResult = {
  items: HubItem[];
  totalCount: number;
  countrySlug: string;
  districtSlug?: string;
  municipalitySlug?: string;
  countryName: string;
  districtName?: string;
  municipalityName?: string;
};

async function fetchGeoHub(args: {
  countrySlug: string;
  districtSlug?: string;
  municipalitySlug?: string;
  page: number;
  pageSize: number;
}): Promise<GeoHubResult> {
  const supabase = createServerSupabase();
  let countQuery = supabase
    .from('items')
    .select('*', { count: 'exact', head: true })
    .eq('admin_hidden', false)
    .is('group_root_item_id', null)
    .not('slug', 'is', null)
    .or('is_private.eq.false,is_private.is.null')
    .eq('country_slug', args.countrySlug);

  let itemsQuery = supabase
    .from('items')
    .select(HUB_SELECT)
    .eq('admin_hidden', false)
    .is('group_root_item_id', null)
    .not('slug', 'is', null)
    .or('is_private.eq.false,is_private.is.null')
    .eq('country_slug', args.countrySlug);

  let metaQuery = supabase
    .from('items')
    .select(HUB_SELECT)
    .eq('admin_hidden', false)
    .is('group_root_item_id', null)
    .not('slug', 'is', null)
    .or('is_private.eq.false,is_private.is.null')
    .eq('country_slug', args.countrySlug)
    .limit(1);

  if (args.districtSlug) {
    countQuery = countQuery.eq('district_slug', args.districtSlug);
    itemsQuery = itemsQuery.eq('district_slug', args.districtSlug);
    metaQuery = metaQuery.eq('district_slug', args.districtSlug);
  }

  if (args.municipalitySlug) {
    countQuery = countQuery.eq('municipality_slug', args.municipalitySlug);
    itemsQuery = itemsQuery.eq('municipality_slug', args.municipalitySlug);
    metaQuery = metaQuery.eq('municipality_slug', args.municipalitySlug);
  }

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

  const baseItems = (items || []) as HubItem[];
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
    countrySlug: args.countrySlug,
    districtSlug: args.districtSlug,
    municipalitySlug: args.municipalitySlug,
    countryName:
      normalizeAdminDisplayLabel(meta.country_name || args.countrySlug.toUpperCase()) ||
      args.countrySlug.toUpperCase(),
    districtName: normalizeAdminDisplayLabel(meta.district_name || undefined) || undefined,
    municipalityName: normalizeAdminDisplayLabel(meta.municipality_name || undefined) || undefined
  };
}

export async function loadGeoCountryHub(countrySlug: string, page: number, pageSize: number) {
  return fetchGeoHub({ countrySlug, page, pageSize });
}

export async function loadGeoDistrictHub(countrySlug: string, districtSlug: string, page: number, pageSize: number) {
  return fetchGeoHub({ countrySlug, districtSlug, page, pageSize });
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
    return {
      path: `/${municipalityMatch.country_slug}/${municipalityMatch.district_slug}/${municipalityMatch.municipality_slug}`,
      level: 'municipality' as const,
      label:
        normalizeAdminDisplayLabel(municipalityMatch.municipality_name || municipalityMatch.municipality_slug) ||
        municipalityMatch.municipality_slug
    };
  }

  const districtMatch = await findMatch('district_slug');
  if (districtMatch?.country_slug && districtMatch.district_slug) {
    return {
      path: `/${districtMatch.country_slug}/${districtMatch.district_slug}`,
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
