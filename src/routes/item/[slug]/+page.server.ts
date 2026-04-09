import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { loadContentPage } from '$lib/content/server';
import { toCanonicalAbsoluteUrl } from '$lib/seo/site';

export const load: PageServerLoad = async ({ params, url, depends, setHeaders }) => {
  depends('app:item');

  const result = await loadContentPage({
    slug: params.slug,
    requestedPath: url.pathname
  });

  if ('redirectTo' in result) {
    throw redirect(301, result.redirectTo as string);
  }

  if (result.canonicalPath) {
    setHeaders({
      Link: `<${toCanonicalAbsoluteUrl(result.canonicalPath)}>; rel="canonical"`
    });
  }

  return result;
};
