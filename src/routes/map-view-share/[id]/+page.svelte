<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  
  export let data: any;
  
  onMount(() => {
    // Redirect to actual map view with parameters
    if (data.ogUrl && data.ogUrl.includes('map-view-share')) {
      // Extract the actual map URL from the share data
      const actualMapUrl = data.ogUrl.replace('/map-view-share/', '/map-view?');
      window.location.href = actualMapUrl;
    }
  });
</script>

<svelte:head>
  <!-- OpenGraph Meta Tags -->
  <meta property="og:title" content={data.ogTitle || 'CULOCA - Map View Share'} />
  <meta property="og:description" content={data.ogDescription || 'Map View Snippet - CULOCA.com'} />
  <meta property="og:type" content="website" />
  <meta property="og:url" content={data.ogUrl || 'https://culoca.com/map-view-share'} />
  
  {#if data.ogImage}
    <meta property="og:image" content={data.ogImage} />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:type" content="image/jpeg" />
  {/if}
  
  <!-- Twitter Card Meta Tags -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={data.ogTitle || 'CULOCA - Map View Share'} />
  <meta name="twitter:description" content={data.ogDescription || 'Map View Snippet - CULOCA.com'} />
  {#if data.ogImage}
    <meta name="twitter:image" content={data.ogImage} />
  {/if}
  
  <!-- Additional Meta Tags -->
  <meta name="description" content={data.ogDescription || 'Map View Snippet - CULOCA.com'} />
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="loading">
  <p>Weiterleitung zur Kartenansicht...</p>
</div>

<style>
  .loading {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    font-family: Arial, sans-serif;
    color: #666;
  }
</style> 