import type { RequestHandler } from '@sveltejs/kit';
import { respondPublicImage } from '$lib/server/publicImageGet';

/** Thumbnails für „Ähnliche Motive“ — immer noimageindex (Google Bildersuche). */
export const GET: RequestHandler = async (event) => {
  return respondPublicImage(event, 'embed_noimageindex');
};
