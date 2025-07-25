<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { page } from '$app/stores';
  import GalleryLayout from '$lib/GalleryLayout.svelte';
  import { browser } from '$app/environment';
  import { tick } from 'svelte';
  import { darkMode } from '$lib/darkMode';
  import { filterStore } from '$lib/filterStore';
  import { goto } from '$app/navigation';
  import { authFetch } from '$lib/authFetch';
  import { sessionStore, sessionReady } from '$lib/sessionStore';
  import { get } from 'svelte/store';
  import type { PageData } from './$types';
  import { useJustifiedLayout as globalLayoutStore } from '$lib/galleryStore';
  import ImageDisplay from '$lib/detail/ImageDisplay.svelte';
  import ImageMetaSection from '$lib/detail/ImageMetaSection.svelte';
  import NearbyGallery from '$lib/detail/NearbyGallery.svelte';
  import ImageControlsSection from '$lib/detail/ImageControlsSection.svelte';
  import ImageMapSection from '$lib/detail/ImageMapSection.svelte';
  import CreatorCard from '$lib/detail/CreatorCard.svelte';
  import RadiusControl from '$lib/detail/RadiusControl.svelte';
  import FileDetails from '$lib/detail/FileDetails.svelte';
  import KeywordsSection from '$lib/detail/KeywordsSection.svelte';

  export let data: any;
  
  let image = data?.image;
  let loading = true;
  let error = '';
  let profile: any = null;
  let nearby: any[] = [];
  let hiddenItems: any[] = []; // Items mit gallery = false
  let showHiddenItems = false; // Toggle für ausgeblendete Items
  

  let radius = 500; // meters, default
  let radiusLoaded = false;
  let lastRadius = 500; // track radius changes
  let nearbyCache: { [key: string]: any[] } = {};
  let nearbyCacheKey = '';
  let isDraggingRadius = false;
  let mapEl: HTMLDivElement;
  let map: any;
  let keywordsList: string[] = [];
  // useJustifiedLayout is now imported from galleryStore as global state
  
  // Layout preference is now managed globally via galleryStore
  let editingTitle = false;
  let titleEditValue = '';
  let currentUser: any = null;
  let editingDescription = false;
  let descriptionEditValue = '';
  let showScrollToTop = false;
  
  // Keywords editing
  let editingKeywords = false;
  let keywordsEditValue = '';
  let rotating = false;
  
  // Original filename editing
  let editingFilename = false;
  let filenameEditValue = '';
  

  
  // EXIF toggle
  let showFullExif = false;

  // 1. State für Map-Picker und Map-Type
  let showMapPicker = false;
  let mapPickerLat: number | null = null;
  let mapPickerLon: number | null = null;
  let mapPickerType: 'standard' | 'hybrid' = 'standard';
  let mapPickerMap: any = null;
  let mapPickerContainer: HTMLElement;
  let mapPickerSearch = '';
  let mapPickerSearchResults: any[] = [];
  let isGettingUserLocation = false;

  // State für Map-Type in der Hauptkarte
  let mapType: 'standard' | 'hybrid' = 'standard';

  $: imageId = $page.params.id;

  let nearbySentinel: HTMLDivElement;
  let nearbyOffset = 0;
  const nearbyLimit = 50;
  let isLoadingNearby = false;
  let hasMoreNearby = true;

  async function loadMoreNearby(reset = false) {
    if (isLoadingNearby || !image || !image.lat || !image.lon || !hasMoreNearby) return;
    isLoadingNearby = true;
    try {
      if (reset) {
        nearbyOffset = 0;
        hasMoreNearby = true;
        nearby = [];
      }
      const url = new URL('/api/items', window.location.origin);
      url.searchParams.set('lat', String(image.lat));
      url.searchParams.set('lon', String(image.lon));
      url.searchParams.set('radius', String(radius));
      url.searchParams.set('offset', String(nearbyOffset));
      url.searchParams.set('limit', String(nearbyLimit));
      // KEIN fromItem mehr!
      const res = await fetch(url.toString());
      const data = await res.json();
      if (data && data.images) {
        if (nearbyOffset === 0) {
          nearby = data.images;
        } else {
          nearby = [...nearby, ...data.images];
        }
        nearbyOffset += data.images.length;
        hasMoreNearby = data.images.length === nearbyLimit;
      } else {
        hasMoreNearby = false;
      }
    } catch (e) {
      hasMoreNearby = false;
    }
    isLoadingNearby = false;
  }

  onMount(async () => {
    console.log('[Detail] onMount start');
    try {
      if (!get(sessionReady)) {
        await new Promise<void>((resolve) => {
          let unsub: (() => void) | null = null;
          unsub = sessionReady.subscribe((ready) => {
            if (ready && unsub) {
              unsub();
              resolve();
            }
          });
        });
      }
      console.log('[Detail] sessionReady true');

      // Get current user from session store first, then verify with Supabase
      const sessionData = get(sessionStore);
      console.log('[Detail] sessionStore:', sessionData);
      if (sessionData.isAuthenticated && sessionData.userId) {
        currentUser = { id: sessionData.userId };
        console.log('[Detail] Using user from session store:', sessionData.userId);
      } else {
        // Fallback: Get user directly from Supabase
        const { data: { user } } = await supabase.auth.getUser();
        currentUser = user;
        console.log('[Detail] Got user from Supabase:', user?.id);
      }

      // Layout preference is now managed globally via galleryStore

      // Radius aus localStorage laden (pro User oder anonym)
      if (browser && !radiusLoaded) {
        if (currentUser) {
          const storedRadius = localStorage.getItem(`detailRadius_${currentUser.id}`);
          if (storedRadius) {
            radius = parseInt(storedRadius, 10) || 500;
          }
        } else {
          const storedRadius = localStorage.getItem('detailRadius_anonymous');
          if (storedRadius) {
            radius = parseInt(storedRadius, 10) || 500;
          }
        }
        lastRadius = radius;
        radiusLoaded = true;
      }

      console.log('[Detail] Using server-loaded image data:', image);
      
      // If we don't have image data from server, try to load it client-side
      if (!image) {
        console.log('[Detail] No server data, loading image from DB, imageId:', imageId);
        
        const { data: itemData, error: itemError } = await supabase
          .from('items')
          .select('*')
          .eq('id', imageId)
          .single();

        if (itemError) {
          error = itemError.message;
          console.error('[Detail] DB fetch error:', itemError);
          loading = false;
          return;
        }

        image = itemData;
        console.log('[Detail] Image data loaded client-side:', image);
      }

      // Then, if we have a profile_id, get the profile data separately
      if (image.profile_id) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, show_address, address, show_phone, phone, show_email, email, show_website, website, show_social, instagram, facebook, twitter')
          .eq('id', image.profile_id)
          .single();

        if (!profileError && profileData) {
          profile = profileData;
          console.log('[Detail] Profile data loaded:', profile);
        } else {
          console.log('[Detail] No profile data found for profile_id:', image.profile_id);
        }
      }

      // Privacy check: If image is private, only allow access for the owner or developer
      if (image.is_private === true) {
        const isOwner = currentUser && currentUser.id === image.profile_id;
        const isDeveloper = currentUser && currentUser.id === '0ceb2320-0553-463b-971a-a0eef5ecdf09';
        
        console.log('[Detail] Privacy check for private image:', {
          hasCurrentUser: !!currentUser,
          currentUserId: currentUser?.id,
          imageProfileId: image.profile_id,
          imageId: image.id,
          isOwner,
          isDeveloper
        });
        
        if (!isOwner && !isDeveloper) {
          console.log('[Detail] Access denied - redirecting to main page');
          goto('/');
          return;
        }
        console.log('[Detail] Access granted for private image');
      }

      if (!image.exif_data) image.exif_data = {};
      titleEditValue = image.title || '';
      filenameEditValue = image.original_name || '';
      descriptionEditValue = image.description || '';

      keywordsList = image.keywords || [];
      if (browser) {
        updateFavicon();
      }
    } catch (err) {
      error = 'Failed to load image';
      console.error('[Detail] Exception:', err);
    }
    loading = false;
    console.log('[Detail] onMount finished, loading:', loading, 'error:', error, 'image:', image);
  });

  // Scroll to top functionality
  if (browser) {
    const handleScroll = () => {
      showScrollToTop = window.scrollY > 300;
    };
    
    window.addEventListener('scroll', handleScroll);
  }

  // Determine best image source with cache buster
  $: imageSource = image ? (() => {
    const baseUrl = 'https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public';
    const timestamp = Date.now(); // Cache buster
    if (image.path_2048) {
      return `${baseUrl}/images-2048/${image.path_2048}?t=${timestamp}`;
    }
    return `${baseUrl}/images-512/${image.path_512}?t=${timestamp}`;
  })() : '';

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

  function getDistanceForJustified(lat1: number, lon1: number, lat2: number, lon2: number): number {
    return getDistanceInMeters(lat1, lon1, lat2, lon2);
  }

  async function rotateImage() {
    if (!image || !isCreator || rotating) return;
    try {
      rotating = true;
      console.log('Starting rotation for image:', image.id);
      
      // Supabase-Session holen
      let accessToken = undefined;
      if (supabase.auth.getSession) {
        const sessionResult = await supabase.auth.getSession();
        accessToken = sessionResult?.data?.session?.access_token;
      }
      
      const response = await fetch(`/api/rotate-image/${image.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
        }
      });
      
      console.log('Rotation response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Rotation result:', result);
      
      if (result.success) {
        console.log('Rotation successful, reloading page...');
        // Add cache buster to force reload of images
        const timestamp = Date.now();
        window.location.href = `${window.location.pathname}?t=${timestamp}`;
      } else {
        alert('Fehler beim Drehen des Bildes: ' + (result.error || 'Unbekannter Fehler'));
      }
    } catch (error) {
      console.error('Rotation error:', error);
      alert('Fehler beim Drehen des Bildes: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'));
    } finally {
      rotating = false;
    }
  }

  async function downloadOriginal(imageId: string, originalName: string) {
    try {
      // Show loading state
      const downloadBtn = document.querySelector(`[data-download-id="${imageId}"]`) as HTMLButtonElement;
      if (downloadBtn) {
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = `
          <svg width="35" height="35" viewBox="0 0 24 24" fill="none" class="animate-spin">
            <path d="M12 6v7m0 0l-3-3m3 3l3-3M6 18h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
      }

      // Get current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Bitte zuerst einloggen');
        return;
      }

      const response = await authFetch(`/api/download/${imageId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          alert('Nicht angemeldet. Bitte zuerst einloggen.');
        } else if (response.status === 403) {
          alert('Kein Zugriff auf diese Datei.');
        } else {
          alert('Download fehlgeschlagen.');
        }
        return;
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = originalName || `image-${imageId}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Show success feedback
      if (downloadBtn) {
        downloadBtn.innerHTML = `
          <svg width="35" height="35" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
        setTimeout(() => {
          downloadBtn.disabled = false;
          downloadBtn.innerHTML = `
            <svg width="35" height="35" viewBox="0 0 24 24" fill="none">
              <path d="M12 6v7m0 0l-3-3m3 3l3-3M6 18h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          `;
        }, 2000);
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Download fehlgeschlagen.');
      
      // Reset button on error
      const downloadBtn = document.querySelector(`[data-download-id="${imageId}"]`) as HTMLButtonElement;
      if (downloadBtn) {
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = `
          <svg width="35" height="35" viewBox="0 0 24 24" fill="none">
            <path d="M12 6v7m0 0l-3-3m3 3l3-3M6 18h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
      }
    }
  }





  async function fetchNearbyImages(lat: number, lon: number, maxRadius: number) {
    console.log('🔍 fetchNearbyImages called with:', { lat, lon, maxRadius });
    // Create cache key based on coordinates and radius
    const cacheKey = `${lat.toFixed(4)}_${lon.toFixed(4)}_${maxRadius}`;
    
    // Check cache first
    if (nearbyCache[cacheKey]) {
      console.log('📸 Using cached nearby items for radius:', maxRadius, 'm');
      nearby = nearbyCache[cacheKey];
      // Recalculate hidden items from cached data
      hiddenItems = nearby.filter((item: any) => item.gallery === false);
      nearby = nearby.filter((item: any) => item.gallery !== false);
      console.log(`📸 From cache: ${nearby.length} visible, ${hiddenItems.length} hidden`);
      return;
    }
    
    console.log('🔍 Calculating nearby items for radius:', maxRadius, 'm');
    
    // Use server-side loaded data first, then fallback to global data
    const baseUrl = 'https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public';
    
    // Filter server-side loaded nearby items by radius
    if (data.nearby && data.nearby.length > 0) {
      console.log('📸 Using server-side loaded nearby items:', data.nearby.length);
      const allNearby = data.nearby
        .filter((item: any) => item.distance <= maxRadius)
        .map((item: any) => ({
          ...item,
          gallery: item.gallery ?? true
        }))
        .sort((a: any, b: any) => a.distance - b.distance);
      
      // Separate visible and hidden items
      nearby = allNearby.filter((item: any) => item.gallery !== false);
      hiddenItems = allNearby.filter((item: any) => item.gallery === false);
      
      console.log(`📸 Nearby items: ${nearby.length} visible, ${hiddenItems.length} hidden`);
    } else if (typeof window !== 'undefined' && (window as any).allImagesData) {
      // Fallback to global item data if available (from main page)
      const allItems = (window as any).allImagesData;
      console.log('📸 Using global item data for nearby calculation, found', allItems?.length || 0, 'items');
      
      const allNearby = allItems
        .filter((item: any) => item.id !== imageId && item.lat && item.lon)
        .map((item: any) => {
          const dist = getDistanceInMeters(lat, lon, item.lat, item.lon);
          return {
            id: item.id,
            lat: item.lat,
            lon: item.lon,
            distance: dist,
            src: `${baseUrl}/images-512/${item.path_512}`,
            srcHD: `${baseUrl}/images-2048/${item.path_2048}`,
            src64: item.path_64 ? `${baseUrl}/images-64/${item.path_64}` : `${baseUrl}/images-512/${item.path_512}`,
            width: item.width,
            height: item.height,
            title: item.title || null,
            gallery: item.gallery ?? true
          };
        })
        .filter((it: any) => it.distance <= maxRadius)
        .sort((a: any, b: any) => a.distance - b.distance);
      
      // Separate visible and hidden items
      nearby = allNearby.filter((item: any) => item.gallery !== false);
      hiddenItems = allNearby.filter((item: any) => item.gallery === false);
      
      console.log(`📸 Nearby items: ${nearby.length} visible, ${hiddenItems.length} hidden`);
    } else {
      // No data available - just return empty array
      console.log('📸 No nearby data available');
      nearby = [];
    }
    
    console.log('✅ Nearby items calculated:', nearby.length, 'items within', maxRadius, 'm');
    
    // Show distance range info
    if (nearby.length > 0) {
      const closest = nearby[0].distance;
      const farthest = nearby[nearby.length - 1].distance;
      console.log(`📍 Distance range: ${closest.toFixed(0)}m - ${farthest.toFixed(0)}m`);
    }
    
    // Cache the result (store all items, both visible and hidden)
    nearbyCache[cacheKey] = [...nearby, ...hiddenItems];
    
    // Clean up old cache entries (keep only last 50 for better performance)
    const cacheKeys = Object.keys(nearbyCache);
    if (cacheKeys.length > 50) {
      const oldestKey = cacheKeys[0];
      delete nearbyCache[oldestKey];
    }
    
    // Initialize lastNearbyCount if not set yet
    if (typeof lastNearbyCount === 'undefined') {
      lastNearbyCount = nearby.length;
    }
    if (browser) {
    scheduleMapUpdate();
    }
  }

  // Debounced radius change handler with improved performance
  $: if (image && image.lat && image.lon && radiusLoaded && browser) {
    // Only fetch if radius actually changed
    if (radius !== lastRadius) {
      console.log('🔄 Radius changed from', lastRadius, 'to', radius, 'm');
      lastRadius = radius;
      
      // Only update if not currently dragging
      if (!isDraggingRadius) {
        // Add small delay to prevent excessive updates during rapid changes
        setTimeout(async () => {
          if (radius === lastRadius) { // Check if radius hasn't changed again
            await fetchNearbyImages(image.lat, image.lon, radius);
          }
        }, 100);
      }
    }
  }
  
  // Function to toggle hidden items visibility
  function toggleHiddenItems() {
    showHiddenItems = !showHiddenItems;
    if (showHiddenItems) {
      // Add hidden items to nearby array
      nearby = [...nearby, ...hiddenItems].sort((a: any, b: any) => a.distance - b.distance);
    } else {
      // Remove hidden items from nearby array
      nearby = nearby.filter((item: any) => item.gallery !== false);
    }
    console.log(`🔍 Hidden items ${showHiddenItems ? 'shown' : 'hidden'}: ${hiddenItems.length} items`);
  }

  // Radius slider event handlers with improved UX
  function onRadiusInput() {
    isDraggingRadius = true;
    // Show live preview of radius value
    console.log('🎚️ Radius slider: ${radius}m');
  }
  
  async function onRadiusChange() {
    isDraggingRadius = false;
    // Trigger immediate update when user finishes dragging
    if (image && image.lat && image.lon) {
      console.log('✅ Radius slider finished: ${radius}m');
      await fetchNearbyImages(image.lat, image.lon, radius);
    }
  }
  
  // Initial fetch when image loads
  $: if (image && image.lat && image.lon && radiusLoaded && browser) {
    console.log('🚀 Initial nearby fetch for item:', image.id, 'at', image.lat, image.lon);
    fetchNearbyImages(image.lat, image.lon, radius).catch(console.error);
  }

  async function initMap() {
    if (!browser || !image || !image.lat || !image.lon) return;
    
    // Skip map initialization during SSR
    if (typeof window === 'undefined') return;
    
    // Check if map element still exists
    if (!mapEl) {
      console.log('🗺️ Map element not found, skipping initialization');
      return;
    }
    
    // Check if map is already initialized
    if (map) {
      console.log('🔄 Map already exists, removing old map');
      try {
        map.remove();
      } catch (e) {
        console.log('🗺️ Error removing old map:', e);
      }
      map = null;
    }
    
    const leaflet = await import('leaflet');
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    await tick();
    
    // Double-check map element still exists after tick
    if (!mapEl) {
      console.log('🗺️ Map element disappeared after tick, skipping initialization');
      return;
    }
    
    try {
      map = leaflet.map(mapEl).setView([image.lat, image.lon], 13);
      // Wait until Leaflet signals readiness, then ensure container dimensions are measured
      if (map.whenReady) {
        map.whenReady(() => {
          try {
            map.invalidateSize();
          } catch (err) {
            console.warn('🗺️ invalidateSize failed:', err);
          }
        });
      }
    } catch (e) {
      console.log('🗺️ Error creating map:', e);
      return;
    }
    // Standard- und Hybrid-Layer
    const standardLayer = leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    });
    const hybridLayer = leaflet.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community'
    });
    if (mapType === 'standard') {
      standardLayer.addTo(map);
      map.currentLayer = standardLayer;
    } else {
      hybridLayer.addTo(map);
      map.currentLayer = hybridLayer;
    }
    map.standardLayer = standardLayer;
    map.hybridLayer = hybridLayer;

    // Add current image marker (orange, mit Thumbnail)
    const baseUrl = 'https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public';
    const thumbnailUrl = image.path_64 
      ? `${baseUrl}/images-64/${image.path_64}`
      : `${baseUrl}/images-512/${image.path_512}`;
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

    // Add nearby items as individual markers
    if (nearby.length > 0) {
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
          // Navigate to item detail page with anchor parameter
          const url = new URL(`/item/${nearbyItem.id}`, window.location.origin);
          url.searchParams.set('anchor', nearbyItem.id);
          window.location.href = url.toString();
        });
        const popupContent = `
          <div style="text-align: center; min-width: 200px;">
            <strong>${nearbyItem.title || 'Item'}</strong><br>
            <small>Entfernung: ${getDistanceFromLatLonInMeters(image.lat, image.lon, nearbyItem.lat, nearbyItem.lon)}</small><br>
            <a href="javascript:void(0)" onclick="(() => { const url = new URL('/item/${nearbyItem.id}', window.location.origin); url.searchParams.set('anchor', '${nearbyItem.id}'); window.location.href = url.toString(); })()" style="color: #0066cc; text-decoration: none; font-weight: 500;">Item anzeigen →</a>
          </div>
        `;
        nearbyMarker.bindPopup(popupContent);
      });
    }

    // Fit map to show all markers if there are nearby items
    if (nearby.length > 0) {
      const allMarkers = [currentMarker];
      map.eachLayer((layer: any) => {
        if (layer !== currentMarker && layer._latlng) {
          allMarkers.push(layer);
        }
      });
      const group = leaflet.featureGroup(allMarkers);
      const adjustView = () => {
        try {
          map.invalidateSize();
          map.fitBounds(group.getBounds().pad(0.1), { animate: false });
        } catch (err) {
          console.warn('🗺️ fitBounds failed:', err);
        }
      };

      if (map.whenReady) {
        map.whenReady(adjustView);
      } else {
        // Fallback – call immediately if whenReady not available
        adjustView();
      }
    }
  }


  
  // Centralized map management to prevent infinite loops
  let mapInitialized = false;
  let lastNearbyCount = 0;
  let mapUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
  let mapKey = 0; // For Svelte {#key} block to force map container remount
  
  // Debounced map update function
  function scheduleMapUpdate() {
    if (mapUpdateTimeout) {
      clearTimeout(mapUpdateTimeout);
    }
    mapUpdateTimeout = setTimeout(() => {
      mapKey += 1; // Force Svelte to remount the map container
      mapInitialized = false; // Allow re-init
      setTimeout(() => initMap(), 100); // Slight delay to allow DOM update
      mapUpdateTimeout = null;
    }, 300);
  }
  
  // Single reactive statement for initial map initialization
  $: if (image && image.lat && image.lon && !mapInitialized) {
    console.log('🗺️ Initializing map for image');
    mapInitialized = true;
    setTimeout(() => initMap(), 500);
  }
  
  // Handle radius changes with debouncing
  $: if (image && image.lat && image.lon && mapInitialized && radiusLoaded && radius !== lastRadius && browser) {
    console.log('🔄 Radius changed from', lastRadius, 'to', radius, 'm, reinitializing map');
    lastRadius = radius;
    scheduleMapUpdate();
  }
  
  // Handle nearby images changes with debouncing
  $: if (image && image.lat && image.lon && mapInitialized && nearby.length !== lastNearbyCount && browser) {
    console.log('🔄 Nearby count changed from', lastNearbyCount, 'to', nearby.length, 'reinitializing map');
    lastNearbyCount = nearby.length;
    scheduleMapUpdate();
  }
  


  $: if (image && image.keywords) {
    if (Array.isArray(image.keywords)) {
      keywordsList = image.keywords as string[];
    } else if (typeof image.keywords === 'string') {
      keywordsList = image.keywords.split(',').map((k: string) => k.trim()).filter(Boolean);
    } else {
      keywordsList = [];
    }
  }

  function copyLink() {
    if (browser) {
      navigator.clipboard.writeText(window.location.href);
      alert('Link kopiert!');
    }
  }

  async function deleteImage() {
    if (!confirm('Möchtest du dieses Bild wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      return;
    }

    try {
      const res = await authFetch(`/api/item/${imageId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert('Fehler beim Löschen des Bildes: ' + (data?.message || res.status));
        return;
      }
      window.location.href = '/';
    } catch (err) {
      alert('Fehler beim Löschen des Bildes');
      console.error(err);
    }
  }

  function scrollToTop() {
    if (browser) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function formatFileSize(bytes: number): string {
    if (!bytes) return '';
    const kb = bytes / 1024;
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) {
      return mb.toFixed(1).replace('.', ',') + ' MB';
    } else {
      return kb.toFixed(0) + ' KB';
    }
  }

  function formatExposureTime(value: any): string {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') {
      return value.includes('/') ? value + ' s' : value + ' s';
    }
    if (typeof value === 'number') {
      if (value >= 1) return value + ' s';
      const denom = Math.round(1 / value);
      return `1/${denom} s`;
    }
    return String(value);
  }

  function formatTimeCreated(value: any): string {
    if (value === undefined || value === null || value === '') return '';
    
    // Value is expected to be like "125359" (HHMMSS format)
    const timeStr = String(value);
    if (timeStr.length === 6) {
      const hours = timeStr.substring(0, 2);
      const minutes = timeStr.substring(2, 4);
      const seconds = timeStr.substring(4, 6);
      return `${hours}:${minutes}:${seconds}`;
    }
    
    // Fallback: return as is if not in expected format
    return String(value);
  }

  function startEditTitle() {
    if (currentUser && image && image.profile_id === currentUser.id) {
      editingTitle = true;
      titleEditValue = image.title || '';
      // Focus the input after it's rendered with longer delay for mobile
      setTimeout(() => {
        const input = document.getElementById('title-edit-input') as HTMLInputElement;
        if (input) {
          input.focus();
          // Don't select all text - just place cursor at end
          input.setSelectionRange(input.value.length, input.value.length);
          // Force mobile keyboard to appear
          input.click();
        }
      }, 100);
    }
  }

  async function saveTitle() {
    if (!editingTitle || !currentUser || !image || image.profile_id !== currentUser.id) return;
    
    const newTitle = titleEditValue.trim();
    if (newTitle.length > 60) return; // Don't save if too long
    
    try {
      const { error: updateError } = await supabase
        .from('items')
        .update({ title: newTitle })
        .eq('id', image.id);
      
      if (updateError) {
        console.error('Error updating title:', updateError);
        return;
      }
      
      // Update local state
      image.title = newTitle;
      editingTitle = false;
    } catch (err) {
      console.error('Failed to save title:', err);
    }
  }

  function cancelEditTitle() {
    editingTitle = false;
    titleEditValue = image.title || '';
  }

  function handleTitleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveTitle();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelEditTitle();
    }
  }

  function startEditDescription() {
    if (currentUser && image && image.profile_id === currentUser.id) {
      editingDescription = true;
      descriptionEditValue = image.description || '';
      // Focus the input after it's rendered with longer delay for mobile
      setTimeout(() => {
        const input = document.getElementById('description-edit-input') as HTMLTextAreaElement;
        if (input) {
          input.focus();
          // Don't select all text - just place cursor at end
          input.setSelectionRange(input.value.length, input.value.length);
          // Force mobile keyboard to appear
          input.click();
        }
      }, 100);
    }
  }

  async function saveDescription() {
    if (!editingDescription || !currentUser || !image || image.profile_id !== currentUser.id) return;
    
    const newDescription = descriptionEditValue.trim();
    if (newDescription.length > 160) return; // Don't save if too long
    
    try {
      const { error: updateError } = await supabase
        .from('items')
        .update({ description: newDescription })
        .eq('id', image.id);
      
      if (updateError) {
        console.error('Error updating description:', updateError);
        return;
      }
      
      // Update local state
      image.description = newDescription;
      editingDescription = false;
    } catch (err) {
      console.error('Failed to save description:', err);
    }
  }

  function cancelEditDescription() {
    editingDescription = false;
    descriptionEditValue = image.description || '';
  }

  function handleDescriptionKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveDescription();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelEditDescription();
    }
  }

  // Keywords editing functions
  function startEditKeywords() {
    if (currentUser && image && image.profile_id === currentUser.id) {
      editingKeywords = true;
      // Convert keywords array to comma-separated string
      keywordsEditValue = keywordsList.join(', ');
      
      // Focus the input after it's rendered
      setTimeout(() => {
        const input = document.getElementById('keywords-edit-input') as HTMLInputElement;
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
          input.click();
        }
      }, 100);
    }
  }

  async function saveKeywords() {
    if (!editingKeywords || !currentUser || !image || image.profile_id !== currentUser.id) return;
    
    const newKeywords = keywordsEditValue.trim();
    if (newKeywords.length > 500) return; // Don't save if too long
    
    try {
      // Parse keywords from comma-separated string
      const keywordsArray = newKeywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);
      
      const { error: updateError } = await supabase
        .from('items')
        .update({ keywords: keywordsArray })
        .eq('id', image.id);
      
      if (updateError) {
        console.error('Error updating keywords:', updateError);
        return;
      }
      
      // Update local state
      image.keywords = keywordsArray;
      keywordsList = keywordsArray;
      editingKeywords = false;
    } catch (err) {
      console.error('Failed to save keywords:', err);
    }
  }

  function cancelEditKeywords() {
    editingKeywords = false;
    keywordsEditValue = keywordsList.join(', ');
  }

  function handleKeywordsKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveKeywords();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelEditKeywords();
    }
  }



  // Count keywords for validation
  $: keywordsCount = keywordsEditValue ? keywordsEditValue.split(',').filter(k => k.trim().length > 0).length : 0;
  $: keywordsValid = keywordsCount >= 10 && keywordsCount <= 50;
  $: keywordsTooMany = keywordsCount > 50;

  // Check if user is the creator
  $: isCreator = !!currentUser && (currentUser.id === image?.profile_id || currentUser.id === '0ceb2320-0553-463b-971a-a0eef5ecdf09');

  // Dynamisches Favicon aktualisieren
  $: if (image && browser) {
    updateFavicon();
  }

  function updateFavicon() {
    if (!image) return;
    
    // Entferne alte Favicon-Links
    const oldFavicons = document.querySelectorAll('link[rel="icon"]');
    oldFavicons.forEach(link => link.remove());
    
    // Erstelle neuen Favicon-Link mit Cache-Buster
    const faviconLink = document.createElement('link');
    faviconLink.rel = 'icon';
    faviconLink.type = 'image/jpeg';
    
    let faviconUrl = '';
    if (image.path_64) {
      faviconUrl = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-64/${image.path_64}`;
    } else if (image.path_512) {
      faviconUrl = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${image.path_512}`;
    }
    
    if (faviconUrl) {
      // Füge Cache-Buster hinzu
      const timestamp = Date.now();
      faviconLink.href = `${faviconUrl}?t=${timestamp}`;
      document.head.appendChild(faviconLink);
    }
  }

  function formatRadius(meters: number): string {
    if (meters >= 1000) {
      return (meters / 1000).toFixed(1).replace('.', ',') + ' km';
    }
    return meters + ' m';
  }

  // Layout preference is now managed globally via galleryStore

  // Radius speichern, wenn er sich ändert und geladen wurde
  $: if (browser && radiusLoaded) {
    if (currentUser) {
      // Für eingeloggte User: spezifischer Radius pro User
      localStorage.setItem(`detailRadius_${currentUser.id}`, String(radius));
    } else {
      // Für anonyme User: allgemeiner Radius
      localStorage.setItem('detailRadius_anonymous', String(radius));
    }
  }

  // 2. Map-Picker öffnen (optional Startkoordinaten)
  async function openMapPicker(startLat: number | null, startLon: number | null) {
    showMapPicker = true;
    mapPickerType = 'standard';
    mapPickerSearch = '';
    mapPickerSearchResults = [];
    
    // Verwende die GPS-Koordinaten des Bildes als Startpunkt, falls vorhanden
    const imageLat = image?.lat;
    const imageLon = image?.lon;
    
    if (imageLat && imageLon) {
      // Bild hat GPS-Koordinaten - verwende diese
      mapPickerLat = imageLat;
      mapPickerLon = imageLon;
      isGettingUserLocation = false;
      setTimeout(() => initMapPicker(), 100);
    } else {
      // Keine GPS-Koordinaten - verwende User-Position oder Fallback
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
            // Fallback: München
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

  // 3. Map-Picker initialisieren
  async function initMapPicker() {
    const leaflet = await import('leaflet');
    if (!mapPickerContainer || mapPickerMap) return;
    const initialLat = mapPickerLat ?? 48.1351;
    const initialLon = mapPickerLon ?? 11.5820;
    mapPickerMap = leaflet.map(mapPickerContainer, { zoomControl: true }).setView([initialLat, initialLon], 13);
    // Standard- und Hybrid-Layer
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
    // Karte verschiebbar, Pin bleibt in der Mitte
    mapPickerMap.on('move', () => {
      const center = mapPickerMap.getCenter();
      mapPickerLat = center.lat;
      mapPickerLon = center.lng;
    });
  }

  // 4. Map-Type-Toggle
  function toggleMapPickerType() {
    if (!mapPickerMap) return;
    mapPickerType = mapPickerType === 'standard' ? 'hybrid' : 'standard';
    const currentLayer = mapPickerMap.currentLayer;
    const newLayer = mapPickerType === 'standard' ? mapPickerMap.standardLayer : mapPickerMap.hybridLayer;
    if (currentLayer) mapPickerMap.removeLayer(currentLayer);
    newLayer.addTo(mapPickerMap);
    mapPickerMap.currentLayer = newLayer;
  }

  // 5. Map-Picker schließen
  function closeMapPicker() {
    showMapPicker = false;
    if (mapPickerMap) {
      mapPickerMap.remove();
      mapPickerMap = null;
    }
  }

  // 6. Koordinaten speichern
  async function saveMapPickerCoords() {
    if (!mapPickerLat || !mapPickerLon || !image) return;
    const { error: updateError } = await supabase
      .from('items')
      .update({ lat: mapPickerLat, lon: mapPickerLon })
      .eq('id', image.id);
    if (!updateError) {
      closeMapPicker();
      // Ganze Seite neu laden, um alle Daten zu aktualisieren
      window.location.reload();
    } else {
      alert('Fehler beim Speichern der Koordinaten: ' + updateError.message);
    }
  }

  // 7. Suche (Nominatim)
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

  // Toggle für Map-Type in der Hauptkarte
  function toggleMapType() {
    mapType = mapType === 'standard' ? 'hybrid' : 'standard';
    if (map) {
      const leaflet = map.constructor;
      const standardLayer = map.standardLayer;
      const hybridLayer = map.hybridLayer;
      const currentLayer = map.currentLayer;
      const newLayer = mapType === 'standard' ? standardLayer : hybridLayer;
      if (currentLayer && newLayer && currentLayer !== newLayer) {
        map.removeLayer(currentLayer);
        newLayer.addTo(map);
        map.currentLayer = newLayer;
      }
    }
  }

  // File size fetching from loaded images
  let fileSizes: {
    size64: number | null;
    size512: number | null;
    size2048: number | null;
  } = {
    size64: null,
    size512: null,
    size2048: null
  };

  async function fetchFileSizes() {
    if (!image || !browser) return;
    
    try {
      // Get file sizes from the actual loaded images
      const img64 = document.querySelector('img[src*="images-64"]') as HTMLImageElement;
      const img512 = document.querySelector('img[src*="images-512"]') as HTMLImageElement;
      const img2048 = document.querySelector('img[src*="images-2048"]') as HTMLImageElement;

      if (img64) {
        const response = await fetch(img64.src);
        const blob = await response.blob();
        fileSizes.size64 = blob.size;
      }

      if (img512) {
        const response = await fetch(img512.src);
        const blob = await response.blob();
        fileSizes.size512 = blob.size;
      }

      if (img2048) {
        const response = await fetch(img2048.src);
        const blob = await response.blob();
        fileSizes.size2048 = blob.size;
      }
    } catch (error) {
      console.error('Error fetching file sizes:', error);
    }
  }

  // Fetch file sizes when image loads
  $: if (image && browser) {
    setTimeout(fetchFileSizes, 1000);
  }



  // Filename editing functions
  function startEditFilename() {
    if (!isCreator) return;
    editingFilename = true;
    filenameEditValue = image.original_name || '';
    setTimeout(() => {
      const input = document.getElementById('filename-edit-input') as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    }, 100);
  }

  async function saveFilename() {
    if (!editingFilename || !isCreator) return;
    editingFilename = false;
    
    const newFilename = filenameEditValue.trim();
    if (newFilename && newFilename !== image.original_name) {
      // Extrahiere die Dateiendung vom ursprünglichen Namen
      const originalExtension = getFileExtension(image.original_name || '');
      
      // Prüfe ob der neue Name bereits die korrekte Endung hat
      let finalFilename;
      if (newFilename.toLowerCase().endsWith(originalExtension.toLowerCase())) {
        // Dateiendung ist bereits vorhanden
        finalFilename = newFilename;
      } else {
        // Dateiendung fehlt, füge sie hinzu
        finalFilename = newFilename + originalExtension;
      }
      
      const { error } = await supabase
        .from('items')
        .update({ original_name: finalFilename })
        .eq('id', image.id);
      
      if (!error) {
        image.original_name = finalFilename;
        filenameEditValue = finalFilename;
      }
    }
  }

  function handleFilenameKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveFilename();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      editingFilename = false;
      filenameEditValue = image.original_name || '';
    }
  }

  // Helper function for filename
  function getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot >= 0 ? filename.substring(lastDot) : '';
  }

  // Filter functions
  function setUserFilter() {
    if (!profile) return;
    
    // Construct avatar URL
    let avatarUrl = undefined;
    if (profile.avatar_url) {
      if (profile.avatar_url.startsWith('http')) {
        avatarUrl = profile.avatar_url;
      } else {
        avatarUrl = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/avatars/${profile.avatar_url}`;
      }
    }
    
    filterStore.setUserFilter({
      userId: profile.id,
      username: profile.full_name,
      accountName: profile.accountname || undefined,
      avatarUrl: avatarUrl
    });
    
    // Navigate to gallery with filter
    goto('/');
  }

  function setLocationFilter() {
    if (!image?.lat || !image?.lon) return;
    
    filterStore.setLocationFilter({
      lat: image.lat,
      lon: image.lon,
      name: image.title || 'Standort',
      fromItem: true
    });
    
    // Navigate to gallery with filter
    goto('/');
  }

  export const prerender = false;

  // Extract itemId for SEO tags without relying on $page store
  let itemId: string = '';
  $: if (image?.id) {
    itemId = image.id;
  }

  // Gallery toggle function
  async function toggleGallery() {
    if (!isCreator || !image) return;
    
    try {
      const newGalleryValue = !(image.gallery ?? true);
      const { error } = await supabase
        .from('items')
        .update({ gallery: newGalleryValue })
        .eq('id', image.id);
      
      if (error) {
        console.error('Failed to toggle gallery flag:', error);
        alert('Fehler beim Ändern des Gallery-Status: ' + error.message);
        return;
      }
      
      image.gallery = newGalleryValue;
      console.log('Gallery flag toggled:', newGalleryValue);
    } catch (err) {
      console.error('Failed to toggle gallery flag:', err);
      alert('Fehler beim Ändern des Gallery-Status');
    }
  }

  // Funktionen für Nearby Gallery Toggle
  async function handleNearbyGalleryToggle(itemId: string, newGalleryValue: boolean) {
    if (!isCreator) return;
    try {
      const { error } = await supabase
        .from('items')
        .update({ gallery: newGalleryValue })
        .eq('id', itemId);
      if (error) {
        console.error('Failed to toggle nearby gallery flag:', error);
        alert('Fehler beim Ändern des Gallery-Status: ' + error.message);
        return;
      }
      
      // Update nearby items array - force reactivity by creating new array
      const updatedNearby = nearby.map(item => 
        item.id === itemId ? { ...item, gallery: newGalleryValue } : item
      );
      nearby = updatedNearby;
      
      console.log('Nearby gallery flag toggled:', itemId, newGalleryValue);
    } catch (err) {
      console.error('Failed to toggle nearby gallery flag:', err);
      alert('Fehler beim Ändern des Gallery-Status');
    }
  }

  function getNearbyGalleryStatus(itemId: string): boolean {
    const item = nearby.find(n => n.id === itemId);
    return item?.gallery ?? true;
  }

  // ... bestehender Code ...
  // ENTFERNE diese Zeile im unteren Bereich:
  // import { onMount } from "svelte";
  // ... bestehender Code ...
</script>

<svelte:head>
  <title>{image?.title || `Item ${itemId} - culoca.com`}</title>
  <meta name="description" content={image?.description || 'culoca.com - see you local, Deine Webseite für regionalen Content. Entdecke deine Umgebung immer wieder neu.'}>

  <!-- Open Graph -->
  <meta property="og:type" content="article">
  <meta property="og:title" content={image?.title || `Item ${itemId} - culoca.com`}>
  <meta property="og:description" content={image?.description || 'culoca.com - see you local, Deine Webseite für regionalen Content. Entdecke deine Umgebung immer wieder neu.'}>
  <meta property="og:url" content={`https://culoca.com/item/${itemId}`}> 
  <meta property="og:image" content={`https://culoca.com/api/og-image/${itemId}`}>
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content={image?.title || `Item ${itemId} - culoca.com`}>
  <meta name="twitter:description" content={image?.description || 'culoca.com - see you local, Deine Webseite für regionalen Content. Entdecke deine Umgebung immer wieder neu.'}>
  <meta name="twitter:image" content={`https://culoca.com/api/og-image/${itemId}`}>

  <!-- Additional SEO -->
  <meta name="robots" content="index, follow">
  <meta name="author" content="culoca.com">
  <link rel="canonical" href={`https://culoca.com/item/${itemId}`}>

  <!-- Immediate fallback for loading state -->
  {#if !image}
    <title>Item {itemId} - culoca.com</title>
    <meta property="og:title" content="Item {itemId} - culoca.com">
    <meta property="twitter:title" content="Item {itemId} - culoca.com">
  {/if}

  <meta name="debug-test" content="true">

</svelte:head>

<div class="page">
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <span>Lade Bild...</span>
    </div>
  {:else if error}
    <div class="error">❌ Fehler: {error}</div>
  {:else if image}
    <div class="content">
      {#if image && image.path_2048}
      <img
        src={"https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/" + image.path_2048}
        alt={image.title || image.description || image.original_name || 'Bild'}
        width={image.width}
        height={image.height}
        data-filename={image.original_name}
        loading="eager"
        style="display:block;max-width:100%;height:auto;margin:0 auto 2rem auto;"
      />
    {:else if image && image.path_512}
      <img
        src={"https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/" + image.path_512}
        alt={image.title || image.description || image.original_name || 'Bild'}
        width={image.width}
        height={image.height}
        data-filename={image.original_name}
        loading="eager"
        style="display:block;max-width:100%;height:auto;margin:0 auto 2rem auto;"
      />
    {/if}
      <ImageDisplay
        image={image}
        imageSource={image && image.path_2048 ? `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${image.path_2048}` : ''}
        darkMode={darkMode}
        isCreator={isCreator}
        editingTitle={editingTitle}
        titleEditValue={titleEditValue}
        editingDescription={editingDescription}
        descriptionEditValue={descriptionEditValue}
        startEditTitle={startEditTitle}
        saveTitle={saveTitle}
        cancelEditTitle={cancelEditTitle}
        handleTitleKeydown={handleTitleKeydown}
        startEditDescription={startEditDescription}
        saveDescription={saveDescription}
        cancelEditDescription={cancelEditDescription}
        handleDescriptionKeydown={handleDescriptionKeydown}
      />
      <ImageControlsSection
        {image}
        {isCreator}
        onSetLocationFilter={setLocationFilter}
        onCopyLink={copyLink}
        onDeleteImage={deleteImage}
        onDownloadOriginal={downloadOriginal}
        onToggleGallery={toggleGallery}
        darkMode={$darkMode}
        rotating={rotating}
      />
      {#if image && image.lat && image.lon}
        <RadiusControl
          bind:radius
          onRadiusInput={onRadiusInput}
          onRadiusChange={onRadiusChange}
          formatRadius={formatRadius}
          nearby={nearby}
          hiddenItems={hiddenItems}
          showHiddenItems={showHiddenItems}
          toggleHiddenItems={toggleHiddenItems}
        />
        <div class="edge-to-edge-gallery">
          {#if Array.isArray(nearby) && nearby.length > 0}
            <NearbyGallery
              nearby={nearby}
              layout={$globalLayoutStore ? 'justified' : 'grid'}
              userLat={image.lat}
              userLon={image.lon}
              getDistanceFromLatLonInMeters={getDistanceFromLatLonInMeters}
              isCreator={isCreator}
              onGalleryToggle={handleNearbyGalleryToggle}
              getGalleryStatus={getNearbyGalleryStatus}
            />
            <div bind:this={nearbySentinel} style="height: 1px;"></div>
            {#if isLoadingNearby}
              <div style="text-align:center; color:var(--text-secondary); margin:1rem;">Lade weitere Bilder...</div>
            {/if}
            {#if !hasMoreNearby}
              <div style="text-align:center; color:var(--text-secondary); margin:1rem;">Alle Bilder geladen.</div>
            {/if}
          {:else}
            <p class="no-nearby">
              Keine Items in der Nähe gefunden. Vergrößere den Radius oder es gibt keine anderen Items mit GPS-Koordinaten in der Nähe.
            </p>
          {/if}
          <!-- Meta Section jetzt direkt nach Nearby -->
          <div class="meta-section single-exif">
            <div class="keywords-column">
              <KeywordsSection
                keywordsList={keywordsList}
                isCreator={isCreator}
                editingKeywords={editingKeywords}
                keywordsEditValue={keywordsEditValue}
                keywordsCount={keywordsCount}
                keywordsValid={keywordsValid}
                keywordsTooMany={keywordsTooMany}
                startEditKeywords={startEditKeywords}
                saveKeywords={saveKeywords}
                cancelEditKeywords={cancelEditKeywords}
                handleKeywordsKeydown={handleKeywordsKeydown}
              />
              <FileDetails
                image={image}
                isCreator={isCreator}
                editingFilename={editingFilename}
                filenameEditValue={filenameEditValue}
                startEditFilename={startEditFilename}
                saveFilename={saveFilename}
                handleFilenameKeydown={handleFilenameKeydown}
                fileSizes={fileSizes}
                formatFileSize={formatFileSize}
                browser={browser}
              />
            </div>
            <div class="meta-column">
              <ImageMetaSection
                image={image}
                isCreator={isCreator}
              />
            </div>
            <div class="column-card">
              <CreatorCard
                profile={profile}
                isCreator={isCreator}
                setUserFilter={setUserFilter}
              />
            </div>
          </div>
        </div> <!-- edge-to-edge-gallery schließt hier -->

        <!-- Location / Sharing Section: Map-Section als eigener Block nach Meta-Section -->
        <div class="location-section" style="background: transparent;">
          <!-- Map aus Sicherung -->
          {#if image.lat && image.lon}
            <div class="map-wrapper">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.7rem;">
                {#if isCreator}
                  <button class="map-pin-btn" on:click={() => openMapPicker(image.lat, image.lon)} title="GPS ändern">
                    <!-- Culoca O SVG, Farbe per CSS -->
                    <svg width="28" height="34" viewBox="0 0 83.86 100.88" fill="none" xmlns="http://www.w3.org/2000/svg" class="culoca-o-edit">
                      <path d="M0,41.35c0-5.67,1.1-11.03,3.29-16.07,2.19-5.04,5.19-9.43,8.98-13.17,3.79-3.74,8.25-6.69,13.36-8.86,5.11-2.17,10.54-3.25,16.29-3.25s11.18,1.08,16.29,3.25c5.11,2.17,9.56,5.12,13.36,8.86,3.79,3.74,6.79,8.13,8.98,13.17,2.19,5.04,3.29,10.4,3.29,16.07s-1.1,11.03-3.29,16.07c-2.2,5.04-5.19,9.43-8.98,13.17-3.8,3.74-8.25,6.7-13.36,8.86-5.11,2.17-9.49,21.42-15.25,21.42s-12.23-19.25-17.34-21.42c-5.11-2.17-9.56-5.12-13.36-8.86-3.79-3.74-6.79-8.13-8.98-13.17-2.2-5.04-3.29-10.4-3.29-16.07ZM25.16,41.35c0,2.29.44,4.43,1.32,6.44.88,2.01,2.07,3.76,3.59,5.26,1.52,1.5,3.29,2.68,5.33,3.55,2.04.87,4.21,1.3,6.53,1.3s4.49-.43,6.53-1.3c2.04-.87,3.81-2.05,5.33-3.55,1.52-1.5,2.71-3.25,3.59-5.26.88-2.01,1.32-4.15,1.32-6.44s-.44-4.43-1.32-6.44c-.88-2.01-2.08-3.76-3.59-5.26-1.52-1.5-3.29-2.68-5.33-3.55-2.03-.87-4.21-1.3-6.53-1.3s-4.49.43-6.53,1.3c-2.04.87-3.81,2.05-5.33,3.55-1.52,1.5-2.72,3.25-3.59,5.26-.88,2.01-1.32,4.16-1.32,6.44Z"/>
                    </svg>
                  </button>
                {/if}
                <h2 class="map-title">{image.title || 'Standort'}</h2>
                <button class="location-filter-btn" on:click={setLocationFilter} title="Standort als Filter setzen">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                </button>
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
                <button class="map-pin-btn" on:click={() => openMapPicker(null, null)} title="GPS setzen">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21c-4.418 0-8-4.03-8-9 0-4.418 3.582-8 8-8s8 3.582 8 8c0 4.97-3.582 9-8 9zm0-13a4 4 0 100 8 4 4 0 000-8z"/></svg>
                </button>
              </div>
              <div style="padding: 20px; text-align: center; color: #666;">
                GPS-Daten nicht verfügbar<br>
                Lat: {image?.lat || 'null'}, Lon: {image?.lon || 'null'}
              </div>
            </div>
          {/if}

          <!-- Map-Picker Fullscreen Modal -->
          {#if showMapPicker}
            <div class="map-modal-fullscreen">
              <div class="map-modal-content-fullscreen">
                <div class="map-modal-header-fullscreen">
                  <!-- 64px Vorschaubild -->
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
        </div>
      {/if}
    </div>
  {:else}
    <div class="error">❌ Bild nicht gefunden</div>
  {/if}


  <!-- Scroll to Top Button -->
  {#if showScrollToTop}
    <button class="scroll-to-top" on:click={scrollToTop} aria-label="Nach oben scrollen">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
      </svg>
    </button>
  {/if}
  



</div>
<style>
:global(.meta-section.single-exif) {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    gap: 2rem;
    margin: 2rem 0 1.5rem;
    background: transparent;
    border-radius: 0;
    padding: 1rem;
    align-items: flex-start;
    overflow: hidden;
  }
.keywords-title.editable {
  cursor: pointer;
  transition: color .2s;
    background: transparent;
  }
.keywords-column h2,
.meta-column h2,
.column-card h2 {
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--text-primary);
  margin: 0 0 1rem;
    padding: 0;
  }
.filename-text {
    cursor: pointer;
  transition: color .2s;
    display: inline-block;
  padding: .25rem .5rem;
    border-radius: 4px;
  margin: -.25rem -.5rem;
}
.controls-section {
    position: relative;
  z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
  gap: .7rem;
  margin-bottom: .2rem;
    background: transparent;
  }

/* --- Map-Picker Fullscreen Modal Styles aus Backup 560634d --- */
.map-modal-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0,0,0,0.55);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.map-modal-content-fullscreen {
  background: #fff;
  border-radius: 0;
  box-shadow: none;
  padding: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 0;
  position: relative;
}
.map-modal-header-fullscreen {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 1rem;
  padding: 1.2rem 1.2rem 0.5rem 1.2rem;
  background: #fff;
  z-index: 2;
}
.map-picker-thumbnail {
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 2px solid #ddd;
}
.map-picker-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.map-search-input {
  flex: 1;
  font-size: 1.1rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid #ccc;
  margin-right: 1rem;
}
.map-search-results {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  margin: 0 1.2rem 0.5rem 1.2rem;
  max-height: 180px;
  overflow-y: auto;
  z-index: 3;
  position: relative;
}
.map-search-result {
  padding: 0.6rem 1rem;
  cursor: pointer;
  border-bottom: 1px solid #eee;
  font-size: 1rem;
}
.map-search-result:last-child {
  border-bottom: none;
}
.map-search-result:hover {
  background: var(--culoca-orange);
  color: white;
}
.map-picker-container-fullscreen {
  position: relative;
  flex: 1;
  width: 100vw;
  height: 100%;
  background: #eee;
  overflow: hidden;
}
.map-picker-leaflet-fullscreen {
  width: 100vw;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
}
.map-picker-pin {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 2;
  transform: translate(-50%, -100%);
  pointer-events: none;
}
.map-coords-fullscreen {
  padding: 0.7rem 1.2rem 0.5rem 1.2rem;
  font-size: 1.1rem;
}
.map-modal-footer-fullscreen {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  gap: 1.2rem;
  padding: 1.2rem;
  background: #fff;
  z-index: 2;
}
.map-cancel-btn, .map-confirm-btn {
  background: var(--accent-color);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: .5rem 1.5rem;
  font-weight: 600;
  cursor: pointer;
  font-size: 1rem;
  transition: background .2s, color .2s;
}
.map-cancel-btn:hover, .map-confirm-btn:hover {
  background: var(--culoca-orange);
  color: white;
}

/* Map-Container wie im Backup */
.map {
  height: 500px;
  width: 100%;
  background: transparent;
  border: none;
}

.scroll-to-top {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  width: 48px;
  height: 48px;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
  z-index: 1000;
  opacity: 0.85;
  transform: translateY(20px);
  animation: fadeInUp 0.3s ease forwards;
}
.scroll-to-top:hover {
  background: var(--culoca-orange);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
  opacity: 1;
}
.scroll-to-top svg {
  width: 24px;
  height: 24px;
}
@keyframes fadeInUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (max-width: 768px) {
  .scroll-to-top {
    bottom: 1rem;
    right: 1rem;
    width: 44px;
    height: 44px;
  }
  .scroll-to-top svg {
    width: 20px;
    height: 20px;
  }
}
@media (max-width: 900px) {
  .meta-section.single-exif {
    grid-template-columns: 1fr;
    padding: 1rem 0.5rem;
    gap: 1.5rem;
  }
  :global(.creator-title),
  :global(.avatar),
  :global(.avatar-placeholder),
  :global(.creator-contact),
  :global(.creator-socials),
  :global(.keywords-column),
  :global(.file-details),
  :global(.keywords-title),
  :global(.map-title) {
    text-align: center !important;
    align-items: center !important;
    justify-content: center !important;
    margin-left: auto;
    margin-right: auto;
  }
  :global(.keywords) {
    justify-content: center !important;
  }
}
@media (max-width: 1200px) {
  .meta-section.single-exif {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
  :global(.creator-title),
  :global(.avatar),
  :global(.avatar-placeholder),
  :global(.creator-contact),
  :global(.creator-socials),
  :global(.keywords-column),
  :global(.file-details),
  :global(.keywords-title),
  :global(.map-title) {
    text-align: center !important;
    align-items: center !important;
    justify-content: center !important;
    margin-left: auto;
    margin-right: auto;
  }
  :global(.keywords) {
    justify-content: center !important;
  }
}
</style> 