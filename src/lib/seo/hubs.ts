import { normalizeAdminDisplayLabel } from '$lib/content/locationTaxonomy';
import { slugifySegment } from '$lib/content/routing';

export type HubLink = {
  label: string;
  path: string;
};

export function buildKeywordHubPath(keyword: string): string {
  const label = (keyword || '').trim();
  if (!label) return '/foto';
  return `/foto?suche=${encodeURIComponent(label)}`;
}

export function buildPhotographerHubPath(accountname: string): string {
  return `/${slugifySegment(accountname)}`;
}

export function buildPlaceHubPath(place: string): string {
  return `/ort/${slugifySegment(place)}`;
}

export function buildGeoCountryHubPath(countrySlug: string): string {
  return `/${slugifySegment(countrySlug)}`;
}

export function buildGeoDistrictHubPath(countrySlug: string, districtSlug: string): string {
  return `/${slugifySegment(countrySlug)}/${slugifySegment(districtSlug)}`;
}

export function buildGeoMunicipalityHubPath(
  countrySlug: string,
  districtSlug: string,
  municipalitySlug: string
): string {
  return `/${slugifySegment(countrySlug)}/${slugifySegment(districtSlug)}/${slugifySegment(municipalitySlug)}`;
}

export function normalizeHubToken(value: string | null | undefined): string {
  return slugifySegment(value || '');
}

export function getKeywordHubLinks(keywords: string[] | null | undefined, limit = 6): HubLink[] {
  if (!Array.isArray(keywords)) return [];

  const unique = new Set<string>();
  const links: HubLink[] = [];

  for (const keyword of keywords) {
    const label = (keyword || '').trim();
    const token = normalizeHubToken(label);
    if (!label || !token || unique.has(token)) continue;
    unique.add(token);
    links.push({ label, path: buildKeywordHubPath(label) });
    if (links.length >= limit) break;
  }

  return links;
}

export function decodeHubSlug(slug: string): string {
  return decodeURIComponent(slug)
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function pickPlaceLabel(
  eventLocationName: string | null | undefined,
  keywords: string[] | null | undefined
): string | null {
  const direct = (eventLocationName || '').trim();
  if (direct) return direct;

  if (!Array.isArray(keywords)) return null;
  const locationLike = keywords.find((keyword) => {
    const value = (keyword || '').trim();
    if (!value) return false;
    return /[A-ZÄÖÜ]/.test(value[0] || '') || value.split(/\s+/).length >= 2;
  });

  return locationLike?.trim() || null;
}

/** SEO-Ortslabel: bevorzugt Gemeinde, sonst Landkreis, sonst Event-Ort/Keywords. */
export function pickItemPlaceLabelForSeo(item: {
  municipality_name?: string | null;
  district_name?: string | null;
  page_settings?: unknown;
  keywords?: string[] | null;
}): string | null {
  const muni = normalizeAdminDisplayLabel(item.municipality_name);
  if (muni) return muni;
  const district = normalizeAdminDisplayLabel(item.district_name);
  if (district) return district;
  return pickPlaceLabel(
    (item.page_settings as Record<string, unknown> | null)?.location_name as string | null | undefined,
    item.keywords || []
  );
}
