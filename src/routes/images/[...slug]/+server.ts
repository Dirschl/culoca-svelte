import type { RequestHandler } from '@sveltejs/kit';
import { respondPublicImage } from '$lib/server/publicImageGet';

/**
 * SEO-Bilder: /images/{slug}-2048.jpg etc.
 * ?context=similar bleibt für alte URLs wirksam; neu: /images/similar/…
 */
export const GET: RequestHandler = async (event) => {
  const legacySimilar = event.url.searchParams.get('context') === 'similar';
  return respondPublicImage(
    event,
    legacySimilar ? 'embed_noimageindex' : 'indexable'
  );
};
