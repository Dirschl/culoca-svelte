import { supabaseAdmin } from '$lib/supabaseAdmin';
import { supabase } from '$lib/supabaseClient';
import { readPanoramaSettings } from '$lib/server/panorama';

const db = supabaseAdmin ?? supabase;
const STORAGE_BASE = 'https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048';

function encodeObjectPath(path: string) {
	return path.split('/').map(encodeURIComponent).join('/');
}

export async function GET({ params }: { params: { slug: string } }) {
	const { data: item, error } = await db
		.from('items')
		.select('slug, is_private, page_settings')
		.eq('slug', params.slug)
		.maybeSingle();

	const panorama = readPanoramaSettings(item?.page_settings);
	if (error || !item || item.is_private || !panorama) {
		return new Response('Panorama not found', {
			status: 404,
			headers: { 'Cache-Control': 'public, max-age=300' }
		});
	}

	return new Response(null, {
		status: 307,
		headers: {
			Location: `${STORAGE_BASE}/${encodeObjectPath(panorama.path)}`,
			'Cache-Control': 'public, max-age=86400, s-maxage=86400',
			'X-Robots-Tag': 'noimageindex',
			'X-Content-Type-Options': 'nosniff'
		}
	});
}
