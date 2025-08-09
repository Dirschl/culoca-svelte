<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { goto } from '$app/navigation';
  export let image: any;
  export let isCreator: boolean = false;
  export let nearby: any[] = [];
  let mapType: 'standard' | 'hybrid' = 'standard';
  // Beim Laden: mapType aus localStorage lesen
  if (typeof window !== 'undefined') {
    const storedType = localStorage.getItem('culoca_mapType');
    if (storedType === 'standard' || storedType === 'hybrid') {
      mapType = storedType;
    }
  }

  function toggleMapType() {
    mapType = mapType === 'standard' ? 'hybrid' : 'standard';
    if (typeof window !== 'undefined') {
      localStorage.setItem('culoca_mapType', mapType);
    }
    // Layer-Wechsel, falls Map schon existiert
    if (map && map.standardLayer && map.hybridLayer) {
      const currentLayer = map.currentLayer;
      const newLayer = mapType === 'standard' ? map.standardLayer : map.hybridLayer;
      if (currentLayer) map.removeLayer(currentLayer);
      newLayer.addTo(map);
      map.currentLayer = newLayer;
    } else {
      // Fallback: Map wird beim nächsten Remount korrekt initialisiert
    }
  }
  const dispatch = createEventDispatcher();
  let map;
  let mapEl: HTMLDivElement | null = null;
  // Map Picker State
  let showMapPicker = false;
  let mapPickerLat: number | null = null;
  let mapPickerLon: number | null = null;
  let mapPickerType: 'standard' | 'hybrid' = 'standard';
  let mapPickerMap: any = null;
  let mapPickerContainer: HTMLDivElement | null = null;
  let mapPickerSearch = '';
  let mapPickerSearchResults: any[] = [];
  let isGettingUserLocation = false;
  let currentMarker = null;
  let nearbyMarkers = [];
  let mapKey = 0;
  let lastNearbyCount = 0;
  let lastNearbyKey = '';

  function removeMap() {
    if (map) {
      map.remove();
      map = null;
    }
    // Only set _leaflet_id if container is a valid object
    if (typeof window !== 'undefined' && window.L && window.L.DomUtil) {
      const container = window.L.DomUtil.get('mapid');
      if (container && typeof container === 'object') {
        container._leaflet_id = null;
      }
    }
  }

  function renderMarkers() {
    if (!map || !image?.lat || !image?.lon) return;
    // Entferne alle alten Marker außer den Tile-Layern
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });
    // Aktuelles Bild Marker
    const baseUrl = 'https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public';
    const thumbnailUrl = image.path_64 ? `${baseUrl}/images-64/${image.path_64}` : `${baseUrl}/images-512/${image.path_512}`;
    const currentImageIcon = L.divIcon({
      className: 'custom-marker current-image',
      html: `<img src="${thumbnailUrl}" alt="${image.title || 'Bild'}" style="width: 48px; height: 48px; border-radius: 50%; border: 3px solid #ee7221; box-shadow: 0 2px 8px rgba(0,0,0,0.3); object-fit: cover;" title="Aktuelles Bild">`,
      iconSize: [48, 48],
      iconAnchor: [48, 48],
      popupAnchor: [0, -48]
    });
    currentMarker = map ? L.marker([image.lat, image.lon], { icon: currentImageIcon }).addTo(map) : null;
    if (image.title && currentMarker) {
      currentMarker.bindPopup(`<strong>${image.title}</strong><br><small>Aktuelles Bild</small>`);
    }
    // Nearby Marker
    nearbyMarkers = [];
    if (nearby && nearby.length > 0) {
      nearby.forEach((nearbyItem) => {
        const nearbyThumbnailUrl = nearbyItem.src64 || nearbyItem.src;
        const nearbyIcon = L.divIcon({
          className: 'custom-marker nearby-image',
          html: `<img src="${nearbyThumbnailUrl}" alt="${nearbyItem.title || 'Item'}" rel="nofollow" style="width: 48px; height: 48px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); object-fit: cover; cursor: pointer;">`,
          iconSize: [48, 48],
          iconAnchor: [48, 48],
          popupAnchor: [0, -48]
        });
        const nearbyMarker = map ? L.marker([nearbyItem.lat, nearbyItem.lon], { icon: nearbyIcon }).addTo(map) : null;
        if (nearbyMarker) {
                    nearbyMarker.on('click', (event) => {
            if (nearbyItem.slug) {
              // Leaflet event doesn't have preventDefault/stopPropagation like DOM events
              // Just navigate directly
              const url = new URL(`/item/${nearbyItem.slug}`, window.location.origin);
              window.location.href = url.toString();
            } else {
              alert('Kein Slug für dieses Item vorhanden!');
            }
          });
          const popupContent = `
            <div style="text-align: center; min-width: 200px;">
              <strong>${nearbyItem.title || 'Item'}</strong><br>
              <small>Entfernung: ${getDistanceFromLatLonInMeters(image.lat, image.lon, nearbyItem.lat, nearbyItem.lon)}</small><br>
              ${nearbyItem.slug ? `<a href="javascript:void(0)" onclick="(() => { const url = new URL('/item/${nearbyItem.slug}', window.location.origin); window.location.href = url.toString(); })()" style="color: #0066cc; text-decoration: none; font-weight: 500; cursor: pointer;" title="Weitere Bilder in der Nähe">Item anzeigen →</a>` : `<span style='color: #888;'>Kein Slug vorhanden</span>`}
            </div>
          `;
          nearbyMarker.bindPopup(popupContent);
          nearbyMarkers.push(nearbyMarker);
        }
      });
    }
    // Fit map to show all markers
    if (map && (nearby?.length > 0)) {
      const allMarkers = [currentMarker, ...nearbyMarkers];
      const group = L.featureGroup(allMarkers);
      setTimeout(() => {
        try {
          map.invalidateSize();
          map.fitBounds(group.getBounds().pad(0.1), { animate: false });
        } catch (err) {}
      }, 200);
    } else {
      setTimeout(() => { try { map.invalidateSize(); } catch (e) {} }, 200);
    }
  }

  function initMap() {
    if (!mapEl) return;
    import('leaflet').then((Lmod) => {
      const L = Lmod.default || Lmod;
      removeMap();
      map = L.map(mapEl, { zoomControl: true }).setView([image.lat, image.lon], 13);
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      setTimeout(() => {
        if (!map) return; // Guard against null map
        const standardLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' });
        const hybridLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community' });
        if (mapType === 'standard') {
          standardLayer.addTo(map);
          map.currentLayer = standardLayer;
        } else {
          hybridLayer.addTo(map);
          map.currentLayer = hybridLayer;
        }
        map.standardLayer = standardLayer;
        map.hybridLayer = hybridLayer;
        renderMarkers();
      });
    });
  }

  onMount(() => {
    initMap();
  });

  onDestroy(() => {
    removeMap();
  });

  async function openMapPicker(startLat: number | null, startLon: number | null) {
    showMapPicker = true;
    mapPickerType = 'standard';
    mapPickerSearch = '';
    mapPickerSearchResults = [];
    const imageLat = image?.lat;
    const imageLon = image?.lon;
    if (imageLat && imageLon) {
      mapPickerLat = imageLat;
      mapPickerLon = imageLon;
      isGettingUserLocation = false;
      setTimeout(() => initMapPicker(), 100);
    } else {
      if (navigator.geolocation) {
        isGettingUserLocation = true;
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            mapPickerLat = pos.coords.latitude;
            mapPickerLon = pos.coords.longitude;
            isGettingUserLocation = false;
            setTimeout(() => initMapPicker(), 100);
          },
          () => {
            mapPickerLat = startLat ?? 48.1351;
            mapPickerLon = startLon ?? 11.5820;
            isGettingUserLocation = false;
            setTimeout(() => initMapPicker(), 100);
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      } else {
        mapPickerLat = startLat ?? 48.1351;
        mapPickerLon = startLon ?? 11.5820;
        setTimeout(() => initMapPicker(), 100);
      }
    }
  }

  async function initMapPicker() {
    const leaflet = await import('leaflet');
    if (!mapPickerContainer || mapPickerMap) return;
    const initialLat = mapPickerLat ?? 48.1351;
    const initialLon = mapPickerLon ?? 11.5820;
    mapPickerMap = leaflet.map(mapPickerContainer, { zoomControl: true }).setView([initialLat, initialLon], 13);
    const standardLayer = leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    });
    const hybridLayer = leaflet.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community'
    });
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
  }

  function toggleMapPickerType() {
    if (!mapPickerMap) return;
    mapPickerType = mapPickerType === 'standard' ? 'hybrid' : 'standard';
    const currentLayer = mapPickerMap.currentLayer;
    const newLayer = mapPickerType === 'standard' ? mapPickerMap.standardLayer : mapPickerMap.hybridLayer;
    if (currentLayer) mapPickerMap.removeLayer(currentLayer);
    newLayer.addTo(mapPickerMap);
    mapPickerMap.currentLayer = newLayer;
  }

  function closeMapPicker() {
    showMapPicker = false;
    if (mapPickerMap) {
      mapPickerMap.remove();
      mapPickerMap = null;
    }
  }

  async function saveMapPickerCoords() {
    if (!mapPickerLat || !mapPickerLon || !image) return;
    dispatch('saveMapCoords', { lat: mapPickerLat, lon: mapPickerLon });
    closeMapPicker();
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

  function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }
  function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number): string {
    const meters = getDistanceInMeters(lat1, lon1, lat2, lon2);
    return meters >= 1000 ? (meters / 1000).toFixed(1).replace('.', ',') + 'km' : meters + 'm';
  }

  $: {
    const filteredNearbyKey = JSON.stringify(nearby.map(i => i.id));
    if (map && image && image.lat && image.lon) {
      if (filteredNearbyKey !== lastNearbyKey) {
        lastNearbyKey = filteredNearbyKey;
        mapKey += 1;
        map = null;
      }
    }
  }

  $: if (mapEl && mapKey >= 0) {
    initMap();
  }
