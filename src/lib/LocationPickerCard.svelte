<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';

  export let initialLat: number | null = null;
  export let initialLon: number | null = null;
  export let initialLabel = '';
  export let submitLabel = 'Standort übernehmen';
  export let liveUpdate = false;
  export let showSelectionFooter = true;
  export let showSaveButton = true;
  export let showSearchTools = true;

  const dispatch = createEventDispatcher<{
    save: { lat: number; lon: number; label: string | null };
  }>();

  let mapContainer: HTMLDivElement | null = null;
  let map: any = null;
  let leaflet: any = null;
  let markerLayer: any = null;
  let standardLayer: any = null;
  let hybridLayer: any = null;
  let mapType: 'standard' | 'hybrid' = 'standard';

  let selectedLat: number | null = initialLat;
  let selectedLon: number | null = initialLon;
  let selectedLabel = initialLabel;
  let searchQuery = initialLabel;
  let searchResults: Array<{ place_id: string; display_name: string; lat: string; lon: string }> = [];
  let searchLoading = false;
  let searchError = '';
  let locating = false;
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  const DEFAULT_LAT = 48.137154;
  const DEFAULT_LON = 11.576124;

  function getInitialCenter(): [number, number] {
    return [selectedLat ?? DEFAULT_LAT, selectedLon ?? DEFAULT_LON];
  }

  async function ensureLeafletCss() {
    if (document.querySelector('link[data-culoca-leaflet="true"]')) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.dataset.culocaLeaflet = 'true';
    document.head.appendChild(link);
  }

  async function initMap() {
    if (!mapContainer || map) return;

    await ensureLeafletCss();
    leaflet = await import('leaflet');

    const [lat, lon] = getInitialCenter();
    map = leaflet.map(mapContainer, {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView([lat, lon], selectedLat !== null && selectedLon !== null ? 14 : 6);

    standardLayer = leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    });
    hybridLayer = leaflet.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri'
    });

    loadSavedMapType();
    applyMapType();

    markerLayer = leaflet.marker([lat, lon], { draggable: true }).addTo(map);
    markerLayer.on('dragend', () => {
      const { lat: markerLat, lng: markerLon } = markerLayer.getLatLng();
      updateSelection(markerLat, markerLon);
    });

    map.on('click', (event: any) => {
      updateSelection(event.latlng.lat, event.latlng.lng);
    });
  }

  function loadSavedMapType() {
    if (typeof localStorage === 'undefined') return;
    const stored = localStorage.getItem('culoca_mapType');
    if (stored === 'standard' || stored === 'hybrid') {
      mapType = stored;
    }
  }

  function applyMapType() {
    if (!map || !standardLayer || !hybridLayer) return;

    map.removeLayer(standardLayer);
    map.removeLayer(hybridLayer);
    (mapType === 'hybrid' ? hybridLayer : standardLayer).addTo(map);
  }

  function updateSelection(lat: number, lon: number, label: string | null = null) {
    selectedLat = lat;
    selectedLon = lon;

    if (markerLayer) {
      markerLayer.setLatLng([lat, lon]);
    }

    if (map) {
      map.setView([lat, lon], Math.max(map.getZoom(), 14), { animate: true });
    }

    if (label !== null) {
      selectedLabel = label;
      searchQuery = label;
    }

    if (liveUpdate) {
      dispatch('save', {
        lat,
        lon,
        label: selectedLabel?.trim() || searchQuery.trim() || null
      });
    }
  }

  function toggleMapType() {
    mapType = mapType === 'standard' ? 'hybrid' : 'standard';
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('culoca_mapType', mapType);
    }
    applyMapType();
  }

  async function useCurrentLocation() {
    if (!navigator.geolocation) {
      searchError = 'Standortzugriff wird in diesem Browser nicht unterstützt.';
      return;
    }

    locating = true;
    searchError = '';

    navigator.geolocation.getCurrentPosition(
      (position) => {
        locating = false;
        updateSelection(position.coords.latitude, position.coords.longitude, 'Aktueller Standort');
      },
      (error) => {
        locating = false;
        searchError =
          error.code === error.PERMISSION_DENIED
            ? 'Standortzugriff wurde im Browser blockiert.'
            : 'Standort konnte gerade nicht ermittelt werden.';
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  async function searchPlaces(query: string) {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      searchResults = [];
      searchError = '';
      searchLoading = false;
      return;
    }

    searchLoading = true;
    searchError = '';

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(trimmed)}`,
        { headers: { Accept: 'application/json', 'Accept-Language': 'de' } }
      );

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const results = await response.json();
      searchResults = Array.isArray(results) ? results : [];
      if (searchResults.length === 0) {
        searchError = 'Kein passender Ort gefunden.';
      }
    } catch (error) {
      console.error('[LocationPickerCard] search failed', error);
      searchResults = [];
      searchError = 'Ortssuche ist gerade nicht verfügbar.';
    } finally {
      searchLoading = false;
    }
  }

  function handleSearchInput() {
    searchError = '';
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => searchPlaces(searchQuery), 300);
  }

  function selectSearchResult(result: { display_name: string; lat: string; lon: string }) {
    const lat = Number(result.lat);
    const lon = Number(result.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return;

    searchResults = [];
    updateSelection(lat, lon, result.display_name);
  }

  function saveSelection() {
    if (selectedLat === null || selectedLon === null) {
      searchError = 'Bitte wähle zuerst einen Standort auf der Karte aus.';
      return;
    }

    dispatch('save', {
      lat: selectedLat,
      lon: selectedLon,
      label: selectedLabel?.trim() || searchQuery.trim() || null
    });
  }

  onMount(() => {
    initMap();
  });

  onDestroy(() => {
    if (searchTimeout) clearTimeout(searchTimeout);
    if (map) {
      map.remove();
      map = null;
    }
  });

  $: if (map && initialLat !== null && initialLon !== null) {
    updateSelection(initialLat, initialLon, initialLabel || null);
  }
</script>

<div class="picker-card surface-responsive surface-responsive--panel">
  <div class="picker-head">
    <div>
      <h2>Karte und manuelle Festlegung</h2>
      <p>Suche einen Ort, bewege die Karte oder nutze deine aktuelle Position.</p>
    </div>
    <button type="button" class="map-type-btn" on:click={toggleMapType}>
      {mapType === 'hybrid' ? 'Karte' : 'Satellit'}
    </button>
  </div>

  {#if showSearchTools}
    <div class="picker-tools">
      <div class="search-block">
        <label for="location-search">Ort suchen</label>
        <input
          id="location-search"
          type="search"
          bind:value={searchQuery}
          on:input={handleSearchInput}
          placeholder="z.B. München, Marienplatz"
        />
        {#if searchLoading}
          <p class="search-state">Suche läuft...</p>
        {/if}
        {#if searchError}
          <p class="search-error">{searchError}</p>
        {/if}
        {#if searchResults.length > 0}
          <div class="search-results">
            {#each searchResults as result (result.place_id)}
              <button type="button" class="search-result" on:click={() => selectSearchResult(result)}>
                {result.display_name}
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <button type="button" class="gps-btn" on:click={useCurrentLocation} disabled={locating}>
        {locating ? 'Standort wird ermittelt...' : 'Aktuellen Standort in die Karte laden'}
      </button>
    </div>
  {/if}

  <div class="map-shell">
    <div bind:this={mapContainer} class="map"></div>
  </div>

  {#if showSelectionFooter}
    <div class="picker-footer">
      <div class="coords">
        {#if selectedLat !== null && selectedLon !== null}
          <strong>Gewählter Standort:</strong> {selectedLat.toFixed(6)}, {selectedLon.toFixed(6)}
        {:else}
          <strong>Noch kein Standort gewählt</strong>
        {/if}
      </div>
      {#if showSaveButton}
        <button type="button" class="save-btn" on:click={saveSelection}>{submitLabel}</button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .picker-card {
    display: grid;
    gap: 1rem;
  }

  .picker-head {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: start;
  }

  .picker-head h2 {
    margin: 0 0 0.35rem;
    font-size: 1.35rem;
    color: var(--text-primary);
  }

  .picker-head p,
  .search-state {
    margin: 0;
    color: var(--text-secondary);
  }

  .map-type-btn,
  .gps-btn,
  .save-btn {
    border: 1px solid transparent;
    border-radius: 14px;
    font: inherit;
    cursor: pointer;
    transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
  }

  .map-type-btn {
    padding: 0.75rem 1rem;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border-color: var(--border-color);
  }

  .picker-tools {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 1rem;
    align-items: start;
  }

  .search-block {
    display: grid;
    gap: 0.45rem;
  }

  .search-block label {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .search-block input {
    min-height: 48px;
    border-radius: 14px;
    padding: 0.85rem 1rem;
  }

  .search-results {
    display: grid;
    gap: 0.5rem;
    max-height: 220px;
    overflow: auto;
  }

  .search-result {
    text-align: left;
    padding: 0.8rem 0.95rem;
    border-radius: 14px;
    border: 1px solid var(--border-color);
    background: color-mix(in srgb, var(--bg-secondary) 92%, transparent);
    color: var(--text-primary);
    cursor: pointer;
  }

  .search-result:hover,
  .map-type-btn:hover,
  .gps-btn:hover,
  .save-btn:hover {
    transform: translateY(-1px);
  }

  .gps-btn {
    min-height: 48px;
    padding: 0.85rem 1rem;
    background: color-mix(in srgb, var(--culoca-orange) 14%, var(--bg-secondary));
    color: var(--text-primary);
    border-color: color-mix(in srgb, var(--culoca-orange) 40%, var(--border-color));
  }

  .gps-btn:disabled {
    cursor: progress;
    opacity: 0.7;
    transform: none;
  }

  .search-error {
    margin: 0;
    color: #c44;
  }

  .map-shell {
    position: relative;
    min-height: 440px;
    border-radius: 24px;
    overflow: hidden;
    border: 1px solid var(--border-color);
    background: color-mix(in srgb, var(--bg-secondary) 88%, transparent);
  }

  .map {
    width: 100%;
    height: 440px;
  }

  .picker-footer {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: center;
  }

  .coords {
    color: var(--text-secondary);
    font-size: 0.95rem;
  }

  .save-btn {
    padding: 0.95rem 1.25rem;
    background: var(--culoca-orange);
    color: white;
    box-shadow: 0 18px 30px rgba(238, 114, 33, 0.24);
  }

  @media (max-width: 768px) {
    .picker-tools,
    .picker-footer,
    .picker-head {
      grid-template-columns: 1fr;
      display: grid;
    }

    .map-shell,
    .map {
      min-height: 320px;
      height: 320px;
      border-radius: 18px;
    }
  }
</style>
