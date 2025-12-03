<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { darkMode } from '$lib/darkMode';
  import { filterStore, getEffectiveGpsPosition } from '$lib/filterStore';
  import { goto } from '$app/navigation';
  import { sessionStore, sessionReady } from '$lib/sessionStore';
  import type { PageData } from './$types';
  import { authFetch } from '$lib/authFetch';
  import { browser } from '$app/environment';
  import { supabase } from '$lib/supabaseClient';

  // Client-seitige Umleitung für bekannte Fälle (nur für User, nicht für Bots)
  if (browser) {
    const currentSlug = $page.params.slug;
    console.log('🔍 [Client] Checking slug for redirect:', currentSlug);
    
    // Prüfe, ob es sich um einen Bot handelt
    const userAgent = navigator.userAgent.toLowerCase();
    console.log('[Item Detail] User-Agent:', navigator.userAgent);
    console.log('[Item Detail] User-Agent (lowercase):', userAgent);
    
    const isBot = userAgent.includes('bot') || 
                  userAgent.includes('crawler') || 
                  userAgent.includes('spider') || 
                  userAgent.includes('scraper') ||
                  userAgent.includes('googlebot') ||
                  userAgent.includes('bingbot') ||
                  userAgent.includes('slurp') ||
                  userAgent.includes('duckduckbot');
    
    console.log('[Item Detail] Bot detection result:', isBot);
    
    // Entfernt: Keine client-seitigen Slug-Übersetzungen mehr
    // Alle Slugs werden direkt verwendet, keine Umleitungen
  }

  // Detail-Komponenten
  import ImageDisplay from '$lib/detail/ImageDisplay.svelte';
  import ImageControlsSection from '$lib/detail/ImageControlsSection.svelte';
  import ImageMetaSection from '$lib/detail/ImageMetaSection.svelte';
  import FileDetails from '$lib/detail/FileDetails.svelte';
  import KeywordsSection from '$lib/detail/KeywordsSection.svelte';
  import CreatorCard from '$lib/detail/CreatorCard.svelte';
  import NearbyGallery from '$lib/detail/NearbyGallery.svelte';
  import ImageMapSection from '$lib/detail/ImageMapSection.svelte';
  import RadiusControl from '$lib/detail/RadiusControl.svelte';
  import MapPickerOverlay from '$lib/detail/MapPickerOverlay.svelte';
