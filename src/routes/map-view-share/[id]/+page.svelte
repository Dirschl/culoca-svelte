<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  
  export let data;
  
  onMount(() => {
    // Redirect to actual map view with parameters
    if (data.shareData?.params) {
      goto(`/map-view?${data.shareData.params}`);
    } else {
      goto('/map-view');
    }
  });
</script>

<svelte:head>
  <title>{data.ogTitle}</title>
  <meta name="description" content={data.ogDescription} />
  
  <!-- OpenGraph Meta Tags -->
  <meta property="og:title" content={data.ogTitle} />
  <meta property="og:description" content={data.ogDescription} />
  <meta property="og:image" content={data.ogImage} />
  <meta property="og:url" content={data.ogUrl} />
  <meta property="og:type" content="website" />
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={data.ogTitle} />
  <meta name="twitter:description" content={data.ogDescription} />
  <meta name="twitter:image" content={data.ogImage} />
</svelte:head>

<div class="loading">
  <h1>CULOCA - Map View</h1>
  <p>Weiterleitung zur Kartenansicht...</p>
</div>

<style>
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    text-align: center;
  }
  
  .loading h1 {
    color: var(--text-primary);
    margin-bottom: 1rem;
  }
  
  .loading p {
    color: var(--text-secondary);
  }
</style> 