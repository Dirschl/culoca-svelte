<script lang="ts">
  import { onMount, afterUpdate, onDestroy, createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  export let image: any;
  export let isCreator: boolean;
  export let nearby: any[] = [];
  export let mapType: 'standard' | 'hybrid' = 'standard';
  export let onToggleMapType: () => void;

  let mapEl: HTMLDivElement;
  let map: any = null;
  let mapInitialized = false;

  function initMap() {
    if (!image || !image.lat || !image.lon || !mapEl) return;
    if (map) {
      try { map.remove(); } catch (e) {}
      map = null;
    }
    import('leaflet').then(leaflet => {
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      setTimeout(() => {
        map = leaflet.map(mapEl).setView([image.lat, image.lon], 13);
        const standardLayer = leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' });
        const hybridLayer = leaflet.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community' });
        if (mapType === 'standard') {
          standardLayer.addTo(map);
          map.currentLayer = standardLayer;
        } else {
          hybridLayer.addTo(map);
          map.currentLayer = hybridLayer;
        }
        map.standardLayer = standardLayer;
        map.hybridLayer = hybridLayer;
        // Aktuelles Bild Marker
        const baseUrl = 'https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public';
        const thumbnailUrl = image.path_64 ? `${baseUrl}/images-64/${image.path_64}` : `${baseUrl}/images-512/${image.path_512}`;
        const currentImageIcon = leaflet.divIcon({
          className: 'custom-marker current-image',
          html: `<img src="${thumbnailUrl}" alt="${image.title || 'Bild'}" style="width: 48px; height: 48px; border-radius: 50%; border: 3px solid #ee7221; box-shadow: 0 2px 8px rgba(0,0,0,0.3); object-fit: cover;">`,
          iconSize: [48, 48],
          iconAnchor: [48, 48],
          popupAnchor: [0, -48]
        });
        const currentMarker = leaflet.marker([image.lat, image.lon], { icon: currentImageIcon }).addTo(map);
        if (image.title) {
          currentMarker.bindPopup(`<strong>${image.title}</strong><br><small>Aktuelles Bild</small>`);
        }
        // Nearby Marker
        if (nearby && nearby.length > 0) {
          nearby.forEach((nearbyItem: any) => {
            const nearbyThumbnailUrl = nearbyItem.src64 || nearbyItem.src;
            const nearbyIcon = leaflet.divIcon({
              className: 'custom-marker nearby-image',
              html: `<img src="${nearbyThumbnailUrl}" alt="${nearbyItem.title || 'Item'}" style="width: 48px; height: 48px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); object-fit: cover; cursor: pointer;">`,
              iconSize: [48, 48],
              iconAnchor: [48, 48],
              popupAnchor: [0, -48]
            });
            const nearbyMarker = leaflet.marker([nearbyItem.lat, nearbyItem.lon], { icon: nearbyIcon }).addTo(map);
            nearbyMarker.on('click', () => {
              const url = new URL(`/item/${nearbyItem.id}`, window.location.origin);
              window.location.href = url.toString();
            });
            const popupContent = `
              <div style="text-align: center; min-width: 200px;">
                <strong>${nearbyItem.title || 'Item'}</strong><br>
                <small>Entfernung: ${getDistanceFromLatLonInMeters(image.lat, image.lon, nearbyItem.lat, nearbyItem.lon)}</small><br>
                <a href="javascript:void(0)" onclick="(() => { const url = new URL('/item/${nearbyItem.id}', window.location.origin); window.location.href = url.toString(); })()" style="color: #0066cc; text-decoration: none; font-weight: 500;">Item anzeigen →</a>
              </div>
            `;
            nearbyMarker.bindPopup(popupContent);
          });
        }
        // Fit map to show all markers
        if (nearby && nearby.length > 0) {
          const allMarkers = [currentMarker];
          map.eachLayer((layer: any) => {
            if (layer !== currentMarker && layer._latlng) {
              allMarkers.push(layer);
            }
          });
          const group = leaflet.featureGroup(allMarkers);
          setTimeout(() => {
            try {
              map.invalidateSize();
              map.fitBounds(group.getBounds().pad(0.1), { animate: false });
            } catch (err) {}
          }, 200);
        } else {
          setTimeout(() => { try { map.invalidateSize(); } catch (e) {} }, 200);
        }
        mapInitialized = true;
      });
    });
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

  onMount(() => {
    initMap();
  });
  afterUpdate(() => {
    initMap();
  });
  onDestroy(() => {
    if (map) { try { map.remove(); } catch (e) {} map = null; }
  });
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
        <button class="map-type-btn" on:click={onToggleMapType} title={mapType === 'standard' ? 'Satellit' : 'Standard'}>
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
      <div bind:this={mapEl} class="map"></div>
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
    margin: 0;
    color: var(--text-primary);
  }
  .map {
    width: 100%;
    height: 350px;
    border-radius: 12px;
    margin-top: 1rem;
    margin-bottom: 0.5rem;
    background: #e5e7eb;
    min-height: 200px;
  }
  .map-type-btn {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 0.3rem 0.7rem;
    cursor: pointer;
    color: var(--text-primary);
    font-size: 1rem;
    margin-left: 0.5rem;
    transition: background 0.2s;
  }
  .map-type-btn:hover {
    background: var(--accent-color);
    color: #fff;
  }
  .map-pin-btn {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 0.3rem 0.7rem;
    cursor: pointer;
    color: var(--accent-color);
    font-size: 1rem;
    margin-right: 0.5rem;
    transition: background 0.2s;
  }
  .map-pin-btn:hover {
    background: var(--accent-color);
    color: #fff;
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
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.2);
    padding: 1.5rem;
    width: 95vw;
    max-width: 600px;
    max-height: 95vh;
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
    background: #f3f4f6;
    border-radius: 8px;
    margin: 0.5rem 0;
    max-height: 180px;
    overflow-y: auto;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
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