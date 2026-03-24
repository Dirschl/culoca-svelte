import { createClient } from '@supabase/supabase-js';
import { error } from '@sveltejs/kit';
import { getHubSeoPolicy } from '$lib/seo/policy';
import { getPublicItemHref, slugifySegment } from '$lib/content/routing';

const PAGE_SIZE = 24;

type ProfileRow = {
  id: string;
  full_name: string | null;
  accountname: string | null;
  avatar_url: string | null;
  website: string | null;
  bio?: string | null;
};

function normalizePermalinkSegment(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    return decodeURIComponent(trimmed).trim().toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

/** Escape `%` and `_` for PostgREST `.ilike()` patterns. */
function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/** Pick a substring for bounded `ilike` prefilter (longest segment, min length 3). */
function pickFullNameSearchNeedle(slug: string): string | null {
  const parts = slug.split('-').filter(Boolean);
  const candidates = parts.length ? parts : [slug];
  const ok = candidates.filter((p) => p.length >= 3);
  if (!ok.length) return null;
  return ok.reduce((a, b) => (b.length > a.length ? b : a));
}

async function resolveProfileForPermalink(
  supabase: ReturnType<typeof createClient>,
  segment: string
): Promise<ProfileRow | null> {
  const accountname = normalizePermalinkSegment(segment);
  if (!accountname || !/^[a-z0-9_-]+$/.test(accountname)) {
    return null;
  }

  const select = 'id, full_name, accountname, avatar_url, website' as const;

  let { data: profile, error: err1 } = await supabase
    .from('profiles')
    .select(select)
    .eq('accountname', accountname)
    .maybeSingle();

  if (err1 && err1.code !== 'PGRST116') {
    throw error(500, err1.message);
  }

  if (profile?.id) {
    return {
      ...(profile as ProfileRow),
      bio: (profile as any)?.bio ?? null
    };
  }

  const { data: fallbackProfile, error: err2 } = await supabase
    .from('profiles')
    .select(select)
    .ilike('accountname', accountname)
    .maybeSingle();

  if (err2 && err2.code !== 'PGRST116') {
    throw error(500, err2.message);
  }

  if (fallbackProfile?.id) {
    return {
      ...(fallbackProfile as ProfileRow),
      bio: (fallbackProfile as any)?.bio ?? null
    };
  }

  // Fallback: URL segment equals slugified display name (accountname unset / legacy / typo in marketing links)
  const needle = pickFullNameSearchNeedle(accountname);
  if (!needle) {
    return null;
  }

  const { data: candidates, error: err3 } = await supabase
    .from('profiles')
    .select(select)
    .not('full_name', 'is', null)
    .neq('full_name', '')
    .ilike('full_name', `%${escapeIlike(needle)}%`)
    .limit(200);

  if (err3) {
    throw error(500, err3.message);
  }

  const rows = (candidates || []) as ProfileRow[];
  const matches = rows.filter(
    (p) => p.full_name && slugifySegment(p.full_name) === accountname
  );

  if (matches.length === 1) {
    return {
      ...matches[0],
      bio: matches[0]?.bio ?? null
    };
  }

  return null;
}

export async function resolveProfileByPermalinkSegment(segment: string): Promise<ProfileRow | null> {
  const supabase = createServerSupabase();
  return resolveProfileForPermalink(supabase, segment);
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

export async function loadAccountGalleryPage(accountnameParam: string, pageParam: string | null) {
  const supabase = createServerSupabase();
  const currentPage = Math.max(1, Number.parseInt(pageParam || '1', 10));
  const accountname = normalizePermalinkSegment(accountnameParam);

  if (!accountname) {
    throw error(404, 'Profil nicht gefunden');
  }

  const profile = await resolveProfileForPermalink(supabase, accountname);

  if (!profile?.id) {
    throw error(404, 'Profil nicht gefunden');
  }

  const { count } = await supabase
    .from('items')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', profile.id)
    .eq('admin_hidden', false)
    .is('group_root_item_id', null)
    .not('slug', 'is', null)
    .or('is_private.eq.false,is_private.is.null');

  const totalCount = count || 0;

  const [{ count: followerCount }, { count: followingCount }] = await Promise.all([
    supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('followed_user_id', profile.id),
    supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_user_id', profile.id)
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  let items: Array<Record<string, unknown>> = [];

  if (totalCount > 0) {
    const { data: loadedItems, error: itemsError } = await supabase
      .from('items')
      .select(
        'id, slug, title, description, caption, canonical_path, country_slug, district_slug, municipality_slug, path_512, width, height, created_at'
      )
      .eq('profile_id', profile.id)
      .eq('admin_hidden', false)
      .is('group_root_item_id', null)
      .not('slug', 'is', null)
      .or('is_private.eq.false,is_private.is.null')
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (itemsError) {
      throw error(500, itemsError.message);
    }

    items = loadedItems || [];
  }

  const hubPath = `/${accountname}`;

  return {
    profile,
    items: items.map((item) => ({
      ...item,
      canonical_path: getPublicItemHref(item)
    })),
    totalCount,
    followerCount: followerCount || 0,
    followingCount: followingCount || 0,
    page,
    totalPages,
    hubPath,
    seoPolicy: getHubSeoPolicy({
      basePath: hubPath,
      page
    })
  };
}
