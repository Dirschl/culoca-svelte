<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { writable, get } from 'svelte/store';
  import Justified from '$lib/Justified.svelte';
  import NewsFlash from '$lib/NewsFlash.svelte';
  import { darkMode } from '$lib/darkMode';

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

  let showNoGPSList = false;
  let showIncompleteList = false;

  onMount(async () => {
    await loadAllImages();
    initializeMap();
    startSimulation();
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
  });

  async function loadAllImages() {
    try {
      // First, get all images to see the total count
      const { data: allData, error: allError } = await supabase
        .from('images')
        .select('id, path_512, path_2048, path_64, width, height, lat, lon, title, description, keywords');

      if (allError) throw allError;

      totalImages = allData?.length || 0;

      // Filter for images with GPS data
      const imagesWithGPSData = allData?.filter(img => img.lat && img.lon) || [];
      const imagesWithoutGPSData = allData?.filter(img => !img.lat || !img.lon) || [];

      imagesWithGPS = imagesWithGPSData.length;
      imagesWithoutGPS = imagesWithoutGPSData.length;

      console.log(`Total images in database: ${totalImages}`);
      console.log(`Images with GPS data: ${imagesWithGPS}`);
      console.log(`Images without GPS data: ${imagesWithoutGPS}`);
      
      // Debug: Log specific image if it exists
      const specificImage = allData?.find(img => img.id === '2c6407f6-1ca5-4e82-afb1-0e0fe37db0ea');
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
        img.keywords.length === 0
      );

      imagesWithGPS = gpsImages.length;
      imagesWithoutGPS = noGpsImages.length;
      imagesWithIncompleteData = incompleteImages.length;

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

    // @ts-ignore
    map = L.map(mapEl).setView([simulatedLat, simulatedLon], 13);

    // @ts-ignore
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Add user marker (draggable and in front)
    // @ts-ignore
    userMarker = L.marker([simulatedLat, simulatedLon], {
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

    // Add image markers (only for unique images with GPS data)
    const imagesWithGPS = allImages.filter(img => img.lat && img.lon);
    console.log(`🗺️ Creating ${imagesWithGPS.length} map markers from ${allImages.length} unique images`);
    
    imagesWithGPS.forEach(img => {
      console.log(`📍 Adding marker for unique image ${img.id}:`, {
        lat: img.lat,
        lon: img.lon,
        path_64: img.path_64,
        path_512: img.path_512,
        title: img.title
      });
        
        // @ts-ignore
        const marker = L.marker([img.lat, img.lon], {
          // @ts-ignore
          icon: L.divIcon({
            className: 'image-marker',
            html: `<div style="position: relative; width: 48px; height: 48px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); cursor: pointer; overflow: hidden; background: #f0f0f0; display: flex; align-items: center; justify-content: center;" title="${img.title || 'Bild'}">
              <img src="https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-64/${img.path_64 || img.path_512}" 
                   style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" 
                   alt="${img.title || 'Bild'}"
                   onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\'background: #4CAF50; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px;\'>📷</div>'">
              <div style="position: absolute; bottom: -20px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; white-space: nowrap; max-width: 120px; overflow: hidden; text-overflow: ellipsis; z-index: 1000;">${img.title || 'Bild'}</div>
            </div>`,
            iconSize: [48, 48],
            iconAnchor: [24, 24]
          })
        }).addTo(map);

        marker.on('click', () => {
          // Navigate to image detail page
          window.open(`/image/${img.id}`, '_blank');
        });

        mapMarkers.push(marker);
    });

    // Add map click handler to move user position
    map.on('click', (e: any) => {
      const newLat = e.latlng.lat;
      const newLon = e.latlng.lng;
      
      updateSimulatedPosition(newLat, newLon);
    });

    mapInitialized = true;
    
    // Fit map to show all markers
    if (mapMarkers.length > 0) {
      // @ts-ignore
      const group = new L.featureGroup(mapMarkers);
      map.fitBounds(group.getBounds().pad(0.1));
      console.log('Map fitted to show all image markers');
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

    // Resort images by distance (local sort only)
    resortImagesByDistance();
    
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

    // Resort images by distance
    resortImagesByDistance();
    
    // Update URL hash for iframe communication
    updateURLHash(lat, lon, simulationActive);
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

  function startSimulation() {
    simulationActive = true;
    userLat = simulatedLat;
    userLon = simulatedLon;
    resortImagesByDistance();
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
    }).slice(0, 10); // Limit to 10 results
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
</script>

<svelte:head>
  <title>Simulation - Culoca</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
</svelte:head>

<div class="simulation-container" class:dark={$darkMode}>
  <!-- Header -->
  <header class="simulation-header">
    <div class="position-info">
      {#if userLat && userLon}
        <span>📍 {userLat.toFixed(6)}, {userLon.toFixed(6)}</span>
      {/if}
    </div>
  </header>

  <!-- Split Screen -->
  <div class="split-screen">
    <!-- Left Side - Map -->
    <div class="map-side">
      <div bind:this={mapEl} class="map-container"></div>
      <div class="map-info">
        <p>📊 {imagesWithGPS} von {totalImages} eindeutigen Bildern haben GPS-Daten ({imagesWithoutGPS} ohne GPS, {imagesWithIncompleteData} unvollständig, {duplicateCount} Duplikate entfernt)</p>
        <div class="no-gps-toggle" style="margin-top: 12px; cursor: pointer; color: #1976d2; font-weight: 500;" on:click={() => showNoGPSList = !showNoGPSList}>
          <span>({imagesWithoutGPS} ohne GPS)</span>
        </div>
        <div class="incomplete-toggle" style="margin-top: 8px; cursor: pointer; color: #ff9800; font-weight: 500;" on:click={() => showIncompleteList = !showIncompleteList}>
          <span>({imagesWithIncompleteData} unvollständig)</span>
        </div>
        {#if showNoGPSList}
          <div class="no-gps-list" style="margin: 12px 0 24px 0; padding: 12px; background: #f8f8f8; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
            <h3 style="margin-bottom: 8px; font-size: 1.1em;">Bilder ohne GPS-Koordinaten ({imagesWithoutGPS})</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 16px;">
              {#each allImages.filter(img => !img.lat || !img.lon) as img}
                <a href={`/image/${img.id}`} target="_blank" style="display: flex; flex-direction: column; align-items: center; text-decoration: none; color: inherit;">
                  <div style="width: 64px; height: 64px; border-radius: 50%; overflow: hidden; border: 2px solid #ccc; background: #eee; display: flex; align-items: center; justify-content: center; margin-bottom: 4px;">
                    {#if img.path_64 || img.path_512}
                      <img src={`https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-64/${img.path_64 || img.path_512}`} alt={img.title || 'Bild'} style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" />
                    {:else}
                      <span style="font-size: 2em; color: #aaa;">📷</span>
                    {/if}
                  </div>
                  <span style="font-size: 0.9em; text-align: center; max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{img.title || img.original_name || 'Bild'}</span>
                </a>
              {/each}
            </div>
          </div>
        {/if}
        {#if showIncompleteList}
          <div class="incomplete-list" style="margin: 12px 0 24px 0; padding: 12px; background: #fff3cd; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #ffeaa7;">
            <h3 style="margin-bottom: 8px; font-size: 1.1em; color: #856404;">Bilder mit unvollständigen Daten ({imagesWithIncompleteData})</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 16px;">
              {#each allImages.filter(img => !img.title || !img.description || !img.keywords || img.keywords.length === 0) as img}
                <a href={`/image/${img.id}`} target="_blank" style="display: flex; flex-direction: column; align-items: center; text-decoration: none; color: inherit;">
                  <div style="width: 64px; height: 64px; border-radius: 50%; overflow: hidden; border: 2px solid #ffc107; background: #fff3cd; display: flex; align-items: center; justify-content: center; margin-bottom: 4px;">
                    {#if img.path_64 || img.path_512}
                      <img src={`https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-64/${img.path_64 || img.path_512}`} alt={img.title || 'Bild'} style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" />
                    {:else}
                      <span style="font-size: 2em; color: #ffc107;">📷</span>
                    {/if}
                  </div>
                  <span style="font-size: 0.9em; text-align: center; max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{img.title || img.original_name || 'Bild'}</span>
                  <div style="font-size: 0.7em; color: #856404; text-align: center; max-width: 80px;">
                    {#if !img.title}❌ Titel{/if}
                    {#if !img.description}❌ Beschreibung{/if}
                    {#if !img.keywords || img.keywords.length === 0}❌ Keywords{/if}
                  </div>
                </a>
              {/each}
            </div>
          </div>
        {/if}
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
</div>

<style>
  .simulation-container {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .simulation-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .simulation-header h1 {
    margin: 0;
    font-size: 1.5rem;
    color: var(--accent-color);
  }

  .simulation-controls {
    display: flex;
    gap: 0.5rem;
  }

  .control-btn {
    padding: 0.5rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .control-btn:hover {
    background: var(--accent-color);
    color: white;
  }

  .control-btn.active {
    background: var(--accent-color);
    color: white;
  }

  .position-info {
    font-family: monospace;
    font-size: 0.9rem;
    color: var(--text-secondary);
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
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }

  .grid-layout {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 0.5rem;
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

  .distance-label {
    position: absolute;
    bottom: 0.5rem;
    right: 0.5rem;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.8rem;
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
    
    .simulation-header {
      flex-direction: column;
      gap: 1rem;
      align-items: stretch;
    }
    
    .simulation-controls {
      justify-content: center;
    }
  }
</style> 