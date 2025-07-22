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
      // Hier müsste die eigentliche API-Logik stehen
      // Dummy: Liefere ein leeres Array zurück
      searchResults.set([]);
      isSearching.set(false);
    }, 300);
  }
}

export function clearSearch() {
  searchQuery.set('');
  searchResults.set([]);
  isSearching.set(false);
  useSearchResults.set(false);
} 