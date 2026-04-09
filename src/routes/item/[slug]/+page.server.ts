import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { loadContentPage } from '$lib/content/server';
import { buildItemHeroCdnImageUrl } from '$lib/seo/itemHeroImageUrl';
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

  const linkParts: string[] = [];
  const showImage = result.type?.show_image !== false;
  const heroUrl =
    showImage && result.image ? buildItemHeroCdnImageUrl(result.image) : null;
  if (heroUrl) {
    linkParts.push(`<${heroUrl}>; rel=preload; as=image`);
  }
  if (result.canonicalPath) {
    linkParts.push(`<${toCanonicalAbsoluteUrl(result.canonicalPath)}>; rel="canonical"`);
  }
  if (linkParts.length) {
    setHeaders({ Link: linkParts.join(', ') });
  }

  return result;
};
