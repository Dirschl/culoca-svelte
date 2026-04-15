import type { PageServerLoad } from './$types';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_CONTENT_TYPES, DEFAULT_CONTENT_TYPE_BY_SLUG } from '$lib/content/types';
import { getPublicItemHref } from '$lib/content/routing';
import { loadGeoHomeOverview } from '$lib/seo/hubServer';

export const ssr = true;

const ITEMS_PER_SECTION = 8;

const DISCOVER_SELECT =
  'id, slug, title, description, caption, canonical_path, country_slug, state_slug, region_slug, district_slug, municipality_slug, country_name, state_name, region_name, district_name, municipality_name, locality_name, path_512, path_2048, width, height, created_at, starts_at, ends_at, lat, lon';

type DiscoverRow = {
  id: string;
  slug: string;
  title: string | null;
  description: string | null;
  caption: string | null;
  canonical_path: string | null;
  path_512: string | null;
  path_2048: string | null;
  width: number | null;
  height: number | null;
  created_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  lat: number | null;
  lon: number | null;
  country_slug?: string | null;
  state_slug?: string | null;
  region_slug?: string | null;
  district_slug?: string | null;
  municipality_slug?: string | null;
  country_name?: string | null;
  state_name?: string | null;
  region_name?: string | null;
  district_name?: string | null;
  municipality_name?: string | null;
  locality_name?: string | null;
};

/** Server client ohne generiertes Database-Schema */
type ServerSupabase = SupabaseClient<any, 'public', any>;

type VariantRow = { slug: string; path_512: string | null; path_2048: string | null };

function hasDisplayableImagePath(p512: string | null | undefined, p2048: string | null | undefined): boolean {
  return Boolean(p512 || p2048);
}

/** Varianten inkl. Einträge nur mit path_2048 (path_512 fehlt noch) – wie im regionalen Hub */
async function attachDiscoverVariants(
  supabase: ServerSupabase,
  items: DiscoverRow[]
): Promise<Array<DiscoverRow & { variants: VariantRow[]; child_count: number }>> {
  if (!items.length) {
    return items.map((i) => ({ ...i, variants: [], child_count: 0 }));
  }
  const rootIds = items.map((i) => i.id);
  const { data: variantRows } = await supabase
    .from('items')
    .select('id, slug, path_512, path_2048, width, height, group_root_item_id, created_at')
    .in('group_root_item_id', rootIds)
    .eq('is_private', false)
    .eq('admin_hidden', false)
    .not('slug', 'is', null)
    .order('created_at', { ascending: false });

  const variantsByRoot = new Map<string, VariantRow[]>();
  for (const row of variantRows || []) {
    const rootId = row.group_root_item_id as string | null;
    if (!rootId) continue;
    const p512 = (row.path_512 || null) as string | null;
    const p2048 = (row.path_2048 || null) as string | null;
    if (!hasDisplayableImagePath(p512, p2048)) continue;
    const cur = variantsByRoot.get(rootId) || [];
    if (cur.length >= 8) continue;
    cur.push({ slug: row.slug as string, path_512: p512, path_2048: p2048 });
    variantsByRoot.set(rootId, cur);
  }

  return items.map((item) => ({
    ...item,
    variants: variantsByRoot.get(item.id) || [],
    child_count: (variantsByRoot.get(item.id) || []).length
  }));
}

