import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadSimilarMotifPreviewsForPublicSlug } from '$lib/content/server';

export const GET: RequestHandler = async ({ params }) => {
	const slug = params.slug?.trim();
	if (!slug) throw error(400, 'Missing slug');

	try {
		const items = await loadSimilarMotifPreviewsForPublicSlug(slug);
		return json(
			{ items },
			{
				headers: {
					'Cache-Control': 'public, max-age=120, stale-while-revalidate=300',
					'X-Robots-Tag': 'noindex, nofollow'
				}
			}
		);
	} catch (e: unknown) {
		const err = e as { status?: number };
		if (err?.status === 404) throw e;
		console.error('[api/similar-motifs]', slug, e);
		throw error(500, 'Failed to load similar motifs');
	}
};
