/**
 * Gleiche Priorität wie /foto (src/routes/[type=contentType]/+page.svelte getStoredGpsPosition).
 * Unabhängig von locationPreferences.readRememberedLocation (gpsAllowed),
 * damit Entfernungs-Badges überall konsistent sind.
 */
import { browser } from '$app/environment';
import { getEffectiveGpsPosition } from '$lib/filterStore';

export function getStoredGpsPositionForHub(): { lat: number; lon: number } | null {
  if (!browser || typeof window === 'undefined') return null;

  const windowLat = Number((window as unknown as { userLat?: number }).userLat);
  const windowLon = Number((window as unknown as { userLon?: number }).userLon);
  if (Number.isFinite(windowLat) && Number.isFinite(windowLon) && (windowLat !== 0 || windowLon !== 0)) {
    return { lat: windowLat, lon: windowLon };
  }

  const directLat = Number(localStorage.getItem('userLat'));
  const directLon = Number(localStorage.getItem('userLon'));
  if (Number.isFinite(directLat) && Number.isFinite(directLon) && (directLat !== 0 || directLon !== 0)) {
    return { lat: directLat, lon: directLon };
  }

  const effectiveGps = getEffectiveGpsPosition();
  if (
    effectiveGps &&
    effectiveGps.source !== 'locationFilter' &&
    Number.isFinite(effectiveGps.lat) &&
    Number.isFinite(effectiveGps.lon)
  ) {
    return { lat: effectiveGps.lat, lon: effectiveGps.lon };
  }

  try {
    const raw = localStorage.getItem('culoca-filters');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lastGpsPosition?: { lat?: number; lon?: number } };
    const lat = Number(parsed?.lastGpsPosition?.lat);
    const lon = Number(parsed?.lastGpsPosition?.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0)) {
      return { lat, lon };
    }
  } catch {
    return null;
  }

  return null;
}