import ItemRightsManager from '$lib/ItemRightsManager.svelte';
import { unifiedRightsStore } from '$lib/unifiedRightsStore';
let showMapPicker = false;
let showRightsManager = false;
  import { useJustifiedLayout } from '$lib/galleryStore';
  import FloatingActionButtons from '$lib/FloatingActionButtons.svelte';

  // Scroll to top state
  let showScrollToTop = false;

  // Helper function for formatting time
  function formatTimeCreated(value: any): string {
    if (!value) return '';
    if (typeof value === 'string') {
      // Format: "150629" -> "15:06:29"
      if (value.length === 6 && /^\d{6}$/.test(value)) {
        return `${value.slice(0, 2)}:${value.slice(2, 4)}:${value.slice(4, 6)}`;
      }
      return value;
    }
    return String(value);
  }

  export let data: any;
  let image = data?.image ?? null;
  let error = data?.error ?? '';
  let nearby: any[] = []; // Will be loaded client-side
  let loading = !image;
  let profile = null;
  let metaTags = data?.metaTags ?? null;
  let showImageCaptions = true; // Default to true

  // SEO/Meta: Slug statt ID verwenden - reaktiv auf URL-Parameter
  let itemSlug: string = '';
  $: itemSlug = $page.params.slug || image?.slug || '';

  // Dynamisches Favicon aktualisieren
  $: if (image && browser) {
    updateFavicon();
  }

  // Load nearby items client-side to prevent Google from "stealing" nearby titles/descriptions
  $: if (image && browser && image.slug) {
    loadNearbyItems();
  }

  async function loadNearbyItems() {
    try {
      const response = await fetch(`/api/nearby/${image.slug}`);
      if (response.ok) {
        const data = await response.json();
        nearby = data.nearby || [];
      }
    } catch (error) {
      console.error('Failed to load nearby items:', error);
    }
  }

  // SEO-optimized meta tags to prevent Google from "stealing" nearby image titles/descriptions
  // REMOVED: Dynamic meta tag updates to prevent conflicts with static meta tags in svelte:head

  function updateFavicon() {
    if (!image) return;
    
    // Entferne alte Favicon-Links
    const oldFavicons = document.querySelectorAll('link[rel="icon"]');
    oldFavicons.forEach(link => link.remove());
    
    // Erstelle neuen Favicon-Link mit Cache-Buster
    const faviconLink = document.createElement('link');
    faviconLink.rel = 'icon';

  // Slider-Fortschritt aktualisieren
  function updateSliderProgress(slider: HTMLInputElement) {
    const min = +slider.min || 0, max = +slider.max || 100, val = +slider.value;
    const pct = ((val - min) * 100 / (max - min)) + '%';
    slider.style.setProperty('--pct', pct);
  }

  // Slider-Event-Handler
  function handleSliderInput(event: Event) {
    const slider = event.target as HTMLInputElement;
    updateSliderProgress(slider);
  }
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

  // Für CreatorCard
  let currentUser: any = null;
  $: currentUser = $sessionStore.isAuthenticated && $sessionStore.userId
    ? { id: $sessionStore.userId }
    : null;
  $: isCreator = !!currentUser && (currentUser.id === image?.profile_id || currentUser.id === '0ceb2320-0553-463b-971a-a0eef5ecdf09');
  
  // Admin-Berechtigung prüfen
  $: isAdmin = $sessionStore.permissions?.admin || false;
  
  // Prüfen ob ausgeblendete Items vom aktuellen Benutzer stammen
  $: hasOwnHiddenItems = hiddenItems.some(item => item.profile_id === currentUser?.id);
  
  // Debug: Log creator status
  $: if (image && currentUser) {
    console.log('[DetailPage] Creator Debug:', {
      currentUserId: currentUser.id,
      imageProfileId: image.profile_id,
      isCreator: isCreator,
      isAuthenticated: $sessionStore.isAuthenticated,
      sessionUserId: $sessionStore.userId
    });
  }

  // Load unified rights when image is available
  $: if (image && browser && image.id) {
    unifiedRightsStore.loadRights(image.id);
  }

  // Cleanup rights store when component is destroyed
  onMount(() => {
    // Load showImageCaptions from localStorage
    if (browser && typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('showImageCaptions');
      if (stored !== null) {
        showImageCaptions = stored === 'true';
      }
    }
    
    // Listen for localStorage changes
    const onStorageChange = (e: StorageEvent) => {
      if (e.key === 'showImageCaptions' && e.newValue !== null) {
        showImageCaptions = e.newValue === 'true';
        console.log('[Item][Storage] showImageCaptions changed to:', showImageCaptions);
      }
    };
    window.addEventListener('storage', onStorageChange);
    
    return () => {
      unifiedRightsStore.reset();
      window.removeEventListener('storage', onStorageChange);
    };
  });

  // Generate SEO-friendly image URLs for srcset (no query parameters)
  let imageSource = '';
  let imageSrcset = '';
  let imageSizes = '';
  let imageWidth2048 = 2048;
  let imageHeight2048 = 1365;
  $: if (image) {
    const imagePath = image.path_2048 || image.path_512;
    if (!imagePath || !image.slug) {
      imageSource = '';
      imageSrcset = '';
      imageSizes = '';
      imageWidth2048 = 2048;
      imageHeight2048 = 1365;
    } else {
      // Extract extension from the actual file path (e.g., "abc123.jpg" -> ".jpg")
      const extensionMatch = imagePath.match(/\.(jpg|jpeg|webp|png)$/i);
      const fileExtension = extensionMatch ? extensionMatch[0].toLowerCase() : '.jpg';
      const baseUrl = 'https://culoca.com/images';
      
      // Calculate dimensions for 2048px version (proportional scaling)
      const originalWidth = image.width || 2048;
      const originalHeight = image.height || 1365;
      const maxDimension2048 = 2048;
      const scale2048 = originalWidth > maxDimension2048 || originalHeight > maxDimension2048
        ? Math.min(maxDimension2048 / originalWidth, maxDimension2048 / originalHeight)
        : 1;
      imageWidth2048 = Math.max(1, Math.min(Math.round(originalWidth * scale2048), maxDimension2048));
      imageHeight2048 = Math.max(1, Math.min(Math.round(originalHeight * scale2048), maxDimension2048));
      
      // Generate srcset with available sizes (512px and 2048px) using size suffixes
      // Use 512px for smaller screens, 2048px for larger screens
      const srcsetParts: string[] = [];
      if (image.path_512) {
        // For 512px images, we use them for screens up to 1024px wide
        srcsetParts.push(`${baseUrl}/${image.slug}-512${fileExtension} 512w`);
      }
      if (image.path_2048) {
        // For 2048px images, we use them for screens 1024px and wider
        srcsetParts.push(`${baseUrl}/${image.slug}-2048${fileExtension} 2048w`);
      }
      
      // Fallback: if no srcset, use main image source (2048px version)
      imageSource = image.path_2048
        ? `${baseUrl}/${image.slug}-2048${fileExtension}`
        : (image.path_512 ? `${baseUrl}/${image.slug}-512${fileExtension}` : '');
      imageSrcset = srcsetParts.join(', ');
      // sizes: use 512px for mobile (up to 900px), 2048px for desktop
      imageSizes = '(max-width: 900px) 512px, 2048px';
    }
  }

  // Beispiel: Handler für Location-Filter
  function setLocationFilter() {
    if (!image?.lat || !image?.lon) return;
    filterStore.setLocationFilter({
      lat: image.lat,
      lon: image.lon,
      name: image.title || 'Standort',
      fromItem: true
    });
    goto('/');
  }
  
  // Funktion zum Zurücksetzen auf aktuelle GPS-Koordinaten
  function clearLocationFilter() {
    filterStore.clearLocationFilter();
    console.log('[Item Detail] Location filter cleared, returning to current GPS coordinates');
  }

  // Radius initial setzen - URL-Parameter haben Vorrang
  let radius = 1000;
  let radiusInitialized = false;
  
  // Item view logging
  let viewLogged = false;
  
  // Function to initialize GPS if not available
  async function initializeGpsIfNeeded() {
    if (!browser) return;
    
    // Check if we have GPS position
    const effectiveGps = getEffectiveGpsPosition();
    if (effectiveGps) {
      console.log('[Item Detail] GPS position available:', effectiveGps);
      return;
    }
    
    // Try to get GPS position from browser
    console.log('[Item Detail] No GPS position available, requesting from browser...');
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        });
      });
      
      const { lat, lon } = position.coords;
      console.log('[Item Detail] Got GPS position from browser:', { lat, lon });
      
      // Update filterStore with GPS position
      filterStore.updateGpsStatus(true, { lat, lon });
      
    } catch (error) {
      console.warn('[Item Detail] Failed to get GPS position:', error);
    }
  }
  
  // Initialize filterStore from URL parameters (includes radius)
  onMount(async () => {
    if (browser) {
      const urlParams = new URLSearchParams(window.location.search);
      filterStore.initFromUrl(urlParams);
      
      // Check if radius parameter is in URL - it has priority over localStorage
      const radiusParam = urlParams.get('r');
      if (radiusParam) {
        const radiusValue = parseInt(radiusParam);
        if (!isNaN(radiusValue) && radiusValue > 0) {
          radius = radiusValue;
          console.log(`[Item Detail] Radius from URL parameter: ${radius}m`);
        }
      } else {
        // Fallback to localStorage if no URL parameter
        const storedRadius = Number(localStorage.getItem('radius'));
        if (!isNaN(storedRadius) && storedRadius > 0) {
          radius = storedRadius;
          console.log(`[Item Detail] Radius from localStorage: ${radius}m`);
        }
      }
      
      // Initialize GPS if needed, then log item view
      await initializeGpsIfNeeded();
      
      // Log item view when page loads
      if (image?.id && !viewLogged) {
        logItemView();
      }

      // Initialize slider progress
      const slider = document.querySelector('#radius') as HTMLInputElement;
      if (slider) {
        const min = +slider.min || 0, max = +slider.max || 100, val = +slider.value;
        const pct = ((val - min) * 100 / (max - min)) + '%';
        slider.style.setProperty('--pct', pct);
      }
    }
  });
  
  // Function to log item view
  async function logItemView() {
    if (!image?.id || viewLogged) return;
    
    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      const visitorId = session?.user?.id || null;
      
      // Get current GPS coordinates using the effective GPS position function
      const effectiveGps = getEffectiveGpsPosition();
      const visitorLat = effectiveGps?.lat || null;
      const visitorLon = effectiveGps?.lon || null;
      
      // Debug: Log all available location information
      console.log('[Item Detail] Debug location info:', {
        effectiveGps,
        filterStoreLocation: $filterStore.locationFilter,
        lastGpsPosition: $filterStore.lastGpsPosition,
        gpsAvailable: $filterStore.gpsAvailable,
        visitorLat,
        visitorLon,
        imageLat: image?.lat,
        imageLon: image?.lon
      });
      
      // Additional debug: Check localStorage
      const storedFilters = localStorage.getItem('culoca-filters');
      console.log('[Item Detail] Stored filters from localStorage:', storedFilters);
      if (storedFilters) {
        try {
          const parsed = JSON.parse(storedFilters);
          console.log('[Item Detail] Parsed stored filters:', parsed);
        } catch (e) {
          console.log('[Item Detail] Failed to parse stored filters:', e);
        }
      }
      
      console.log('[Item Detail] Logging view with visitor ID:', visitorId, 'GPS:', visitorLat, visitorLon);
      
      const response = await fetch('/api/log-item-view', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId: image.id,
          visitorId: visitorId,
          visitorLat: visitorLat,
          visitorLon: visitorLon,
          referer: document.referrer,
          userAgent: navigator.userAgent
        })
      });
      
      if (response.ok) {
        viewLogged = true;
        const responseData = await response.json();
        console.log(`[Item Detail] View logged for item: ${image.id} with visitor ID: ${visitorId}, distance: ${visitorLat && visitorLon ? 'calculated' : 'unknown'}`);
        console.log('[Item Detail] API response:', responseData);
      } else {
        const errorData = await response.json();
        console.error('[Item Detail] Failed to log item view:', errorData);
      }
    } catch (error) {
      console.error('[Item Detail] Error logging item view:', error);
    }
  }
  
  // Reactive statement to ensure radius is properly set
  $: if (radiusInitialized && browser) {
    console.log(`[Item Detail] Current radius value: ${radius}m`);
  }
  
  // Ensure radius never exceeds 2000m
  $: if (radius > 2000) {
    radius = 2000;
    console.log('[Item Detail] Radius limited to 2000m');
  }
  
  // Handle radius input with limit
  function handleRadiusInput() {
    if (radius > 2000) {
      radius = 2000;
    }
    // Update URL parameter
    if (browser) {
      const url = new URL(window.location.href);
      url.searchParams.set('r', radius.toString());
      window.history.replaceState({}, '', url.toString());
    }
  }
  
  // Handle radius change with limit
  function handleRadiusChange() {
    if (radius > 2000) {
      radius = 2000;
    }
    // Save to localStorage
    if (browser) {
      localStorage.setItem('radius', radius.toString());
    }
    // Update URL parameter
    if (browser) {
      const url = new URL(window.location.href);
      url.searchParams.set('r', radius.toString());
      window.history.replaceState({}, '', url.toString());
    }
  }
  
  // Copy current link to clipboard
  async function copyCurrentLink() {
    if (!browser) return;
    
    try {
      // Get current URL with all parameters
      const currentUrl = window.location.href;
      
      // Copy to clipboard
      await navigator.clipboard.writeText(currentUrl);
      
      // Show success feedback
      console.log('✅ Link copied to clipboard:', currentUrl);
      
      // Optional: Show a brief success message
      // You could add a toast notification here
      
    } catch (error) {
      console.error('❌ Failed to copy link:', error);
      
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea');
        textArea.value = window.location.href;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        console.log('✅ Link copied using fallback method');
      } catch (fallbackError) {
        console.error('❌ Fallback copy also failed:', fallbackError);
      }
    }
  }
  function onRadiusInput(e) {
    radius = +e.target.value;
    // Ensure radius never exceeds 2000m
    if (radius > 2000) {
      radius = 2000;
    }
    
    // Update slider progress
    const slider = e.target as HTMLInputElement;
    const min = +slider.min || 0, max = +slider.max || 100, val = +slider.value;
    const pct = ((val - min) * 100 / (max - min)) + '%';
    slider.style.setProperty('--pct', pct);
  }
  function onRadiusChange(e) {
    radius = +e.target.value;
    // Ensure radius never exceeds 2000m
    if (radius > 2000) {
      radius = 2000;
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('radius', String(radius));
      // Update URL with radius parameter
      filterStore.updateRadius(radius);
    }
  }
  $: filteredNearby = nearby.filter(item => item.distance <= radius && item.id !== image?.id);
  $: hiddenItems = nearby.filter(item => (item.gallery === false) && item.distance <= radius && item.id !== image?.id);
  $: visibleNearby = showHiddenItems
    ? nearby.filter(item => item.distance <= radius && item.id !== image?.id && item.gallery === false)
    : nearby.filter(item => item.distance <= radius && item.id !== image?.id && item.gallery !== false);
  
  // Automatisch showHiddenItems zurücksetzen wenn keine ausgeblendeten Items mehr vorhanden sind
  $: if (showHiddenItems && hiddenItems.length === 0) {
    showHiddenItems = false;
  }
  
  // SEO-optimiert: Indikatoren für Limits
  $: isAtItemLimit = filteredNearby.length >= 300;
  $: showLimitIndicator = isAtItemLimit;

  let editingTitle = false;
  let titleEditValue = '';
  let editingCaption = false;
  let captionEditValue = '';
  let editingDescription = false;
  let descriptionEditValue = '';
  let editingKeywords = false;
  let keywordsEditValue = '';
  let editingFilename = false;
  let filenameEditValue = '';
  let editingSlug = false;
  let slugEditValue = '';

  let showFullExif = false;
  let showHiddenItems = false;
  function toggleHiddenItems() {
    showHiddenItems = !showHiddenItems;
  }
  function setUserFilter() {
    if (!image?.profile_id) return;
    const username = image.profile?.full_name || image.profile?.accountname || image.profile_id || 'Profil';
    const accountName = image.profile?.accountname || image.profile?.full_name || image.profile_id || 'Profil';
    filterStore.setUserFilter({
      userId: image.profile_id,
      username,
      avatarUrl: image.profile?.avatar_url || '',
      accountName
    });
    goto('/');
  }
  function formatFileSize(bytes) {
    if (!bytes) return '';
    const kb = bytes / 1024;
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) {
      return mb.toFixed(1).replace('.', ',') + ' MB';
    } else {
      return kb.toFixed(0) + ' KB';
    }
  }
  function formatExposureTime(value) {
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
  function handleKey(e, fn) {
    if (e.key === 'Enter' || e.key === ' ') {
      fn();
    }
  }

  // User-Initialisierung (wie im Backup)
  // --- Title ---
  function startEditTitle() {
    if (currentUser && image && (isCreator || $unifiedRightsStore.rights?.edit)) {
      editingTitle = true;
      titleEditValue = image.title || '';
      setTimeout(() => {
        const input = document.getElementById('title-edit-input') as HTMLInputElement;
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
          input.click();
        }
      }, 100);
    }
  }
  async function saveTitle() {
    if (!editingTitle || !currentUser || !image || !(isCreator || $unifiedRightsStore.rights?.edit)) return;
    const newTitle = titleEditValue.trim();
    if (newTitle.length > 60) return;
    try {
      const res = await authFetch(`/api/item/${image.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle })
      });
      if (!res.ok) return;
      image.title = newTitle;
      editingTitle = false;
    } catch (err) { console.error('Failed to save title:', err); }
  }
  function cancelEditTitle() { editingTitle = false; titleEditValue = image.title || ''; }
  function handleTitleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') { event.preventDefault(); saveTitle(); }
    else if (event.key === 'Escape') { event.preventDefault(); cancelEditTitle(); }
  }
  // --- Description ---
  function startEditDescription() {
    if (currentUser && image && (isCreator || $unifiedRightsStore.rights?.edit)) {
      editingDescription = true;
      descriptionEditValue = image.description || '';
      setTimeout(() => {
        const input = document.getElementById('description-edit-input') as HTMLTextAreaElement;
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
          input.click();
        }
      }, 100);
    }
  }
  async function saveDescription() {
    if (!editingDescription || !currentUser || !image || !(isCreator || $unifiedRightsStore.rights?.edit)) return;
    const newDescription = descriptionEditValue.trim();
    if (newDescription.length > 160) return;
    try {
      const res = await authFetch(`/api/item/${image.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: newDescription })
      });
      if (!res.ok) return;
      image.description = newDescription;
      editingDescription = false;
    } catch (err) { console.error('Failed to save description:', err); }
  }
  function cancelEditDescription() { editingDescription = false; descriptionEditValue = image.description || ''; }
  function handleDescriptionKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') { event.preventDefault(); saveDescription(); }
    else if (event.key === 'Escape') { event.preventDefault(); cancelEditDescription(); }
  }
  // --- Caption ---
  function startEditCaption() {
    if (currentUser && image && (isCreator || $unifiedRightsStore.rights?.edit)) {
      editingCaption = true;
      captionEditValue = image.caption || '';
      setTimeout(() => {
        const input = document.getElementById('caption-edit-input') as HTMLTextAreaElement;
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
          input.click();
        }
      }, 100);
    }
  }
  async function saveCaption() {
    if (!editingCaption || !currentUser || !image || !(isCreator || $unifiedRightsStore.rights?.edit)) return;
    const newCaption = captionEditValue.trim();
    if (newCaption.length > 300) return;
    try {
      const res = await authFetch(`/api/item/${image.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption: newCaption })
      });
      if (!res.ok) return;
      image.caption = newCaption;
      editingCaption = false;
    } catch (err) { console.error('Failed to save caption:', err); }
  }
  function cancelEditCaption() { editingCaption = false; captionEditValue = image.caption || ''; }
  function handleCaptionKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) { 
      event.preventDefault(); 
      saveCaption(); 
    }
    else if (event.key === 'Escape') { 
      event.preventDefault(); 
      cancelEditCaption(); 
    }
  }
  // --- Keywords ---
  function startEditKeywords() {
    if (currentUser && image && (isCreator || $unifiedRightsStore.rights?.edit)) {
      editingKeywords = true;
      keywordsEditValue = (image.keywords || []).join(', ');
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
    if (!editingKeywords || !currentUser || !image || !(isCreator || $unifiedRightsStore.rights?.edit)) return;
    const newKeywords = keywordsEditValue.trim();
    
    // Verbesserte Keywords-Verarbeitung
    const keywordsArray = newKeywords
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);
    
    // Prüfe auf 50 Keywords Limit
    if (keywordsArray.length > 50) {
      console.warn('Keywords truncated to 50 items');
      keywordsArray.splice(50); // Behalte nur die ersten 50
    }
    
    try {
      const res = await authFetch(`/api/item/${image.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: keywordsArray })
      });
      if (!res.ok) return;
      image.keywords = keywordsArray;
      editingKeywords = false;
    } catch (err) { console.error('Failed to save keywords:', err); }
  }
  function cancelEditKeywords() { editingKeywords = false; keywordsEditValue = (image.keywords || []).join(', '); }
  function handleKeywordsKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') { event.preventDefault(); saveKeywords(); }
    else if (event.key === 'Escape') { event.preventDefault(); cancelEditKeywords(); }
  }
  // --- Filename ---
  function startEditFilename() {
    if (currentUser && image && (isCreator || $unifiedRightsStore.rights?.edit)) {
      editingFilename = true;
      filenameEditValue = image.original_name || '';
      setTimeout(() => {
        const input = document.getElementById('filename-edit-input') as HTMLInputElement;
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
          input.click();
        }
      }, 100);
    }
  }
  async function saveFilename() {
    if (!editingFilename || !currentUser || !image || !(isCreator || $unifiedRightsStore.rights?.edit)) return;
    const newFilename = filenameEditValue.trim();
    if (newFilename.length > 255) return;
    try {
      const res = await authFetch(`/api/item/${image.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ original_name: newFilename })
      });
      if (!res.ok) return;
      image.original_name = newFilename;
      editingFilename = false;
    } catch (err) { console.error('Failed to save filename:', err); }
  }
  function cancelEditFilename() { editingFilename = false; filenameEditValue = image.original_name || ''; }
  function handleFilenameKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') { event.preventDefault(); saveFilename(); }
    else if (event.key === 'Escape') { event.preventDefault(); cancelEditFilename(); }
  }
  // --- Slug ---
  function startEditSlug() {
    if (currentUser && image && (isCreator || $unifiedRightsStore.rights?.edit)) {
      editingSlug = true;
      slugEditValue = image.slug || '';
      setTimeout(() => {
        const input = document.getElementById('slug-edit-input') as HTMLInputElement;
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
          input.click();
        }
      }, 100);
    }
  }
  async function saveSlug() {
    if (!editingSlug || !currentUser || !image || !(isCreator || $unifiedRightsStore.rights?.edit)) return;
    const newSlug = slugEditValue.trim();
    if (newSlug.length > 255) return;
    try {
      const res = await authFetch(`/api/item/${image.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: newSlug })
      });
      if (!res.ok) return;
      image.slug = newSlug;
      editingSlug = false;
    } catch (err) { console.error('Failed to save slug:', err); }
  }
  function cancelEditSlug() { editingSlug = false; slugEditValue = image.slug || ''; }
  function handleSlugKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') { event.preventDefault(); saveSlug(); }
    else if (event.key === 'Escape') { event.preventDefault(); cancelEditSlug(); }
  }

  function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number): string {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const meters = Math.round(R * c);
    return meters >= 1000 ? (meters / 1000).toFixed(1).replace('.', ',') + 'km' : meters + 'm';
  }
  function handleNearbyGalleryToggle(itemId: string, newGalleryValue: boolean) {
    // Hier API-Call zum Setzen/Entfernen aus Galerie (vereinfachtes Beispiel)
    fetch(`/api/item/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gallery: newGalleryValue })
    }).then(() => {
      // Nach dem Update: nearby-Array aktualisieren (optimistisch)
      const idx = nearby.findIndex(i => i.id === itemId);
      if (idx !== -1) {
        nearby[idx].gallery = newGalleryValue;
        // Array neu zuweisen für Reaktivität
        nearby = [...nearby];
      }
    });
  }
  function getNearbyGalleryStatus(itemId: string) {
    const item = nearby.find(i => i.id === itemId);
    return item ? item.gallery !== false : true;
  }
  function formatRadius(meters) {
    return meters >= 1000
      ? (meters / 1000).toFixed(1).replace('.', ',') + ' km'
      : meters + ' m';
  }

  // Dateigrößen für 64px, 512px, 2048px
  let fileSizes = { size64: null, size512: null, size2048: null };

  async function fetchFileSizes() {
    if (!image || !browser) return;
    try {
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

  $: if (image && browser) {
    setTimeout(fetchFileSizes, 1000);
  }

  // Scroll event listener for scroll-to-top button
  onMount(() => {
    if (browser) {
      const handleScroll = () => {
        showScrollToTop = window.scrollY > 100;
      };
      
      window.addEventListener('scroll', handleScroll);
      handleScroll(); // Initial check
      
      return () => {
        window.removeEventListener('scroll', handleScroll);
      };
    }
  });

  // Layout für NearbyGallery (aus LocalStorage, fallback justified)
  let galleryLayout = 'justified';
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('galleryLayout');
    if (stored === 'grid' || stored === 'justified') {
      galleryLayout = stored;
    }
  }
  $: galleryLayout = $useJustifiedLayout ? 'justified' : 'grid';

  async function deleteImage() {
    if (!image || !currentUser || image.profile_id !== currentUser.id) return;
    if (!confirm('Willst du dieses Bild wirklich löschen?')) return;
    try {
      const res = await authFetch(`/api/item/${image.id}`, { method: 'DELETE' });
      if (res.ok) {
        goto('/');
      } else {
        alert('Löschen fehlgeschlagen.');
      }
    } catch (err) {
      alert('Fehler beim Löschen.');
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

  function toggleGallery() {
    if (!image || !currentUser || image.profile_id !== currentUser.id) return;
    const newGallery = !(image.gallery ?? true);
    authFetch(`/api/item/${image.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gallery: newGallery })
    }).then(res => {
      if (res.ok) {
        image.gallery = newGallery;
      } else {
        alert('Fehler beim Speichern des Galerie-Status.');
      }
    });
  }
