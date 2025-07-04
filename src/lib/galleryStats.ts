import { writable } from 'svelte/store';

export interface GalleryStats {
  loadedCount: number;
  totalCount: number;
  lastUpdate: Date;
}

// Initialize gallery stats
const getInitialStats = (): GalleryStats => ({
  loadedCount: 0,
  totalCount: 0,
  lastUpdate: new Date()
});

export const galleryStats = writable<GalleryStats>(getInitialStats());

// Function to update gallery stats
export function updateGalleryStats(loadedCount: number, totalCount: number) {
  galleryStats.update(stats => ({
    ...stats,
    loadedCount,
    totalCount,
    lastUpdate: new Date()
  }));
} 