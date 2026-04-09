import { redirect } from '@sveltejs/kit';
import { buildGeoHubPath } from '$lib/geo/hierarchy';
import { loadGeoDistrictHub, buildGeoHubPageData, loadGeoHomeOverview } from '$lib/seo/hubServer';
import { getHubSeoPolicy } from '$lib/seo/policy';

const PAGE_SIZE = 24;

export const load = async ({ params, url }: { params: { country: string; district: string }; url: URL }) => {
  const page = Math.max(1, Number.parseInt(url.searchParams.get('seite') || '1', 10));
  const [hub, countryOptions] = await Promise.all([
    loadGeoDistrictHub(params.country, params.district, page, PAGE_SIZE),
    loadGeoHomeOverview()
  ]);
  const canonicalHubPath =
    buildGeoHubPath({
      countrySlug: hub.countrySlug,
      stateSlug: hub.stateSlug,
      regionSlug: hub.regionSlug,
      districtSlug: hub.districtSlug
    }) || `/${params.country}/${params.district}`;

  if (canonicalHubPath !== url.pathname) {
    throw redirect(301, canonicalHubPath);
  }

  const data = buildGeoHubPageData(hub, page, PAGE_SIZE);

  return {
    ...data,
    countryOptions,
    seoPolicy: getHubSeoPolicy({
      basePath: data.hubPath,
      page
    })
  };
};
