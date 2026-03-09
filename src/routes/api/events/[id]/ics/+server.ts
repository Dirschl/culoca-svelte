import { error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { createEventIcs, getEventSettings, isEventType } from '$lib/events';

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

export async function GET({ params }: any) {
  const supabase = createServerSupabase();

  const { data: item, error: itemError } = await supabase
    .from('items')
    .select('id, title, description, caption, slug, type_id, starts_at, ends_at, is_private, page_settings')
    .eq('id', params.id)
    .maybeSingle();

  if (itemError) throw error(500, itemError.message);
  if (!item || item.is_private || !isEventType(item)) throw error(404, 'Event not found');

  const ics = createEventIcs(item, getEventSettings(item.page_settings));
  if (!ics) throw error(400, 'Event has no start date');

  const filename = `${item.slug || item.id}.ics`;

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="${filename}"`
    }
  });
}
