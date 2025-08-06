import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  // This is a client-side only page, so we just return empty data
  // The actual logic is handled in the +page.svelte file
  return {
    // Empty data - all logic is client-side
  };
}; 