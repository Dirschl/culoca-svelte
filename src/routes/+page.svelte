<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { onMount } from 'svelte';
  import { writable, get } from 'svelte/store';
  import GalleryLayout from '$lib/GalleryLayout.svelte';
  import NewsFlash from '$lib/NewsFlash.svelte';
  import FloatingActionButtons from '$lib/FloatingActionButtons.svelte';
  import TrackModal from '$lib/TrackModal.svelte';
  import FullscreenMap from '$lib/FullscreenMap.svelte';
  import WelcomeSection from '$lib/WelcomeSection.svelte';
  import FilterBar from '$lib/FilterBar.svelte';
  import SearchResults from '$lib/SearchResults.svelte';
  import { beforeNavigate, afterNavigate } from '$app/navigation';
  import { showPublicContentModal } from '$lib/modalStore';
  import { welcomeVisible, hideWelcome, dismissWelcome, isWelcomeDismissed } from '$lib/welcomeStore';
  import { filterStore, userFilter, locationFilter, hasActiveFilters, getEffectiveGpsPosition } from '$lib/filterStore';
  import { page as pageStore } from '$app/stores';

  import { updateGalleryStats, galleryStats } from '$lib/galleryStats';
  import { sessionStore } from '$lib/sessionStore';
  import { intelligentImageLoader } from '$lib/intelligentImageLoader';
  import { authFetch } from '$lib/authFetch';
  import { dynamicImageLoader } from '$lib/dynamicImageLoader';
  import LoginOverlay from '$lib/LoginOverlay.svelte';
  import UploadDialog from '$lib/UploadDialog.svelte';
  import SearchBar from '$lib/SearchBar.svelte';
  import GalleryFunctionsInfo from '$lib/GalleryFunctionsInfo.svelte';
  import StatusOverlay from '$lib/StatusOverlay.svelte';

  const pics = writable<any[]>([]);
  const dynamicLoader = dynamicImageLoader;
  let page = 0, size = 100, loading = false, hasMoreImages = true; // 100 Bilder pro Batch für Location Filter
  let displayedImageCount = 0; // Zähler für tatsächlich angezeigte Bilder

  let galleryKey = Date.now(); // Key to force gallery component re-render
  let hasLocationFilter = false; // Global variable for location filter state
  let lastFilterState = ''; // Track last filter state to prevent infinite loops
  let filterChangeTimeout: NodeJS.Timeout | null = null; // Debounce timeout for filter changes
  let anchorItemId: string | null = null; // ID of the anchor item (selected item with 0km distance)
  
  // Long press functionality
  let longPressTarget: HTMLElement | null = null;
  let longPressTimeout: number | null = null;
  
  // Bewegungserkennung für Gallery-Modi
  let isMoving = false; // Bewegungsmodus aktiv
  let lastPosition: { lat: number; lon: number; timestamp: number } | null = null;
  let settingsIconRotation = 0; // Rotation des Settings-Icons
  let continuousRotation = 0; // Kontinuierliche Rotation im mobilen Modus
  let rotationSpeed = 1; // Geschwindigkeit der kontinuierlichen Rotation (1 = langsam, 5 = schnell)
  let rotationInterval = null; // Interval für kontinuierliche Rotation
  
  // Manual 3x3 mode toggle
  let isManual3x3Mode = false; // Manueller 3x3 Modus (durch Klick auf GPS-Koordinaten)
  
  // Function to toggle 3x3 mode manually
  function toggle3x3Mode() {
    isManual3x3Mode = !isManual3x3Mode;
    
    if (isManual3x3Mode) {
      console.log('🎯 Manueller 3x3 Modus aktiviert');
      settingsIconRotation += 360; // Start rotation
      startContinuousRotation(); // Start kontinuierliche Rotation
      show3x3ModeStatus('Mobile Galerie aktiviert', 3000);
      
      // Clear gallery and load 3x3 grid
      pics.set([]);
      page = 0;
      hasMoreImages = true;
      loadMore('manual 3x3 mode');
    } else {
      console.log('📋 Zurück zur normalen Galerie');
      settingsIconRotation = 0; // Stop rotation
      stopContinuousRotation(); // Stop kontinuierliche Rotation
      show3x3ModeStatus('Normale Galerie aktiviert', 3000);
      
      // Clear gallery and load normal list
      pics.set([]);
      page = 0;
      hasMoreImages = true;
      loadMore('normal gallery mode');
    }
  }
  
  // Funktion für kontinuierliche Rotation im mobilen Modus
  function startContinuousRotation() {
    if (rotationInterval) {
      clearInterval(rotationInterval);
    }
    
    rotationInterval = setInterval(() => {
      continuousRotation += rotationSpeed;
      if (continuousRotation >= 360) {
        continuousRotation = 0;
      }
    }, 50); // Alle 50ms aktualisieren
  }
  
  // Funktion zum Stoppen der kontinuierlichen Rotation
  function stopContinuousRotation() {
    if (rotationInterval) {
      clearInterval(rotationInterval);
      rotationInterval = null;
    }
    continuousRotation = 0;
  }
  
  // Funktion zum Erhöhen der Rotationsgeschwindigkeit
  function increaseRotationSpeed() {
    rotationSpeed = Math.min(rotationSpeed + 1, 10); // Maximal 10x Geschwindigkeit
    console.log(`⚡ Rotationsgeschwindigkeit erhöht auf: ${rotationSpeed}x`);
  }
  
  // Function to stop 3x3 mode when filters/search are used
  function stop3x3Mode() {
    if (isManual3x3Mode) {
      console.log('🛑 3x3 Modus durch Filter/Suche gestoppt');
      isManual3x3Mode = false;
      settingsIconRotation = 0; // Stop rotation
      stopContinuousRotation(); // Stop kontinuierliche Rotation
      show3x3ModeStatus('3x3 Modus deaktiviert', 3000);
    }
  }
  
  

  // Reaktive Funktion: Update displayed count whenever pics store changes
  $: if ($pics) {
    const newCount = $pics.length;
    if (newCount !== displayedImageCount) {
          displayedImageCount = newCount;
          console.log(`📊 Angezeigte Bilder: ${displayedImageCount}/${$galleryStats.totalCount}`);
          
      // Test: Zähle tatsächlich sichtbare Bilder im DOM
          setTimeout(() => {
            const justifiedImages = document.querySelectorAll('.justified-pic').length;
            const gridImages = document.querySelectorAll('.grid-item img').length;
            const totalVisibleImages = justifiedImages + gridImages;
            console.log(`🔍 DOM-Test: ${totalVisibleImages} Bilder tatsächlich im DOM sichtbar (${justifiedImages} justified, ${gridImages} grid)`);
        if (totalVisibleImages !== displayedImageCount) {
          console.warn(`⚠️ DISCREPANCY: ${displayedImageCount} in Store vs ${totalVisibleImages} im DOM`);
        }
      }, 100);
          
          // Event für NewsFlash-Komponente
          window.dispatchEvent(new CustomEvent('displayedImageCountChanged', {
            detail: { displayedCount: displayedImageCount, totalCount: $galleryStats.totalCount }
          }));
    }
  }
  
  // Reaktive Funktion: Reload gallery when filters change
  $: if ($filterStore && authChecked) {
     const hasUserFilter = $filterStore.userFilter !== null;
     hasLocationFilter = $filterStore.locationFilter !== null; // Update global variable
     const hasReferrerAccount = $filterStore.referrerAccount !== null;
     const needsReload = hasUserFilter || hasLocationFilter || hasReferrerAccount;

     if (!searchQuery.trim() && !isSearching && !loading) {
       // Stop 3x3 mode if filters are applied
       if (needsReload && isManual3x3Mode) {
         stop3x3Mode();
       }
       
       // Prevent infinite loop by checking if we're already processing this filter state
       const currentFilterState = JSON.stringify({
         userFilter: $filterStore.userFilter,
         locationFilter: $filterStore.locationFilter,
         referrerAccount: $filterStore.referrerAccount
       });
       
       // Only proceed if filter state has changed and we're not already loading
       if (lastFilterState !== currentFilterState && !loading && hasMoreImages) {
         lastFilterState = currentFilterState;
         
         if (needsReload && !anchorItemId) {
           console.log('[Filter Change] Filter store changed with meaningful filters, reloading gallery:', $filterStore);
           
           if (hasLocationFilter) {
             // Location Filter aktiv - Gallery leeren und GPS-Cache löschen
             console.log('[Filter Change] Location filter applied, clearing gallery and GPS cache');
             pics.set([]);
             if ((window).gpsSortedData) {
               delete (window).gpsSortedData;
             }
             page = 0;
             hasMoreImages = true;
           } else {
             // Location Filter gelöscht - auf 3×3 Grid zurückfallen
             console.log('[Filter Change] Location filter cleared, falling back to 3×3 grid');
             pics.set([]);
             page = 0;
             hasMoreImages = true;
             
             // Clear GPS cache to force fresh 3×3 grid loading
             if ((window).gpsSortedData) {
               delete (window).gpsSortedData;
             }
           }
           
           // Add debounce to prevent rapid successive calls
           clearTimeout(filterChangeTimeout);
           filterChangeTimeout = setTimeout(() => {
             if (!loading) {
               loadMore('filter change');
             }
           }, 200);
         } else if (!needsReload) {
           // All filters cleared - reload gallery in normal mode
           console.log('[Filter Change] All filters cleared, reloading gallery in normal mode');
           
           // Clear gallery and reset state
           pics.set([]);
           page = 0;
           hasMoreImages = true;
           
           // Clear GPS cache
           if ((window).gpsSortedData) {
             delete (window).gpsSortedData;
           }
           
           // Add debounce to prevent rapid successive calls
           clearTimeout(filterChangeTimeout);
           filterChangeTimeout = setTimeout(() => {
             if (!loading) {
               loadMore('filter clear');
             }
           }, 200);
         }
       } else if (lastFilterState === currentFilterState) {
         console.log('[Filter Change] Filter state unchanged, skipping reload');
       } else if (loading || !hasMoreImages) {
         console.log('[Filter Change] Already loading or no more images, skipping reload');
       }
     }
   }
  


  // Bewegungserkennung deaktiviert - nur manueller 3x3 Modus
  function checkMovement(newLat: number, newLon: number) {
    // Bewegungserkennung ist deaktiviert - nur GPS-Tracking für normale Galerie
    lastPosition = { lat: newLat, lon: newLon, timestamp: Date.now() };
  }
  
  function updateGalleryMode() {
    // Deaktiviert - Gallery-Modus wird nur manuell gesteuert
  }
  
  // Status-Nachricht für Modus-Wechsel
  let modeStatusMessage = '';
  let modeStatusVisible = false;
  
  function showModeStatus(message: string, duration: number = 3000) {
    modeStatusMessage = message;
    modeStatusVisible = true;
    
    setTimeout(() => {
      modeStatusVisible = false;
    }, duration);
  }
  
  // Status-Nachricht für 3x3 Modus
  let mode3x3StatusMessage = '';
  let mode3x3StatusVisible = false;
  
  function show3x3ModeStatus(message: string, duration: number = 3000) {
    mode3x3StatusMessage = message;
    mode3x3StatusVisible = true;
    
    setTimeout(() => {
      mode3x3StatusVisible = false;
    }, duration);
  }

  // Funktion um zu prüfen, ob GPS-Daten für die Galerie verfügbar sind
  function hasValidGpsForGallery(): boolean {
    // Prüfe Location-Filter (höchste Priorität)
    if ($filterStore.locationFilter) {
      return true;
    }
    
    // Prüfe letzten GPS-Wert im FilterStore
    if ($filterStore.lastGpsPosition) {
      return true;
    }
    
    // Prüfe aktuellen GPS-Wert
    if (userLat !== null && userLon !== null) {
      return true;
    }
    
    // Prüfe gespeicherten GPS-Wert
    const lastLocation = loadLastKnownLocation();
    if (lastLocation && lastLocation.lat !== null && lastLocation.lon !== null) {
      return true;
    }
    
    return false;
  }

  // Funktion um die besten verfügbaren GPS-Koordinaten zu bekommen
  async function getBestAvailableGps(): Promise<{ lat: number; lon: number } | null> {
    // WICHTIG: Wenn ein Item ausgewählt ist, verwende dessen GPS-Koordinaten als "aktive GPS"
    // Location Filter darf diese nicht überschreiben!
    if (anchorItemId) {
      try {
        console.log(`[GPS] Item selected (${anchorItemId}), fetching its GPS coordinates as active GPS`);
        const { data: itemData } = await supabase
          .from('items')
          .select('lat, lon')
          .eq('id', anchorItemId)
          .single();
        
        if (itemData?.lat && itemData?.lon) {
          console.log(`[GPS] Using selected item GPS coordinates: ${itemData.lat}, ${itemData.lon}`);
          // Store anchor GPS coordinates for stable sorting
          anchorItemGps = { lat: itemData.lat, lon: itemData.lon };
          return { lat: itemData.lat, lon: itemData.lon };
        } else {
          console.log(`[GPS] Selected item (${anchorItemId}) has no GPS coordinates`);
        }
      } catch (error) {
        console.log(`[GPS] Error fetching selected item GPS coordinates:`, error);
      }
    }
    
    // Prüfe Location-Filter (nur wenn kein Item ausgewählt ist)
    // BUT: For distance calculation, we should use current GPS, not location filter
    if ($filterStore.locationFilter) {
      console.log(`[GPS] Location filter available: ${$filterStore.locationFilter.lat}, ${$filterStore.locationFilter.lon}`);
      // Don't return location filter for distance calculation - use current GPS instead
    }
    
    // Prüfe gespeicherte GPS-Koordinaten aus dem Profil (wenn eingeloggt)
    if (isLoggedIn && currentUser) {
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('home_lat, home_lon')
          .eq('id', currentUser.id)
          .single();
        
        if (profileData?.home_lat && profileData?.home_lon) {
          console.log(`[GPS] Using saved profile GPS coordinates: ${profileData.home_lat}, ${profileData.home_lon}`);
          return { lat: profileData.home_lat, lon: profileData.home_lon };
        }
      } catch (error) {
        console.log(`[GPS] Error fetching saved profile GPS coordinates:`, error);
      }
    }
    
    // Prüfe letzten GPS-Wert im FilterStore
    if ($filterStore.lastGpsPosition) {
      return $filterStore.lastGpsPosition;
    }
    
    // Prüfe aktuellen GPS-Wert
    if (userLat !== null && userLon !== null) {
      return { lat: userLat, lon: userLon };
    }
    
    // Prüfe gespeicherten GPS-Wert
    const lastLocation = loadLastKnownLocation();
    if (lastLocation && lastLocation.lat !== null && lastLocation.lon !== null) {
      return { lat: lastLocation.lat, lon: lastLocation.lon };
    }
    
    return null;
  }

  // Neue Funktion: Warte auf GPS und lade dann Galerie
  async function waitForGpsAndLoadGallery() {
    console.log('🔄 [GPS] Waiting for GPS data before loading gallery...');
    
    // In Simulation-Modus müssen wir nicht auf echtes GPS warten –
    // die Koordinaten werden via postMessage geliefert oder stehen
    // bereits in userLat/userLon.  Lade daher sofort das 3×3-Raster.
    if (simulationMode || gpsSimulationActive) {
      console.log('🔄 [GPS] Simulation mode detected – skipping real GPS wait');

      if (userLat !== null && userLon !== null) {
        // Use normal loading instead of grid loading for consistency
        loadMore('simulation mode with GPS');
      } else if (simulatedLat !== null && simulatedLon !== null) {
        // Use normal loading instead of grid loading for consistency
        loadMore('simulation mode with simulated GPS');
      } else {
        // Fallback: use Germany center
        loadMore('simulation mode with fallback GPS');
      }
      return;
    }
    
    // Prüfe zuerst gespeicherte GPS-Daten
    const lastLocation = loadLastKnownLocation();
    if (lastLocation && lastLocation.lat !== null && lastLocation.lon !== null) {
      console.log('🔄 [GPS] Using saved GPS data:', lastLocation);
      userLat = lastLocation.lat;
      userLon = lastLocation.lon;
      gpsStatus = 'active';
      
      // Lade Galerie mit gespeicherten GPS-Daten
      // Special handling for location filters to prevent flickering
        if (hasLocationFilter) {
          console.log("[Filter Change] Location filter detected - loading smoothly without clearing gallery");
          // For location filters: load smoothly without clearing existing images
          // This prevents the flickering effect
          page = 0;
          hasMoreImages = true;
          
          // Clear global GPS data to ensure fresh sorting from new location
          if ((window as any).gpsSortedData) {
            delete (window as any).gpsSortedData;
            console.log("[Filter Change] Cleared GPS sorted data for location filter");
          }
          
          // For location filters, use normal loading instead of grid loading
          loadMore('location filter with saved GPS');
        } else {
          // For other filters: reset gallery state immediately
          pics.set([]);
          page = 0;
          hasMoreImages = true;
          // Use normal loading instead of grid loading for consistency
          loadMore('saved GPS without location filter');
        }
      return;
    }
    
    // Keine gespeicherten GPS-Daten - warte auf GPS
    console.log('🔄 [GPS] No saved GPS data, waiting for GPS...');
    gpsStatus = 'checking';
    
    // Starte GPS-Tracking
    if (!gpsTrackingActive && !gpsSimulationActive && !simulationMode) {
      startGPSTracking();
    }
    
    // Warte bis zu 30 Sekunden auf GPS (erhöht für bessere Zuverlässigkeit)
    let attempts = 0;
    const maxAttempts = 60; // 60 * 500ms = 30 seconds
    
    const waitForGps = async () => {
      attempts++;
      
      if (userLat !== null && userLon !== null) {
        console.log('🔄 [GPS] GPS data received, loading gallery...');
        // Special handling for location filters to prevent flickering
        if (hasLocationFilter) {
          console.log("[Filter Change] Location filter detected - loading smoothly without clearing gallery");
          // For location filters: load smoothly without clearing existing images
          // This prevents the flickering effect
          page = 0;
          hasMoreImages = true;
          
          // Clear global GPS data to ensure fresh sorting from new location
          if ((window as any).gpsSortedData) {
            delete (window as any).gpsSortedData;
            console.log("[Filter Change] Cleared GPS sorted data for location filter");
          }
          
          // For location filters, use normal loading instead of grid loading
          loadMore('location filter with GPS data');
        } else {
          // For other filters: reset gallery state immediately
          pics.set([]);
          page = 0;
          hasMoreImages = true;
          // Use normal loading instead of grid loading for consistency
          loadMore('GPS data without location filter');
        }
        return;
      }
      
      if (attempts >= maxAttempts) {
        console.log('🔄 [GPS] GPS timeout, loading gallery with date sorting...');
        gpsStatus = 'unavailable';
        // Lade Galerie ohne GPS (normale Sortierung)
        // Special handling for location filters to prevent flickering
        if (hasLocationFilter) {
          console.log("[Filter Change] Location filter detected - loading smoothly without clearing gallery");
          // For location filters: load smoothly without clearing existing images
          // This prevents the flickering effect
          page = 0;
          hasMoreImages = true;
          
          // Clear global GPS data to ensure fresh sorting from new location
          if ((window as any).gpsSortedData) {
            delete (window as any).gpsSortedData;
            console.log("[Filter Change] Cleared GPS sorted data for location filter");
          }
        } else {
          // For other filters: reset gallery state immediately
          pics.set([]);
          page = 0;
          hasMoreImages = true;
        }
        page = 0;
        hasMoreImages = true;
        loadMore('initial mount without GPS');
        
        // Continue GPS tracking in background for future updates
        if (!gpsTrackingActive && !gpsSimulationActive && !simulationMode) {
          startGPSTracking();
        }
        return;
      }
      
      // Prüfe alle 500ms
      setTimeout(waitForGps, 500);
    };
    
    waitForGps();
  }

  let useJustifiedLayout = true;
  let profileAvatar: string | null = null;
  let showDistance = true; // Default to true to show distances when GPS is available
  let showCompass = false;
  let autoguide = false;
  let newsFlashMode: 'aus' | 'eigene' | 'alle' = 'alle';
  	let showSearchField = true; // Default: Suchfeld sichtbar, Logo versteckt
  let userLat: number | null = null;
  let userLon: number | null = null;
  let deviceHeading: number | null = null;
  let showUploadDialog = false;

  // Use centralized session store instead of local variables
  let currentUser: any = null;
  
  // Get authentication state from session store
  $: isLoggedIn = $sessionStore.isAuthenticated;
  
  // FilterBar Props
  let isPermalinkMode = false;
  let permalinkImageId: string | null = null;
  
  // Anchor GPS coordinates for stable sorting
  let anchorItemGps: { lat: number; lon: number } | null = null;
  

  

  
  // Search functionality
  let searchQuery = '';
  let searchResults: any[] = [];
  let isSearching = false;
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;
  let searchInput: HTMLInputElement;
  let useSearchResults = false; // Flag to switch between SearchResults component and legacy search
  let searchResultsComponent: any; // Reference to SearchResults component

  // Login-Overlay Variablen
  let loginEmail = '';
  let loginPassword = '';
  let loginLoading = false;
  let loginError = '';
  let loginInfo = '';
  let showRegister = false;
  let authChecked = false; // Prüft, ob der Login-Status bereits geladen wurde
  let showLoginOverlay = false; // Steuert die Anzeige des Login-Overlays

  // EXIF Upload Variablen


  // Preload gallery in background when on detail page
  let preloadInterval: number | null = null;
  
  // GPS tracking for automatic sorting
  let gpsWatchId: number | null = null;
  let lastKnownLat: number | null = null;
  let lastKnownLon: number | null = null;
  let gpsTrackingActive = false;
  const GPS_UPDATE_THRESHOLD = 100; // meters - erhöht von 10m auf 100m
  const GPS_UPDATE_INTERVAL = 30000; // 30 seconds - erhöht von 5s auf 30s

  let lastGalleryLoadTime = 0; // Verhindert zu häufiges Neuladen
  const MIN_RELOAD_INTERVAL = 30000; // Mindestabstand zwischen Neuladungen: 30s
  let galleryUpdateTimeout: number | null = null; // Debounce für Gallery-Updates

  // GPS Simulation support
  let gpsSimulationActive = false;
  let simulationMode = false; // Track if we're in simulation mode
  let simulatedLat: number | null = null;
  let simulatedLon: number | null = null;

  // Speech synthesis for autoguide
  let speechSynthesis: SpeechSynthesis | null = null;
  let currentSpeech: SpeechSynthesisUtterance | null = null;
  let autoguideBarVisible = true; // Always visible when autoguide is enabled
  let autoguideText = '';
  let lastSpokenText = '';

  let audioActivated = false;
  let currentImageTitle = ''; // Track current image title for display

  // Global variable to track speech state
  let speechRetryCount = 0;
  let lastSpeechText = '';
  let currentImageId = ''; // Track current image ID to know when to update text
  let lastAnnouncedImageId = ''; // Track last announced image to prevent duplicates
  let scrollTimeout: number | null = null;
  
  // Fullscreen map mode
  let showFullscreenMap = false;
  let showTrackModal = false;
  
  // GPS availability status with memory and timeout
  let gpsStatus: 'checking' | 'active' | 'denied' | 'unavailable' = 'checking';
  let showGPSMessage = false;
  let lastGPSUpdateTime: number | null = null;
  let gpsTimeoutId: ReturnType<typeof setTimeout> | null = null;
  const GPS_MEMORY_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds
  
  // Function to get GPS status with last update time
  function getGPSStatusText(): string {
    if (gpsStatus === 'active') {
      if (lastGPSUpdateTime) {
        const timeDiff = Date.now() - lastGPSUpdateTime;
        const minutes = Math.floor(timeDiff / 60000);
        const seconds = Math.floor((timeDiff % 60000) / 1000);
        
        if (minutes > 0) {
          return `GPS verfügbar (vor ${minutes}m ${seconds}s)`;
        } else {
          return `GPS verfügbar (vor ${seconds}s)`;
        }
      } else {
        return 'GPS verfügbar';
      }
    } else if (gpsStatus === 'checking') {
      return 'GPS wird geprüft...';
    } else if (gpsStatus === 'denied') {
      return 'GPS nicht erlaubt';
    } else {
      return 'GPS nicht verfügbar';
    }
  }

  // Function to get currently visible image
  function getCurrentlyVisibleImage(): any | null {
    const currentPics = get(pics);
    if (currentPics.length === 0) return null;
    
    const viewportHeight = window.innerHeight;
    const scrollTop = window.scrollY;
    const viewportCenter = scrollTop + (viewportHeight / 2);
    
    // Find all image elements in the gallery
    const imageElements = document.querySelectorAll('.pic-container, .grid-item');
    let closestImage: any | null = null;
    let closestDistance = Infinity;
    
    imageElements.forEach((element, index) => {
      const rect = element.getBoundingClientRect();
      const elementTop = rect.top + scrollTop;
      const elementCenter = elementTop + (rect.height / 2);
      const distance = Math.abs(elementCenter - viewportCenter);
      
      if (distance < closestDistance && index < currentPics.length) {
        closestDistance = distance;
        closestImage = currentPics[index];
      }
    });
    
    return closestImage;
  }
  
  // Function to announce current visible image
  function announceCurrentImage() {
    console.log('🎤 announceCurrentImage called');
    
    if (!autoguide || !audioActivated) {
      console.log('🎤 Autoguide not enabled or audio not activated');
      return;
    }
    
    const currentImage: any = getCurrentlyVisibleImage();
    if (!currentImage) {
      console.log('🎤 No current image found');
      return;
    }
    
    // Don't announce the same image twice
    if (currentImage.id === lastAnnouncedImageId) {
      console.log('🎤 Same image as last announced, skipping');
      return;
    }
    
    console.log('🎤 Current visible image:', currentImage);
    console.log('🎤 Current visible image title:', currentImage.title);
    
    if (currentImage.title) {
      console.log('🎤 Current image has title:', currentImage.title);
      speakTitle(currentImage.title, currentImage.id);
      lastAnnouncedImageId = currentImage.id;
    } else {
      console.log('🎤 Current image has no title, using fallback');
      const fallbackText = currentImage.original_name || 'Bild ohne Titel';
      speakTitle(fallbackText, currentImage.id);
      lastAnnouncedImageId = currentImage.id;
    }
  }

  // Function to update current image title (even when audio is disabled)
  function updateCurrentImageTitle() {
    console.log('🎤 updateCurrentImageTitle called');
    
    // Always update the title, even when autoguide is disabled
    const currentImage: any = getCurrentlyVisibleImage();
    if (!currentImage) {
      console.log('🎤 No current image found');
      return;
    }
    
    // Don't update if it's the same image
    if (currentImage.id === lastAnnouncedImageId) {
      console.log('🎤 Same image as last updated, skipping');
      return;
    }
    
    console.log('🎤 Current visible image:', currentImage);
    console.log('🎤 Current visible image title:', currentImage.title);
    
    let displayTitle = '';
    if (currentImage.title) {
      displayTitle = currentImage.title;
    } else {
      displayTitle = currentImage.original_name || 'Bild ohne Titel';
    }
    
    // Only display text up to first comma
    const commaIndex = displayTitle.indexOf(',');
    if (commaIndex !== -1) {
      displayTitle = displayTitle.substring(0, commaIndex);
    }
    
    // Clean the text
    displayTitle = displayTitle
      .replace(/;/g, ' - ')  // Replace semicolons with dashes
      .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
      .trim();               // Remove leading/trailing whitespace
    
    console.log('🎤 Display title (up to first comma):', displayTitle);
    
    // Update the display title
    currentImageTitle = displayTitle;
    lastAnnouncedImageId = currentImage.id;
    
    // If autoguide and audio are activated, also speak it
    if (autoguide && audioActivated) {
      speakTitle(currentImage.title || currentImage.original_name || 'Bild ohne Titel', currentImage.id);
    }
  }
  
  // Function to handle scroll events for audioguide
  function handleScrollForAudioguide() {
    // Always handle scroll events to update image title, even when autoguide is disabled
    
    // Clear existing timeout
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }
    
    // Set new timeout to update image title after scrolling stops
    scrollTimeout = window.setTimeout(() => {
      updateCurrentImageTitle(); // This handles both audio and non-audio cases
    }, 1000); // Wait 1 second after scrolling stops
  }
  
  // Autoguide functions
  function initSpeechSynthesis() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      speechSynthesis = window.speechSynthesis;
      
      // On mobile, we need to resume speech synthesis if it was paused
      if (speechSynthesis && speechSynthesis.paused) {
        speechSynthesis.resume();
      }
      
      // Check if speech synthesis is supported and working
      console.log('Speech synthesis available:', !!speechSynthesis);
      console.log('Speech synthesis speaking:', speechSynthesis.speaking);
      console.log('Speech synthesis paused:', speechSynthesis.paused);
      
      // Enhanced user interaction handling for speech synthesis
      if (speechSynthesis && autoguide && speechSynthesis) {
        // Add event listeners to enable speech synthesis on user interaction
        const enableSpeech = () => {
          console.log('User interaction detected - enabling speech synthesis');
          try {
            if (speechSynthesis) {
              speechSynthesis.resume();
              
              // Test speech synthesis with a silent utterance
              const testUtterance = new SpeechSynthesisUtterance('');
              testUtterance.volume = 0;
              testUtterance.onend = () => {
                console.log('Speech synthesis test completed successfully');
              };
              testUtterance.onerror = (event) => {
                console.log('Speech synthesis test error (expected):', event.error);
              };
              speechSynthesis.speak(testUtterance);
            }
          } catch (error) {
            console.error('Error enabling speech synthesis:', error);
          }
        };
        
        // Listen for various user interactions
        document.addEventListener('click', enableSpeech, { once: true });
        document.addEventListener('touchstart', enableSpeech, { once: true });
        document.addEventListener('keydown', enableSpeech, { once: true });
        document.addEventListener('scroll', enableSpeech, { once: true });
      }
    }
  }
  
  function speakTitle(text: string, imageId?: string) {
    if (!autoguide || !speechSynthesis) return;
    
    // Clean and prepare text for speech synthesis
    let cleanText = text;
    
    // Only speak text up to first comma (as requested)
    const commaIndex = cleanText.indexOf(',');
    if (commaIndex !== -1) {
      cleanText = cleanText.substring(0, commaIndex);
    }
    
    // Replace other problematic characters that might cause speech issues
    cleanText = cleanText
      .replace(/;/g, ' - ')  // Replace semicolons with dashes
      .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
      .trim();               // Remove leading/trailing whitespace
    
    console.log('🎤 Original text:', text);
    console.log('🎤 Cleaned text (up to first comma):', cleanText);
    
    // Don't speak the same text twice in a row for the same image
    if (cleanText === lastSpeechText && imageId === currentImageId) {
      console.log('🎤 Skipping duplicate speech for same image:', cleanText);
      return;
    }
    
    lastSpeechText = cleanText;
    currentImageId = imageId || '';
    speechRetryCount = 0;
    
    console.log('🎤 Speaking:', cleanText, 'for image:', imageId);
    autoguideText = cleanText; // Show cleaned text in the UI too
    currentImageTitle = cleanText; // Update current image title for display
    
    // Cancel any ongoing speech, but only if we're not already speaking the same text
    if (speechSynthesis && lastSpeechText !== cleanText) {
      speechSynthesis.cancel();
    }
    
    const currentSpeech = new SpeechSynthesisUtterance(cleanText);
    currentSpeech.lang = 'de-DE';
    currentSpeech.volume = 1.0;
    
    // Platform-specific optimizations
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isCarPlay = isIOS && (navigator.userAgent.includes('CarPlay') || window.innerWidth > 800);
    
    if (isCarPlay) {
      currentSpeech.rate = 0.85;
      currentSpeech.pitch = 1.1;
    } else if (isAndroid) {
      currentSpeech.rate = 0.9;
    }
    
    currentSpeech.onstart = () => {
      console.log('🎤 Speech started:', text);
    };
    
    currentSpeech.onend = () => {
      console.log('🎤 Speech ended:', text);
      // Don't clear the text automatically - it should stay until image changes
    };
    
    currentSpeech.onerror = (event) => {
      if (event.error === 'canceled') {
        console.log('🎤 Speech was canceled (expected behavior)');
        return;
      }
      
      console.error('🎤 Speech error:', event.error);
      
      if (event.error === 'not-allowed') {
        console.log('🎤 Speech not allowed - user interaction required');
        // Try to enable speech synthesis with user interaction
        const enableSpeech = () => {
          console.log('🎤 User interaction detected - retrying speech');
          try {
            if (speechSynthesis) {
              speechSynthesis.resume();
              speechSynthesis.speak(currentSpeech);
            }
          } catch (error) {
            console.error('🎤 Retry after user interaction failed:', error);
          }
          document.removeEventListener('click', enableSpeech);
          document.removeEventListener('touchstart', enableSpeech);
        };
        
        document.addEventListener('click', enableSpeech, { once: true });
        document.addEventListener('touchstart', enableSpeech, { once: true });
        return;
      }
      
      // For other errors, try to recover with retry logic
      console.log('🎤 Speech error occurred, attempting to recover...');
      
      // Clear any pending speech
      if (speechSynthesis) {
        speechSynthesis.cancel();
        
        // Resume if paused (common on mobile)
        if (speechSynthesis.paused) {
          speechSynthesis.resume();
        }
      }
      
      // Retry logic (max 3 attempts)
      if (speechRetryCount < 3) {
        speechRetryCount++;
        console.log(`🎤 Retrying speech (attempt ${speechRetryCount}/3):`, text);
        
        setTimeout(() => {
          try {
            if (speechSynthesis) {
              speechSynthesis.speak(currentSpeech);
            }
          } catch (error) {
            console.error('🎤 Retry failed:', error);
          }
        }, 1000);
      } else {
        console.log('🎤 Max retry attempts reached, giving up');
      }
    };
    
    // Chrome and cross-platform handling
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isChrome = /Chrome/.test(navigator.userAgent);
    
    if (isMobile) {
      console.log('🎤 Mobile/CarPlay device detected - using enhanced speech handling');
      
      // Android-specific optimizations
      if (isAndroid) {
        console.log('🎤 Android device detected - applying Android-specific optimizations');
        currentSpeech.rate = 0.9; // Slightly slower for Android
        currentSpeech.volume = 1.0; // Full volume for Android
      }
      
      // On mobile, we need to resume speech synthesis if it was paused
      if (speechSynthesis && speechSynthesis.paused) {
        console.log('🎤 Mobile: Resuming paused speech synthesis');
        speechSynthesis.resume();
      }
      
      // Enhanced delay for mobile devices and CarPlay
      const delay = isCarPlay ? 300 : (isAndroid ? 250 : 200);
      setTimeout(() => {
        try {
          if (speechSynthesis) {
            speechSynthesis.speak(currentSpeech);
            console.log('🎤 Mobile/CarPlay: Speech synthesis speak called');
          }
        } catch (error) {
          console.error('🎤 Mobile/CarPlay: Error calling speech synthesis:', error);
        }
      }, delay);
    } else {
      // Desktop handling with Chrome-specific fixes
      if (isChrome) {
        console.log('🎤 Chrome detected - using Chrome-specific speech handling');
        // Chrome fix: Small delay to ensure speech synthesis is ready
        setTimeout(() => {
          try {
            if (speechSynthesis) {
              speechSynthesis.speak(currentSpeech);
              console.log('🎤 Chrome: Speech synthesis speak called');
            }
          } catch (error) {
            console.error('🎤 Chrome: Error calling speech synthesis:', error);
          }
        }, 50);
      } else {
        // Other desktop browsers
        try {
          if (speechSynthesis) {
            speechSynthesis.speak(currentSpeech);
            console.log('🎤 Desktop: Speech synthesis speak called');
          }
        } catch (error) {
          console.error('🎤 Desktop: Error calling speech synthesis:', error);
        }
      }
    }
  }

  function announceFirstImage() {
    console.log('🎤 announceFirstImage called');
    
    // Always update the first image title, even when autoguide is disabled
    const currentPics = get(pics);
    if (currentPics.length === 0) {
      console.log('🎤 No images available for announcement');
      return;
    }
    
    const firstImage = currentPics[0];
    console.log('🎤 First image:', firstImage);
    console.log('🎤 First image title:', firstImage.title);
    
    let displayTitle = '';
    if (firstImage.title) {
      displayTitle = firstImage.title;
    } else {
      displayTitle = firstImage.original_name || 'Bild ohne Titel';
    }
    
    // Only display text up to first comma
    const commaIndex = displayTitle.indexOf(',');
    if (commaIndex !== -1) {
      displayTitle = displayTitle.substring(0, commaIndex);
    }
    
    // Clean the text
    displayTitle = displayTitle
      .replace(/;/g, ' - ')  // Replace semicolons with dashes
      .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
      .trim();               // Remove leading/trailing whitespace
    
    console.log('🎤 Display title (up to first comma):', displayTitle);
    
    // Update the display title
    currentImageTitle = displayTitle;
    lastAnnouncedImageId = firstImage.id;
    
    // If autoguide and audio are activated, also speak it
    if (autoguide && audioActivated) {
      speakTitle(firstImage.title || firstImage.original_name || 'Bild ohne Titel', firstImage.id);
    }
  }

  function activateAudioGuide() {
    if (!speechSynthesis) initSpeechSynthesis();
    if (speechSynthesis) {
      console.log('🎤 Activating audio guide with user interaction...');
      
      // Chrome-specific fix: Cancel any existing speech first
      speechSynthesis.cancel();
      
      // Enhanced iOS/CarPlay activation
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      
      if (isIOS) {
        // iOS: Einmal Dummy sprechen, um zu aktivieren
        const dummy = new SpeechSynthesisUtterance(' ');
        dummy.lang = 'de-DE';
        dummy.volume = 0;
        speechSynthesis.speak(dummy);
        speechSynthesis.resume();
        
        // Enhanced CarPlay and iOS specific audio routing
        if ('webkitAudioContext' in window) {
          try {
            const audioContext = new (window as any).webkitAudioContext();
            audioContext.resume();
            console.log('CarPlay: Audio context activated for external routing');
          } catch (e) {
            console.log('CarPlay: Audio context not available:', e);
          }
        }
        
        // Additional iOS audio session setup for CarPlay
        if ('webkitAudioContext' in window) {
          try {
            const audioContext = new (window as any).webkitAudioContext();
            if (audioContext.state === 'suspended') {
              audioContext.resume();
            }
            console.log('CarPlay: Additional audio context setup completed');
          } catch (e) {
            console.log('CarPlay: Additional audio context setup failed:', e);
          }
        }
      } else {
        // Non-iOS devices - Chrome fix
        speechSynthesis.resume();
      }
      
      // Teste die Sprachausgabe mit einem kurzen Text - nur nach direkter Benutzerinteraktion
      const testUtterance = new SpeechSynthesisUtterance('Audio aktiviert');
      testUtterance.lang = 'de-DE';
      testUtterance.volume = 1.0;
      testUtterance.rate = 0.9; // Slightly slower for better clarity
      
      testUtterance.onstart = () => {
        console.log('🎤 Audio guide activation started');
        audioActivated = true;
      };
      
      // Set audioActivated immediately for better reactivity
      audioActivated = true;
      
      testUtterance.onend = () => {
        console.log('🎤 Audio guide activated successfully');
        // Announce first image after activation
        setTimeout(() => {
          announceFirstImage();
        }, 500);
      };
      
      // Also announce immediately if audio is activated
      setTimeout(() => {
        announceFirstImage();
      }, 200);
      
      // Don't log canceled errors as errors - they're expected
      testUtterance.onerror = (event) => {
        if (event.error === 'canceled') {
          console.log('🎤 Speech was canceled (expected behavior)');
          return;
        }
        
        console.error('🎤 Audio guide activation error:', event.error);
        
        if (event.error === 'not-allowed') {
          console.log('🎤 Speech not allowed - user interaction required');
          // Wait for user interaction and retry
          const retryActivation = () => {
            console.log('🎤 User interaction detected - retrying audio guide activation');
            try {
              if (speechSynthesis) {
                speechSynthesis.resume();
                speechSynthesis.speak(testUtterance);
              }
            } catch (error) {
              console.error('🎤 Retry activation failed:', error);
            }
            document.removeEventListener('click', retryActivation);
            document.removeEventListener('touchstart', retryActivation);
          };
          document.addEventListener('click', retryActivation, { once: true });
          document.addEventListener('touchstart', retryActivation, { once: true });
        }
      };
      

      
      // Chrome fix: Small delay to ensure speech synthesis is ready
      setTimeout(() => {
        try {
          if (speechSynthesis) {
            speechSynthesis.speak(testUtterance);
            console.log('🎤 Audio guide activation test spoken');
          }
        } catch (error) {
          console.error('🎤 Audio guide activation failed:', error);
        }
      }, 100);
    }
  }

  // Test function for speech synthesis
  function testSpeech() {
    console.log('Testing speech synthesis...');
    if (speechSynthesis) {
      const testUtterance = new SpeechSynthesisUtterance('Test der Sprachausgabe');
      testUtterance.lang = 'de-DE';
      testUtterance.volume = 1.0;
      
      // Platform-specific optimizations for test
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      const isAndroid = /Android/i.test(navigator.userAgent);
      const isCarPlay = isIOS && (navigator.userAgent.includes('CarPlay') || window.innerWidth > 800);
      
      if (isCarPlay) {
        testUtterance.rate = 0.85;
        testUtterance.pitch = 1.1;
      } else if (isAndroid) {
        testUtterance.rate = 0.9;
      }
      
      testUtterance.onstart = () => console.log('Test speech started');
      testUtterance.onend = () => console.log('Test speech ended');
      testUtterance.onerror = (e) => console.error('Test speech error:', e.error);
      
      // Resume if paused (common on mobile)
      if (speechSynthesis && speechSynthesis.paused) {
        speechSynthesis.resume();
      }
      
      if (speechSynthesis && testUtterance) {
        speechSynthesis.speak(testUtterance);
      }
    } else {
      console.log('Speech synthesis not available');
    }
  }

  // Mobile speech activation
  function activateMobileSpeech() {
    if (speechSynthesis && speechSynthesis.paused) {
      speechSynthesis.resume();
      console.log('Mobile speech synthesis activated');
    }
  }

  // GPS Simulation functions
  function setupGPSSimulation() {
    console.log('Setting up GPS simulation...');
    
    // Handle GPS simulation updates
    let lastGPSUpdate = 0;
    const GPS_UPDATE_THROTTLE = 500; // 0.5 second throttle
    let lastLoadMoreCheck = 0;
    const LOAD_MORE_CHECK_INTERVAL = 1000; // Check every 1 second (faster for simulation)
    
        async function updateGPSFromSimulation(lat: number, lon: number) {
      const now = Date.now();
      
      // Block GPS simulation updates if anchor item is set (stable GPS coordinates)
      if (anchorItemId) {
        console.log(`🔄 [GPS Simulation] Anchor item set (${anchorItemId}) - blocking GPS simulation update to maintain stable coordinates`);
        return;
      }
      
      // Throttle GPS updates to prevent excessive updates
      if (now - lastGPSUpdate < GPS_UPDATE_THROTTLE) {
        return;
      }
      
      // Check if the change is significant enough to warrant an update
      const distanceChange = userLat && userLon ? 
        Math.abs(lat - userLat) + Math.abs(lon - userLon) : 1;
      
      if (distanceChange < 0.0005) { // Less than ~50m change
        return;
      }
      
      lastGPSUpdate = now;
      gpsSimulationActive = true;
      simulatedLat = lat;
      simulatedLon = lon;
      
      // Update user coordinates with simulated values
      userLat = simulatedLat;
      userLon = simulatedLon;
      
      console.log('GPS Simulation active:', { lat: userLat, lon: userLon });
      
      // Prüfen, ob wir in eine neue Grid-Zelle gewechselt sind
      let gridReloaded = false;
      try {
        const movedOutsideCenter = !dynamicLoader.isInCenterCell(lat, lon);
        if (movedOutsideCenter) {
          console.log('🗺️ [Sim] Grid center changed – loading new 3×3 grid');
          // Special handling for location filters to prevent flickering
        if (hasLocationFilter) {
          console.log("[Filter Change] Location filter detected - loading smoothly without clearing gallery");
          // For location filters: load smoothly without clearing existing images
          // This prevents the flickering effect
          page = 0;
          hasMoreImages = true;
          
          // Clear global GPS data to ensure fresh sorting from new location
          if ((window as any).gpsSortedData) {
            delete (window as any).gpsSortedData;
            console.log("[Filter Change] Cleared GPS sorted data for location filter");
          }
          
          // For location filters, use normal loading instead of grid loading
          loadMore('location filter with simulation GPS');
        } else {
          // For other filters: reset gallery state immediately
          pics.set([]);
          page = 0;
          hasMoreImages = true;
          await loadInitialGridImages(lat, lon);
        }
          gridReloaded = true;
        }
      } catch (err) {
        console.warn('[Sim] Grid detection failed', err);
      }
      
      // Resort existing images (or newly loaded grid) for distance display
      if (!$pics.length || gridReloaded) {
        // After grid reload, no need to resort here—the mapping function already computed distances.
      }
      
      // Only resort existing images, don't reload from server if grid not reloaded
      if (!gridReloaded && $pics.length > 0) {
        // Get current filter state for effective coordinates
        const currentFilters = get(filterStore);
        const hasLocationFilter = currentFilters.locationFilter !== null;
        const effectiveLat = hasLocationFilter ? currentFilters.locationFilter!.lat : userLat;
        const effectiveLon = hasLocationFilter ? currentFilters.locationFilter!.lon : userLon;
        
        const sortedPics = [...$pics].sort((a: any, b: any) => {
          if (!a.lat || !a.lon || !b.lat || !b.lon) return 0;
          
          const distA = a.lat && a.lon && effectiveLat && effectiveLon ? getDistanceInMeters(effectiveLat, effectiveLon, a.lat, a.lon) : Number.MAX_VALUE;
          const distB = b.lat && b.lon && effectiveLat && effectiveLon ? getDistanceInMeters(effectiveLat, effectiveLon, b.lat, b.lon) : Number.MAX_VALUE;
          
          return distA - distB;
        });
        
        // Only update if the order actually changed
        const currentPics = get(pics);
        let orderChanged = false;
        
        if (sortedPics.length !== currentPics.length) {
          orderChanged = true;
        } else {
          // Check if the first few images changed order
          for (let i = 0; i < Math.min(5, sortedPics.length); i++) {
            if (sortedPics[i].id !== currentPics[i].id) {
              orderChanged = true;
              break;
            }
          }
        }
        
        if (orderChanged) {
          pics.set(sortedPics);
          console.log('Resorted existing images by distance (order changed)');
          
          // Announce first image if autoguide is enabled and order changed
          if (autoguide && sortedPics.length > 0) {
            setTimeout(() => announceFirstImage(), 500);
          }
          
          // Update gallery stats after resorting
          const totalCount = await getTotalImageCount();
          updateGalleryStats(sortedPics.length, totalCount);
        } else {
          console.log('GPS update received but order unchanged, skipping resort');
        }
        
        // Check if we need to load more images (throttled)
        if (now - lastLoadMoreCheck > LOAD_MORE_CHECK_INTERVAL) {
          lastLoadMoreCheck = now;
          console.log(`[GPS Simulation] Triggering checkAndLoadMoreImages - hasMoreImages: ${hasMoreImages}, loading: ${loading}`);
          checkAndLoadMoreImages();
        }
      } else {
        // No images cached yet – load initial 3×3 grid first
        console.log(`[GPS Simulation] No cached images – loading initial 3×3 grid`);

        // Special handling for location filters to prevent flickering
        if (hasLocationFilter) {
          console.log("[Filter Change] Location filter detected - loading smoothly without clearing gallery");
          // For location filters: load smoothly without clearing existing images
          // This prevents the flickering effect
          page = 0;
          hasMoreImages = true;
          
          // Clear global GPS data to ensure fresh sorting from new location
          if ((window as any).gpsSortedData) {
            delete (window as any).gpsSortedData;
            console.log("[Filter Change] Cleared GPS sorted data for location filter");
          }
          
          // For location filters, use normal loading instead of grid loading
          loadMore('location filter with simulation GPS');
        } else {
          // For other filters: reset gallery state immediately
          pics.set([]);
          page = 0;
          hasMoreImages = true;
          // Use normal loading instead of grid loading for consistency
          loadMore('simulation GPS without location filter');
        }

        // After grid is set we can still rely on normal auto-load logic for further pages
        if (get(pics).length < 100) {
          // kick off first pagination batch so scrolling has something to work with
          await loadMore('gps simulation - after grid load');
        }
      }
    }
    
    // VERBESSERTE Check-Funktion: Intelligent für Simulation und echten Betrieb
    async function checkAndLoadMoreImages() {
      if (!userLat || !userLon || loading) {
        console.log(`[Auto-Load] Skipping check - userLat: ${userLat}, userLon: ${userLon}, loading: ${loading}`);
        return;
      }
      
      if (!hasMoreImages) {
        console.log(`[Auto-Load] Skipping check - hasMoreImages: ${hasMoreImages}`);
        return;
      }
      
      const currentPics = get(pics);
      
      // Prüfe Bilder im direkten Umkreis (5km)
      const nearbyImages = currentPics.filter((pic: any) => {
        if (!pic.lat || !pic.lon) return false;
        const distance = getDistanceInMeters(userLat as number, userLon as number, pic.lat, pic.lon);
        return distance <= 5000; // 5km radius
      });
      
      // Prüfe Bilder im erweiterten Umkreis (10km) für proaktives Nachladen
      const widerRadiusImages = currentPics.filter((pic: any) => {
        if (!pic.lat || !pic.lon) return false;
        const distance = getDistanceInMeters(userLat as number, userLon as number, pic.lat, pic.lon);
        return distance <= 10000; // 10km radius
      });
      
      console.log(`[Simulation Check] Position: ${userLat}, ${userLon}`);
      console.log(`[Simulation Check] Nearby images (5km): ${nearbyImages.length}/${currentPics.length}`);
      console.log(`[Simulation Check] Wider radius (10km): ${widerRadiusImages.length}/${currentPics.length}`);
      
      // Priorität 1: Proaktives Nachladen bei weniger als 500 Bildern im 10km Umkreis
      if (widerRadiusImages.length < 500 && hasMoreImages) {
        console.log(`[Simulation Check] Only ${widerRadiusImages.length} images in 10km radius (< 500 threshold), proactively loading more...`);
        await loadMore('simulation-auto-load-proactive-500-threshold');
        return;
      }
      
      // Priorität 2: Standard-Check für 5km Radius
      if (nearbyImages.length < 100 && hasMoreImages) {
        console.log(`[Simulation Check] Only ${nearbyImages.length} images in 5km radius, loading more...`);
        await loadMore('simulation-auto-load-standard');
        return;
      }
      
      // Priorität 3: Prüfe 1km Umkreis - wenn auch da nichts ist, versuche nochmal nachzuladen
      if (nearbyImages.length === 0 && currentPics.length > 0) {
        // Noch enger: 1km Radius prüfen
        const veryNearbyImages = currentPics.filter((pic: any) => {
          if (!pic.lat || !pic.lon) return false;
          const distance = getDistanceInMeters(userLat as number, userLon as number, pic.lat, pic.lon);
          return distance <= 1000; // 1km radius
        });
        
        if (veryNearbyImages.length === 0 && hasMoreImages) {
          console.log(`[Simulation Check] No images in 1km radius, trying to load more...`);
          // Komplett neu laden von neuer Position
          // Special handling for location filters to prevent flickering
        if (hasLocationFilter) {
          console.log("[Filter Change] Location filter detected - loading smoothly without clearing gallery");
          // For location filters: load smoothly without clearing existing images
          // This prevents the flickering effect
          page = 0;
          hasMoreImages = true;
          
          // Clear global GPS data to ensure fresh sorting from new location
          if ((window as any).gpsSortedData) {
            delete (window as any).gpsSortedData;
            console.log("[Filter Change] Cleared GPS sorted data for location filter");
          }
        } else {
          // For other filters: reset gallery state immediately
          pics.set([]);
          page = 0;
          hasMoreImages = true;
        }
          page = 0;
          hasMoreImages = true;
          await loadMore('simulation-auto-load-1km-empty');
        } else if (veryNearbyImages.length === 0 && !hasMoreImages) {
          // Kein Nachladen mehr möglich - zeige dezenten Hinweis
          console.log(`[Simulation Check] No more images to load and empty 1km radius - show gentle hint`);
          showNoItemsMessage = true;
        }
      } else if (nearbyImages.length > 0) {
        // Wir haben Bilder in der Nähe - alles gut
        showNoItemsMessage = false;
      }
    }
    
    // Listen for postMessage events from parent window
    function handlePostMessage(event: MessageEvent) {
      if (event.data && event.data.type === 'gps-simulation') {
        console.log('Received GPS simulation data via postMessage:', event.data);
        updateGPSFromSimulation(event.data.lat, event.data.lon);
      } else if (event.data && event.data.type === 'gps-simulation-stop') {
        console.log('GPS simulation stopped, re-enabling real GPS tracking');
        gpsSimulationActive = false;
        simulationMode = false;
      } else if (event.data && event.data.type === 'request-gallery-data') {
        console.log('Received request for gallery data');
        // Send current gallery data to parent window
        const currentPics = get(pics);
        window.parent.postMessage({
          type: 'gallery-data',
          images: currentPics
        }, '*');
      }
    }
    
    // Listen for postMessage events
    window.addEventListener('message', handlePostMessage);
  }



  // Intelligenter Bildlader mit direkter Datenbankabfrage (ersetzt API)
  async function loadImagesWithIntelligentLoader(lat: number, lon: number, requestedCount: number): Promise<any[]> {
    try {
      const loadedImages = await intelligentImageLoader.loadImagesForPosition(lat, lon, requestedCount);
      
      // Konvertiere zu Gallery-Format
      const galleryImages = loadedImages.map(img => ({
        id: img.id,
        path_512: img.path_512,
        path_2048: img.path_2048,
        path_64: img.path_64,
        width: img.width,
        height: img.height,
        lat: img.lat,
        lon: img.lon,
        title: img.title,
        description: img.description,
        is_private: img.is_private,
        profile_id: img.profile_id,
        distance: img.distance
      }));
      
      return galleryImages;
      
    } catch (error) {
      console.error('[Gallery IntelligentLoader] Error:', error);
      return [];
    }
  }

  // Fallback: Direkte Datenbankabfrage mit Batch-Loading
  // Radius-based query that backs up the 3×3 grid once the user scrolls further
  // Simple database query with pagination - 1-100, 101-200, etc.
  async function loadImagesDirectFromDB(lat: number, lon: number, requestedCount: number): Promise<any[]> {
    try {
      const sessionData = get(sessionStore);
      const currentUserId = sessionData.isAuthenticated ? sessionData.userId : null;
      
      // Get current filter state
      const currentFilters = get(filterStore);
      const hasUserFilter = currentFilters.userFilter !== null;
      
      // Simple pagination: load current page (100 images)
      const pageSize = 100;
      const currentPage = page;
      const startIndex = currentPage * pageSize;
      const endIndex = startIndex + pageSize - 1;
      
      console.log(`[Gallery DirectDB] Loading page ${currentPage}: range ${startIndex}-${endIndex}`);
      
      // Use distance-based sorting if GPS coordinates are available
      let query;
      if (lat && lon) {
        console.log(`[Gallery DirectDB] Using distance-based sorting from ${lat}, ${lon}`);
        
        // Use the items_by_distance function for proper sorting
        console.log(`[Gallery DirectDB] Calling RPC with params:`, {
          user_lat: lat,
          user_lon: lon,
          page: currentPage,
          page_size: pageSize,
          filter_user_id: hasUserFilter ? currentFilters.userFilter?.userId : null,
          require_gallery: false,
          current_user_id: currentUserId
        });
        
        query = supabase
          .rpc('items_by_distance', {
            user_lat: lat,
            user_lon: lon,
            page: currentPage,
            page_size: pageSize,
            filter_user_id: hasUserFilter ? currentFilters.userFilter?.userId : null,
            require_gallery: true, // Only show gallery = true images for normal gallery
            current_user_id: currentUserId // Pass current user ID for privacy filtering
          });
      } else {
        // Fallback to date-based sorting if no GPS coordinates
        console.log(`[Gallery DirectDB] No GPS coordinates available, using date-based sorting`);
        
        query = supabase
          .from('items_search_view')
          .select('id, lat, lon, path_512, path_2048, path_64, title, description, width, height, is_private, profile_id')
          .not('lat', 'is', null)
          .not('lon', 'is', null)
          .not('path_512', 'is', null)
          // Temporarily remove gallery filter to see if that's the issue
          // .eq('gallery', true) // Only show images with gallery = true
          .order('created_at', { ascending: false })
          .range(startIndex, endIndex);
      }
      
      // Apply privacy filtering based on user login status and filters
      // Note: For distance-based queries, filtering is handled by the RPC function
      if (!lat || !lon) {
        // Only apply filters for non-distance queries (fallback mode)
        if (hasUserFilter && currentFilters.userFilter) {
          query = query.eq('profile_id', currentFilters.userFilter.userId);
          console.log(`[Gallery DirectDB] Adding user filter: ${currentFilters.userFilter.username}`);
        } else if (currentUserId) {
          query = query.or(`profile_id.eq.${currentUserId},is_private.eq.false,is_private.is.null`);
          console.log(`[Gallery DirectDB] Privacy filter for logged in user: ${currentUserId}`);
        } else {
          query = query.or('is_private.eq.false,is_private.is.null');
          console.log(`[Gallery DirectDB] Privacy filter for anonymous user`);
        }
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('[Gallery DirectDB] Database error:', error);
        return [];
      }
      
      console.log(`[Gallery DirectDB] Loaded ${data?.length || 0} images for page ${currentPage}`);
      
      // Map the data to the expected format
      const images = (data || []).map(item => ({
        id: item.id,
        lat: item.lat,
        lon: item.lon,
        path_512: item.path_512,
        path_2048: item.path_2048,
        path_64: item.path_64,
        title: item.title,
        description: item.description,
        width: item.width,
        height: item.height,
        is_private: item.is_private,
        profile_id: item.profile_id,
        keywords: item.keywords,
        original_name: item.original_name,
        exif_data: item.exif_data,
        distance: item.distance // This comes from the distance function
      }));
      
      return images;
      
    } catch (error) {
      console.error('[Gallery DirectDB] Error:', error);
      return [];
    }
  }

  /* -------------------------------------------------------------
   * Initial 3×3-grid loader (shared logic with /simulation page)
   * -----------------------------------------------------------*/
  async function loadInitialGridImages(lat: number, lon: number) {
    // Ensure dynamic loader has correct user ID for privacy filtering
    const sessionData = get(sessionStore);
    const currentUserId = sessionData.isAuthenticated ? sessionData.userId : null;
    dynamicLoader.setCurrentUserId(currentUserId);

    // Starte Ladevorgang für alle 9 Zellen
    dynamicLoader.loadImagesForPosition(lat, lon);

    // Warte, bis DynamicLoader keine Ladejobs mehr in der Queue hat, um sicherzustellen, dass wir wirklich ALLE Bilder haben
    let previousCount = -1;
    for (let i = 0; i < 20; i++) { // max ~2 s (20×100 ms)
      await new Promise(res => setTimeout(res, 100));
      const currentCount = dynamicLoader.getImageCount();
      if (currentCount === previousCount && !dynamicLoader.getDebugInfo().isLoading) {
        break; // Keine neuen Bilder mehr + Loader idle
      }
      previousCount = currentCount;
    }

    const gridImages = dynamicLoader.getAllImages();

    // Map to gallery representation & compute distance for sorting
    const converted = gridImages.map((img: any) => {
      let bestSrc = '';
      if (img.path_512) {
        bestSrc = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${img.path_512}`;
      } else if (img.path_2048) {
        bestSrc = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${img.path_2048}`;
      } else if (img.path_64) {
        bestSrc = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-64/${img.path_64}`;
      }

      return {
        id: img.id,
        src: bestSrc,
        srcHD: img.path_2048 ? `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${img.path_2048}` : bestSrc,
        width: img.width && img.width > 0 ? img.width : 400,
        height: img.height && img.height > 0 ? img.height : 300,
        lat: img.lat,
        lon: img.lon,
        title: img.title,
        description: img.description,
        keywords: img.keywords,
        path_64: img.path_64,
        path_512: img.path_512,
        path_2048: img.path_2048
      };
    }).filter((p: any) => p.src);

    // Sort by distance (closest first)
    if (lat !== null && lon !== null) {
      converted.sort((a: any, b: any) => {
        if (!a.lat || !a.lon || !b.lat || !b.lon) return 0;
        
        const da = a.lat && a.lon ? getDistanceInMeters(lat, lon, a.lat, a.lon) : Number.MAX_VALUE;
        const db = b.lat && b.lon ? getDistanceInMeters(lat, lon, b.lat, b.lon) : Number.MAX_VALUE;
        return da - db;
      });
    }

    pics.set(converted);

    // For 3×3 grid loading, we want to show ALL loaded images
    // Don't advance pagination since we want to display all 525 images
    // Only advance pagination if we have more images than what we loaded
    const totalCount = await getTotalImageCount();
    
    if (converted.length < totalCount) {
      hasMoreImages = true;
      // Set page to 1 so subsequent loadMore calls start from the right position
      page = 1;
    } else {
      hasMoreImages = false;
      page = 1;
    }
  }
  
  function startGalleryPreload() {
    // Only preload if we're not already on the main page
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      console.log('Starting gallery preload in background...');
      
      // Load all images at once instead of batching
      loadMore('initial');
    }
  }
  


  // Check if user is likely stationary (at home/hotel) vs mobile
  async function checkIfStationary(): Promise<boolean> {
    try {
      // Check if we have saved GPS coordinates from previous sessions
      const savedGps = localStorage.getItem('userGps');
      if (savedGps) {
        const saved = JSON.parse(savedGps);
        const timeDiff = Date.now() - saved.timestamp;
        
        // If GPS hasn't changed significantly in the last 30 minutes, user is likely stationary
        if (timeDiff < 30 * 60 * 1000) { // 30 minutes
          const distance = getDistanceInMeters(userLat!, userLon!, saved.lat, saved.lon);
          if (distance < 100) { // Less than 100m movement
            console.log(`[Stationary Check] User appears stationary (${distance}m movement in ${Math.round(timeDiff/1000/60)}min)`);
            return true;
          }
        }
      }
      
      // Default to mobile if we can't determine
      console.log(`[Stationary Check] User appears mobile or unknown`);
      return false;
    } catch (error) {
      console.error('[Stationary Check] Error:', error);
      return false; // Default to mobile
    }
  }

  // Load all images from database with batch loading (like FullscreenMap)
  async function loadAllImagesFromDatabase() {
    console.log(`[Gallery Database] Loading all images from database with batch loading...`);
    
    try {
      // Get current session to determine privacy filtering
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id || null;
      
      // Get current filter state
      const currentFilters = get(filterStore);
      const hasUserFilter = currentFilters.userFilter !== null;
      
      // Batch loading to get all images (like FullscreenMap)
      const batchSize = Infinity; // Kein Limit - alle Bilder
      let allImages = [];
      let hasMore = true;
      let offset = 0;
      const maxBatches = 10; // Load up to 10,000 images
      
      while (hasMore && allImages.length < maxBatches * batchSize) {
        console.log(`[Gallery Database] Loading batch ${Math.floor(offset/batchSize) + 1}, offset: ${offset}`);
        
        let query = supabase
          .from('items')
          .select('id, path_512, path_2048, path_64, width, height, lat, lon, title, description, keywords, profile_id, is_private, gallery, created_at')
          .not('path_512', 'is', null)
          .eq('gallery', true) // Only show images with gallery = true
          .order('created_at', { ascending: false })
          .range(offset, offset + batchSize - 1);
        
        // Apply privacy filtering
        if (hasUserFilter && currentFilters.userFilter) {
          query = query.eq('profile_id', currentFilters.userFilter.userId);
          console.log(`[Gallery Database] Adding user filter: ${currentFilters.userFilter.username}`);
        } else if (currentUserId) {
          // For logged in users: show their own images (all) + other users' public images
          query = query.or(`profile_id.eq.${currentUserId},is_private.eq.false,is_private.is.null`);
          console.log(`[Gallery Database] Privacy filter for logged in user: ${currentUserId}`);
        } else {
          // For anonymous users: only show public images
          query = query.or('is_private.eq.false,is_private.is.null');
          console.log(`[Gallery Database] Privacy filter for anonymous user`);
        }
        
        const { data, error } = await query;
        
        if (error) {
          console.error('[Gallery Database] Database error:', error);
          break;
        }
        
        if (data && data.length > 0) {
          allImages.push(...data);
          console.log(`[Gallery Database] Batch ${Math.floor(offset/batchSize) + 1}: loaded ${data.length} images, total: ${allImages.length}`);
          
          // Continue if we got a full batch
          hasMore = data.length === batchSize;
          offset += batchSize;
        } else {
          hasMore = false;
        }
      }
      
      console.log(`[Gallery Database] Successfully loaded ${allImages.length} images via batch loading`);
      
      if (allImages.length > 0) {
        const newPics = allImages.map((d: any) => {
          // Try to find the best available image path
          let bestSrc = '';
          if (d.path_512) {
            bestSrc = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${d.path_512}`;
          } else if (d.path_2048) {
            bestSrc = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${d.path_2048}`;
          } else if (d.path_64) {
            bestSrc = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-64/${d.path_64}`;
          }
          
          return {
            id: d.id,
            src: bestSrc,
            srcHD: d.path_2048 ? `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${d.path_2048}` : bestSrc,
            width: d.width && d.width > 0 ? d.width : 400,
            height: d.height && d.height > 0 ? d.height : 300,
            lat: d.lat,
            lon: d.lon,
            title: d.title,
            description: d.description,
            keywords: d.keywords,
            path_64: d.path_64,
            path_512: d.path_512,
            path_2048: d.path_2048,
            distance: d.distance || null,
            gallery: d.gallery ?? true
          };
        }).filter((pic: any) => pic.src); // Filter out images without any path
        
        console.log(`[Gallery Database] Processed ${newPics.length} images with valid paths`);
        
        // Sort by distance if GPS data is available
        if (showDistance && userLat !== null && userLon !== null) {
          newPics.sort((a: any, b: any) => {
            const distA = a.lat && a.lon ? getDistanceInMeters(userLat!, userLon!, a.lat, a.lon) : Number.MAX_VALUE;
            const distB = b.lat && b.lon ? getDistanceInMeters(userLat!, userLon!, b.lat, b.lon) : Number.MAX_VALUE;
            return distA - distB;
          });
          console.log(`[Gallery Database] Sorted ${newPics.length} images by distance`);
        }
        
        // Set all images at once
        pics.set(newPics);
        
        // Update gallery stats
        const totalCount = await getTotalImageCount();
        updateGalleryStats(newPics.length, totalCount);
        
        console.log(`[Gallery Database] Set ${newPics.length} images, total in database: ${totalCount}`);
        
        // Set hasMoreImages to false since we loaded all images
        hasMoreImages = false;
        page = 1; // Set page to 1 to prevent further loading
      } else {
        console.log(`[Gallery Database] No images found in database`);
        // Special handling for location filters to prevent flickering
        if (hasLocationFilter) {
          console.log("[Filter Change] Location filter detected - loading smoothly without clearing gallery");
          // For location filters: load smoothly without clearing existing images
          // This prevents the flickering effect
          page = 0;
          hasMoreImages = true;
          
          // Clear global GPS data to ensure fresh sorting from new location
          if ((window as any).gpsSortedData) {
            delete (window as any).gpsSortedData;
            console.log("[Filter Change] Cleared GPS sorted data for location filter");
          }
        } else {
          // For other filters: reset gallery state immediately
          pics.set([]);
          page = 0;
          hasMoreImages = true;
        }
        hasMoreImages = false;
      }
    } catch (error) {
      console.error('[Gallery Database] Error in loadAllImagesFromDatabase:', error);
    } finally {
      loading = false;
    }
  }

  async function getTotalImageCount() {
    try {
      // Use service role client to bypass RLS 1000-row limit
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
      
      let dbClient = supabase;
      if (supabaseServiceKey) {
        const { createClient } = await import('@supabase/supabase-js');
        dbClient = createClient(supabaseUrl, supabaseServiceKey);
        console.log('🔍 Using service role client to bypass RLS limits');
      } else {
        console.log('🔍 No service key available, using regular client (may be limited to 1000 rows)');
      }
      
      // Get current filter state
      const currentFilters = get(filterStore);
      const hasUserFilter = currentFilters.userFilter !== null;
      
      // DIRECT DATABASE QUERY: Much faster and no limits
      let query = dbClient
        .from('items')
        .select('id', { count: 'exact' })
        .not('path_512', 'is', null)
        .eq('gallery', true); // Only count images with gallery = true
      
      // Apply privacy filtering based on user login status and filters
      console.log(`[Gallery Total Count] Privacy filtering - isLoggedIn: ${isLoggedIn}, currentUser: ${currentUser?.id}, hasUserFilter: ${hasUserFilter}`);
      
      if (hasUserFilter && currentFilters.userFilter) {
        // If user filter is active, only count images from that user
        query = query.eq('profile_id', currentFilters.userFilter.userId);
        console.log(`[Gallery Total Count] User filter applied - counting only images from: ${currentFilters.userFilter.username}`);
      } else if (isLoggedIn && currentUser) {
        // For logged in users: show their own images (all) + other users' public images
        query = query.or(`profile_id.eq.${currentUser.id},is_private.eq.false,is_private.is.null`);
        console.log(`[Gallery Total Count] Logged in user filter applied - showing own images + public images`);
      } else {
        // For anonymous users: only show public images
        query = query.or('is_private.eq.false,is_private.is.null');
        console.log(`[Gallery Total Count] Anonymous user filter applied - counting only public images`);
      }
      
      // Debug: Log the final query for comparison
      console.log(`[Gallery Total Count] Final query filter: ${hasUserFilter ? 'user filter' : isLoggedIn ? 'logged in filter' : 'anonymous filter'}`);
      
      const { count, error } = await query;
      
      if (error) {
        console.error('Error getting total image count from database:', error);
        return 0;
      }
      
      console.log(`[Gallery] Total count from database: ${count}`);
      return count || 0;
    } catch (error) {
      console.error('Error getting total image count:', error);
      return 0;
    }
  }

  async function loadMore(reason = 'default') {
    // Verhindere zu häufiges Neuladen
    const now = Date.now();
    if (reason.includes('auto-load') && (now - lastGalleryLoadTime) < MIN_RELOAD_INTERVAL) {
      return;
    }
    
    // Allow certain reasons to bypass loading check
    const bypassLoadingReasons = ['settings load with GPS sorting', 'navigation back with GPS', 'navigation back normal', 'clear search'];
    if (loading && !bypassLoadingReasons.includes(reason)) {
      return;
    } 
    
    // Check hasMoreImages for normal pagination
    if (!hasMoreImages) {
      console.log(`[LoadMore] No more images to load (hasMoreImages: ${hasMoreImages})`);
      return;
    }
    
    // Check if we're already loading
    if (loading) {
      console.log(`[LoadMore] Already loading, skipping (loading: ${loading})`);
      return;
    }
    
      // For initial load, use the intelligent loader system
  if (page === 0 && reason.includes('initial')) {
    // Use the existing intelligent loader system that's designed for large datasets
    if (hasValidGpsForGallery()) {
      const bestGps = await getBestAvailableGps();
      const loadLat = bestGps?.lat || userLat!;
      const loadLon = bestGps?.lon || userLon!;
      
      // Check if we have a location filter - if so, use normal loading instead of grid loading
      if (hasLocationFilter) {
        console.log("[Initial Load] Location filter detected - using normal loading instead of grid loading");
        await loadImagesNormal(null, null, null, true);
      } else {
        await loadInitialGridImages(loadLat, loadLon);
      }
    } else {
      // Fallback to normal loading for non-GPS mode
      await loadImagesNormal(null, null, null, true);
    }
    return;
  }
  
  // Handle GPS failure fallback
  if (reason.includes('GPS failed')) {
    await loadImagesNormal(null, null, null, true);
    return;
  } 
    
    // Don't load more images if a search is active (unless it's a navigation back)
    if ((searchQuery.trim() || searchResults.length > 0) && !reason.includes('navigation back')) {
      // Stop 3x3 mode if search is active
      if (isManual3x3Mode) {
        stop3x3Mode();
      }
      return;
    }
    
    loading = true;
    lastGalleryLoadTime = now;
    
    // Add a small delay to prevent rapid successive calls
    if (reason.includes('navigation back') || reason.includes('clear search')) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    let data;
    
    // Get current filter state
    const currentFilters = get(filterStore);
    const hasUserFilter = currentFilters.userFilter !== null;
    let currentHasLocationFilter = currentFilters.locationFilter !== null;
    
    // Ensure currentHasLocationFilter is properly defined
    if (typeof currentHasLocationFilter === 'undefined') {
      console.warn('[LoadMore] currentHasLocationFilter was undefined, setting to false');
      currentHasLocationFilter = false;
    }
    
    // Use saved GPS coordinates if available, otherwise use current GPS
    let effectiveLat = userLat;
    let effectiveLon = userLon;
    
    // Check if we have saved GPS coordinates in the profile
    if (isLoggedIn && currentUser) {
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('home_lat, home_lon')
          .eq('id', currentUser.id)
          .single();
        
        if (profileData?.home_lat && profileData?.home_lon) {
          effectiveLat = profileData.home_lat;
          effectiveLon = profileData.home_lon;
        }
      } catch (error) {
        // GPS coordinates error handled silently
      }
    }
    
    // Use location filter GPS for BOTH loading images AND distance calculation
    // This ensures consistency: same position for loading and distance calculation
    if (currentHasLocationFilter) {
      effectiveLat = currentFilters.locationFilter!.lat;
      effectiveLon = currentFilters.locationFilter!.lon;
      console.log(`[GPS Debug] Using location filter GPS for both loading and distance: ${effectiveLat}, ${effectiveLon}`);
      
      // Set the selected item ID for anchor-based navigation
      const selectedItemId = $filterStore.locationFilter?.itemId;
      if (selectedItemId) {
        (window as any).selectedItemId = selectedItemId;
        console.log(`[GPS Debug] Set selected item ID: ${selectedItemId}`);
      }
    } else {
      console.log(`[GPS Debug] Using current GPS for both loading and distance: ${userLat}, ${userLon}`);
    }
    
    // Always try to load images, regardless of GPS availability
    console.log(`[LoadMore Debug] Attempting to load images with reason: ${reason}`);
    
          // Handle manual 3x3 mode or movement mode
      if (reason.includes('manual 3x3 mode') || reason.includes('movement mode - 3x3 grid')) {
        console.log(`[LoadMore] Manual 3x3 mode detected - loading 3x3 grid`);
        const bestGps = await getBestAvailableGps();
        const loadLat = bestGps?.lat || effectiveLat!;
        const loadLon = bestGps?.lon || effectiveLon!;
        
        // Use 3x3 grid loading for manual 3x3 mode
        data = await loadInitialGridImages(loadLat, loadLon);
      }
      // Normal gallery mode - load all images sorted by distance
      else if (reason.includes('normal gallery mode')) {
        console.log(`[LoadMore] Normal gallery mode - loading all images sorted by distance`);
        
        // Load all images with pagination, sorted by distance
        data = await loadImagesNormal(effectiveLat, effectiveLon, anchorItemId, false);
      }
      // Use GPS-based loading if location is available (from GPS or location filter)
      else if (hasValidGpsForGallery()) {
        // Get the best available GPS coordinates
        const bestGps = await getBestAvailableGps();
        const loadLat = bestGps?.lat || effectiveLat!;
        const loadLon = bestGps?.lon || effectiveLon!;
        
        console.log(`[LoadMore Debug] Using GPS-based loading with coordinates: ${loadLat}, ${loadLon}`);
        
        // Use client-side GPS-based sorting instead of database function (which has errors)
        data = await loadImagesNormal(effectiveLat, effectiveLon, anchorItemId, false);

      } else {
      // Keine GPS-Daten verfügbar - lade mit Datumssortierung als Fallback
      console.log(`[LoadMore Debug] No GPS data available, using date-based sorting as fallback`);
      
      // Load with date sorting even if GPS is not available yet
      data = await loadImagesNormal(effectiveLat, effectiveLon, anchorItemId, false);
      
      // Continue GPS tracking in background for future updates
      if (showDistance && !gpsTrackingActive && !gpsSimulationActive) {
        startGPSTracking();
      }
    }
    
    // Debug: Log what we're trying to load
    console.log(`[LoadMore Debug] Reason: ${reason}, hasValidGpsForGallery: ${hasValidGpsForGallery()}, effectiveLat: ${effectiveLat}, effectiveLon: ${effectiveLon}`);
    console.log(`[LoadMore Debug] Data loaded: ${data?.length || 0} images`);

    if (data && data.length > 0) {
      const newPics = data.map((d: any) => {
        // Try to find the best available image path
        let bestSrc = '';
        if (d.path_512) {
          bestSrc = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${d.path_512}`;
        } else if (d.path_2048) {
          bestSrc = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${d.path_2048}`;
        } else if (d.path_64) {
          bestSrc = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-64/${d.path_64}`;
        }
        
        return {
          id: d.id,
          src: bestSrc,
          srcHD: d.path_2048 ? `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${d.path_2048}` : bestSrc,
          width: d.width && d.width > 0 ? d.width : 400,  // Use actual width if available
          height: d.height && d.height > 0 ? d.height : 300, // Use actual height if available
          lat: d.lat,
          lon: d.lon,
          title: d.title,
          description: d.description,
          keywords: d.keywords,
          path_64: d.path_64,
          path_512: d.path_512,
          path_2048: d.path_2048,
          distance: d.distance !== undefined && d.distance !== null ? d.distance : null,  // Use distance directly from database
          gallery: d.gallery ?? true
        };
      });
      
      // Filter out images without any path
      const filteredPics = newPics.filter((pic: any) => pic.src);
      
      // Simple approach: no duplicate detection for filter changes
      const uniqueNewPics = filteredPics;
      
      console.log(`[Gallery Debug] Simple loading: ${filteredPics.length} images loaded`);
      
      // Intelligente Bild-Verwaltung je nach Datenquelle
      const hasUserFilter = currentFilters.userFilter !== null;
      
      // Check if this is a filter change (page 0 and reason includes 'filter')
      const isFilterChange = page === 0 && reason.includes('filter');
      
      console.log(`[Gallery Debug] Processing mode: isFilterChange=${isFilterChange}, hasUserFilter=${hasUserFilter}, hasLocationFilter=${currentHasLocationFilter}`);
      
      if (isFilterChange) {
        // For filter changes: replace all images instead of appending
        pics.set(uniqueNewPics);
        console.log(`[Gallery Debug] Filter change: replaced all images with ${uniqueNewPics.length} new images`);
        
        // Clear global GPS data on filter change to ensure fresh sorting
        if ((window as any).gpsSortedData) {
          delete (window as any).gpsSortedData;
          console.log(`[Gallery Debug] Cleared GPS sorted data on filter change`);
        }
        
        // Reset page to 0 for filter changes to start fresh pagination
        page = 0;
        console.log(`[Gallery Debug] Reset page to 0 for filter change`);
      } else if ((userLat !== null && userLon !== null) || currentHasLocationFilter) {
        if (data[0]?.distance !== undefined) {
          // Optimierte Daten bereits sortiert - APPEND new images for pagination
          pics.update((p: any[]) => [...p, ...uniqueNewPics]);
          console.log(`[Gallery Debug] Added ${uniqueNewPics.length} optimized images (already sorted by distance, total: ${$pics.length})`);
        } else {
          // GPS-Modus aber normale Daten - verwende die bereits sortierten Daten vom IntelligentImageLoader
          pics.update((p: any[]) => {
            // Bei GPS-Modus: Append new images (already sorted by IntelligentImageLoader)
            const allImages = [...p, ...uniqueNewPics];
            
            console.log(`[Gallery Debug] Using pre-sorted images from IntelligentImageLoader, no client-side sorting needed`);
            
            // Debug: Check if distances are preserved
            if (allImages.length > 0) {
              console.log(`[Gallery Debug] First 3 images in pics store:`, allImages.slice(0, 3).map(img => ({
                id: img.id,
                distance: img.distance?.toFixed(0) + 'm',
                distanceRaw: img.distance,
                lat: img.lat,
                lon: img.lon,
                title: img.title
              })));
              
              // Also log the actual distance values
              console.log(`[Gallery Debug] Distance values:`, allImages.slice(0, 3).map(img => img.distance));
              
              // Check if distances are being passed to UI components
              console.log(`[Gallery Debug] Passing to UI:`, allImages.slice(0, 3).map(img => ({
                id: img.id,
                distance: img.distance,
                hasDistance: img.distance !== undefined && img.distance !== null
              })));
              
              // Check if distances are actually in the pics store
              console.log(`[Gallery Debug] Pics store distances:`, $pics.slice(0, 3).map(img => ({
                id: img.id,
                distance: img.distance,
                hasDistance: img.distance !== undefined && img.distance !== null
              })));
              
              // Verify that the first image is actually the closest
              const firstImage = allImages[0];
              if (firstImage && firstImage.lat && firstImage.lon) {
                const actualDistance = getDistanceInMeters(effectiveLat!, effectiveLon!, firstImage.lat, firstImage.lon);
                console.log(`[Gallery Debug] First image distance verification: calculated=${actualDistance?.toFixed(0)}m, stored=${firstImage.distance?.toFixed(0)}m`);
                
                if (Math.abs(actualDistance - (firstImage.distance || 0)) > 1) {
                  console.log(`[Gallery Debug] WARNING: Distance mismatch detected!`);
                }
              }
            }
            
            return allImages;
          });
        }
      } else {
        // Keine GPS-Daten verfügbar - zeige Hinweis
        console.log('[Gallery Debug] No GPS data available, showing empty gallery with hint');
        // Special handling for location filters to prevent flickering
        if (currentHasLocationFilter) {
          console.log("[Filter Change] Location filter detected - loading smoothly without clearing gallery");
          // For location filters: load smoothly without clearing existing images
          // This prevents the flickering effect
          page = 0;
          hasMoreImages = true;
          
          // Clear global GPS data to ensure fresh sorting from new location
          if ((window as any).gpsSortedData) {
            delete (window as any).gpsSortedData;
            console.log("[Filter Change] Cleared GPS sorted data for location filter");
          }
        } else {
          // For other filters: reset gallery state immediately
          pics.set([]);
          page = 0;
          hasMoreImages = true;
        }
        // Don't set hasMoreImages = false - continue loading all images
      }
      
      console.log(`[Gallery Debug] Final gallery state: ${$pics.length} images in gallery`);
      
      // Update gallery stats and check for more images
      const totalCount = await getTotalImageCount();
      updateGalleryStats($pics.length, totalCount);
      
      const currentCount = $pics.length;
      
      console.log(`[Gallery Debug] Checking for more images: current=${currentCount}, total=${totalCount}`);
      
      // Check if we have more images to load (simple approach)
      if (data && data.length > 0) {
        // If we got a full page (100 images), there might be more
        hasMoreImages = data.length === 100;
        console.log(`[Gallery Debug] Loaded ${data.length} images, hasMoreImages=${hasMoreImages}`);
      } else {
        // No data loaded, we're done
        hasMoreImages = false;
        console.log(`[Gallery Debug] No data loaded, setting hasMoreImages=false`);
      }
      
      if (autoguide && uniqueNewPics.length > 0) {
        setTimeout(() => announceFirstImage(), 500);
      }
    } else {
      // Don't set hasMoreImages = false - continue loading all images
      console.log(`[Gallery Debug] No data loaded, but continuing to load all images`);
    }

    // Erhöhe page für alle Modi (normaler Modus und GPS-Modus)
    // But only if we actually loaded data
    if (data && data.length > 0) {
      page++;
      console.log(`[LoadMore] Page incremented to ${page}`);
    } else {
      console.log(`[LoadMore] No data loaded, keeping page at ${page}`);
    }
    loading = false;
    
    // Don't auto-load next batch - let user scroll to trigger next batch
    console.log(`[LoadMore] Batch loaded, waiting for user scroll to load next batch`);
  }
  
  // Hilfsfunktion für Anchor-basierte Suche
  async function loadImagesWithAnchorBasedSearch(lat: number, lon: number, anchorId: string, limit: number) {
    console.log(`[Anchor Search] Loading images with anchor ID: ${anchorId} from ${lat}, ${lon}`);
    
    try {
      // First, get the anchor item's GPS coordinates
      const { data: anchorData, error: anchorError } = await supabase
        .from('items')
        .select('lat, lon')
        .eq('id', anchorId)
        .single();
      
      if (anchorError || !anchorData?.lat || !anchorData?.lon) {
        console.error('[Anchor Search] Error fetching anchor item GPS coordinates:', anchorError);
        throw new Error('Anchor item not found or has no GPS coordinates');
      }
      
      console.log(`[Anchor Search] Anchor item GPS coordinates: ${anchorData.lat}, ${anchorData.lon}`);
      
      // Use the anchor item's GPS coordinates for distance calculation
      // The SQL function will use these coordinates for distance calculation
      const { data, error } = await supabase
        .rpc('items_by_distance_with_anchor', {
          user_lat: anchorData.lat,  // Use anchor item's GPS coordinates
          user_lon: anchorData.lon,  // Use anchor item's GPS coordinates
          anchor_id: anchorId,
          page: 0,
          page_size: limit,
          filter_user_id: null
        });
      
      if (error) {
        console.error('[Anchor Search] Database error:', error);
        throw error;
      }
      
      console.log(`[Anchor Search] Loaded ${data?.length || 0} images with anchor-based search`);
      
      // Verify that the anchor item is at the top with 0km distance
      if (data && data.length > 0) {
        const anchorItem = data.find((item: any) => item.id === anchorId);
        if (anchorItem) {
          console.log(`[Anchor Search] Anchor item found at position ${data.indexOf(anchorItem)}, distance: ${anchorItem.distance}m`);
          if (anchorItem.distance !== 0) {
            console.warn(`[Anchor Search] Warning: Anchor item distance is ${anchorItem.distance}m, should be 0m`);
            // Force the anchor item to have 0 distance
            anchorItem.distance = 0;
          }
        } else {
          console.warn(`[Anchor Search] Warning: Anchor item not found in results`);
        }
      }
      
      return data || [];
    } catch (error) {
      console.error('[Anchor Search] Error:', error);
      throw error;
    }
  }

  // Hilfsfunktion für normales Laden
  async function loadImagesNormal(providedLat?: number | null, providedLon?: number | null, anchorId?: string | null, updateStore: boolean = true) {
    // Get current filter state
    const currentFilters = get(filterStore);
    const hasUserFilter = currentFilters.userFilter !== null;
    let currentHasLocationFilter = currentFilters.locationFilter !== null;
    
    // Ensure currentHasLocationFilter is properly defined
    if (typeof currentHasLocationFilter === 'undefined') {
      console.warn('[LoadImagesNormal] currentHasLocationFilter was undefined, setting to false');
      currentHasLocationFilter = false;
    }
    
    // Use provided GPS coordinates if available, otherwise use saved GPS coordinates, otherwise use current GPS
    let effectiveLat = providedLat !== undefined ? providedLat : userLat;
    let effectiveLon = providedLon !== undefined ? providedLon : userLon;
    
    // WICHTIG: Wenn ein Anker-Item gesetzt ist, verwende dessen GPS-Koordinaten für die Entfernungsberechnung
    if (anchorId) {
      try {
        console.log(`[Gallery Normal] Anchor item set (${anchorId}), fetching its GPS coordinates for distance calculation`);
        const { data: itemData } = await supabase
          .from('items')
          .select('lat, lon')
          .eq('id', anchorId)
          .single();
        
        if (itemData?.lat && itemData?.lon) {
          console.log(`[Gallery Normal] Using anchor item GPS coordinates for distance calculation: ${itemData.lat}, ${itemData.lon}`);
          effectiveLat = itemData.lat;
          effectiveLon = itemData.lon;
        } else {
          console.log(`[Gallery Normal] Anchor item (${anchorId}) has no GPS coordinates, using provided coordinates`);
        }
      } catch (error) {
        console.log(`[Gallery Normal] Error fetching anchor item GPS coordinates:`, error);
      }
    }
    
    // If no GPS coordinates were provided, check if we have saved GPS coordinates in the profile
    if (effectiveLat === null && effectiveLon === null && isLoggedIn && currentUser) {
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('home_lat, home_lon')
          .eq('id', currentUser.id)
          .single();
        
        if (profileData?.home_lat && profileData?.home_lon) {
          effectiveLat = profileData.home_lat;
          effectiveLon = profileData.home_lon;
        }
      } catch (error) {
        // GPS coordinates error handled silently
      }
    }
    
    // Use location filter GPS for BOTH loading images AND distance calculation
    // This ensures consistency: same position for loading and distance calculation
    if (currentHasLocationFilter) {
      effectiveLat = currentFilters.locationFilter!.lat;
      effectiveLon = currentFilters.locationFilter!.lon;
      console.log(`[GPS Debug] Using location filter GPS for both loading and distance: ${effectiveLat}, ${effectiveLon}`);
      
      // Set the selected item ID for anchor-based navigation
      const selectedItemId = $filterStore.locationFilter?.itemId;
      if (selectedItemId) {
        (window as any).selectedItemId = selectedItemId;
        console.log(`[GPS Debug] Set selected item ID: ${selectedItemId}`);
      }
    } else {
      console.log(`[GPS Debug] Using current GPS for both loading and distance: ${userLat}, ${userLon}`);
    }
    
          // Check if we have GPS data for distance-based sorting
      // For GPS sorting, we need both GPS coordinates AND showDistance enabled
      const hasGpsForSorting = effectiveLat !== null && effectiveLon !== null && showDistance;
    
    // DIRECT DATABASE QUERY: Much faster and no limits
    try {
      let data;
      
      if (hasGpsForSorting) {
        // Use client-side GPS-based sorting instead of database function
        console.log(`[Gallery Normal] Using client-side distance-based sorting from ${effectiveLat}, ${effectiveLon}`);
        
        // Check if we already have global sorted data
        if ((window as any).gpsSortedData && (window as any).gpsSortedData.length > 0) {
          console.log(`[Gallery Normal] Using existing global sorted data: ${(window as any).gpsSortedData.length} images`);
          
          // Apply pagination for all modes
          const startIndex = page * size;
          const endIndex = startIndex + size;
          
          console.log(`[Gallery Normal] Pagination debug: page=${page}, size=${size}, startIndex=${startIndex}, endIndex=${endIndex}, totalImages=${(window as any).gpsSortedData.length}`);
          
          if (startIndex >= (window as any).gpsSortedData.length) {
            console.log(`[Gallery Normal] Start index ${startIndex} is out of bounds for ${(window as any).gpsSortedData.length} total images`);
            return [] as any[];
          } else {
            const paginatedData = (window as any).gpsSortedData.slice(startIndex, endIndex) as any[];
            console.log(`[Gallery Normal] Page ${page}: returning ${paginatedData.length} images (range ${startIndex}-${endIndex} of ${(window as any).gpsSortedData.length} total)`);
            return paginatedData;
          }
        }
        
        // Check if we should use 3×3 grid or GPS-based loading
        // Only use 3×3 grid if we're in manual 3x3 mode
        if (!currentHasLocationFilter && isManual3x3Mode) {
          // Manual 3x3 mode active - use 3×3 grid loading
          console.log('[Gallery Normal] Manual 3x3 mode active, using 3×3 grid loading');
          
          // Get current GPS position for 3×3 grid
          const currentGps = await getBestAvailableGps();
          if (currentGps) {
            console.log(`[Gallery Normal] Loading 3×3 grid for GPS: ${currentGps.lat}, ${currentGps.lon}`);
            await loadInitialGridImages(currentGps.lat, currentGps.lon);
            return []; // 3×3 grid sets pics directly, no need to return data
          } else {
            console.log('[Gallery Normal] No GPS available for 3×3 grid, using date-based loading');
            // Fallback to date-based loading
          }
        }
        
        // Simple database query with pagination
        console.log(`[Gallery Normal] Using simple database query with pagination`);
        
        // Ensure coordinates are valid numbers
        if (effectiveLat === null || effectiveLon === null) {
          console.error('[Gallery Normal] Invalid GPS coordinates, cannot load images');
          return [];
        }
        
        // Use direct database query with pagination
        let rawData = await loadImagesDirectFromDB(effectiveLat, effectiveLon, 100);
        
        console.log(`[Gallery Normal] Loaded ${rawData?.length || 0} images from database for current page`);
        
        // Check if we have any images in the region
        if (!rawData || rawData.length === 0) {
          console.log(`[Gallery Normal] No images found via API`);
          
          // Show "region not covered" message
          showNoItemsMessage = true;
          setTimeout(() => {
            showNoItemsMessage = false;
          }, 15000); // Hide after 15 seconds
          
          return [];
        }
        
                              // Use data directly from database (already sorted by distance)
            if (rawData && rawData.length > 0) {
              console.log(`[Gallery Normal] Using ${rawData.length} images from database (already sorted by distance)`);
              
              // Add distance property for display purposes
              rawData.forEach((img: any) => {
                if (img.lat && img.lon && effectiveLat && effectiveLon) {
                  img.distance = img.distance || getDistanceInMeters(effectiveLat, effectiveLon, img.lat, img.lon);
                } else {
                  img.distance = Number.MAX_VALUE; // Put images without GPS at the end
                }
              });
              
              // Debug: Log the first few images to verify sorting
              console.log(`[Gallery Normal] First 5 images from database:`, rawData.slice(0, 5).map((img: any) => ({
                id: img.id,
                lat: img.lat,
                lon: img.lon,
                distance: img.distance?.toFixed(0) + 'm',
                distanceRaw: img.distance
              })));
            
            // For location filters, ensure the selected item is first
            const selectedItemId = $filterStore.locationFilter?.itemId;
            if (currentHasLocationFilter && selectedItemId) {
              console.log(`[Gallery Normal] Location filter active, ensuring selected item ${selectedItemId} is first`);
              
              // First, check if the selected item is already in rawData
              let selectedItem = rawData.find((img: any) => img.id === selectedItemId);
              
              if (selectedItem) {
                // Item is in rawData - move it to first position
                const filteredData = rawData.filter((img: any) => img.id !== selectedItemId);
                selectedItem.distance = 0;
                rawData = [selectedItem, ...filteredData];
                console.log(`[Gallery Normal] Moved selected item to first position with 0m distance`);
              } else {
                // Item is not in rawData - we need to fetch it separately and add it
                console.log(`[Gallery Normal] Selected item ${selectedItemId} not in rawData, fetching separately`);
                try {
                  const { data: itemData, error } = await supabase
                    .from('items')
                    .select('id, path_512, path_2048, path_64, width, height, lat, lon, title, description, keywords, profile_id, is_private, gallery')
                    .eq('id', selectedItemId)
                    .single();
                  
                  if (itemData && !error) {
                    // Convert to gallery format
                    selectedItem = {
                      id: itemData.id,
                      src: `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${itemData.path_512}`,
                      srcHD: itemData.path_2048 ? `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${itemData.path_2048}` : null,
                      width: itemData.width || 400,
                      height: itemData.height || 300,
                      lat: itemData.lat,
                      lon: itemData.lon,
                      title: itemData.title,
                      description: itemData.description,
                      keywords: itemData.keywords,
                      path_64: itemData.path_64,
                      path_512: itemData.path_512,
                      path_2048: itemData.path_2048,
                      distance: 0 // Set distance to 0 for location filter
                    };
                    
                    // Add to beginning of rawData
                    rawData = [selectedItem, ...rawData];
                    console.log(`[Gallery Normal] Added selected item to first position with 0m distance`);
                  }
                } catch (error) {
                  console.error(`[Gallery Normal] Error fetching selected item ${selectedItemId}:`, error);
                }
              }
              
              // Also ensure it's first in the global data for pagination
              if ((window as any).gpsSortedData) {
                const globalSelectedItem = (window as any).gpsSortedData.find((img: any) => img.id === selectedItemId);
                if (globalSelectedItem) {
                  const globalFilteredData = (window as any).gpsSortedData.filter((img: any) => img.id !== selectedItemId);
                  globalSelectedItem.distance = 0;
                  (window as any).gpsSortedData = [globalSelectedItem, ...globalFilteredData];
                  console.log(`[Gallery Normal] Also moved selected item to first position in global data`);
                } else if (selectedItem) {
                  // Add to global data if not present
                  (window as any).gpsSortedData = [selectedItem, ...(window as any).gpsSortedData];
                  console.log(`[Gallery Normal] Added selected item to first position in global data`);
                }
              }
            }
            

            
            // Return the sorted data directly - simple pagination
            data = rawData;
            console.log(`[Gallery Normal] Returning ${data.length} sorted images for current page`);
        } else {
          data = [] as any[];
        }
      } else {
        // Use direct database query for date-based sorting
        console.log(`[Gallery Normal] Using direct DB for date-based sorting (no GPS data or distance disabled)`);
        
        // Check if we should be using GPS sorting but it's not enabled yet
        if (effectiveLat !== null && effectiveLon !== null && showDistance === undefined) {
          console.log(`[Gallery Normal] GPS coordinates available but showDistance not loaded yet, using date sorting temporarily`);
        }
        
        const sessionData = get(sessionStore);
        const currentUserId = sessionData.isAuthenticated ? sessionData.userId : null;
        
        let query = supabase
          .from('items')
          .select('id, path_512, path_2048, path_64, width, height, lat, lon, title, description, keywords, profile_id, is_private, gallery')
          .not('path_512', 'is', null)
          .eq('gallery', true) // Only show images with gallery = true
          .range(page * size, page * size + size - 1)
          .order('created_at', { ascending: false });
        
        // Apply privacy filtering based on user login status
        if (hasUserFilter && currentFilters.userFilter) {
          query = query.eq('profile_id', currentFilters.userFilter.userId);
          console.log(`[Gallery Normal] Adding user filter: ${currentFilters.userFilter.username}`);
        } else if (currentUserId) {
          query = query.or(`profile_id.eq.${currentUserId},is_private.eq.false,is_private.is.null`);
        } else {
          query = query.or('is_private.eq.false,is_private.is.null');
        }
        
        console.log(`[Gallery Normal] Direct DB query for date sorting, page ${page}, size ${size}`);
        
        const { data: dbData, error } = await query;
        
        if (error) {
          console.error('[Gallery Normal] Database error:', error);
          return [];
        }
        
        data = dbData || [];
        console.log(`[Gallery Normal] Got ${data?.length || 0} images from direct DB with date sorting`);
        
        // Debug: Log the first few images
        if (data && data.length > 0) {
          console.log(`[Gallery Normal] First 3 images from date sorting:`, data.slice(0, 3).map((img: any) => ({
            id: img.id,
            title: img.title,
            created_at: img.created_at
          })));
        }
      }
      
      // If updateStore is true, update the pics store with the data
      if (updateStore && data && data.length > 0) {
        const newPics = data.map((d: any) => {
          // Try to find the best available image path
          let bestSrc = '';
          if (d.path_512) {
            bestSrc = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${d.path_512}`;
          } else if (d.path_2048) {
            bestSrc = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${d.path_2048}`;
          } else if (d.path_64) {
            bestSrc = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-64/${d.path_64}`;
          }
          
          return {
            id: d.id,
            src: bestSrc,
            srcHD: d.path_2048 ? `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${d.path_2048}` : bestSrc,
            width: d.width && d.width > 0 ? d.width : 400,
            height: d.height && d.height > 0 ? d.height : 300,
            lat: d.lat,
            lon: d.lon,
            title: d.title,
            description: d.description,
            keywords: d.keywords,
            path_64: d.path_64,
            path_512: d.path_512,
            path_2048: d.path_2048,
            distance: d.distance || null,
            gallery: d.gallery ?? true
          };
        }).filter((pic: any) => pic.src); // Filter out images without any path
        
        console.log(`[Gallery Normal] Processed ${newPics.length} images with valid paths`);
        
        // Sort by distance if GPS data is available
        if (showDistance && effectiveLat !== null && effectiveLon !== null) {
          newPics.sort((a: any, b: any) => {
            const distA = a.lat && a.lon ? getDistanceInMeters(effectiveLat!, effectiveLon!, a.lat, a.lon) : Number.MAX_VALUE;
            const distB = b.lat && b.lon ? getDistanceInMeters(effectiveLat!, effectiveLon!, b.lat, b.lon) : Number.MAX_VALUE;
            return distA - distB;
          });
          console.log(`[Gallery Normal] Sorted ${newPics.length} images by distance`);
        }
        
        // Set all images at once
        pics.set(newPics);
        
        // Update gallery stats
        const totalCount = await getTotalImageCount();
        updateGalleryStats(newPics.length, totalCount);
        
        console.log(`[Gallery Normal] Set ${newPics.length} images, total in database: ${totalCount}`);
        
        // Set hasMoreImages based on whether we loaded all images
        if (newPics.length < totalCount) {
          hasMoreImages = true;
          console.log(`[Gallery Normal] More images available: ${newPics.length} of ${totalCount}, hasMoreImages=true`);
        } else {
          hasMoreImages = false;
          console.log(`[Gallery Normal] All images loaded: ${newPics.length} of ${totalCount}, hasMoreImages=false`);
        }
        page = 1; // Set page to 1 to prevent further loading
      }
      
      return data || [];
    } catch (error) {
      console.error('[Gallery Normal] Database error:', error);
      return [];
    }
  }

  // Drag & Drop handlers
  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    isDragOver = true;
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    isDragOver = false;
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragOver = false;
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  }

  async function processFiles(files: FileList) {
    console.log('🔍 Frontend: processFiles called with', files.length, 'files');
    alert('🔍 Frontend: processFiles called with ' + files.length + ' files');
    if (!files || files.length === 0) {
      uploadMessage = 'Bitte Bilder auswählen';
      return;
    }

    // Check if user is authenticated
    const sessionResult = await supabase.auth.getSession();
    const currentUser = sessionResult.data.session?.user;
    
    if (!currentUser) {
      uploadMessage = '❌ Bitte zuerst einloggen, um Bilder hochzuladen';
      return;
    }

    // Validate file types
    const validFiles = Array.from(files).filter(file => 
      file.type === 'image/jpeg' || file.type === 'image/jpg' || file.type === 'image/webp'
    );

    if (validFiles.length === 0) {
      uploadMessage = 'Nur JPEG-Dateien sind erlaubt';
      return;
    }

    if (validFiles.length !== files.length) {
      uploadMessage = `${files.length - validFiles.length} Dateien übersprungen (nur JPEG erlaubt)`;
    }

    uploading = true;
    uploadProgress = 0;
    uploadPreviews = [];
    const totalFiles = validFiles.length;

    try {
      // Create preview URLs for immediate display
      for (const file of validFiles) {
        const previewUrl = URL.createObjectURL(file);
        uploadPreviews = [...uploadPreviews, previewUrl];
      }

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        currentUploading = file.name;
        uploadMessage = `Uploading ${file.name} (${i + 1}/${totalFiles})...`;

        // STEP 1: Upload original to Supabase first (bypasses Vercel 4.5MB limit)
        console.log('🔍 Frontend: STEP 1 - Uploading original to Supabase...');
        const id = crypto.randomUUID();
        const filename = `${id}.jpg`;
        
        // Upload original to Supabase originals bucket
        const { error: originalUploadError } = await supabase.storage
          .from('originals')
          .upload(filename, file, { 
            contentType: 'image/jpeg',
            upsert: false
          });
        
        if (originalUploadError) {
          console.error('❌ Original upload to Supabase failed:', originalUploadError);
          throw new Error(`Original upload failed: ${originalUploadError.message}`);
        }
        
        console.log('✅ Original uploaded to Supabase originals');
        
        // STEP 2: Send metadata to Vercel API for processing
        console.log('🔍 Frontend: STEP 2 - Sending metadata to Vercel API...');
        const formData = new FormData();
        formData.append('filename', filename);
        formData.append('original_path', filename);
        
        // Load user settings and attach them to the request
        console.log('🔍 Frontend: Starting to load user settings...');
        const sessionResult = await supabase.auth.getSession();
        const currentUser = sessionResult.data.session?.user;
        const session = sessionResult.data.session;
        
        console.log('🔍 Frontend: Session result:', { 
          hasUser: !!currentUser, 
          userId: currentUser?.id,
          hasSession: !!session 
        });
        
        if (currentUser) {
          formData.append('profile_id', currentUser.id);
          
          // Load user's image format settings
          console.log('🔍 Frontend: Loading profile data for user:', currentUser.id);
          try {
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('save_originals')
              .eq('id', currentUser.id)
              .single();
            
            console.log('🔍 Frontend: Profile query result:', { data: profileData, error: profileError });
            
            if (profileData) {
              console.log('🔍 Frontend: User settings loaded:', profileData);
              const saveOriginals = profileData.save_originals ?? true;
              console.log('🔍 Frontend: Appending to FormData:', { saveOriginals });
              formData.append('save_originals', saveOriginals ? 'true' : 'false');
            } else {
              console.log('🔍 Frontend: No profile data found, using defaults');
              formData.append('save_originals', 'true');
            }
          } catch (profileError) {
            console.log('🔍 Frontend: Could not load user profile settings:', profileError);
            formData.append('save_originals', 'true');
          }
        }
        
        // Debug: Log FormData contents
        console.log('🔍 Frontend: FormData contents before sending:');
        for (const [key, value] of formData.entries()) {
          console.log(`  ${key}: ${value}`);
        }
        
        const access_token = session?.access_token;
        const response = await authFetch('/api/upload', {
          method: 'POST',
          headers: {
            ...(access_token ? { 'Authorization': `Bearer ${access_token}` } : {})
          },
          body: formData
        });
        const result = await response.json();
        
        if (result.status !== 'success') {
          throw new Error(result.message);
        }

        // Update progress
        uploadProgress = Math.round(((i + 1) / totalFiles) * 100);
        
        // Add new images to gallery with proper sorting
        if (result.images) {
          const newImages = result.images.map((img: any) => ({
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

          pics.update(p => {
            const combined = [...p, ...newImages];
            
            // Sort by distance if distance is enabled and has GPS coordinates
            if (showDistance && userLat !== null && userLon !== null) {
              return combined.sort((a, b) => {
                const distA = a.lat && a.lon ? getDistanceInMeters(userLat!, userLon!, a.lat, a.lon) : Number.MAX_VALUE;
                const distB = b.lat && b.lon ? getDistanceInMeters(userLat!, userLon!, b.lat, b.lon) : Number.MAX_VALUE;
                return distA - distB;
              });
            } else {
              // For non-distance mode, add new images at the beginning (newest first)
              return [...newImages, ...p];
            }
          });
          
          // Update gallery stats after upload
          const totalCount = await getTotalImageCount();
          updateGalleryStats($pics.length, totalCount);
        }
      }

      uploadMessage = `✅ Successfully uploaded ${totalFiles} image(s)!`;

    } catch (error) {
      const err = error as Error;
      uploadMessage = `❌ Upload failed: ${err.message}`;
    } finally {
      uploading = false;
      currentUploading = '';
      
      // Cleanup preview URLs
      uploadPreviews.forEach(url => URL.revokeObjectURL(url));
      uploadPreviews = [];
      
      // Clear message after 5 seconds
      setTimeout(() => {
        uploadMessage = '';
        uploadProgress = 0;
      }, 5000);
    }
  }

  async function uploadImages(event: Event) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const files = (form.elements.namedItem('files') as HTMLInputElement).files;
    
    if (files) {
      await processFiles(files);
      form.reset();
    }
  }

  // Infinite scroll handler
  function handleScroll() {
    if (loading || !hasMoreImages) {
      console.log(`[Scroll] Skipping scroll handler - loading: ${loading}, hasMoreImages: ${hasMoreImages}`);
      return;
    }

    // Scroll-to-top-Button nur zeigen, wenn gescrollt wurde
    showScrollToTop = window.scrollY > 100;

    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    const scrolledToBottom = scrollTop + clientHeight >= scrollHeight - 500;

    if (scrolledToBottom) {
      console.log(`[Scroll] Reached bottom, loading more images... (current: ${$pics.length}, hasMoreImages: ${hasMoreImages}, loading: ${loading})`);
      console.log(`[Scroll] Scroll position: ${scrollTop}/${scrollHeight}, clientHeight: ${clientHeight}, threshold: ${scrollHeight - 500}`);
      loadMore('infinite scroll');
    }
  }

  // Manual trigger for testing infinite scroll
  function manualLoadMore() {
    console.log(`[Manual] Manual load more triggered - current: ${$pics.length}, hasMoreImages: ${hasMoreImages}, loading: ${loading}`);
    if (!loading && hasMoreImages) {
      loadMore('manual trigger');
    } else {
      console.log(`[Manual] Cannot load more - loading: ${loading}, hasMoreImages: ${hasMoreImages}`);
    }
  }

  function updateLayoutFromStorage() {
    // This function is now deprecated - layout is loaded from database in loadShowDistanceAndCompass()
    // Keeping for backward compatibility but it's no longer used
    console.log('[Layout] updateLayoutFromStorage called but deprecated - using DB instead');
  }

  async function loadProfileAvatar() {
    // Kein localStorage mehr, immer aktuell laden
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      profileAvatar = null;
      return;
    }
    // Fetch profile
    const { data, error } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .single();
    if (data && data.avatar_url) {
      if (data.avatar_url.startsWith('http')) {
        profileAvatar = data.avatar_url;
      } else {
        profileAvatar = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/avatars/${data.avatar_url}`;
      }
    } else {
      profileAvatar = null;
    }
  }

  async function loadShowDistanceAndCompass() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    currentUser = user;
    const { data } = await supabase
      .from('profiles')
      .select('show_distance, show_compass, autoguide, enable_search, use_justified_layout, newsflash_mode, home_lat, home_lon')
      .eq('id', user.id)
      .single();
    
    console.log('[Settings] Loading user settings:', data);
    
    showDistance = data?.show_distance ?? true; // Default to true for GPS-based sorting
    showCompass = data?.show_compass ?? false;
    autoguide = data?.autoguide ?? false;
          	// Load showSearchField from localStorage (default: true = Search field visible)
	showSearchField = localStorage.getItem('showSearchField') !== 'false';
    useJustifiedLayout = data?.use_justified_layout ?? true;
    // Ensure justified layout is enabled by default
    if (useJustifiedLayout === undefined || useJustifiedLayout === null) {
      useJustifiedLayout = true;
    }
    newsFlashMode = data?.newsflash_mode ?? 'alle';
    
    console.log('[Settings] Loaded settings:', {
      showDistance,
      showCompass,
      autoguide,
      useJustifiedLayout,
      newsFlashMode
    });
    
    // Debug: Log the actual layout being used
    console.log('[Settings] Layout will be:', useJustifiedLayout ? 'justified' : 'grid');
    
    // Start GPS tracking if distance is enabled
    if (showDistance && navigator.geolocation) {
      // Check if we have saved GPS coordinates first
      const savedLocation = loadLastKnownLocation();
      
      // Nur GPS-Tracking starten, wenn wir noch keine gültigen Koordinaten haben
      if (userLat === null || userLon === null) {
        console.log('[Settings] GPS coordinates not available, starting GPS tracking...');
        
        // Priority 1: Use home base GPS if available
        if (data?.home_lat && data?.home_lon) {
          console.log('[Settings] Using home base GPS coordinates:', { lat: data.home_lat, lon: data.home_lon });
          userLat = data.home_lat;
          userLon = data.home_lon;
          gpsStatus = 'active';
          lastGPSUpdateTime = Date.now();
        }
        // Priority 2: Use saved coordinates if available while waiting for fresh GPS
        else if (savedLocation && savedLocation.lat && savedLocation.lon) {
          console.log('[Settings] Using saved GPS coordinates while waiting for fresh GPS:', savedLocation);
          userLat = savedLocation.lat;
          userLon = savedLocation.lon;
          gpsStatus = 'active';
        }
        
        startGPSTracking();
        
        // Load gallery with available coordinates (saved or fresh)
        if (!initialSearchParam.trim()) {
          console.log('[Settings] Loading gallery with available GPS coordinates...');
          // Special handling for location filters to prevent flickering
        if (hasLocationFilter) {
          console.log("[Filter Change] Location filter detected - loading smoothly without clearing gallery");
          // For location filters: load smoothly without clearing existing images
          // This prevents the flickering effect
          page = 0;
          hasMoreImages = true;
          
          // Clear global GPS data to ensure fresh sorting from new location
          if ((window as any).gpsSortedData) {
            delete (window as any).gpsSortedData;
            console.log("[Filter Change] Cleared GPS sorted data for location filter");
          }
        } else {
          // For other filters: reset gallery state immediately
          pics.set([]);
          page = 0;
          hasMoreImages = true;
        }
          page = 0;
          hasMoreImages = true;
          loading = false;
          loadMore('settings load with available GPS');
        }
      } else {
              // GPS coordinates already available, reload gallery with GPS-based sorting
      console.log('[Settings] GPS coordinates available and showDistance enabled, reloading gallery...');
      
      // Only reload if gallery is empty or if we need to switch to GPS sorting
      const needsReload = $pics.length === 0 || !(window as any).gpsSortedData;
      
      if (needsReload && !loading) {
        // Special handling for location filters to prevent flickering
        if (hasLocationFilter) {
          console.log("[Filter Change] Location filter detected - loading smoothly without clearing gallery");
          // For location filters: load smoothly without clearing existing images
          // This prevents the flickering effect
          page = 0;
          hasMoreImages = true;
          
          // Clear global GPS data to ensure fresh sorting from new location
          if ((window as any).gpsSortedData) {
            delete (window as any).gpsSortedData;
            console.log("[Filter Change] Cleared GPS sorted data for location filter");
          }
        } else {
          // For other filters: reset gallery state immediately
          pics.set([]);
          page = 0;
          hasMoreImages = true;
        }
        page = 0;
        hasMoreImages = true;
        loading = false; // Ensure loading is false for fresh start
        // Clear any existing GPS sorted data to force fresh loading
        if ((window as any).gpsSortedData) {
          delete (window as any).gpsSortedData;
          console.log('[Settings] Cleared existing GPS sorted data');
        }
        
        // Add a small delay to prevent rapid successive calls
        setTimeout(() => {
          if (!loading) {
            loadMore('settings load with GPS sorting');
          }
        }, 100);
      } else {
        console.log('[Settings] Gallery already loaded with GPS sorting, no reload needed');
      }
      }
    } else {
      stopGPSTracking();
      // Load gallery with date sorting when GPS is disabled
      if (!initialSearchParam.trim()) {
        console.log('[Settings] GPS disabled, loading gallery with date sorting...');
        // Special handling for location filters to prevent flickering
        if (hasLocationFilter) {
          console.log("[Filter Change] Location filter detected - loading smoothly without clearing gallery");
          // For location filters: load smoothly without clearing existing images
          // This prevents the flickering effect
          page = 0;
          hasMoreImages = true;
          
          // Clear global GPS data to ensure fresh sorting from new location
          if ((window as any).gpsSortedData) {
            delete (window as any).gpsSortedData;
            console.log("[Filter Change] Cleared GPS sorted data for location filter");
          }
        } else {
          // For other filters: reset gallery state immediately
          pics.set([]);
          page = 0;
          hasMoreImages = true;
        }
        page = 0;
        hasMoreImages = true;
        loading = false;
        loadMore('settings load without GPS');
      }
    }
    
    // Activate autoguide if enabled
    if (autoguide && !audioActivated) {
      console.log('🎤 Autoguide enabled in settings, activating audio...');
      setTimeout(() => {
        activateAudioGuide();
        // Also announce first image after a delay
        setTimeout(() => {
          console.log('🎤 Announcing first image after autoguide activation...');
          announceFirstImage();
        }, 1500);
      }, 1000);
    }
  }

  function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number): string {
    const R = 6371000;
    const dLat = (lat2-lat1) * Math.PI/180;
    const dLon = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const meters = Math.round(R * c);
    if (meters >= 1000) {
      return (meters / 1000).toFixed(1).replace('.', ',') + 'km';
    } else {
      return meters + 'm';
    }
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

  function handleOrientation(event: DeviceOrientationEvent) {
    if (event.absolute && typeof event.alpha === 'number') {
      deviceHeading = 360 - event.alpha;
    }
  }

  function getAzimuth(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (deg: number) => deg * Math.PI / 180;
    const dLon = toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
    let brng = Math.atan2(y, x) * 180 / Math.PI;
    brng = (brng + 360) % 360;
    return brng;
  }



  function closeDialogs() {
    showUploadDialog = false;
  }

  // Login-Funktionen
  async function loginWithProvider(provider: 'google' | 'facebook') {
    loginLoading = true;
    loginError = '';
    
    // Session löschen vor OAuth-Login für direkten Login
    sessionStore.clearSession();
    console.log('🔓 Direct OAuth login - cleared session data');
    
    // Für Produktionsumgebung: Explizite Redirect-URL setzen
    const redirectTo = typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
      ? `${window.location.origin}/auth/callback`
      : undefined;
    
    const { error: authError } = await supabase.auth.signInWithOAuth({ 
      provider,
      options: {
        redirectTo
      }
    });
    
    if (authError) loginError = authError.message;
    loginLoading = false;
  }

  async function loginWithEmail() {
    loginLoading = true;
    loginError = '';
    const { error: authError } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    if (authError) {
      loginError = authError.message;
    } else {
      // Erfolgreicher Login - Session löschen für direkten Login
      sessionStore.clearSession();
      console.log('🔓 Direct login - cleared session data');
      
      loginEmail = '';
      loginPassword = '';
    }
    loginLoading = false;
  }

  async function signupWithEmail() {
    loginLoading = true;
    loginError = '';
    loginInfo = '';
    const { error: authError } = await supabase.auth.signUp({ email: loginEmail, password: loginPassword });
    if (authError) {
      loginError = authError.message;
    } else {
      // Erfolgreiche Registrierung - Session löschen für direkten Login
      sessionStore.clearSession();
      console.log('🔓 Direct signup - cleared session data');
      
      loginInfo = 'Bitte bestätige deine E-Mail-Adresse. Du kannst dich nach der Bestätigung anmelden.';
      loginEmail = '';
      loginPassword = '';
      showRegister = false;
    }
    loginLoading = false;
  }

  async function resetPassword() {
    if (!loginEmail) {
      loginError = 'Bitte gib deine E-Mail-Adresse ein.';
      return;
    }
    
    loginLoading = true;
    loginError = '';
    
    const { error } = await supabase.auth.resetPasswordForEmail(loginEmail, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`
    });
    
    if (error) {
      loginError = error.message;
    } else {
      loginInfo = 'Passwort-Reset-Link wurde an deine E-Mail gesendet.';
      loginEmail = '';
    }
    
    loginLoading = false;
  }

  // Anonymous mode function
  function setAnonymousMode() {
    sessionStore.setAnonymous(true);
    showLoginOverlay = false;
    console.log('🔓 Anonymous mode activated');
  }
  
  // Close login overlay function
  function closeLoginOverlay() {
    showLoginOverlay = false;
  }

  // ESC key handler
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      closeDialogs();
      if (showLoginOverlay) {
        closeLoginOverlay();
      }
    }
  }

  function saveLastKnownLocation(lat: number | null, lon: number | null) {
    if (typeof localStorage !== 'undefined' && lat !== null && lon !== null) {
      localStorage.setItem('lastLat', lat.toString());
      localStorage.setItem('lastLon', lon.toString());
    }
  }

  function loadLastKnownLocation() {
    if (typeof localStorage !== 'undefined') {
      const lat = localStorage.getItem('lastLat');
      const lon = localStorage.getItem('lastLon');
      if (lat && lon) {
        return { lat: parseFloat(lat), lon: parseFloat(lon) };
      }
    }
    return null;
  }

  async function loadHomeBaseGPS() {
    if (isLoggedIn && currentUser) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('home_lat, home_lon')
        .eq('id', currentUser.id)
        .single();
      
      if (profileData?.home_lat && profileData?.home_lon) {
        return { lat: profileData.home_lat, lon: profileData.home_lon };
      }
    }
    return null;
  }

  function startGPSTracking() {
    if (simulationMode || gpsSimulationActive) {
      console.log('🔄 [GPS] Simulation active – skipping real GPS tracking');
      return;
    }
    if (!navigator.geolocation || gpsTrackingActive) {
      console.log('🔄 [GPS] Already tracking or geolocation not available');
      return;
    }
    
    // Block GPS tracking if anchor item is set (stable GPS coordinates)
    if (anchorItemId) {
      console.log(`🔄 [GPS] Anchor item set (${anchorItemId}) - blocking GPS tracking to maintain stable coordinates`);
      return;
    }
    
    console.log('🔄 [GPS] Starting GPS tracking...');
    gpsTrackingActive = true;
    
    // Load home base GPS asynchronously
    loadHomeBaseGPS().then(homeBaseGPS => {
      // Priority 1: Use home base GPS if available (for logged in users)
      if (homeBaseGPS) {
        console.log('🔄 [GPS] Found home base GPS:', homeBaseGPS);
        userLat = homeBaseGPS.lat;
        userLon = homeBaseGPS.lon;
        gpsStatus = 'active';
        lastGPSUpdateTime = Date.now();
      }
      
      // Priority 2: Use saved coordinates if available
      const savedLocation = loadLastKnownLocation();
      if (!homeBaseGPS && savedLocation && savedLocation.lat && savedLocation.lon) {
        console.log('🔄 [GPS] Using saved coordinates while waiting for fresh GPS:', savedLocation);
        userLat = savedLocation.lat;
        userLon = savedLocation.lon;
        gpsStatus = 'active';
        lastGPSUpdateTime = Date.now();
      } else if (!homeBaseGPS && !savedLocation) {
        gpsStatus = 'checking';
      }
    });
    
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        gpsStatus = 'active';
        showGPSMessage = false;
        lastKnownLat = pos.coords.latitude;
        lastKnownLon = pos.coords.longitude;
        userLat = pos.coords.latitude;
        userLon = pos.coords.longitude;
        saveLastKnownLocation(userLat, userLon);
        
        // Save GPS coordinates for stationary detection
        const gpsData = { lat: userLat, lon: userLon, timestamp: Date.now() };
        localStorage.setItem('userGps', JSON.stringify(gpsData));
        console.log(`[GPS] Saved GPS coordinates for stationary detection: ${userLat}, ${userLon}`);
        console.log('🔄 [GPS] Active:', { lat: userLat, lon: userLon });
        
        // Resort existing images immediately for distance display
        resortExistingImages();
        
        // Wenn GPS-Koordinaten verfügbar sind und showDistance aktiv ist, lade Bilder nach Entfernung sortiert
        if (userLat !== null && userLon !== null && !searchQuery.trim() && showDistance) {
          console.log('🔄 [GPS] Initial GPS position received, loading gallery with GPS-based sorting...');
          // Special handling for location filters to prevent flickering
        if (hasLocationFilter) {
          console.log("[Filter Change] Location filter detected - loading smoothly without clearing gallery");
          // For location filters: load smoothly without clearing existing images
          // This prevents the flickering effect
          page = 0;
          hasMoreImages = true;
          
          // Clear global GPS data to ensure fresh sorting from new location
          if ((window as any).gpsSortedData) {
            delete (window as any).gpsSortedData;
            console.log("[Filter Change] Cleared GPS sorted data for location filter");
          }
          
          // For location filters, use normal loading instead of grid loading
          loadMore('location filter with initial GPS');
        } else {
          // For other filters: reset gallery state immediately
          pics.set([]);
          page = 0;
          hasMoreImages = true;
          // Clear any existing GPS sorted data to force fresh loading
          if ((window as any).gpsSortedData) {
            delete (window as any).gpsSortedData;
          }
          loadMore('initial GPS mount');
        }
        }
        
        // Ensure gallery loads even if GPS is not needed for sorting
        if ($pics.length === 0 && !searchQuery.trim()) {
          console.log('🔄 [GPS] Gallery empty after GPS mount, loading gallery...');
          loadMore('GPS mount fallback');
        }
        
        gpsWatchId = navigator.geolocation.watchPosition(
          handlePositionUpdate,
          (error) => {
            console.error('GPS tracking error:', error);
            
            // Handle different error types
            if (error.code === error.TIMEOUT) {
              console.log('🔄 [GPS] Timeout error, but keeping last known position');
              // Don't mark as unavailable for timeout errors, keep trying
              return;
            } else if (error.code === error.PERMISSION_DENIED) {
              console.log('🔄 [GPS] Permission denied');
              gpsStatus = 'denied';
              showGPSMessage = true;
            } else {
              console.log('🔄 [GPS] Other GPS error, but keeping last known position');
              // For other errors, don't immediately mark as unavailable
            // Only mark as unavailable if we haven't had an update in 5 minutes
            if (lastGPSUpdateTime && (Date.now() - lastGPSUpdateTime) > GPS_MEMORY_TIMEOUT) {
              gpsStatus = 'unavailable';
              showGPSMessage = true;
              }
            }
          },
          { enableHighAccuracy: false, maximumAge: 60000, timeout: 60000 }
        );
        // 3×3 Grid system replaces radius check - no longer needed
        console.log('🔄 [GPS] 3×3 Grid system active - radius check not needed');
      },
      (error) => {
        console.error('Initial GPS error:', error);
        
        if (error.code === error.TIMEOUT) {
          console.log('🔄 [GPS] Initial GPS timeout, but will keep trying with watchPosition');
          // Don't give up on timeout, let watchPosition try
          // Only set to checking if we don't have saved coordinates
          if (!userLat || !userLon) {
            gpsStatus = 'checking';
          }
        } else if (error.code === error.PERMISSION_DENIED) {
          console.log('🔄 [GPS] GPS permission denied');
          gpsStatus = 'denied';
          showGPSMessage = true;
          gpsTrackingActive = false;
        } else {
          console.log('🔄 [GPS] Other initial GPS error, but will keep trying');
          // Only set to checking if we don't have saved coordinates
          if (!userLat || !userLon) {
            gpsStatus = 'checking';
          }
          // Don't stop tracking for other errors, let watchPosition try
        }
        
        // Ensure gallery loads even if GPS fails
        if ($pics.length === 0 && !loading) {
          console.log('🔄 [GPS] GPS failed but gallery is empty, loading gallery without GPS...');
          loadMore('GPS failed - fallback to normal loading');
        }
      },
              { enableHighAccuracy: false, timeout: 60000 }
    );
  }

  async function handlePositionUpdate(pos: GeolocationPosition) {
    // Ignore real GPS updates if GPS simulation is active
    if (gpsSimulationActive) {
      console.log('GPS simulation active, ignoring real GPS update');
      return;
    }
    
    // Block GPS updates if anchor item is set (stable GPS coordinates)
    if (anchorItemId) {
      console.log(`🔄 [GPS] Anchor item set (${anchorItemId}) - blocking GPS update to maintain stable coordinates`);
      return;
    }
    
    const newLat = pos.coords.latitude;
    const newLon = pos.coords.longitude;
    saveLastKnownLocation(newLat, newLon);
    
    // Always update position for distance display
    lastKnownLat = newLat;
    lastKnownLon = newLon;
    userLat = newLat;
    userLon = newLon;
    
    // Save GPS coordinates for stationary detection
    const gpsData = { lat: userLat, lon: userLon, timestamp: Date.now() };
    localStorage.setItem('userGps', JSON.stringify(gpsData));
    console.log(`[GPS] Updated GPS coordinates for stationary detection: ${userLat}, ${userLon}`);
    
      // Update GPS status and timestamp
  gpsStatus = 'active';
  lastGPSUpdateTime = Date.now();
  
  // Check for movement and update gallery mode
  checkMovement(newLat, newLon);
  
  // Update movement mode
  updateMovementMode(newLat, newLon);
    
    // Clear existing timeout and set new one
    if (gpsTimeoutId) {
      clearTimeout(gpsTimeoutId);
    }
    gpsTimeoutId = setTimeout(() => {
      console.log('🔄 [GPS] No updates for 5 minutes, marking as unavailable');
      gpsStatus = 'unavailable';
      showGPSMessage = true;
    }, GPS_MEMORY_TIMEOUT);
    
    console.log(`🔄 [GPS] Position updated: ${newLat.toFixed(6)}, ${newLon.toFixed(6)} at ${new Date().toLocaleTimeString()}`);
    console.log(`[GPS Debug] userLat: ${userLat}, userLon: ${userLon}`);
    
    // Resort existing images immediately for distance display
    resortExistingImages();
    
            // Check if we moved into a new grid cell (10km grid)
        try {
          const movedOutsideCenter = !dynamicLoader.isInCenterCell(newLat, newLon);
          if (movedOutsideCenter) {
            console.log('🗺️ Grid center changed – loading new 3×3 grid for main page');
            // Reset gallery and load fresh 3×3 grid
            // Special handling for location filters to prevent flickering
            if (hasLocationFilter) {
              console.log("[Filter Change] Location filter detected - loading smoothly without clearing gallery");
              // For location filters: load smoothly without clearing existing images
              // This prevents the flickering effect
              page = 0;
              hasMoreImages = true;
              
              // Clear global GPS data to ensure fresh sorting from new location
              if ((window as any).gpsSortedData) {
                delete (window as any).gpsSortedData;
                console.log("[Filter Change] Cleared GPS sorted data for location filter");
              }
              
              // For location filters, use normal loading instead of grid loading
              loadMore('location filter with GPS movement');
            } else {
              // For other filters: reset gallery state immediately
              pics.set([]);
              page = 0;
              hasMoreImages = true;
              // Use normal loading instead of grid loading for consistency
              loadMore('GPS movement without location filter');
            }
          }
        } catch (err) {
          console.warn('Grid detection failed', err);
        }
    
    // Only check for significant movement for reloading
    if (lastKnownLat !== null && lastKnownLon !== null) {
      const distance = getDistanceInMeters(lastKnownLat, lastKnownLon, newLat, newLon);
      
      if (distance > GPS_UPDATE_THRESHOLD) {
        console.log(`Moved ${distance.toFixed(1)}m, checking if reload needed...`);
        
        // Prüfe nur bei größeren Bewegungen (>1km) ob wir komplett neue Daten brauchen
        if (distance > 1000) {
          console.log(`Large movement detected (${distance.toFixed(1)}m), checking if reload needed...`);
          const shouldReload = checkIfCompleteReloadNeeded();
          if (shouldReload) {
            reloadGalleryWithNewPosition();
          }
        }
      }
    }
    
            // Wenn GPS verfügbar wird und showDistance aktiv ist, lade die Galerie mit GPS-basierter Sortierung
        if (showDistance && !searchQuery.trim()) {
          // Check if this is the first GPS position or if we need to reload for GPS sorting
          const needsGPSReload = $pics.length === 0 || !(window as any).gpsSortedData;
          
          if (needsGPSReload) {
            console.log('🔄 [GPS] GPS available and showDistance active, reloading gallery with GPS-based sorting...');
          // Special handling for location filters to prevent flickering
            if (hasLocationFilter) {
              console.log("[Filter Change] Location filter detected - loading smoothly without clearing gallery");
              // For location filters: load smoothly without clearing existing images
              // This prevents the flickering effect
              page = 0;
              hasMoreImages = true;
              
              // Clear global GPS data to ensure fresh sorting from new location
              if ((window as any).gpsSortedData) {
                delete (window as any).gpsSortedData;
                console.log("[Filter Change] Cleared GPS sorted data for location filter");
              }
              
              // For location filters, use normal loading instead of grid loading
              loadMore('location filter with GPS update');
            } else {
              // For other filters: reset gallery state immediately
              pics.set([]);
              page = 0;
              hasMoreImages = true;
              // Clear any existing GPS sorted data to force fresh loading
              if ((window as any).gpsSortedData) {
                delete (window as any).gpsSortedData;
              }
              loadMore('GPS update with GPS-based sorting');
            }
          }
        }
  }

  function checkIfCompleteReloadNeeded(): boolean {
    if (!userLat || !userLon || !$pics.length) return true;
    
    const currentPics = $pics;
    
    // Prüfe ob wir Bilder im 5km Umkreis haben
    const nearbyImages = currentPics.filter((pic: any) => {
      if (!pic.lat || !pic.lon) return false;
      const distance = getDistanceInMeters(userLat!, userLon!, pic.lat, pic.lon);
      return distance <= 5000; // 5km radius
    });
    
    console.log(`Images within 5km: ${nearbyImages.length}`);
    
    // Nur neu laden wenn wir sehr wenige Bilder in der Nähe haben
    return nearbyImages.length < 5;
  }

  // INTELLIGENTE COVERAGE-PRÜFUNG: Erkenne ob User außerhalb des gecachten Bereichs ist
  async function checkIfUserOutsideCoverage(currentPics: any[]): Promise<boolean> {
    if (!userLat || !userLon || currentPics.length === 0) return true;
    
    // Check if user has moved completely outside the cached area
    // This happens when images are only available in one direction or none at all
    
    const coverageRadius = 5000; // 5km radius für Coverage-Check
    const directions = [
      { name: 'N', lat: 1, lon: 0 },   // North
      { name: 'NO', lat: 1, lon: 1 },  // Northeast  
      { name: 'O', lat: 0, lon: 1 },   // East
      { name: 'SO', lat: -1, lon: 1 }, // Southeast
      { name: 'S', lat: -1, lon: 0 },  // South
      { name: 'SW', lat: -1, lon: -1 }, // Southwest
      { name: 'W', lat: 0, lon: -1 },  // West
      { name: 'NW', lat: 1, lon: -1 }  // Northwest
    ];
    
    let coveredDirections = 0;
    const checkDistance = 3000; // 3km from center to check each direction
    
    for (const direction of directions) {
      const checkLat = userLat + (direction.lat * checkDistance / 111000);
      const checkLon = userLon + (direction.lon * checkDistance / (111000 * Math.cos(userLat * Math.PI / 180)));
      
      const imagesInDirection = currentPics.filter((pic: any) => {
        if (!pic.lat || !pic.lon) return false;
        const distance = getDistanceInMeters(checkLat, checkLon, pic.lat, pic.lon);
        return distance <= coverageRadius;
      });
      
      if (imagesInDirection.length > 0) {
        coveredDirections++;
      }
    }
    
    // Wenn weniger als 3 Richtungen abgedeckt sind, ist der User außerhalb des Cached-Bereichs
    const isOutsideCoverage = coveredDirections < 3;
    
    console.log(`[Coverage Check] Covered directions: ${coveredDirections}/8, outside coverage: ${isOutsideCoverage}`);
    
    return isOutsideCoverage;
  }

  // State für "Keine Items in der Nähe" Meldung
  let showNoItemsMessage = false;
  let noItemsMessageTimeout: ReturnType<typeof setTimeout> | null = null;
  let showMap = false;
  
  // Movement mode state
  let isInMovementMode = false;
  let movementModeTimeout: ReturnType<typeof setTimeout> | null = null;
  
  // Update movement mode based on GPS position changes
  function updateMovementMode(newLat: number, newLon: number) {
    if (lastKnownLat !== null && lastKnownLon !== null) {
      const distance = getDistanceInMeters(lastKnownLat, lastKnownLon, newLat, newLon);
      
      if (distance > 10) { // Movement detected (10m threshold)
        // Clear existing timeout
        if (movementModeTimeout) {
          clearTimeout(movementModeTimeout);
          movementModeTimeout = null;
        }
        
        // Enter movement mode
        if (!isInMovementMode) {
          isInMovementMode = true;
          // Only start rotation if manual 3x3 mode is active
          if (isManual3x3Mode) {
            settingsIconRotation = 360; // Start rotation
          }
          console.log('🔄 [Movement] Entered movement mode');
        }
      } else {
        // No movement - start timeout to exit movement mode
        if (movementModeTimeout) {
          clearTimeout(movementModeTimeout);
        }
        
        movementModeTimeout = setTimeout(() => {
          isInMovementMode = false;
          // Only stop rotation if manual 3x3 mode is not active
          if (!isManual3x3Mode) {
            settingsIconRotation = 0; // Stop rotation
          }
          console.log('🔄 [Movement] Exited movement mode (10s no movement)');
        }, 10000); // 10 seconds
      }
    }
  }

  // EFFIZIENTES NACHLADEN: Verhindert übermäßige Server-Anfragen
  async function loadMoreEfficiently(reason = 'default') {
    if (!userLat || !userLon) {
      await loadMore(reason);
      return;
    }
    
    console.log(`[Efficient Load] Attempting efficient load, reason: ${reason}`);
    
    // Versuche zuerst eine kleine Stichprobe zu laden um zu prüfen ob überhaupt Bilder vorhanden sind
    // Create query with privacy filtering
    let sampleQuery = supabase
      .from('items')
      .select('id,lat,lon,profile_id,is_private')
      .not('lat', 'is', null)
      .not('lon', 'is', null);
    
    // Apply privacy filtering based on user login status
    if (isLoggedIn && currentUser) {
      // For logged in users: show their own images (all) + other users' public images
      sampleQuery = sampleQuery.or(`profile_id.eq.${currentUser.id},is_private.eq.false,is_private.is.null`);
    } else {
      // For anonymous users: only show public images
      sampleQuery = sampleQuery.or('is_private.eq.false,is_private.is.null');
    }
    
    const { data: sampleData, error } = await sampleQuery
              // Kein Limit - alle Bilder
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[Efficient Load] Error loading sample:', error);
      await loadMore(reason);
      return;
    }
    
    if (!sampleData || sampleData.length === 0) {
      console.log('[Efficient Load] No images with GPS data found');
      showNoItemsMessage = true;
      return;
    }
    
    // Prüfe ob es Bilder im 25km Umkreis gibt
    const nearbyImages = sampleData.filter((img: any) => {
      const distance = getDistanceInMeters(userLat!, userLon!, img.lat, img.lon);
      return distance <= 25000; // 25km radius
    });
    
    if (nearbyImages.length === 0) {
      console.log('[Efficient Load] No images within 25km radius found');
      showNoItemsMessage = true;
      
      // Auto-hide message after 10 seconds
      if (noItemsMessageTimeout) clearTimeout(noItemsMessageTimeout);
      noItemsMessageTimeout = setTimeout(() => {
        showNoItemsMessage = false;
      }, 10000);
      
      return;
    }
    
    console.log(`[Efficient Load] Found ${nearbyImages.length} images within 25km, proceeding with normal load`);
    showNoItemsMessage = false;
    
    // Normale Ladung wenn Bilder in der Nähe verfügbar sind
    await loadMore(reason);
  }

  // Debounced Gallery Update um Zucken zu vermeiden
  function debouncedGalleryUpdate(updateFunction: () => void, delay: number = 500) {
    if (galleryUpdateTimeout) {
      clearTimeout(galleryUpdateTimeout);
    }
    galleryUpdateTimeout = window.setTimeout(updateFunction, delay);
  }

  function resortExistingImages() {
    // Get current filter state
    const currentFilters = get(filterStore);
    const currentHasLocationFilter = currentFilters.locationFilter !== null;
    const hasUserFilter = currentFilters.userFilter !== null;
    const effectiveLat = currentHasLocationFilter ? currentFilters.locationFilter!.lat : userLat;
    const effectiveLon = currentHasLocationFilter ? currentFilters.locationFilter!.lon : userLon;
    
    if ((!effectiveLat || !effectiveLon) || !$pics.length) return;
    
    // Don't resort if we have location filter - the IntelligentLoader already sorted correctly
    if (currentHasLocationFilter) {
      console.log(`[Resort] Location filter active - skipping resort to preserve IntelligentLoader sorting`);
      return;
    }
    
    // Only resort for user filters or GPS-based sorting
    if (hasUserFilter) {
      console.log(`[Resort] User filter detected, resorting by distance from filter location`);
    } else {
      console.log(`[Resort] GPS-based resorting from current position`);
    }
    
    console.log('Resorting existing images based on new position...');
    
    // Debounce das Update um Zucken zu vermeiden
    debouncedGalleryUpdate(() => {
      // Sort existing images by distance without reloading
      const sortedPics = [...$pics].sort((a: any, b: any) => {
        if (!a.lat || !a.lon || !b.lat || !b.lon) return 0;
        
        const distA = a.lat && a.lon && effectiveLat && effectiveLon ? getDistanceInMeters(effectiveLat, effectiveLon, a.lat, a.lon) : Number.MAX_VALUE;
        const distB = b.lat && b.lon && effectiveLat && effectiveLon ? getDistanceInMeters(effectiveLat, effectiveLon, b.lat, b.lon) : Number.MAX_VALUE;
        
        return distA - distB;
      });
      
      pics.set(sortedPics);
      console.log(`[Resort] Resorted ${sortedPics.length} existing images by distance from ${effectiveLat}, ${effectiveLon}`);
    }, 300); // Kürzeres Delay für bessere Responsiveness
  }


  
  function stopGPSTracking() {
    if (gpsWatchId !== null) {
      navigator.geolocation.clearWatch(gpsWatchId);
      gpsWatchId = null;
    }

    gpsTrackingActive = false;
    console.log('GPS tracking stopped');
  }

  // Funktion um GPS-Koordinaten von der Karte zu erhalten
  function setLocationFromMap(lat: number, lon: number) {
    userLat = lat;
    userLon = lon;
    saveLastKnownLocation(lat, lon);
    gpsStatus = 'active';
    showGPSMessage = false;
    
    if (showDistance && !searchQuery.trim()) {
      // Special handling for location filters to prevent flickering
        if (currentHasLocationFilter) {
          console.log("[Filter Change] Location filter detected - loading smoothly without clearing gallery");
          // For location filters: load smoothly without clearing existing images
          // This prevents the flickering effect
          page = 0;
          hasMoreImages = true;
          
          // Clear global GPS data to ensure fresh sorting from new location
          if ((window as any).gpsSortedData) {
            delete (window as any).gpsSortedData;
            console.log("[Filter Change] Cleared GPS sorted data for location filter");
          }
        } else {
          // For other filters: reset gallery state immediately
          pics.set([]);
          page = 0;
          hasMoreImages = true;
        }
      page = 0;
      hasMoreImages = true;
      loadMore('location from map');
    }
    
    console.log(`Location set from map: ${lat}, ${lon}`);
  }
  
  async function reloadGalleryWithNewPosition() {
    if (!showDistance) return;
    
    // Don't reload gallery if a search is active
    if (searchQuery.trim() || searchResults.length > 0) {
      return;
    }
    
    console.log('Reloading gallery with fresh GPS position...');
    
    // INTELLIGENTE TELEPORTATIONSERKENNUNG
    const currentPics = get(pics);
    const shouldReloadFromNewPosition = await checkIfUserOutsideCoverage(currentPics);
    
    if (shouldReloadFromNewPosition) {
      console.log('[Teleportation] User outside cached coverage area, reloading from new position');
      // Special handling for location filters to prevent flickering
        if (hasLocationFilter) {
          console.log("[Filter Change] Location filter detected - loading smoothly without clearing gallery");
          // For location filters: load smoothly without clearing existing images
          // This prevents the flickering effect
          page = 0;
          hasMoreImages = true;
          
          // Clear global GPS data to ensure fresh sorting from new location
          if ((window as any).gpsSortedData) {
            delete (window as any).gpsSortedData;
            console.log("[Filter Change] Cleared GPS sorted data for location filter");
          }
        } else {
          // For other filters: reset gallery state immediately
          pics.set([]);
          page = 0;
          hasMoreImages = true;
        }
      page = 0;
      hasMoreImages = true;
      
      // Versuche effizientes Nachladen von neuer Position
      await loadMoreEfficiently('teleportation-detected');
      return;
    }
    
    // Normale Positionsaktualisierung: Nur bestehende Bilder neu sortieren
    if (currentPics.length > 0) {
      // Get current filter state for effective coordinates
      const currentFilters = get(filterStore);
      const currentHasLocationFilter = currentFilters.locationFilter !== null;
      
      // Don't resort if we have location filter - the IntelligentLoader already sorted correctly
      if (currentHasLocationFilter) {
        console.log(`[Position Update] Location filter active - skipping resort to preserve IntelligentLoader sorting`);
        return;
      }
      
      console.log(`[Position Update] Resorting ${currentPics.length} existing images by new position`);
      
      const effectiveLat = currentHasLocationFilter ? currentFilters.locationFilter!.lat : userLat;
      const effectiveLon = currentHasLocationFilter ? currentFilters.locationFilter!.lon : userLon;
      
      const sortedPics = [...currentPics].sort((a: any, b: any) => {
        const distA = a.lat && a.lon && effectiveLat && effectiveLon ? getDistanceInMeters(effectiveLat, effectiveLon, a.lat, a.lon) : Number.MAX_VALUE;
        const distB = b.lat && b.lon && effectiveLat && effectiveLon ? getDistanceInMeters(effectiveLat, effectiveLon, b.lat, b.lon) : Number.MAX_VALUE;
        return distA - distB;
      });
      
      pics.set(sortedPics);
      console.log(`Gallery resorted by distance based on new position (${effectiveLat}, ${effectiveLon})`);
      
      // Prüfe ob mehr Bilder geladen werden müssen
      checkAndLoadMoreImages();
    } else {
      // Keine gecachten Bilder: Normale Erstladung
      console.log('[Position Update] No cached images, loading fresh');
      await loadMoreEfficiently('fresh-position-no-cache');
    }
  }

  // Navigation-Handler direkt im Komponenten-Scope (nicht im onMount!)
  beforeNavigate(({ to }) => {
    if (to?.url.pathname.startsWith('/item/')) {
      console.log('Navigating to detail page, starting gallery preload...');
      startGalleryPreload();
    }
  });

  afterNavigate(({ to }) => {
    if (to?.url.pathname === '/') {
      console.log('Back on main page, reloading gallery...');
      
      // Force gallery component re-initialization
      galleryKey = Date.now(); // Force re-render of gallery component
      
      // Also reset any other gallery-related state
      if (typeof window !== 'undefined') {
        // Clear any global state that might interfere
        if ((window as any).gpsSortedData) {
          delete (window as any).gpsSortedData;
        }
        if ((window as any).allImagesData) {
          delete (window as any).allImagesData;
        }
        if ((window as any).lastSortedImages) {
          delete (window as any).lastSortedImages;
        }
      }
      
      // Clear search state if no search query in URL
      const urlParams = new URLSearchParams(to.url.search);
      const searchParam = urlParams.get('s');
      if (!searchParam) {
        searchQuery = '';
        searchResults = [];
        console.log('Clearing search state on navigation back');
      }
      
      // Clear any existing GPS sorted data to force fresh loading
      if ((window as any).gpsSortedData) {
        delete (window as any).gpsSortedData;
        console.log('[Navigation] Cleared existing GPS sorted data');
      }
      
      // Also clear any other cached data that might interfere
      if ((window as any).allImagesData) {
        delete (window as any).allImagesData;
        console.log('[Navigation] Cleared cached all images data');
      }
      
      // Reset gallery state and reload immediately
      // Get current filter state
      const currentFilters = get(filterStore);
      const currentHasLocationFilter = currentFilters.locationFilter !== null;
      
      // Special handling for location filters to prevent flickering
      if (currentHasLocationFilter) {
          console.log("[Filter Change] Location filter detected - loading smoothly without clearing gallery");
          // For location filters: load smoothly without clearing existing images
          // This prevents the flickering effect
          page = 0;
          hasMoreImages = true;
          
          // Clear global GPS data to ensure fresh sorting from new location
          if ((window as any).gpsSortedData) {
            delete (window as any).gpsSortedData;
            console.log("[Filter Change] Cleared GPS sorted data for location filter");
          }
        } else {
          // For other filters: reset gallery state immediately
          pics.set([]);
          page = 0;
          hasMoreImages = true;
        }
      page = 0;
      hasMoreImages = true;
      loading = false; // Ensure loading is false for fresh start
      
      // Reset gallery stats
      updateGalleryStats(0, 0);
      
      // Load gallery immediately without setTimeout
      if (!searchQuery.trim() && !loading) {
        // Ensure GPS coordinates are available before loading
        const savedLocation = loadLastKnownLocation();
        if (savedLocation && savedLocation.lat && savedLocation.lon && (userLat === null || userLon === null)) {
          console.log('[Navigation] Using saved GPS coordinates for navigation back:', savedLocation);
          userLat = savedLocation.lat;
          userLon = savedLocation.lon;
          gpsStatus = 'active';
        }
        
        // Check if we need to load user settings first
        if (isLoggedIn && showDistance === undefined) {
          console.log('[Navigation] Loading user settings before gallery load...');
          loadShowDistanceAndCompass().then(() => {
            loadGalleryAfterNavigation();
          });
        } else if (!isLoggedIn && showDistance === false) {
          // For anonymous users, enable distance display by default
          showDistance = true;
          console.log('[Navigation] Enabling distance display for anonymous user');
          loadGalleryAfterNavigation();
        } else {
          loadGalleryAfterNavigation();
        }
      } else if (searchQuery.trim()) {
        // Search mode: reload search
        console.log('[Navigation] Loading search results from navigation back');
        performSearch(searchQuery, false);
      }
    }
  });

  // Helper function to load gallery after navigation
  async function loadGalleryAfterNavigation() {
    // Ensure we have the best available GPS coordinates
    if (userLat === null || userLon === null) {
      // Priority 1: Use home base GPS if available
      let homeBaseGPS = null;
      if (isLoggedIn && currentUser) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('home_lat, home_lon')
          .eq('id', currentUser.id)
          .single();
        
        if (profileData?.home_lat && profileData?.home_lon) {
          homeBaseGPS = { lat: profileData.home_lat, lon: profileData.home_lon };
          console.log('[Navigation] Using home base GPS coordinates for navigation back:', homeBaseGPS);
          userLat = homeBaseGPS.lat;
          userLon = homeBaseGPS.lon;
          gpsStatus = 'active';
          lastGPSUpdateTime = Date.now();
        }
      }
      
      // Priority 2: Use saved coordinates if available
      if (!homeBaseGPS) {
        const savedLocation = loadLastKnownLocation();
        if (savedLocation && savedLocation.lat && savedLocation.lon) {
          console.log('[Navigation] Using saved GPS coordinates for navigation back:', savedLocation);
          userLat = savedLocation.lat;
          userLon = savedLocation.lon;
          gpsStatus = 'active';
        }
      }
    }
    
    console.log('[Navigation] Final state before loading:', {
      showDistance,
      userLat,
      userLon,
      isLoggedIn,
      searchQuery: searchQuery.trim()
    });
    
    // Force a small delay to ensure DOM is updated
    setTimeout(() => {
      if (showDistance && userLat !== null && userLon !== null) {
        // GPS mode: reload with GPS sorting
        console.log('[Navigation] Loading with GPS sorting from navigation back');
        loadMore('navigation back with GPS');
      } else {
        // Normal mode: reload without GPS
        console.log('[Navigation] Loading without GPS from navigation back');
        loadMore('navigation back normal');
      }
    }, 50);
  }

  let initialSearchParam = '';
  
      onMount(() => {
    (async () => {
    // SIMPLIFIED: Force initial gallery load for debugging
    console.log('🔄 [DEBUG] onMount - forcing immediate gallery load');
    
    // Add event listener for 3x3 mode toggle
    window.addEventListener('toggle3x3Mode', () => {
      toggle3x3Mode();
    });
    
    // Event listener for rotation speed increase
    window.addEventListener('increaseRotationSpeed', () => {
      if (isManual3x3Mode) {
        increaseRotationSpeed();
      }
    });
    
    // Set auth as checked to allow gallery loading
    authChecked = true;
    isLoggedIn = false;
    currentUser = null;
    
    // Initialize filter store from URL parameters
    filterStore.initFromUrl($pageStore.url.searchParams);

    // Check for URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const simulation = urlParams.get('simulation');
    const stopSimulation = urlParams.get('stop');
    const searchParam = urlParams.get('s');
    const authError = urlParams.get('error');
    const anchorParam = urlParams.get('anchor'); // Anchor item ID for stable sorting
    
    // Handle auth errors from OAuth callback
    if (authError) {
      console.log('🔐 Auth error from callback:', authError);
      if (authError === 'auth_failed') {
        loginError = 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.';
      } else if (authError === 'unexpected') {
        loginError = 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.';
      }
      // Clear error from URL
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      window.history.replaceState({}, '', url.toString());
    }
    
    // Store search param for later use in auth state change
    initialSearchParam = searchParam || '';
    
    // Handle anchor parameter from URL
    if (anchorParam && anchorParam.trim()) {
      anchorItemId = anchorParam.trim();
      console.log('🎯 Anchor item ID detected from URL:', anchorItemId);
    }
    
    // Handle search parameter from URL
    if (searchParam && searchParam.trim()) {
      const initialSearch = searchParam.trim();
      console.log('🔍 URL search parameter detected:', initialSearch);
      
      // Set search query without triggering reactive updates
      searchQuery = initialSearch;
      
      // Perform search immediately if search parameter is present
      setTimeout(() => {
        console.log('🔍 Performing initial search from URL parameter');
        performSearch(initialSearch, false); // Don't update URL since it's already there
      }, 100);
    }
    
    if (stopSimulation === 'simulation') {
      console.log('Stopping simulation mode');
      simulationMode = false;
      gpsSimulationActive = false;
      // Clear URL parameters
      const url = new URL(window.location.href);
      url.searchParams.delete('stop');
      url.searchParams.delete('simulation');
      url.searchParams.delete('autoguide');
      url.searchParams.delete('showDistance');
      url.searchParams.delete('showCompass');
      window.history.replaceState({}, '', url.toString());
    } else if (simulation === 'true') {
      console.log('GPS Simulation mode detected');
      simulationMode = true;
      setupGPSSimulation();
      
      // Set simulation-specific settings
      const autoguideParam = urlParams.get('autoguide');
      const showDistanceParam = urlParams.get('showDistance');
      const showCompassParam = urlParams.get('showCompass');
      
      if (autoguideParam === 'true') {
        autoguide = true;
        console.log('Autoguide enabled for simulation');
      }
      
      if (showDistanceParam === 'true') {
        showDistance = true;
        console.log('Distance display enabled for simulation');
      }
      
      if (showCompassParam === 'true') {
        showCompass = true;
        console.log('Compass enabled for simulation');
      }
    } else {
      // Always setup GPS simulation for hash-based communication
      console.log('Setting up GPS simulation for hash-based communication');
      setupGPSSimulation();
    }

    // Initialize speech synthesis for autoguide
    initSpeechSynthesis();

    // Mobile-specific speech synthesis setup
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const enableMobileSpeech = () => {
        if (speechSynthesis && speechSynthesis.paused) {
          speechSynthesis.resume();
        }
        document.removeEventListener('click', enableMobileSpeech);
        document.removeEventListener('touchstart', enableMobileSpeech);
        document.removeEventListener('scroll', enableMobileSpeech);
      };
      document.addEventListener('click', enableMobileSpeech, { once: true });
      document.addEventListener('touchstart', enableMobileSpeech, { once: true });
      document.addEventListener('scroll', enableMobileSpeech, { once: true });
    }

    // Start GPS tracking immediately if not in simulation mode
    if (!simulationMode && !gpsSimulationActive) {
      console.log('🔄 Starting GPS tracking immediately...');
      startGPSTracking();
    }
    
    // FORCE GPS START: Ensure GPS tracking starts even if simulation mode is not set
    if (!gpsTrackingActive && !gpsSimulationActive && !simulationMode) {
      console.log('🔄 [FORCE] Starting GPS tracking as fallback...');
      startGPSTracking();
    }
    
    // Load saved GPS coordinates immediately for faster gallery loading
    const savedLocation = loadLastKnownLocation();
    if (savedLocation && savedLocation.lat && savedLocation.lon) {
      console.log('🔄 [GPS] Using saved GPS coordinates for immediate loading:', savedLocation);
      userLat = savedLocation.lat;
      userLon = savedLocation.lon;
      gpsStatus = 'active';
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const wasAuthChecked = authChecked;
      isLoggedIn = !!session;
      currentUser = session?.user || null;
      authChecked = true;
      
      console.log(`🔐 Auth state changed: ${event}, isLoggedIn: ${isLoggedIn}, wasAuthChecked: ${wasAuthChecked}`);
      
      if (isLoggedIn) {
        dynamicLoader.setCurrentUserId(currentUser?.id || null);
        await loadShowDistanceAndCompass();
        await loadProfileAvatar();
      } else {
        useJustifiedLayout = true;
        showDistance = true; // Enable distance for anonymous users
        showCompass = false;
        autoguide = false;
        newsFlashMode = 'alle';
        profileAvatar = null;
        dynamicLoader.setCurrentUserId(null);
      }
      
      // Only load gallery on first auth check, not on subsequent auth changes
      if (!wasAuthChecked) {
        console.log('🔐 First auth check complete, loading gallery...');
        
              // Set current user ID for dynamic loader privacy filtering
  const sessionData = get(sessionStore);
  const currentUserId = sessionData.isAuthenticated ? sessionData.userId : null;
  dynamicLoader.setCurrentUserId(currentUserId);
  console.log(`[Gallery] Set dynamic loader user ID: ${currentUserId}`);
  
  // Reactive function to update dynamic loader when auth status changes
  $: if (authChecked) {
    const currentSessionData = get(sessionStore);
    const currentUser = currentSessionData.isAuthenticated ? currentSessionData.userId : null;
    dynamicLoader.setCurrentUserId(currentUser);
    console.log(`[Gallery] Updated dynamic loader user ID: ${currentUser} (auth status changed)`);
  }
  
  // Load gallery with proper auth context
  const sessionPics = sessionStorage.getItem('galleryPics');
  if (sessionPics) {
    pics.set(JSON.parse(sessionPics));
  } else {
    // Load gallery based on distance settings
    if (!initialSearchParam.trim()) {
      // Load gallery immediately with intelligent loader system
      console.log('🔐 Loading gallery immediately with intelligent loader system...');
      // Special handling for location filters to prevent flickering
        if (hasLocationFilter) {
          console.log("[Filter Change] Location filter detected - loading smoothly without clearing gallery");
          // For location filters: load smoothly without clearing existing images
          // This prevents the flickering effect
          page = 0;
          hasMoreImages = true;
          
          // Clear global GPS data to ensure fresh sorting from new location
          if ((window as any).gpsSortedData) {
            delete (window as any).gpsSortedData;
            console.log("[Filter Change] Cleared GPS sorted data for location filter");
          }
        } else {
          // For other filters: reset gallery state immediately
          pics.set([]);
          page = 0;
          hasMoreImages = true;
        }
      page = 0;
      hasMoreImages = true;
      loading = false;
      
              // Choose loading strategy based on context
        if (userLat !== null && userLon !== null) {
          // Check if user is likely stationary (at home/hotel) or mobile
          const isStationary = await checkIfStationary();
          if (isStationary) {
            console.log('🔐 GPS available but user appears stationary, loading all images from database...');
            await loadImagesNormal(null, null, null, true);
          } else {
            console.log('🔐 GPS available and user appears mobile, using 3×3 grid loader...');
            // Check if we have a location filter - if so, use normal loading instead of grid loading
            if (hasLocationFilter) {
              console.log('🔐 Location filter detected - using normal loading instead of grid loading');
              await loadImagesNormal(null, null, null, true);
            } else {
              // Use normal loading instead of grid loading for consistency
              await loadImagesNormal(null, null, null, true);
            }
          }
        } else {
          console.log('🔐 No GPS coordinates, loading all images from database...');
          await loadImagesNormal(null, null, null, true);
        }
        
        // If gallery is still empty after loading attempt, try fallback
        if ($pics.length === 0) {
          console.log('🔐 Gallery still empty after initial load, trying fallback...');
          await loadImagesNormal(null, null, null, true);
        }
    } else {
      // Search parameter present: perform search
      performSearch(initialSearchParam, false);
    }
  }
      }
    });
    
    // IMMEDIATE: Check current session immediately to trigger auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('🔐 Immediate session check:', !!session);
      // The onAuthStateChange will be triggered automatically
    });

    // Gallery loading is now handled in onAuthStateChange to prevent race conditions
    // This ensures auth context is properly set before loading images
    
    // FALLBACK: If onAuthStateChange doesn't fire within 2 seconds, load gallery anyway
    setTimeout(async () => {
      if (!authChecked) {
        console.log('⚠️ Auth state change not detected after 2s, loading gallery as fallback...');
        
        // Check auth manually
        const { data: { user } } = await supabase.auth.getUser();
        isLoggedIn = !!user;
        currentUser = user;
        authChecked = true;
        
        if (!isLoggedIn) {
          useJustifiedLayout = true;
          showDistance = true; // Enable distance for anonymous users
          showCompass = false;
          autoguide = false;
          newsFlashMode = 'alle';
          profileAvatar = null;
          dynamicLoader.setCurrentUserId(null);
        } else {
          dynamicLoader.setCurrentUserId(currentUser?.id || null);
          await loadShowDistanceAndCompass();
          await loadProfileAvatar();
        }
        
        // Load gallery
        if (!initialSearchParam.trim()) {
          // Reset gallery state for fresh loading
          // Special handling for location filters to prevent flickering
        if (hasLocationFilter) {
          console.log("[Filter Change] Location filter detected - loading smoothly without clearing gallery");
          // For location filters: load smoothly without clearing existing images
          // This prevents the flickering effect
          page = 0;
          hasMoreImages = true;
          
          // Clear global GPS data to ensure fresh sorting from new location
          if ((window as any).gpsSortedData) {
            delete (window as any).gpsSortedData;
            console.log("[Filter Change] Cleared GPS sorted data for location filter");
          }
        } else {
          // For other filters: reset gallery state immediately
          pics.set([]);
          page = 0;
          hasMoreImages = true;
        }
          page = 0;
          hasMoreImages = true;
          console.log('🔄 Reset gallery state for fallback loading');
          
          if (showDistance) {
            // For distance mode: wait for GPS data
            waitForGpsAndLoadGallery();
          } else {
            loadMore('fallback mount normal');
          }
        }
      }
    }, 2000);

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('scroll', handleScrollForAudioguide, { passive: true });
    window.addEventListener('galleryLayoutChanged', updateLayoutFromStorage);
    window.addEventListener('openMap', () => {
      showMap = true;
    });
    

    window.addEventListener('profileSaved', loadProfileAvatar);
    window.addEventListener('keydown', handleKeydown);
    if (showCompass && window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientationabsolute', handleOrientation, true);
      window.addEventListener('deviceorientation', handleOrientation, true);
    }

    // Listen for messages from simulation iframe
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'gps-simulation-stop') {
        console.log('Received GPS simulation stop message');
        // Clear simulation parameters from URL
        const url = new URL(window.location.href);
        url.searchParams.delete('simulation');
        url.searchParams.delete('autoguide');
        url.searchParams.delete('showDistance');
        url.searchParams.delete('showCompass');
        window.history.replaceState({}, '', url.toString());
        simulationMode = false;
        gpsSimulationActive = false;
      }
    });

    // Event-Handler für Standby/Tab-Wechsel: Galerie neu sortieren/aktualisieren
    function handleVisibilityOrFocus() {
      if (document.visibilityState === 'visible' || document.hasFocus()) {
        // Resortiere bestehende Bilder nach aktueller GPS-Position
        if (userLat !== null && userLon !== null) {
          resortExistingImages();
          // Prüfe, ob wir in eine neue Grid-Zelle gewechselt sind (Mobile Galerie)
          if (isManual3x3Mode) {
            // Prüfe, ob neue GPS-Koordinaten eine neue Zelle ergeben und lade ggf. neu
            // (Grid-Logik ist bereits in checkMovement/updateMovementMode enthalten)
            checkMovement(userLat, userLon);
          }
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScrollForAudioguide);
      window.removeEventListener('galleryLayoutChanged', updateLayoutFromStorage);
      window.removeEventListener('profileSaved', loadProfileAvatar);
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
      subscription?.unsubscribe();
      stopGPSTracking();
      
      // Cleanup scroll timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
    })();
  });

  // Hilfsfunktion: Grid-Zelle berechnen
  function getGridCell(lat: number, lon: number, cellSize = 0.4) {
    return {
      lat: Math.floor(lat / cellSize) * cellSize,
      lon: Math.floor(lon / cellSize) * cellSize
    };
  }

  // Hilfsfunktion: Abgedeckte Zellen bestimmen
  function getCoveredCells(pics: any[], cellSize = 0.4) {
    const covered = new Set<string>();
    for (const pic of pics) {
      if (pic.lat && pic.lon) {
        const cell = getGridCell(pic.lat, pic.lon, cellSize);
        covered.add(`${cell.lat},${cell.lon}`);
      }
    }
    return covered;
  }

  // Grid Coverage Check & Nachladen
  async function fillCoverageGaps(userLat: number, userLon: number, pics: any[], cellSize = 0.4, radius = 0.5) {
    const covered = getCoveredCells(pics, cellSize);
    const currentCell = getGridCell(userLat, userLon, cellSize);
    let gaps: {lat: number, lon: number}[] = [];
    // Prüfe aktuelle und 8 Nachbarzellen (3x3 Grid)
    for (let dLat = -1; dLat <= 1; dLat++) {
      for (let dLon = -1; dLon <= 1; dLon++) {
        const cellLat = currentCell.lat + dLat * cellSize;
        const cellLon = currentCell.lon + dLon * cellSize;
        const key = `${cellLat},${cellLon}`;
        if (!covered.has(key)) {
          gaps.push({ lat: cellLat + cellSize/2, lon: cellLon + cellSize/2 });
        }
      }
    }
    if (gaps.length > 0) {
      for (const gap of gaps) {
        console.log(`[Coverage] Lücke erkannt bei ${gap.lat},${gap.lon}, lade gezielt nach...`);
        // Temporär userLat/userLon setzen und nachladen
        const oldLat = userLat;
        const oldLon = userLon;
        userLat = gap.lat;
        userLon = gap.lon;
        await loadMore('coverage-gap');
        userLat = oldLat;
        userLon = oldLon;
      }
      return true;
    }
    return false;
  }

  // Integration: Nach jedem Nachladen und bei Bewegung Coverage prüfen
  // Beispielhafte Integration in checkAndLoadMoreImages:
  async function checkAndLoadMoreImages() {
    if (!userLat || !userLon || !hasMoreImages || loading) {
      return;
    }
    
    const currentPics = get(pics);
    
    // Check coverage in all 8 directions (N, NO, O, SO, S, SW, W, NW)
    const directions = [
      { name: 'N', lat: 1, lon: 0 },   // North
      { name: 'NO', lat: 1, lon: 1 },  // Northeast
      { name: 'O', lat: 0, lon: 1 },   // East
      { name: 'SO', lat: -1, lon: 1 }, // Southeast
      { name: 'S', lat: -1, lon: 0 },  // South
      { name: 'SW', lat: -1, lon: -1 }, // Southwest
      { name: 'W', lat: 0, lon: -1 },  // West
      { name: 'NW', lat: 1, lon: -1 }  // Northwest
    ];
    
    const coverageRadius = 5000; // 5km radius
    const checkDistance = 3000; // 3km from center to check each direction
    let uncoveredDirections: string[] = [];
    
    // Check each direction for coverage
    for (const direction of directions) {
      const checkLat = userLat + (direction.lat * checkDistance / 111000); // ~111km per degree
      const checkLon = userLon + (direction.lon * checkDistance / (111000 * Math.cos(userLat * Math.PI / 180)));
      
      // Check if there are any images within coverageRadius of this check point
      const imagesInDirection = currentPics.filter((pic: any) => {
        if (!pic.lat || !pic.lon) return false;
        const distance = getDistanceInMeters(checkLat, checkLon, pic.lat, pic.lon);
        return distance <= coverageRadius;
      });
      
      if (imagesInDirection.length === 0) {
        uncoveredDirections.push(direction.name);
      }
    }
    
    // Check if we have enough nearby images at current position
    const nearbyImages = currentPics.filter((pic: any) => {
      if (!pic.lat || !pic.lon) return false;
      const distance = getDistanceInMeters(userLat as number, userLon as number, pic.lat, pic.lon);
      return distance <= 5000; // 5km radius
    });
    
    // Check coverage in wider radius for the 100-image threshold
    const widerRadiusImages = currentPics.filter((pic: any) => {
      if (!pic.lat || !pic.lon) return false;
      const distance = getDistanceInMeters(userLat as number, userLon as number, pic.lat, pic.lon);
      return distance <= 10000; // 10km radius for 100-image check
    });
    
    // Find the nearest image to check if we're too far from any cached images
    const imagesWithGPS = currentPics.filter((pic: any) => pic.lat && pic.lon);
    let nearestDistance = Infinity;
    if (imagesWithGPS.length > 0) {
      nearestDistance = Math.min(...imagesWithGPS.map((pic: any) => 
        getDistanceInMeters(userLat as number, userLon as number, pic.lat, pic.lon)
      ));
    }
    
    console.log(`[Auto-Load] Current position: ${userLat}, ${userLon}`);
    console.log(`[Auto-Load] Nearby images (5km): ${nearbyImages.length}`);
    console.log(`[Auto-Load] Images in wider radius (10km): ${widerRadiusImages.length}`);
    console.log(`[Auto-Load] Total loaded images: ${currentPics.length}`);
    console.log(`[Auto-Load] Nearest image distance: ${nearestDistance.toFixed(0)}m`);
    console.log(`[Auto-Load] Coverage check - Uncovered directions: ${uncoveredDirections.join(', ') || 'All covered'}`);
    
    // INTELLIGENTE TELEPORTATIONSERKENNUNG: Prüfe ob User außerhalb der Coverage ist
    const isOutsideCoverage = await checkIfUserOutsideCoverage(currentPics);
    if (isOutsideCoverage && currentPics.length > 0) {
      console.log(`[Auto-Load] User outside cached coverage area, reloading efficiently...`);
      // Special handling for location filters to prevent flickering
        if (hasLocationFilter) {
          console.log("[Filter Change] Location filter detected - loading smoothly without clearing gallery");
          // For location filters: load smoothly without clearing existing images
          // This prevents the flickering effect
          page = 0;
          hasMoreImages = true;
          
          // Clear global GPS data to ensure fresh sorting from new location
          if ((window as any).gpsSortedData) {
            delete (window as any).gpsSortedData;
            console.log("[Filter Change] Cleared GPS sorted data for location filter");
          }
        } else {
          // For other filters: reset gallery state immediately
          pics.set([]);
          page = 0;
          hasMoreImages = true;
        }
      page = 0;
      hasMoreImages = true;
      await loadMoreEfficiently('auto-load-outside-coverage');
      return;
    }
    
        // NEUE PRÜFUNG: Proaktives Nachladen bei weniger als 500 Bildern im Umkreis
    // Dies passiert BEVOR der Benutzer den aktuellen Radius verlässt
    if (widerRadiusImages.length < 500 && hasMoreImages) {
      console.log(`[Auto-Load] Only ${widerRadiusImages.length} images in 10km radius (< 500 threshold), proactively loading more for offline capability...`);
      await loadMore('auto-load-proactive-500-threshold');
      return;
    }

    // If we have uncovered directions, load more to fill the gaps
    if (uncoveredDirections.length > 0 && hasMoreImages) {
      console.log(`[Auto-Load] Uncovered directions detected: ${uncoveredDirections.join(', ')}, loading more to fill gaps...`);
      await loadMore('auto-load-fill-coverage-gaps');
      return;
    }
    
    // If we have less than 50 nearby images, load more
    if (nearbyImages.length < 50 && hasMoreImages) {
      console.log(`[Auto-Load] Only ${nearbyImages.length} nearby images, loading more...`);
      await loadMore('auto-load-nearby');
    }
  }

  let showScrollToTop = false;

  // Search functions
  async function performSearch(query: string = searchQuery, updateURL: boolean = false) {
    if (!query.trim()) {
      searchResults = [];
      useSearchResults = false;
      if (updateURL) {
        // Clear search from URL
        const url = new URL(window.location.href);
        url.searchParams.delete('s');
        window.history.replaceState({}, '', url.toString());
      }
      return;
    }
    
    console.log('🔍 Performing search for:', query);
    
    // Update URL if requested
    if (updateURL) {
      const url = new URL(window.location.href);
      url.searchParams.set('s', query);
      window.history.replaceState({}, '', url.toString());
    }
    
    // Only update searchQuery if it's different to prevent reactive loops
    if (searchQuery !== query) {
      console.log('🔍 Updating searchQuery from', searchQuery, 'to', query);
      searchQuery = query;
    }
    
    // Enable SearchResults component only when actually performing a search
    useSearchResults = true;
    isSearching = true;
    
    // Update placeholder with result count
    updateSearchPlaceholder();
    
    // Trigger search in SearchResults component if available
    if (searchResultsComponent && searchResultsComponent.triggerSearch) {
      console.log('🔍 Triggering search in SearchResults component');
      searchResultsComponent.triggerSearch();
    }
    
    // Reset isSearching after a short delay to allow SearchResults to complete
    setTimeout(() => {
      if (isSearching) {
        console.log('🔍 Resetting isSearching after timeout');
        isSearching = false;
      }
    }, 2000);
  }
  
  function clearSearch() {
    console.log('🔍 Clearing search...');
    searchQuery = '';
    searchResults = [];
    useSearchResults = false; // Disable SearchResults component
    isSearching = false;
    
    // Clear search from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('s');
    window.history.replaceState({}, '', url.toString());
    
    // Reset placeholder
    updateSearchPlaceholder();
    
    // Reload original gallery
    // Special handling for location filters to prevent flickering
        if (hasLocationFilter) {
          console.log("[Filter Change] Location filter detected - loading smoothly without clearing gallery");
          // For location filters: load smoothly without clearing existing images
          // This prevents the flickering effect
          page = 0;
          hasMoreImages = true;
          
          // Clear global GPS data to ensure fresh sorting from new location
          if ((window as any).gpsSortedData) {
            delete (window as any).gpsSortedData;
            console.log("[Filter Change] Cleared GPS sorted data for location filter");
          }
        } else {
          // For other filters: reset gallery state immediately
          pics.set([]);
          page = 0;
          hasMoreImages = true;
        }
    page = 0;
    hasMoreImages = true;
    
    // Clear any existing GPS sorted data to force fresh loading
    if ((window as any).gpsSortedData) {
      delete (window as any).gpsSortedData;
    }
    
    // Force gallery re-initialization
    galleryKey = Date.now();
    
    loadMore('clear search');
  }
  
  function handleSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      console.log('🔍 Search: Enter key pressed, performing search for:', searchQuery);
      performSearch(searchQuery, true); // URL aktualisieren
    }
  }
  
  function updateSearchPlaceholder() {
    if (searchInput) {
      if (searchResults.length > 0) {
        searchInput.placeholder = `${searchResults.length} Ergebnis${searchResults.length !== 1 ? 'se' : ''} gefunden`;
      } else if (searchQuery.trim()) {
        searchInput.placeholder = 'Keine Ergebnisse gefunden';
      } else {
        searchInput.placeholder = '';
      }
    }
  }

  function toggleSearchField() {
    showSearchField = !showSearchField;
    // Save state to localStorage
    localStorage.setItem('showSearchField', showSearchField.toString());
    
    // If switching to search field, focus input after short delay
    if (showSearchField) {
      setTimeout(() => {
        if (searchInput) {
          searchInput.focus();
        }
      }, 100);
    } else {
      // If hiding search field, only clear search if there's an active search
      if (searchQuery.trim() || searchResults.length > 0) {
      clearSearch();
      }
    }
  }

  // Helper to exit simulation across frames
  function exitSimulation() {
    if (typeof window !== 'undefined') {
      if (window.top && window.top !== window) {
        window.top.location.href = '/?stop=simulation';
      } else {
        window.location.href = '/?stop=simulation';
      }
    }
  }

  let showImpressum = false;
  let showDatenschutz = false;

 
