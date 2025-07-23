import { writable, get } from 'svelte/store';

export const galleryItems = writable<any[]>([]);
export const isGalleryLoading = writable(false);
export const galleryTotalCount = writable(0);
export const hasMoreGalleryItems = writable(true);
export const galleryParams = writable({ search: '', lat: null, lon: null, radius: null });
let offset = 0;
const limit = 100;
let currentRequestId = 0;

export async function loadMoreGallery(params: { search?: string; lat?: number; lon?: number; radius?: number } = {}) {
  if (typeof window === 'undefined') return; // Nur im Browser ausführen!
  currentRequestId++;
  const thisRequestId = currentRequestId;
  if (get(isGalleryLoading) || !get(hasMoreGalleryItems)) return;
  isGalleryLoading.set(true);
  // Merge params
  const mergedParams = { ...get(galleryParams), ...params };
  galleryParams.set(mergedParams);
  const url = new URL('/api/items', window.location.origin);
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('limit', String(limit));
  if (mergedParams.search) url.searchParams.set('s', mergedParams.search);
  if (mergedParams.lat) url.searchParams.set('lat', String(mergedParams.lat));
  if (mergedParams.lon) url.searchParams.set('lon', String(mergedParams.lon));
  if (mergedParams.radius) url.searchParams.set('radius', String(mergedParams.radius));
  console.log('[GalleryStore] API-Request lat/lon:', mergedParams.lat, mergedParams.lon, 'URL:', url.toString());
  const res = await fetch(url.toString());
  if (thisRequestId !== currentRequestId) {
    // Es gab einen neueren Request, diese Antwort ignorieren!
    console.log('[GalleryStore] Ignoriere veraltete Response für RequestId', thisRequestId);
    return;
  }
  const data = await res.json();
  if (data && data.images) {
    // Mappe nur Bilder mit path_512 und baue das src-Feld (keine clientseitige Sortierung!)
    const mapped = data.images
      .filter((item: any) => item.path_512)
      .map((item: any) => ({
        src: `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${item.path_512}`,
        width: item.width,
        height: item.height,
        id: item.id,
        lat: item.lat,
        lon: item.lon,
        title: item.title,
        distance: item.distance,
        description: item.description,
        profile_id: item.profile_id
      }));
    if (offset === 0) {
      galleryItems.set(mapped);
    } else {
      galleryItems.update(items => [...items, ...mapped]);
    }
    offset += mapped.length;
    galleryTotalCount.set(data.totalCount || 0);
    hasMoreGalleryItems.set(offset < (data.totalCount || 0));
  } else {
    hasMoreGalleryItems.set(false);
  }
  isGalleryLoading.set(false);
}

export function resetGallery(params: { search?: string; lat?: number; lon?: number; radius?: number } = {}) {
  offset = 0;
  galleryItems.set([]);
  hasMoreGalleryItems.set(true);
  isGalleryLoading.set(false); // Lade-Status zurücksetzen, damit ein neuer Ladevorgang nicht blockiert wird
  loadMoreGallery(params);
} 