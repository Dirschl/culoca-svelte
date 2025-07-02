<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { onMount } from 'svelte';

  let imagesWithGPS: any[] = [];
  let imagesWithoutGPS: any[] = [];
  let loading = true;
  let cleanupLoading = false;
  let cleanupResults: any[] = [];

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

  async function cleanupFailedUploads() {
    cleanupLoading = true;
    cleanupResults = [];
    
    try {
      const response = await fetch('/api/cleanup-failed-uploads', {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.status === 'success') {
        cleanupResults = result.results;
        // Reload the data to show updated counts
        await loadData();
      } else {
        console.error('Cleanup failed:', result.message);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    } finally {
      cleanupLoading = false;
    }
  }

  async function loadData() {
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
    }
  }
</script>

<svelte:head>
  <title>Debug - GPS Data</title>
</svelte:head>

<div class="debug-container">
  <h1>GPS Data Debug</h1>
  
  <div class="cleanup-section">
    <h2>Cleanup Failed Uploads</h2>
    <p>Delete images without GPS data (failed uploads)</p>
    <button 
      on:click={cleanupFailedUploads} 
      disabled={cleanupLoading}
      class="cleanup-button"
    >
      {cleanupLoading ? 'Cleaning up...' : 'Cleanup Failed Uploads'}
    </button>
    
    {#if cleanupResults.length > 0}
      <div class="cleanup-results">
        <h3>Cleanup Results:</h3>
        {#each cleanupResults as result}
          <div class="result-item">
            <strong>{result.id}</strong>: {result.status}
            {#if result.message}
              - {result.message}
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
  
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

  .cleanup-section {
    margin-bottom: 2rem;
    padding: 1rem;
    border: 1px solid #ff6b6b;
    border-radius: 8px;
    background: #fff5f5;
  }

  .cleanup-button {
    background: #ff6b6b;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
  }

  .cleanup-button:hover:not(:disabled) {
    background: #ff5252;
  }

  .cleanup-button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .cleanup-results {
    margin-top: 1rem;
    padding: 1rem;
    background: #f8f9fa;
    border-radius: 4px;
  }

  .result-item {
    margin-bottom: 0.5rem;
    padding: 0.25rem 0;
  }
</style> 