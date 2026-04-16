import { loadGeoCountryHub, buildGeoHubPageData, loadGeoHomeOverview } from '$lib/seo/hubServer';
import { getHubSeoPolicy } from '$lib/seo/policy';

const PAGE_SIZE = 24;

export const load = async ({ params, url }: { params: { country: string }; url: URL }) => {
  const page = Math.max(1, Number.parseInt(url.searchParams.get('seite') || '1', 10));
  const hubSearch = (url.searchParams.get('suche') || '').trim();
  const [hub, countryOptions] = await Promise.all([
    loadGeoCountryHub(params.country, page, PAGE_SIZE, hubSearch),
    loadGeoHomeOverview()
  ]);
  const data = buildGeoHubPageData(hub, page, PAGE_SIZE, hubSearch);

  return {
    ...data,
    countryOptions,
    seoPolicy: getHubSeoPolicy({
      basePath: data.hubPath,
      page,
      hasSearch: !!hubSearch
    })
  };
};