</script>

<div class="location-section" style="background: transparent;">
  {#if image.lat && image.lon}
    <div class="map-wrapper">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.7rem;">
        {#if isCreator}
          <button class="map-pin-btn" on:click={() => dispatch('openMapPicker', [image.lat, image.lon])} title="GPS ändern">
            <!-- Culoca O SVG -->
            <svg width="28" height="34" viewBox="0 0 83.86 100.88" fill="none" xmlns="http://www.w3.org/2000/svg" class="culoca-o-edit">
              <path d="M0,41.35c0-5.67,1.1-11.03,3.29-16.07,2.19-5.04,5.19-9.43,8.98-13.17,3.79-3.74,8.25-6.69,13.36-8.86,5.11-2.17,10.54-3.25,16.29-3.25s11.18,1.08,16.29,3.25c5.11,2.17,9.56,5.12,13.36,8.86,3.79,3.74,6.79,8.13,8.98,13.17,2.19,5.04,3.29,10.4,3.29,16.07s-1.1,11.03-3.29,16.07c-2.2,5.04-5.19,9.43-8.98,13.17-3.8,3.74-8.25,6.7-13.36,8.86-5.11,2.17-9.49,21.42-15.25,21.42s-12.23-19.25-17.34-21.42c-5.11-2.17-9.56-5.12-13.36-8.86-3.79-3.74-6.79-8.13-8.98-13.17-2.2-5.04-3.29-10.4-3.29-16.07ZM25.16,41.35c0,2.29.44,4.43,1.32,6.44.88,2.01,2.07,3.76,3.59,5.26,1.52,1.5,3.29,2.68,5.33,3.55,2.04.87,4.21,1.3,6.53,1.3s4.49-.43,6.53-1.3c2.04-.87,3.81-2.05,5.33-3.55,1.52-1.5,2.71-3.25,3.59-5.26.88-2.01,1.32-4.15,1.32-6.44s-.44-4.43-1.32-6.44c-.88-2.01-2.08-3.76-3.59-5.26-1.52-1.5-3.29-2.68-5.33-3.55-2.03-.87-4.21-1.3-6.53-1.3s-4.49.43-6.53,1.3c-2.04.87-3.81,2.05-5.33,3.55-1.52,1.5-2.72,3.25-3.59,5.26-.88,2.01-1.32,4.16-1.32,6.44Z"/>
            </svg>
          </button>
        {/if}
        <h2 class="map-title">{image.title || 'Standort'}</h2>
        <button class="map-type-btn" on:click={toggleMapType} title={mapType === 'standard' ? 'Satellit' : 'Standard'}>
          {#if mapType === 'standard'}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="11" y="3" width="2" height="7" rx="1"/><rect x="11" y="14" width="2" height="7" rx="1"/><rect x="3" y="11" width="7" height="2" rx="1"/><rect x="14" y="11" width="7" height="2" rx="1"/><circle cx="12" cy="12" r="3"/><path d="M7 7l3 3"/><path d="M17 17l-3-3"/></svg>
          {:else}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2"/>
              <line x1="8" y1="2" x2="8" y2="18"/>
              <line x1="16" y1="6" x2="16" y2="22"/>
            </svg>
          {/if}
        </button>
      </div>
      {#key mapKey}
        <div bind:this={mapEl} class="map"></div>
      {/key}
    </div>
  {:else}
    <div class="map-wrapper">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <h2 class="map-title">Standort</h2>
        <button class="map-pin-btn" on:click={() => dispatch('openMapPicker', [null, null])} title="GPS setzen">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21c-4.418 0-8-4.03-8-9 0-4.418 3.582-8 8-8s8 3.582 8 8c0 4.97-3.582 9-8 9zm0-13a4 4 0 100 8 4 4 0 000-8z"/></svg>
        </button>
      </div>
      <div style="padding: 20px; text-align: center; color: #666;">
        GPS-Daten nicht verfügbar<br>
        Lat: {image?.lat || 'null'}, Lon: {image?.lon || 'null'}
      </div>
    </div>
  {/if}
</div>

{#if showMapPicker}
  <div class="map-modal-fullscreen">
    <div class="map-modal-content-fullscreen">
      <div class="map-modal-header-fullscreen">
        {#if image?.path_64}
          <div class="map-picker-thumbnail">
            <img 
              src="https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-64/{image.path_64}" 
              alt={image.title || 'Bild'} 
              title="{image.title || image.original_name || 'Bild'}"
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
  .location-section {
    background: transparent;
    margin-top: 1.5rem;
  }
  .map-wrapper {
    width: 100%;
    border: none;
    margin-bottom: 0;
  }
  .map-title {
    font-size: 1.2rem;
    font-weight: 600;
    margin: 0 1rem;
    color: var(--text-primary);
  }
  .map {
    width: 100%;
    height: 350px;
    margin-top: 1rem;
    background: #e5e7eb;
    min-height: 200px;
  }
  .map-type-btn {
    background: var(--bg-secondary);
    color: var(--text-secondary);
    border: none;
    border-radius: 8px;
    padding: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 1rem;
  }
  .map-type-btn:hover {
    background: var(--accent-color);
    color: #fff;
  }
  .map-pin-btn {
    background: transparent;
    border: none;
    border-radius: 6px;
    padding: 0.3rem 0.7rem;
    cursor: pointer;
    color: inherit;
    font-size: 1rem;
    margin-right: 0.5rem;
    transition: background 0.2s;
  }
  .map-pin-btn:hover {
    background: transparent;
  }
  .map-pin-btn .culoca-o-edit path {
    fill: var(--text-primary);
    transition: fill 0.2s;
  }
  .map-pin-btn:hover .culoca-o-edit path {
    fill: var(--culoca-orange, #ee7221);
  }
  :global(html.dark) :global(.map-pin-btn) :global(.culoca-o-edit) path {
    fill: #fff;
  }
  :global(.culoca-o-edit) {
    display: block;
    margin-left: 1rem;
    vertical-align: middle;
    fill: var(--text-primary);
    transition: fill 0.2s;
  }
  .location-filter-btn {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 0.3rem 0.7rem;
    cursor: pointer;
    color: var(--accent-color);
    font-size: 1rem;
    margin-left: 0.5rem;
    transition: background 0.2s;
  }
  .location-filter-btn:hover {
    background: var(--accent-color);
    color: #fff;
  }
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
    box-shadow: 0 4px 24px var(--shadow);
    padding: 1.5rem;
    width: 95vw;
    max-width: 600px;
    max-height: 95vh;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    position: relative;
    transition: background-color 0.3s ease;
  }
  .map-modal-header-fullscreen {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }
  .map-picker-thumbnail img {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    object-fit: cover;
    border: 2px solid var(--accent-color);
  }
  .map-search-input {
    flex: 1;
    padding: 0.4rem 0.7rem;
    border-radius: 6px;
    border: 1px solid var(--border-color);
    font-size: 1rem;
  }
  .map-search-results {
    background: var(--bg-secondary);
    border-radius: 8px;
    margin: 0.5rem 0;
    max-height: 180px;
    overflow-y: auto;
    box-shadow: 0 2px 8px var(--shadow);
    transition: background-color 0.3s ease;
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
    height: 300px;
    border-radius: 12px;
    background: var(--bg-secondary);
    margin-bottom: 0.5rem;
    position: relative;
    transition: background-color 0.3s ease;
  }
  .map-picker-pin {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -100%);
    z-index: 10;
    pointer-events: none;
  }
  .map-picker-leaflet-fullscreen {
    width: 100%;
    height: 100%;
    border-radius: 12px;
    overflow: hidden;
  }
  .map-coords-fullscreen {
    text-align: center;
    font-size: 1rem;
    color: var(--text-secondary);
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
</style> 