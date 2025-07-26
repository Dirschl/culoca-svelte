import { writable, get } from 'svelte/store';
import { resetGallery } from './galleryStore';

export const searchQuery = writable('');
export const isSearching = writable(false);
export const useSearchResults = writable(false);

let searchTimeout: ReturnType<typeof setTimeout> | null = null;

export function setSearchQuery(q: string) {
  searchQuery.set(q);
  useSearchResults.set(!!q.trim());
  
  // Sofortige Suche ohne Debounce für bessere UX
  performSearch(q, false);
}

export async function performSearch(q: string, trigger = true) {
  if (searchTimeout) clearTimeout(searchTimeout);
  isSearching.set(true);
  searchQuery.set(q);
  useSearchResults.set(!!q.trim());
  
  if (!q.trim()) {
    // Suche leeren - zurück zur normalen Galerie
    isSearching.set(false);
    useSearchResults.set(false);
    resetGallery();
    return;
  }
  
  // Kurzes Debounce für getippte Suchen - reduziert für bessere Performance
  const delay = trigger ? 150 : 50; // Reduziert von 300ms auf 150ms
  
  if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      try {
      console.log('🔍 SearchStore: Starting search for:', q);
      
      // NEU: GPS-Koordinaten aus dem Hauptspeicher holen
      let searchParams: any = { search: q };
      if (typeof window !== 'undefined') {
        const userLat = (window as any).userLat;
        const userLon = (window as any).userLon;
        if (userLat && userLon) {
          searchParams.lat = userLat;
          searchParams.lon = userLon;
          console.log('🔍 SearchStore: Using GPS coordinates:', userLat, userLon);
        }
      }
      
      // Verwende galleryStore für die Suche - dieser verwendet jetzt die neue API
      resetGallery(searchParams);
      
      // Lade-Status wird vom galleryStore verwaltet
      setTimeout(() => {
        isSearching.set(false);
      }, 100);
      
      } catch (e) {
      console.error('🔍 SearchStore: Search error:', e);
      isSearching.set(false);
    }
  }, delay);
}

export function clearSearch() {
  searchQuery.set('');
  isSearching.set(false);
  useSearchResults.set(false);
  console.log('🔍 SearchStore: Search cleared - flags reset');
  
  // NEU: Zurück zur normalen Galerie mit GPS-Koordinaten
  let resetParams: any = {};
  if (typeof window !== 'undefined') {
    const userLat = (window as any).userLat;
    const userLon = (window as any).userLon;
    if (userLat && userLon) {
      resetParams.lat = userLat;
      resetParams.lon = userLon;
      console.log('🔍 SearchStore: Clearing search with GPS coordinates:', userLat, userLon);
    }
  }
  resetGallery(resetParams);
} 