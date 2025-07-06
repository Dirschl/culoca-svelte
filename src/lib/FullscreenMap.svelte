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
  let autoRotateEnabled = false;
  let showDistance = true; // New: Toggle between distance and title display
  let lastPosition: { lat: number; lon: number; accuracy: number; timestamp: number } | null = null;
  let lastPositionTime: number | null = null;
  let currentBearing = 0;
  let watchId: number | null = null;
  let isIOS = false;
  let compassHeading: number | null = null;
  let orientationListener: ((event: DeviceOrientationEvent) => void) | null = null;
  let useCompass = false; // Toggle between GPS and compass mode
  
  // Previous position for movement tracking
  let previousPosition: { lat: number; lon: number; timestamp: number } | null = null;
  let positionWatchId: number | null = null;
  
  // Load saved map state from localStorage
  function loadMapState() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('culoca-map-state');
      if (saved) {
        try {
          const state = JSON.parse(saved);
          savedZoom = state.zoom || 18;
          savedCenter = state.center || null;
          autoRotateEnabled = state.autoRotate !== undefined ? state.autoRotate : false;
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
    addImageMarkers();
    
    // Save map state on zoom/move
    map.on('zoomend moveend', saveMapState);
    
    mapInitialized = true;
  }
  
  function addImageMarkers() {
    if (!map || !images.length) return;
    
    // Clear existing markers
    imageMarkers.forEach(marker => {
      map.removeLayer(marker);
    });
    imageMarkers = [];
    
    images.forEach(image => {
      // Create marker element with image and label
      const markerEl = document.createElement('div');
      markerEl.className = 'image-marker-container';
      markerEl.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        cursor: pointer;
      `;
      
      // Create image element
      const imageEl = document.createElement('div');
      imageEl.className = 'image-marker';
      imageEl.style.cssText = `
        width: 48px;
        height: 48px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: pointer;
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        background-color: #f0f0f0;
      `;
      
      // Set background image - try multiple paths
      let imageUrl = '';
      if (image.path_64) {
        imageUrl = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-64/${image.path_64}`;
      } else if (image.path_512) {
        // Fallback to 512px image path
        imageUrl = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${image.path_512}`;
      } else if (image.path) {
        // Fallback to main image path
        imageUrl = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images/${image.path}`;
      }
      
      console.log(`[FullscreenMap] Loading image for ${image.id}:`, {
        path_64: image.path_64,
        path_512: image.path_512,
        path: image.path,
        finalUrl: imageUrl
      });
      
      if (imageUrl) {
        // Directly set the background image
        imageEl.style.backgroundImage = `url(${imageUrl})`;
        
        // Add error handling for failed image loads
        const testImg = new Image();
        testImg.onload = () => {
          console.log(`[FullscreenMap] Image loaded successfully: ${imageUrl}`);
          imageEl.style.backgroundImage = `url(${imageUrl})`;
        };
        testImg.onerror = () => {
          console.warn(`[FullscreenMap] Image failed to load: ${imageUrl}`);
          // Show fallback icon if image fails to load
          imageEl.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21,15 16,10 5,21"/>
            </svg>
          `;
          imageEl.style.backgroundColor = '#e0e0e0';
          imageEl.style.display = 'flex';
          imageEl.style.alignItems = 'center';
          imageEl.style.justifyContent = 'center';
        };
        testImg.src = imageUrl;
      } else {
        console.warn(`[FullscreenMap] No image path available for image ${image.id}`);
        // No image path available - show fallback
        imageEl.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21,15 16,10 5,21"/>
          </svg>
        `;
        imageEl.style.backgroundColor = '#e0e0e0';
        imageEl.style.display = 'flex';
        imageEl.style.alignItems = 'center';
        imageEl.style.justifyContent = 'center';
      }
      
      // Create label element
      const labelEl = document.createElement('div');
      labelEl.className = 'image-label';
      labelEl.style.cssText = `
        background: rgba(255, 255, 255, 0.95);
        color: #333;
        font-size: 12px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 8px;
        margin-top: 2px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        white-space: nowrap;
        text-align: center;
        min-width: 40px;
      `;
      
      // Calculate label text based on current display mode
      let labelText = '';
      if (userLat !== null && userLon !== null) {
        if (showDistance) {
          // Show distance
          const distance = calculateDistance(userLat, userLon, image.lat, image.lon);
          labelText = distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`;
        } else {
          // Show title (up to comma, max 60 chars)
          if (image.title) {
            const titleParts = image.title.split(',');
            labelText = titleParts[0].trim();
            // Limit to max 60 characters as specified
            if (labelText.length > 60) {
              labelText = labelText.substring(0, 57) + '...';
            }
          } else {
            labelText = 'Unbenannt';
          }
        }
      }
      
      labelEl.textContent = labelText;
      
      // Assemble marker
      markerEl.appendChild(imageEl);
      markerEl.appendChild(labelEl);
      
      // Create marker
      const marker = new (window as any).L.marker([image.lat, image.lon], {
        icon: (window as any).L.divIcon({
          html: markerEl.outerHTML,
          className: 'custom-marker',
          iconSize: [120, 75], // Größer für längere Labels
          iconAnchor: [60, 70] // Angepasster Ankerpunkt
        })
      }).addTo(map);
      
      // Click handler for navigation
      marker.on('click', () => {
        dispatch('imageClick', { imageId: image.id });
      });
      
      // Store reference to image data
      marker.image = image;
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
  
  // Update user position on map
  function updateUserPosition(lat: number, lon: number) {
    userLat = lat;
    userLon = lon;
    
    if (!userMarker || !map) return;
    
    const newPosition = [lon, lat];
    
    // Update position without auto-rotation (handled by new toggleAutoRotate function)
    userMarker.setLngLat(newPosition);
    
    // Save updated state
    saveMapState();
  }
  
  // Detect iOS device
  onMount(() => {
    isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    console.log(`[FullscreenMap] Device detected: ${isIOS ? 'iOS' : 'Other'}`);
  });

  // Request device orientation permission for iOS
  async function requestIOSPermissions() {
    if (isIOS && typeof DeviceOrientationEvent !== 'undefined') {
      try {
        // TypeScript doesn't recognize requestPermission, so we use any
        const DeviceOrientationEventAny = DeviceOrientationEvent as any;
        if (typeof DeviceOrientationEventAny.requestPermission === 'function') {
          const permission = await DeviceOrientationEventAny.requestPermission();
          console.log(`[FullscreenMap] Device orientation permission: ${permission}`);
          return permission === 'granted';
        }
      } catch (error) {
        console.warn('[FullscreenMap] Error requesting device orientation permission:', error);
      }
    }
    return true; // Non-iOS or no permission needed
  }
  
  // Setup compass orientation listener
  function setupCompassListener() {
    if (orientationListener) return; // Already setup
    
    orientationListener = (event: DeviceOrientationEvent) => {
      if (event.alpha !== null) {
        // Convert compass heading to map bearing
        // alpha gives us the compass heading (0-360°)
        let heading = event.alpha;
        
        // For iOS, we might need to adjust the heading
        const eventAny = event as any;
        if (isIOS && eventAny.webkitCompassHeading !== undefined) {
          heading = eventAny.webkitCompassHeading;
        }
        
        compassHeading = heading;
        
        if (autoRotateEnabled && useCompass && map) {
          // Smooth rotation update
          const targetBearing = -heading; // Negative because map rotation is opposite
          
          if (Math.abs(targetBearing - currentBearing) > 180) {
            // Handle 360° wrap-around
            if (targetBearing > currentBearing) {
              currentBearing += 360;
            } else {
              currentBearing -= 360;
            }
          }
          
          // Smooth interpolation
          const diff = targetBearing - currentBearing;
          if (Math.abs(diff) > 2) { // Only update if significant change
            currentBearing += diff * 0.1; // Smooth interpolation
            map.setBearing(currentBearing);
            console.log(`[FullscreenMap] Compass rotation: ${heading.toFixed(1)}° → map bearing: ${currentBearing.toFixed(1)}°`);
          }
        }
      }
    };
    
    window.addEventListener('deviceorientation', orientationListener);
    console.log('[FullscreenMap] Compass listener setup complete');
  }

  // Remove compass listener
  function removeCompassListener() {
    if (orientationListener) {
      window.removeEventListener('deviceorientation', orientationListener);
      orientationListener = null;
      console.log('[FullscreenMap] Compass listener removed');
    }
  }

  // Setup GPS-based direction tracking
  function setupGPSTracking() {
    if (!navigator.geolocation) {
      console.warn('[FullscreenMap] Geolocation not available');
      return;
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 1000
    };

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newPos = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: Date.now()
        };

        if (autoRotateEnabled && !useCompass && lastPosition) {
          // Calculate bearing between two GPS points
          const bearing = calculateBearing(
            lastPosition.lat, lastPosition.lon,
            newPos.lat, newPos.lon
          );

          // Check if we've moved enough and with good accuracy
          const distance = calculateDistance(
            lastPosition.lat, lastPosition.lon,
            newPos.lat, newPos.lon
          );

          const minDistance = isIOS ? 8 : 5; // Higher threshold for iOS
          const maxAccuracy = isIOS ? 25 : 20; // More lenient for iOS
          const minTimeDiff = 2000; // 2 seconds minimum

          if (distance > minDistance && 
              newPos.accuracy < maxAccuracy && 
              lastPosition.accuracy < maxAccuracy &&
              (newPos.timestamp - lastPosition.timestamp) > minTimeDiff) {
            
            if (map) {
              currentBearing = bearing;
              map.setBearing(bearing);
              console.log(`[FullscreenMap] GPS rotation: distance=${distance.toFixed(1)}m, bearing=${bearing.toFixed(1)}°, accuracy=${newPos.accuracy.toFixed(1)}m`);
            }
          }
        }

        lastPosition = newPos;
      },
      (error) => {
        console.warn('[FullscreenMap] GPS tracking error:', error.message);
      },
      options
    );

    console.log('[FullscreenMap] GPS tracking setup complete');
  }

  // Stop GPS tracking
  function stopGPSTracking() {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
      console.log('[FullscreenMap] GPS tracking stopped');
    }
  }

  // Toggle auto-rotation with hybrid approach
  async function toggleAutoRotate() {
    autoRotateEnabled = !autoRotateEnabled;
    console.log(`[FullscreenMap] Auto-rotation ${autoRotateEnabled ? 'enabled' : 'disabled'}`);
    
    if (autoRotateEnabled) {
      // Request permissions for iOS
      const hasPermission = await requestIOSPermissions();
      
      if (hasPermission) {
        // Try compass first on iOS, GPS as fallback
        if (isIOS) {
          useCompass = true;
          setupCompassListener();
          // Also setup GPS as backup
          setupGPSTracking();
          
          // Check if compass is working after 3 seconds
          setTimeout(() => {
            if (compassHeading === null) {
              console.log('[FullscreenMap] Compass not working, switching to GPS mode');
              useCompass = false;
            }
          }, 3000);
        } else {
          // Non-iOS: prefer GPS
          useCompass = false;
          setupGPSTracking();
          setupCompassListener(); // Setup compass as backup
        }
      } else {
        console.warn('[FullscreenMap] Permissions denied, using GPS only');
        useCompass = false;
        setupGPSTracking();
      }
    } else {
      // Disable both tracking methods
      removeCompassListener();
      stopGPSTracking();
      compassHeading = null;
      lastPosition = null;
    }
  }
  
  // Toggle display mode between distance and title
  function toggleDisplayMode() {
    showDistance = !showDistance;
    console.log(`[FullscreenMap] Display mode toggled: ${showDistance ? 'distance' : 'title'}`);
    // Update all existing markers
    updateMarkerLabels();
  }
  
  // Update marker labels based on current display mode
  function updateMarkerLabels() {
    if (!map || !mapInitialized || !images.length) return;
    
    console.log(`[FullscreenMap] Updating marker labels for ${images.length} images`);
    
    // Clear existing markers and recreate them with new labels
    imageMarkers.forEach(marker => {
      map.removeLayer(marker);
    });
    imageMarkers = [];
    
    // Recreate markers with updated labels
    addImageMarkers();
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
    console.log(`[FullscreenMap] Reactive update triggered: ${images.length} images`);
    const leaflet = (window as any).L;
    if (leaflet) {
      addImageMarkers();
    }
  }
  
  $: if (mapInitialized && (userLat || userLon || deviceHeading !== null)) {
    updateUserMarker();
  }
  
  // Track user movement for auto-rotation
  function trackUserMovement() {
    if (!autoRotateEnabled) return;
    
    // This function is now handled by the new toggleAutoRotate logic
    // No need for separate tracking
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
        <!-- Satellite/Hybrid Icon - shown when in street view -->
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="6" height="6" rx="1"/>
          <rect x="9" y="3" width="6" height="6" rx="1"/>
          <rect x="15" y="3" width="6" height="6" rx="1"/>
          <rect x="3" y="9" width="6" height="6" rx="1"/>
          <rect x="9" y="9" width="6" height="6" rx="1"/>
          <rect x="15" y="9" width="6" height="6" rx="1"/>
        </svg>
      {/if}
    </button>

    <!-- Display Mode Toggle FAB -->
    <button 
      class="display-toggle-fab"
      on:click={toggleDisplayMode}
      title={showDistance ? 'Titel anzeigen' : 'Entfernung anzeigen'}
    >
      {#if showDistance}
        <!-- ABC Icon - shown when showing distance, click to show titles -->
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 7h16M4 12h16M4 17h10"/>
          <circle cx="18" cy="17" r="2"/>
        </svg>
      {:else}
        <!-- 123 Icon - shown when showing titles, click to show distance -->
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 7h6M9 12h6M9 17h6"/>
          <circle cx="5" cy="7" r="2"/>
          <circle cx="5" cy="12" r="2"/>
          <circle cx="5" cy="17" r="2"/>
        </svg>
      {/if}
    </button>

    <!-- Auto-Rotate FAB -->
    <button 
      class="auto-rotate-fab"
      class:active={autoRotateEnabled}
      on:click={toggleAutoRotate}
      title={autoRotateEnabled 
        ? (useCompass ? 'Kompass-Rotation deaktivieren' : 'GPS-Rotation deaktivieren')
        : (isIOS ? 'Kompass-Rotation aktivieren' : 'GPS-Rotation aktivieren')
      }
    >
      {#if autoRotateEnabled}
        {#if useCompass}
          <!-- Active Compass Icon -->
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin">
            <circle cx="12" cy="12" r="10"/>
            <polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88"/>
            <circle cx="12" cy="12" r="2"/>
          </svg>
        {:else}
          <!-- Active GPS Icon -->
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-pulse">
            <path d="M12 2L13.09 8.26L22 9L13.09 15.74L12 22L10.91 15.74L2 9L10.91 8.26L12 2Z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        {/if}
      {:else}
        {#if isIOS}
          <!-- Inactive Compass Icon for iOS -->
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88"/>
            <circle cx="12" cy="12" r="2"/>
          </svg>
        {:else}
          <!-- Inactive GPS Icon for other devices -->
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L13.09 8.26L22 9L13.09 15.74L12 22L10.91 15.74L2 9L10.91 8.26L12 2Z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        {/if}
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
  .display-toggle-fab,
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
  .display-toggle-fab:hover,
  .auto-rotate-fab:hover,
  .grid-fab:hover {
    transform: scale(1.1);
    background: rgba(255, 107, 53, 0.9); /* Leicht transparenter Orange beim Hover */
  }
  
  .view-toggle-fab:active,
  .display-toggle-fab:active,
  .auto-rotate-fab:active,
  .grid-fab:active {
    transform: scale(0.95);
  }
  
  /* Rotating animation for active compass */
  .rotating {
    animation: rotate 2s linear infinite;
  }
  
  @keyframes rotate {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
  
  /* Mobile responsive adjustments */
  @media (max-width: 600px) {
    .fab-container {
      bottom: 1.5rem;
      right: 1.5rem;
      gap: 0.75rem;
    }
    
    .view-toggle-fab,
    .display-toggle-fab,
    .auto-rotate-fab,
    .grid-fab {
      width: 3.5rem;
      height: 3.5rem;
    }
    
    .view-toggle-fab svg,
    .display-toggle-fab svg,
    .auto-rotate-fab svg,
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
  
  /* Auto-rotate animation */
  .auto-rotate-fab .animate-spin {
    animation: spin 2s linear infinite;
  }
  
  .auto-rotate-fab .animate-pulse {
    animation: pulse 2s ease-in-out infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
</style> 