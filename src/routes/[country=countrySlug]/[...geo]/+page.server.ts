import { redirect, error } from '@sveltejs/kit';
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
  params: { country: string; geo: string };
  url: URL;
  depends: (...deps: string[]) => void;
  setHeaders: (headers: Record<string, string>) => void;
}) => {
  depends('app:item');

  const page = Math.max(1, Number.parseInt(url.searchParams.get('seite') || '1', 10));
  const segments = (params.geo || '')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  try {
    const hub = await loadGeoHubBySegments(params.country, segments, page, PAGE_SIZE);
    const data = buildGeoHubPageData(hub, page, PAGE_SIZE);

    return {
      ...data,
      seoPolicy: getHubSeoPolicy({
        basePath: data.hubPath,
        page
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
