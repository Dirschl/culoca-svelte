<script lang="ts">
  import GalleryLayout from '../GalleryLayout.svelte';
  
  export let nearby: any[] = [];
  export let layout: 'justified' | 'grid' = 'justified';
  export let gap: number = 2;
  export let userLat: number | null = null;
  export let userLon: number | null = null;
  export let getDistanceFromLatLonInMeters: ((lat1: number, lon1: number, lat2: number, lon2: number) => string) | null = null;
  export let isCreator: boolean = false;
  export let onGalleryToggle: ((itemId: string, newGalleryValue: boolean) => void) | null = null;
  export let getGalleryStatus: ((itemId: string) => boolean) | null = null;
</script>

{#if nearby.length > 0}
  <GalleryLayout
    items={nearby}
    {layout}
    {gap}
    showDistance={true}
    {userLat}
    {userLon}
    {getDistanceFromLatLonInMeters}
    showGalleryToggle={isCreator}
    onGalleryToggle={onGalleryToggle}
    getGalleryStatus={getGalleryStatus}
  />
{:else}
  <div class="no-nearby">Keine Items in der Nähe gefunden. Vergrößere den Radius oder es gibt keine anderen Items mit GPS-Koordinaten in der Nähe.</div>
{/if}

<style>
.no-nearby {
  text-align: center;
  color: var(--text-secondary);
  font-style: italic;
  padding: 2rem;
  background: var(--bg-secondary);
  border-radius: 8px;
  margin: 1rem 0;
}
</style> 