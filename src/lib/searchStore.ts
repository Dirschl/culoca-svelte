import { writable } from 'svelte/store';
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
  
  // Kurzes Debounce für getippte Suchen
  const delay = trigger ? 300 : 100;
  
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    try {
      console.log('🔍 SearchStore: Starting search for:', q);
      
      // Verwende galleryStore für die Suche
      resetGallery({ search: q });
      
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
} 