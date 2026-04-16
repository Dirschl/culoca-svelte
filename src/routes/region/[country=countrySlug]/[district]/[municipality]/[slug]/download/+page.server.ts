import { error } from '@sveltejs/kit';
import { loadContentPage } from '$lib/content/server';

export const load = async ({
  params,
  url,
  depends
}: {
  params: { country: string; district: string; municipality: string; slug: string };
  url: URL;
  depends: (...deps: string[]) => void;
}) => {
  depends('app:item-download');

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
