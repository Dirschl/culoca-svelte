import type { ServerLoad } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { getPublicItemHref } from '$lib/content/routing';
import {
  compareEventEndsDescending,
  compareEventStartsAscending,
  getEventSettings,
  hasEventGps,
  isPastEvent
} from '$lib/events';

type EventRow = {
  id: string;
  slug: string | null;
  canonical_path: string | null;
  title: string | null;
  caption: string | null;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  lat: number | null;
  lon: number | null;
  path_64: string | null;
  path_512: string | null;
  width: number | null;
  height: number | null;
  group_slug: string | null;
  page_settings: Record<string, unknown> | null;
  created_at: string | null;
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

export const load: ServerLoad = async () => {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from('items')
    .select('id, slug, canonical_path, title, caption, description, starts_at, ends_at, lat, lon, path_64, path_512, width, height, group_slug, page_settings, created_at')
    .eq('type_id', 2)
    .eq('admin_hidden', false)
    .is('group_root_item_id', null)
    .or('is_private.eq.false,is_private.is.null');

  if (error) {
    console.error('[Events] Failed to load events:', error);
    return {
      withGpsEvents: [],
      withoutGpsEvents: [],
      pastEvents: []
    };
  }

  const items = (data || []).map((item: EventRow) => ({
    ...item,
    href: getPublicItemHref(item),
    eventSettings: getEventSettings(item.page_settings)
  }));

  const withGpsEvents = items
    .filter((item) => !isPastEvent(item) && hasEventGps(item))
    .sort(compareEventStartsAscending);

  const withoutGpsEvents = items
    .filter((item) => !isPastEvent(item) && !hasEventGps(item))
    .sort(compareEventStartsAscending);

  const pastEvents = items
    .filter((item) => isPastEvent(item))
    .sort(compareEventEndsDescending);

  return {
    withGpsEvents,
    withoutGpsEvents,
    pastEvents
  };
};
