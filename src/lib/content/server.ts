import { createClient } from '@supabase/supabase-js';
import { error } from '@sveltejs/kit';
import {
  buildGeoHubPath,
  computeCanonicalPath,
  getStoredOrComputedCanonicalPath,
  getTypeBySlug,
  isPubliclyVisibleItem,
  normalizePath,
  type ContentItemLike
} from '$lib/content/routing';
import { DEFAULT_CONTENT_TYPE_BY_ID, type ContentTypeDefinition } from '$lib/content/types';
import {
  buildKeywordHubPath,
  buildPhotographerHubPath,
  buildPlaceHubPath,
  getKeywordHubLinks,
  pickPlaceLabel
} from '$lib/seo/hubs';
import {
  fixUtf8MojibakeIfNeeded,
  ITEM_PAGE_PROFILE_SELECT,
  sanitizeItemForItemPageClient,
  scrubPublicProfileRow
} from '$lib/server/itemPagePublic';

type ItemRecord = ContentItemLike & {
  user_id?: string | null;
  profile_id?: string | null;
  short_id?: string | null;
  original_name?: string | null;
  country_code?: string | null;
  country_name?: string | null;
  state_name?: string | null;
  state_slug?: string | null;
  region_name?: string | null;
  region_slug?: string | null;
  district_code?: string | null;
  district_name?: string | null;
  municipality_name?: string | null;
  location_source?: string | null;
  location_confidence?: number | null;
  location_needs_review?: boolean | null;
  path_2048?: string | null;
  path_512?: string | null;
  path_64?: string | null;
  width?: number | null;
  height?: number | null;
  title?: string | null;
  description?: string | null;
  keywords?: string[] | null;
  created_at?: string | null;
  lat?: number | null;
  lon?: number | null;
  exif_data?: Record<string, unknown> | null;
  image_format?: string | null;
  original_url?: string | null;
  status?: string | null;
  error_message?: string | null;
  updated_at?: string | null;
  show_private?: boolean | null;
  gallery?: boolean | null;
  caption?: string | null;
  content?: string | null;
  sort_order?: number | null;
  external_url?: string | null;
  video_url?: string | null;
  page_settings?: Record<string, unknown> | null;
  adobe_stock_status?: string | null;
  adobe_stock_uploaded_at?: string | null;
  adobe_stock_asset_id?: string | null;
  adobe_stock_url?: string | null;
  adobe_stock_error?: string | null;
};

type SimilarityMatchRow = {
  item_id: string;
  similarity: number;
};

const MIN_SIMILARITY_SCORE = 0.72;
const PREFERRED_SIMILARITY_COUNT = 60;
const MATCH_RPC_FETCH_COUNT = 80;

function createServerSupabase() {
  const supabaseUrl = (process.env.PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    import.meta.env.PUBLIC_SUPABASE_URL ||
    import.meta.env.VITE_SUPABASE_URL) as string;
  const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY) as string;

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });
}

async function getSemanticSimilarItems(
  supabase: ReturnType<typeof createServerSupabase>,
  item: ItemRecord,
  rootItem: ItemRecord,
  type: Partial<ContentTypeDefinition> | null,
  baseSelect: string
) {
  if (type?.slug !== 'foto') {
    return [];
  }

  const fetchMatches = async (filterDistrict: string | null) => {
    const { data: matches, error: matchError } = await supabase.rpc('match_similar_items', {
      source_item_id: rootItem.id,
      match_count: MATCH_RPC_FETCH_COUNT,
      filter_type_id: item.type_id || null,
      exclude_root: rootItem.id,
      filter_country: item.country_slug || null,
      filter_district: filterDistrict
    });

    if (matchError || !Array.isArray(matches) || matches.length === 0) {
      return [];
    }

    return (matches as SimilarityMatchRow[]).filter(
      (row) => Number(row.similarity || 0) >= MIN_SIMILARITY_SCORE
    );
  };

  try {
    const localMatches = await fetchMatches(item.district_slug || null);
    const fallbackMatches =
      localMatches.length >= PREFERRED_SIMILARITY_COUNT
        ? []
        : await fetchMatches(null);

    const dedupedMatches = [...localMatches, ...fallbackMatches]
      .filter(
        (row, index, rows) =>
          rows.findIndex((candidate) => candidate.item_id === row.item_id) === index
      )
      .slice(0, PREFERRED_SIMILARITY_COUNT);

    if (dedupedMatches.length === 0) {
      return [];
    }

    const ids = dedupedMatches
      .map((row: SimilarityMatchRow) => row.item_id)
      .filter(Boolean);

    if (!ids.length) {
      return [];
    }

    const { data: rows, error: rowsError } = await supabase
      .from('items')
      .select(baseSelect)
      .in('id', ids)
      .eq('admin_hidden', false)
      .is('group_root_item_id', null)
      .not('slug', 'is', null)
      .or('is_private.eq.false,is_private.is.null');

    if (rowsError || !rows) {
      return [];
    }

    const typedRows = (rows || []) as unknown as ItemRecord[];
    const byId = new Map<string, ItemRecord>(typedRows.map((row) => [row.id, row]));
    const orderedRows = dedupedMatches
      .map((match: SimilarityMatchRow) => byId.get(match.item_id))
      .filter((row): row is ItemRecord => Boolean(row));

    return orderedRows
      .map((row) => ({
        ...row,
        similarity:
          dedupedMatches.find((match: SimilarityMatchRow) => match.item_id === row.id)?.similarity || 0
      }));
  } catch {
    return [];
  }
}

