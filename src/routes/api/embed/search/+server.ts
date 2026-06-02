import { json } from '@sveltejs/kit';
import { fetchDiscoverEmbedItems, fetchSearchEmbedItems } from '$lib/server/embedGalleryItems';

/**
 * Public embed: search Culoca gallery (empty query → discover).
 * GET /api/embed/search?q=Reischach+Luftbilder&count=50
 */
export async function GET({ url }: { url: URL }) {
	const q = (url.searchParams.get('q') || url.searchParams.get('search') || '').trim();
	const count = parseInt(url.searchParams.get('count') || '50', 10);

	const { error, items } = q
		? await fetchSearchEmbedItems(q, count)
		: await fetchDiscoverEmbedItems(count);

	if (error) {
		console.error('[Embed Search] error:', error);
		return json({ error: 'Failed to fetch items', mode: q ? 'search' : 'discover', search: q }, { status: 500 });
	}

	return json(
		{
			mode: q ? 'search' : 'discover',
			search: q,
			count: items.length,
			items
		},
		{
			headers: {
				'Cache-Control': q ? 'public, max-age=3600, s-maxage=3600' : 'public, max-age=900, s-maxage=900'
			}
		}
	);
}
