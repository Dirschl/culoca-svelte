import { redirect } from '@sveltejs/kit';
import { loadContentPage } from '$lib/content/server';
import { toCanonicalAbsoluteUrl } from '$lib/seo/site';
import { buildGeoHubPageData, loadGeoHubBySegments, loadGeoHomeOverview } from '$lib/seo/hubServer';
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

  try {
    const [hub, countryOptions] = await Promise.all([
      loadGeoHubBySegments(params.country, [params.district, params.municipality, params.slug], 1, PAGE_SIZE),
      loadGeoHomeOverview()
    ]);
    const data = buildGeoHubPageData(hub, 1, PAGE_SIZE);

    return {
      ...data,
      countryOptions,
      seoPolicy: getHubSeoPolicy({
        basePath: data.hubPath,
        page: 1
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