const ITEM_SELECT = `
  id,
  user_id,
  short_id,
  original_name,
  path_2048,
  path_512,
  path_64,
  width,
  height,
  title,
  description,
  keywords,
  created_at,
  lat,
  lon,
  profile_id,
  exif_data,
  image_format,
  original_url,
  status,
  error_message,
  updated_at,
  show_private,
  is_private,
  gallery,
  slug,
  type_id,
  caption,
  adobe_stock_status,
  adobe_stock_uploaded_at,
  adobe_stock_asset_id,
  adobe_stock_url,
  adobe_stock_error,
  content,
  group_root_item_id,
  group_slug,
  sort_order,
  show_in_main_feed,
  canonical_path,
  country_code,
  country_slug,
  state_name,
  state_slug,
  region_name,
  region_slug,
  district_code,
  district_slug,
  municipality_slug,
  country_name,
  district_name,
  municipality_name,
  location_source,
  location_confidence,
  location_needs_review,
  starts_at,
  ends_at,
  external_url,
  video_url,
  page_settings
`;

async function getTypeMap(supabase: ReturnType<typeof createServerSupabase>) {
  const { data } = await supabase.from('types').select('*');
  const map = new Map<number, Partial<ContentTypeDefinition>>();

  for (const row of data || []) {
    map.set(row.id, row);
  }

  for (const [id, type] of DEFAULT_CONTENT_TYPE_BY_ID.entries()) {
    if (!map.has(id)) {
      map.set(id, type);
    }
  }

  return map;
}

async function getItemBySlug(supabase: ReturnType<typeof createServerSupabase>, slug: string) {
  const { data, error: itemError } = await supabase
    .from('items')
    .select(ITEM_SELECT)
    .eq('slug', slug)
    .limit(1)
    .maybeSingle<ItemRecord>();

  if (itemError) {
    throw error(500, itemError.message);
  }

  return data;
}

async function getNamedRootByGroupSlug(
  supabase: ReturnType<typeof createServerSupabase>,
  typeId: number,
  groupSlug: string
) {
  const { data, error: itemError } = await supabase
    .from('items')
    .select(ITEM_SELECT)
    .eq('type_id', typeId)
    .eq('group_slug', groupSlug)
    .is('group_root_item_id', null)
    .limit(1)
    .maybeSingle<ItemRecord>();

  if (itemError) {
    throw error(500, itemError.message);
  }

  return data;
}

async function getProfile(
  supabase: ReturnType<typeof createServerSupabase>,
  profileId: string | null | undefined
) {
  if (!profileId) return { profile: null, full_name: 'Culoca User' };

  const { data } = await supabase
    .from('profiles')
    .select(ITEM_PAGE_PROFILE_SELECT)
    .eq('id', profileId)
    .maybeSingle();
  const row = data as Record<string, unknown> | null;
  return {
    profile: scrubPublicProfileRow(row),
    full_name: (fixUtf8MojibakeIfNeeded((row?.full_name as string) || '') as string) || 'Culoca User'
  };
}

async function getRootItem(
  supabase: ReturnType<typeof createServerSupabase>,
  item: ItemRecord
) {
  if (!item.group_root_item_id) return item;

  const { data, error: rootError } = await supabase
    .from('items')
    .select(ITEM_SELECT)
    .eq('id', item.group_root_item_id)
    .maybeSingle<ItemRecord>();

  if (rootError) {
    throw error(500, rootError.message);
  }

  return data ?? item;
}

