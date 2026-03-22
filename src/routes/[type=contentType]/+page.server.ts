import type { PageServerLoad } from './$types';
import { createClient } from '@supabase/supabase-js';
import { error } from '@sveltejs/kit';
import { DEFAULT_CONTENT_TYPE_BY_SLUG } from '$lib/content/types';
import { getHubSeoPolicy } from '$lib/seo/policy';
import { getPublicItemHref } from '$lib/content/routing';

export const ssr = true;

const PAGE_SIZE = 24;
const FETCH_SIZE = 1000;

function applyMultiWordSearch<T>(
  query: T,
  search: string,
  opts?: { includeKeywordsAndOriginalName?: boolean }
) {
  const words = search
    .trim()
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  const clauses = words.flatMap((word) => {
    const escaped = word.replace(/%/g, '\\%').replace(/_/g, '\\_');
    const baseClauses = [
      `title.ilike.%${escaped}%`,
      `description.ilike.%${escaped}%`,
      `caption.ilike.%${escaped}%`,
      `slug.ilike.%${escaped}%`
    ];

    if (opts?.includeKeywordsAndOriginalName) {
      baseClauses.push(`original_name.ilike.%${escaped}%`);
    }

    return baseClauses;
  });

  if (!clauses.length) return query;
  return (query as any).or(clauses.join(','));
}

function matchesAllSearchWords(
  item: {
    title?: string | null;
    description?: string | null;
    caption?: string | null;
    slug?: string | null;
    original_name?: string | null;
  },
  search: string
) {
  const words = search
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (!words.length) return true;

  const haystack = [
    item.title,
    item.description,
    item.caption,
    item.slug,
    item.original_name
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return words.every((word) => haystack.includes(word));
}

export const load: PageServerLoad = async ({ params, url }) => {
  const typeSlug = params.type;
  const typeDef = DEFAULT_CONTENT_TYPE_BY_SLUG.get(typeSlug);

  if (!typeDef) {
    throw error(404, 'Typ nicht gefunden');
  }

  const page = Math.max(1, parseInt(url.searchParams.get('seite') || '1'));
  const search = (url.searchParams.get('suche') || '').trim();

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

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  const buildBaseQuery = () => {
    let query = supabase
      .from('items')
      .select('id, slug, title, description, caption, canonical_path, country_slug, district_slug, municipality_slug, path_512, path_2048, width, height, created_at, starts_at, ends_at, external_url, lat, lon, original_name')
      .eq('type_id', typeDef.id)
      .eq('is_private', false)
      .eq('admin_hidden', false)
      .is('group_root_item_id', null)
      .not('slug', 'is', null);
    if (search) {
      query = applyMultiWordSearch(query, search, {
        includeKeywordsAndOriginalName: typeDef.slug === 'foto'
      });
    }
    return query;
  };

  const buildCountQuery = () => {
    let query = supabase
      .from('items')
      .select('*', { count: 'exact', head: true })
      .eq('type_id', typeDef.id)
      .eq('is_private', false)
      .eq('admin_hidden', false)
      .is('group_root_item_id', null)
      .not('slug', 'is', null);
    if (search) {
      query = applyMultiWordSearch(query, search, {
        includeKeywordsAndOriginalName: typeDef.slug === 'foto'
      });
    }
    return query;
  };

  let rows: any[] = [];
  let totalCount = 0;

  if (search) {
    let from = 0;
    while (true) {
      const dataResult = await buildBaseQuery()
        .order('created_at', { ascending: false })
        .range(from, from + FETCH_SIZE - 1);

      if (dataResult.error) {
        throw error(500, dataResult.error.message);
      }

      const batch = dataResult.data || [];
      if (batch.length === 0) break;
      rows.push(...batch);
      if (batch.length < FETCH_SIZE) break;
      from += FETCH_SIZE;
    }

    rows = rows.filter((item) => matchesAllSearchWords(item, search));
    totalCount = rows.length;
    rows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  } else {
    const [countResult, dataResult] = await Promise.all([
      buildCountQuery(),
      buildBaseQuery()
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    ]);

    totalCount = countResult.count || 0;
    rows = dataResult.data || [];
  }

  const baseItems = rows.map((item) => ({
    id: item.id as string,
    slug: item.slug as string,
    title: (item.title || null) as string | null,
    description: (item.description || null) as string | null,
    caption: (item.caption || null) as string | null,
    canonical_path: (item.canonical_path || null) as string | null,
    path_512: (item.path_512 || null) as string | null,
    path_2048: (item.path_2048 || null) as string | null,
    width: (item.width || null) as number | null,
    height: (item.height || null) as number | null,
    created_at: (item.created_at || null) as string | null,
    starts_at: (item.starts_at || null) as string | null,
    ends_at: (item.ends_at || null) as string | null,
    external_url: (item.external_url || null) as string | null,
    lat: (item.lat || null) as number | null,
    lon: (item.lon || null) as number | null,
    original_name: (item.original_name || null) as string | null,
    country_slug: (item.country_slug || null) as string | null,
    district_slug: (item.district_slug || null) as string | null,
    municipality_slug: (item.municipality_slug || null) as string | null,
    child_count: 0
  }));

  let items = baseItems;

  if (typeDef.slug === 'foto' && baseItems.length > 0) {
    const rootIds = baseItems.map((item) => item.id);
    const { data: variantRows } = await supabase
      .from('items')
      .select('id, slug, path_512, path_2048, width, height, group_root_item_id, created_at')
      .in('group_root_item_id', rootIds)
      .eq('is_private', false)
      .eq('admin_hidden', false)
      .not('slug', 'is', null)
      .order('created_at', { ascending: false });

    const variantsByRoot = new Map<string, Array<{
      id: string;
      slug: string;
      path_512: string | null;
      path_2048: string | null;
      width: number | null;
      height: number | null;
    }>>();

    for (const row of variantRows || []) {
      const rootId = row.group_root_item_id as string | null;
      if (!rootId) continue;
      const p512 = (row.path_512 || null) as string | null;
      const p2048 = (row.path_2048 || null) as string | null;
      if (!p512 && !p2048) continue;
      const current = variantsByRoot.get(rootId) || [];
      if (current.length >= 8) continue;
      current.push({
        id: row.id as string,
        slug: row.slug as string,
        path_512: p512,
        path_2048: p2048,
        width: (row.width || null) as number | null,
        height: (row.height || null) as number | null
      });
      variantsByRoot.set(rootId, current);
    }

    items = baseItems.map((item) => ({
      ...item,
      variants: variantsByRoot.get(item.id) || [],
      child_count: (variantsByRoot.get(item.id) || []).length
    }));
  }

  items = items.map((item) => ({
    ...item,
    canonical_path: getPublicItemHref(item)
  }));

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const seoPolicy = getHubSeoPolicy({
    basePath: `/${typeDef.slug}`,
    page,
    hasSearch: !!search
  });

  return {
    typeDef: {
      id: typeDef.id,
      name: typeDef.name,
      slug: typeDef.slug,
      description: typeDef.description
    },
    items,
    page,
    search,
    totalPages,
    totalCount,
    pageSize: PAGE_SIZE,
    seoPolicy
  };
};
