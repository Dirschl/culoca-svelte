import { createClient } from '@supabase/supabase-js';
import { error } from '@sveltejs/kit';
import {
  computeCanonicalPath,
  getStoredOrComputedCanonicalPath,
  getTypeBySlug,
  isPubliclyVisibleItem,
  normalizePath,
  type ContentItemLike
} from '$lib/content/routing';
import { DEFAULT_CONTENT_TYPE_BY_ID, type ContentTypeDefinition } from '$lib/content/types';

type ItemRecord = ContentItemLike & {
  user_id?: string | null;
  profile_id?: string | null;
  original_name?: string | null;
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
  adobe_stock_status?: string | null;
  adobe_stock_uploaded_at?: string | null;
  adobe_stock_asset_id?: string | null;
  adobe_stock_url?: string | null;
  adobe_stock_error?: string | null;
};

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

const ITEM_SELECT = `
  id,
  user_id,
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
  starts_at,
  ends_at,
  external_url,
  video_url
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

  const { data } = await supabase.from('profiles').select('*').eq('id', profileId).maybeSingle();
  return {
    profile: data ?? null,
    full_name: data?.full_name || 'Culoca User'
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

  const baseSelect = 'id, slug, title, created_at, type_id, group_root_item_id, group_slug, canonical_path';

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

export async function loadContentPage(args: {
  slug: string;
  requestedPath: string;
  typeSlugHint?: string;
  groupSlugHint?: string;
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
  if (canonicalPath && normalizePath(canonicalPath) !== requestedPath) {
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

  return {
    image: { ...item, profile: profileData.profile, full_name: profileData.full_name },
    error: null,
    nearby: [],
    seoLinks,
    canonicalPath,
    type,
    rootItem,
    rootCanonicalPath,
    contextItem,
    groupItems: siblings,
    activeGroupItemId: item.id
  };
}
