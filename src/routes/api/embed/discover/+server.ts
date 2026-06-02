import { json } from '@sveltejs/kit';
import { fetchDiscoverEmbedItems } from '$lib/server/embedGalleryItems';

/**
 * Public embed: random gallery items from diverse municipalities (WordPress Link Preview).
 * GET /api/embed/discover?count=50
 */
export async function GET({ url }: { url: URL }) {
	const count = parseInt(url.searchParams.get('count') || '50', 10);

	const { error, items } = await fetchDiscoverEmbedItems(count);

	if (error) {
		console.error('[Embed Discover] error:', error);
		return json({ error: 'Failed to fetch discover items', mode: 'discover' }, { status: 500 });
	}

	return json(
		{
			mode: 'discover',
			count: items.length,
			items
		},
		{
			headers: {
				'Cache-Control': 'public, max-age=900, s-maxage=900'
			}
		}
	);
}
