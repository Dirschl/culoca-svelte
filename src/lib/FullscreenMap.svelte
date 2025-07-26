<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { get } from 'svelte/store';
  import { filterStore, userFilter, locationFilter, shouldShowCustomerBranding } from './filterStore';
  import { sessionStore } from './sessionStore';
  import { authFetch } from './authFetch';
  import { trackStore } from './trackStore';
  import { downloadTrack, emailTrack } from './trackExport';
  import FloatingActionButtons from './FloatingActionButtons.svelte';
  import TrackModal from './TrackModal.svelte';
  
  export let images: any[] = [];
  export let userLat: number | null = null;
  export let userLon: number | null = null;
  export let deviceHeading: number | null = null;
  export let isManual3x3Mode: boolean = false;
  
  const dispatch = createEventDispatcher();
  
  let mapEl: HTMLDivElement;
  let map: any;
  let mapInitialized = false;
  let userMarker: any = null;
  let imageMarkers: any[] = [];
  let markerClusterGroup: any = null;
  let trackLayers: any[] = [];
  let currentTrackLayer: any = null;
  let savedZoom = 18; // Default to max zoom
  let savedCenter: [number, number] | null = null;
  let isHybridView = false; // Track current view mode
  let streetLayer: any = null;
  let satelliteLayer: any = null;
  let autoRotateEnabled = false;
  let showDistance = true; // New: Toggle between distance and title display
  let keepMarkerCentered = false; // Default: deaktiviert für freie Erkundung
  let lastPosition: { lat: number; lon: number; accuracy: number; timestamp: number } | null = null;
  let lastPositionTime: number | null = null;
  let currentBearing = 0;
  let watchId: number | null = null;
  let isIOS = false;
  let compassHeading: number | null = null;
  let orientationListener: ((event: DeviceOrientationEvent) => void) | null = null;
  let useCompass = false; // Toggle between GPS and compass mode
  let simulationActive = false; // Track if GPS simulation is active
  let showTracks = false; // Toggle track visibility
  let savedTracks: any[] = [];
  let showTrackModal = false;
  let lastSimulatedPosition: { lat: number; lon: number; timestamp: number } | null = null;
  
  // Previous position for movement tracking
  let previousPosition: { lat: number; lon: number; timestamp: number } | null = null;
  let positionWatchId: number | null = null;
  
  // Import supabase client for loading all images
  import { supabase } from './supabaseClient';
  
  // Internal images array for clustering
  let allImages: any[] = [];
  
  // Use images prop if available
  $: if (images && images.length > 0) {
    console.log('[FullscreenMap] Using images prop:', images.length, 'images');
    allImages = images;
  } else {
    console.log('[FullscreenMap] No images prop available');
    allImages = [];
  }
  
    // Reaktive Zentrierung basierend auf Mobile Mode
  $: if (isManual3x3Mode) {
    // Mobile Mode aktiviert → Automatische Zentrierung aktivieren (wie Navi)
    keepMarkerCentered = true;
    console.log('[FullscreenMap] Mobile Mode aktiviert → Marker-Zentrierung aktiviert');
  } else {
    // Normal Mode → Standard-Einstellung (deaktiviert für freie Erkundung)
    keepMarkerCentered = false;
    console.log('[FullscreenMap] Normal Mode → Marker-Zentrierung deaktiviert (freie Erkundung)');
  }
  
    // Load saved map state from localStorage
  function loadMapState() {
    // Load track visibility state
    if (typeof window !== 'undefined') {
      const savedTrackState = localStorage.getItem('culoca-show-tracks');
      showTracks = savedTrackState === 'true';
    }
    
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
          // keepMarkerCentered wird jetzt reaktiv durch isManual3x3Mode gesteuert
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
        // keepMarkerCentered wird nicht gespeichert - wird reaktiv durch isManual3x3Mode gesteuert
      };
      localStorage.setItem('culoca-map-state', JSON.stringify(state));
      
      // Save track visibility state
      localStorage.setItem('culoca-show-tracks', showTracks.toString());
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

  // Track visualization functions
  function displayTrackOnMap(track: any, map: any) {
    if (!track || !track.points || track.points.length < 2) return;
    
    const coordinates = track.points.map((p: any) => [p.lat, p.lon]);
    
    const trackLine = (window as any).L.polyline(coordinates, {
      color: track.isActive ? '#2196F3' : '#ff6b6b', // Blau für aktive Tracks, rot für beendete
      weight: track.isActive ? 5 : 4, // Dickere Linie für aktive Tracks
      opacity: track.isActive ? 0.9 : 0.8,
      dashArray: track.isActive ? null : '5, 10' // Durchgezogene Linie für aktive Tracks
    }).addTo(map);
    
    // Add start marker
    const startPoint = track.points[0];
    const startMarker = (window as any).L.marker([startPoint.lat, startPoint.lon], {
      icon: (window as any).L.divIcon({ 
        className: 'track-start-marker', 
        html: '🚀',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      })
    }).addTo(map);
    
    // Add end marker if track is finished
    if (track.points.length > 1 && track.endTime) {
      const endPoint = track.points[track.points.length - 1];
      const endMarker = (window as any).L.marker([endPoint.lat, endPoint.lon], {
        icon: (window as any).L.divIcon({ 
          className: 'track-end-marker', 
          html: '🏁',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        })
      }).addTo(map);
      
      // Add popup with track info
      const popupContent = `
        <div class="track-popup">
          <h4>${track.name}</h4>
          <p><strong>Distanz:</strong> ${(track.totalDistance / 1000).toFixed(2)}km</p>
          <p><strong>Dauer:</strong> ${formatDuration(track.totalDuration)}</p>
          <p><strong>Punkte:</strong> ${track.points.length}</p>
        </div>
      `;
      endMarker.bindPopup(popupContent);
    }
    
    trackLayers.push(trackLine);
    return trackLine;
  }

  function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  function toggleTracks() {
    showTracks = !showTracks;
    saveMapState();
    
    if (showTracks) {
      // Load and display all saved tracks
      trackStore.subscribe((state: any) => {
        savedTracks = state.savedTracks;
        savedTracks.forEach(track => {
          displayTrackOnMap(track, map);
        });
      })();
    } else {
      // Remove all track layers
      trackLayers.forEach(layer => {
        if (map && layer) {
          map.removeLayer(layer);
        }
      });
      trackLayers = [];
    }
  }

  function updateCurrentTrack() {
    // Use the store value directly instead of subscribing
    const state: any = get(trackStore);
    console.log('[FullscreenMap] Updating current track:', { 
      hasTrack: !!state.currentTrack, 
      isRecording: state.isRecording,
      pointsCount: state.currentTrack?.points?.length || 0 
    });
    
    if (state.currentTrack && state.isRecording) {
      // Remove previous current track layer
      if (currentTrackLayer && map) {
        map.removeLayer(currentTrackLayer);
      }
      
      // Only display track if it has at least 2 points
      if (state.currentTrack.points && state.currentTrack.points.length >= 2) {
        currentTrackLayer = displayTrackOnMap(state.currentTrack, map);
        console.log('[FullscreenMap] Current track displayed with', state.currentTrack.points.length, 'points');
      } else {
        console.log('[FullscreenMap] Track has less than 2 points, not displaying yet');
      }
    } else if (currentTrackLayer && map) {
      // Remove current track layer if not recording
      map.removeLayer(currentTrackLayer);
      currentTrackLayer = null;
      console.log('[FullscreenMap] Current track removed from map');
    }
  }

  // Filter images based on active filters and privacy
  function getFilteredImages() {
    const currentFilters = get(filterStore);
    const sessionData = get(sessionStore);
    let filteredImages = allImages;
    
    // Apply privacy and user filtering
    if (currentFilters.userFilter) {
      // If user filter is active, show all images from that user (including private)
      filteredImages = filteredImages.filter(img => 
        img.profile_id === currentFilters.userFilter!.userId
      );
    } else {
      // If no user filter, apply privacy filtering based on login status
      if (sessionData.isAuthenticated && sessionData.userId) {
        // For logged in users: show their own images (all) + other users' public images
        filteredImages = filteredImages.filter(img => 
          img.profile_id === sessionData.userId || img.is_private === false || img.is_private === null
        );
      } else {
        // For anonymous users: only show public images
        filteredImages = filteredImages.filter(img => 
          img.is_private === false || img.is_private === null
        );
      }
    }
    
    return filteredImages;
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
    
    // Check if location filter is active - use filter coordinates as initial position
    const initialFilters = get(filterStore);
    const hasInitialLocationFilter = initialFilters.locationFilter !== null;
    
    if (hasInitialLocationFilter) {
      // Use location filter coordinates as initial position
      initialLat = initialFilters.locationFilter!.lat;
      initialLon = initialFilters.locationFilter!.lon;
    } else if (savedCenter && !userLat && !userLon) {
      // Use saved center if available and no user position
      [initialLat, initialLon] = savedCenter;
    } else if (userLat && userLon) {
      // If we have user position, use it
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
    
    // Initialize marker cluster group - optimized for 5000+ objects
    markerClusterGroup = (window as any).L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 80, // Increased from 60 to 80 for better clustering with many objects
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: true,
      zoomToBoundsOnClick: true,
      disableClusteringAtZoom: 18, // Increased from 16 to 18 - keep clustering longer for performance
      iconCreateFunction: function(cluster: any) {
        const count = cluster.getChildCount();
        let className = 'marker-cluster-small';
        if (count > 500) {
          className = 'marker-cluster-large';
        } else if (count > 50) {
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
    
    // Add user marker if position available and no location filter is active
    const currentFilters = get(filterStore);
    const hasLocationFilter = currentFilters.locationFilter !== null;
    
    if (userLat && userLon && !hasLocationFilter) {
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
    
    // Handle map clicks for location selection
    map.on('click', function(e: any) {
      const { lat, lng } = e.latlng;
      console.log(`Map clicked at: ${lat}, ${lng}`);
      
      // Dispatch location selected event
      dispatch('locationSelected', {
        lat: lat,
        lon: lng
      });
      
      // Close the map after selection
      dispatch('close');
    });
    
    mapInitialized = true;
    
    // Load all images for clustering
    loadAllImagesForMap();
  }
  
  function addImageMarkers() {
    const filteredImages = getFilteredImages();
    if (!map || !markerClusterGroup || !filteredImages.length) {
      return;
    }
    
    // Clear existing markers from cluster group
    markerClusterGroup.clearLayers();
    imageMarkers = [];
    
    filteredImages.forEach((image, index) => {
      
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
      
      // Get effective coordinates (location filter overrides GPS)
      const currentFilters = get(filterStore);
      const hasLocationFilter = currentFilters.locationFilter !== null;
      const effectiveLat = hasLocationFilter ? currentFilters.locationFilter!.lat : userLat;
      const effectiveLon = hasLocationFilter ? currentFilters.locationFilter!.lon : userLon;
      
      if (effectiveLat !== null && effectiveLon !== null) {
        if (showDistance) {
          // Show distance from effective position
          const distance = calculateDistance(effectiveLat, effectiveLon, image.lat, image.lon);
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
      
      // Click handler for navigation
      marker.on('click', () => {
        dispatch('imageClick', { imageSlug: image.slug, imageId: image.id });
      });
      
      // Store reference to image data
      marker.image = image;
      imageMarkers.push(marker);
      
      // Add marker to cluster group instead of directly to map
      markerClusterGroup.addLayer(marker);
    });
    
    console.log(`[FullscreenMap] Finished adding ${imageMarkers.length} markers to cluster group`);
  }
  
  function updateUserMarker() {
    const leaflet = (window as any).L;
    if (!leaflet || !map) return;
    
    // Check if location filter is active - hide user marker if so
    const currentFilters = get(filterStore);
    const hasLocationFilter = currentFilters.locationFilter !== null;
    
    if (hasLocationFilter) {
      // Hide user marker when location filter is active
      if (userMarker) {
        map.removeLayer(userMarker);
        userMarker = null;
      }
      return;
    }
    
    // Show user marker when no location filter is active and GPS is available
    if (userLat !== null && userLon !== null) {
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
    } else if (userMarker) {
      // Remove user marker if GPS is not available
      map.removeLayer(userMarker);
      userMarker = null;
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
  
  // Toggle marker centering
  function toggleMarkerCentering() {
    keepMarkerCentered = !keepMarkerCentered;
    console.log(`[FullscreenMap] Marker centering ${keepMarkerCentered ? 'enabled' : 'disabled'}`);
    
    // Sofort auf User-Marker zentrieren wenn aktiviert und GPS verfügbar
    if (keepMarkerCentered && map && userLat !== null && userLon !== null) {
      console.log(`[FullscreenMap] Centering map on user position: ${userLat}, ${userLon}`);
      map.setView([userLat, userLon], map.getZoom(), { animate: true });
    }
    
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
    
    // Subscribe to track store changes for real-time track updates
    const unsubscribe = trackStore.subscribe((state: any) => {
      if (mapInitialized && map) {
        updateCurrentTrack();
      }
    });
    
    // Clean up subscription on component destroy
    return unsubscribe;
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
  
  // Reactive update for filter changes - hide/show user marker and center map
  $: if (mapInitialized && $filterStore) {
    updateUserMarker();
    
    // Center map based on active filters
    if ($filterStore.locationFilter) {
      // Location filter is active - center on filter location
      const { lat, lon } = $filterStore.locationFilter;
      if (map) {
        map.setView([lat, lon], map.getZoom(), { animate: true });
        console.log(`[FullscreenMap] Centered map on location filter: ${lat}, ${lon}`);
      }
    } else if (userLat !== null && userLon !== null) {
      // No location filter but GPS available - center on GPS position
      if (map) {
        map.setView([userLat, userLon], map.getZoom(), { animate: true });
        console.log(`[FullscreenMap] Centered map on GPS position: ${userLat}, ${userLon}`);
      }
    }
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
        
        // Keep the user marker centered on the map during GPS tracking if enabled
        if (map && keepMarkerCentered) {
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
          
          // Keep the user marker centered on the map during GPS simulation if enabled
          if (map && keepMarkerCentered) {
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

  // Removed: loadMapImagesDirectFromDB function - now using images prop only
  
  // Reactive statement to update markers when allImages changes
  $: if (mapInitialized && markerClusterGroup && allImages.length > 0) {
    console.log(`[FullscreenMap] Reactive update: ${allImages.length} images available`);
    addImageMarkers();
  }
  
  // Reactive statement to update current track when trackStore changes
  $: if (mapInitialized && map) {
    updateCurrentTrack();
  }

  async function sendLastTrackEmail() {
    // Sende die letzte gespeicherte Tour per Email (öffnet Mailto-Link mit GPX im Body)
    if (!savedTracks.length) return alert('Keine gespeicherte Tour gefunden!');
    const lastTrack = savedTracks[savedTracks.length - 1];
    const gpx = downloadTrack(lastTrack, 'gpx');
    // Öffne Email-Client mit GPX als Text (Anhänge via mailto sind nicht möglich)
    const subject = encodeURIComponent(`GPS-Track: ${lastTrack.name}`);
    const body = encodeURIComponent('Hier ist dein GPS-Track (GPX):\n\n' + gpx);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  }

  // Load all images for the map using optimized PostGIS function
  async function loadAllImagesForMap() {
    try {
      console.log('[FullscreenMap] Loading all images for map with optimized PostGIS...');
      
      // Get current user for privacy filtering
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id || null;
      
      // Try multiple PostGIS functions and fallback options
      console.log('[FullscreenMap] Calling PostGIS with params:', { userLat, userLon, currentUserId });
      
      let mapImagesData = null;
      let error = null;
      
      // Try the original function first
      try {
        const result = await supabase.rpc('map_images_postgis', {
          user_lat: userLat || 0,
          user_lon: userLon || 0,
          current_user_id: currentUserId
        });
        mapImagesData = result.data;
        error = result.error;
        console.log('[FullscreenMap] Original PostGIS response:', { data: mapImagesData, error });
      } catch (e) {
        console.log('[FullscreenMap] Original PostGIS function failed, trying simple version...');
      }
      
      // If original failed, try simple version
      if (error || !mapImagesData || mapImagesData.length === 0) {
        try {
          const result = await supabase.rpc('map_images_postgis_simple', {
            user_lat: userLat || 0,
            user_lon: userLon || 0,
            current_user_id: currentUserId
          });
          mapImagesData = result.data;
          error = result.error;
          console.log('[FullscreenMap] Simple PostGIS response:', { data: mapImagesData, error });
        } catch (e) {
          console.log('[FullscreenMap] Simple PostGIS function also failed...');
        }
      }
      
      // If both PostGIS functions failed, use direct query
      if (error || !mapImagesData || mapImagesData.length === 0) {
        console.log('[FullscreenMap] PostGIS functions failed, falling back to direct query...');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('items')
          .select('id, slug, path_64, title, lat, lon')
          .not('lat', 'is', null)
          .not('lon', 'is', null)
          .not('path_64', 'is', null)
          .eq('gallery', true)
          .or('is_private.eq.false,is_private.is.null');
        
        console.log('[FullscreenMap] Fallback response:', { data: fallbackData, error: fallbackError });
        
        if (fallbackError) {
          console.error('[FullscreenMap] Fallback query error:', fallbackError);
          return;
        }
        
        // Add distance calculation for fallback data
        const fallbackWithDistance = (fallbackData || []).map(item => ({
          ...item,
          distance: userLat && userLon ? getDistanceInMeters(userLat, userLon, item.lat, item.lon) : 999999999
        }));
        
        allImages = fallbackWithDistance;
      } else {
        console.log('[FullscreenMap] PostGIS loaded', mapImagesData?.length || 0, 'images for map');
        allImages = mapImagesData || [];
      }
      
      // Re-add markers if map is already initialized
      if (mapInitialized && map) {
        addImageMarkers();
      }
      
    } catch (err) {
      console.error('[FullscreenMap] Error in loadAllImagesForMap:', err);
    }
  }
</script>

<div class="fullscreen-map">
  <!-- Map container -->
  <div bind:this={mapEl} class="map-container"></div>
  <!-- Logo (exactly same position as main page) -->
  <img src="/culoca-logo-512px.png" alt="Culoca" class="culoca-logo" />
  <!-- FAB-Leiste -->
  <div class="fab-container">
    <!-- GPS-Track-FABs (oben, exakt wie die anderen FABs) -->
    <button
      class="fab-button track {$trackStore.isRecording ? 'recording' : ''}"
      aria-label={$trackStore.isRecording ? 'Track beenden' : 'Track starten'}
      title={$trackStore.isRecording ? 'Track beenden' : 'Track starten'}
      on:click={$trackStore.isRecording ? trackStore.stopTrack : () => {
        const trackName = prompt('Name für die Tour eingeben:', `Tour ${new Date().toLocaleDateString()}`);
        if (trackName) trackStore.startTrack(trackName);
      }}
    >
      {#if $trackStore.isRecording}
        <!-- Flaggen-Icon (Stop) -->
        <svg class="track-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 22V2"/>
          <path d="M4 4h16l-2 5 2 5H4"/>
        </svg>
      {:else}
        <!-- Raketen-Icon (Start) -->
        <svg class="track-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4.5 16.5L3 21l4.5-1.5"/>
          <path d="M21 3s-6.5 0-13 6.5A8.38 8.38 0 0 0 3 13l8 8a8.38 8.38 0 0 0 6.5-5.5C21 9.5 21 3 21 3z"/>
          <path d="M15 9l-6 6"/>
        </svg>
      {/if}
    </button>
    <button
      class="fab-button track-list"
      aria-label="Track-Übersicht"
      title="Track-Übersicht"
      on:click={() => showTrackModal = true}
    >
      <!-- Clipboard/List-Icon -->
      <svg class="track-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="2" width="6" height="4" rx="1"/>
        <path d="M4 7h16v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z"/>
        <line x1="9" y1="12" x2="15" y2="12"/>
        <line x1="9" y1="16" x2="15" y2="16"/>
      </svg>
    </button>
    <!-- Bestehende Karten-FABs -->
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
    <!-- Marker Centering FAB -->
    <button 
      class="marker-center-fab"
      class:active={keepMarkerCentered}
      on:click={toggleMarkerCentering}
      title={keepMarkerCentered ? 'Marker-Zentrierung deaktivieren' : 'Marker-Zentrierung aktivieren'}
    >
      {#if keepMarkerCentered}
        <!-- Target with dot in center - centering is active -->
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="12" cy="12" r="3" fill="currentColor"/>
        </svg>
      {:else}
        <!-- Target without dot - centering is inactive -->
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
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
        <rect x="15" y="3" width="6" height="6"/>
        <rect x="3" y="15" width="6" height="6"/>
        <rect x="15" y="15" width="6" height="6"/>
      </svg>
    </button>
  </div>
  <TrackModal bind:isOpen={showTrackModal} />
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
  .marker-center-fab,
  .grid-fab,
  .track,
  .track-list {
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
  .marker-center-fab:hover,
  .grid-fab:hover,
  .track:hover,
  .track-list:hover {
    transform: scale(1.1);
    background: rgba(255, 255, 255, 0.1);
  }
  
  .view-toggle-fab:active,
  .display-toggle-fab:active,
  .auto-rotate-fab:active,
  .marker-center-fab:active,
  .grid-fab:active,
  .track:active,
  .track-list:active {
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
    .marker-center-fab,
    .grid-fab,
    .track,
    .track-list {
      width: 3.5rem;
      height: 3.5rem;
    }
    
    .view-toggle-fab svg,
    .display-toggle-fab svg,
    .auto-rotate-fab svg,
    .marker-center-fab svg,
    .grid-fab svg,
    .track svg,
    .track-list svg {
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