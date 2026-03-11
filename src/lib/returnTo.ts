const APP_ORIGIN = 'https://culoca.com';

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
