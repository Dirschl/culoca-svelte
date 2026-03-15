import { redirect } from '@sveltejs/kit';
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
  depends('app:item');

  const result = await loadContentPage({
    slug: params.slug,
    requestedPath: url.pathname
  });

  if ('redirectTo' in result) {
    throw redirect(301, result.redirectTo as string);
  }

  return result;
};