</script>

<FilterBar
  {userLat}
  {userLon}
  {showDistance}
  {isLoggedIn}
  gpsStatus={gpsStatus}
  lastGPSUpdateTime={lastGPSUpdateTime}
  isManual3x3Mode={isManual3x3Mode}
  on:toggle3x3Mode={toggle3x3Mode}
/>

<!-- Dialoge für Upload und EXIF Upload -->
<UploadDialog
  show={showUploadDialog}
  on:close={() => showUploadDialog = false}
  on:uploaded={() => { /* Optional: Galerie neu laden */ }}
  on:deletedAll={() => { /* Optional: Galerie neu laden */ }}
/>

<!-- Search Bar oder Culoca Logo -->
<SearchBar
  searchQuery={searchQuery}
  isSearching={isSearching}
  searchResults={searchResults}
  showSearchField={showSearchField}
  onSearch={performSearch}
  onInput={q => { searchQuery = q; performSearch(q, false); }}
  onToggleSearchField={toggleSearchField}
/>

<!-- NewsFlash Component -->
{#if isLoggedIn && newsFlashMode !== 'aus'}
    <NewsFlash 
    mode={newsFlashMode}
      userId={currentUser?.id}
    layout={useJustifiedLayout ? 'justified' : 'grid'}
    limit={15}
    showToggles={false}
    showDistance={showDistance}
    userLat={userLat}
    userLon={userLon}
    getDistanceFromLatLonInMeters={getDistanceFromLatLonInMeters}
      {displayedImageCount}
  />
{/if}

<!-- Welcome Section -->
<WelcomeSection />

<!-- Autoguide Bar -->
{#if isLoggedIn && autoguide}
  <div class="autoguide-bar {audioActivated ? 'audio-active' : 'audio-inactive'}">
    <div class="autoguide-content">
      <div class="autoguide-text">
        {currentImageTitle || (audioActivated ? 'Bildtitel werden vorgelesen' : 'Audio deaktiviert - Klicke auf den Lautsprecher')}
      </div>
      <button class="speaker-btn" on:click={() => {
        if (audioActivated) {
          speechSynthesis?.cancel();
          audioActivated = false;
        } else {
          activateAudioGuide();
          setTimeout(() => { announceFirstImage(); }, 1500);
        }
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
        </svg>
      </button>
    </div>
  </div>
    {/if}

    <!-- Floating Action Buttons -->
    <FloatingActionButtons 
    {showScrollToTop}
    showTestMode={true}
    showMapButton={$pics.some(pic => pic.lat && pic.lon)}
      {isLoggedIn}
      {simulationMode}
        {profileAvatar}
        {settingsIconRotation}
        {continuousRotation}
        {rotationSpeed}
    on:upload={() => isLoggedIn ? location.href = '/bulk-upload' : showLoginOverlay = true}
    on:publicContent={() => showPublicContentModal.set(true)}
    on:bulkUpload={() => isLoggedIn ? location.href = '/bulk-upload' : showLoginOverlay = true}
    on:profile={() => isLoggedIn ? location.href = '/profile' : showLoginOverlay = true}
    on:settings={() => isLoggedIn ? location.href = '/settings' : showLoginOverlay = true}
    on:map={() => showFullscreenMap = true}
    on:testMode={() => {
      if (simulationMode) {
        exitSimulation();
      } else {
        // Enter simulation mode
        location.href = '/simulation';
      }
    }}
  />
  <TrackModal bind:isOpen={showTrackModal} />



<!-- Galerie oder Suchergebnisse -->
<div class="gallery-container">


  {#if useSearchResults && searchQuery.trim()}
    <!-- Use SearchResults component with items_search_view -->
    <SearchResults 
      bind:this={searchResultsComponent}
      {searchQuery}
      userId={currentUser?.id || ''}
      layout={useJustifiedLayout ? 'justified' : 'grid'}
      showDistance={showDistance}
      userLat={userLat}
      userLon={userLon}
      getDistanceFromLatLonInMeters={getDistanceFromLatLonInMeters}
      onSearchComplete={() => {
        console.log('🔍 Search completed, resetting isSearching');
        isSearching = false;
      }}
    />
  {:else}
    <!-- Normal gallery -->
    <GalleryLayout
      items={$pics}
      layout={useJustifiedLayout ? 'justified' : 'grid'}
      gap={2}
      targetRowHeight={220}
      showDistance={showDistance}
      showCompass={showCompass}
      userLat={$filterStore.locationFilter?.lat || $filterStore.lastGpsPosition?.lat || userLat}
      userLon={$filterStore.locationFilter?.lon || $filterStore.lastGpsPosition?.lon || userLon}
      getDistanceFromLatLonInMeters={getDistanceFromLatLonInMeters}
      />

  <!-- Mobile-Modus Erklärung - immer unterhalb der Galerie sichtbar -->
  <div class="mobile-mode-explanation">
    <div class="explanation-content">
      <h3>Mobile Galerie</h3>
      <p>Zeigt dir nur Bilder in einem 10 × 10‑Kilometer‑Quadrat – mindestens 5 km rund um deinen aktuellen Standort, selbst wenn du dich bewegst. Bilder außerhalb deiner Planquadrate werden verworfen und neue werden bei erreichen eines neuen Quadranten hinzugefügt.</p>
      
      <h4>Normale Galerie</h4>
      <p>Wechsle in den Endlos‑Modus und scrolle, bis der Daumen glüht: Die App lädt fortlaufend 100er‑Pakete an Bildern sortiert nach Entfernung zu deinem Standort, bis wirklich alles gezeigt wurde. Default beim starten der App, Wechsel durch klick auf die GPS Koordinaten.</p>
      
      <h4>Location Filter</h4>
      <p>Tippe auf ein Bild, um einen entfernten Spot zu wählen. Mit dem Culoca‑Marker setzt du ihn als neues Zentrum deiner Suche – perfekt, um schon mal eine fremde Region zu erkunden.</p>
        </div>
        </div>

        {/if}
  

  
  {#if loading}
    <div class="loading-indicator">
      <div class="spinner"></div>
          </div>
  {:else if $pics.length > 0}
    <div class="end-indicator">
      <span>✅ {displayedImageCount} Bilder angezeigt</span>
          </div>
  {/if}
  


  <!-- Einfacher Textblock für leere Regionen -->
  {#if showNoItemsMessage}
    <div class="simple-empty-message">
      <p>Noch keine Bilder in dieser Region erfasst. Lade deine eigenen Fotos mit GPS-Daten hoch und werde der erste, der diese Region auf Culoca präsentiert.</p>
    </div>
  {/if}

  
</div>

<style>


  /* Drag & Drop Zone */
  .drop-zone {
    position: relative;
    border: 2px dashed var(--border-color);
    border-radius: 12px;
    padding: 3rem 2rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s ease;
    background: var(--bg-tertiary);
    margin-bottom: 1rem;
  }

  .drop-zone:hover {
    border-color: var(--accent-color);
    background: var(--border-color);
  }

  .drop-zone.drag-over {
    border-color: var(--accent-hover);
    background: var(--border-color);
    transform: scale(1.02);
    box-shadow: 0 4px 20px var(--shadow);
  }

  .drop-zone.uploading {
    border-color: var(--success-color);
    background: var(--bg-secondary);
    cursor: not-allowed;
  }

  .drop-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    pointer-events: none;
  }

  .upload-icon {
    color: #666;
    transition: color 0.3s ease;
  }

  .drop-zone:hover .upload-icon {
    color: #0066cc;
  }

  .drop-zone.drag-over .upload-icon {
    color: #0099ff;
  }

  .drop-zone.uploading .upload-icon {
    color: #28a745;
  }

  .drop-content h3 {
    margin: 0;
    font-size: 1.2rem;
    color: var(--text-primary);
    font-weight: 600;
  }

  .drop-content p {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .link-text {
    color: #0066cc;
    text-decoration: underline;
    font-weight: 500;
  }

  .drop-content small {
    color: #666;
    font-size: 0.8rem;
  }

  .file-input {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }

  .file-input:disabled {
    cursor: not-allowed;
  }

  /* Upload Actions */
  .upload-actions {
    display: flex;
    gap: 1rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .upload-btn {
    flex: 1;
    min-width: 200px;
    padding: 0.75rem 1rem;
    background: var(--accent-color);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    font-size: 0.9rem;
    transition: background-color 0.2s ease;
  }

  .upload-btn:hover:not(:disabled) {
    background: var(--accent-hover);
  }

  .upload-btn:disabled {
    background: #666;
    cursor: not-allowed;
  }

  .delete-all-btn {
    background: #dc3545 !important;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    transition: background-color 0.2s ease;
  }

  .delete-all-btn:hover:not(:disabled) {
    background: #c82333 !important;
  }

  .delete-all-btn:disabled {
    background: #999 !important;
    cursor: not-allowed;
  }

  .debug-btn {
    background: #ff6b35;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    font-size: 0.8rem;
    transition: background-color 0.2s ease;
  }

  .debug-btn:hover:not(:disabled) {
    background: #e55a2b;
  }

  .debug-btn:disabled {
    background: #999;
    cursor: not-allowed;
  }

  .upload-message {
    margin-top: 1rem;
    padding: 0.75rem;
    border-radius: 4px;
    font-weight: 500;
  }

  .upload-message.success {
    background: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
  }

  .upload-message.error {
    background: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
  }

  /* Upload Progress */
  .upload-progress {
    margin-top: 1rem;
    padding: 1rem;
    background: #f0f8ff;
    border-radius: 6px;
    border: 1px solid #b8daff;
  }

  .progress-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
  }

  .current-file {
    color: #0066cc;
    font-weight: 500;
    max-width: 60%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .progress-percent {
    color: #333;
    font-weight: 600;
  }

  .progress-bar {
    width: 100%;
    height: 8px;
    background: #e9ecef;
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #0066cc, #0099ff);
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  /* Upload Previews */
  .upload-previews {
    margin-top: 1rem;
    padding: 1rem;
    background: #f8f9fa;
    border-radius: 6px;
    border: 1px solid #dee2e6;
  }

  .upload-previews h4 {
    margin: 0 0 1rem 0;
    color: #495057;
    font-size: 0.9rem;
    font-weight: 600;
  }

  .preview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 0.5rem;
    max-height: 200px;
    overflow-y: auto;
  }

  .preview-item {
    aspect-ratio: 1;
    border-radius: 4px;
    overflow: hidden;
    background: #e9ecef;
    border: 2px solid transparent;
    transition: border-color 0.2s ease;
  }

  .preview-item:hover {
    border-color: #0066cc;
  }

  .preview-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .upload-form {
      flex-direction: column;
      align-items: stretch;
    }

    .upload-form input[type="file"] {
      min-width: unset;
      margin-bottom: 0.5rem;
    }

    .preview-grid {
      grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
    }

    .progress-info {
      flex-direction: column;
      align-items: stretch;
      gap: 0.25rem;
    }

    .current-file {
      max-width: 100%;
    }
  }

  /* Gallery Styles */
  .gallery-container {
    width: 100%;
    margin: 0;
    padding: 0;
    background: var(--bg-primary);
    border: none;
    box-shadow: none;
  }





  .grid-layout {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(256px, 1fr));
    gap: 2px;
    width: 100%;
    margin: 0 auto;
    /* padding: 1rem 0 2rem 0; */
    padding: 0;
    background: var(--bg-primary);
    border: none;
    box-shadow: none;
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
    background: var(--bg-secondary);
    border-radius: 0;
    overflow: hidden;
    /* box-shadow: 0 2px 8px rgba(0,0,0,0.10); */
    transition: box-shadow 0.2s, transform 0.2s, background-color 0.3s ease;
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
  .grid-item:hover {
    /* Kein box-shadow oder transform auf dem Container */
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



  /* Dialog Styles */
  .dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(4px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .dialog-content {
    background: var(--bg-secondary);
    border-radius: 12px;
    max-width: 600px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 40px var(--shadow);
    border: 1px solid var(--border-color);
  }

  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .dialog-header h2 {
    margin: 0;
    color: var(--text-primary);
    font-size: 1.5rem;
    font-weight: 600;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 2rem;
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  /* EXIF Upload Styles */
  .exif-upload-section {
    padding: 1.5rem;
  }

  .exif-description {
    color: var(--text-secondary);
    margin: 0 0 1.5rem 0;
    line-height: 1.5;
  }

  .file-input-section {
    margin-bottom: 1.5rem;
  }

  .exif-file-input {
    display: none;
  }

  .exif-file-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    background: var(--bg-tertiary);
    border: 2px dashed var(--accent-color);
    border-radius: 8px;
    cursor: pointer;
    color: var(--text-secondary);
    transition: all 0.2s ease;
    font-weight: 500;
  }

  .exif-file-label:hover {
    background: var(--border-color);
    border-color: var(--accent-hover);
    color: var(--text-primary);
  }

  .exif-file-label svg {
    color: var(--accent-color);
  }

  .selected-files {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: var(--bg-tertiary);
    border-radius: 8px;
  }

  .selected-files h4 {
    margin: 0 0 0.75rem 0;
    color: var(--text-primary);
    font-size: 1rem;
  }

  .selected-files ul {
    margin: 0;
    padding-left: 1.5rem;
    color: var(--text-secondary);
  }

  .selected-files li {
    margin-bottom: 0.25rem;
  }

  .exif-actions {
    display: flex;
    justify-content: flex-end;
  }

  .exif-upload-btn {
    background: #ff9800;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    transition: background-color 0.2s ease;
  }

  .exif-upload-btn:hover:not(:disabled) {
    background: #e65100;
  }

  .exif-upload-btn:disabled {
    background: #666;
    cursor: not-allowed;
  }

  .exif-message {
    margin-top: 1rem;
    padding: 0.75rem;
    border-radius: 4px;
    font-weight: 500;
  }

  .exif-message.success {
    background: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
  }

  .exif-message.error {
    background: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
  }

  /* Responsive Dialog */
  @media (max-width: 768px) {
    .dialog-content {
      max-width: 95vw;
      margin: 0.5rem;
    }
    
    .dialog-header {
      padding: 1rem;
    }
    
    .dialog-header h2 {
      font-size: 1.25rem;
    }
    
    .exif-upload-section {
      padding: 1rem;
    }
  }

  /* Search Container */
  .search-container {
    position: fixed;
    bottom: 1.8rem;
    left: 1.8rem;
    right: auto;
    z-index: 50;
    max-width: 300px;
    width: 15.8rem;
  }

  .search-box {
    position: relative;
    display: flex;
    align-items: center;
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: 50px;
    padding: 0.5rem 0.75rem;
    box-shadow: 0 4px 20px var(--shadow);
    transition: all 0.3s ease;
  }

  .search-box:focus-within {
    border-color: var(--accent-color);
    box-shadow: 0 4px 25px var(--shadow);
  }

  .culoca-icon {
    color: #ee7221;
    margin-right: 0.75rem;
    flex-shrink: 0;
    cursor: pointer;
    transition: color 0.2s ease;
  }

  .culoca-icon:hover {
    color: #d55a1a;
  }

  .search-input {
    flex: 1;
  background: transparent;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-size: 0.9rem;
    font-weight: 500;
    padding: 0;
  }

  .search-input::placeholder {
    color: var(--text-secondary);
  }

  .search-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .clear-search-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 50%;
    transition: all 0.2s ease;
  margin-left: 0.2rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .clear-search-btn:hover:not(:disabled) {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .clear-search-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .search-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--border-color);
    border-top: 2px solid var(--accent-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-left: 0.5rem;
  }

  .search-results-info {
    margin-top: 0.5rem;
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.9rem;
    font-weight: 500;
    background: var(--bg-secondary);
    padding: 0.5rem 1rem;
    border-radius: 20px;
    border: 1px solid var(--border-color);
  }

  /* Culoca Logo */
  .culoca-logo {
    position: fixed;
    bottom: 1.8rem;
    left: 1.8rem;
    right: auto;
    z-index: 50;
    width: 15rem;
    transition: opacity 0.2s ease;
    object-fit: contain;
  }
  .culoca-logo:hover {
    opacity: 1;
  }

  .culoca-logo.clickable {
    cursor: pointer;
    transition: opacity 0.2s ease;
  }

  .culoca-logo.clickable:hover {
    opacity: 0.8;
  }

  @media (max-width: 600px) {
    .search-container {
      max-width: 250px;
    }
  }
  .distance-label {
    font-size: 0.7rem;
    font-weight: 500;
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  }

  /* Autoguide Bar */
  .autoguide-bar {
    position: static;
    color: white;
    padding: 0.75rem 1rem;
    box-shadow: 0 2px 10px var(--shadow);
    animation: slideDown 0.3s ease-out;
    border-bottom: 2px solid var(--bg-primary);
  }

  .autoguide-bar.audio-active {
    background: linear-gradient(135deg, var(--accent-color), var(--accent-hover));
  }

  .autoguide-bar.audio-inactive {
    background: #4b5563;
  }

  .autoguide-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    max-width: 800px;
    margin: 0 auto;
  }

  .autoguide-logo {
    width: 32px;
    height: 32px;
    object-fit: contain;
    filter: brightness(0) invert(1); /* Make logo white */
  }

  .autoguide-text {
    font-weight: 600;
    font-size: 1rem;
    text-align: center;
  }

  .speaker-btn {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
    transition: background-color 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .speaker-btn:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .speaker-btn:active {
    background-color: rgba(255, 255, 255, 0.2);
  }

  @keyframes slideDown {
    from {
      transform: translateY(-100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @media (max-width: 600px) {
    .autoguide-bar {
      padding: 0.5rem 0.75rem;
    }
    
    .autoguide-text {
      font-size: 0.9rem;
    }
  }

  /* End indicator */
  .end-indicator {
    text-align: center;
    padding: 20px;
    color: var(--text-secondary);
    font-size: 14px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .impressum-link, .datenschutz-link {
    position: fixed;
    bottom: 0.3rem;
    font-size: 0.95rem;
    color: #ffffff;
  }
  
  .impressum-link {
    left: 2.7rem;
  }
  
  .datenschutz-link {
    left: 11.2rem;
  }
  .impressum-link:hover, .datenschutz-link:hover {
    opacity: 1;
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }
  

  
  @media (max-width: 600px) {

  .map-nav-btn, .dismiss-btn, .search-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 600;
    transition: all 0.2s ease;
  }

  .map-nav-btn {
    background: var(--accent-color);
    color: white;
  }

  .map-nav-btn:hover {
    background: var(--accent-hover);
    transform: translateY(-1px);
  }

  .dismiss-btn {
    background: var(--bg-primary);
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
  }

  .dismiss-btn:hover {
    background: var(--border-color);
    color: var(--text-primary);
  }

  .search-btn {
    background: #0066cc;
    color: white;
  }

  .search-btn:hover {
    background: #0052a3;
    transform: translateY(-1px);
  }

  .no-items-benefits {
    display: flex;
    gap: 1rem;
    margin: 1rem 0;
    flex-wrap: wrap;
    justify-content: center;
  }

  .benefit-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--bg-secondary);
    border-radius: 12px;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .benefit-icon {
    font-size: 1.2rem;
  }

  .upload-cta-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1rem 2rem;
    background: linear-gradient(135deg, var(--culoca-orange), #ff8c42);
    color: white;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    font-size: 1.1rem;
    font-weight: 700;
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(238, 114, 33, 0.3);
  }

  .upload-cta-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(238, 114, 33, 0.4);
  }

  .login-hint {
    font-style: italic;
    color: var(--text-secondary);
    text-align: center;
    margin: 0.5rem 0;
  }

  .no-items-note {
    margin-top: 1.5rem;
    font-size: 0.9rem;
    color: var(--text-secondary);
    text-align: center;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
  }

  @media (max-width: 768px) {
    .no-items-content {
      padding: 1.5rem;
      margin: 1rem;
    }

    .no-items-actions {
      flex-direction: column;
    }

    .no-items-benefits {
      flex-direction: column;
      gap: 0.5rem;
    }

    .benefit-item {
      justify-content: center;
    }
  }
  

  }

  /* Region nicht abgedeckt Meldung */
  .no-items-message {
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

  .no-items-content {
    background: var(--card-bg);
    color: var(--text-primary);
    padding: 2rem;
    border-radius: 16px;
    max-width: 500px;
    margin: 1rem;
    text-align: center;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    border: 1px solid var(--border-color);
  }

  .no-items-content h2 {
    margin: 0 0 1rem 0;
    font-size: 1.5rem;
    color: var(--accent-color);
  }

  .no-items-content p {
    margin: 0.5rem 0;
    line-height: 1.5;
    color: var(--text-secondary);
  }

  .no-items-content p strong {
    color: var(--text-primary);
  }

  .no-items-actions {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .upload-btn {
    background: var(--accent-color);
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.2s ease;
  }

  .upload-btn:hover {
    background: var(--accent-hover);
    transform: translateY(-1px);
  }

  .dismiss-btn {
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.2s ease;
  }

  .dismiss-btn:hover {
    background: var(--card-bg-secondary);
    color: var(--text-primary);
  }

  /* Einfacher Textblock für leere Regionen */
  .simple-empty-message {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary);
    font-size: 0.9rem;
    line-height: 1.5;
    max-width: 600px;
    margin: 0 auto;
  }

  .simple-empty-message p {
    margin: 0;
  }

  /* Bewegungsmodus Status-Nachricht */
  .mode-status-overlay {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10000;
    pointer-events: none;
  }

  .mode-status-message {
    background: var(--bg-secondary);
    color: var(--text-primary);
    padding: 12px 20px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    box-shadow: 0 4px 16px var(--shadow);
    font-size: 14px;
    font-weight: 500;
    text-align: center;
    white-space: nowrap;
  }
</style>

<!-- Fullscreen Map -->
{#if showFullscreenMap}
  <FullscreenMap 
    images={$pics}
    {userLat}
    {userLon}
    {deviceHeading}
    on:close={() => showFullscreenMap = false}
    on:imageClick={(event) => {
      showFullscreenMap = false;
      // Navigate to item detail page with anchor parameter
      const url = new URL(`/item/${event.detail.imageId}`, window.location.origin);
      url.searchParams.set('anchor', event.detail.imageId);
      location.href = url.toString();
    }}
    on:locationSelected={(event) => setLocationFromMap(event.detail.lat, event.detail.lon)}
  />
{/if}

<!-- Impressum-Link links unten -->
<a class="impressum-link" href="/impressum" target="_blank" rel="noopener">Impressum</a>
<a class="datenschutz-link" href="/datenschutz" target="_blank" rel="noopener">Datenschutz</a>

<!-- Bewegungsmodus Status-Nachricht -->
<StatusOverlay visible={modeStatusVisible} message={modeStatusMessage} />
<!-- 3x3 Modus Status-Nachricht -->
<StatusOverlay visible={mode3x3StatusVisible} message={mode3x3StatusMessage} />

{#if showLoginOverlay}
  <LoginOverlay
    show={true}
    isLoggedIn={isLoggedIn}
    authChecked={authChecked}
    bind:loginEmail
    bind:loginPassword
    bind:loginLoading
    bind:loginError
    bind:loginInfo
    bind:showRegister
    onClose={closeLoginOverlay}
    loginWithProvider={loginWithProvider}
    loginWithEmail={loginWithEmail}
    signupWithEmail={signupWithEmail}
    resetPassword={resetPassword}
    setAnonymousMode={setAnonymousMode}
  />
{/if}