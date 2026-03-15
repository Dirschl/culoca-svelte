<script lang="ts">
  import GalleryLayout from '../GalleryLayout.svelte';
  
  export let nearby: any[] = [];
  export let layout: 'justified' | 'grid' = 'justified';
  export let gap: number = 2;
  export let showImageCaptions: boolean = true;
  export let userLat: number | null = null;
  export let userLon: number | null = null;
  export let getDistanceFromLatLonInMeters: ((lat1: number, lon1: number, lat2: number, lon2: number) => string) | null = null;
  export let isCreator: boolean = false;
  export let onGalleryToggle: ((itemId: string, newGalleryValue: boolean) => void) | null = null;
  export let getGalleryStatus: ((itemId: string) => boolean) | null = null;
  export let forceReload: boolean = true; // Force window.location.href for detail page navigation
  export let fallbackRecommendations: Array<{ title: string; href: string; description?: string | null }> = [];
</script>

{#if nearby.length > 0}
  <GalleryLayout
    items={nearby}
    {layout}
    {gap}
    showDistance={true}
    {showImageCaptions}
    {userLat}
    {userLon}
    {getDistanceFromLatLonInMeters}
    showGalleryToggle={isCreator}
    onGalleryToggle={onGalleryToggle}
    getGalleryStatus={getGalleryStatus}
    {forceReload}
  />
{:else}
  <div class="no-nearby">
    {#if fallbackRecommendations.length > 0}
      <p>In direkter Nähe gibt es aktuell keine weiteren Items. Diese internen Empfehlungen passen trotzdem thematisch zu dieser Seite:</p>
      <ul class="fallback-list">
        {#each fallbackRecommendations as recommendation}
          <li>
            <a href={recommendation.href}>{recommendation.title}</a>
            {#if recommendation.description}
              <span>{recommendation.description}</span>
            {/if}
          </li>
        {/each}
      </ul>
    {:else}
      Keine Items in der Nähe gefunden. Vergrößere den Radius oder erkunde die thematisch verwandten Links auf dieser Seite.
    {/if}
  </div>
{/if}

<style>
.no-nearby {
  text-align: center;
  color: var(--text-secondary);
  padding: 2rem;
  background: var(--bg-secondary);
  border-radius: 8px;
  margin: 1rem 0;
}
.fallback-list {
  list-style: none;
  padding: 0;
  margin: 1rem 0 0;
  display: grid;
  gap: 0.75rem;
}
.fallback-list li span {
  display: block;
  margin-top: 0.2rem;
  font-size: 0.95rem;
}
</style> 
