import { writable } from 'svelte/store';

export const searchQuery = writable('');
export const searchResults = writable([]);
export const isSearching = writable(false);
export const useSearchResults = writable(false);

let searchTimeout: ReturnType<typeof setTimeout> | null = null;

export function setSearchQuery(q: string) {
  searchQuery.set(q);
  useSearchResults.set(!!q.trim());
}

export async function performSearch(q: string, trigger = true) {
  if (searchTimeout) clearTimeout(searchTimeout);
  isSearching.set(true);
  searchQuery.set(q);
  useSearchResults.set(!!q.trim());
  if (!q.trim()) {
    searchResults.set([]);
    isSearching.set(false);
    return;
  }
  // Debounce
  if (trigger) {
    searchTimeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/items?s=${encodeURIComponent(q)}`);
        const data = await res.json();
        searchResults.set(data.images || []);
      } catch (e) {
        searchResults.set([]);
      }
      isSearching.set(false);
    }, 300);
  }
}

export async function loadGallery(params: { offset?: number; limit?: number; lat?: number; lon?: number; radius?: number; search?: string }) {
  // Zentrale Loader-Funktion für Galerie und Suche
  const url = new URL('/api/items', window.location.origin);
  if (params.offset) url.searchParams.set('offset', String(params.offset));
  if (params.limit) url.searchParams.set('limit', String(params.limit));
  if (params.lat) url.searchParams.set('lat', String(params.lat));
  if (params.lon) url.searchParams.set('lon', String(params.lon));
  if (params.radius) url.searchParams.set('radius', String(params.radius));
  if (params.search) url.searchParams.set('s', params.search);
  const res = await fetch(url.toString());
  const data = await res.json();
  return data;
}

export function clearSearch() {
  searchQuery.set('');
  searchResults.set([]);
  isSearching.set(false);
  useSearchResults.set(false);
} 