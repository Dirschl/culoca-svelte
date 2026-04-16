import { redirect, error } from '@sveltejs/kit';
import { loadContentPage } from '$lib/content/server';
import { toCanonicalAbsoluteUrl } from '$lib/seo/site';
import {
  buildGeoHubPageData,
  loadGeoHubBySegments,
  loadGeoHomeOverview,
  resolveLegacyPlaceSlug
} from '$lib/seo/hubServer';
import { getHubSeoPolicy } from '$lib/seo/policy';

const PAGE_SIZE = 24;

export const load = async ({
  params,
  url,
  depends,
  setHeaders
}: {
  params: { country: string; geo: string };
  url: URL;
  depends: (...deps: string[]) => void;
  setHeaders: (headers: Record<string, string>) => void;
}) => {
  depends('app:item');

  const page = Math.max(1, Number.parseInt(url.searchParams.get('seite') || '1', 10));
  const hubSearch = (url.searchParams.get('suche') || '').trim();
  const segments = (params.geo || '')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  try {
    const [hub, countryOptions] = await Promise.all([
      loadGeoHubBySegments(params.country, segments, page, PAGE_SIZE, hubSearch),
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
  } catch (hubError) {
    if (!(hubError && typeof hubError === 'object' && 'status' in hubError && hubError.status === 404)) {
      throw hubError;
    }
  }

  if (!segments.length) {
    throw error(404, 'Not found');
  }

  const legacyGeoMatch = await resolveLegacyPlaceSlug(segments[segments.length - 1]);
  if (legacyGeoMatch && legacyGeoMatch.path !== url.pathname) {
    throw redirect(301, legacyGeoMatch.path);
  }

  const slug = segments[segments.length - 1];
  const result = await loadContentPage({
    slug,
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
