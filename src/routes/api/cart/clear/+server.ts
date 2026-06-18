import { createAuthedSupabaseFromRequest, requireAuthedUser } from '$lib/server/authedSupabase';
import { clearCart } from '$lib/server/licenseCart';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

/** Nach erfolgreichem Webhook optional: Warenkorb leeren (idempotent). */
export const POST: RequestHandler = async ({ request }) => {
	const supabase = createAuthedSupabaseFromRequest(request);
	const user = await requireAuthedUser(supabase);
	await clearCart(supabase, user.id);
	return json({ ok: true });
};
