import { loadGeoMunicipalityHub } from '$lib/seo/hubServer';
import { getHubSeoPolicy } from '$lib/seo/policy';

const PAGE_SIZE = 24;

export const load = async ({
  params,
  url
}: {
  params: { country: string; district: string; municipality: string };
  url: URL;
}) => {
  const page = Math.max(1, Number.parseInt(url.searchParams.get('seite') || '1', 10));
  const hub = await loadGeoMunicipalityHub(params.country, params.district, params.municipality, page, PAGE_SIZE);
  const hubPath = `/${params.country}/${params.district}/${params.municipality}`;

  return {
    hubType: 'geo-municipality',
    kicker: 'Gemeinde-Hub',
    hubLabel: hub.municipalityName || params.municipality,
    hubPath,
    countryName: hub.countryName,
    countryPath: `/${params.country}`,
    districtName: hub.districtName || params.district,
    districtPath: `/${params.country}/${params.district}`,
    municipalityName: hub.municipalityName || params.municipality,
    municipalityPath: hubPath,
    items: hub.items,
    totalCount: hub.totalCount,
    page,
    totalPages: Math.max(1, Math.ceil(hub.totalCount / PAGE_SIZE)),
    breadcrumbs: [
      { name: 'Culoca', path: '/' },
      { name: hub.countryName, path: `/${params.country}` },
      { name: hub.districtName || params.district, path: `/${params.country}/${params.district}` },
      { name: hub.municipalityName || params.municipality, path: hubPath }
    ],
    intro: `Diese Gemeindeseite bündelt die öffentlich sichtbaren Inhalte aus ${hub.municipalityName || params.municipality} und verlinkt relevante Motive, Orte und Detailseiten.`,
    fallbackDescription: `Mehr Inhalte aus ${hub.municipalityName || params.municipality}.`,
    metaDescription: `Entdecke ${hub.totalCount} öffentliche Inhalte aus ${hub.municipalityName || params.municipality} auf Culoca.`,
    seoPolicy: getHubSeoPolicy({
      basePath: hubPath,
      page
    })
  };
};