async function getGroupItems(
  supabase: ReturnType<typeof createServerSupabase>,
  rootItem: ItemRecord
) {
  const { data, error: groupError } = await supabase
    .from('items')
    .select(ITEM_SELECT)
    .eq('group_root_item_id', rootItem.id)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (groupError) {
    throw error(500, groupError.message);
  }

  return data ?? [];
}

async function getSeoLinks(
  supabase: ReturnType<typeof createServerSupabase>,
  item: ItemRecord
) {
  if (!item.created_at) {
    return { newer: null, older: null };
  }

  const baseSelect =
    'id, slug, title, created_at, type_id, group_root_item_id, group_slug, canonical_path, country_slug, district_slug, municipality_slug';

  const [{ data: newerItem }, { data: olderItem }, typeMap] = await Promise.all([
    supabase
      .from('items')
      .select(baseSelect)
      .not('slug', 'is', null)
      .not('path_512', 'is', null)
      .or('is_private.eq.false,is_private.is.null')
      .gt('created_at', item.created_at)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle<ContentItemLike & { title?: string | null }>(),
    supabase
      .from('items')
      .select(baseSelect)
      .not('slug', 'is', null)
      .not('path_512', 'is', null)
      .or('is_private.eq.false,is_private.is.null')
      .lt('created_at', item.created_at)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<ContentItemLike & { title?: string | null }>(),
    getTypeMap(supabase)
  ]);

  const withPath = (candidate: (ContentItemLike & { title?: string | null }) | null) => {
    if (!candidate) return null;
    const candidateType = candidate.type_id ? typeMap.get(candidate.type_id) : null;
    return {
      slug: candidate.slug,
      title: candidate.title ?? null,
      canonicalPath: getStoredOrComputedCanonicalPath({ item: candidate, type: candidateType })
    };
  };

  return {
    newer: withPath(newerItem ?? null),
    older: withPath(olderItem ?? null)
  };
}

function makeGroupPreview(item: ItemRecord, type: Partial<ContentTypeDefinition> | null, rootItem: ItemRecord) {
  const canonicalPath = getStoredOrComputedCanonicalPath({ item, rootItem, type });
  return {
    id: item.id,
    slug: item.slug,
    title: item.title || item.original_name || 'Item',
    description: item.description || item.caption || '',
    caption: item.caption || item.description || '',
    path_512: item.path_512,
    path_2048: item.path_2048,
    path_64: item.path_64,
    width: item.width,
    height: item.height,
    lat: item.lat,
    lon: item.lon,
    gallery: item.gallery ?? true,
    canonicalPath,
    isActive: item.id === rootItem.id
  };
}

async function getRelatedItems(
  supabase: ReturnType<typeof createServerSupabase>,
  item: ItemRecord,
  rootItem: ItemRecord,
  type: Partial<ContentTypeDefinition> | null
) {
  const baseSelect =
    'id, slug, title, description, caption, canonical_path, path_512, width, height, created_at, profile_id, keywords, page_settings, country_slug, district_slug, municipality_slug, country_name, district_name, municipality_name';

  const placeLabel = pickPlaceLabel(
    (item.page_settings as Record<string, unknown> | null)?.location_name as string | null | undefined,
    item.keywords || []
  );

  const semanticSimilarRows = await getSemanticSimilarItems(supabase, item, rootItem, type, baseSelect);

  const toPreview = (row: ItemRecord) => ({
    id: row.id,
    slug: row.slug,
    title: row.title || row.original_name || 'Item',
    description: row.description || row.caption || '',
    caption: row.caption || row.description || '',
    canonicalPath: getStoredOrComputedCanonicalPath({ item: row, type }),
    path_512: row.path_512,
    width: row.width,
    height: row.height
  });

  return {
    sameType: [],
    sameCreator: [],
    sameKeyword: ((semanticSimilarRows || []) as ItemRecord[]).map((row: ItemRecord) => toPreview(row)),
    samePlace: [],
    keywordLinks: getKeywordHubLinks(item.keywords || []),
    placeLabel,
    placePath:
      item.country_slug && item.district_slug && item.municipality_slug
        ? buildGeoHubPath({
            countrySlug: item.country_slug,
            districtSlug: item.district_slug,
            municipalitySlug: item.municipality_slug
          })
        : placeLabel
          ? buildPlaceHubPath(placeLabel)
          : null,
    photographerPath:
      item.profile_id && (item as any).profile?.accountname
        ? buildPhotographerHubPath((item as any).profile.accountname)
        : null
  };
}

