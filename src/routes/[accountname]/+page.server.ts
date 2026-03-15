import type { PageServerLoad } from './$types';
import { createClient } from '@supabase/supabase-js';
import { redirect } from '@sveltejs/kit';

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

export const load: PageServerLoad = async ({ params }) => {
  const accountname = params.accountname.toLowerCase();
  const supabase = createServerSupabase();
  const { data: profile } = await supabase
    .from('profiles')
    .select('accountname')
    .eq('accountname', accountname)
    .maybeSingle();

  if (profile?.accountname) {
    throw redirect(301, `/fotograf/${profile.accountname}`);
  }

  throw redirect(302, '/');
};
