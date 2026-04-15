import { normalizePath } from '$lib/content/routing';

export type SeoPolicy = {
  canonicalPath: string;
  robots: string;
  shouldIndex: boolean;
};

/**
 * Geo-Hubs (Land → … → Gemeinde): indexierbar, damit Google die Verzeichnisstruktur
 * bis zu den Item-Detailseiten crawlen kann. Dünne/duplizierte Varianten
 * (Suche, Pagination ab Seite 3) werden auf noindex gestellt — Priorität haben die
 * einzelnen Item-URLs (siehe Item-Detail-Metadaten und Sitemap-Prioritäten).
 */
export function getHubSeoPolicy(args: {
  basePath: string;
  page: number;
  hasSearch?: boolean;
}): SeoPolicy {
  const page = Math.max(1, args.page || 1);
  const canonicalPath =
    page > 1 && !args.hasSearch
      ? `${normalizePath(args.basePath)}?seite=${page}`
      : normalizePath(args.basePath);

  if (args.hasSearch) {
    return {
      canonicalPath: normalizePath(args.basePath),
      robots: 'noindex, follow',
      shouldIndex: false
    };
  }

  if (page >= 3) {
    return {
      canonicalPath,
      robots: 'noindex, follow',
      shouldIndex: false
    };
  }

  return {
    canonicalPath,
    robots: 'index, follow',
    shouldIndex: true
  };
}

export function hasTechnicalQueryParams(searchParams: URLSearchParams, allowedKeys: string[] = []): boolean {
  for (const key of searchParams.keys()) {
    if (allowedKeys.includes(key)) continue;
    return true;
  }
  return false;
}
