import { loadGeoDistrictHub } from '$lib/seo/hubServer';
import { getHubSeoPolicy } from '$lib/seo/policy';

const PAGE_SIZE = 24;

export const load = async ({ params, url }: { params: { country: string; district: string }; url: URL }) => {
  const page = Math.max(1, Number.parseInt(url.searchParams.get('seite') || '1', 10));
  const hub = await loadGeoDistrictHub(params.country, params.district, page, PAGE_SIZE);
  const hubPath = `/${params.country}/${params.district}`;

  return {
    hubType: 'geo-district',
    kicker: 'Landkreis-Hub',
    hubLabel: hub.districtName || params.district,
    hubPath,
    countryName: hub.countryName,
    countryPath: `/${params.country}`,
    districtName: hub.districtName || params.district,
    districtPath: hubPath,
    items: hub.items,
    totalCount: hub.totalCount,
    page,
    totalPages: Math.max(1, Math.ceil(hub.totalCount / PAGE_SIZE)),
    breadcrumbs: [
      { name: 'Culoca', path: '/' },
      { name: hub.countryName, path: `/${params.country}` },
      { name: hub.districtName || params.district, path: hubPath }
    ],
    intro: `Diese Seite bündelt die öffentlich sichtbaren Inhalte aus ${hub.districtName || params.district} und stärkt die regionale SEO-Struktur von Culoca.`,
    fallbackDescription: `Mehr Inhalte aus ${hub.districtName || params.district}.`,
    metaDescription: `Entdecke ${hub.totalCount} öffentliche Inhalte aus ${hub.districtName || params.district} auf Culoca.`,
    seoPolicy: getHubSeoPolicy({
      basePath: hubPath,
      page
    })
  };
};