async function loadDashboardDiscover(supabase: ServerSupabase) {
  const empty = { upcomingEvents: [] as DiscoverRow[], latestPhotos: [] as DiscoverRow[], latestFirms: [] as DiscoverRow[] };
  const eventType = DEFAULT_CONTENT_TYPE_BY_SLUG.get('event');
  const fotoType = DEFAULT_CONTENT_TYPE_BY_SLUG.get('foto');
  const firmaType = DEFAULT_CONTENT_TYPE_BY_SLUG.get('firma');
  if (!eventType || !fotoType || !firmaType) return empty;

  const nowMs = Date.now();

  const { data: rawEvents, error: evErr } = await supabase
    .from('items')
    .select(DISCOVER_SELECT)
    .eq('type_id', eventType.id)
    .eq('is_private', false)
    .eq('admin_hidden', false)
    .is('group_root_item_id', null)
    .not('slug', 'is', null)
    .not('starts_at', 'is', null)
    .order('starts_at', { ascending: true })
    .limit(80);

  if (evErr) {
    console.error('[home] dashboard discover events', evErr);
  }

  const upcomingEventsRaw = (rawEvents || [])
    .filter((row) => {
      const starts = new Date(row.starts_at as string).getTime();
      const ends = row.ends_at ? new Date(row.ends_at as string).getTime() : Number.POSITIVE_INFINITY;
      if (ends < nowMs) return false;
      if (starts >= nowMs) return true;
      if (starts < nowMs && ends >= nowMs) return true;
      return false;
    })
    .slice(0, 10) as DiscoverRow[];

  const upcomingEventsWithVariants = await attachDiscoverVariants(supabase, upcomingEventsRaw);
  const upcomingEvents = upcomingEventsWithVariants.map((item) => ({
    ...item,
    canonical_path: getPublicItemHref(item)
  }));

  const { data: rawPhotos, error: phErr } = await supabase
    .from('items')
    .select(DISCOVER_SELECT)
    .eq('type_id', fotoType.id)
    .eq('is_private', false)
    .eq('admin_hidden', false)
    .is('group_root_item_id', null)
    .not('slug', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);

  if (phErr) {
    console.error('[home] dashboard discover photos', phErr);
  }

  const photosWithVariants = await attachDiscoverVariants(supabase, (rawPhotos || []) as DiscoverRow[]);
  const latestPhotos = photosWithVariants.map((item) => ({
    ...item,
    canonical_path: getPublicItemHref(item)
  }));

  const { data: rawFirms, error: frErr } = await supabase
    .from('items')
    .select(DISCOVER_SELECT)
    .eq('type_id', firmaType.id)
    .eq('is_private', false)
    .eq('admin_hidden', false)
    .is('group_root_item_id', null)
    .not('slug', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);

  if (frErr) {
    console.error('[home] dashboard discover firms', frErr);
  }

  const firmsWithVariants = await attachDiscoverVariants(supabase, (rawFirms || []) as DiscoverRow[]);
  const latestFirms = firmsWithVariants.map((item) => ({
    ...item,
    canonical_path: getPublicItemHref(item)
  }));

  return { upcomingEvents, latestPhotos, latestFirms };
}

export const load: PageServerLoad = async () => {
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

  type SectionItem = {
    id: string;
    slug: string;
    title: string | null;
    description: string | null;
    caption: string | null;
    canonical_path: string | null;
    path_512: string | null;
    path_2048: string | null;
    width: number | null;
    height: number | null;
    created_at: string | null;
    starts_at: string | null;
    ends_at: string | null;
    lat: number | null;
    lon: number | null;
    country_slug?: string | null;
    district_slug?: string | null;
    municipality_slug?: string | null;
    country_name?: string | null;
    district_name?: string | null;
    municipality_name?: string | null;
    locality_name?: string | null;
  };

  type Section = {
    typeId: number;
    slug: string;
    name: string;
    description: string;
    items: SectionItem[];
    totalCount: number;
  };

  const sections: Section[] = [];

  const typeQueries = DEFAULT_CONTENT_TYPES.map(async (type) => {
    try {
      const { count } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('type_id', type.id)
        .eq('is_private', false)
        .eq('admin_hidden', false)
        .is('group_root_item_id', null)
        .not('slug', 'is', null);

      if (!count || count === 0) return null;

      const { data, error } = await supabase
        .from('items')
        .select(
          'id, slug, title, description, caption, canonical_path, country_slug, state_slug, region_slug, district_slug, municipality_slug, country_name, state_name, region_name, district_name, municipality_name, locality_name, path_512, path_2048, width, height, created_at, starts_at, ends_at, lat, lon'
        )
        .eq('type_id', type.id)
        .eq('is_private', false)
        .eq('admin_hidden', false)
        .is('group_root_item_id', null)
        .not('slug', 'is', null)
        .order('created_at', { ascending: false })
        .limit(ITEMS_PER_SECTION);

      if (error || !data?.length) return null;

      return {
        typeId: type.id,
        slug: type.slug,
        name: type.name,
        description: type.description,
        items: (data as SectionItem[]).map((item) => ({
          ...item,
          canonical_path: getPublicItemHref(item)
        })),
        totalCount: count
      } satisfies Section;
    } catch {
      return null;
    }
  });

  const results = await Promise.all(typeQueries);
  for (const r of results) {
    if (r) sections.push(r);
  }

  const totalItems = sections.reduce((sum, s) => sum + s.totalCount, 0);

  const dashboardDiscover = await loadDashboardDiscover(supabase);
  const geoOverview = await loadGeoHomeOverview();

  return { sections, totalItems, dashboardDiscover, geoOverview };
};
