import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const target = new URL('/dashboard', url.origin);
	target.searchParams.set('section', 'licenses');
	const purchase = url.searchParams.get('purchase');
	if (purchase) target.searchParams.set('purchase', purchase);
	throw redirect(307, `${target.pathname}${target.search}`);
};
