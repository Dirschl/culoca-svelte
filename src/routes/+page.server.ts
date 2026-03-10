import type { PageServerLoad } from './$types';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_CONTENT_TYPES } from '$lib/content/types';

export const ssr = true;

const ITEMS_PER_SECTION = 8;

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
    width: number | null;
    height: number | null;
    created_at: string | null;
    starts_at: string | null;
    ends_at: string | null;
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
        .select('id, slug, title, description, caption, canonical_path, path_512, width, height, created_at, starts_at, ends_at')
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
        items: data as SectionItem[],
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

  return { sections, totalItems };
};
