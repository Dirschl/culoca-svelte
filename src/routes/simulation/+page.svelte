<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { writable, get } from 'svelte/store';
  import GalleryLayout from '$lib/GalleryLayout.svelte';
  import NewsFlash from '$lib/NewsFlash.svelte';
  import { darkMode } from '$lib/darkMode';
  import FloatingActionButtons from '$lib/FloatingActionButtons.svelte';

  // Simulation state
  let simulationActive = false;
  let simulatedLat: number = 52.5200; // Default, will be updated when images are loaded
  let simulatedLon: number = 13.4050; // Default, will be updated when images are loaded
  let gpsUpdateInterval: number | null = null;
  let mapEl: HTMLDivElement;
  let map: any;
  let mapMarkers: any[] = [];
  let allImages: any[] = [];
  let totalImages = 0;
  let imagesWithGPS = 0;
  let imagesWithoutGPS = 0;
  let imagesWithIncompleteData = 0;
  let duplicateCount = 0;
  let loading = true;
  let searchQuery = '';
  let searchResults: any[] = [];

  // App state (right side)
  const pics = writable<any[]>([]);
  let useJustifiedLayout = true;
  let showDistance = true;
  let showCompass = false;
  let autoguide = false;
  let newsFlashMode: 'aus' | 'eigene' | 'alle' = 'alle';
  let userLat: number | null = null;
  let userLon: number | null = null;
  let deviceHeading: number | null = null;
  let isLoggedIn = true; // Always true in simulation
  let currentUser: any = { id: 'simulation-user' };

  // Map state
  let mapInitialized = false;
  let userMarker: any = null;
  let userHasSetZoom = false; // Verhindert automatische Zoom-Anpassung nach User-Interaktion

  let showNoGPSList = false;
  let showIncompleteList = false;

  // Store lists for quick access from details sections
  let noGpsImagesList: any[] = [];
  let incompleteImagesList: any[] = [];
  let showWithoutGpsList = false;
  
  // Dynamic loading tracking
  let dynamicLoader: any = null;
  let lastLoadCheckPosition: { lat: number; lon: number } | null = null;
  let loadCheckInterval: number | null = null;

  onMount(async () => {
    await loadAllImages();
    initializeMap();
    startSimulation();
    
    // Center map on user's position if available
    if (userLat && userLon && map) {
      map.setView([userLat, userLon], 13);
      console.log(`🗺️ Centered simulation map on user position: ${userLat}, ${userLon}`);
    }
    setupKeyboardNavigation();
    
    // Initialize GPS simulation immediately
    updateURLHash(simulatedLat, simulatedLon, true);
    
    // Send initial GPS data to iframe after a short delay to ensure it's loaded
    setTimeout(() => {
      const iframe = document.querySelector('.app-iframe') as HTMLIFrameElement;
      if (iframe && iframe.contentWindow) {
        console.log('Sending initial GPS data to iframe:', { lat: simulatedLat, lon: simulatedLon });
        iframe.contentWindow.postMessage({
          type: 'gps-simulation',
          lat: simulatedLat,
          lon: simulatedLon
        }, '*');
      }
    }, 1000);
  });

  onDestroy(() => {
    if (map) {
      map.remove();
    }
    
    // Stop continuous GPS updates
    stopContinuousGPSUpdates();
    
    // Stop position monitoring
    if (loadCheckInterval) {
      clearInterval(loadCheckInterval);
    }
  });

  // Start position monitoring for dynamic loading
  function startPositionMonitoring() {
    // Monitor position changes and dynamically load images
    setInterval(async () => {
      const currentPos = { lat: simulatedLat, lon: simulatedLon };
      
      // Skip if position hasn't changed significantly
      if (lastLoadCheckPosition && 
          Math.abs(currentPos.lat - lastLoadCheckPosition.lat) < 0.001 &&
          Math.abs(currentPos.lon - lastLoadCheckPosition.lon) < 0.001) {
        return;
      }
      
      lastLoadCheckPosition = { ...currentPos };
      
      const isInCenter = dynamicLoader.isInCenterCell(currentPos.lat, currentPos.lon);
      if (!isInCenter) {
        // Load new images from dynamic loader
        const newImages = await dynamicLoader.loadImagesForPosition(currentPos.lat, currentPos.lon);
        
        // Update allImages with the new data from dynamic loader
        allImages = newImages;
        
        console.log(`🗺️ Updated allImages with ${newImages.length} images from dynamic loader`);
      }
      
      // Update image counts
      const imagesWithGPSData = allImages.filter((img: any) => img.lat && img.lon);
      const imagesWithoutGPSData = allImages.filter((img: any) => !img.lat || !img.lon);
      imagesWithGPS = imagesWithGPSData.length;
      imagesWithoutGPS = imagesWithoutGPSData.length;
      
      // Update map markers and grid overlay if map is initialized
      if (mapInitialized && map) {
        console.log(`🗺️ Updating map markers and grid overlay with ${imagesWithGPS} images with GPS`);
        // Force a small delay to ensure DOM is ready
        setTimeout(() => {
          addImageMarkers();
        }, 100);
      }
      
      // Update gallery
      updateGalleryWithNewImages(allImages);
      
      console.log(`📊 Dynamic load complete: ${allImages.length} total images (${imagesWithGPS} with GPS)`);
    }, 2000) as any; // Check every 2 seconds
  }

  function updateGalleryWithNewImages(newImages: any[]) {
    // Update pics store with current nearby images based on simulation position
    const nearbyImages = newImages
      .filter((img: any) => img.lat && img.lon)
      .map((img: any) => {
        const distance = getDistanceInMeters(simulatedLat, simulatedLon, img.lat, img.lon);
        return {
          ...img,
          distance: distance,
          src: img.path_512 ? `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${img.path_512}` : '',
          srcHD: img.path_2048 ? `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${img.path_2048}` : ''
        };
      })
      .sort((a: any, b: any) => a.distance - b.distance)
              // Kein Limit - alle Bilder
    
    pics.set(nearbyImages);
  }

  function updateMapMarkers() {
    // Use the new addImageMarkers function instead
    addImageMarkers();
  }



  // Direct database query for simulation images with batch loading (bypasses all API limitations)
  async function loadSimulationImagesDirectFromDB(): Promise<any[]> {
    try {
      console.log('[Simulation DirectDB] Loading simulation images with batch loading...');
      
      // Get current session to determine privacy filtering
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id || null;
      
      // Batch loading to get more than 1000 items
      const batchSize = Infinity; // Kein Limit - alle Bilder
      let allImages = [];
      let hasMore = true;
      let offset = 0;
      const maxBatches = 10; // Load up to 10,000 images
      
      while (hasMore && allImages.length < maxBatches * batchSize) {
        console.log(`[Simulation DirectDB] Loading batch ${Math.floor(offset/batchSize) + 1}, offset: ${offset}`);
        
        let query = supabase
          .from('items')
          .select('id, lat, lon, path_512, path_2048, path_64, title, description, width, height, is_private, profile_id, keywords, original_name')
          .not('path_512', 'is', null)
          .eq('gallery', true) // Only show images with gallery = true
          .range(offset, offset + batchSize - 1);
        
        // Apply privacy filtering
        if (currentUserId) {
          // For logged in users: show their own images (all) + other users' public images
          query = query.or(`profile_id.eq.${currentUserId},is_private.eq.false,is_private.is.null`);
        } else {
          // For anonymous users: only show public images
          query = query.or('is_private.eq.false,is_private.is.null');
        }
        
        const { data, error } = await query;
        
        if (error) {
          console.error('[Simulation DirectDB] Database error:', error);
          break;
        }
        
        if (data && data.length > 0) {
          allImages.push(...data);
          console.log(`[Simulation DirectDB] Batch ${Math.floor(offset/batchSize) + 1}: loaded ${data.length} images, total: ${allImages.length}`);
          
          // Continue if we got a full batch
          hasMore = data.length === batchSize;
          offset += batchSize;
        } else {
          hasMore = false;
        }
      }
      
      const images = allImages.map(item => ({
        ...item,
        // Ensure we have proper types and default values
        lat: item.lat || null,
        lon: item.lon || null,
        path_512: item.path_512!,
        path_64: item.path_64 || item.path_512, // Fallback to 512 if 64 not available
        keywords: item.keywords || [],
        title: item.title || item.original_name || 'Untitled',
        description: item.description || ''
      }));
      
      console.log(`[Simulation DirectDB] Successfully loaded ${images.length} images via batch loading`);
      return images;
      
    } catch (error) {
      console.error('[Simulation DirectDB] Error:', error);
      return [];
    }
  }

  async function loadAllImages() {
    try {
      // Use dynamic loader for intelligent position-based loading
      const { dynamicImageLoader } = await import('$lib/dynamicImageLoader');
      dynamicLoader = dynamicImageLoader; // Store reference for later use
      
      // Try to get user's current GPS position, fallback to Germany center
      let startLat = 48.1351; // Germany center fallback
      let startLon = 11.5820; // Germany center fallback
      
      try {
        // Check if we can get user's current position
        if (navigator.geolocation) {
          console.log('🌍 Attempting to get user GPS position for simulation...');
          
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => resolve(pos),
              (error) => reject(error),
              { 
                enableHighAccuracy: true, 
                timeout: 5000, // 5 second timeout
                maximumAge: 300000 // Accept position up to 5 minutes old
              }
            );
          });
          
          startLat = position.coords.latitude;
          startLon = position.coords.longitude;
          
          console.log(`📍 Using user GPS position: ${startLat}, ${startLon}`);
          
          // Update simulation position to match user's actual location
          simulatedLat = startLat;
          simulatedLon = startLon;
          
          // Also update user position variables for map centering
          userLat = startLat;
          userLon = startLon;
          
        } else {
          console.log('📍 Geolocation not supported, using Germany center fallback');
        }
      } catch (error) {
        console.log('📍 GPS position unavailable, using Germany center fallback:', error);
      }
      
      // Use the new grid-based loading logic with even smaller radius for better performance
      // This will only load nearby cells initially, not 1000 images at once
      const allData = await dynamicImageLoader.loadImagesForPosition(startLat, startLon); // Grid-based loading
      console.log(`🗺️ Simulation loaded ${allData.length} images via Grid-based DynamicLoader from position ${startLat}, ${startLon}`);
      
      // Start position monitoring for dynamic loading
      startPositionMonitoring();
      
      // Debug: Check for actual duplicates
      const allIds = allData.map(img => img.id);
      const uniqueIds = [...new Set(allIds)];
      console.log(`🔍 Image ID analysis: ${allIds.length} total, ${uniqueIds.length} unique IDs, ${allIds.length - uniqueIds.length} actual duplicates`);

      totalImages = allData?.length || 0;

      // Filter for images with GPS data
      const imagesWithGPSData = allData?.filter((img: any) => img.lat && img.lon) || [];
      const imagesWithoutGPSData = allData?.filter((img: any) => !img.lat || !img.lon) || [];

      imagesWithGPS = imagesWithGPSData.length;
      imagesWithoutGPS = imagesWithoutGPSData.length;

      console.log(`Total images in database: ${totalImages}`);
      console.log(`Images with GPS data: ${imagesWithGPS}`);
      console.log(`Images without GPS data: ${imagesWithoutGPS}`);
      
      // Debug: Log specific image if it exists
      const specificImage = allData?.find((img: any) => img.id === '2c6407f6-1ca5-4e82-afb1-0e0fe37db0ea');
      if (specificImage) {
        console.log('🔍 Found specific image:', {
          id: specificImage.id,
          lat: specificImage.lat,
          lon: specificImage.lon,
          path_64: specificImage.path_64,
          path_512: specificImage.path_512,
          title: specificImage.title
        });
        
        // Check if it has GPS data
        if (specificImage.lat && specificImage.lon) {
          console.log('✅ Specific image has GPS data');
        } else {
          console.log('❌ Specific image has NO GPS data');
        }
      } else {
        console.log('❌ Specific image not found in database');
      }

      // Apply duplicate filtering to match the gallery behavior
      const uniqueImages = allData?.filter((img, index, self) => 
        index === self.findIndex(p => p.id === img.id)
      ) || [];
      
      duplicateCount = (allData?.length || 0) - uniqueImages.length;
      console.log(`🔧 Applied duplicate filtering: ${allData?.length || 0} -> ${uniqueImages.length} unique images (${duplicateCount} duplicates removed)`);
      
      allImages = uniqueImages;
      
      // Calculate statistics based on unique images
      totalImages = uniqueImages.length;
      const gpsImages = uniqueImages.filter(img => img.lat && img.lon);
      const noGpsImages = uniqueImages.filter(img => !img.lat || !img.lon);
      const incompleteImages = uniqueImages.filter(img => 
        !img.title || 
        !img.description || 
        !img.keywords || 
        (Array.isArray(img.keywords) && img.keywords.length === 0) ||
        !img.path_2048 || // Fehlende 2048px Version
        !img.path_512   // Fehlende 512px Version
      );

      // Debug: Check keywords for first few images
      console.log('🔍 Keywords debug - first 5 images:');
      uniqueImages.slice(0, 5).forEach((img, index) => {
        console.log(`  Image ${index + 1}:`, {
          id: img.id,
          keywords: img.keywords,
          keywordsType: typeof img.keywords,
          keywordsLength: Array.isArray(img.keywords) ? img.keywords.length : 'not array'
        });
      });

      imagesWithGPS = gpsImages.length;
      imagesWithoutGPS = noGpsImages.length;
      imagesWithIncompleteData = incompleteImages.length;

      // Save lists for displaying in details sections
      noGpsImagesList = noGpsImages;
      incompleteImagesList = incompleteImages;

      console.log(`📊 Statistics (after duplicate filtering):`);
      console.log(`  Total unique images: ${totalImages}`);
      console.log(`  With GPS: ${imagesWithGPS}`);
      console.log(`  Without GPS: ${imagesWithoutGPS}`);
      console.log(`  With incomplete data: ${imagesWithIncompleteData}`);
      
      // Filter for GPS images for map display (from unique images)
      const imagesWithGPSForMap = uniqueImages.filter(img => img.lat && img.lon);
      console.log(`📊 Map will show ${imagesWithGPSForMap.length} unique images with GPS data`);

      // Set default position to center of all images with GPS
      if (allImages.length > 0) {
        const lats = allImages.map(img => img.lat).filter(lat => lat !== null);
        const lons = allImages.map(img => img.lon).filter(lon => lon !== null);
        
        if (lats.length > 0 && lons.length > 0) {
          const avgLat = lats.reduce((sum, lat) => sum + lat, 0) / lats.length;
          const avgLon = lons.reduce((sum, lon) => sum + lon, 0) / lons.length;
          
          simulatedLat = avgLat;
          simulatedLon = avgLon;
          
          console.log(`Set default position to center of images: ${avgLat.toFixed(6)}, ${avgLon.toFixed(6)}`);
        }
      }

      // Update pics store for right side (only images with GPS)
      const picsWithUrls = allImages.map(img => ({
        id: img.id,
        src: `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${img.path_512}`,
        srcHD: `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${img.path_2048}`,
        width: img.width,
        height: img.height,
        lat: img.lat,
        lon: img.lon,
        title: img.title,
        description: img.description,
        keywords: img.keywords
      }));

      pics.set(picsWithUrls);
      
      // Listen for messages from iframe to get latest image data
      window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'gallery-data') {
          console.log('📊 Received gallery data from iframe:', event.data.images);
          // Update pics store with data from iframe
          pics.set(event.data.images || []);
        }
      });
      
      // Request gallery data from iframe after it loads
      setTimeout(() => {
        const iframe = document.querySelector('.app-iframe') as HTMLIFrameElement;
        if (iframe && iframe.contentWindow) {
          console.log('📤 Requesting gallery data from iframe...');
          iframe.contentWindow.postMessage({
            type: 'request-gallery-data'
          }, '*');
        }
      }, 2000);
      loading = false;
    } catch (error) {
      console.error('Error loading images:', error);
      loading = false;
    }
  }

  function initializeMap() {
    if (!mapEl || mapInitialized) return;

    // Load Leaflet CSS if not already loaded
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Load Leaflet JS if not already loaded
    if (typeof L === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => {
        createMap();
      };
      document.head.appendChild(script);
    } else {
      createMap();
    }
  }

  function createMap() {
    if (!mapEl || mapInitialized) return;

    const initialLat = userLat ?? simulatedLat;
    const initialLon = userLon ?? simulatedLon;

    // Use user's current position if available to avoid initial flicker
    // @ts-ignore
    map = L.map(mapEl).setView([initialLat, initialLon], 13);

    // @ts-ignore
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Add user marker (draggable and in front)
    // @ts-ignore
    userMarker = L.marker([initialLat, initialLon], {
      draggable: true,
      zIndexOffset: 1000, // Keep in front
      // @ts-ignore
      icon: L.divIcon({
        className: 'user-marker',
        html: '<div style="background: #ff5252; width: 24px; height: 24px; border-radius: 50%; border: 4px solid white; box-shadow: 0 3px 8px rgba(0,0,0,0.5); cursor: grab;"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      })
    }).addTo(map);

    // Handle user marker drag events
    userMarker.on('dragstart', () => {
      userMarker.getElement().style.cursor = 'grabbing';
    });

    userMarker.on('drag', (e) => {
      const newLat = e.target.getLatLng().lat;
      const newLon = e.target.getLatLng().lng;
      
      // Update position during drag
      updateSimulatedPositionDirect(newLat, newLon);
    });

    userMarker.on('dragend', (e) => {
      userMarker.getElement().style.cursor = 'grab';
      const newLat = e.target.getLatLng().lat;
      const newLon = e.target.getLatLng().lng;
      
      // Update position directly without iframe communication
      updateSimulatedPositionDirect(newLat, newLon);
    });

    // Add image markers and grid overlay
    addImageMarkers();

    // Add map click handler to move user position
    map.on('click', (e: any) => {
      const newLat = e.latlng.lat;
      const newLon = e.latlng.lng;
      
      console.log(`🗺️ Map clicked at: ${newLat}, ${newLon}`);
      
      // Mark that user has interacted with the map
      userHasSetZoom = true;
      
      // Update user marker position
      if (userMarker) {
        userMarker.setLatLng([newLat, newLon]);
      }
      
      // Update simulation position
      updateSimulatedPosition(newLat, newLon);
    });

    // Mark user interaction when they zoom or pan
    map.on('zoomend', () => {
      userHasSetZoom = true;
      console.log('User zoomed - preventing automatic zoom adjustments');
    });

    map.on('moveend', () => {
      userHasSetZoom = true;
      console.log('User panned - preventing automatic zoom adjustments');
    });

    mapInitialized = true;
  }

  function addImageMarkers() {
    if (!map || !allImages) {
      console.log(`🗺️ addImageMarkers: map=${!!map}, allImages=${!!allImages}`);
      return;
    }
    
    // Clear existing image markers and grid overlays
    let clearedCount = 0;
    map.eachLayer((layer: any) => {
      if (layer.options && (layer.options.isImageMarker || layer.options.isGridOverlay)) {
        map.removeLayer(layer);
        clearedCount++;
      }
    });
    console.log(`🗺️ Cleared ${clearedCount} existing markers and grid overlays`);
    
    // Add grid visualization
    addGridOverlay();
    
    // Filter images to only those in the current 3x3 grid
    let imagesWithGPS = allImages.filter(img => img.lat && img.lon);
    if (dynamicLoader && simulatedLat && simulatedLon) {
      const currentGrid = dynamicLoader.latLonToGrid(simulatedLat, simulatedLon);
      const requiredCells = dynamicLoader.getRequiredCells(currentGrid);
      const requiredCellKeys = new Set(requiredCells.map(cell => `${cell.x},${cell.y}`));
      imagesWithGPS = imagesWithGPS.filter(img => {
        const grid = dynamicLoader.latLonToGrid(img.lat, img.lon);
        return requiredCellKeys.has(`${grid.x},${grid.y}`);
      });
    }
    console.log(`🗺️ Creating ${imagesWithGPS.length} individual map markers (no clustering, only current 3x3 grid)`);
    
    imagesWithGPS.forEach(img => {
      console.log(`📍 Adding individual marker for image ${img.id}:`, {
        lat: img.lat,
        lon: img.lon,
        path_64: img.path_64,
        path_512: img.path_512,
        title: img.title
      });
          
      // @ts-ignore
      const marker = L.marker([img.lat, img.lon], {
        isImageMarker: true, // Flag to identify image markers
        // @ts-ignore
        icon: L.divIcon({
          className: 'image-marker',
          html: `<div style="position: relative; width: 48px; height: 48px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); cursor: pointer; overflow: hidden; background: #f0f0f0; display: flex; align-items: center; justify-content: center;" title="${img.title || 'Bild'}">
            <img src="https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-64/${img.path_64}" 
                 style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" 
                 alt="${img.title || 'Bild'}"
                 onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\'background: #4CAF50; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px;\'>📷</div>'">
            <div style="position: absolute; bottom: -20px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; white-space: nowrap; max-width: 120px; overflow: hidden; text-overflow: ellipsis; z-index: 1000;">${img.title || 'Bild'}</div>
          </div>`,
          iconSize: [48, 48],
          iconAnchor: [24, 24]
        })
      });

      marker.on('click', () => {
        // Navigate to image detail page with anchor parameter
        const url = new URL(`/item/${img.slug}`, window.location.origin);
        window.open(url.toString(), '_blank');
      });

      marker.addTo(map);
    });
    
    // Fit map to show all markers if we have any (nur beim ersten Laden)
    if (imagesWithGPS.length > 0 && !userHasSetZoom) {
      // Create a feature group with all image markers
      // @ts-ignore
      const group = new L.featureGroup();
      
      // Add all image markers to the group
      map.eachLayer((layer: any) => {
        if (layer.options && layer.options.isImageMarker) {
          group.addLayer(layer);
        }
      });
      
      if (group.getLayers().length > 0) {
        map.fitBounds(group.getBounds().pad(0.1));
        console.log('Map fitted to show all individual image markers (first load only)');
      }
    }
  }

  function updateSimulatedPosition(lat: number, lon: number) {
    // Only update if position actually changed significantly
    const distanceChange = simulatedLat && simulatedLon ? 
      Math.abs(lat - simulatedLat) + Math.abs(lon - simulatedLon) : 1;
    
    if (distanceChange < 0.0005) { // Less than ~50m change
      return;
    }
    
    simulatedLat = lat;
    simulatedLon = lon;
    
    // Update user marker
    if (userMarker) {
      userMarker.setLatLng([lat, lon]);
    }

    // Update app state
    userLat = lat;
    userLon = lon;

    // Check if we need to update the grid (center cell changed)
    if (dynamicLoader && !dynamicLoader.isInCenterCell(lat, lon)) {
      console.log(`🗺️ Position ${lat},${lon} is outside center cell - triggering grid update`);
      
      // Update grid overlay if map is initialized
      if (mapInitialized && map) {
        setTimeout(() => {
          addGridOverlay();
        }, 100);
      }
    }
    
    // Update URL hash for iframe communication
    updateURLHash(lat, lon, simulationActive);
  }

  function updateSimulatedPositionDirect(lat: number, lon: number) {
    // Direct updates (buttons, search) always work
    simulatedLat = lat;
    simulatedLon = lon;
    
    // Update user marker
    if (userMarker) {
      userMarker.setLatLng([lat, lon]);
    }

    // Update app state
    userLat = lat;
    userLon = lon;

    // Update URL hash for iframe communication
    updateURLHash(lat, lon, simulationActive);
  }

  function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = (lat2-lat1) * Math.PI/180;
    const dLon = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c);
  }

  function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number): string {
    const meters = getDistanceInMeters(lat1, lon1, lat2, lon2);
    if (meters >= 1000) {
      return (meters / 1000).toFixed(1).replace('.', ',') + 'km';
    } else {
      return meters + 'm';
    }
  }

  // Grid visualization functions
  function addGridOverlay() {
    if (!map || !dynamicLoader) return;
    
    // Get current position and convert to grid coordinates
    const currentGrid = dynamicLoader.latLonToGrid(simulatedLat, simulatedLon);
    const requiredCells = dynamicLoader.getRequiredCells(currentGrid);
    const currentCenterCell = dynamicLoader.getCurrentCenterCell();
    
    console.log(`🗺️ Drawing 3x3 overlay for center: ${currentGrid.x},${currentGrid.y}`);
    console.log(`🗺️ Current center cell: ${currentCenterCell?.x},${currentCenterCell?.y}`);
    console.log(`🗺️ Required cells:`, requiredCells);
    
    // Draw each cell
    requiredCells.forEach((cell, index) => {
      const cellCenter = dynamicLoader.gridToLatLon(cell.x, cell.y);
      const isLoaded = dynamicLoader.isCellLoaded(cell.x, cell.y);
      const isCenter = currentCenterCell && cell.x === currentCenterCell.x && cell.y === currentCenterCell.y;
      
      // Calculate cell boundaries (1010)
      const cellSizeDeg = 10 / 111.0; // 10km in degrees
      const halfCell = cellSizeDeg / 2;
      
      const bounds = [
        [cellCenter.lat - halfCell, cellCenter.lon - halfCell],
        [cellCenter.lat + halfCell, cellCenter.lon + halfCell]
      ];
      
      // Determine cell color based on status
      let color = '#ff0000'; // Red = not loaded
      let weight = 2;
      let opacity = 0.3;
      
      if (isLoaded) {
        if (isCenter) {
          color = '#6666ff'; // Blue = center cell
          opacity = 0.6;
          weight = 3;
        } else {
          color = '#00ff00'; // Green = loaded outer cells
          opacity = 0.4;
        }
      }
      
      // Create rectangle for cell
      // @ts-ignore
      const rect = L.rectangle(bounds, {
        color: color,
        weight: weight,
        fillOpacity: opacity,
        isGridOverlay: true
      });
      
      // Add tooltip with cell info
      const tooltipText = `
        <strong>Cell ${cell.x},${cell.y}</strong><br>
        Status: ${isLoaded ? (isCenter ? 'Center (Blue)' : 'Loaded (Green)') : 'Not Loaded (Red)'}<br>
        Center: ${cellCenter.lat.toFixed(4)}, ${cellCenter.lon.toFixed(4)}<br>
        ${isCenter ? '🎯 Current Position' : ''}
      `;
      
      rect.bindTooltip(tooltipText, {
        permanent: false,
        direction: 'top'
      });
      rect.addTo(map);
    });
  }

  function startSimulation() {
    simulationActive = true;
    userLat = simulatedLat;
    userLon = simulatedLon;
    updateURLHash(simulatedLat, simulatedLon, true);
    
    // Immediately send GPS data to iframe
    const iframe = document.querySelector('.app-iframe') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      console.log('Sending initial GPS data to iframe:', { lat: simulatedLat, lon: simulatedLon });
      iframe.contentWindow.postMessage({
        type: 'gps-simulation',
        lat: simulatedLat,
        lon: simulatedLon
      }, '*');
    }
    
    // Start continuous GPS updates every second
    startContinuousGPSUpdates();
    
    console.log('Simulation started with coordinates:', { lat: simulatedLat, lon: simulatedLon });
  }
  
  function startContinuousGPSUpdates() {
    // Clear any existing interval
    if (gpsUpdateInterval) {
      clearInterval(gpsUpdateInterval);
    }
    
    // Send GPS data every 3 seconds (less frequent to avoid excessive updates)
    gpsUpdateInterval = setInterval(() => {
      if (simulationActive) {
        const iframe = document.querySelector('.app-iframe') as HTMLIFrameElement;
        if (iframe && iframe.contentWindow) {
          console.log('🔄 Sending continuous GPS update:', { lat: simulatedLat, lon: simulatedLon });
          iframe.contentWindow.postMessage({
            type: 'gps-simulation',
            lat: simulatedLat,
            lon: simulatedLon
          }, '*');
        }
      }
    }, 3000);
  }
  
  function stopContinuousGPSUpdates() {
    if (gpsUpdateInterval) {
      clearInterval(gpsUpdateInterval);
      gpsUpdateInterval = null;
    }
  }

  function stopSimulation() {
    simulationActive = false;
    userLat = null;
    userLon = null;
    
    // Stop continuous GPS updates
    stopContinuousGPSUpdates();
    
    // Send stop message to iframe
    const iframe = document.querySelector('.app-iframe') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      console.log('Sending GPS simulation stop message to iframe');
      iframe.contentWindow.postMessage({
        type: 'gps-simulation-stop'
      }, '*');
    }
    
    // Clear hash
    if (iframe && iframe.contentWindow) {
      const iframeUrl = new URL(iframe.src);
      iframeUrl.hash = '';
      iframe.src = iframeUrl.toString();
    }
  }

  function resetToBerlin() {
    updateSimulatedPosition(52.5200, 13.4050);
  }

  function resetToMünchen() {
    updateSimulatedPosition(48.1351, 11.5820);
  }

  function resetToHamburg() {
    updateSimulatedPosition(53.5511, 9.9937);
  }

  function setupKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
      if (!simulationActive) return;

      const step = 0.001; // Small movement step
      let moved = false;

      switch (e.key) {
        case 'ArrowUp':
          simulatedLat += step;
          moved = true;
          break;
        case 'ArrowDown':
          simulatedLat -= step;
          moved = true;
          break;
        case 'ArrowLeft':
          simulatedLon -= step;
          moved = true;
          break;
        case 'ArrowRight':
          simulatedLon += step;
          moved = true;
          break;
      }

      if (moved) {
        e.preventDefault();
        updateSimulatedPosition(simulatedLat, simulatedLon);
      }
    });
  }

  function updateURLHash(lat: number, lon: number, active: boolean) {
    if (active) {
      console.log('Sending GPS data to iframe:', { lat, lon });
      
      // Send GPS data to iframe via postMessage only
      const iframe = document.querySelector('.app-iframe') as HTMLIFrameElement;
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: 'gps-simulation',
          lat: lat,
          lon: lon
        }, '*');
      }
    }
  }

  function toggleSimulation() {
    simulationActive = !simulationActive;
    if (simulationActive) {
      updateURLHash(simulatedLat, simulatedLon, true);
    } else {
      // Clear hash
      const iframe = document.querySelector('.app-iframe') as HTMLIFrameElement;
      if (iframe && iframe.contentWindow) {
        const iframeUrl = new URL(iframe.src);
        iframeUrl.hash = '';
        iframe.src = iframeUrl.toString();
      }
    }
  }

  function searchLocations() {
    if (!searchQuery.trim()) {
      searchResults = [];
      return;
    }

    const query = searchQuery.toLowerCase();
    searchResults = allImages.filter(image => {
      const title = (image.title || '').toLowerCase();
      const description = (image.description || '').toLowerCase();
      const keywords = Array.isArray(image.keywords) 
        ? image.keywords.join(' ').toLowerCase() 
        : '';

      return title.includes(query) || 
             description.includes(query) || 
             keywords.includes(query);
          }); // Kein Limit - alle Ergebnisse
  }

  function selectLocation(image: any) {
    simulatedLat = image.lat;
    simulatedLon = image.lon;
    updateSimulatedPosition(simulatedLat, simulatedLon);
    searchResults = [];
    searchQuery = '';
  }

  function fitMapToMarkers() {
    if (mapMarkers.length > 0) {
      const group = new L.featureGroup(mapMarkers);
      map.fitBounds(group.getBounds().pad(0.1));
    }
  }

  function exitSimulation() {
    // Stop simulation in iframe
    const iframe = document.querySelector('.app-iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        type: 'gps-simulation-stop'
      }, '*');
    }
    // Navigate back to main page
    location.href = '/';
  }

  function stopSimulationViaIframe() {
    // Update iframe src with stop parameter to trigger simulation stop
    const iframe = document.querySelector('.app-iframe');
    if (iframe && iframe.tagName === 'IFRAME') {
      const iframeElement = iframe as HTMLIFrameElement;
      iframeElement.src = '/?stop=simulation';
    }
  }

  // Function to remove duplicates from the gallery
  function removeDuplicates() {
    const currentPics = get(pics);
    const uniquePics = currentPics.filter((pic, index, self) => 
      index === self.findIndex(p => p.id === pic.id)
    );
    
    if (uniquePics.length !== currentPics.length) {
      const removedDuplicates = currentPics.filter((pic, index, self) => 
        index !== self.findIndex(p => p.id === pic.id)
      );
      
      console.log(`🧹 Removed ${removedDuplicates.length} duplicate images from gallery:`, removedDuplicates);
      
      pics.set(uniquePics);
      
      // Update duplicate count
      duplicateCount += removedDuplicates.length;
    }
  }

  function resortImagesByDistance() {
    const currentPics = get(pics);
    const sortedPics = currentPics.sort((a, b) => {
      const distA = getDistanceInMeters(userLat!, userLon!, a.lat, a.lon);
      const distB = getDistanceInMeters(userLat!, userLon!, b.lat, b.lon);
      return distA - distB;
    });
    pics.set(sortedPics);
  }
