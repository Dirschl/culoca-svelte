export type ReverseGeocodeFields = {
  countryName: string | null;
  stateName: string | null;
  districtName: string | null;
  municipalityName: string | null;
  localityName: string | null;
  displayName: string | null;
};

export type SearchGeocodeResult = ReverseGeocodeFields & {
  lat: number;
  lon: number;
};

type NominatimAddress = Record<string, string | undefined>;

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

export function extractReverseGeocodeFields(address: NominatimAddress, displayName?: string | null): ReverseGeocodeFields {
  const countryName = firstNonEmpty(address.country);
  const stateName = firstNonEmpty(address.state);
  const municipalityName = firstNonEmpty(
    address.city,
    address.town,
    address.village,
    address.municipality,
    address.city_district
  );
  const districtName = firstNonEmpty(
    address.county,
    stateName,
    municipalityName
  );
  const localityName = firstNonEmpty(
    address.suburb,
    address.neighbourhood,
    address.quarter,
    address.city_district,
    address.hamlet
  );

  return {
    countryName,
    stateName,
    districtName,
    municipalityName,
    localityName,
    displayName: firstNonEmpty(displayName)
  };
}

export async function reverseGeocodeCoordinates(lat: number, lon: number): Promise<ReverseGeocodeFields | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('zoom', '18');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('accept-language', 'de');

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return extractReverseGeocodeFields(data?.address || {}, data?.display_name || null);
}

export async function searchLocationHierarchy(query: string): Promise<SearchGeocodeResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '6');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('accept-language', 'de');
  url.searchParams.set('q', trimmed);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  if (!Array.isArray(data)) return [];

  return data
    .map((entry) => {
      const lat = Number(entry?.lat);
      const lon = Number(entry?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const extracted = extractReverseGeocodeFields(entry?.address || {}, entry?.display_name || null);
      return {
        ...extracted,
        lat,
        lon
      };
    })
    .filter((entry): entry is SearchGeocodeResult => Boolean(entry));
}
