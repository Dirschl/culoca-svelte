<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { filterStore } from '$lib/filterStore';
  import FullscreenMap from '$lib/FullscreenMap.svelte';
  
  export let data;
  
  let mapInitialized = false;
  
  onMount(() => {
    // Apply map parameters from URL
    const { mapParams } = data;
    
    if (mapParams.lat && mapParams.lon) {
      // Set location filter
      filterStore.setLocationFilter({
        lat: mapParams.lat,
        lon: mapParams.lon,
        fromItem: false
      });
    }
    
    if (mapParams.user) {
      // Set user filter
      filterStore.setUserFilter(mapParams.user);
    }
    
    mapInitialized = true;
  });
  
  function handleMapReady() {
    // Map is ready, can apply additional parameters
    const { mapParams } = data;
    
    // Apply map type if different from default
    if (mapParams.mapType === 'hybrid') {
      // Toggle to hybrid view
      // This would need to be implemented in FullscreenMap
    }
  }
  
  function handleMapClose() {
    // Navigate back to the main page
    goto('/');
  }
</script>

<svelte:head>
  <title>CULOCA - Map View</title>
  <meta name="description" content="Interaktive Kartenansicht mit GPS-basierten Fotos" />
</svelte:head>

<div class="map-view-container">
  {#if mapInitialized}
    <FullscreenMap 
      images={[]}
      userLat={data.mapParams.lat}
      userLon={data.mapParams.lon}
      deviceHeading={null}
      isManual3x3Mode={false}
      on:mapReady={handleMapReady}
      on:close={handleMapClose}
      on:imageClick={(event) => {
        const imageSlug = event.detail.imageSlug || event.detail.slug || event.detail.imageId;
        window.location.href = `/item/${imageSlug}`;
      }}
      on:locationSelected={(event) => {
        // Navigate back to main page with location
        const { lat, lon } = event.detail;
        window.location.href = `/?lat=${lat}&lon=${lon}`;
      }}
    />
  {/if}
</div>

<style>
  .map-view-container {
    width: 100%;
    height: 100vh;
  }
</style> 