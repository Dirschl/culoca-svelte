import { loadGeoCountryHub, buildGeoHubPageData } from '$lib/seo/hubServer';
import { getHubSeoPolicy } from '$lib/seo/policy';

const PAGE_SIZE = 24;

export const load = async ({ params, url }: { params: { country: string }; url: URL }) => {
  const page = Math.max(1, Number.parseInt(url.searchParams.get('seite') || '1', 10));
  const hub = await loadGeoCountryHub(params.country, page, PAGE_SIZE);
  const data = buildGeoHubPageData(hub, page, PAGE_SIZE);

  return {
    ...data,
    seoPolicy: getHubSeoPolicy({
      basePath: data.hubPath,
      page
    })
  };
};
