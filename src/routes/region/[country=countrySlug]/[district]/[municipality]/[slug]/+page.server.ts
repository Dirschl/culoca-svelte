import { redirect } from '@sveltejs/kit';
import { loadContentPage } from '$lib/content/server';
import { toCanonicalAbsoluteUrl } from '$lib/seo/site';
import { buildGeoHubPageData, loadGeoHubBySegments } from '$lib/seo/hubServer';
import { getHubSeoPolicy } from '$lib/seo/policy';

const PAGE_SIZE = 24;

export const load = async ({
  params,
  url,
  depends,
  setHeaders
}: {
  params: { country: string; district: string; municipality: string; slug: string };
  url: URL;
  depends: (...deps: string[]) => void;
  setHeaders: (headers: Record<string, string>) => void;
}) => {
  depends('app:item');

  const hubSearch = (url.searchParams.get('suche') || '').trim();

  try {
    const hub = await loadGeoHubBySegments(
      params.country,
      [params.district, params.municipality, params.slug],
      1,
      PAGE_SIZE,
      hubSearch
    );
    const data = buildGeoHubPageData(hub, 1, PAGE_SIZE, hubSearch);

    return {
      ...data,
      countryOptions: [],
      seoPolicy: getHubSeoPolicy({
        basePath: data.hubPath,
        page: 1,
        hasSearch: !!hubSearch
      })
    };
  } catch (hubError) {
    if (!(hubError && typeof hubError === 'object' && 'status' in hubError && hubError.status === 404)) {
      throw hubError;
    }
  }

  const result = await loadContentPage({
    slug: params.slug,
    requestedPath: url.pathname
  });

  if ('redirectTo' in result) {
    throw redirect(301, result.redirectTo as string);
  }

  if (result.canonicalPath) {
    setHeaders({
      Link: `<${toCanonicalAbsoluteUrl(result.canonicalPath)}>; rel="canonical"`
    });
  }

  return result;
};
