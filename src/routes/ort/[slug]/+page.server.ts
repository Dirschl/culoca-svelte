import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { loadPlaceHub, resolveLegacyPlaceSlug } from '$lib/seo/hubServer';
import { getHubSeoPolicy } from '$lib/seo/policy';

const PAGE_SIZE = 24;

export const load: PageServerLoad = async ({ params, url }) => {
  const currentPage = Math.max(1, Number.parseInt(url.searchParams.get('seite') || '1', 10));
  const geoMatch = await resolveLegacyPlaceSlug(params.slug);

  if (geoMatch) {
    throw redirect(301, geoMatch.path);
  }

  const hub = await loadPlaceHub(params.slug);

  if (!hub.items.length) {
    throw error(404, 'Ort nicht gefunden');
  }

  const totalPages = Math.max(1, Math.ceil(hub.items.length / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);

  return {
    hubType: 'place',
    hubLabel: hub.title,
    hubPath: `/ort/${params.slug}`,
    items: hub.items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    totalCount: hub.items.length,
    page,
    totalPages,
    seoPolicy: getHubSeoPolicy({
      basePath: `/ort/${params.slug}`,
      page
    })
  };
};
