import { loadGeoCountryHub } from '$lib/seo/hubServer';
import { getHubSeoPolicy } from '$lib/seo/policy';

const PAGE_SIZE = 24;

export const load = async ({ params, url }: { params: { country: string }; url: URL }) => {
  const page = Math.max(1, Number.parseInt(url.searchParams.get('seite') || '1', 10));
  const hub = await loadGeoCountryHub(params.country, page, PAGE_SIZE);
  const hubPath = `/${params.country}`;

  return {
    hubType: 'geo-country',
    kicker: 'Land-Hub',
    hubLabel: hub.countryName,
    hubPath,
    countryName: hub.countryName,
    countryPath: hubPath,
    items: hub.items,
    totalCount: hub.totalCount,
    page,
    totalPages: Math.max(1, Math.ceil(hub.totalCount / PAGE_SIZE)),
    breadcrumbs: [
      { name: 'Culoca', path: '/' },
      { name: hub.countryName, path: hubPath }
    ],
    intro: `Diese Länderseite bündelt alle öffentlich sichtbaren Inhalte aus ${hub.countryName} und bildet den Einstieg in die regionale Hub-Struktur von Culoca.`,
    fallbackDescription: `Mehr Inhalte aus ${hub.countryName}.`,
    metaDescription: `Entdecke ${hub.totalCount} öffentliche Inhalte aus ${hub.countryName} auf Culoca.`,
    seoPolicy: getHubSeoPolicy({
      basePath: hubPath,
      page
    })
  };
};
