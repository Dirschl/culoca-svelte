import type { PageServerLoad } from './$types';
import { redirect, error } from '@sveltejs/kit';
import { loadContentPage } from '$lib/content/server';

export const load: PageServerLoad = async ({ params, url }) => {
  // SvelteKit rest params arrive as a single slash-delimited string.
  const segments = (params.segments ?? '')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length < 1 || segments.length > 2) {
    throw error(404, 'Not found');
  }

  const finalSlug = segments[segments.length - 1];
  const groupSlugHint = segments[0];

  const result = await loadContentPage({
    slug: finalSlug,
    requestedPath: url.pathname,
    typeSlugHint: params.type,
    groupSlugHint
  });

  if ('redirectTo' in result) {
    throw redirect(301, result.redirectTo as string);
  }

  return result;
};
