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
  let markerClusterGroup: any = null;
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
  let simulationActive = false; // Track if GPS simulation is active
  let lastSimulatedPosition: { lat: number; lon: number; timestamp: number } | null = null;
  
  // Previous position for movement tracking
  let previousPosition: { lat: number; lon: number; timestamp: number } | null = null;
  let positionWatchId: number | null = null;
  
  // Import supabase client for loading all images
  import { supabase } from './supabaseClient';
  
  // Internal images array for clustering
  let allImages: any[] = [];
  
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
          isHybridView = state.isHybridView !== undefined ? state.isHybridView : false;
          showDistance = state.showDistance !== undefined ? state.showDistance : true;
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
        autoRotate: autoRotateEnabled,
        isHybridView: isHybridView,
        showDistance: showDistance
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
    
    // Load MarkerCluster CSS
    if (!document.querySelector('link[href*="markercluster"]')) {
      const clusterLink = document.createElement('link');
      clusterLink.rel = 'stylesheet';
      clusterLink.href = 'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css';
      document.head.appendChild(clusterLink);
    }
    
    // Load MarkerCluster JS
    if (typeof (window as any).L.markerClusterGroup === 'undefined') {
      await import('leaflet.markercluster');
    }
    
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
    
    // Initialize marker cluster group
    markerClusterGroup = (window as any).L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: true,
      zoomToBoundsOnClick: true,
      disableClusteringAtZoom: 16, // Ab Zoom 16 keine Clustering mehr
      iconCreateFunction: function(cluster: any) {
        const count = cluster.getChildCount();
        let className = 'marker-cluster-small';
        if (count > 100) {
          className = 'marker-cluster-large';
        } else if (count > 10) {
          className = 'marker-cluster-medium';
        }
        
        return (window as any).L.divIcon({
          html: `<div><span>${count}</span></div>`,
          className: `marker-cluster ${className}`,
          iconSize: (window as any).L.point(40, 40)
        });
      }
    });
    
    // Add cluster group to map
    map.addLayer(markerClusterGroup);
    
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
    
    // Load all images for clustering
    loadAllImagesForMap();
  }
  
  function addImageMarkers() {
    console.log(`[FullscreenMap] addImageMarkers called with ${allImages.length} images`);
    if (!map || !markerClusterGroup || !allImages.length) {
      console.log(`[FullscreenMap] Skipping addImageMarkers - map: ${!!map}, clusterGroup: ${!!markerClusterGroup}, allImages.length: ${allImages.length}`);
      return;
    }
    
    // Clear existing markers from cluster group
    markerClusterGroup.clearLayers();
    imageMarkers = [];
    
    console.log(`[FullscreenMap] Processing ${allImages.length} images for markers`);
    allImages.forEach((image, index) => {
      console.log(`[FullscreenMap] Processing image ${index + 1}/${allImages.length}:`, {
        id: image.id,
        lat: image.lat,
        lon: image.lon,
        title: image.title,
        path_64: image.path_64,
        path_512: image.path_512
      });
      
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
      labelEl.className = 'image-label marker-text';
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
          labelText = formatDistance(distance);
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
      console.log(`[FullscreenMap] Creating marker for image ${image.id} at [${image.lat}, ${image.lon}]`);
      const marker = new (window as any).L.marker([image.lat, image.lon], {
        icon: (window as any).L.divIcon({
          html: markerEl.outerHTML,
          className: 'custom-marker',
          iconSize: [120, 75], // Größer für längere Labels
          iconAnchor: [60, 24] // Zentriert auf dem Bild: Mitte horizontal (60), Mitte des Bildes vertikal (24px = 48px/2)
        })
      });
      
      console.log(`[FullscreenMap] Marker created for image ${image.id}`);
      
      // Click handler for navigation
      marker.on('click', () => {
        dispatch('imageClick', { imageId: image.id });
      });
      
      // Store reference to image data
      marker.image = image;
      imageMarkers.push(marker);
      
      // Add marker to cluster group instead of directly to map
      markerClusterGroup.addLayer(marker);
      console.log(`[FullscreenMap] Marker added to cluster group for image ${image.id}`);
    });
    
    console.log(`[FullscreenMap] Finished adding ${imageMarkers.length} markers to cluster group`);
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
    const R = 6371; // Earth's radius in kilometers (not meters!)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
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
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360; // Normalize to 0-360°
  }
  
  // Format distance with German locale (comma as decimal separator)
  function formatDistance(distanceKm: number): string {
    if (distanceKm < 1) {
      // Show in meters with German formatting
      const meters = Math.round(distanceKm * 1000);
      return `${meters}m`;
    } else {
      // Show in kilometers with German formatting (comma as decimal separator)
      return `${distanceKm.toFixed(1).replace('.', ',')}km`;
    }
  }
  
  // Update user position on map
  function updateUserPosition(lat: number, lon: number) {
    userLat = lat;
    userLon = lon;
    
    if (!map) {
      console.log('[FullscreenMap] updateUserPosition: Map not initialized yet');
      return;
    }
    
    // Check if map container is properly initialized
    const mapContainer = map.getContainer();
    if (!mapContainer || !mapContainer._leaflet_pos) {
      console.log('[FullscreenMap] updateUserPosition: Map container not ready yet');
      return;
    }
    
    try {
      // Update user marker position
      if (userMarker) {
        userMarker.setLatLng([lat, lon]);
      }
      
      // Keep user centered on map - force center without animation
      map.setView([lat, lon], map.getZoom(), { animate: false });
      
      // Update marker labels with new distances
      updateMarkerLabels();
      
      // Save updated state
      saveMapState();
    } catch (error) {
      console.error('[FullscreenMap] Error in updateUserPosition:', error);
    }
  }
  
  // Detect iOS device
  onMount(() => {
    isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    console.log(`[FullscreenMap] Device detected: ${isIOS ? 'iOS' : 'Other'}`);
    
    // Setup GPS simulation listener
    setupSimulationListener();
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
        
        // Apply map rotation based on compass heading
        if (autoRotateEnabled) {
          const targetBearing = -heading; // Negative because we want the heading to point up
          console.log(`[FullscreenMap] Compass heading: ${heading.toFixed(1)}° -> Map bearing: ${targetBearing.toFixed(1)}°`);
          setMapRotation(targetBearing);
        }
        
        useCompass = true;
      }
    };
    
    if (orientationListener) {
      window.addEventListener('deviceorientation', orientationListener);
    }
    console.log('[FullscreenMap] Compass listener setup complete');
  }

  // Remove compass listener
  function removeCompassListener() {
    if (orientationListener) {
      window.removeEventListener('deviceorientation', orientationListener);
      orientationListener = null;
      
      // Reset map rotation
      if (map) {
        setMapRotation(0);
      }
      
      console.log('[FullscreenMap] Compass listener removed');
    }
  }

  // Toggle auto-rotation based on movement direction
  function toggleAutoRotate() {
    autoRotateEnabled = !autoRotateEnabled;
    console.log(`[FullscreenMap] Auto-rotation ${autoRotateEnabled ? 'enabled' : 'disabled'}`);
    
    if (autoRotateEnabled) {
      // Check if simulation is active
      if (simulationActive) {
        console.log('[FullscreenMap] Using GPS simulation for auto-rotation');
        // Don't start real GPS tracking when simulation is active
        return;
      }
      
      // Request permissions first for real GPS
      requestIOSPermissions();
      
      // Start continuous movement tracking
      if (navigator.geolocation) {
        trackUserMovement();
        
        // Setup compass as additional source
        setupCompassListener();
      }
    } else {
      // Disable auto-rotation
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      
      removeCompassListener();
      
      // Reset position tracking
      lastPosition = null;
      lastSimulatedPosition = null;
      currentBearing = 0;
      
      // Reset map rotation
      if (map) {
        setMapRotation(0);
      }
    }
    
    // Save state
    saveMapState();
  }
  
  // Toggle display mode between distance and title
  function toggleDisplayMode() {
    showDistance = !showDistance;
    console.log(`[FullscreenMap] Display mode toggled: ${showDistance ? 'distance' : 'title'}`);
    // Update all existing markers
    updateMarkerLabels();
    // Save the new state
    saveMapState();
  }
  
  // Update marker labels based on current display mode
  function updateMarkerLabels() {
    if (!map || !mapInitialized || !allImages.length) return;
    
    console.log(`[FullscreenMap] Updating marker labels for ${allImages.length} images`);
    
    // Clear existing markers and recreate them with new labels
    imageMarkers.forEach(marker => {
      map.removeLayer(marker);
    });
    imageMarkers = [];
    
    // Recreate markers with updated labels
    addImageMarkers();
  }
  
  onMount(() => {
    loadMapState();
    initMap();
  });
  
  onDestroy(() => {
    // Clean up auto-rotation if active
    if (autoRotateEnabled) {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      removeCompassListener();
    }
    
    // Clean up simulation listener
    if (typeof window !== 'undefined') {
      // Remove event listener (we can't remove specific listeners, so this is a limitation)
      // The listener will be cleaned up when the component is destroyed
    }
    
    if (map) {
      saveMapState();
      map.remove();
    }
  });
  
  // Reactive updates
  $: if (mapInitialized && allImages.length > 0) {
    console.log(`[FullscreenMap] Reactive update triggered: ${allImages.length} images`);
    const leaflet = (window as any).L;
    if (leaflet) {
      console.log(`[FullscreenMap] Leaflet available, calling addImageMarkers`);
      addImageMarkers();
    } else {
      console.log(`[FullscreenMap] Leaflet not available yet`);
    }
  }
  
  $: if (mapInitialized && (userLat || userLon || deviceHeading !== null)) {
    updateUserMarker();
  }
  
  // Track user movement for auto-rotation
  function trackUserMovement() {
    if (!autoRotateEnabled) return;
    
    // Continuous movement tracking with frequent updates
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
    }
    
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        // Ignore real GPS if simulation is active
        if (simulationActive) {
          console.log('[FullscreenMap] Ignoring real GPS - simulation active');
          return;
        }
        
        // Check if map is ready before processing GPS updates
        if (!map || !mapInitialized) {
          console.log('[FullscreenMap] GPS update ignored - map not ready');
          return;
        }
        
        const newPos = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: Date.now()
        };
        
        console.log(`[FullscreenMap] GPS position update:`, {
          lat: newPos.lat,
          lon: newPos.lon,
          accuracy: newPos.accuracy,
          heading: position.coords.heading
        });
        
        // Update user position on map - ensure proper centering
        userLat = newPos.lat;
        userLon = newPos.lon;
        
        // Update user marker position
        if (userMarker) {
          userMarker.setLatLng([newPos.lat, newPos.lon]);
        }
        
        // Force center the map on user position
        if (map) {
          map.setView([newPos.lat, newPos.lon], map.getZoom(), { animate: false });
        }
        
        // Update marker labels with new distances
        updateMarkerLabels();
        
        // Save updated state
        saveMapState();
        
        // Use device heading if available (better for short distances)
        if (position.coords.heading !== null && position.coords.heading !== undefined) {
          console.log(`[FullscreenMap] Using device heading: ${position.coords.heading}°`);
          const targetBearing = -position.coords.heading; // Negative because we want the heading to point up
          setMapRotation(targetBearing);
          return;
        }
        
        if (lastPosition && newPos.accuracy < 25) {
          const distanceKm = calculateDistance(
            lastPosition.lat, lastPosition.lon,
            newPos.lat, newPos.lon
          );
          const distanceMeters = distanceKm * 1000;
          const timeDiff = newPos.timestamp - lastPosition.timestamp;
          // Very small thresholds for continuous movement
          const minDistance = isIOS ? 0.1 : 0.05; // 10cm/5cm minimum
          const minTime = 50; // 50ms minimum
          if (distanceMeters >= minDistance && timeDiff >= minTime) {
            const bearing = calculateBearing(
              lastPosition.lat, lastPosition.lon,
              newPos.lat, newPos.lon
            );
            const targetBearing = -bearing; // Negative because we want the heading to point up
            setMapRotation(targetBearing);
            currentBearing = bearing;
            lastPosition = newPos;
          }
        } else {
          lastPosition = newPos;
        }
      },
      (error) => {
        console.warn('[FullscreenMap] GPS error:', error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 2000,
        maximumAge: 25 // Very fresh positions for continuous movement
      }
    );
  }

  // Setup listener for GPS simulation messages
  function setupSimulationListener() {
    if (typeof window !== 'undefined') {
      window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'gps-simulation') {
          console.log('[FullscreenMap] Received GPS simulation data:', event.data);
          simulationActive = true;
          
          // Check if map is ready before processing simulation updates
          if (!map || !mapInitialized) {
            console.log('[FullscreenMap] Simulation update ignored - map not ready');
            return;
          }
          
          const newPos = {
            lat: event.data.lat,
            lon: event.data.lon,
            timestamp: Date.now()
          };
          
          // Update user position on map - ensure proper centering
          userLat = newPos.lat;
          userLon = newPos.lon;
          
          // Update user marker position
          if (userMarker) {
            userMarker.setLatLng([newPos.lat, newPos.lon]);
          }
          
          // Force center the map on user position
          if (map) {
            map.setView([newPos.lat, newPos.lon], map.getZoom(), { animate: false });
          }
          
          // Update marker labels with new distances
          updateMarkerLabels();
          
          // Save updated state
          saveMapState();
          
          // Handle simulated movement for auto-rotation
          if (autoRotateEnabled && lastSimulatedPosition) {
            const distanceKm = calculateDistance(
              lastSimulatedPosition.lat, lastSimulatedPosition.lon,
              newPos.lat, newPos.lon
            );
            // Convert to meters for comparison
            const distanceMeters = distanceKm * 1000;
            const timeDiff = newPos.timestamp - lastSimulatedPosition.timestamp;
            const minDistance = 0.5; // 0.5 Meter minimum für glattere Simulation-Updates
            const minTime = 100; // 0.1 Sekunden für glattere Simulation
            console.log(`[FullscreenMap] Simulation movement check:`, {
              distanceKm: distanceKm,
              distanceMeters: distanceMeters,
              minDistance: minDistance,
              timeDiff: timeDiff,
              minTime: minTime
            });
            if (distanceMeters >= minDistance && timeDiff >= minTime) {
              const bearing = calculateBearing(
                lastSimulatedPosition.lat, lastSimulatedPosition.lon,
                newPos.lat, newPos.lon
              );
              console.log(`[FullscreenMap] Simulated bearing: ${bearing}° (distance: ${distanceMeters.toFixed(1)}m)`);
              const targetBearing = -bearing; // Negative because we want the heading to point up
              setMapRotation(targetBearing);
              currentBearing = bearing;
            }
          }
          
          lastSimulatedPosition = newPos;
          
        } else if (event.data && event.data.type === 'gps-simulation-stop') {
          console.log('[FullscreenMap] GPS simulation stopped');
          simulationActive = false;
          lastSimulatedPosition = null;
        }
      });
    }
  }

  // === MAP ROTATION (Kompass) ===
  function setMapRotation(rotation: number) {
    if (map) {
      const mapContainer = map.getContainer();
      mapContainer.style.setProperty('--map-rotation', `${rotation}deg`);
      mapContainer.style.transform = `rotate(${rotation}deg)`;
      mapContainer.style.transformOrigin = 'center center';
      mapContainer.style.transition = 'transform 0.2s linear';
      
      // Auch auf das HTML-Element setzen für globale Verfügbarkeit
      document.documentElement.style.setProperty('--map-rotation', `${rotation}deg`);
    }
  }

  // Load all images for the map (no radius limit)
  async function loadAllImagesForMap() {
    try {
      console.log('[FullscreenMap] Loading all images for map...');
      
      const { data, error } = await supabase
        .from('items')
        .select('id, path_512, path_2048, path_64, width, height, lat, lon, title, description, keywords')
        .not('lat', 'is', null)
        .not('lon', 'is', null)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('[FullscreenMap] Error loading images:', error);
        return;
      }
      
      if (data) {
        const processedImages = data.map((img: any) => ({
          id: img.id,
          src: `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${img.path_512}`,
          srcHD: `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${img.path_2048}`,
          width: img.width,
          height: img.height,
          lat: img.lat,
          lon: img.lon,
          title: img.title,
          description: img.description,
          keywords: img.keywords,
          path_64: img.path_64,
          path_512: img.path_512,
          path_2048: img.path_2048
        }));
        
        console.log(`[FullscreenMap] Loaded ${processedImages.length} images for map`);
        
        // Update the internal images array
        allImages = processedImages;
        
        // Re-add markers if map is initialized
        if (mapInitialized && markerClusterGroup) {
          addImageMarkers();
        }
      }
    } catch (err) {
      console.error('[FullscreenMap] Error in loadAllImagesForMap:', err);
    }
  }
  
  // Reactive statement to update markers when allImages changes
  $: if (mapInitialized && markerClusterGroup && allImages.length > 0) {
    console.log(`[FullscreenMap] Reactive update: ${allImages.length} images available`);
    addImageMarkers();
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
        <!-- Karten-Icon (FAB-Style) für Straßenansicht -->
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2"/>
          <line x1="8" y1="2" x2="8" y2="18"/>
          <line x1="16" y1="6" x2="16" y2="22"/>
        </svg>
      {:else}
        <!-- Satelliten-Icon bleibt wie gehabt -->
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="11" y="3" width="2" height="7" rx="1"/>
          <rect x="11" y="14" width="2" height="7" rx="1"/>
          <rect x="3" y="11" width="7" height="2" rx="1"/>
          <rect x="14" y="11" width="7" height="2" rx="1"/>
          <circle cx="12" cy="12" r="3"/>
          <path d="M7 7l3 3"/>
          <path d="M17 17l-3-3"/>
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
        <!-- ABC Icon für Titelanzeige -->
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <text x="12" y="16.5" text-anchor="middle" font-size="11" font-weight="200" fill="currentColor">ABC</text>
        </svg>
      {:else}
        <!-- 123 Icon für Entfernungsanzeige -->
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <text x="12" y="17" text-anchor="middle" font-size="14" font-weight="200" fill="currentColor">123</text>
        </svg>
      {/if}
    </button>

    <!-- Auto-Rotate FAB -->
    <button 
      class="auto-rotate-fab"
      class:active={autoRotateEnabled}
      on:click={toggleAutoRotate}
      title={autoRotateEnabled 
        ? (simulationActive ? 'Simulation-Rotation deaktivieren' : (useCompass ? 'Kompass-Rotation deaktivieren' : 'GPS-Rotation deaktivieren'))
        : (simulationActive ? 'Simulation-Rotation aktivieren' : (isIOS ? 'Kompass-Rotation aktivieren' : 'GPS-Rotation aktivieren'))
      }
    >
      {#if autoRotateEnabled}
        <!-- Pause Icon - Rotation is active -->
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="6" y="4" width="4" height="16"/>
          <rect x="14" y="4" width="4" height="16"/>
        </svg>
      {:else}
        <!-- Play Icon - Rotation is inactive -->
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
      {/if}
    </button>

    <!-- Grid FAB -->
    <button 
      class="grid-fab"
      on:click={closeMap}
      title="Zur Galerie zurückkehren"
    >
      <!-- Gallery Grid Icon for back to gallery -->
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="6" height="6"/>
        <rect x="9" y="3" width="6" height="6"/>
        <rect x="15" y="3" width="6" height="6"/>
        <rect x="3" y="9" width="6" height="6"/>
        <rect x="9" y="9" width="6" height="6"/>
        <rect x="15" y="9" width="6" height="6"/>
        <rect x="3" y="15" width="6" height="6"/>
        <rect x="9" y="15" width="6" height="6"/>
        <rect x="15" y="15" width="6" height="6"/>
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
    /* Lade die Karte von Anfang an größer um Rotations-Ränder abzudecken */
    width: 220%; /* Noch größer für komplette Abdeckung bei allen Rotationen */
    height: 220%;
    position: absolute;
    top: -60%; /* (220 - 100) / 2 = 60% */
    left: -60%;
    transform-origin: center center;
    overflow: hidden;
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
    background: transparent;
    overflow: hidden;
  }
  
  .view-toggle-fab:hover,
  .display-toggle-fab:hover,
  .auto-rotate-fab:hover,
  .grid-fab:hover {
    transform: scale(1.1);
    background: rgba(255, 255, 255, 0.1);
  }
  
  .view-toggle-fab:active,
  .display-toggle-fab:active,
  .auto-rotate-fab:active,
  .grid-fab:active {
    transform: scale(0.95);
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
  
  /* Prevent markers from rotating with the map */
  :global(.marker-text),
  :global(.image-marker) {
    transform-origin: center center !important;
    transition: transform 0.05s ease-out, opacity 0.3s ease !important;
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

  /* Marker-Inhalte immer horizontal - globale Regel */
  :global(.marker-text),
  :global(.image-marker),
  :global(.custom-marker .marker-text),
  :global(.custom-marker .image-marker) {
    transform: rotate(calc(-1 * var(--map-rotation, 0deg))) !important;
    transition: transform 0.2s linear !important;
    transform-origin: center center !important;
  }
  
  /* Marker Cluster Styles */
  :global(.marker-cluster-small) {
    background-color: rgba(238, 115, 31, 0.6);
    border: 2px solid rgba(238, 115, 31, 0.8);
  }
  
  :global(.marker-cluster-small div) {
    background-color: rgba(238, 115, 31, 0.9);
    color: white;
    font-weight: bold;
    font-size: 12px;
    border-radius: 50%;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  }
  
  :global(.marker-cluster-medium) {
    background-color: rgba(238, 115, 31, 0.7);
    border: 2px solid rgba(238, 115, 31, 0.9);
  }
  
  :global(.marker-cluster-medium div) {
    background-color: rgba(238, 115, 31, 1);
    color: white;
    font-weight: bold;
    font-size: 13px;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 3px 8px rgba(0,0,0,0.4);
  }
  
  :global(.marker-cluster-large) {
    background-color: rgba(238, 115, 31, 0.8);
    border: 3px solid rgba(238, 115, 31, 1);
  }
  
  :global(.marker-cluster-large div) {
    background-color: rgba(238, 115, 31, 1);
    color: white;
    font-weight: bold;
    font-size: 14px;
    border-radius: 50%;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
  }
  
  /* Cluster hover effects */
  :global(.marker-cluster:hover) {
    transform: scale(1.1);
    transition: transform 0.2s ease;
  }
  
  /* Cluster coverage area */
  :global(.marker-cluster-small),
  :global(.marker-cluster-medium),
  :global(.marker-cluster-large) {
    border-radius: 50%;
    transition: all 0.3s ease;
  }
</style> 