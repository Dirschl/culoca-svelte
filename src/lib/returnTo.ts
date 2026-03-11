import { VALID_CONTENT_TYPE_SLUGS } from '$lib/content/types';

const APP_ORIGIN = 'https://culoca.com';
export const LAST_LOCAL_ROUTE_KEY = 'culoca-last-local-route';

export function sanitizeReturnTo(candidate: string | null | undefined, fallback = '/'): string {
  if (!candidate) return fallback;

  try {
    const url = new URL(candidate, APP_ORIGIN);
    if (url.origin !== APP_ORIGIN) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return candidate.startsWith('/') ? candidate : fallback;
  }
}

export function currentPathWithSearch(url: URL): string {
  return `${url.pathname}${url.search}${url.hash}`;
}

export function isDetailPath(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 2) return false;

  if (segments[0] === 'item') return true;
  return VALID_CONTENT_TYPE_SLUGS.includes(segments[0]);
}