export async function loadContentPage(args: {
  slug: string;
  requestedPath: string;
  typeSlugHint?: string;
  groupSlugHint?: string;
  skipCanonicalRedirect?: boolean;
}) {
  const supabase = createServerSupabase();
  const typeMap = await getTypeMap(supabase);
  const requestedPath = normalizePath(args.requestedPath);
  let item: ItemRecord | null = null;
  let type: Partial<ContentTypeDefinition> | null = null;

  if (args.typeSlugHint && args.groupSlugHint) {
    const hintedType = getTypeBySlug(args.typeSlugHint);
    if (hintedType?.id) {
      const namedRoot = await getNamedRootByGroupSlug(supabase, hintedType.id, args.groupSlugHint);
      if (namedRoot && args.slug === args.groupSlugHint) {
        item = namedRoot;
        type = typeMap.get(namedRoot.type_id || hintedType.id) ?? hintedType;
      }
    }
  }

  if (!item) {
    item = await getItemBySlug(supabase, args.slug);
    if (item?.type_id) {
      type = typeMap.get(item.type_id) ?? DEFAULT_CONTENT_TYPE_BY_ID.get(item.type_id) ?? null;
    }
  }

  if (!item) {
    throw error(404, 'Item not found');
  }

  if (!isPubliclyVisibleItem(item)) {
    throw error(404, 'Item not publicly available');
  }

  const rootItem = await getRootItem(supabase, item);
  if (rootItem?.type_id) {
    type = typeMap.get(rootItem.type_id) ?? type ?? null;
  }

  const canonicalPath = getStoredOrComputedCanonicalPath({ item, rootItem, type });
  if (!args.skipCanonicalRedirect && canonicalPath && normalizePath(canonicalPath) !== requestedPath) {
    return {
      redirectTo: canonicalPath
    };
  }

  const [profileData, groupItems, seoLinks] = await Promise.all([
    getProfile(supabase, item.profile_id),
    getGroupItems(supabase, rootItem),
    getSeoLinks(supabase, item)
  ]);

  const rootCanonicalPath = getStoredOrComputedCanonicalPath({ item: rootItem, rootItem, type });
  const siblings = [rootItem, ...groupItems]
    .filter((candidate, index, list) => list.findIndex((other) => other.id === candidate.id) === index)
    .filter((candidate) => isPubliclyVisibleItem(candidate))
    .map((candidate) => ({
      ...makeGroupPreview(candidate, type, rootItem),
      isActive: candidate.id === item.id
    }));

  const contextItem = rootItem.id === item.id ? item : rootItem;
  const availableTypes = Array.from(typeMap.values())
    .filter((candidate): candidate is Partial<ContentTypeDefinition> & { id: number } => typeof candidate?.id === 'number')
    .sort((a, b) => (a.id || 0) - (b.id || 0));
  const imageWithProfile = { ...item, profile: profileData.profile, full_name: profileData.full_name };
  const related = await getRelatedItems(supabase, imageWithProfile, rootItem, type);
  const typePath = type?.slug ? `/${type.slug}` : null;

  const imageForClient = {
    ...sanitizeItemForItemPageClient({ ...item }),
    profile: profileData.profile,
    full_name: profileData.full_name
  };
  const rootForClient =
    rootItem.id === item.id ? imageForClient : sanitizeItemForItemPageClient({ ...rootItem });
  const contextForClient =
    contextItem.id === item.id ? imageForClient : sanitizeItemForItemPageClient({ ...contextItem });

  return {
    image: imageForClient,
    error: null,
    nearby: [],
    seoLinks,
    canonicalPath,
    type,
    rootItem: rootForClient,
    rootCanonicalPath,
    contextItem: contextForClient,
    groupItems: siblings,
    activeGroupItemId: item.id,
    availableTypes,
    seoHubs: {
      typePath,
      typeLabel: type?.name || null,
      keywordLinks: related.keywordLinks,
      photographerPath:
        profileData.profile?.accountname ? buildPhotographerHubPath(profileData.profile.accountname) : null,
      photographerLabel: profileData.profile?.full_name || profileData.profile?.accountname || null,
      placePath: related.placePath,
      placeLabel: related.placeLabel
    },
    relatedContent: {
      sameType: related.sameType,
      sameCreator: related.sameCreator,
      sameKeyword: related.sameKeyword,
      samePlace: related.samePlace
    }
  };
}
