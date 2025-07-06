<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  
  export let images: any[] = [];
  export let userLat: number | null = null;
  export let userLon: number | null = null;
  export let deviceHeading: number | null = null;
  
  const dispatch = createEventDispatcher();
  
  let mapEl: HTMLDivElement;
  let map: any;
  let mapInitialized = false;
  let userMarker: any = null;
  let imageMarkers: any[] = [];
  let savedZoom = 18; // Default to max zoom
  let savedCenter: [number, number] | null = null;
  let isHybridView = false; // Track current view mode
  let streetLayer: any = null;
  let satelliteLayer: any = null;
  let autoRotateEnabled = true; // New: Auto-rotate feature toggle
  let lastPosition: [number, number] | null = null;
  let movementBearing: number | null = null;
  let watchId: number | null = null;
  
  // Load saved map state from localStorage
  function loadMapState() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('culoca-map-state');
      if (saved) {
        try {
          const state = JSON.parse(saved);
          savedZoom = state.zoom || 18;
          savedCenter = state.center || null;
          autoRotateEnabled = state.autoRotate !== undefined ? state.autoRotate : true;
        } catch (e) {
          console.error('Error loading map state:', e);
        }
      }
    }
  }
  
  // Save map state to localStorage
  function saveMapState() {
    if (typeof window !== 'undefined' && map) {
      const state = {
        zoom: map.getZoom(),
        center: [map.getCenter().lat, map.getCenter().lng],
        autoRotate: autoRotateEnabled
      };
      localStorage.setItem('culoca-map-state', JSON.stringify(state));
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
  
  async function initMap() {
    if (!mapEl || mapInitialized) return;
    
    // Load Leaflet CSS if not already loaded
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    
    // Load Leaflet JS dynamically
    const leaflet = await import('leaflet');
    
    // Determine initial position and zoom
    let initialLat = userLat || 52.5200;
    let initialLon = userLon || 13.4050;
    let initialZoom = savedZoom;
    
    // Use saved center if available and no user position
    if (savedCenter && !userLat && !userLon) {
      [initialLat, initialLon] = savedCenter;
    }
    
    // If we have user position, use it
    if (userLat && userLon) {
      initialLat = userLat;
      initialLon = userLon;
    }
    
    map = leaflet.map(mapEl, {
      zoomControl: false // We'll add custom controls
    }).setView([initialLat, initialLon], initialZoom);
    
    // Create different tile layers
    streetLayer = leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    });
    
    satelliteLayer = leaflet.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: '&copy; Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community'
    });
    
    // Add initial layer based on saved state
    if (isHybridView) {
      satelliteLayer.addTo(map);
    } else {
      streetLayer.addTo(map);
    }
    
    // Add user marker if position available
    if (userLat && userLon) {
      const userIcon = leaflet.divIcon({
        className: 'user-marker-fullscreen',
        html: `<div style="background: #ff5252; width: 24px; height: 24px; border-radius: 50%; border: 4px solid white; box-shadow: 0 3px 8px rgba(0,0,0,0.5); transform: rotate(${deviceHeading || 0}deg);"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
      
      userMarker = leaflet.marker([userLat, userLon], { icon: userIcon }).addTo(map);
    }
    
    // Add image markers
    addImageMarkers(leaflet);
    
    // Save map state on zoom/move
    map.on('zoomend moveend', saveMapState);
    
    mapInitialized = true;
  }
  
  function addImageMarkers(leaflet: any) {
    // Clear existing markers
    imageMarkers.forEach(marker => map.removeLayer(marker));
    imageMarkers = [];
    
    const baseUrl = 'https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public';
    
    images.forEach(image => {
      if (!image.lat || !image.lon) return;
      
      console.log('Adding image marker:', image);
      console.log('Image path_64:', image.path_64);
      
      // Use images-64 for thumbnails on map - construct URL properly
      let thumbnailUrl = null;
      if (image.path_64) {
        thumbnailUrl = `${baseUrl}/images-64/${image.path_64}`;
        console.log('Using images-64 thumbnail:', thumbnailUrl);
      } else if (image.path_512) {
        thumbnailUrl = `${baseUrl}/images-512/${image.path_512}`;
        console.log('Fallback to images-512:', thumbnailUrl);
      } else if (image.path) {
        thumbnailUrl = `${baseUrl}/images/${image.path}`;
        console.log('Fallback to images:', thumbnailUrl);
      }
      
      const distance = userLat && userLon 
        ? getDistanceFromLatLonInMeters(userLat, userLon, image.lat, image.lon)
        : '';
      
      const imageIcon = leaflet.divIcon({
        className: 'image-marker-fullscreen',
        html: `
          <div style="position: relative; width: 48px; height: 48px; cursor: pointer;">
            ${thumbnailUrl ? `
              <img src="${thumbnailUrl}" 
                   style="width: 48px; height: 48px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); object-fit: cover;" 
                   alt="${image.title || 'Bild'}"
                   onerror="console.error('Failed to load image:', this.src); this.style.display='none'; this.parentElement.innerHTML='<div style=&quot;background: #4CAF50; width: 48px; height: 48px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: white; font-size: 16px;&quot;>📷</div>'">
            ` : `
              <div style="background: #4CAF50; width: 48px; height: 48px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: white; font-size: 16px;">📷</div>
            `}
            ${distance ? `<div style="position: absolute; bottom: -25px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; white-space: nowrap; z-index: 1000;">${distance}</div>` : ''}
          </div>
        `,
        iconSize: [48, 48],
        iconAnchor: [24, 24]
      });
      
      const marker = leaflet.marker([image.lat, image.lon], { icon: imageIcon }).addTo(map);
      
      // Add click handler
      marker.on('click', () => {
        dispatch('imageClick', { imageId: image.id });
      });
      
      // Add popup with image info
      const popupContent = `
        <div style="text-align: center; min-width: 150px;">
          ${thumbnailUrl ? `<img src="${thumbnailUrl}" style="width: 64px; height: 64px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;" onerror="this.style.display='none'" />` : ''}
          <br><strong>${image.title || 'Bild'}</strong><br>
          ${distance ? `<small>Entfernung: ${distance}</small><br>` : ''}
          <small>Klicken für Details</small>
        </div>
      `;
      marker.bindPopup(popupContent);
      
      imageMarkers.push(marker);
    });
  }
  
  function updateUserMarker() {
    if (!map || !userLat || !userLon) return;
    
    const leaflet = (window as any).L;
    if (!leaflet) return;
    
    const userIcon = leaflet.divIcon({
      className: 'user-marker-fullscreen',
      html: `<div style="background: #ff5252; width: 24px; height: 24px; border-radius: 50%; border: 4px solid white; box-shadow: 0 3px 8px rgba(0,0,0,0.5); transform: rotate(${deviceHeading || 0}deg);"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    
    if (userMarker) {
      userMarker.setLatLng([userLat, userLon]);
      userMarker.setIcon(userIcon);
    } else {
      userMarker = leaflet.marker([userLat, userLon], { icon: userIcon }).addTo(map);
    }
  }
  
  function closeMap() {
    dispatch('close');
  }
  
  function toggleMapView() {
    if (!map || !streetLayer || !satelliteLayer) return;
    
    isHybridView = !isHybridView;
    
    if (isHybridView) {
      // Switch to satellite view
      map.removeLayer(streetLayer);
      satelliteLayer.addTo(map);
    } else {
      // Switch to street view
      map.removeLayer(satelliteLayer);
      streetLayer.addTo(map);
    }
    
    // Save the new state
    saveMapState();
  }
  
  // Calculate distance between two points in kilometers
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  
  // Calculate bearing between two points
  function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    bearing = (bearing + 360) % 360; // Normalize to 0-360
    
    return bearing;
  }
  
  // Update user position and handle movement-based rotation
  function updateUserPosition(lat: number, lon: number) {
    if (!map || !userMarker) return;
    
    const newPosition: [number, number] = [lat, lon];
    
    // Calculate movement bearing if we have a previous position
    if (lastPosition && autoRotateEnabled) {
      const [lastLat, lastLon] = lastPosition;
      const distance = calculateDistance(lastLat, lastLon, lat, lon);
      
      // Only update bearing if movement is significant (more than 5 meters)
      if (distance > 0.005) { // ~5 meters
        const bearing = calculateBearing(lastLat, lastLon, lat, lon);
        movementBearing = bearing;
        
        // Rotate map to movement direction
        map.setBearing(bearing);
        
        // Update user marker rotation
        if (userMarker) {
          const markerElement = userMarker.getElement();
          if (markerElement) {
            markerElement.style.transform = `rotate(${bearing}deg)`;
          }
        }
      }
    }
    
    // Update position
    userMarker.setLngLat([lon, lat]);
    lastPosition = newPosition;
    
    // Save updated state
    saveMapState();
  }
  
  // Toggle auto-rotate feature
  function toggleAutoRotate() {
    autoRotateEnabled = !autoRotateEnabled;
    
    if (!autoRotateEnabled) {
      // Reset map rotation when disabling auto-rotate
      if (map) {
        map.setBearing(0);
      }
      // Reset user marker rotation
      if (userMarker) {
        const markerElement = userMarker.getElement();
        if (markerElement) {
          markerElement.style.transform = 'rotate(0deg)';
        }
      }
    }
    
    saveMapState();
  }
  
  // Start watching position for movement-based rotation
  function startPositionWatch() {
    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          updateUserPosition(latitude, longitude);
        },
        (error) => {
          console.error('Error watching position:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000
        }
      );
    }
  }
  
  // Stop watching position
  function stopPositionWatch() {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  }
  
  onMount(() => {
    loadMapState();
    initMap();
    
    // Start position watching for movement-based rotation
    startPositionWatch();
    
    return () => {
      stopPositionWatch();
    };
  });
  
  onDestroy(() => {
    stopPositionWatch();
    if (map) {
      saveMapState();
      map.remove();
    }
  });
  
  // Reactive updates
  $: if (mapInitialized && images.length > 0) {
    const leaflet = (window as any).L;
    if (leaflet) {
      addImageMarkers(leaflet);
    }
  }
  
  $: if (mapInitialized && (userLat || userLon || deviceHeading !== null)) {
    updateUserMarker();
  }