</script>

<svelte:head>
  <title>{image?.title || `Item ${itemSlug} - culoca.com`}</title>
  <meta name="description" content={image?.description || image?.caption || 'culoca.com - see you local, Deine Webseite für regionalen Content. Entdecke deine Umgebung immer wieder neu.'}>
  
  <link rel="canonical" href={`https://culoca.com/item/${itemSlug}/`}>
  
  <!-- Robots -->
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
  <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
  <meta name="bingbot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
  
  <!-- Open Graph -->
  <meta property="og:type" content="article">
  <meta property="og:locale" content="de_DE">
  <meta property="og:title" content={image?.title || `Item ${itemSlug} - culoca.com`}>
  <meta property="og:description" content={image?.description || image?.caption || 'culoca.com - see you local, Deine Webseite für regionalen Content. Entdecke deine Umgebung immer wieder neu.'}>
  <meta property="og:url" content={`https://culoca.com/item/${itemSlug}/`}> 
  <!-- Open Graph Image: Use SEO-friendly URL with size suffix (no query parameters) -->
  {#if image}
    {@const imagePathForExtension = image.path_2048 || image.path_512}
    {@const extensionMatch = imagePathForExtension ? imagePathForExtension.match(/\.(jpg|jpeg|webp|png)$/i) : null}
    {@const fileExtension = extensionMatch ? extensionMatch[0].toLowerCase() : '.jpg'}
    {@const ogImageUrl = image.path_2048
      ? `https://culoca.com/images/${image.slug}-2048${fileExtension}`
      : (image.path_512 ? `https://culoca.com/images/${image.slug}-512${fileExtension}` : '')}
    <!-- Calculate dimensions for 2048px version (proportional scaling) -->
    {@const originalWidth = image.width || 2048}
    {@const originalHeight = image.height || 1365}
    {@const maxDimension2048 = 2048}
    {@const scale2048 = originalWidth > maxDimension2048 || originalHeight > maxDimension2048
      ? Math.min(maxDimension2048 / originalWidth, maxDimension2048 / originalHeight)
      : 1}
    {@const width2048 = Math.max(1, Math.min(Math.round(originalWidth * scale2048), maxDimension2048))}
    {@const height2048 = Math.max(1, Math.min(Math.round(originalHeight * scale2048), maxDimension2048))}
    <meta property="og:image" content={ogImageUrl}>
    <meta property="og:image:width" content={width2048.toString()}>
    <meta property="og:image:height" content={height2048.toString()}>
    <meta property="og:image:alt" content={image.title || image.description || `Item ${itemSlug}`}>
  {:else}
    <meta property="og:image" content={`https://culoca.com/api/og-image/${itemSlug}`}>
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content={`Item ${itemSlug}`}>
  {/if}
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content={image?.title || `Item ${itemSlug} - culoca.com`}>
  <meta name="twitter:description" content={image?.description || image?.caption || 'culoca.com - see you local, Deine Webseite für regionalen Content. Entdecke deine Umgebung immer wieder neu.'}>
  {#if image}
    {@const imagePathForExtension = image.path_2048 || image.path_512}
    {@const extensionMatch = imagePathForExtension ? imagePathForExtension.match(/\.(jpg|jpeg|webp|png)$/i) : null}
    {@const fileExtension = extensionMatch ? extensionMatch[0].toLowerCase() : '.jpg'}
    {@const twitterImageUrl = image.path_2048
      ? `https://culoca.com/images/${image.slug}-2048${fileExtension}`
      : (image.path_512 ? `https://culoca.com/images/${image.slug}-512${fileExtension}` : '')}
    <meta name="twitter:image" content={twitterImageUrl}>
  {:else}
    <meta name="twitter:image" content={`https://culoca.com/api/og-image/${itemSlug}`}>
  {/if}
  <meta name="twitter:image:alt" content={image?.title || `Item ${itemSlug}`}>
  
  <meta name="author" content={image?.full_name || 'culoca.com'}>
  
  <!-- Dynamisches Favicon für bessere SEO -->
  <link rel="icon" type="image/png" href={`/api/favicon/${itemSlug}`} sizes="32x32 48x48 96x96 192x192 512x512"> 
  <link rel="apple-touch-icon" href={`/api/favicon/${itemSlug}`} sizes="180x180">
  
  <!-- Strukturierte Daten (JSON-LD) für bessere SEO - Optimiert nach Google-Richtlinien -->
  {#if image}
    {@const itemName = image.title || image.original_name || `Bild ${image.id}`}
    {@const itemUrl = `https://culoca.com/item/${image.slug}/`}
    {@const hasPath2048 = !!image.path_2048}
    {@const hasPath512 = !!image.path_512}
    {@const imagePathForExtension = image.path_2048 || image.path_512}
    {@const extensionMatch = imagePathForExtension ? imagePathForExtension.match(/\.(jpg|jpeg|webp|png)$/i) : null}
    {@const fileExtension = extensionMatch ? extensionMatch[0].toLowerCase() : '.jpg'}
    
    <!-- Generate SEO-friendly URLs with size suffixes (no query parameters) -->
    <!-- contentUrl: Always use 2048px version if available, otherwise 512px -->
    {@const imageUrl2048 = hasPath2048
      ? `https://culoca.com/images/${image.slug}-2048${fileExtension}`
      : (hasPath512 ? `https://culoca.com/images/${image.slug}-512${fileExtension}` : '')}
    <!-- thumbnailUrl: Always use 512px version if available, otherwise 2048px (fallback) -->
    {@const imageUrl512 = hasPath512
      ? `https://culoca.com/images/${image.slug}-512${fileExtension}`
      : (hasPath2048 ? `https://culoca.com/images/${image.slug}-2048${fileExtension}` : '')}
    
    <!-- Calculate dimensions for 2048px and 512px versions (proportional scaling) -->
    <!-- Note: image.width and image.height are original dimensions after EXIF orientation -->
    {@const originalWidth = image.width || 2048}
    {@const originalHeight = image.height || 1365}
    
    <!-- For 2048px: scale down if original is larger than 2048px on any side, otherwise use original -->
    <!-- This matches the resize logic: fit: 'inside', withoutEnlargement: true -->
    {@const maxDimension2048 = 2048}
    {@const scale2048 = originalWidth > maxDimension2048 || originalHeight > maxDimension2048
      ? Math.min(maxDimension2048 / originalWidth, maxDimension2048 / originalHeight)
      : 1}
    {@const width2048 = Math.max(1, Math.min(Math.round(originalWidth * scale2048), maxDimension2048))}
    {@const height2048 = Math.max(1, Math.min(Math.round(originalHeight * scale2048), maxDimension2048))}
    
    <!-- For 512px thumbnail: scale down proportionally (always scale for thumbnail) -->
    {@const maxDimension512 = 512}
    {@const scale512 = Math.min(maxDimension512 / originalWidth, maxDimension512 / originalHeight)}
    {@const width512 = Math.max(1, Math.round(originalWidth * scale512))}
    {@const height512 = Math.max(1, Math.round(originalHeight * scale512))}
    
    {@const uploadDate = image.created_at ? new Date(image.created_at).toISOString() : null}
    {@const dateModified = image.updated_at ? new Date(image.updated_at).toISOString() : 
      (image.created_at ? new Date(image.created_at).toISOString() : null)}
    
    <!-- Process keywords: limit to 8-15 precise keywords, convert to array -->
    {@const keywordsArray = image.keywords 
      ? (Array.isArray(image.keywords) ? image.keywords : image.keywords.split(',').map(k => k.trim()))
          .filter(k => k && k.length > 0)
          .slice(0, 15)
          .map(k => k.normalize('NFC')) // UTF-8 NFC normalization
      : []}
    
    {@const rawCaption = image.exif_data?.Caption || image.title || itemName}
    {@const exifCaption = image.exif_data?.Caption ? decodeURIComponent(escape(rawCaption)) : (image.title || itemName)}
    {@const caption = image.caption || exifCaption || image.description || ''}
    {@const sha256 = image.sha256 || undefined}
    {@const creatorName = image.full_name || 'Culoca User'}
    {@const createdYear = image.created_at ? new Date(image.created_at).getFullYear() : new Date().getFullYear()}
    {@const creditText = `Foto: ${creatorName}`}
    {@const copyrightNotice = `© ${createdYear} ${creatorName} | culoca.com. Alle Rechte vorbehalten.`}
    
    <!-- UTF-8 Normalization: Ensure NFC (not NFD) to prevent encoding issues like "SchoÃßbach" -->
    {@const normalizeUTF8 = (str) => str ? str.normalize('NFC') : str}
    {@const normalizedItemName = normalizeUTF8(itemName)}
    {@const normalizedCaption = normalizeUTF8(caption)}
    {@const normalizedDescription = normalizeUTF8(image.description || caption || '')}
    {@const normalizedCreatorName = normalizeUTF8(creatorName)}
    {@const normalizedCreditText = normalizeUTF8(creditText)}
    {@const normalizedCopyrightNotice = normalizeUTF8(copyrightNotice)}
    {@const normalizedContentLocationName = normalizeUTF8(image.title || itemName)}
    
    <!-- Preload LCP image for better performance -->
    {#if imageUrl2048 && imageUrl2048.length > 0 && image.slug}
      {#if imageUrl512 && imageUrl512 !== imageUrl2048 && imageUrl512.length > 0}
        <link rel="preload" as="image" href={imageUrl2048} imagesrcset={`${imageUrl512} 512w, ${imageUrl2048} 2048w`} imagesizes="(max-width: 900px) 512px, 2048px">
      {:else}
        <link rel="preload" as="image" href={imageUrl2048}>
      {/if}
    {/if}
    
    {@html `<script type="application/ld+json">
    ${JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "ImageObject",
          "@id": imageUrl2048,
          "url": imageUrl2048,
          "contentUrl": imageUrl2048,
          "thumbnailUrl": imageUrl512,
          "name": normalizedItemName,
          "caption": normalizedCaption,
          "description": normalizedDescription,
          "inLanguage": "de",
          "width": width2048,
          "height": height2048,
          "encodingFormat": fileExtension === '.webp' ? 'image/webp' : fileExtension === '.png' ? 'image/png' : 'image/jpeg',
          "license": "https://culoca.com/web/license",
          "creditText": normalizedCreditText,
          "copyrightNotice": normalizedCopyrightNotice,
          "acquireLicensePage": "https://culoca.com/web/license",
          "creator": {
            "@type": "Person",
            "name": normalizedCreatorName
          },
          "copyrightHolder": {
            "@type": "Person",
            "name": normalizedCreatorName
          },
          "contentLocation": {
            "@type": "Place",
            "name": normalizedContentLocationName,
            "geo": {
              "@type": "GeoCoordinates",
              "latitude": image.lat || 0,
              "longitude": image.lon || 0
            }
          },
          ...(uploadDate && { "datePublished": uploadDate }),
          ...(dateModified && { "dateModified": dateModified }),
          ...(uploadDate && { "uploadDate": uploadDate }),
          ...(keywordsArray.length > 0 && { "keywords": keywordsArray }),
          ...(sha256 ? { "sha256": sha256 } : {}),
          "representativeOfPage": true
        },
        {
          "@type": "WebPage",
          "@id": itemUrl,
          "url": itemUrl,
          "name": normalizedItemName,
          "primaryImageOfPage": {
            "@id": imageUrl2048
          }
        }
      ]
    }, null, 2)}
    </script>`}
  {/if}
</svelte:head>

<div class="page">
  {#key itemSlug}
    {#if loading}
      <div class="loading">
        <div class="spinner"></div>
        <span>Lade Bild...</span>
      </div>
    {:else if error}
      <div class="error">❌ Fehler: {error}</div>
    {:else if image}
    <div class="passepartout-container">
      <figure>
        <a href="/" class="image-link">
          <img
            src={imageSource}
            srcset={imageSrcset || undefined}
            sizes={imageSizes || undefined}
            alt={image.title && image.description 
              ? `${image.title} - ${image.description}` 
              : image.title || image.description || image.caption || `Bild von ${image.original_name || 'unbekannt'}`}
            class="main-image"
            width={imageWidth2048}
            height={imageHeight2048}
            loading="eager"
            decoding="async"
            fetchpriority="high"
          />
        </a>
        {#if image.caption}
          <figcaption>{image.caption}</figcaption>
        {/if}
      </figure>
      <div class="passepartout-info">
        <h1 class="title" class:editable={isCreator || $unifiedRightsStore.rights?.edit} class:editing={editingTitle}>
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
            <span class="title-text" tabindex="0" role="button" on:click={startEditTitle} on:keydown={(e) => handleKey(e, startEditTitle)}>
              {image.title || image.original_name || `Bild ${image.id?.substring(0, 8)}...`}
            </span>
          {/if}
        </h1>
        {#if isCreator || $unifiedRightsStore.rights?.edit}
          <p class="caption" class:editable={isCreator || $unifiedRightsStore.rights?.edit} class:editing={editingCaption}>
            {#if editingCaption}
              <div class="caption-edit-container">
                <textarea
                  id="caption-edit-input"
                  bind:value={captionEditValue}
                  maxlength="300"
                  on:keydown={handleCaptionKeydown}
                  on:blur={saveCaption}
                  class="caption-edit-input"
                  class:valid={captionEditValue.length >= 80 && captionEditValue.length <= 120}
                  placeholder="Emotionale Beschreibung eingeben (80-120 Zeichen ideal)..."
                  rows="2"
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="sentences"
                  inputmode="text"
                ></textarea>
                <span class="char-count" class:valid={captionEditValue.length >= 80 && captionEditValue.length <= 120}>
                  {captionEditValue.length}/300
                </span>
              </div>
            {:else}
              <span class="caption-text" tabindex="0" role="button" on:click={startEditCaption} on:keydown={(e) => handleKey(e, startEditCaption)}>
                {#if image.caption}
                  <em>{@html image.caption.replace(/\\n/g, '<br>').replace(/\n/g, '<br>')}</em>
                {:else}
                  <em class="placeholder">Klicke hier um eine emotionale Beschreibung hinzuzufügen</em>
                {/if}
              </span>
            {/if}
          </p>
        {:else if image.caption}
          <p class="caption">
            <span class="caption-text">
              <em>{image.caption}</em>
            </span>
          </p>
        {/if}
        <p class="description" class:editable={isCreator || $unifiedRightsStore.rights?.edit} class:editing={editingDescription}>
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
              <span class="description-text" tabindex="0" role="button" on:click={startEditDescription} on:keydown={(e) => handleKey(e, startEditDescription)}>
                {#if image.description}
                  {image.description}
                {:else}
                  <span class="placeholder">Keine Beschreibung verfügbar</span>
                {/if}
              </span>
            {/if}

      </div>
    </div>
    <ImageControlsSection
      {image}
      isCreator={isCreator}
      onSetLocationFilter={setLocationFilter}
      onCopyLink={copyCurrentLink}
      onDeleteImage={deleteImage}
      onDownloadOriginal={downloadOriginal}
      onToggleGallery={toggleGallery}
    />
    {#if image.lat && image.lon}
      <div class="radius-control">
        <div class="radius-value" class:limit-reached={isAtItemLimit}>
          {formatRadius(radius)}
          {#if filteredNearby.length > 0}
            <span class="nearby-count">• {filteredNearby.length} Items</span>
            {#if isAtItemLimit}
              <span class="limit-indicator">(max. 300)</span>
            {/if}
          {/if}
          {#if typeof hiddenItems !== 'undefined' && hiddenItems.length > 0 && (isAdmin || hasOwnHiddenItems)}
            <span class="hidden-count" class:active={showHiddenItems} on:click={toggleHiddenItems} on:keydown={(e) => handleKey(e, toggleHiddenItems)}>
              + {hiddenItems.length} ausgeblendet
            </span>
          {/if}
        </div>
        <input id="radius" type="range" min="50" max="2000" step="50" value={radius} on:input={onRadiusInput} on:change={onRadiusChange} class:limit-reached={isAtItemLimit}>
      </div>
    {/if}
    <section class="nearby" data-nosnippet>
      <NearbyGallery
        nearby={visibleNearby}
        isCreator={isCreator}
        showImageCaptions={showImageCaptions}
        userLat={image?.lat}
        userLon={image?.lon}
        getDistanceFromLatLonInMeters={getDistanceFromLatLonInMeters}
        onGalleryToggle={handleNearbyGalleryToggle}
        getGalleryStatus={getNearbyGalleryStatus}
        layout={galleryLayout}
      />
    </section>
    
    <!-- SEO-optimiert: Serverseitig gerenderte Links für Google -->
    {#if nearby && nearby.length > 0}
      <div class="seo-nearby-links" style="display: none;">
        <h3>Bilder in der Nähe</h3>
        <ul>
          {#each nearby.slice(0, 300) as item}
            <li>
              <a href="/item/{item.slug}" 
                 title="{item.caption || item.description}"
                 alt="{item.title} ({Math.round(item.distance)}m)">
                {item.title} ({Math.round(item.distance)}m)
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/if}


    
    <div class="meta-section single-exif">
      <!-- Column 1: Keywords -->
      <div class="keywords-column">
        <h2 class="keywords-title" class:editable={isCreator || $unifiedRightsStore.rights?.edit} class:editing={editingKeywords} on:click={startEditKeywords}>
          Keywords
        </h2>
        {#if editingKeywords}
          <div class="keywords-edit-container">
            <textarea
              id="keywords-edit-input"
              bind:value={keywordsEditValue}
              maxlength="800"
              on:keydown={handleKeywordsKeydown}
              on:blur={saveKeywords}
              class="keywords-edit-input"
              rows="8"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="sentences"
              placeholder="Keywords durch Kommas getrennt eingeben..."
            ></textarea>
            <span class="char-count" class:limit-reached={keywordsEditValue.split(',').filter(k => k.trim().length > 0).length >= 50}>{keywordsEditValue.split(',').filter(k => k.trim().length > 0).length}/50</span>
          </div>
        {:else}
          {#if image.keywords && image.keywords.length}
            <div class="keywords">
              {#each image.keywords as kw}
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
        <div class="filename" class:editable={isCreator || $unifiedRightsStore.rights?.edit} class:editing={editingFilename}>
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
              <span class="char-count">{filenameEditValue.length}/120</span>
            </div>
          {:else}
            <span class="filename-text" tabindex="0" role="button" on:click={startEditFilename} on:keydown={(e) => handleKey(e, startEditFilename)}>{image.original_name || 'Unbekannt'}</span>
          {/if}
        </div>
        <div class="filename">{browser ? window.location.href : ''}</div>
        {#if image.slug}
          <div class="filename" class:editable={isCreator || $unifiedRightsStore.rights?.edit} class:editing={editingSlug}>
            {#if editingSlug}
              <div class="filename-edit-container">
                <input
                  id="slug-edit-input"
                  type="text"
                  bind:value={slugEditValue}
                  maxlength="100"
                  on:keydown={handleSlugKeydown}
                  on:blur={saveSlug}
                  class="filename-edit-input"
                  placeholder="Slug eingeben..."
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="none"
                  inputmode="text"
                />
                <span class="char-count">{slugEditValue.length}/100</span>
              </div>
            {:else}
              <span class="filename-text" tabindex="0" role="button" on:click={startEditSlug} on:keydown={(e) => handleKey(e, startEditSlug)}>Slug: {image.slug}</span>
            {/if}
          </div>
        {/if}
        <div class="filename">ID: {image?.id}</div>
        <div class="filename">64px: {fileSizes.size64 ? formatFileSize(fileSizes.size64) : 'unbekannt'}  |  512px: {fileSizes.size512 ? formatFileSize(fileSizes.size512) : 'unbekannt'}  |  2048px: {fileSizes.size2048 ? formatFileSize(fileSizes.size2048) : 'unbekannt'}</div>
      </div>
      <!-- Column 2: All EXIF/Meta -->
      <div class="meta-column">
        <h2 class="exif-toggle" on:click={() => showFullExif = true} on:keydown={(e) => handleKey(e, () => showFullExif = true)}>Aufnahmedaten</h2>
        <!-- Immer die Basisdaten anzeigen -->
        {#if true}
          <!-- Essential EXIF data -->
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
          <!-- Wenn showFullExif aktiviert wurde, zeige zusätzliche Felder -->
          {#if showFullExif && image.exif_data}
            {#if image.exif_data.Orientation}
              <div class="meta-line">Ausrichtung: {image.exif_data.Orientation}</div>
            {/if}
            {#if image.exif_data.Flash}
              <div class="meta-line">Blitz: {image.exif_data.Flash}</div>
            {/if}
            {#if image.exif_data.Software}
              <div class="meta-line">Software: {image.exif_data.Software}</div>
            {/if}
            {#if image.exif_data.TimeCreated}
              <div class="meta-line">Aufnahmezeit: {formatTimeCreated(image.exif_data.TimeCreated)}</div>
            {/if}
          {/if}
        {/if}
      </div>
      <!-- Column 3: Creator Card (if available) -->
      <div class="column-card">
        <h2>Ersteller</h2>
        {#if image.profile}
          <div class="creator-header">
            {#if image.profile.avatar_url}
              <img
                src={image.profile.avatar_url.startsWith('http') ? image.profile.avatar_url : `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/avatars/${image.profile.avatar_url}`}
                alt="Avatar"
                class="avatar clickable-avatar"
                on:click={setUserFilter}
                title={`Nur Bilder von ${image.profile.full_name} anzeigen`}
              />
            {:else}
              <div class="avatar-placeholder clickable-avatar" on:click={setUserFilter} title={`Nur Bilder von ${image.profile.full_name} anzeigen`}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
              </div>
            {/if}
          </div>
          <div class="creator-details">
            <h3 class="creator-name clickable-name" on:click={setUserFilter} on:keydown={(e) => handleKey(e, setUserFilter)} title={`Nur Bilder von ${image.profile.full_name} anzeigen`}>
              {image.profile.full_name}
            </h3>
            <div class="creator-address">
              {#if image.profile.show_address && image.profile.address}
                <div>{@html image.profile.address.replace(/\n/g, '<br>')}</div>
              {/if}
            </div>
            <div class="creator-contact">
              {#if image.profile.show_phone && image.profile.phone}
                <div>
                  <svg class="contact-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                  </svg>
                  <a href={`tel:${image.profile.phone}`}>{image.profile.phone}</a>
                </div>
              {/if}
              {#if image.profile.show_email && image.profile.email}
                <div>
                  <svg class="contact-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                  </svg>
                  <a href={`mailto:${image.profile.email}`}>{image.profile.email}</a>
                </div>
              {/if}
              {#if image.profile.show_website && image.profile.website}
                <div>
                  <svg class="contact-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                  </svg>
                  <a href={image.profile.website} target="_blank" rel="noopener noreferrer">{image.profile.website}</a>
                </div>
              {/if}
            </div>
            <div class="creator-socials">
              {#if image.profile.show_social && image.profile.instagram}
                <a href={image.profile.instagram} target="_blank" rel="noopener noreferrer" class="social-link">
                  <svg class="social-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </a>
              {/if}
              {#if image.profile.show_social && image.profile.facebook}
                <a href={image.profile.facebook} target="_blank" rel="noopener noreferrer" class="social-link">
                  <svg class="social-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>
              {/if}
              {#if image.profile.show_social && image.profile.twitter}
                <a href={image.profile.twitter} target="_blank" rel="noopener noreferrer" class="social-link">
                  <svg class="social-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                </a>
              {/if}
            </div>
            {#if image.profile.show_bio && image.profile.bio}
              <div class="creator-bio">
                <div>{@html image.profile.bio.replace(/\n/g, '<br>')}</div>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
            <ImageMapSection {image} nearby={filteredNearby} isCreator={isCreator} hasEditRights={$unifiedRightsStore.rights?.edit} on:openMapPicker={() => { showMapPicker = true; }} />
    <MapPickerOverlay
      visible={showMapPicker}
      lat={image?.lat}
      lon={image?.lon}
      image={image}
      onCancel={() => { showMapPicker = false; }}
      onSave={async (lat, lon) => {
        showMapPicker = false;
        if (image && image.id && (isCreator || $unifiedRightsStore.rights?.edit)) {
          try {
            const res = await authFetch(`/api/item/${image.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lat, lon })
            });
            if (res.ok) {
              image.lat = lat;
              image.lon = lon;
            } else {
              console.error('Failed to save coordinates');
            }
          } catch (err) {
            console.error('Error saving coordinates:', err);
          }
        }
      }}
    />

    <!-- Item Rights Manager Overlay -->
    {#if showRightsManager && image}
      <div class="rights-overlay">
        <div class="rights-modal">
          <div class="rights-header">
            <h2>Rechte verwalten</h2>
            <button 
              class="close-btn" 
              on:click={() => { showRightsManager = false; }}
              aria-label="Schließen"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="rights-content">
            <ItemRightsManager 
              itemId={image.id} 
              itemTitle={image.title || image.original_name || 'Unbekanntes Item'} 
            />
          </div>
        </div>
      </div>
    {/if}
  {:else}
    <div class="error">❌ Bild nicht gefunden</div>
  {/if}
  
  <!-- Zur Galerie zurückkehren FAB -->
  <button 
    class="gallery-back-fab"
    on:click={() => goto('/')}
    title="Zur Galerie zurückkehren"
    aria-label="Zur Galerie zurückkehren"
  >
    <!-- Gallery Grid Icon for back to gallery -->
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="6" height="6"/>
      <rect x="15" y="3" width="6" height="6"/>
      <rect x="3" y="15" width="6" height="6"/>
      <rect x="15" y="15" width="6" height="6"/>
    </svg>
  </button>

  <!-- Rechte verwalten FAB - nur für Ersteller sichtbar -->
  {#if isCreator}
    <button 
      class="fab-button rights-manager"
      on:click={() => showRightsManager = true}
      title="Rechte verwalten"
      aria-label="Rechte verwalten"
    >
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
        <path d="M12 11v4"/>
        <path d="M12 19h.01"/>
      </svg>
    </button>
  {/if}

  <!-- Scroll to Top / Fullscreen FAB - ersetzt sich gegenseitig -->
  {#if showScrollToTop}
    <button
      class="fab-button scroll-to-top"
      on:click={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      title="Nach oben scrollen"
      aria-label="Nach oben scrollen"
    >
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 15l-6-6-6 6"/>
      </svg>
    </button>
  {:else}
    <button
      class="fab-button fullscreen"
      on:click={() => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen();
        } else {
          document.exitFullscreen();
        }
      }}
      title="Vollbildmodus"
      aria-label="Vollbildmodus"
    >
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
      </svg>
    </button>
  {/if}
    {/key}
</div>

<style>
  .meta-section-grid {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    gap: 2rem;
    margin-top: 2.5rem;
    margin-bottom: 2.5rem;
    align-items: flex-start;
  }
  .meta-col {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .meta-col-1 {
    /* Optional: für größere Breite */
  }
  .meta-col-2 {
    /* Optional: für mittlere Spalte */
  }
  .meta-col-3 {
    /* Optional: für rechte Spalte */
  }
  .title-text:hover,
  .description-text:hover {
    color: var(--culoca-orange, #ee7221);
    cursor: pointer;
    transition: color 0.2s;
  }
  .passepartout-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    width: 100%;
    padding: 12px 12px 12px 12px;
    margin: 0 auto;
    background: var(--passepartout-bg);
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
    max-height: 800px;
    max-width: 100%;
    object-fit: contain;
    border: 1px solid #ffffff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    background: transparent;
  }
  .title {
    font-size: 1.8rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 1rem 0;
    line-height: 1.3;
    background: transparent;
  }

  .description {
    font-size: 1rem;
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0 0 0.5rem 0;
    background: transparent;
  }

  .description.placeholder {
    color: var(--text-muted);
    font-style: italic;
    background: transparent;
  }
  .passepartout-container .description.placeholder {
    color: var(--bg-secondary);
    font-style: italic;
    background: transparent;
  }
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
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    font-size: 16px;
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
    min-width: 60px;
    text-align: right;
    background: transparent;
    transition: color 0.3s ease;
  }
  .char-count.valid {
    color: var(--success-color);
    background: transparent;
  }
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
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    font-size: 16px;
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
  .radius-control {
    margin: 1.2rem;
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
  .radius-value.limit-reached {
    color: var(--culoca-orange);
  }
  .limit-indicator {
    font-size: 0.75rem;
    font-weight: 400;
    color: var(--culoca-orange);
    margin-left: 0.3rem;
    opacity: 0.8;
  }
  .nearby-count {
    font-size: 0.85rem;
    font-weight: 400;
    color: var(--text-muted);
    margin-left: 0.3rem;
  }
  .hidden-count {
    font-size: 0.85rem;
    font-weight: 400;
    color: var(--text-muted);
    margin-left: 0.3rem;
    cursor: pointer;
    transition: color 0.2s;
    opacity: 0.7;
  }
  .hidden-count:hover {
    color: var(--culoca-orange);
    opacity: 1;
  }
  .hidden-count.active {
    color: var(--culoca-orange);
    opacity: 1;
  }
  /* Range-Slider mit gefüllter Spur */
  .radius-control input[type="range"] {
    width: 100%;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    margin: 20px 0 10px 0;
    background: transparent;
    --thumb: 32px;      /* Thumb-Größe */
    --track: 8px;       /* Track-Höhe */
    --pct: 0%;          /* wird per JS gesetzt */
    --tw-ring-color: #0066cc; /* Standard Blauton */
  }

  /* Orange bei max. 300 Items */
  .radius-control input[type="range"].limit-reached {
    --tw-ring-color: var(--culoca-orange);
  }

  /* ===== WebKit (Chrome/Safari/Edge) ===== */
  .radius-control input[type="range"]::-webkit-slider-runnable-track {
    height: var(--track);
    border-radius: 999px;
    background:
      linear-gradient(to right,
        var(--tw-ring-color) 0%,
        var(--tw-ring-color) var(--pct),
        #e5e7eb var(--pct),
        #e5e7eb 100%);
  }
  .radius-control input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: var(--thumb);
    height: var(--thumb);
    border-radius: 50%;
    background: var(--tw-ring-color);
    border: 0px solid var(--bg-primary);
    cursor: pointer;
    /* Track mittig unter dem Thumb ausrichten */
    margin-top: calc((var(--track) - var(--thumb)) / 2);
    transition: transform .1s ease;
  }

  /* ===== Firefox ===== */
  .radius-control input[type="range"]::-moz-range-track {
    height: var(--track);
    background: #e5e7eb;
    border-radius: 999px;
  }
  .radius-control input[type="range"]::-moz-range-progress {
    height: var(--track);
    background: var(--tw-ring-color);
    border-radius: 999px;
  }
  .radius-control input[type="range"]::-moz-range-thumb {
    width: var(--thumb);
    height: var(--thumb);
    border-radius: 50%;
    background: var(--tw-ring-color);
    border: 2px solid var(--bg-primary);
    cursor: pointer;
    transition: transform .1s ease;
  }

  /* (optional) kleine Interaktions-Details */
  .radius-control input[type="range"]:hover::-webkit-slider-thumb,
  .radius-control input[type="range"]:hover::-moz-range-thumb { 
    transform: scale(.98); 
  }
  .transition-area {
    position: relative;
    background: var(--bg-secondary);
    padding: 1rem 0.5rem;
    margin-top: -2px;
    overflow: hidden;
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
    margin-top: 12px;
  }
  .action-buttons {
    display: flex;
    gap: 0.7rem;
    justify-content: center;
    margin-top: 0;
    margin-bottom: 0.2rem;
    background: transparent;
  }
  .info-section {
    background: var(--bg-primary);
    color: var(--text-primary);
    margin-top: 0;
    padding: 0;
  }
  .centered-content {
    text-align: center;
    margin-bottom: 2rem;
    background: transparent;
    padding: 0;
  }
  .edge-to-edge-gallery {
    width: 100%;
    margin: 0 auto;
  }
  .meta-section.single-exif {
    display: grid;
    grid-template-columns: 2.5fr 1fr 1fr;
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
  .creator-header {
    display: flex;
    justify-content: flex-start;
    margin-bottom: 1rem;
  }
  .clickable-avatar, .avatar-placeholder {
    cursor: pointer;
    transition: all 0.2s ease;
    border: 2px solid transparent;
  }
  .clickable-avatar:hover, .avatar-placeholder:hover {
    border-color: var(--culoca-orange);
    transform: scale(1.05);
  }
  .avatar-placeholder {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--bg-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
  }
  .creator-name {
    cursor: pointer;
    transition: color 0.2s ease;
  }
  .creator-name:hover {
    color: var(--culoca-orange);
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
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
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
  .keywords {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0 0 2rem;
    background: transparent;
  }
  .chip {
    background: var(--bg-tertiary);
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
    font-size: 0.8rem;
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
    transition: color 0.2s, box-shadow 0.2s, transform 0.2s;
  }
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
  .keywords-title {
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 1rem 0;
    padding: 0;
  }
  .keywords-title.editable {
    cursor: pointer;
    transition: color 0.2s;
    background: transparent;
  }
  .caption {
    font-style: italic;
    color: var(--text-secondary);
    font-size: 1rem;
    line-height: 1.4;
    margin: 0.5rem 0;
    background: transparent;
  }
  .caption.editable {
    cursor: pointer;
    transition: color 0.2s;
  }
  .caption.editable:hover {
    color: var(--culoca-orange);
  }
  .caption-text {
    display: block;
    background: transparent;
  }
  .caption-edit-container {
    position: relative;
    width: 100%;
  }
  .caption-edit-input {
    width: 100%;
    padding: 0.5rem;
    border: 2px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: inherit;
    font-size: 1rem;
    line-height: 1.4;
    resize: vertical;
    min-height: 60px;
    transition: border-color 0.2s;
  }
  .caption-edit-input:focus {
    outline: none;
    border-color: var(--culoca-orange);
  }
  .caption-edit-input.valid {
    border-color: var(--success-color);
  }
  .caption.placeholder {
    color: var(--text-muted);
    font-style: italic;
  }
  .keywords-title.editable:hover {
    color: var(--culoca-orange);
    background: transparent;
  }
  .keywords-title.editing {
    color: var(--accent-color);
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
    min-height: 200px;
    resize: vertical;
    transition: border-color 0.2s, background-color 0.3s ease, color 0.3s ease;
    font-family: inherit;
    line-height: 1.4;
  }
  .keywords-edit-input:focus {
    outline: none;
    border-color: var(--accent-color);
    background: var(--bg-tertiary);
  }
  .char-count {
    font-size: 0.8rem;
    color: var(--text-secondary);
    text-align: right;
    font-weight: 500;
  }
  .char-count.valid {
    color: var(--success-color);
  }
  .char-count.too-many {
    color: var(--error-color);
  }
  .map-pin-btn {
    display: block;
    margin-left: 1rem;
    vertical-align: middle;
  }
  .map-pin-btn:hover svg path {
    fill: var(--culoca-orange, #ee7221);
  }
  /* Filename Edit Styles (aus Sicherung) */
  .filename-edit-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    justify-content: flex-end;
    background: transparent;
  }
  .filename-edit-input {
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 1rem;
    padding: 0.5rem;
    text-align: left;
    width: 100%;
    transition: border-color 0.2s, background-color 0.3s ease, color 0.3s ease;
    font-family: inherit;
  }
  .filename-edit-input:focus {
    outline: none;
    border-color: var(--accent-color);
    background: var(--bg-tertiary);
  }
  .char-count {
    font-size: 0.8rem;
    color: var(--text-muted);
    min-width: 40px;
    text-align: right;
    background: transparent;
    transition: color 0.3s ease;
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
    .creator-contact > div {
      justify-content: center;
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
    .creator-contact > div {
      justify-content: center;
    }
    .creator-socials {
      justify-content: center;
    }
  }

  /* Zur Galerie zurückkehren FAB */
  .gallery-back-fab {
    position: fixed;
    bottom: 7rem; /* Über dem Vollbild-FAB */
    right: 2rem;
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
    pointer-events: auto;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
    z-index: 1001;
  }
  
  .gallery-back-fab:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 20px var(--shadow);
    background: rgba(255, 255, 255, 0.1);
  }
  
  .gallery-back-fab:active {
    transform: scale(0.95);
  }
  
  /* Mobile responsive */
  @media (max-width: 768px) {
    .gallery-back-fab {
      bottom: 6rem;
      right: 1rem;
      width: 3.5rem;
      height: 3.5rem;
    }
    
    .gallery-back-fab svg {
      width: 36px;
      height: 36px;
    }
  }

  /* FAB Styles für Detailseite */
  .fab-button {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
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
    pointer-events: auto;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
    z-index: 1001;
  }
  
  .fab-button:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 20px var(--shadow);
    background: rgba(255, 255, 255, 0.1);
  }
  
  .fab-button:active {
    transform: scale(0.95);
  }
  
  .fab-button.scroll-to-top,
  .fab-button.fullscreen {
    bottom: 2rem; /* Gleiche Position für beide FABs */
  }
  
  /* Mobile responsive für FABs */
  @media (max-width: 768px) {
    .fab-button {
      bottom: 1rem;
      right: 1rem;
      width: 3.5rem;
      height: 3.5rem;
    }
    
    .fab-button.scroll-to-top,
    .fab-button.fullscreen {
      bottom: 1rem; /* Gleiche Position für beide FABs */
    }
    
    .fab-button svg {
      width: 36px;
      height: 36px;
    }
  }
  .radius-control input[type="range"].limit-reached {
    accent-color: var(--culoca-orange);
  }

  /* Rights Manager Overlay Styles */
  .rights-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(5px);
  }

  .rights-modal {
    background: var(--bg-primary);
    border-radius: 12px;
    max-width: 90vw;
    max-height: 90vh;
    width: 800px;
    overflow: hidden;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  }

  .rights-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .rights-header h2 {
    margin: 0;
    color: var(--text-primary);
    font-size: 1.5rem;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .rights-content {
    padding: 0;
    max-height: calc(90vh - 80px);
    overflow-y: auto;
  }

  /* FAB Position für Rights Manager */
  .fab-button.rights-manager {
    bottom: 12rem; /* Über dem Gallery Back FAB */
  }

  @media (max-width: 768px) {
    .rights-modal {
      width: 95vw;
      max-height: 95vh;
    }

    .rights-content {
      max-height: calc(95vh - 80px);
    }

    .fab-button.rights-manager {
      bottom: 10rem;
    }
  }
</style> 