import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { loadContentPage } from '$lib/content/server';

export const load: PageServerLoad = async ({ params, url, depends, setHeaders }) => {
  depends('app:item-download');
  setHeaders({
    'X-Robots-Tag': 'noindex, follow'
  });

  const result = await loadContentPage({
    slug: params.slug,
    requestedPath: url.pathname,
    skipCanonicalRedirect: true
  });

  if ('redirectTo' in result) {
    throw error(404, 'Item nicht gefunden');
  }

  return result;
};
