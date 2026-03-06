import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { loadContentPage } from '$lib/content/server';

export const load: PageServerLoad = async ({ params, url, depends }) => {
  depends('app:item');

  const result = await loadContentPage({
    slug: params.slug,
    requestedPath: url.pathname
  });

  if ('redirectTo' in result) {
    throw redirect(301, result.redirectTo);
  }

  return result;
};
