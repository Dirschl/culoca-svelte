import { error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

export function createAuthedSupabaseFromRequest(request: Request) {
	const authHeader = request.headers.get('authorization');
	if (!authHeader?.startsWith('Bearer ')) {
		throw error(401, 'Bitte zuerst anmelden.');
	}

	const supabaseUrl =
		process.env.PUBLIC_SUPABASE_URL ||
		process.env.VITE_SUPABASE_URL ||
		import.meta.env.PUBLIC_SUPABASE_URL;
	const supabaseAnonKey =
		process.env.PUBLIC_SUPABASE_ANON_KEY ||
		process.env.VITE_SUPABASE_ANON_KEY ||
		import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

	if (!supabaseUrl || !supabaseAnonKey) {
		throw error(500, 'Server-Konfigurationsfehler');
	}

	return createClient(supabaseUrl, supabaseAnonKey, {
		auth: { persistSession: false },
		global: { headers: { Authorization: authHeader } }
	});
}

export async function requireAuthedUser(supabase: ReturnType<typeof createAuthedSupabaseFromRequest>) {
	const {
		data: { user },
		error: userError
	} = await supabase.auth.getUser();
	if (userError || !user) {
		throw error(401, 'Bitte zuerst anmelden.');
	}
	return user;
}
