import { json } from '@sveltejs/kit';
import { fetchItemEmbedBySlug } from '$lib/server/embedGalleryItems';

/**
 * Public embed: single gallery item by slug.
 * GET /api/embed/item?slug=...
 */
export async function GET({ url }: { url: URL }) {
	const slug = (url.searchParams.get('slug') || url.searchParams.get('item') || '').trim();

	if (!slug) {
		return json({ error: 'Missing slug parameter' }, { status: 400 });
	}

	const { error, item } = await fetchItemEmbedBySlug(slug);

	if (error) {
		console.error('[Embed Item] error:', error);
		return json({ error: 'Failed to fetch item' }, { status: 500 });
	}

	if (!item) {
		return json({ error: 'Item not found', slug }, { status: 404 });
	}

	return json(
		{ item },
		{
			headers: {
				'Cache-Control': 'public, max-age=86400, s-maxage=86400'
			}
		}
	);
}
