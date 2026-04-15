import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { decodeHubSlug } from '$lib/seo/hubs';

export const load: PageServerLoad = async ({ params, url }) => {
  const keyword = decodeHubSlug(params.slug);
  const searchParams = new URLSearchParams();

  if (keyword) {
    searchParams.set('suche', keyword);
  }
  const page = Math.max(1, Number.parseInt(url.searchParams.get('seite') || '1', 10));
  if (page > 1) {
    searchParams.set('seite', String(page));
  };

  const qs = searchParams.toString();
  throw redirect(308, qs ? `/de?${qs}` : '/de');
};
