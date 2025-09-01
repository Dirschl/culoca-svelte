<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  export let visible: boolean = false;
  export let lat: number | null = null;
  export let lon: number | null = null;
  export let image: any = null;
  export let onCancel: () => void;
  export let onSave: (lat: number, lon: number) => void;
  let mapPickerLat: number | null = lat;
  let mapPickerLon: number | null = lon;
  let mapPickerType: 'standard' | 'hybrid' = 'standard';
  let mapPickerMap: any = null;
  let mapPickerContainer: HTMLDivElement | null = null;
  let mapPickerSearch = '';
  let mapPickerSearchResults: any[] = [];
  let isGettingUserLocation = false;

  // Map-Type aus localStorage lesen
  if (typeof window !== 'undefined') {
    const storedType = localStorage.getItem('culoca_mapType');
    if (storedType === 'standard' || storedType === 'hybrid') {
      mapPickerType = storedType;
    }
  }

  function initMapPicker() {
    import('leaflet').then((leaflet) => {
      if (!mapPickerContainer || mapPickerMap) return;
      const initialLat = mapPickerLat ?? 48.1351;
      const initialLon = mapPickerLon ?? 11.5820;
      mapPickerMap = leaflet.default.map(mapPickerContainer, { zoomControl: true }).setView([initialLat, initialLon], 13);
      const standardLayer = leaflet.default.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' });
      const hybridLayer = leaflet.default.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community' });
      if (mapPickerType === 'standard') {
        standardLayer.addTo(mapPickerMap);
        mapPickerMap.currentLayer = standardLayer;
      } else {
        hybridLayer.addTo(mapPickerMap);
        mapPickerMap.currentLayer = hybridLayer;
      }
      mapPickerMap.standardLayer = standardLayer;
      mapPickerMap.hybridLayer = hybridLayer;
      mapPickerMap.on('move', () => {
        const center = mapPickerMap.getCenter();
        mapPickerLat = center.lat;
        mapPickerLon = center.lng;
      });
    });
  }

  function toggleMapPickerType() {
    mapPickerType = mapPickerType === 'standard' ? 'hybrid' : 'standard';
    if (typeof window !== 'undefined') {
      localStorage.setItem('culoca_mapType', mapPickerType);
    }
    if (mapPickerMap && mapPickerMap.standardLayer && mapPickerMap.hybridLayer) {
      const currentLayer = mapPickerMap.currentLayer;
      const newLayer = mapPickerType === 'standard' ? mapPickerMap.standardLayer : mapPickerMap.hybridLayer;
      if (currentLayer) mapPickerMap.removeLayer(currentLayer);
      newLayer.addTo(mapPickerMap);
      mapPickerMap.currentLayer = newLayer;
    }
  }

  function closeMapPicker() {
    if (onCancel) onCancel();
    if (mapPickerMap) {
      mapPickerMap.remove();
      mapPickerMap = null;
    }
  }

  function saveMapPickerCoords() {
    if (mapPickerLat && mapPickerLon && onSave) {
      onSave(mapPickerLat, mapPickerLon);
      if (mapPickerMap) {
        mapPickerMap.remove();
        mapPickerMap = null;
      }
    }
  }

  async function searchLocation() {
    if (!mapPickerSearch.trim()) return;
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(mapPickerSearch)}&limit=5&addressdetails=1`
      );
      if (response.ok) {
        mapPickerSearchResults = await response.json();
      }
    } catch (e) {
      mapPickerSearchResults = [];
    }
  }
  function selectSearchResult(result: any) {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    if (!isNaN(lat) && !isNaN(lon) && mapPickerMap) {
      mapPickerMap.setView([lat, lon], 15);
      mapPickerLat = lat;
      mapPickerLon = lon;
      mapPickerSearchResults = [];
      mapPickerSearch = '';
    }
  }
  function handleSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      searchLocation();
    }
  }

  $: if (visible) {
    setTimeout(() => {
      if (!mapPickerMap && mapPickerContainer) {
        initMapPicker();
      }
    }, 100);
  } else {
    if (mapPickerMap) {
      mapPickerMap.remove();
      mapPickerMap = null;
    }
  }

  onDestroy(() => {
    if (mapPickerMap) {
      mapPickerMap.remove();
      mapPickerMap = null;
    }
  });
</script>

{#if visible}
  <div class="map-modal-fullscreen">
    <div class="map-modal-content-fullscreen">
      <div class="map-modal-header-fullscreen">
        {#if image?.path_64}
          <div class="map-picker-thumbnail">
            <img 
              src={`https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-64/${image.path_64}`} 
              alt={image.title || 'Bild'} 
              title={image.title || image.original_name || 'Bild'}
            />
          </div>
        {/if}
        <input class="map-search-input" type="text" placeholder="Ort suchen..." bind:value={mapPickerSearch} on:keydown={handleSearchKeydown} />
        <button class="map-type-btn" on:click={toggleMapPickerType} title={mapPickerType === 'standard' ? 'Satellit' : 'Standard'}>
          {#if mapPickerType === 'standard'}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
          {:else}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="11" y="3" width="2" height="7" rx="1"/><rect x="11" y="14" width="2" height="7" rx="1"/><rect x="3" y="11" width="7" height="2" rx="1"/><rect x="14" y="11" width="7" height="2" rx="1"/><circle cx="12" cy="12" r="3"/><path d="M7 7l3 3"/><path d="M17 17l-3-3"/></svg>
          {/if}
        </button>
      </div>
      {#if mapPickerSearchResults.length > 0}
        <div class="map-search-results">
          {#each mapPickerSearchResults as result}
            <div class="map-search-result" on:click={() => selectSearchResult(result)}>{result.display_name}</div>
          {/each}
        </div>
      {/if}
      <div class="map-picker-container-fullscreen">
        <div class="map-picker-pin">
          <!-- Culoca O SVG -->
          <svg width="38" height="46" viewBox="0 0 83.86 100.88" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fill="#ee7221" d="M0,41.35c0-5.67,1.1-11.03,3.29-16.07,2.19-5.04,5.19-9.43,8.98-13.17,3.79-3.74,8.25-6.69,13.36-8.86,5.11-2.17,10.54-3.25,16.29-3.25s11.18,1.08,16.29,3.25c5.11,2.17,9.56,5.12,13.36,8.86,3.79,3.74,6.79,8.13,8.98,13.17,2.19,5.04,3.29,10.4,3.29,16.07s-1.1,11.03-3.29,16.07c-2.2,5.04-5.19,9.43-8.98,13.17-3.8,3.74-8.25,6.7-13.36,8.86-5.11,2.17-9.49,21.42-15.25,21.42s-12.23-19.25-17.34-21.42c-5.11-2.17-9.56-5.12-13.36-8.86-3.79-3.74-6.79-8.13-8.98-13.17-2.2-5.04-3.29-10.4-3.29-16.07ZM25.16,41.35c0,2.29.44,4.43,1.32,6.44.88,2.01,2.07,3.76,3.59,5.26,1.52,1.5,3.29,2.68,5.33,3.55,2.04.87,4.21,1.3,6.53,1.3s4.49-.43,6.53-1.3c2.04-.87,3.81-2.05,5.33-3.55,1.52-1.5,2.71-3.25,3.59-5.26.88-2.01,1.32-4.15,1.32-6.44s-.44-4.43-1.32-6.44c-.88-2.01-2.08-3.76-3.59-5.26-1.52-1.5-3.29-2.68-5.33-3.55-2.03-.87-4.21-1.3-6.53-1.3s-4.49.43-6.53,1.3c-2.04.87-3.81,2.05-5.33,3.55-1.52,1.5-2.72,3.25-3.59,5.26-.88,2.01-1.32,4.16-1.32,6.44Z"/>
          </svg>
        </div>
        <div bind:this={mapPickerContainer} class="map-picker-leaflet-fullscreen"></div>
      </div>
      <div class="map-coords-fullscreen">
        {#if isGettingUserLocation}
          <span>Standort wird ermittelt...</span>
        {:else}
          <span>Lat: {mapPickerLat?.toFixed(6)}, Lon: {mapPickerLon?.toFixed(6)}</span>
        {/if}
      </div>
      <div class="map-modal-footer-fullscreen">
        <button class="map-cancel-btn" on:click={closeMapPicker}>Abbrechen</button>
        <button class="map-confirm-btn" on:click={saveMapPickerCoords}>Speichern</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .map-modal-fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0,0,0,0.7);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .map-modal-content-fullscreen {
    background: var(--bg-primary);
    border-radius: 16px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.2);
    padding: 1.5rem;
    width: 90vw;
    height: 80vh;
    max-width: 1100px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    position: relative;
  }
  .map-modal-header-fullscreen {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }
  .map-picker-thumbnail {
    flex-shrink: 0;
    width: 64px;
    height: 64px;
    border-radius: 8px;
    overflow: hidden;
  }
  .map-picker-thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 8px;
  }
  .map-search-input {
    flex: 1;
    padding: 0.4rem 0.7rem;
    border-radius: 6px;
    border: 1px solid var(--border-color);
    font-size: 1rem;
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
  .map-search-results {
    background: #f3f4f6;
    border-radius: 8px;
    margin: 0.5rem 0;
    max-height: 180px;
    overflow-y: auto;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    color: var(--text-primary);
  }
  .map-search-result {
    padding: 0.5rem 1rem;
    cursor: pointer;
    border-bottom: 1px solid #e5e7eb;
    font-size: 1rem;
  }
  .map-search-result:last-child {
    border-bottom: none;
  }
  .map-search-result:hover {
    background: var(--accent-color);
    color: #fff;
  }
  .map-picker-container-fullscreen {
    width: 100%;
    height: 100%;
    border-radius: 12px;
    background: #e5e7eb;
    margin-bottom: 0.5rem;
    position: relative;
  }
  .map-picker-pin {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -100%);
    z-index: 10;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .map-picker-leaflet-fullscreen {
    width: 100%;
    height: 100%;
    border-radius: 12px;
    overflow: hidden;
    z-index: 4;
  }
  .map-coords-fullscreen {
    text-align: center;
    font-size: 1rem;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }
  .map-modal-footer-fullscreen {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 0.5rem;
  }
  .map-cancel-btn, .map-confirm-btn {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 0.4rem 1.2rem;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.2s;
    color: var(--text-primary);
  }
  .map-cancel-btn:hover {
    background: #e5e7eb;
  }
  .map-confirm-btn {
    background: var(--accent-color);
    color: #fff;
    border: 1px solid var(--accent-color);
  }
  .map-confirm-btn:hover {
    background: #ee7221;
    border-color: #ee7221;
  }
  .map-type-btn {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 0.3rem 0.7rem;
    cursor: pointer;
    color: var(--text-primary);
    font-size: 1rem;
    transition: background 0.2s;
    margin-right: 1rem;
  }
  :global(html.dark) .map-modal-content-fullscreen {
    background: #18181b;
  }
  :global(html.dark) .map-search-input {
    background: #23232a;
    color: #fff;
    border: 1px solid #444;
  }
  :global(html.dark) .map-search-results {
    background: #23232a;
    color: #fff;
  }
  :global(html.dark) .map-search-result {
    color: #fff;
    border-bottom: 1px solid #444;
  }
  :global(html.dark) .map-search-result:hover {
    background: var(--accent-color);
    color: #fff;
  }
  :global(html.dark) .map-picker-container-fullscreen {
    background: #23232a;
  }
  :global(html.dark) .map-coords-fullscreen {
    color: #fff;
  }
  :global(html.dark) .map-cancel-btn, :global(html.dark) .map-confirm-btn {
    color: #fff;
    background: #23232a;
    border: 1px solid #444;
  }
  :global(html.dark) .map-cancel-btn:hover {
    background: #333;
  }
  :global(html.dark) .map-confirm-btn {
    background: #ee7221;
    border-color: #ee7221;
    color: #fff;
  }
  .map-picker-pin svg {
    filter: drop-shadow(0 2px 8px rgba(0,0,0,0.25));
  }
  :global(.leaflet-container.leaflet-touch-drag.leaflet-touch-zoom) {
    -ms-touch-action: none;
    touch-action: none;
    z-index: 4;
  }
</style> 