<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { filterStore, getEffectiveGpsPosition } from '$lib/filterStore';

  let gpsStatus = 'Not tested';
  let effectiveGps = null;
  let filterStoreState = null;

  async function testGps() {
    if (!browser) return;
    
    gpsStatus = 'Testing...';
    
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        });
      });
      
      const { lat, lon } = position.coords;
      gpsStatus = `GPS obtained: ${lat}, ${lon}`;
      
      // Update filterStore
      filterStore.updateGpsStatus(true, { lat, lon });
      
      // Check effective GPS
      effectiveGps = getEffectiveGpsPosition();
      filterStoreState = $filterStore;
      
    } catch (error) {
      gpsStatus = `GPS error: ${error}`;
    }
  }

  onMount(() => {
    if (browser) {
      effectiveGps = getEffectiveGpsPosition();
      filterStoreState = $filterStore;
    }
  });
</script>

<div class="debug-container">
  <h1>GPS Debug Page</h1>
  
  <button on:click={testGps}>Test GPS</button>
  
  <h2>Status</h2>
  <p>GPS Status: {gpsStatus}</p>
  
  <h2>Effective GPS Position</h2>
  <pre>{JSON.stringify(effectiveGps, null, 2)}</pre>
  
  <h2>FilterStore State</h2>
  <pre>{JSON.stringify(filterStoreState, null, 2)}</pre>
  
  <h2>LocalStorage</h2>
  <pre>{browser ? localStorage.getItem('culoca-filters') : 'Not available'}</pre>
</div>

<style>
  .debug-container {
    padding: 20px;
    max-width: 800px;
    margin: 0 auto;
  }
  
  pre {
    background: #f5f5f5;
    padding: 10px;
    border-radius: 4px;
    overflow-x: auto;
  }
  
  button {
    padding: 10px 20px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  button:hover {
    background: #0056b3;
  }
</style> 