import { redirect } from '@sveltejs/kit';
import { loadContentPage } from '$lib/content/server';
import { toCanonicalAbsoluteUrl } from '$lib/seo/site';

export const load = async ({
  params,
  url,
  depends,
  setHeaders
}: {
  params: { country: string; district: string; municipality: string; slug: string };
  url: URL;
  depends: (...deps: string[]) => void;
  setHeaders: (headers: Record<string, string>) => void;
}) => {
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
