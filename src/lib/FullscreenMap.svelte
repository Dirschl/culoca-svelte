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
  import ShareMapModal from './ShareMapModal.svelte';
  import { hasGpsTrackingPermission } from './sessionStore';
  import html2canvas from 'html2canvas';
  
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
  
  // Share functionality
  let shareMapUrl = '';
  let showShareModal = false;
  let shareTitle = 'CULOCA - Map View Share';
  let shareDescription = 'Map View Snippet - CULOCA.com';
  let shareScreenshot: string | null = null;
  
  // Manual coordinate input fallback
  let showManualInput = false;
  let manualLat = '';
  let manualLon = '';
  
  // Previous position for movement tracking
  let previousPosition: { lat: number; lon: number; timestamp: number } | null = null;
  let positionWatchId: number | null = null;
  
  // Import supabase client and PostGIS loader for loading all images
  import { supabase } from './supabaseClient';
  import { loadAllMapImages } from './postgisLoader';
  
  // Internal images array for clustering
  let allImages: any[] = [];
  
  // Always load all images directly from database, ignore images prop
  $: {
    // Load all images when component mounts or when needed
    if (mapInitialized && !allImages.length) {
      loadAllImagesForMap();
    }
  }
  
    // Reaktive Zentrierung basierend auf Mobile Mode
  $: if (isManual3x3Mode) {
    // Mobile Mode aktiviert → Automatische Zentrierung aktivieren (wie Navi)
    keepMarkerCentered = true;
  } else {
    // Normal Mode → Standard-Einstellung (deaktiviert für freie Erkundung)
    keepMarkerCentered = false;
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
    // Track update (debug removed)
    
    if (state.currentTrack && state.isRecording) {
      // Remove previous current track layer
      if (currentTrackLayer && map) {
        map.removeLayer(currentTrackLayer);
      }
      
      // Only display track if it has at least 2 points
      if (state.currentTrack.points && state.currentTrack.points.length >= 2) {
        currentTrackLayer = displayTrackOnMap(state.currentTrack, map);
        // Track displayed (debug removed)
      } else {
        // Track has less than 2 points (debug removed)
      }
    } else if (currentTrackLayer && map) {
      // Remove current track layer if not recording
      map.removeLayer(currentTrackLayer);
      currentTrackLayer = null;
      // Track removed (debug removed)
    }
  }

  // Share map function
  async function shareMapView() {
    if (!map) return;
    
    const center = map.getCenter();
    const zoom = map.getZoom();
    const viewType = isHybridView ? 'hybrid' : 'standard';
    
    // Get current filters
    const currentFilters = get(filterStore);
    const userFilter = currentFilters.userFilter;
    
    // Create shareable URL with map parameters
    const shareUrl = new URL(window.location.href);
    shareUrl.pathname = '/map-view';
    shareUrl.searchParams.set('lat', center.lat.toFixed(6));
    shareUrl.searchParams.set('lon', center.lng.toFixed(6));
    shareUrl.searchParams.set('zoom', zoom.toString());
    shareUrl.searchParams.set('map_type', viewType);
    if (userFilter) {
      shareUrl.searchParams.set('user', userFilter.accountname);
    }
    
    shareMapUrl = shareUrl.toString();
    
    // Capture screenshot
    shareScreenshot = await captureMapScreenshot();
    
    showShareModal = true;
  }

  // Capture map screenshot
  async function captureMapScreenshot() {
    if (!map) return null;
    
    // Wait for all markers to render
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      // Use html2canvas on the map container
      const mapContainer = document.getElementById('map');
      if (!mapContainer) {
        throw new Error('Map container not found');
      }
      
      const canvas = await html2canvas(mapContainer, {
        useCORS: true,
        backgroundColor: null,
        scale: 0.8,
        width: mapContainer.offsetWidth,
        height: mapContainer.offsetHeight
      });
      
      return canvas.toDataURL('image/jpeg', 0.8);
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      return null;
    }
  }

  // Handle modal close
  function handleModalClose() {
    showShareModal = false;
  }
  
  // Handle share button click
  function handleShareClick() {
    shareMapView();
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
      zoomControl: false, // We'll add custom controls
      dragging: true,
      touchZoom: true,
      doubleClickZoom: true,
      scrollWheelZoom: true,
      boxZoom: true,
      keyboard: true,
      tap: true, // Wichtig für iOS!
      tapTolerance: 15, // Erhöht für besseres Touch-Handling auf iOS
      bounceAtZoomLimits: true
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
    
    // iOS-spezifische Touch-Fixes
    if (isIOS && map) {
      // Stelle sicher, dass Leaflet Touch-Handler aktiviert sind
      const mapContainer = map.getContainer();
      mapContainer.style.touchAction = 'pan-x pan-y pinch-zoom';
      mapContainer.style.webkitTouchCallout = 'none';
      mapContainer.style.webkitUserSelect = 'none';
      
      // Force enable touch handlers
      if (map.dragging) {
        map.dragging.enable();
      }
      if (map.touchZoom) {
        map.touchZoom.enable();
      }
      if (map.tap) {
        map.tap.enable();
      }
      
      console.log('[FullscreenMap] iOS touch handlers enabled');
    }
    
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
      // Map clicked (debug removed)
      
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
      
      // Load image for marker
      
      if (imageUrl) {
        // Directly set the background image
        imageEl.style.backgroundImage = `url(${imageUrl})`;
        
        // Add error handling for failed image loads
        const testImg = new Image();
        testImg.onload = () => {
          imageEl.style.backgroundImage = `url(${imageUrl})`;
        };
        testImg.onerror = () => {
          // Image failed to load (debug removed)
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
        // No image path available (debug removed)
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
              // Creating marker (debug removed)
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
    
          // Finished adding markers (debug removed)
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
  
  function toggleManualInput() {
    showManualInput = !showManualInput;
    if (showManualInput && userLat && userLon) {
      // Pre-fill with current position if available
      manualLat = userLat.toFixed(6);
      manualLon = userLon.toFixed(6);
    }
  }
  
  function submitManualCoordinates() {
    const lat = parseFloat(manualLat);
    const lon = parseFloat(manualLon);
    
    // Validate coordinates
    if (isNaN(lat) || isNaN(lon)) {
      alert('Bitte gültige Koordinaten eingeben');
      return;
    }
    
    if (lat < -90 || lat > 90) {
      alert('Breitengrad muss zwischen -90 und 90 liegen');
      return;
    }
    
    if (lon < -180 || lon > 180) {
      alert('Längengrad muss zwischen -180 und 180 liegen');
      return;
    }
    
    // Dispatch location selected event
    dispatch('locationSelected', { lat, lon });
    
    // Close the map
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
      // Map not initialized yet (debug removed)
      return;
    }
    
    // Check if map container is properly initialized
    const mapContainer = map.getContainer();
    if (!mapContainer || !mapContainer._leaflet_pos) {
      // Map container not ready yet (debug removed)
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
    // Device detected (debug removed)
    
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
          // Device orientation permission (debug removed)
          return permission === 'granted';
        }
      } catch (error) {
        // Error requesting device orientation permission (debug removed)
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
          // Compass heading update (debug removed)
          setMapRotation(targetBearing);
        }
        
        useCompass = true;
      }
    };
    
    if (orientationListener) {
      window.addEventListener('deviceorientation', orientationListener);
    }
          // Compass listener setup complete (debug removed)
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
      
      // Compass listener removed (debug removed)
    }
  }

  // Toggle auto-rotation based on movement direction
  function toggleAutoRotate() {
    autoRotateEnabled = !autoRotateEnabled;
    // Auto-rotation status (debug removed)
    
    if (autoRotateEnabled) {
      // Check if simulation is active
      if (simulationActive) {
        // Using GPS simulation for auto-rotation (debug removed)
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
    // Display mode toggled (debug removed)
    // Update all existing markers
    updateMarkerLabels();
    // Save the new state
    saveMapState();
  }
  
  // Toggle marker centering
  function toggleMarkerCentering() {
    keepMarkerCentered = !keepMarkerCentered;
    // Marker centering status (debug removed)
    
    // Sofort auf User-Marker zentrieren wenn aktiviert und GPS verfügbar
    if (keepMarkerCentered && map && userLat !== null && userLon !== null) {
      // Centering map on user position (debug removed)
      map.setView([userLat, userLon], map.getZoom(), { animate: true });
    }
    
    // Save the new state
    saveMapState();
  }
  
  // Update marker labels based on current display mode
  function updateMarkerLabels() {
    if (!map || !mapInitialized || !allImages.length) return;
    
    // Updating marker labels (debug removed)
    
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
    
    // Load all images for map after map is initialized
    setTimeout(() => {
      if (mapInitialized) {
        // Loading all images for map (debug removed)
        loadAllImagesForMap();
      }
    }, 1000); // Wait for map to be fully initialized
    
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
          // Reactive update triggered (debug removed)
    const leaflet = (window as any).L;
    if (leaflet) {
              // Leaflet available, calling addImageMarkers (debug removed)
      addImageMarkers();
    } else {
              // Leaflet not available yet (debug removed)
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
        // Centered map on location filter (debug removed)
      }
    } else if (userLat !== null && userLon !== null) {
      // No location filter but GPS available - center on GPS position
      if (map) {
        map.setView([userLat, userLon], map.getZoom(), { animate: true });
        // Centered map on GPS position (debug removed)
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
          // Ignoring real GPS - simulation active (debug removed)
          return;
        }
        
        // Check if map is ready before processing GPS updates
        if (!map || !mapInitialized) {
          // GPS update ignored - map not ready (debug removed)
          return;
        }
        
        const newPos = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: Date.now()
        };
        
        // GPS position update (debug removed)
        
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
          // Using device heading (debug removed)
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
          // Received GPS simulation data (debug removed)
          simulationActive = true;
          
          // Check if map is ready before processing simulation updates
          if (!map || !mapInitialized) {
            // Simulation update ignored - map not ready (debug removed)
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
            // Simulation movement check (debug removed)
            if (distanceMeters >= minDistance && timeDiff >= minTime) {
              const bearing = calculateBearing(
                lastSimulatedPosition.lat, lastSimulatedPosition.lon,
                newPos.lat, newPos.lon
              );
              // Simulated bearing (debug removed)
              const targetBearing = -bearing; // Negative because we want the heading to point up
              setMapRotation(targetBearing);
              currentBearing = bearing;
            }
          }
          
          lastSimulatedPosition = newPos;
          
        } else if (event.data && event.data.type === 'gps-simulation-stop') {
          // GPS simulation stopped (debug removed)
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
    // Reactive update (debug removed)
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

  // Load all images for the map using robust PostGIS pagination
  async function loadAllImagesForMap() {
    try {
      // Loading all images for map (debug removed)
      
      // Get current user for privacy filtering
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id || null;
      
      // Get current filters for PostGIS function
      const currentFilters = get(filterStore);
      
      // Prepare filter parameters
      const userFilterId = currentFilters.userFilter?.userId || null;
      const locationFilterLat = currentFilters.locationFilter?.lat || null;
      const locationFilterLon = currentFilters.locationFilter?.lon || null;
      
      // Filter parameters (debug removed)
      
      // Use the robust PostGIS loader with pagination
      const mapImagesData = await loadAllMapImages(
        userLat,
        userLon,
        currentUserId,
        userFilterId,
        locationFilterLat,
        locationFilterLon
      );
      
      if (!mapImagesData || mapImagesData.length === 0) {
        // No images loaded from PostGIS functions (debug removed)
        return;
      }
      
              // PostGIS loaded images (debug removed)
      allImages = mapImagesData;
      
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
  <div bind:this={mapEl} class="map-container" id="map"></div>
  <!-- Logo (exactly same position as main page) -->
  <img src="/culoca-logo-512px.png" alt="Culoca" class="culoca-logo" />
  <!-- FAB-Leiste -->
  <div class="fab-container">
    <!-- GPS-Track-FABs (oben, exakt wie die anderen FABs) -->
    {#if $hasGpsTrackingPermission}
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
    {/if}
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
    <!-- Share FAB -->
    <button 
      class="share-fab"
      on:click={shareMapView}
      title="Kartenausschnitt teilen"
    >
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
        <polyline points="16,6 12,2 8,6"/>
        <line x1="12" y1="2" x2="12" y2="15"/>
      </svg>
    </button>
    <!-- Manual Input FAB -->
    <button 
      class="manual-input-fab"
      on:click={toggleManualInput}
      title="Koordinaten manuell eingeben"
    >
      <!-- Edit/Input Icon -->
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
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
  
  <!-- Manual Coordinate Input Overlay -->
  {#if showManualInput}
    <div class="manual-input-overlay">
      <div class="manual-input-panel">
        <h3>Koordinaten manuell eingeben</h3>
        <p class="manual-input-hint">Geben Sie GPS-Koordinaten im Dezimalformat ein</p>
        
        <div class="input-group">
          <label for="manual-lat">Breitengrad (Latitude)</label>
          <input
            id="manual-lat"
            type="number"
            step="0.000001"
            min="-90"
            max="90"
            bind:value={manualLat}
            placeholder="z.B. 52.520008"
          />
        </div>
        
        <div class="input-group">
          <label for="manual-lon">Längengrad (Longitude)</label>
          <input
            id="manual-lon"
            type="number"
            step="0.000001"
            min="-180"
            max="180"
            bind:value={manualLon}
            placeholder="z.B. 13.404954"
          />
        </div>
        
        <div class="button-group">
          <button class="btn-cancel" on:click={toggleManualInput}>Abbrechen</button>
          <button class="btn-submit" on:click={submitManualCoordinates}>Übernehmen</button>
        </div>
      </div>
    </div>
  {/if}
  <TrackModal bind:isOpen={showTrackModal} />
  <ShareMapModal 
    bind:showModal={showShareModal}
    bind:shareUrl={shareMapUrl}
    bind:shareTitle
    bind:shareDescription
    bind:screenshot={shareScreenshot}
    on:close={handleModalClose}
  />
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
    /* iOS Touch-Fixes */
    -webkit-user-select: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    touch-action: pan-x pan-y pinch-zoom;
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
  .share-fab,
  .manual-input-fab,
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
  .share-fab:hover,
  .manual-input-fab:hover,
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
  .manual-input-fab:active,
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
    .manual-input-fab,
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
    .manual-input-fab svg,
    .grid-fab svg,
    .track svg,
    .track-list svg {
      width: 36px;
      height: 36px;
    }
  }
  
  /* Manual Input Overlay Styles */
  .manual-input-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10002;
    padding: 1rem;
  }
  
  .manual-input-panel {
    background: var(--bg-secondary);
    border-radius: 16px;
    padding: 2rem;
    max-width: 500px;
    width: 100%;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }
  
  .manual-input-panel h3 {
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
    font-size: 1.5rem;
  }
  
  .manual-input-hint {
    color: var(--text-secondary);
    font-size: 0.9rem;
    margin: 0 0 1.5rem 0;
  }
  
  .input-group {
    margin-bottom: 1.5rem;
  }
  
  .input-group label {
    display: block;
    color: var(--text-primary);
    font-weight: 600;
    margin-bottom: 0.5rem;
    font-size: 0.95rem;
  }
  
  .input-group input {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 2px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 1rem;
    transition: border-color 0.2s ease;
  }
  
  .input-group input:focus {
    outline: none;
    border-color: #ee7221;
  }
  
  .input-group input::placeholder {
    color: var(--text-secondary);
    opacity: 0.6;
  }
  
  .button-group {
    display: flex;
    gap: 1rem;
    margin-top: 2rem;
  }
  
  .btn-cancel,
  .btn-submit {
    flex: 1;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .btn-cancel {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }
  
  .btn-cancel:hover {
    background: var(--bg-primary);
  }
  
  .btn-submit {
    background: #ee7221;
    color: white;
  }
  
  .btn-submit:hover {
    background: #d66419;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(238, 114, 33, 0.3);
  }
  
  .btn-submit:active {
    transform: translateY(0);
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