</script>

<div class="fullscreen-map">
  <!-- Map container -->
  <div bind:this={mapEl} class="map-container"></div>
  
  <!-- Logo (exactly same position as main page) -->
  <img src="/culoca-logo-512px.png" alt="Culoca" class="culoca-logo" />
  
  <!-- FAB Container -->
  <div class="fab-container">
    <!-- View Toggle FAB -->
    <button 
      class="view-toggle-fab"
      on:click={toggleMapView}
      title={isHybridView ? 'Zur Straßenansicht wechseln' : 'Zur Satellitenansicht wechseln'}
    >
      {#if isHybridView}
        <!-- Street View Icon - shown when in hybrid view -->
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 12h18"/>
          <path d="M3 18h18"/>
          <path d="M3 6h18"/>
          <circle cx="6" cy="12" r="1"/>
          <circle cx="12" cy="12" r="1"/>
          <circle cx="18" cy="12" r="1"/>
        </svg>
      {:else}
        <!-- Satellite/Hybrid View Icon - shown when in street view -->
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 3h18v18H3z"/>
          <path d="M8 8h8v8H8z"/>
          <path d="M3 8h5"/>
          <path d="M16 8h5"/>
          <path d="M8 3v5"/>
          <path d="M8 16v5"/>
        </svg>
      {/if}
    </button>
    
    <!-- Auto-Rotate Toggle FAB -->
    <button 
      class="auto-rotate-fab"
      on:click={toggleAutoRotate}
      title={autoRotateEnabled ? 'Auto-Drehung deaktivieren' : 'Auto-Drehung aktivieren'}
      class:active={autoRotateEnabled}
    >
      {#if autoRotateEnabled}
        <!-- Compass with rotation arrows - shown when auto-rotate is enabled -->
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88"/>
          <path d="M8 8l1.5 1.5"/>
          <path d="M14.5 14.5L16 16"/>
          <path d="M2 12h2"/>
          <path d="M20 12h2"/>
        </svg>
      {:else}
        <!-- Static compass - shown when auto-rotate is disabled -->
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88"/>
          <path d="M12 2v4"/>
          <path d="M12 18v4"/>
        </svg>
      {/if}
    </button>
    
    <!-- Grid FAB -->
    <button 
      class="grid-fab"
      on:click={closeMap}
      title="Zur Galerie zurückkehren"
    >
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="7" height="7"/>
        <rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/>
      </svg>
    </button>
  </div>
</div>

<style>
  .fullscreen-map {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10000;
    background: var(--bg-primary);
  }
  
  .map-container {
    width: 100%;
    height: 100%;
  }
  
  /* Logo - exact same positioning as main page */
  .culoca-logo {
    position: fixed;
    bottom: 1.8rem;
    left: 1.8rem;
    right: auto;
    z-index: 10001;
    width: 15rem;
    transition: opacity 0.2s ease;
    object-fit: contain;
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3));
  }
  
  .culoca-logo:hover {
    opacity: 1;
  }
  
  /* FAB Container */
  .fab-container {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    z-index: 1001;
  }
  
  /* Base FAB styling for both buttons - exactly like main page */
  .view-toggle-fab,
  .auto-rotate-fab,
  .grid-fab {
    width: 4rem;
    height: 4rem;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px var(--shadow);
    backdrop-filter: blur(10px);
    background: #ff6b35; /* Culoca Orange für bessere Sichtbarkeit auf der Karte */
    overflow: hidden;
  }
  
  .view-toggle-fab:hover,
  .auto-rotate-fab:hover,
  .grid-fab:hover {
    transform: scale(1.1);
    background: rgba(255, 107, 53, 0.9); /* Leicht transparenter Orange beim Hover */
  }
  
  .view-toggle-fab:active,
  .auto-rotate-fab:active,
  .grid-fab:active {
    transform: scale(0.95);
  }
  
  /* Special styling for active auto-rotate button */
  .auto-rotate-fab.active {
    background: #ff8c42; /* Slightly brighter orange when active */
    animation: pulse 2s infinite;
  }
  
  @keyframes pulse {
    0% {
      box-shadow: 0 4px 12px var(--shadow);
    }
    50% {
      box-shadow: 0 4px 20px rgba(255, 107, 53, 0.6);
    }
    100% {
      box-shadow: 0 4px 12px var(--shadow);
    }
  }
  
  /* Mobile responsive */
  @media (max-width: 768px) {
    .fab-container {
      bottom: 1rem;
      right: 1rem;
      gap: 0.7rem;
    }
    
    .view-toggle-fab,
    .grid-fab {
      width: 3.5rem;
      height: 3.5rem;
    }
    
    .view-toggle-fab svg,
    .grid-fab svg {
      width: 36px;
      height: 36px;
    }
  }
  
  /* Global styles for map markers */
  :global(.user-marker-fullscreen) {
    background: transparent !important;
    border: none !important;
  }
  
  :global(.image-marker-fullscreen) {
    background: transparent !important;
    border: none !important;
  }
</style> 