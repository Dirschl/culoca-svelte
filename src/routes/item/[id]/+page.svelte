<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { page } from '$app/stores';
  import Justified from '$lib/Justified.svelte';
  import { browser } from '$app/environment';
  import { tick } from 'svelte';
  import { darkMode } from '$lib/darkMode';

  let image: any = null;
  let loading = true;
  let error = '';
  let profile: any = null;
  let nearby: any[] = [];
  let radius = 500; // meters, default
  let radiusLoaded = false;
  let lastRadius = 500; // track radius changes
  let mapEl: HTMLDivElement;
  let map: any;
  let keywordsList: string[] = [];
  let useJustifiedLayout = true;
  let editingTitle = false;
  let titleEditValue = '';
  let currentUser: any = null;
  let editingDescription = false;
  let descriptionEditValue = '';
  let showScrollToTop = false;
  
  // Keywords editing
  let editingKeywords = false;
  let keywordsEditValue = '';
  
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

  onMount(async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      currentUser = user;

      // Radius aus localStorage laden (pro User oder anonym)
      if (browser && !radiusLoaded) {
        if (currentUser) {
          // Für eingeloggte User: spezifischer Radius pro User
          const storedRadius = localStorage.getItem(`detailRadius_${currentUser.id}`);
          if (storedRadius) {
            radius = parseInt(storedRadius, 10) || 500;
          }
        } else {
          // Für anonyme User: allgemeiner Radius
          const storedRadius = localStorage.getItem('detailRadius_anonymous');
          if (storedRadius) {
            radius = parseInt(storedRadius, 10) || 500;
          }
        }
        lastRadius = radius; // Initialize lastRadius with loaded value
        radiusLoaded = true;
      }

      const { data, error: fetchError } = await supabase
        .from('items')
        .select(`
          *,
          profiles!items_profile_id_fkey (
            id,
            full_name,
            avatar_url,
            show_address,
            address,
            show_phone,
            phone,
            show_email,
            email,
            show_website,
            website,
            show_social,
            instagram,
            facebook,
            twitter
          )
        `)
        .eq('id', imageId)
        .single();

      if (fetchError) {
        error = fetchError.message;
      } else {
        image = data;
        
        // Extract profile from joined data
        if (data.profiles) {
          profile = data.profiles;
        }
        
        console.log('📸 Image loaded:', { 
          id: image.id, 
          lat: image.lat, 
          lon: image.lon, 
          title: image.title,
          profile: profile ? profile.full_name : 'No profile'
        });
        if (!image.exif_data) image.exif_data = {};
        titleEditValue = image.title || '';
        filenameEditValue = image.original_name || '';
        descriptionEditValue = image.description || '';
        keywordsList = image.keywords || [];
        
        // Favicon sofort aktualisieren
        if (browser) {
          updateFavicon();
        }


      }
    } catch (err) {
      error = 'Failed to load image';
      console.error(err);
    }
    loading = false;
  });

  // Scroll to top functionality
  if (browser) {
    const handleScroll = () => {
      showScrollToTop = window.scrollY > 300;
    };
    
    window.addEventListener('scroll', handleScroll);
  }

  // Determine best image source
  $: imageSource = image ? (() => {
    const baseUrl = 'https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public';
    if (image.path_2048) {
      return `${baseUrl}/images-2048/${image.path_2048}`;
    }
    return `${baseUrl}/images-512/${image.path_512}`;
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

  async function downloadOriginal(imageId: string, originalName: string) {
    try {
      // Show loading state
      const downloadBtn = document.querySelector(`[data-download-id="${imageId}"]`) as HTMLButtonElement;
      if (downloadBtn) {
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" class="animate-spin">
            <circle cx="12" cy="12" r="10" fill="white" fill-opacity="0.15"/>
            <path d="M12 6v7m0 0l-3-3m3 3l3-3M6 18h12" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
      }

      // Get current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Bitte zuerst einloggen');
        return;
      }

      const response = await fetch(`/api/download/${imageId}`, {
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill="white" fill-opacity="0.15"/>
            <path d="M5 13l4 4L19 7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
        setTimeout(() => {
          downloadBtn.disabled = false;
          downloadBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" fill="white" fill-opacity="0.15"/>
              <path d="M12 6v7m0 0l-3-3m3 3l3-3M6 18h12" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill="white" fill-opacity="0.15"/>
            <path d="M12 6v7m0 0l-3-3m3 3l3-3M6 18h12" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
      }
    }
  }





  async function fetchNearbyImages(lat: number, lon: number, maxRadius: number) {
    console.log('🔍 Fetching nearby images for radius:', maxRadius, 'm');
    const { data, error: nearErr } = await supabase
      .from('items')
      .select('*')
      .not('lat', 'is', null)
      .not('lon', 'is', null)
      .neq('id', imageId);
    if (nearErr || !data) {
      console.log('❌ Error fetching nearby images:', nearErr);
      return;
    }
    console.log('📸 Found', data.length, 'images with GPS data');
    const baseUrl = 'https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public';
    nearby = data.map((img: any) => {
      const dist = getDistanceInMeters(lat, lon, img.lat, img.lon);
      return {
        id: img.id,
        lat: img.lat,
        lon: img.lon,
        distance: dist,
        src: `${baseUrl}/images-512/${img.path_512}`,
        srcHD: `${baseUrl}/images-2048/${img.path_2048}`,
        src64: img.path_64 ? `${baseUrl}/images-64/${img.path_64}` : `${baseUrl}/images-512/${img.path_512}`,
        width: img.width,
        height: img.height,
        title: img.title || null
      };
    }).filter((it: any) => it.distance <= maxRadius)
      .sort((a: any, b: any) => a.distance - b.distance);
    console.log('✅ Nearby images loaded:', nearby.length, 'images within', maxRadius, 'm');
    
    // Initialize lastNearbyCount if not set yet
    if (typeof lastNearbyCount === 'undefined') {
      lastNearbyCount = nearby.length;
    }
  }

  // Recompute nearby list whenever radius or image changes
  $: if (image && image.lat && image.lon) {
    fetchNearbyImages(image.lat, image.lon, radius);
  }

  async function initMap() {
    if (!browser || !image || !image.lat || !image.lon) return;
    const leaflet = await import('leaflet');
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    await tick();
    map = leaflet.map(mapEl).setView([image.lat, image.lon], 13);
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

    // Add nearby images as individual markers
    if (nearby.length > 0) {
      nearby.forEach((nearbyImage: any) => {
        const nearbyThumbnailUrl = nearbyImage.src64 || nearbyImage.src;
        const nearbyIcon = leaflet.divIcon({
          className: 'custom-marker nearby-image',
          html: `<img src="${nearbyThumbnailUrl}" alt="${nearbyImage.title || 'Bild'}" style="width: 48px; height: 48px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); object-fit: cover; cursor: pointer;">`,
          iconSize: [48, 48],
          iconAnchor: [48, 48],
          popupAnchor: [0, -48]
        });
        const nearbyMarker = leaflet.marker([nearbyImage.lat, nearbyImage.lon], { icon: nearbyIcon }).addTo(map);
        nearbyMarker.on('click', () => {
          window.location.href = `/item/${nearbyImage.id}`;
        });
        const popupContent = `
          <div style="text-align: center; min-width: 200px;">
            <strong>${nearbyImage.title || 'Bild'}</strong><br>
            <small>Entfernung: ${getDistanceFromLatLonInMeters(image.lat, image.lon, nearbyImage.lat, nearbyImage.lon)}</small><br>
            <a href="/item/${nearbyImage.id}" style="color: #0066cc; text-decoration: none; font-weight: 500;">Bild anzeigen →</a>
          </div>
        `;
        nearbyMarker.bindPopup(popupContent);
      });
    }

    // Fit map to show all markers if there are nearby images
    if (nearby.length > 0) {
      const allMarkers = [currentMarker];
      map.eachLayer((layer: any) => {
        if (layer !== currentMarker && layer._latlng) {
          allMarkers.push(layer);
        }
      });
      const group = leaflet.featureGroup(allMarkers);
      map.fitBounds(group.getBounds().pad(0.1));
    }
  }


  
  // Initialize map when image is loaded
  $: if (image && image.lat && image.lon && !map) {
    setTimeout(() => initMap(), 500);
  }
  
  // Reinitialize map when radius changes (only if map exists and radius is different)
  $: if (image && image.lat && image.lon && radiusLoaded && map && radius !== lastRadius) {
    console.log('🔄 Radius changed from', lastRadius, 'to', radius, 'm, reinitializing map');
    lastRadius = radius;
    map.remove();
    map = null;
    setTimeout(() => initMap(), 100);
  }
  
  // Also reinitialize map when nearby images change (for adding/removing markers)
  let lastNearbyCount = 0;
  $: if (image && image.lat && image.lon && map && nearby.length !== lastNearbyCount) {
    console.log('🔄 Nearby count changed from', lastNearbyCount, 'to', nearby.length, 'reinitializing map');
    lastNearbyCount = nearby.length;
    map.remove();
    map = null;
    setTimeout(() => initMap(), 100);
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
      const res = await fetch(`/api/item/${imageId}`, { method: 'DELETE' });
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
  $: isCreator = currentUser && image && image.profile_id === currentUser.id;

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

  if (typeof localStorage !== 'undefined') {
    const savedLayout = localStorage.getItem('galleryLayout');
    useJustifiedLayout = savedLayout === 'justified';
  }

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
    // Default: aktuelle User-Position holen
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
    if (!image) return;
    
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
  $: if (image) {
    // Wait a bit for images to load
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
</script>

<svelte:head>
  <title>{image?.title || 'culoca.com - see you local, Deine Webseite für regionalen Content. Entdecke deine Umgebung immer wieder neu.'}</title>
  <meta name="description" content={image?.description || 'culoca.com - see you local, Deine Webseite für regionalen Content. Entdecke deine Umgebung immer wieder neu.'}>

  <!-- Open Graph -->
  <meta property="og:type" content="article">
  <meta property="og:title" content={image?.title || 'culoca.com - see you local, Deine Webseite für regionalen Content. Entdecke deine Umgebung immer wieder neu.'}>
  <meta property="og:description" content={image?.description || 'culoca.com - see you local, Deine Webseite für regionalen Content. Entdecke deine Umgebung immer wieder neu.'}>
  <meta property="og:url" content={`https://culoca.com/item/${imageId}`}> 
  <meta property="og:image" content={`https://culoca.com/api/og-image/${imageId}`}> 
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content={image?.title || 'culoca.com - see you local, Deine Webseite für regionalen Content. Entdecke deine Umgebung immer wieder neu.'}>
  <meta name="twitter:description" content={image?.description || 'culoca.com - see you local, Deine Webseite für regionalen Content. Entdecke deine Umgebung immer wieder neu.'}>
  <meta name="twitter:image" content={`https://culoca.com/api/og-image/${imageId}`}> 


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
      <!-- Main Image with Passepartout Effect -->
      <div class="passepartout-container" class:dark={$darkMode}>
        <a href="/" class="image-link">
          <img
            src={imageSource}
            alt={image.title || image.original_name || `Image ${image.id}`}
            class="main-image"
          />
        </a>
        
        <!-- Image Information inside Passepartout -->
        <div class="passepartout-info">
          <h1 class="title" class:editable={isCreator} class:editing={editingTitle}>
            {#if editingTitle}
              <div class="title-edit-container">
                <input
                  id="title-edit-input"
                  type="text"
                  bind:value={titleEditValue}
                  maxlength="60"
                  on:keydown={handleTitleKeydown}
                  on:blur={saveTitle}
                  class="title-edit-input"
                  class:valid={titleEditValue.length >= 40}
                  placeholder="Titel eingeben..."
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="sentences"
                  inputmode="text"
                />
                <span class="char-count" class:valid={titleEditValue.length >= 40}>
                  {titleEditValue.length}/60
                </span>
              </div>
            {:else}
              <span class="title-text" on:click={startEditTitle}>
                {image.title || image.original_name || `Bild ${image.id.substring(0, 8)}...`}
              </span>
            {/if}
          </h1>
          

            <p class="description" class:editable={isCreator} class:editing={editingDescription}>
              {#if editingDescription}
                <div class="description-edit-container">
                  <textarea
                    id="description-edit-input"
                    bind:value={descriptionEditValue}
                    maxlength="160"
                    on:keydown={handleDescriptionKeydown}
                    on:blur={saveDescription}
                    class="description-edit-input"
                    class:valid={descriptionEditValue.length >= 140}
                    placeholder="Beschreibung eingeben..."
                    rows="3"
                    autocomplete="off"
                    autocorrect="off"
                    autocapitalize="sentences"
                    inputmode="text"
                  ></textarea>
                  <span class="char-count" class:valid={descriptionEditValue.length >= 140}>
                    {descriptionEditValue.length}/160
                  </span>
                </div>
              {:else}
                <span class="description-text" on:click={startEditDescription}>
                  {#if image.description}
                    {image.description}
                  {:else}
                    <span class="placeholder">Keine Beschreibung verfügbar</span>
                  {/if}
                </span>
              {/if}
            </p>
        </div>
      </div>

      <!-- Transition Area with Shadow -->
      <div class="transition-area" class:dark={$darkMode}>
        <div class="shadow-overlay"></div>
        
        <!-- Controls Section -->
        <div class="controls-section">
          {#if image.lat && image.lon}
            <div class="action-buttons">
              <a class="gmaps-btn" href={`https://www.google.com/maps?q=${image.lat},${image.lon}`} target="_blank" rel="noopener">Google Maps</a>
              <button class="share-btn" on:click={copyLink}>Link kopieren</button>
              {#if isCreator}
                <button class="delete-btn" on:click={deleteImage} title="Bild löschen">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                  </svg>
                </button>
              {/if}
              {#if isCreator}
                <button class="gmaps-btn" data-download-id={image.id} on:click={() => downloadOriginal(image.id, image.original_name)} title="Original herunterladen">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" fill="white" fill-opacity="0.15"/>
                    <path d="M12 6v7m0 0l-3-3m3 3l3-3M6 18h12" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
              {/if}
            </div>
          {/if}

          <!-- Radius-Control: Nur Wert, zentriert -->
          {#if image.lat && image.lon}
            <div class="radius-control">
              <div class="radius-value">{formatRadius(radius)}</div>
              <input id="radius" type="range" min="50" max="5000" step="50" bind:value={radius}>
            </div>
          {/if}
        </div>
      </div>

      <!-- Image Information -->
      <div class="info-section">
        <div class="centered-content">

          {#if image.lat && image.lon && nearby.length}
            <div class="edge-to-edge-gallery">
              {#if useJustifiedLayout}
                <div class="justified-wrapper">
                  <Justified
                    items={nearby}
                    gap={2}
                    showDistance={true}
                    userLat={image.lat}
                    userLon={image.lon}
                    getDistanceFromLatLonInMeters={getDistanceFromLatLonInMeters}
                  />
                </div>
              {:else}
                <div class="grid-layout">
                  {#each nearby as img}
                    <div class="grid-item" on:click={() => window.location.href = `/item/${img.id}` } tabindex="0" role="button" aria-label={`Bild ${img.title || img.id}` } title={img.title || ''}>
                      <img src={img.src} alt={img.title || 'Bild'} />
                      <div class="distance-label">
                        {getDistanceFromLatLonInMeters(image.lat, image.lon, img.lat, img.lon)}
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}


        </div>

        <!-- Meta Section: three columns -->
        <div class="meta-section single-exif">
          <!-- Column 1: Keywords -->
          <div class="keywords-column">
            <h2 class="keywords-title" class:editable={isCreator} class:editing={editingKeywords} on:click={startEditKeywords}>
              Keywords
            </h2>
            
            {#if editingKeywords}
              <div class="keywords-edit-container">
                <textarea
                  id="keywords-edit-input"
                  bind:value={keywordsEditValue}
                  maxlength="500"
                  on:keydown={handleKeywordsKeydown}
                  on:blur={saveKeywords}
                  class="keywords-edit-input"
                  class:valid={keywordsValid}
                  class:too-many={keywordsTooMany}
                  placeholder="Keywords durch Kommas getrennt eingeben..."
                  rows="8"
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="sentences"
                ></textarea>
                <span class="char-count" class:valid={keywordsValid} class:too-many={keywordsTooMany}>
                  {keywordsCount}/50
                </span>
              </div>
            {:else}
              {#if keywordsList.length}
                <div class="keywords">
                  {#each keywordsList as kw}
                    <a href="/?s={encodeURIComponent(kw)}" class="chip keyword-link">{kw}</a>
                  {/each}
                </div>
              {:else}
                <div class="keywords-placeholder">
                  {isCreator ? 'Klicke auf "Keywords" um welche hinzuzufügen' : 'Keine Keywords verfügbar'}
                </div>
              {/if}
            {/if}
            
            <h2>File Details</h2>
            <div class="filename" class:editable={isCreator} class:editing={editingFilename}>
              {#if editingFilename}
                <div class="filename-edit-container">
                  <input
                    id="filename-edit-input"
                    type="text"
                    bind:value={filenameEditValue}
                    maxlength="120"
                    on:keydown={handleFilenameKeydown}
                    on:blur={saveFilename}
                    class="filename-edit-input"
                    placeholder="Dateiname eingeben..."
                    autocomplete="off"
                    autocorrect="off"
                    autocapitalize="words"
                    inputmode="text"
                  />
                  <span class="char-count">
                    {filenameEditValue.length}/120
                  </span>
                </div>
              {:else}
                <span class="filename-text" on:click={startEditFilename}>
                  {image.original_name || 'Unbekannt'}
                </span>
              {/if}
            </div>
            <div class="filename">
              {browser ? window.location.href : ''}
            </div>
            <div class="filename">
              64px: {fileSizes.size64 ? formatFileSize(fileSizes.size64) : 'unbekannt'}  |  512px: {fileSizes.size512 ? formatFileSize(fileSizes.size512) : 'unbekannt'}  |  2048px: {fileSizes.size2048 ? formatFileSize(fileSizes.size2048) : 'unbekannt'}
            </div>
          </div>
          <!-- Column 2: All EXIF/Meta -->
          <div class="meta-column">
            <h2 class="exif-toggle" on:click={() => showFullExif = !showFullExif}>Aufnahmedaten</h2>
            
            {#if !showFullExif}
              <!-- Essential EXIF data -->
              <!-- Auflösung (aus Original-Bild) -->
              {#if image.width && image.height}
                <div class="meta-line">Auflösung: {image.width}×{image.height} px</div>
              {/if}
              
              <!-- Dateigröße -->
              {#if image.exif_data && image.exif_data.FileSize}
                <div class="meta-line">Dateigröße: {formatFileSize(image.exif_data.FileSize)}</div>
              {/if}
              
              <!-- Kamera -->
              {#if image.exif_data && image.exif_data.Make}
                <div class="meta-line">Kamera: {image.exif_data.Make} {image.exif_data.Model || ''}</div>
              {/if}
              
              <!-- Objektiv -->
              {#if image.exif_data && image.exif_data.LensModel}
                <div class="meta-line">Objektiv: {image.exif_data.LensModel}</div>
              {/if}
              
              <!-- Brennweite -->
              {#if image.exif_data && image.exif_data.FocalLength}
                <div class="meta-line">Brennweite: {image.exif_data.FocalLength} mm{#if image.exif_data.FocalLengthIn35mmFormat && image.exif_data.FocalLengthIn35mmFormat !== image.exif_data.FocalLength} (35mm: {image.exif_data.FocalLengthIn35mmFormat} mm){/if}</div>
              {/if}
              
              <!-- ISO -->
              {#if image.exif_data && image.exif_data.ISO}
                <div class="meta-line">ISO: {image.exif_data.ISO}</div>
              {/if}
              
              <!-- Blende -->
              {#if image.exif_data && image.exif_data.FNumber}
                <div class="meta-line">Blende: ƒ/{image.exif_data.FNumber}</div>
              {/if}
              
              <!-- Verschlusszeit -->
              {#if image.exif_data && image.exif_data.ExposureTime}
                <div class="meta-line">Verschlusszeit: {formatExposureTime(image.exif_data.ExposureTime)}</div>
              {/if}
              
              <!-- Aufnahmedatum -->
              {#if image.exif_data && image.exif_data.CreateDate}
                <div class="meta-line">Aufgenommen: {new Date(image.exif_data.CreateDate).toLocaleDateString('de-DE')}</div>
              {/if}
              
              <!-- GPS-Daten -->
              {#if image.lat && image.lon}
                <div class="meta-line">GPS: {image.lat.toFixed(5)}, {image.lon.toFixed(5)}</div>
              {/if}
              
              <!-- Fotograf -->
              {#if image.exif_data && image.exif_data.Artist}
                <div class="meta-line">Fotograf: {image.exif_data.Artist}</div>
              {/if}
              
              <!-- Copyright -->
              {#if image.exif_data && image.exif_data.Copyright}
                <div class="meta-line">Copyright: {image.exif_data.Copyright}</div>
              {/if}
              
              <!-- Upload-Datum -->
              {#if image.created_at}
                <div class="meta-line">Veröffentlicht am: {new Date(image.created_at).toLocaleDateString('de-DE')}</div>
              {/if}
            {:else}
              <!-- Full EXIF data -->
              {#if image.width && image.height}
                <div class="meta-line">Auflösung: {image.width}×{image.height} px</div>
              {/if}
              
              {#if image.exif_data && image.exif_data.FileSize}
                <div class="meta-line">Dateigröße: {formatFileSize(image.exif_data.FileSize)}</div>
              {/if}
              
              {#if image.exif_data && image.exif_data.Make}
                <div class="meta-line">Kamera: {image.exif_data.Make} {image.exif_data.Model || ''}</div>
              {/if}
              
              {#if image.exif_data && image.exif_data.LensModel}
                <div class="meta-line">Objektiv: {image.exif_data.LensModel}</div>
              {/if}
              
              {#if image.exif_data && image.exif_data.FocalLength}
                <div class="meta-line">Brennweite: {image.exif_data.FocalLength} mm{#if image.exif_data.FocalLengthIn35mmFormat && image.exif_data.FocalLengthIn35mmFormat !== image.exif_data.FocalLength} (35mm: {image.exif_data.FocalLengthIn35mmFormat} mm){/if}</div>
              {/if}
              
              {#if image.exif_data && image.exif_data.ISO}
                <div class="meta-line">ISO: {image.exif_data.ISO}</div>
              {/if}
              
              {#if image.exif_data && image.exif_data.FNumber}
                <div class="meta-line">Blende: ƒ/{image.exif_data.FNumber}</div>
              {/if}
              
              {#if image.exif_data && image.exif_data.ExposureTime}
                <div class="meta-line">Verschlusszeit: {formatExposureTime(image.exif_data.ExposureTime)}</div>
              {/if}
              
              {#if image.exif_data && image.exif_data.Orientation}
                <div class="meta-line">Ausrichtung: {image.exif_data.Orientation}</div>
              {/if}
              
              {#if image.exif_data && image.exif_data.CreateDate}
                <div class="meta-line">Aufgenommen: {new Date(image.exif_data.CreateDate).toLocaleDateString('de-DE')}</div>
              {/if}
              
              {#if image.lat && image.lon}
                <div class="meta-line">GPS: {image.lat.toFixed(5)}, {image.lon.toFixed(5)}</div>
              {/if}
              
              {#if image.exif_data && image.exif_data.Artist}
                <div class="meta-line">Fotograf: {image.exif_data.Artist}</div>
              {/if}
              
              {#if image.exif_data && image.exif_data.Copyright}
                <div class="meta-line">Copyright: {image.exif_data.Copyright}</div>
              {/if}
              
              {#if image.created_at}
                <div class="meta-line">Veröffentlicht am: {new Date(image.created_at).toLocaleDateString('de-DE')}</div>
              {/if}
              
              <!-- Additional selected EXIF fields -->
              {#if image.exif_data}
                
                <!-- Blitz -->
                {#if image.exif_data.Flash}
                  <div class="meta-line">Blitz: {image.exif_data.Flash}</div>
                {/if}
                
                <!-- Software -->
                {#if image.exif_data.Software}
                  <div class="meta-line">Software: {image.exif_data.Software}</div>
                {/if}
                
                <!-- Aufnahmezeit -->
                {#if image.exif_data.TimeCreated}
                  <div class="meta-line">Aufnahmezeit: {formatTimeCreated(image.exif_data.TimeCreated)}</div>
                {/if}
                
              {/if}
            {/if}
          </div>
          <!-- Column 3: Creator Card (if available) -->
          <div class="column-card">
            <h2>Ersteller</h2>
            {#if profile}
              {#if profile.avatar_url}
                <img src={profile.avatar_url.startsWith('http') ? profile.avatar_url : `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/avatars/${profile.avatar_url}`} alt="Avatar" class="avatar"/>
              {/if}
              <div class="creator-details">
                <h3>{profile.full_name}</h3>
                
                <!-- Address Information -->
                <div class="creator-address">
                  {#if profile.show_address && profile.address}
                    <div>{@html profile.address.replace(/\n/g, '<br>')}</div>
                  {/if}
                </div>
                
                <!-- Contact Information -->
                <div class="creator-contact">
                  {#if profile.show_phone && profile.phone}
                    <div>
                      <svg class="contact-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                      </svg>
                      <a href="tel:{profile.phone}">{profile.phone}</a>
                    </div>
                  {/if}
                  {#if profile.show_email && profile.email}
                    <div>
                      <svg class="contact-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                      </svg>
                      <a href="mailto:{profile.email}">{profile.email}</a>
                    </div>
                  {/if}
                  {#if profile.show_website && profile.website}
                    <div>
                      <svg class="contact-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                      </svg>
                      <a href="{profile.website}" target="_blank" rel="noopener noreferrer">{profile.website}</a>
                    </div>
                  {/if}
                </div>
                
                <!-- Social Media -->
                <div class="creator-socials">
                  {#if profile.show_social && profile.instagram}
                    <a href="{profile.instagram}" target="_blank" rel="noopener noreferrer" class="social-link">
                      <svg class="social-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                    </a>
                  {/if}
                  {#if profile.show_social && profile.facebook}
                    <a href="{profile.facebook}" target="_blank" rel="noopener noreferrer" class="social-link">
                      <svg class="social-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    </a>
                  {/if}
                  {#if profile.show_social && profile.twitter}
                    <a href="{profile.twitter}" target="_blank" rel="noopener noreferrer" class="social-link">
                      <svg class="social-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                      </svg>
                    </a>
                  {/if}
                </div>
                
                <!-- Bio/Description -->
                {#if profile.show_bio && profile.bio}
                  <div class="creator-bio">
                    <div>{@html profile.bio.replace(/\n/g, '<br>')}</div>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        </div>

        <!-- Location / Sharing Section -->
        <div class="location-section" style="background: transparent;">
          <!-- Map -->
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
                <button class="map-type-btn" on:click={toggleMapType} title={mapType === 'standard' ? 'Satellit' : 'Standard'}>
                  {#if mapType === 'standard'}
                    <!-- Satelliten-Icon (zeigt: zur Satellitenansicht wechseln) -->
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="11" y="3" width="2" height="7" rx="1"/><rect x="11" y="14" width="2" height="7" rx="1"/><rect x="3" y="11" width="7" height="2" rx="1"/><rect x="14" y="11" width="7" height="2" rx="1"/><circle cx="12" cy="12" r="3"/><path d="M7 7l3 3"/><path d="M17 17l-3-3"/></svg>
                  {:else}
                    <!-- Karten-Icon (zeigt: zur Kartenansicht wechseln, FAB-Style) -->
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
      </div>
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
  /* Night Blue Theme - Same as main page */
  :global(html, body) {
    background: var(--bg-primary);
    color: var(--text-primary);
    margin: 0;
    padding: 0;
    font-family: system-ui, -apple-system, sans-serif;
    min-height: 100vh;
    width: 100%;
    overflow-x: hidden;
  }

  :global(*) {
    box-sizing: border-box;
  }

  .page {
    background: var(--bg-primary);
    color: var(--text-primary);
    min-height: 100vh;
    padding: 0;
    overflow-x: hidden;
  }

  /* Loading & Error States */
  .loading, .error {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    min-height: 400px;
    color: #ccc;
    background: transparent;
  }

  .error {
    color: #ff6b6b;
    background: transparent;
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #2d2d44;
    border-top: 2px solid #0066cc;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    background: transparent;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Main Content */
  .content {
    padding: 0;
    background: transparent;
  }

  /* Passepartout Effect - Photo in Photo Card */
  .passepartout-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    width: 100%;
    padding: 12px 12px 12px 12px;
    background: #f5f5f5;
    margin: 0 auto;
    overflow: hidden;
  }

  .passepartout-container.dark {
    background: #1a1a1a; /* Dark photo card background */
    overflow: hidden;
  }

  .passepartout-info {
    margin-top: 1.5rem;
    text-align: center;
    width: 100%;
    padding: 0.7rem 0.5rem 0.5rem 0.5rem;
    background: transparent;
  }

  .main-image {
    display: block;
    width: auto;
    max-height: 800px; /* Max height for all resolutions */
    max-width: 100%;
    object-fit: contain;
    border: 1px solid #ffffff; /* White border around the image */
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    background: transparent;
  }

  /* Info Section */
  .info-section {
    background: var(--bg-primary);
    color: var(--text-primary);
    margin-top: 0;
    padding: 0;
  }

  .title {
    font-size: 1.8rem;
    font-weight: 600;
    color: white;
    margin: 0 0 1rem 0;
    line-height: 1.3;
    background: transparent;
  }

  /* Light mode title styling */
  .passepartout-container:not(.dark) .title {
    color: #4a4a4a; /* Noble gray for light mode */
    font-weight: 700;
    background: transparent;
  }

  .description {
    font-size: 1rem;
    color: #ccc;
    line-height: 1.6;
    margin: 0 0 0.5rem 0;
    background: transparent;
  }

  /* Light mode description styling */
  .passepartout-container:not(.dark) .description {
    color: #6b6b6b; /* Noble gray for light mode */
    font-weight: 500;
    background: transparent;
  }

  .description.placeholder {
    color: #666;
    font-style: italic;
    background: transparent;
  }

  /* Light mode placeholder styling */
  .passepartout-container:not(.dark) .description.placeholder {
    color: #999;
    font-style: italic;
    background: transparent;
  }



  /* Tablet: Reduzierter Border */
  @media (max-width: 768px) {
    .main-image {
      border-width: 0.5px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
    }
  }

  @media (max-width: 480px) {
    .passepartout-container {
      padding: 0; /* Randlos */
    }

    .passepartout-info {
      margin-top: 1.5rem;
      padding: 0 0.75rem; /* Padding nur für den Inhalt */
    }

    /* Border entfernen für kleine Bildschirme */
    .main-image {
      border: none;
      box-shadow: none;
    }

    /* Randlose Darstellung für Justified und Grid */
    .info-section .edge-to-edge-gallery,
    .info-section .justified-wrapper,
    .info-section .grid-layout {
      margin-left: 0;
      margin-right: 0;
      width: 100%;
      padding-left: 0;
      padding-right: 0;
    }

    /* Zusätzliche Sicherheit für sehr kleine Bildschirme */
    .edge-to-edge-gallery {
      overflow: hidden;
      width: 100%;
    }

    .title {
      font-size: 1.2rem;
    }
  }

  /* Sehr kleine Bildschirme */
  @media (max-width: 360px) {
    .info-section .edge-to-edge-gallery,
    .info-section .justified-wrapper,
    .info-section .grid-layout {
      margin: 0;
      padding: 0;
      width: 100vw;
      max-width: 100vw;
    }

    .creator-socials {
      justify-content: center;
      flex-wrap: wrap;
    }

    .social-link {
      width: 36px;
      height: 36px;
    }

    .social-icon {
      width: 22px;
      height: 22px;
    }
  }

  /* Transition Area with Shadow */
  .transition-area {
    position: relative;
    background: var(--bg-secondary);
    padding: 1rem 0.5rem;
    margin-top: -2px;
    overflow: hidden;
  }

  .transition-area.dark {
    background: #18181b;
  }

  .shadow-overlay {
    position: absolute;
    top: -12px;
    left: 0;
    right: 0;
    height: 12px;
    background: linear-gradient(to bottom, rgba(0,0,0,0.12) 0%, transparent 100%);
    pointer-events: none;
  }

  .transition-area.dark .shadow-overlay {
    background: linear-gradient(to bottom, rgba(0,0,0,0.22) 0%, transparent 100%);
  }

  .controls-section {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.7rem;
    margin-bottom: 0.2rem;
    background: transparent;
  }

  .action-buttons {
    display: flex;
    gap: 0.7rem;
    justify-content: center;
    margin-top: 0;
    margin-bottom: 0.2rem;
    background: transparent;
  }
  .gmaps-btn,
  .share-btn,
  .delete-btn {
    background: var(--accent-color);
    color: #fff;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    font-size: 0.9rem;
    cursor: pointer;
    text-decoration: none;
    transition: background-color 0.2s ease;
  }
  .share-btn { 
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  .delete-btn {
    background: #dc2626;
    color: #fff;
    border: 1px solid #dc2626;
    padding: 0.5rem 0.75rem;
  }
  .gmaps-btn:hover {
    background: var(--accent-hover);
  }
  .share-btn:hover { 
    background: var(--border-color);
  }
  .delete-btn:hover {
    background: #b91c1c;
    border-color: #b91c1c;
  }
  .coords { color: var(--text-secondary); margin-bottom: 0.5rem; background: transparent; }
  .keywords { display:flex; flex-wrap:wrap; gap:0.5rem; margin:0 0 2rem; background: transparent; }
  .chip { 
    background: var(--bg-tertiary); 
    padding: 0.25rem 0.75rem; 
    border-radius: 999px; 
    font-size: 0.8rem; 
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
  }
  .map-wrapper { 
    width:100%; 
    border: none;
    margin-bottom:0;
    background: transparent; 
  }
  
  .map-title {
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 1rem 0;
    padding: 1rem 1rem 0 1rem;
    text-align: left;
  }
  
  .map { 
    height:500px; 
    width:100%; 
    background: transparent; 
    border: none;
  }
  
  /* Custom marker styles */
  .custom-marker {
    transition: transform 0.2s ease;
  }
  
  .custom-marker:hover {
    transform: scale(1.1);
  }
  
  .custom-marker.current-image {
    z-index: 1000;
  }
  
  .custom-marker.nearby-image {
    z-index: 999;
  }
  

  .image-link {
    display: block;
    width: 100%;
    height: 100%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
  }
  .centered-content {
    text-align: center;
    margin-bottom: 2rem;
    background: transparent;
    padding: 0;
  }
  .radius-control {
    width: 100%;
    margin: 0.2rem 0 0.1rem 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: transparent;
  }
  .radius-value {
    color: var(--text-secondary);
    font-weight: 500;
    font-size: 1rem;
    margin-bottom: 0.1rem;
    text-align: center;
    background: transparent;
  }
  .radius-control input[type="range"] {
    width: 100%;
    background: transparent;
  }
  .published-date {
    color: var(--text-muted);
    font-size: 0.9rem;
    margin-top: 1rem;
    background: transparent;
  }

  /* Metadata Grid */
  .metadata {
    background: var(--bg-tertiary);
    border-radius: 0;
    padding: 1.5rem;
    margin-top: 1rem;
    overflow: hidden;
  }

  .meta-section.single-exif {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    gap: 2rem;
    margin: 2rem 0 1.5rem 0;
    background: transparent;
    border-radius: 0;
    padding: 1rem;
    align-items: flex-start;
    overflow: hidden;
  }
  .meta-column, .column-card, .keywords-column {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    background: transparent;
  }

  .meta-column h2, .column-card h2, .keywords-column h2 {
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 1rem 0;
    padding: 0;
  }
  
  .exif-toggle {
    cursor: pointer;
    transition: color 0.2s ease;
  }
  
  .exif-toggle:hover {
    color: var(--culoca-orange);
  }

  .filename {
    color: var(--text-secondary);
    font-size: 0.9rem;
    font-family: 'Courier New', monospace;
    word-break: break-all;
  }
  .meta-line {
    color: var(--text-secondary);
    font-size: 0.85em;
    padding: 0.05em 0;
    word-break: break-word;
    background: transparent;
  }
  .column-card {
    background: transparent;
    box-shadow: none;
    padding: 0;
    border-radius: 0;
  }
  .avatar {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    object-fit: cover;
    margin-bottom: 0.5rem;
    background: transparent;
  }
  @media (max-width: 900px) {
    .meta-section.single-exif {
      grid-template-columns: 1fr;
      padding: 1rem 0.5rem;
      gap: 1.5rem;
    }
    
    .keywords-column, .meta-column, .column-card {
      text-align: center;
    }
    
    .keywords {
      justify-content: center;
    }
    
    .avatar {
      margin: 0 auto 0.5rem auto;
    }

    .creator-contact {
      justify-content: center;
      align-items: center;
    }
    .creator-socials {
      justify-content: center;
    }
  }

  @media (max-width: 1200px) {
    .meta-section.single-exif {
      grid-template-columns: 1fr;
      gap: 2rem;
    }
    
    .keywords-column, .meta-column, .column-card {
      text-align: center;
    }
    
    .keywords {
      justify-content: center;
    }
    
    .avatar {
      margin: 0 auto 0.5rem auto;
    }

    .creator-contact {
      justify-content: center;
      align-items: center;
    }
    .creator-socials {
      justify-content: center;
    }
  }

  .creator-details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: transparent;
  }
  .creator-address {
    margin-bottom: 0.5rem;
    color: var(--text-secondary);
    font-size: 0.95em;
    line-height: 1.3;
    background: transparent;
  }
  .creator-contact {
    margin-bottom: 0.5rem;
    color: var(--text-secondary);
    font-size: 0.95em;
    line-height: 1.3;
    background: transparent;
  }
  .creator-contact {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: transparent;
  }
  
  .creator-contact > div {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .contact-icon {
    width: 16px;
    height: 16px;
    color: var(--text-secondary);
    flex-shrink: 0;
  }
  
  .creator-contact a {
    color: var(--text-secondary);
    text-decoration: none;
  }
  .creator-contact a:hover {
    color: var(--culoca-orange);
    text-decoration: underline;
  }
  
  .creator-bio {
    margin-top: 0.5rem;
    color: var(--text-secondary);
    font-size: 0.9em;
    line-height: 1.4;
    background: transparent;
  }
  .creator-socials {
    margin-top: 0.5rem;
    display: flex;
    gap: 0.5rem;
    align-items: center;
    background: transparent;
  }
  .social-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    color: var(--text-secondary);
    text-decoration: none;
    border-radius: 4px;
    transition: all 0.2s ease;
    background: transparent;
  }
  .social-icon {
    width: 20px;
    height: 20px;
    color: var(--text-secondary);
  }
  .social-link:hover {
    background: var(--bg-tertiary);
    transform: scale(1.1);
  }
  .social-link:hover .social-icon {
    color: var(--culoca-orange);
  }

  /* Scroll to Top Button */
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
    opacity: 0;
    transform: translateY(20px);
    animation: fadeInUp 0.3s ease forwards;
  }

  .scroll-to-top:hover {
    background: var(--culoca-orange);
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
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
    
    .map-title {
      text-align: center;
    }
  }

  .edge-to-edge-gallery {
    width: 100%;
    margin: 0 auto;
  }

  .justified-wrapper {
    width: 100%;
    margin: 0;
    padding: 0;
    background: transparent;
    border: none;
    box-shadow: none;
  }

  @media (max-width: 768px) {
    .edge-to-edge-gallery {
      width: 100%;
      margin: 0 auto;
    }
  }
  @media (max-width: 480px) {
    .edge-to-edge-gallery {
      width: 100%;
      margin: 0 auto;
    }
  }

  /* Title editing styles */
  .title.editable {
    cursor: pointer;
    transition: color 0.2s;
    background: transparent;
  }

  .title.editable:hover {
    color: #ee731f;
    background: transparent;
  }

  .title-text {
    cursor: pointer;
    transition: color 0.2s;
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    margin: -0.25rem -0.5rem;
  }

  .title.editable:hover .title-text {
    color: var(--culoca-orange);
  }

  .title.editing .title-text {
    display: none;
  }

  .title-edit-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    justify-content: center;
    background: transparent;
  }

  .title-edit-input {
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 1.5rem;
    font-weight: bold;
    padding: 0.5rem;
    text-align: center;
    width: 100%;
    transition: border-color 0.2s, background-color 0.3s ease, color 0.3s ease;
    /* Mobile optimizations */
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    font-size: 16px; /* Prevents zoom on iOS */
  }

  .title-edit-input:focus {
    outline: none;
    border-color: var(--accent-color);
    background: var(--bg-tertiary);
  }

  .title-edit-input.valid {
    border-color: var(--success-color);
    background: var(--bg-secondary);
  }

  .char-count {
    font-size: 0.8rem;
    color: var(--text-muted);
    min-width: 40px;
    text-align: right;
    background: transparent;
    transition: color 0.3s ease;
  }

  .char-count.valid {
    color: var(--success-color);
    background: transparent;
  }

  @media (max-width: 768px) {
    .title-edit-container {
      flex-direction: column;
      gap: 0.25rem;
    }
    
    .title-edit-input {
      font-size: 1.2rem;
    }
  }

  /* Description editing styles */
  .description.editable {
    cursor: pointer;
    transition: color 0.2s;
    background: transparent;
  }

  .description.editable:hover {
    color: #ee731f;
    background: transparent;
  }

  .description-text {
    cursor: pointer;
    transition: color 0.2s;
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    margin: -0.25rem -0.5rem;
  }

  .description.editable:hover .description-text {
    color: var(--culoca-orange);
  }

  .description.editing .description-text {
    display: none;
  }

  .description-edit-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 1rem 0 2rem 0;
    background: transparent;
  }

  .description-edit-input {
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 1rem;
    padding: 0.5rem;
    width: 100%;
    min-height: 100px;
    resize: vertical;
    transition: border-color 0.2s, background-color 0.3s ease, color 0.3s ease;
    /* Mobile optimizations */
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    font-size: 16px; /* Prevents zoom on iOS */
  }

  .description-edit-input:focus {
    outline: none;
    border-color: var(--accent-color);
    background: var(--bg-tertiary);
  }

  .description-edit-input.valid {
    border-color: var(--success-color);
    background: var(--bg-secondary);
  }

  /* Grid Layout Styles - Same as main page */
  .grid-layout {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(256px, 1fr));
    gap: 2px;
    width: 100%;
    margin: 0 auto;
    padding: 0;
    background: transparent;
    border: none;
    box-shadow: none;
    overflow: hidden;
  }

  /* Mobile responsive grid */
  @media (max-width: 768px) {
    .grid-layout {
      grid-template-columns: repeat(2, 1fr);
      gap: 1px;
    }
  }

  @media (max-width: 480px) {
    .grid-layout {
      grid-template-columns: repeat(2, 1fr);
      gap: 1px;
    }
  }

  .grid-item {
    background: #181828;
    border-radius: 0;
    overflow: hidden;
    transition: box-shadow 0.2s, transform 0.2s;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1/1;
    position: relative;
  }


  /* Mobile optimizations */
  @media (max-width: 768px) {
    .grid-item {
      aspect-ratio: 1/1;
      border-radius: 0;
    }
  }

  .grid-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.3s cubic-bezier(.4,0,.2,1);
  }

  .grid-item:hover img {
    transform: scale(1.04);
  }

  .distance-label {
    position: absolute;
    left: 12px;
    bottom: 12px;
    background: rgba(24,24,40,0.55);
    backdrop-filter: blur(4px);
    color: #fff;
    font-size: 0.85rem;
    font-weight: 500;
    border-radius: 8px;
    padding: 2px 12px;
    z-index: 2;
    pointer-events: none;
  }

  /* Mobile distance label optimization */
  @media (max-width: 768px) {
    .distance-label {
      font-size: 1rem;
      padding: 4px 16px;
      left: 16px;
      bottom: 16px;
      border-radius: 12px;
    }
  }

  @media (max-width: 480px) {
    .distance-label {
      font-size: 1.1rem;
      padding: 6px 18px;
      left: 20px;
      bottom: 20px;
      border-radius: 14px;
    }
  }

  /* Light/Dark Mode Background Colors for Justified and Grid */
  .edge-to-edge-gallery {
    background: var(--bg-primary);
  }

  .justified-wrapper {
    background: var(--bg-primary);
  }

  .grid-layout {
    background: var(--bg-primary);
  }

  /* Dark mode specific overrides */
  .passepartout-container.dark .edge-to-edge-gallery,
  .passepartout-container.dark .justified-wrapper,
  .passepartout-container.dark .grid-layout {
    background: var(--bg-primary);
  }

  /* Light mode specific overrides */
  .passepartout-container:not(.dark) .edge-to-edge-gallery,
  .passepartout-container:not(.dark) .justified-wrapper,
  .passepartout-container:not(.dark) .grid-layout {
    background: var(--bg-primary);
  }

  /* Keyword Links */
  .keyword-link {
    text-decoration: none;
    color: inherit;
    transition: all 0.2s ease;
    display: inline-block;
  }

  .keyword-link:hover {
    color: var(--culoca-orange);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px var(--shadow);
  }

  .keyword-link:active {
    transform: translateY(0);
  }

  /* Keywords editing styles */
  .keywords-title.editable {
    cursor: pointer;
    transition: color 0.2s;
    background: transparent;
  }

  .keywords-title.editable:hover {
    color: var(--culoca-orange);
    background: transparent;
  }

  .keywords-title.editing {
    color: var(--accent-color);
  }

  .keywords-placeholder {
    color: var(--text-secondary);
    font-style: italic;
    margin-top: 0.5rem;
  }

  .keywords-edit-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 1rem 0;
    background: transparent;
  }

  .keywords-edit-input {
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 1rem;
    padding: 0.5rem;
    width: 100%;
    min-height: 200px; /* Ensure minimum height for 8 rows */
    resize: vertical;
    transition: border-color 0.2s, background-color 0.3s ease, color 0.3s ease;
    /* Mobile optimizations */
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    font-size: 16px; /* Prevents zoom on iOS */
    font-family: inherit;
    line-height: 1.4;
  }

  .keywords-edit-input:focus {
    outline: none;
    border-color: var(--accent-color);
    background: var(--bg-tertiary);
  }

  .keywords-edit-input.valid {
    border-color: #28a745; /* Green for valid (10-50 keywords) */
    background: var(--bg-secondary);
  }

  .keywords-edit-input.too-many {
    border-color: #dc3545; /* Red for too many (>50 keywords) */
    background: var(--bg-secondary);
  }

  .char-count {
    font-size: 0.8rem;
    color: var(--text-secondary);
    text-align: right;
    font-weight: 500;
  }

  .char-count.valid {
    color: #28a745; /* Green for valid count */
  }

  .char-count.too-many {
    color: #dc3545; /* Red for too many */
  }

  /* CSS für Map-Picker und Buttons (an Bulk-Upload orientieren) */
  .map-edit-btn {
    background: linear-gradient(135deg, #ff9800, #ffc107);
    color: #222;
    border: none;
    border-radius: 8px;
    padding: 0.3rem 1.1rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    margin-left: 1rem;
    transition: background 0.2s, color 0.2s;
  }
  .map-edit-btn:hover {
    background: var(--culoca-orange);
    color: white;
  }
  .map-type-btn {
    background: none;
    color: #888;
    border: none;
    border-radius: 8px;
    padding: 0.2rem 0.7rem;
    font-size: 1.5rem;
    cursor: pointer;
    margin-left: 0.5rem;
    transition: background 0.2s, color 0.2s;
  }
  .map-type-btn:hover {
    background: var(--culoca-orange);
    color: white;
  }
  .map-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0,0,0,0.45);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .map-modal-content {
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.25);
    padding: 1.5rem 2rem 1.2rem 2rem;
    min-width: 350px;
    max-width: 95vw;
    min-height: 350px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
  }
  .map-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }
  .map-close-btn {
    background: none;
    border: none;
    font-size: 1.7rem;
    color: #888;
    cursor: pointer;
    padding: 0.2rem 0.7rem;
    border-radius: 8px;
    transition: background 0.2s, color 0.2s;
  }
  .map-close-btn:hover {
    background: var(--culoca-orange);
    color: white;
  }
  .map-container {
    width: 100%;
    height: 320px;
    border-radius: 12px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    margin-bottom: 0.7rem;
  }
  .map-modal-footer {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.7rem;
  }
  .map-actions {
    display: flex;
    gap: 1.2rem;
    margin-top: 0.5rem;
  }
  .map-cancel-btn, .map-confirm-btn {
    background: linear-gradient(135deg, #007bff, #0056b3);
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 0.5rem 1.5rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
  }
  .map-cancel-btn:hover, .map-confirm-btn:hover {
    background: var(--culoca-orange);
    color: white;
  }

  /* CSS für Map-Picker Fullscreen und Buttons */
  .map-pin-btn {
    background: none;
    box-shadow: none;
    border: none;
    padding: 0;
    margin: 0;
    outline: none;
    cursor: pointer;
  }
  .map-pin-btn:focus {
    outline: none;
  }
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
    color: #333;
    background: #fff;
    z-index: 2;
  }
  .map-modal-footer-fullscreen {
    display: flex;
    justify-content: flex-end;
    gap: 1.2rem;
    padding: 1.2rem;
    background: #fff;
    z-index: 2;
  }

  /* CSS für das Culoca O Editier-Icon */
  .culoca-o-edit path {
    fill: var(--text-primary);
    transition: fill 0.2s;
  }
  .culoca-o-edit:hover path {
    fill: var(--culoca-orange);
  }
  .culoca-o-edit {
    display: block;
    margin-left: 1rem;
    vertical-align: middle;
  }

  .download-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #2196f3, #1565c0);
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 0.5rem 1.2rem;
    font-size: 1.1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s, color 0.2s, box-shadow 0.2s;
    box-shadow: 0 2px 8px rgba(33, 150, 243, 0.08);
    margin-left: 0.5rem;
    text-decoration: none;
    gap: 0.5rem;
  }
  .download-btn svg {
    fill: #fff;
    margin-right: 0.2rem;
  }
  .download-btn:hover, .download-btn:focus {
    background: linear-gradient(135deg, #1565c0, #0d47a1);
    color: #fff;
    text-decoration: none;
    box-shadow: 0 4px 16px rgba(33, 150, 243, 0.15);
  }

  /* Filename editing styles */
  .filename.editable {
    cursor: pointer;
    transition: color 0.2s;
    background: transparent;
  }

  .filename.editable:hover {
    background: transparent;
  }

  .filename-text {
    cursor: pointer;
    transition: color 0.2s;
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    margin: -0.25rem -0.5rem;
  }

  .filename.editable:hover .filename-text {
    color: var(--culoca-orange);
  }

  .filename.editing .filename-text {
    display: none;
  }

  .filename-edit-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: transparent;
    margin: 0.25rem 0;
  }

  .filename-edit-input {
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 1rem;
    padding: 0.5rem;
    flex: 1;
    transition: border-color 0.2s, background-color 0.3s ease, color 0.3s ease;
    /* Mobile optimizations */
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    font-size: 16px; /* Prevents zoom on iOS */
  }

  .filename-edit-input:focus {
    outline: none;
    border-color: var(--accent-color);
    background: var(--bg-tertiary);
  }

</style> 