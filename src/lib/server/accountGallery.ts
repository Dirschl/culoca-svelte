import { createClient } from '@supabase/supabase-js';
import { error } from '@sveltejs/kit';
import { getHubSeoPolicy } from '$lib/seo/policy';
import { getPublicItemHref } from '$lib/content/routing';

const PAGE_SIZE = 24;

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
  const accountname = accountnameParam.toLowerCase();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, accountname, bio, avatar_url, website')
    .eq('accountname', accountname)
    .maybeSingle();

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
  if (!totalCount) {
    throw error(404, 'Keine öffentlichen Inhalte gefunden');
  }

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
  const { data: items, error: itemsError } = await supabase
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

  const hubPath = `/${accountname}`;

  return {
    profile,
    items: (items || []).map((item) => ({
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
