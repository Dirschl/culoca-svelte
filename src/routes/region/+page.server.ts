import type { PageServerLoad } from './$types';
import { loadGeoHomeOverview } from '$lib/seo/hubServer';
import { getHubSeoPolicy } from '$lib/seo/policy';

export const load: PageServerLoad = async () => {
  const countryOptions = await loadGeoHomeOverview();
  return {
    countryOptions,
    seoPolicy: getHubSeoPolicy({
      basePath: '/region',
      page: 1,
      hasSearch: false
    })
  };
};
