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

let offset = 0;
const limit = 50; // Erhöht auf 50 für besseres Preloading
let currentRequestId = 0;

export async function loadMoreGallery(params: { search?: string; lat?: number; lon?: number; radius?: number; user_id?: string } = {}) {
  if (typeof window === 'undefined') return; // Nur im Browser ausführen!
  currentRequestId++;
  const thisRequestId = currentRequestId;

  // Prüfe sofort ohne weitere Verzögerung
  if (get(isGalleryLoading) || !get(hasMoreGalleryItems)) return;
  isGalleryLoading.set(true);
  
  console.log('[GalleryStore] loadMoreGallery called with params:', params);

  // --- NEU: Location Filter Koordinaten bevorzugen ---
  let mergedParams = { ...get(galleryParams), ...params };
  try {
    // WICHTIG: User-Filter aus dem Store holen und anwenden
    const { filterStore } = await import('./filterStore');
    const filterState = get(filterStore);
    
    // NEU: Location Filter hat höchste Priorität
    if (filterState.locationFilter) {
      mergedParams.lat = filterState.locationFilter.lat;
      mergedParams.lon = filterState.locationFilter.lon;
      mergedParams.fromItem = true; // Immer setzen, wenn Location-Filter aktiv
      console.log('[GalleryStore] Using Location Filter coordinates:', mergedParams.lat, mergedParams.lon);
    } else {
      // Nur wenn kein Location Filter gesetzt ist, verwende aktuelle GPS-Position
      if (!mergedParams.lat || !mergedParams.lon) {
        // Versuche GPS-Koordinaten aus dem Browser zu holen
        if (typeof window !== 'undefined') {
          // Hole GPS-Koordinaten aus dem Hauptspeicher (falls verfügbar)
          const userLat = (window as any).userLat;
          const userLon = (window as any).userLon;
          if (userLat && userLon) {
            mergedParams.lat = userLat;
            mergedParams.lon = userLon;
            console.log('[GalleryStore] Using GPS from window object:', mergedParams.lat, mergedParams.lon);
          }
        }
      }
    }
    
    // WICHTIG: User-Filter aus dem Store holen und anwenden
    if (filterState.userFilter && filterState.userFilter.userId) {
      mergedParams.user_id = filterState.userFilter.userId;
      console.log('[GalleryStore] Applying user filter from store:', filterState.userFilter.userId);
    } else {
      console.log('[GalleryStore] No user filter found in store');
    }
  } catch (e) {
    console.warn('[GalleryStore] Error getting filter state:', e);
    // fallback: keine Änderung
  }
  
  // NEU: Verbesserte GPS-Behandlung
  // Wenn Location Filter gesetzt ist, immer laden (auch ohne GPS)
  // Wenn User Filter gesetzt ist, auch ohne GPS laden (Sortierung nach Datum)
  // Nur bei normalen Filtern ohne GPS warten
  if (!mergedParams.lat || !mergedParams.lon) {
    if (mergedParams.user_id) {
      // Bei User-Filter auch ohne GPS laden (Sortierung nach Datum)
      console.log('[GalleryStore] User filter active, loading without GPS coordinates');
      mergedParams.lat = 0;
      mergedParams.lon = 0;
    } else {
      console.log('[GalleryStore] No GPS coordinates available and no filters set, waiting for GPS...');
      isGalleryLoading.set(false);
      return; // Beende ohne zu laden
    }
  }
  
  galleryParams.set(mergedParams);

  // Normale Limits für alle Filter
  const effectiveLimit = limit; // Normale Limits für alle Filter

  // NEU: Gallery-Items-Normal API verwenden
  let url;
  if (mergedParams.search) {
    // Suche: Verwende gallery-items-search API
    url = new URL('/api/gallery-items-search', window.location.origin);
    url.searchParams.set('page', String(Math.floor(offset / effectiveLimit)));
    url.searchParams.set('search', mergedParams.search);
    if (mergedParams.lat && mergedParams.lon) {
      url.searchParams.set('lat', String(mergedParams.lat));
      url.searchParams.set('lon', String(mergedParams.lon));
    }
    // NEU: User-Filter Parameter hinzufügen (auch für Suche!)
    if (mergedParams.user_id) {
      url.searchParams.set('user_id', String(mergedParams.user_id));
    }
    // NEU: LocationFilter-Parameter hinzufügen
    if (mergedParams.locationFilterLat && mergedParams.locationFilterLon) {
      url.searchParams.set('locationFilterLat', String(mergedParams.locationFilterLat));
      url.searchParams.set('locationFilterLon', String(mergedParams.locationFilterLon));
    }
  } else {
    // Normale Galerie: Verwende gallery-items-normal API
    url = new URL('/api/gallery-items-normal', window.location.origin);
    url.searchParams.set('page', String(Math.floor(offset / effectiveLimit)));
    // WICHTIG: Immer lat/lon setzen, auch wenn 0 (für Fallback ohne GPS)
    url.searchParams.set('lat', String(mergedParams.lat || 0));
    url.searchParams.set('lon', String(mergedParams.lon || 0));
    // NEU: User-Filter Parameter hinzufügen
    if (mergedParams.user_id) {
      url.searchParams.set('user_id', String(mergedParams.user_id));
    }
    // NEU: LocationFilter-Parameter hinzufügen
    if (mergedParams.locationFilterLat && mergedParams.locationFilterLon) {
      url.searchParams.set('locationFilterLat', String(mergedParams.locationFilterLat));
      url.searchParams.set('locationFilterLon', String(mergedParams.locationFilterLon));
    }
  }
  // radius, fromItem, offset, limit werden NICHT mehr benötigt

  console.log('[GalleryStore] API-Request:', {
    params: mergedParams,
    url: url.toString(),
    hasGPS: !!(mergedParams.lat && mergedParams.lon),
    effectiveLimit,
    isLocationFilter: !!mergedParams.fromItem,
    originalLimit: limit,
    offset,
    currentItemsCount: get(galleryItems).length,
    hasUserFilter: !!mergedParams.user_id
  });

  try {
  const res = await fetch(url.toString());
  if (thisRequestId !== currentRequestId) {
    console.log('[GalleryStore] Ignoriere veraltete Response für RequestId', thisRequestId);
    return;
  }

  const data = await res.json();
  // NEU: Items aus data.items lesen (für gallery endpoint) oder data.images (für items endpoint)
  const items = data.items || data.images || [];
    console.log('[GalleryStore] API Response:', {
      status: data.status,
      imageCount: data.images?.length || 0,
      totalCount: data.totalCount,
      loadedCount: data.loadedCount,
      gpsMode: data.gpsMode,
      apiVersion: data.apiVersion,
      debug: data.debug
    });

  if (items && items.length) {
    let mapped = items
      .filter((item: any) => item.path_512)
      .map((item: any) => ({
        src: `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${item.path_512}`,
        width: item.width,
        height: item.height,
        id: item.id,
        slug: item.slug,
        lat: item.lat,
        lon: item.lon,
        title: item.title,
        distance: item.distance,
        description: item.description,
        profile_id: item.profile_id,
        isSourceItem: item.isSourceItem,
        path_64: item.path_64,
        path_512: item.path_512,
        path_2048: item.path_2048
      }));

    // Nur beim ersten Laden (offset === 0) das Source-Objekt zulassen
    if (offset > 0) {
      mapped = mapped.filter(item => !item.isSourceItem);
    }

    // DEBUG: Log first few items to check order
    console.log('[Frontend] First 5 mapped galleryItems:', mapped.slice(0, 5).map(item => ({id: item.id, isSourceItem: item.isSourceItem, distance: item.distance})));

    // DEBUG: Log first few items to check distances
    console.log('[GalleryStore] First 3 mapped items:', mapped.slice(0, 3).map(item => ({
      id: item.id,
      distance: item.distance,
      title: item.title
    })));

    console.log('[GalleryStore] Mapped images:', mapped.length);

    if (offset === 0) {
      galleryItems.set(mapped);
    } else {
        // Progressives Hinzufügen für flüssigere UX
      galleryItems.update(items => [...items, ...mapped]);
    }
    
                    // Normale Paginierung für alle Filter (auch Location Filter)
                offset += mapped.length;
                hasMoreGalleryItems.set(offset < (data.totalCount || 0));
    
    // FALLBACK: Falls totalCount nicht gesetzt ist, verwende die Anzahl der geladenen Items
    const effectiveTotalCount = data.totalCount || mapped.length;
    galleryTotalCount.set(effectiveTotalCount);
    
    // FALLBACK: Falls loadedCount nicht gesetzt ist, verwende die Anzahl der gemappten Items
    const effectiveLoadedCount = data.loadedCount || mapped.length;
    
    console.log('[GalleryStore] Final store update:', {
      effectiveTotalCount,
      effectiveLoadedCount,
      mappedLength: mapped.length,
      currentStoreItems: get(galleryItems).length,
      hasMore: get(hasMoreGalleryItems)
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

export function resetGallery(params: { search?: string; lat?: number; lon?: number; radius?: number; user_id?: string } = {}) {
  // Prüfe ob sich die Parameter wirklich geändert haben
  const currentParams = get(galleryParams);
  const newParams = { 
    search: params.search || '', 
    lat: params.lat || null, 
    lon: params.lon || null, 
    radius: params.radius || null,
    user_id: params.user_id || null
  };
  
  // Nur zurücksetzen wenn sich Parameter geändert haben
  const hasChanged = currentParams.search !== newParams.search ||
                    currentParams.lat !== newParams.lat ||
                    currentParams.lon !== newParams.lon ||
                    currentParams.radius !== newParams.radius ||
                    currentParams.user_id !== newParams.user_id;
  
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
  
  // Load gallery without triggering reactive updates
  loadMoreGallery(params);
} 