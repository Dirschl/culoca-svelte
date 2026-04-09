import { redirect } from '@sveltejs/kit';
import { buildGeoHubPath } from '$lib/geo/hierarchy';
import {
  loadGeoDistrictHub,
  buildGeoHubPageData,
  loadGeoHomeOverview,
  loadGeoHubBySegments
} from '$lib/seo/hubServer';
import { getHubSeoPolicy } from '$lib/seo/policy';

const PAGE_SIZE = 24;

export const load = async ({ params, url }: { params: { country: string; district: string }; url: URL }) => {
  const page = Math.max(1, Number.parseInt(url.searchParams.get('seite') || '1', 10));
  const countryOptions = await loadGeoHomeOverview();

  try {
    const hub = await loadGeoHubBySegments(params.country, [params.district], page, PAGE_SIZE);
    const data = buildGeoHubPageData(hub, page, PAGE_SIZE);

    return {
      ...data,
      countryOptions,
      seoPolicy: getHubSeoPolicy({
        basePath: data.hubPath,
        page
      })
    };
  } catch (routeError) {
    if (!(routeError && typeof routeError === 'object' && 'status' in routeError && routeError.status === 404)) {
      throw routeError;
    }
  }

  const hub = await loadGeoDistrictHub(params.country, params.district, page, PAGE_SIZE);
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
