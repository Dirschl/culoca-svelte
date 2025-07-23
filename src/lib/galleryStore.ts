import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

// Gallery Items and Loading State
export const galleryItems = writable<any[]>([]);
export const isGalleryLoading = writable(false);
export const galleryTotalCount = writable(0);
export const hasMoreGalleryItems = writable(true);
export const galleryParams = writable({ search: '', lat: null, lon: null, radius: null });

// Global Layout Store - shared between main page and detail page
export const useJustifiedLayout = writable(true);

// GPS Position für clientseitige Sortierung
export const currentGPSPosition = writable<{ lat: number; lon: number } | null>(null);

// Initialize layout from localStorage
if (browser) {
  const stored = localStorage.getItem('useJustifiedLayout');
  if (stored !== null) {
    useJustifiedLayout.set(stored === 'true');
  }
  
  // Save to localStorage when changed
  useJustifiedLayout.subscribe((value) => {
    localStorage.setItem('useJustifiedLayout', String(value));
  });
}

// Function to toggle layout globally
export function toggleLayout() {
  useJustifiedLayout.update(current => !current);
  console.log('[Global-Layout-Toggle] Switched to:', get(useJustifiedLayout) ? 'justified' : 'grid');
}

// Entfernungsberechnung für clientseitige Sortierung
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Erdradius in Metern
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Clientseitige Sortierung der bereits geladenen Items nach GPS-Position
export function sortGalleryByGPS(lat: number, lon: number) {
  const currentItems = get(galleryItems);
  if (currentItems.length === 0) {
    console.log('[GalleryStore] No items to sort');
    return;
  }
  
  console.log('[GalleryStore] Sorting', currentItems.length, 'items by GPS position:', lat, lon);
  
  // Sortiere die vorhandenen Items nach GPS-Entfernung
  const sortedItems = [...currentItems].sort((a: any, b: any) => {
    if (!a.lat || !a.lon || !b.lat || !b.lon) return 0;
    
    const distanceA = getDistanceInMeters(lat, lon, a.lat, a.lon);
    const distanceB = getDistanceInMeters(lat, lon, b.lat, b.lon);
    
    return distanceA - distanceB;
  });
  
  // Nur updaten wenn sich die Reihenfolge geändert hat
  const firstItemChanged = sortedItems.length > 0 && currentItems.length > 0 && 
                          sortedItems[0].id !== currentItems[0].id;
  
  if (firstItemChanged) {
    console.log('[GalleryStore] Items re-sorted, closest item is now:', sortedItems[0]?.id);
    galleryItems.set(sortedItems);
    // Update GPS position for future reference
    currentGPSPosition.set({ lat, lon });
  } else {
    console.log('[GalleryStore] No sorting change needed');
  }
}

// Update GPS position ohne Reload - nur clientseitige Sortierung
export function updateGPSPosition(lat: number, lon: number) {
  const currentPos = get(currentGPSPosition);
  
  // Nur sortieren wenn sich GPS-Position signifikant geändert hat (>10m)
  if (currentPos) {
    const distance = getDistanceInMeters(currentPos.lat, currentPos.lon, lat, lon);
    if (distance < 10) {
      console.log('[GalleryStore] GPS change too small (<10m), skipping re-sort');
      return;
    }
  }
  
  console.log('[GalleryStore] GPS position updated, triggering client-side sort');
  sortGalleryByGPS(lat, lon);
}

let offset = 0;
const limit = 50; // Erhöht auf 50 für besseres Preloading
let currentRequestId = 0;

export async function loadMoreGallery(params: { search?: string; lat?: number; lon?: number; radius?: number } = {}) {
  if (typeof window === 'undefined') return; // Nur im Browser ausführen!
  currentRequestId++;
  const thisRequestId = currentRequestId;

  // Prüfe sofort ohne weitere Verzögerung
  if (get(isGalleryLoading) || !get(hasMoreGalleryItems)) return;
  isGalleryLoading.set(true);

  // --- NEU: Location Filter Koordinaten bevorzugen ---
  let mergedParams = { ...get(galleryParams), ...params };
  try {
    const filterState = get(require('./filterStore').filterStore);
    if (filterState.locationFilter) {
      mergedParams.lat = filterState.locationFilter.lat;
      mergedParams.lon = filterState.locationFilter.lon;
      // Pass fromItem flag if location filter is from an item
      if (filterState.locationFilter.fromItem) {
        mergedParams.fromItem = true;
      }
    }
  } catch (e) {
    // fallback: keine Änderung
  }
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
  if (mergedParams.fromItem) url.searchParams.set('fromItem', 'true');

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

      // WORKAROUND: For fromItem location filters, ensure first item has distance 0
      if (mergedParams.fromItem && mapped && mapped.length > 0 && offset === 0) {
        mapped[0].distance = 0;
        mapped[0].isSourceItem = true;
        console.log('[GalleryStore] FromItem workaround: Set first item distance to 0m for item:', mapped[0].id);
      }

      console.log('[GalleryStore] Mapped images:', mapped.length);

      if (offset === 0) {
        galleryItems.set(mapped);
      } else {
        // Progressives Hinzufügen für flüssigere UX
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
  // Prüfe ob sich die Parameter wirklich geändert haben
  const currentParams = get(galleryParams);
  const newParams = { 
    search: params.search || '', 
    lat: params.lat || null, 
    lon: params.lon || null, 
    radius: params.radius || null 
  };
  
  // Nur zurücksetzen wenn sich Parameter geändert haben
  const hasChanged = currentParams.search !== newParams.search ||
                    currentParams.lat !== newParams.lat ||
                    currentParams.lon !== newParams.lon ||
                    currentParams.radius !== newParams.radius;
  
  if (!hasChanged && get(galleryItems).length > 0) {
    console.log('[GalleryStore] Parameters unchanged, skipping reset');
    return;
  }
  
  console.log('[GalleryStore] Parameters changed, resetting gallery');
  offset = 0;
  galleryItems.set([]);
  hasMoreGalleryItems.set(true);
  isGalleryLoading.set(false);
  
  // Setze neue Parameter
  galleryParams.set(newParams);
  
  loadMoreGallery(params);
} 