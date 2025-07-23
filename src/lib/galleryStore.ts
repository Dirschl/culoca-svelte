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
  if (mergedParams.lat && mergedParams.lon) {
    url.searchParams.set('lat', String(mergedParams.lat));
    url.searchParams.set('lon', String(mergedParams.lon));
  }
  if (mergedParams.radius) url.searchParams.set('radius', String(mergedParams.radius));
  
  console.log('[GalleryStore] API-Request:', {
    params: mergedParams,
    url: url.toString(),
    hasGPS: !!(mergedParams.lat && mergedParams.lon)
  });
  
  try {
    const res = await fetch(url.toString());
    if (thisRequestId !== currentRequestId) {
      console.log('[GalleryStore] Ignoriere veraltete Response für RequestId', thisRequestId);
      return;
    }
    
    const data = await res.json();
    console.log('[GalleryStore] API Response:', {
      status: data.status,
      imageCount: data.images?.length || 0,
      totalCount: data.totalCount,
      gpsMode: data.gpsMode
    });
    
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
        
      console.log('[GalleryStore] Mapped images:', mapped.length);
      
      if (offset === 0) {
        galleryItems.set(mapped);
      } else {
        galleryItems.update(items => [...items, ...mapped]);
      }
      offset += mapped.length;
      galleryTotalCount.set(data.totalCount || 0);
      hasMoreGalleryItems.set(offset < (data.totalCount || 0));
      
      console.log('[GalleryStore] Updated store:', {
        itemsCount: mapped.length,
        totalOffset: offset,
        totalCount: data.totalCount,
        hasMore: offset < (data.totalCount || 0)
      });
    } else {
      console.log('[GalleryStore] No images in response');
      hasMoreGalleryItems.set(false);
    }
  } catch (error) {
    console.error('[GalleryStore] API Error:', error);
    hasMoreGalleryItems.set(false);
  }
  
  isGalleryLoading.set(false);
}

export function resetGallery(params: { search?: string; lat?: number; lon?: number; radius?: number } = {}) {
  offset = 0;
  galleryItems.set([]);
  hasMoreGalleryItems.set(true);
  isGalleryLoading.set(false); // Lade-Status zurücksetzen, damit ein neuer Ladevorgang nicht blockiert wird
  
  // Setze neue Parameter (überschreibe alle alten Parameter)
  galleryParams.set({ 
    search: params.search || '', 
    lat: params.lat || null, 
    lon: params.lon || null, 
    radius: params.radius || null 
  });
  
  loadMoreGallery(params);
} 