import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

/**
 * Ein Supabase-Client für Server (SSR, API): URL und Keys inkl.
 * `$env/dynamic/private`, damit z. B. `SUPABASE_SERVICE_ROLE_KEY` auf Vercel
 * zuverlässig greift (nicht nur `process.env` zur Build-Zeit).
 */
export function createSupabaseServerClient(): SupabaseClient {
	const supabaseUrl = (env.PUBLIC_SUPABASE_URL ||
		env.VITE_SUPABASE_URL ||
		process.env.PUBLIC_SUPABASE_URL ||
		process.env.VITE_SUPABASE_URL ||
		import.meta.env.PUBLIC_SUPABASE_URL ||
		import.meta.env.VITE_SUPABASE_URL) as string;

	const supabaseKey = (env.SUPABASE_SERVICE_ROLE_KEY ||
		process.env.SUPABASE_SERVICE_ROLE_KEY ||
		env.PUBLIC_SUPABASE_ANON_KEY ||
		process.env.PUBLIC_SUPABASE_ANON_KEY ||
		process.env.VITE_SUPABASE_ANON_KEY ||
		import.meta.env.PUBLIC_SUPABASE_ANON_KEY ||
		import.meta.env.VITE_SUPABASE_ANON_KEY) as string;

	return createClient(supabaseUrl, supabaseKey, {
		auth: { persistSession: false }
	});
}
