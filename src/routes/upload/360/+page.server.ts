import type { PageServerLoad } from './$types';
import { createSupabaseServerClient } from '$lib/server/supabaseServer';

export const load: PageServerLoad = async ({ url }) => {
	const copyFrom = url.searchParams.get('copyFrom')?.trim() || '';
	if (!copyFrom) return { sourceItem: null };

	const supabase = createSupabaseServerClient();
	const { data } = await supabase
		.from('items')
		.select(
			'slug, title, caption, description, keywords, lat, lon, country_name, state_name, region_name, district_name, municipality_name, locality_name, is_private'
		)
		.eq('slug', copyFrom)
		.or('is_private.is.null,is_private.eq.false')
		.maybeSingle();

	return { sourceItem: data || null };
};
