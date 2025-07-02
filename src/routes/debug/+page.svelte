<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { onMount } from 'svelte';

  let imagesWithGPS: any[] = [];
  let imagesWithoutGPS: any[] = [];
  let loading = true;

  onMount(async () => {
    try {
      // Get images with GPS data
      const { data: withGPS, error: error1 } = await supabase
        .from('images')
        .select('id, title, lat, lon')
        .not('lat', 'is', null)
        .not('lon', 'is', null)
        .limit(10);

      if (error1) {
        console.error('Error fetching images with GPS:', error1);
      } else {
        imagesWithGPS = withGPS || [];
      }

      // Get images without GPS data
      const { data: withoutGPS, error: error2 } = await supabase
        .from('images')
        .select('id, title, lat, lon')
        .or('lat.is.null,lon.is.null')
        .limit(10);

      if (error2) {
        console.error('Error fetching images without GPS:', error2);
      } else {
        imagesWithoutGPS = withoutGPS || [];
      }

      console.log('Images with GPS:', imagesWithGPS);
      console.log('Images without GPS:', imagesWithoutGPS);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head>
  <title>Debug - GPS Data</title>
</svelte:head>

<div class="debug-container">
  <h1>GPS Data Debug</h1>
  
  {#if loading}
    <p>Loading...</p>
  {:else}
    <div class="debug-section">
      <h2>Images with GPS Data ({imagesWithGPS.length})</h2>
      {#each imagesWithGPS as image}
        <div class="image-item">
          <strong>{image.title || 'No title'}</strong>
          <br>
          ID: {image.id}
          <br>
          GPS: {image.lat}, {image.lon}
        </div>
      {/each}
    </div>

    <div class="debug-section">
      <h2>Images without GPS Data ({imagesWithoutGPS.length})</h2>
      {#each imagesWithoutGPS as image}
        <div class="image-item">
          <strong>{image.title || 'No title'}</strong>
          <br>
          ID: {image.id}
          <br>
          GPS: {image.lat}, {image.lon}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .debug-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    font-family: Arial, sans-serif;
  }

  .debug-section {
    margin-bottom: 2rem;
    padding: 1rem;
    border: 1px solid #ccc;
    border-radius: 8px;
  }

  .image-item {
    margin-bottom: 1rem;
    padding: 0.5rem;
    background: #f5f5f5;
    border-radius: 4px;
  }
</style> 