</script>

<svelte:head>
  <title>Simulation - Culoca</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  
  <!-- Strukturierte Daten (JSON-LD) für bessere SEO -->
  {@html `<script type="application/ld+json">
  ${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Simulation - Culoca",
    "description": "Simulationsmodus für Culoca - Teste die App-Funktionalität mit Beispieldaten",
    "url": "https://culoca.com/simulation",
    "inLanguage": "de",
    "publisher": {
      "@type": "Organization",
      "name": "Culoca",
      "url": "https://culoca.com"
    }
  }, null, 2)}
  </script>`}
</svelte:head>

<FloatingActionButtons
  showTestMode={true}
  isLoggedIn={true}
  simulationMode={true}
  on:testMode={() => window.location.href = '/'}
/>

<div class="simulation-container" class:dark={$darkMode}>
  <!-- Split Screen -->
  <div class="split-screen">
    <!-- Left Side - Map -->
    <div class="map-side">
      <div bind:this={mapEl} class="map-container"></div>
      <div class="map-info">
        {#if userLat && userLon}
          <p style="margin:4px 0;">📍 {userLat.toFixed(6)}, {userLon.toFixed(6)}</p>
        {/if}
        <p style="margin:4px 0;">📊 {imagesWithGPS} / {totalImages} Bilder mit GPS&nbsp;– (
          <span class="stat-link" on:click={() => showWithoutGpsList = !showWithoutGpsList}>
            {imagesWithoutGPS} ohne GPS
          </span>, 
          <span class="stat-link" on:click={() => showIncompleteList = !showIncompleteList}>
            {imagesWithIncompleteData} unvollständig
          </span>, {duplicateCount} Duplikate entfernt 
          <button class="remove-duplicates-btn" on:click={removeDuplicates} title="Duplikate entfernen">
            🧹
          </button>)</p>
      </div>
    </div>

    <!-- Right Side - App iFrame -->
    <div class="app-side">
      <iframe 
        src="/?autoguide=true&showDistance=true&showCompass=true&simulation=true"
        class="app-iframe"
        title="Culoca App Simulation"
      ></iframe>
    </div>
  </div>

  <!-- Compact Lists with 48px Thumbnails -->
  {#if showWithoutGpsList && noGpsImagesList.length > 0}
    <div class="compact-list-container">
      <div class="compact-list-header">
        <h4>🚫 Bilder ohne GPS ({noGpsImagesList.length})</h4>
        <button class="close-btn" on:click={() => showWithoutGpsList = false}>×</button>
      </div>
      <div class="compact-list">
        {#each noGpsImagesList as img}
          <div class="compact-item" on:click={() => { const url = new URL(`/item/${img.slug}`, window.location.origin); url.searchParams.set('anchor', img.id); window.open(url.toString(), '_blank'); }}>
            <img 
              src="https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-64/{img.path_64 || img.path_512}"
              alt={img.title || 'Bild'}
              class="compact-thumbnail"
              loading="lazy"
              onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
            />
            <div class="compact-placeholder" style="display: none;">📷</div>
            <div class="compact-info">
              <div class="compact-title">{img.title || `Bild ${img.id}`}</div>
              <div class="compact-missing">❌ Keine GPS-Koordinaten gespeichert</div>
              <div class="compact-note">→ Bild kann nicht in Karte angezeigt werden</div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if showIncompleteList && incompleteImagesList.length > 0}
    <div class="compact-list-container">
      <div class="compact-list-header">
        <h4>⚠️ Unvollständige Bilder ({incompleteImagesList.length})</h4>
        <button class="close-btn" on:click={() => showIncompleteList = false}>×</button>
      </div>
      <div class="compact-list">
        {#each incompleteImagesList as img}
          <div class="compact-item" on:click={() => { const url = new URL(`/item/${img.slug}`, window.location.origin); url.searchParams.set('anchor', img.id); window.open(url.toString(), '_blank'); }}>
            <img 
              src="https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-64/{img.path_64 || img.path_512}"
              alt={img.title || 'Bild'}
              class="compact-thumbnail"
              loading="lazy"
              onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
            />
            <div class="compact-placeholder" style="display: none;">📷</div>
            <div class="compact-info">
              <div class="compact-title">{img.title || `Bild ${img.id}`}</div>
              <div class="compact-missing">
                {#if !img.title}❌ Kein Titel{/if}
                {#if !img.description}❌ Keine Beschreibung{/if}
                {#if !img.keywords || img.keywords.length === 0}❌ Keine Keywords{/if}
                {#if !img.path_2048}❌ Fehlende 2048px Version{/if}
                {#if !img.path_512}❌ Fehlende 512px Version{/if}
              </div>
              {#if !img.path_2048 && img.original_url}
                <div class="compact-note">🔧 Kann von Hetzner nachträglich erstellt werden</div>
              {:else if !img.path_2048}
                <div class="compact-note">⚠️ Bild muss erneut hochgeladen werden</div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .simulation-container {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .split-screen {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .map-side, .app-side {
    flex: 1;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--border-color);
  }

  .app-side {
    border-right: none;
  }

  .iframe-controls {
    display: flex;
    gap: 0.5rem;
  }

  .app-iframe {
    flex: 1;
    border: none;
    width: 100%;
    height: 100%;
  }

  .map-header, .app-header {
    padding: 1rem;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .map-header h2, .app-header h2 {
    margin: 0 0 0.5rem 0;
    font-size: 1.2rem;
  }

  .map-header p, .app-header p {
    margin: 0;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .map-container {
    flex: 1;
    min-height: 0;
  }

  .map-info {
    padding: 1rem;
    background: var(--bg-tertiary);
    border-top: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .map-info p {
    margin: 0.25rem 0;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .gallery-container {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 40vh;
    background: var(--bg-primary);
    border-top: 2px solid var(--border-color);
    z-index: 1000;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .grid-layout {
    flex: 1;
    padding: 1rem;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 0.5rem;
    overflow-y: auto;
  }

  .grid-item {
    position: relative;
    border-radius: 0.5rem;
    overflow: hidden;
    cursor: pointer;
    transition: transform 0.2s;
  }

  .grid-item:hover {
    transform: scale(1.02);
  }

  .grid-item img {
    width: 100%;
    height: 150px;
    object-fit: cover;
  }



  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
    color: var(--text-secondary);
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--border-color);
    border-top: 4px solid var(--accent-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Dark mode adjustments */
  .dark {
    --bg-primary: #1a1a1a;
    --bg-secondary: #2d2d2d;
    --bg-tertiary: #3d3d3d;
    --text-primary: #ffffff;
    --text-secondary: #cccccc;
    --border-color: #444444;
    --accent-color: #4CAF50;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .split-screen {
      flex-direction: column;
    }
    
    .map-side, .app-side {
      flex: none;
      height: 50vh;
    }
  }

  /* Styling for inline stat links */
  .stat-link {
    color: var(--accent-color);
    cursor: pointer;
    text-decoration: underline;
  }

  .stat-link:hover {
    color: var(--accent-color-hover, #45a049);
  }

  .gallery-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
  }

  .gallery-header h3 {
    margin: 0;
    color: var(--text-primary);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background-color 0.2s;
  }

  .close-btn:hover {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .placeholder-icon {
    width: 100%;
    height: 150px;
    background: var(--bg-tertiary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    color: var(--text-secondary);
  }

  .image-info {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: linear-gradient(transparent, rgba(0,0,0,0.8));
    color: white;
    padding: 1rem 0.5rem 0.5rem;
  }

  .image-title {
    font-size: 0.9rem;
    font-weight: 500;
    margin-bottom: 0.25rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Compact Lists Styling */
  .compact-list-container {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    max-height: 50vh;
    background: var(--bg-primary);
    border-top: 2px solid var(--border-color);
    z-index: 1000;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .compact-list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .compact-list-header h4 {
    margin: 0;
    font-size: 1.1rem;
    color: var(--text-primary);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 50%;
    transition: background-color 0.2s;
  }

  .close-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .compact-list {
    flex: 1;
    padding: 1rem;
    overflow-y: auto;
  }

  .compact-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem;
    margin-bottom: 0.5rem;
    background: var(--bg-secondary);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: background-color 0.2s, transform 0.2s;
  }

  .compact-item:hover {
    background: var(--bg-tertiary);
    transform: translateX(4px);
  }

  .compact-thumbnail {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    border: 2px solid var(--border-color);
  }

  .compact-placeholder {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--bg-tertiary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    flex-shrink: 0;
    border: 2px solid var(--border-color);
  }

  .compact-info {
    flex: 1;
    min-width: 0;
  }

  .compact-title {
    font-weight: 600;
    font-size: 1rem;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .compact-missing {
    font-size: 0.85rem;
    color: #ff6b6b;
    margin-bottom: 0.25rem;
  }

  .compact-note {
    font-size: 0.8rem;
    color: var(--text-secondary);
    font-style: italic;
  }

  /* Remove duplicates button */
  .remove-duplicates-btn {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-left: 4px;
    color: var(--text-secondary);
  }
  
  .remove-duplicates-btn:hover {
    background: var(--accent-color);
    color: white;
    border-color: var(--accent-color);
  }

  /* Marker Cluster Styles - Culoca Orange */
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