import { browser } from '$app/environment';

export type GpsPromptPreference = 'ask' | 'skip' | 'map' | 'gps';
export type RememberedLocationSource = 'gps' | 'manual';

export interface RememberedLocation {
  lat: number;
  lon: number;
  label: string | null;
  source: RememberedLocationSource;
}

const LOCATION_LABEL_KEY = 'culoca-location-label';
const LOCATION_SOURCE_KEY = 'culoca-location-source';
const GPS_PROMPT_PREFERENCE_KEY = 'culoca-gps-preference';

export function getGpsPromptPreference(): GpsPromptPreference | null {
  if (!browser) return null;
  const value = localStorage.getItem(GPS_PROMPT_PREFERENCE_KEY);
  if (value === 'ask' || value === 'skip' || value === 'map' || value === 'gps') return value;
  return null;
}

export function setGpsPromptPreference(value: GpsPromptPreference): void {
  if (!browser) return;
  localStorage.setItem(GPS_PROMPT_PREFERENCE_KEY, value);
}

export function saveRememberedLocation(
  lat: number,
  lon: number,
  options: { label?: string | null; source?: RememberedLocationSource } = {}
): RememberedLocation | null {
  if (!browser || Number.isNaN(lat) || Number.isNaN(lon)) return null;

  const source = options.source ?? 'manual';
  const label = options.label?.trim() || null;
  const location = { lat, lon, label, source };

  localStorage.setItem('userGps', JSON.stringify({ lat, lon, timestamp: Date.now() }));
  localStorage.setItem('userLat', String(lat));
  localStorage.setItem('userLon', String(lon));
  localStorage.setItem('gpsAllowed', 'true');
  localStorage.setItem(LOCATION_SOURCE_KEY, source);

  if (label) {
    localStorage.setItem(LOCATION_LABEL_KEY, label);
  } else {
    localStorage.removeItem(LOCATION_LABEL_KEY);
  }

  setGpsPromptPreference(source === 'gps' ? 'gps' : 'map');
  return location;
}

export function readRememberedLocation(): RememberedLocation | null {
  if (!browser) return null;

  const rawLat = localStorage.getItem('userLat');
  const rawLon = localStorage.getItem('userLon');
  const gpsAllowed = localStorage.getItem('gpsAllowed');

  if (!rawLat || !rawLon || gpsAllowed !== 'true') return null;

  const lat = Number(rawLat);
  const lon = Number(rawLon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;

  const sourceValue = localStorage.getItem(LOCATION_SOURCE_KEY);
  const source: RememberedLocationSource = sourceValue === 'gps' ? 'gps' : 'manual';

  return {
    lat,
    lon,
    label: localStorage.getItem(LOCATION_LABEL_KEY),
    source
  };
}

export function clearRememberedLocation(): void {
  if (!browser) return;

  localStorage.removeItem('userGps');
  localStorage.removeItem('userLat');
  localStorage.removeItem('userLon');
  localStorage.removeItem('gpsAllowed');
  localStorage.removeItem(LOCATION_LABEL_KEY);
  localStorage.removeItem(LOCATION_SOURCE_KEY);
}
