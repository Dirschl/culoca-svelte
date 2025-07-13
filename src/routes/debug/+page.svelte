<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { onMount } from 'svelte';
  import { authFetch } from '$lib/authFetch';

  let imagesWithGPS: any[] = [];
  let imagesWithoutGPS: any[] = [];
  let allImages: any[] = [];
  let loading = true;
  let cleanupLoading = false;
  let cleanupResults: any[] = [];
  let debugInfo: any = {};

  onMount(async () => {
    try {
      console.log('🔍 Starting debug page data load...');
      
      // First, let's get ALL images to see what's in the database
      const { data: allData, error: allError } = await supabase
        .from('items')
        .select('*');

      if (allError) {
        console.error('Error fetching all images:', allError);
        debugInfo.allImagesError = allError;
      } else {
        allImages = allData || [];
        debugInfo.totalImages = allImages.length;
        console.log('🔍 Total images in database:', allImages.length);
        console.log('🔍 Sample image:', allImages[0]);
      }

      // Get images with GPS data
      const { data: withGPS, error: error1 } = await supabase
        .from('items')
        .select('id, title, lat, lon, created_at, original_name, user_id, profile_id')
        .not('lat', 'is', null)
        .not('lon', 'is', null)
        .order('created_at', { ascending: false });

      if (error1) {
        console.error('Error fetching images with GPS:', error1);
        debugInfo.gpsError = error1;
      } else {
        imagesWithGPS = withGPS || [];
        debugInfo.imagesWithGPS = imagesWithGPS.length;
        console.log('🔍 Images with GPS:', imagesWithGPS.length);
        console.log('🔍 Sample GPS image:', imagesWithGPS[0]);
      }

      // Get images without GPS data
      const { data: withoutGPS, error: error2 } = await supabase
        .from('items')
        .select('id, title, lat, lon, created_at, original_name, user_id, profile_id')
        .or('lat.is.null,lon.is.null')
        .order('created_at', { ascending: false });

      if (error2) {
        console.error('Error fetching images without GPS:', error2);
        debugInfo.noGpsError = error2;
      } else {
        imagesWithoutGPS = withoutGPS || [];
        debugInfo.imagesWithoutGPS = imagesWithoutGPS.length;
        console.log('🔍 Images without GPS:', imagesWithoutGPS.length);
      }

      // Check authentication status
      const { data: { user } } = await supabase.auth.getUser();
      debugInfo.user = user ? { id: user.id, email: user.email } : null;
      console.log('🔍 User authentication:', debugInfo.user);

      console.log('🔍 Debug info:', debugInfo);
      console.log('🔍 Images with GPS:', imagesWithGPS);
      console.log('🔍 Images without GPS:', imagesWithoutGPS);
    } catch (error) {
      console.error('Error:', error);
      debugInfo.generalError = error;
    } finally {
      loading = false;
    }
  });

  async function cleanupFailedUploads() {
    cleanupLoading = true;
    cleanupResults = [];
    
    try {
      const response = await authFetch('/api/cleanup-failed-uploads');
      
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
      console.log('🔄 Reloading data...');
      
      // Get images with GPS data
      const { data: withGPS, error: error1 } = await supabase
        .from('items')
        .select('id, title, lat, lon, created_at, original_name, user_id, profile_id')
        .not('lat', 'is', null)
        .not('lon', 'is', null)
        .order('created_at', { ascending: false });

      if (error1) {
        console.error('Error fetching images with GPS:', error1);
      } else {
        imagesWithGPS = withGPS || [];
        console.log('✅ Loaded', imagesWithGPS.length, 'images with GPS');
      }

      // Get images without GPS data
      const { data: withoutGPS, error: error2 } = await supabase
        .from('items')
        .select('id, title, lat, lon, created_at, original_name, user_id, profile_id')
        .or('lat.is.null,lon.is.null')
        .order('created_at', { ascending: false });

      if (error2) {
        console.error('Error fetching images without GPS:', error2);
      } else {
        imagesWithoutGPS = withoutGPS || [];
        console.log('✅ Loaded', imagesWithoutGPS.length, 'images without GPS');
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
    
    <!-- Debug Information Section -->
    <div class="debug-section">
      <h2>Debug Information</h2>
      <div class="debug-info">
        <p><strong>Total images in database:</strong> {debugInfo.totalImages || 'Loading...'}</p>
        <p><strong>Images with GPS:</strong> {debugInfo.imagesWithGPS || 'Loading...'}</p>
        <p><strong>Images without GPS:</strong> {debugInfo.imagesWithoutGPS || 'Loading...'}</p>
        <p><strong>User:</strong> {debugInfo.user ? `${debugInfo.user.email} (${debugInfo.user.id})` : 'Not authenticated'}</p>
        {#if debugInfo.allImagesError}
          <p><strong>Error fetching all images:</strong> {debugInfo.allImagesError.message}</p>
        {/if}
        {#if debugInfo.gpsError}
          <p><strong>Error fetching GPS images:</strong> {debugInfo.gpsError.message}</p>
        {/if}
        {#if debugInfo.noGpsError}
          <p><strong>Error fetching non-GPS images:</strong> {debugInfo.noGpsError.message}</p>
        {/if}
      </div>
      <button on:click={loadData} class="refresh-button">
        🔄 Refresh Data
      </button>
    </div>
  
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
          <strong>{image.title || image.original_name || 'No title'}</strong>
          <br>
          ID: {image.id}
          <br>
          GPS: {image.lat}, {image.lon}
          <br>
          Created: {image.created_at ? new Date(image.created_at).toLocaleDateString() : 'Unknown'}
          <br>
          User: {image.user_id}
          <br>
          Profile: {image.profile_id}
        </div>
      {/each}
    </div>

    <div class="debug-section">
      <h2>Images without GPS Data ({imagesWithoutGPS.length})</h2>
      {#each imagesWithoutGPS as image}
        <div class="image-item">
          <strong>{image.title || image.original_name || 'No title'}</strong>
          <br>
          ID: {image.id}
          <br>
          GPS: {image.lat}, {image.lon}
          <br>
          Created: {image.created_at ? new Date(image.created_at).toLocaleDateString() : 'Unknown'}
          <br>
          User: {image.user_id}
          <br>
          Profile: {image.profile_id}
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

  .debug-info {
    background: #f8f9fa;
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
  }

  .debug-info p {
    margin: 0.5rem 0;
  }

  .refresh-button {
    background: #007bff;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    margin-top: 1rem;
  }

  .refresh-button:hover {
    background: #0056b3;
  }
</style> 