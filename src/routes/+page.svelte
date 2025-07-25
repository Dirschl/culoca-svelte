<svelte:head>
  <title>Culoca – See You Local | Fotos, Events & Anzeigen mit GPS entdecken</title>
  <meta name="description" content="Entdecke und teile Fotos, Firmen, Events und Anzeigen – alles mit präzisen GPS-Daten. Starte deine kostenlose Galerie auf Culoca." />
  <meta name="robots" content="index, follow" />
  <meta name="author" content="DIRSCHL.com GmbH" />
  <link rel="canonical" href="https://culoca.com/" />
  <!-- Open Graph Meta-Tags -->
  <meta property="og:locale" content="de_DE" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Culoca – See You Local | Entdecke deine Umgebung" />
  <meta property="og:description" content="Fotos, Firmen, Events & Anzeigen mit GPS-Daten – jetzt aus deiner Region entdecken." />
  <meta property="og:url" content="https://culoca.com/" />
  <meta property="og:site_name" content="Culoca" />
  <meta property="og:image" content="https://culoca.com/culoca-see-you-local-entdecke-deine-umgebung.jpg" />
  <meta property="og:image:alt" content="Culoca Logo – See You Local" />
  <!-- Twitter Card Meta-Tags -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Culoca – See You Local | Entdecke deine Umgebung" />
  <meta name="twitter:description" content="Fotos, Firmen, Events & Anzeigen mit GPS-Daten – jetzt lokal entdecken." />
  <meta name="twitter:image" content="https://culoca.com/culoca-see-you-local-entdecke-deine-umgebung.jpg" />
</svelte:head>
<script lang="ts">
  import { onMount } from 'svelte';
  import FilterBar from '$lib/FilterBar.svelte';
  import NewsFlash from '$lib/NewsFlash.svelte';
  import WelcomeSection from '$lib/WelcomeSection.svelte';
  import FloatingActionButtons from '$lib/FloatingActionButtons.svelte';
  import SearchBar from '$lib/SearchBar.svelte';
  import StatusOverlay from '$lib/StatusOverlay.svelte';
  import NormalGallery from '$lib/NormalGallery.svelte';
  import MobileGallery from '$lib/MobileGallery.svelte';
  import LoginOverlay from '$lib/LoginOverlay.svelte';
  import FullscreenMap from '$lib/FullscreenMap.svelte';
  import { searchQuery, isSearching, useSearchResults, performSearch, clearSearch, setSearchQuery } from '$lib/searchStore';
  import { sessionStore } from '$lib/sessionStore';
  import { filterStore } from '$lib/filterStore';
  import { page as pageStore } from '$app/stores';
  import { galleryStats } from '$lib/galleryStats';
  import { dynamicImageLoader } from '$lib/dynamicImageLoader';
  import { loadMoreGallery, galleryItems, resetGallery, useJustifiedLayout, toggleLayout } from '$lib/galleryStore';
  import { browser } from '$app/environment';
  import { getEffectiveGpsPosition } from '$lib/filterStore';
  import { supabase } from '$lib/supabaseClient';

  // Globale States für Umschaltung, Overlay, etc.
  let showLoginOverlay = false;
  let showFullscreenMap = false;
  let isManual3x3Mode = false;
  let userLat: number | null = null;
  let userLon: number | null = null;
  let showDistance = true;
  let showCompass = false;
  let isLoggedIn = false;
  let newsFlashMode: 'alle' | 'eigene' | 'aus' = 'alle';
  let profileAvatar: string | null = null;
  let deviceHeading = null;
  let authChecked = false;
  let showScrollToTop = false;
  let simulationMode = false;
  let isInIframe = false;
  let gpsStatus: 'active' | 'cached' | 'none' | 'checking' | 'denied' | 'unavailable' = 'none';
  let lastGPSUpdateTime: number | null = null;
  let settingsIconRotation = 0;
  let continuousRotation = 0;
  let rotationSpeed = 1;
  let rotationInterval: any = null;
  let showStatusOverlay = false;
  let statusOverlayMessage = '';
  let lastLoadedLat: number | null = null;
  let lastLoadedLon: number | null = null;
  let lastLoadedSource: string | null = null;
  let galleryLoadPending = false;
  let gpsWatchId: number | null = null;
  
  // Ursprüngliche GPS-Koordinaten für Normal Mode (werden nur einmal gesetzt)
  let originalGalleryLat: number | null = null;
  let originalGalleryLon: number | null = null;

  // Debug-Variable für die aktuelle API-URL
  let lastApiUrl = '';

  // Anonyme User bekommen justified Layout als Default
  $: if (browser && !isLoggedIn) {
    // Setze Default nur wenn noch nicht gesetzt
    const stored = localStorage.getItem('useJustifiedLayout');
    if (stored === null) {
      useJustifiedLayout.set(true);
    }
  }

  // Funktion zum Laden des User-Avatars
  async function loadUserAvatar() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        profileAvatar = null;
        return;
      }
      
      // Fetch profile from profiles table (not public_profiles)
      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single();
        
      if (data && data.avatar_url) {
        if (data.avatar_url.startsWith('http')) {
          profileAvatar = data.avatar_url;
          console.log('[Avatar] Loaded external avatar:', data.avatar_url);
        } else {
          profileAvatar = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/avatars/${data.avatar_url}`;
          console.log('[Avatar] Loaded Supabase storage avatar:', profileAvatar);
        }
      } else {
        // Fallback: Versuche Avatar aus user_metadata zu laden
        const avatarUrl = user.user_metadata?.avatar_url || 
                         user.user_metadata?.picture ||
                         user.user_metadata?.image ||
                         null;
        
        if (avatarUrl) {
          profileAvatar = avatarUrl;
          console.log('[Avatar] Loaded from user metadata:', avatarUrl);
        } else {
          // Fallback: Verwende Initialen oder Standard-Avatar
          const email = user.email;
          const name = user.user_metadata?.full_name || 
                      user.user_metadata?.name || 
                      email?.split('@')[0] || 
                      'User';
          
          // Erstelle einen generischen Avatar mit Initialen
          const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
          profileAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ee7221&color=fff&size=128`;
          console.log('[Avatar] Created generic avatar for:', name);
        }
      }
    } catch (error) {
      console.error('[Avatar] Error loading user avatar:', error);
      profileAvatar = null;
    }
  }

  function buildGalleryApiUrl() {
    if (!browser) return '';
    const gps = getEffectiveGpsPosition();
    const url = new URL('/api/items', window.location.origin);
    url.searchParams.set('offset', '0');
    url.searchParams.set('limit', '100');
    if (gps && gps.lat !== undefined && gps.lon !== undefined) {
      url.searchParams.set('lat', String(gps.lat));
      url.searchParams.set('lon', String(gps.lon));
    }
    return url.toString();
  }

  $: lastApiUrl = buildGalleryApiUrl();

  $: isLoggedIn = $sessionStore.isAuthenticated;
  $: simulationMode = $pageStore.url.pathname.startsWith('/simulation');

  // Lade Avatar wenn Login-Status sich ändert
  $: if (isLoggedIn && !profileAvatar) {
    loadUserAvatar();
  }

  // Setze anonyme User Defaults wenn Login-Status sich ändert
  $: if (browser) {
    setAnonymousUserDefaults();
  }

  // Kontinuierliche Rotation im 3x3-Modus
  $: if (isManual3x3Mode) {
    // Starte kontinuierliche Rotation
    if (rotationInterval) clearInterval(rotationInterval);
    rotationInterval = setInterval(() => {
      continuousRotation += rotationSpeed;
      if (continuousRotation >= 360) continuousRotation = 0;
    }, 50);
  } else {
    // Stoppe kontinuierliche Rotation
    if (rotationInterval) {
      clearInterval(rotationInterval);
      rotationInterval = null;
    }
    continuousRotation = 0;
  }

  // Initiale Galerie-Initialisierung
  let galleryInitialized = false;
  
  // Setze Default-Settings für anonyme User
  function setAnonymousUserDefaults() {
    if (browser && !isLoggedIn) {
      // Setze NewsFlash auf 'alle' für anonyme User wenn nicht bereits gesetzt
      if (!localStorage.getItem('newsFlashMode')) {
        localStorage.setItem('newsFlashMode', 'alle');
        newsFlashMode = 'alle';
      }
      
      // WelcomeVisible ist bereits standardmäßig auf true gesetzt
      // Dark Mode wird bereits in darkMode.ts auf true gesetzt
      
      console.log('[Anonymous] Set default settings:', { newsFlashMode, darkMode: true, welcomeVisible: true });
    }
  }
  
  onMount(() => {
    // Initialize filter store from URL parameters
    filterStore.initFromUrl($pageStore.url.searchParams);
    console.log('[onMount] Initialized filterStore from URL parameters');
    
    const onScroll = () => {
      showScrollToTop = window.scrollY > 200;
    };
    window.addEventListener('scroll', onScroll);
    isInIframe = window.self !== window.top;
    
    // Event-Listener für FilterBar Events
    window.addEventListener('toggle3x3Mode', handleToggle3x3Mode);
    window.addEventListener('openMap', handleOpenMap);
    
    // GPS-Simulation Message-Listener
    const handleGPSSimulation = (event: MessageEvent) => {
      if (event.data && event.data.type === 'gps-simulation') {
        console.log('[GPS-Simulation] Received GPS data from simulation:', event.data);
        
        // Setze simulierte GPS-Daten als echte GPS-Position
        userLat = event.data.lat;
        userLon = event.data.lon;
        gpsStatus = 'active';
        lastGPSUpdateTime = Date.now();
        
        console.log('[GPS-Simulation] Updated GPS position:', { userLat, userLon });
        
        // Trigger GPS-basierte Sortierung und Galerie-Updates
        if (galleryInitialized) {
          // Debounce auch für Simulation
          if (gpsUpdateTimeout) {
            clearTimeout(gpsUpdateTimeout);
          }
          
          gpsUpdateTimeout = setTimeout(() => {
            lastLoadedLat = userLat;
            lastLoadedLon = userLon;
            lastLoadedSource = 'simulation';
            
            if (isManual3x3Mode) {
              // Mobile Mode: Nur clientseitige Sortierung
              console.log('[GPS-Simulation] Mobile Mode: Triggering client-side sort only');
            } else {
              // Normal Mode: Reset Galerie mit neuen GPS-Daten
              resetGallery({ lat: userLat!, lon: userLon! });
              console.log('[GPS-Simulation] Normal Mode: Reset gallery with simulated GPS');
            }
            
            // Clientseitige Sortierung für bereits geladene Items
            // updateGPSPosition(userLat!, userLon!); // Entfernt
            console.log('[GPS-Simulation] Updated GPS position for client-side sorting');
          }, 100); // Kürzerer Debounce für Simulation
        }
      } else if (event.data && event.data.type === 'gps-simulation-stop') {
        console.log('[GPS-Simulation] Received stop signal from simulation');
        
        // Simulation gestoppt - zurück zu echtem GPS oder keine GPS-Daten
        userLat = null;
        userLon = null;
        gpsStatus = 'none';
        lastGPSUpdateTime = null;
        
        console.log('[GPS-Simulation] Cleared simulated GPS data');
        
        // Versuche echtes GPS zu reaktivieren falls verfügbar
        if (navigator.geolocation) {
          initializeGPSIntelligently();
        }
      }
    };
    
    window.addEventListener('message', handleGPSSimulation);
    
    // Intelligente GPS-Initialisierung
    initializeGPSIntelligently();
    
    // Setze Default-Settings für anonyme User
    setAnonymousUserDefaults();
    
    // Lade NewsFlash-Modus aus localStorage
    if (browser) {
      const storedNewsFlash = localStorage.getItem('newsFlashMode');
      if (storedNewsFlash === 'aus' || storedNewsFlash === 'eigene' || storedNewsFlash === 'alle') {
        newsFlashMode = storedNewsFlash;
      }
    }
    
    // Galerie intelligenter initialisieren - warte kurz auf GPS falls Permission bereits erteilt
    const initializeGalleryIntelligently = async () => {
      if (!galleryInitialized) {
        galleryInitialized = true;
        
        // Prüfe ob GPS-Permission bereits erteilt ist
        let shouldWaitForGPS = false;
        if ('permissions' in navigator) {
          try {
            const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
            shouldWaitForGPS = permissionStatus.state === 'granted';
            console.log('[Gallery-Init] GPS permission status:', permissionStatus.state, 'shouldWait:', shouldWaitForGPS);
          } catch (e) {
            console.log('[Gallery-Init] Permission check failed, proceeding immediately');
          }
        }
        
        // Wenn GPS-Permission erteilt ist, warte kurz auf GPS-Daten
        if (shouldWaitForGPS && !userLat && !userLon) {
          console.log('[Gallery-Init] Waiting briefly for GPS data...');
          await new Promise(resolve => setTimeout(resolve, 300)); // 300ms warten auf GPS
        }
        
        const gps = getEffectiveGpsPosition();
        
        // Prüfe Querystring für Suchparameter
        const urlParams = new URLSearchParams(window.location.search);
        const searchParam = urlParams.get('s');
        
        console.log('[Gallery-Init] Initialisiere Galerie mit GPS:', gps);
        console.log('[Gallery-Init] UserLat/Lon:', userLat, userLon);
        console.log('[Gallery-Init] Search param from URL:', searchParam);
        
        // Verwende GPS von getEffectiveGpsPosition oder fallback auf userLat/userLon
        const effectiveLat = gps?.lat || userLat || undefined;
        const effectiveLon = gps?.lon || userLon || undefined;
        
        console.log('[Gallery-Init] Effective GPS:', effectiveLat, effectiveLon);
        
        // Setze lastLoaded-Werte um doppelte GPS-Trigger zu vermeiden
        if (effectiveLat && effectiveLon) {
          lastLoadedLat = effectiveLat;
          lastLoadedLon = effectiveLon;
          lastLoadedSource = gps?.source || 'direct';
          
          // Setze ursprüngliche Galerie-Koordinaten für Normal Mode (nur einmal)
          if (originalGalleryLat === null && originalGalleryLon === null) {
            originalGalleryLat = effectiveLat;
            originalGalleryLon = effectiveLon;
            console.log('[Gallery-Init] Set original gallery coordinates:', { originalGalleryLat, originalGalleryLon });
          }
        }
        
        const galleryParams: any = {
          lat: effectiveLat,
          lon: effectiveLon
        };
        
        // Füge Suchparameter hinzu falls vorhanden
        if (searchParam) {
          galleryParams.search = searchParam;
          // Setze auch den searchQuery Store für die UI
          setSearchQuery(searchParam);
        }
        // Setze fromItem, wenn Location-Filter aktiv
        if ($filterStore.locationFilter) {
          galleryParams.fromItem = true;
        }
        resetGallery(galleryParams);
      }
    };
    
    initializeGalleryIntelligently();
    
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('toggle3x3Mode', handleToggle3x3Mode);
      window.removeEventListener('openMap', handleOpenMap);
      window.removeEventListener('message', handleGPSSimulation);
      if (rotationInterval) {
        clearInterval(rotationInterval);
      }
      if (gpsUpdateTimeout) {
        clearTimeout(gpsUpdateTimeout);
      }
      stopGPSTracking();
    };
  });

  // GPS-Trigger für neue GPS-Daten mit Debouncing
  let gpsUpdateTimeout: any = null;
  let lastTriggerLog = '';
  
  $: if (galleryInitialized && browser) {
    const gps = getEffectiveGpsPosition();
    const effectiveLat = gps?.lat || userLat;
    const effectiveLon = gps?.lon || userLon;
    
    // Debug-Logging für reaktive Trigger
    const triggerLog = `GPS-Trigger: lat=${effectiveLat}, lon=${effectiveLon}, source=${gps?.source || 'direct'}, lastLat=${lastLoadedLat}, lastLon=${lastLoadedLon}, lastSource=${lastLoadedSource}`;
    
    if (triggerLog !== lastTriggerLog) {
      console.log('[GPS-Trigger-Debug]', triggerLog);
      lastTriggerLog = triggerLog;
    }
    
    if (effectiveLat && effectiveLon && (effectiveLat !== lastLoadedLat || effectiveLon !== lastLoadedLon || gps?.source !== lastLoadedSource)) {
      // Debounce GPS updates um Endlosschleifen zu verhindern
      if (gpsUpdateTimeout) {
        clearTimeout(gpsUpdateTimeout);
        console.log('[GPS-Trigger] Clearing previous timeout');
      }
      
      gpsUpdateTimeout = setTimeout(() => {
        console.log('[GPS-Trigger] Executing delayed reset');
        lastLoadedLat = effectiveLat;
        lastLoadedLon = effectiveLon;
        lastLoadedSource = gps?.source || 'direct';
        
        if (isManual3x3Mode) {
          // Mobile Mode: Keine Galerie-Reset, Mobile Galerie sortiert sich selbst reaktiv
          console.log('[GPS-Trigger] Mobile Mode: Skipping gallery reset, mobile gallery will sort itself');
        } else {
          // Normal Mode: KEINE automatischen Reloads - nur LoadMore basierend auf ursprünglichen GPS-Daten
          console.log('[GPS-Trigger] Normal Mode: No automatic reloads, only LoadMore based on original GPS coordinates');
        }
        
        // Clientseitige Sortierung für bereits geladene Items (unabhängig vom Modus)
        // updateGPSPosition(effectiveLat, effectiveLon); // Entfernt
        console.log('[GPS-Trigger] Updated GPS position for client-side sorting');
      }, 200); // 200ms Debounce
    }
  }

  // Reagiere auf Änderungen von userLat/userLon
  // $: tryLoadGalleryWithGps(); // This line is no longer needed as the logic is now in the $: block

  // Wenn GPS nachträglich gesetzt wird, erneut versuchen
  // $: if (galleryLoadPending && userLat !== null && userLon !== null && !isNaN(userLat) && !isNaN(userLon)) { // This line is no longer needed as the logic is now in the $: block
  //   tryLoadGalleryWithGps(); // This line is no longer needed as the logic is now in the $: block
  // } // This line is no longer needed as the logic is now in the $: block

  // Event-Listener für FilterBar Events
  function handleToggle3x3Mode() {
    console.log('🎯 toggle3x3Mode Event empfangen!');
    console.log('🎯 Current state - isManual3x3Mode:', isManual3x3Mode);
    console.log('🎯 Location Filter active:', $filterStore.locationFilter !== null);
    
    isManual3x3Mode = !isManual3x3Mode;
    settingsIconRotation += 180; // Rotiere das Settings-Symbol um 180 Grad
    
    console.log('📱 New state - isManual3x3Mode:', isManual3x3Mode, 'Settings Rotation:', settingsIconRotation);
    
    if (isManual3x3Mode) {
      statusOverlayMessage = 'Mobile Galerie aktiviert';
    } else {
      statusOverlayMessage = 'Normale Galerie aktiviert';
    }
    showStatusOverlay = true;
    setTimeout(() => { showStatusOverlay = false; }, 2000);
  }

  function handleOpenMap() {
    showFullscreenMap = true;
  }

  // Haversine-Formel für Entfernungsberechnung
  function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number): string {
    const R = 6371e3; // Erdradius in Metern
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distanceInMeters = R * c;
    
    // Formatierung: unter 1000m als Meter, darüber als Kilometer
    if (distanceInMeters < 1000) {
      return `${Math.round(distanceInMeters)}m`;
    } else {
      return `${(distanceInMeters / 1000).toFixed(1)}km`;
    }
  }

  // GPS-Initialisierung beim App-Start
  function initializeGPS() {
    if (!navigator.geolocation) {
      gpsStatus = "unavailable";
      return;
    }

    gpsStatus = "checking";

    // Live-Tracking: watchPosition
    gpsWatchId = navigator.geolocation.watchPosition(
      (position) => {
        userLat = position.coords.latitude;
        userLon = position.coords.longitude;
        gpsStatus = "active";
        lastGPSUpdateTime = Date.now();
        if (browser) localStorage.setItem('gpsAllowed', 'true');
        console.log("[GPS] Position geändert:", userLat, userLon);
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            gpsStatus = "denied";
            if (browser) localStorage.removeItem('gpsAllowed');
            break;
          case error.POSITION_UNAVAILABLE:
            gpsStatus = "unavailable";
            break;
          case error.TIMEOUT:
            gpsStatus = "unavailable";
            break;
          default:
            gpsStatus = "unavailable";
        }
        console.warn("GPS-Fehler:", error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  }

  // Intelligente GPS-Initialisierung, die Berechtigungen berücksichtigt
  function initializeGPSIntelligently() {
    if (!navigator.geolocation) {
      gpsStatus = "unavailable";
      return;
    }

    // Prüfe zuerst den aktuellen Berechtigungsstatus
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((permissionStatus) => {
        console.log('[GPS] Permission status:', permissionStatus.state);
        
        if (permissionStatus.state === 'granted') {
          // Berechtigung bereits erteilt - starte GPS
          initializeGPS();
        } else if (permissionStatus.state === 'denied') {
          // Berechtigung verweigert - zeige Galerie ohne GPS
          gpsStatus = "denied";
          console.log('[GPS] Permission denied - showing gallery without GPS');
        } else {
          // Berechtigung noch nicht entschieden - versuche GPS zu starten
          initializeGPS();
        }
      }).catch(() => {
        // Fallback: Versuche GPS zu starten
        initializeGPS();
      });
    } else {
      // Fallback für Browser ohne Permissions API
      initializeGPS();
    }
  }

  function stopGPSTracking() {
    if (gpsWatchId !== null) {
      navigator.geolocation.clearWatch(gpsWatchId);
      gpsWatchId = null;
      console.log('[GPS] Tracking gestoppt');
    }
  }

  // Umschalt-Logik für Galerie/3x3-Modus
  function toggle3x3Mode() {
    isManual3x3Mode = !isManual3x3Mode;
  }

  function toggleSimulationMode() {
    window.location.href = '/simulation';
  }

  // Erweiterte clearSearch Funktion mit Galerie-Reload
  function clearSearchAndReloadGallery() {
    console.log('[Search-Clear] Starting clearSearchAndReloadGallery');
    
    // Lösche zuerst die Suche
    clearSearch();
    console.log('[Search-Clear] clearSearch() completed');
    
    // Dann lade die normale Galerie mit aktuellen GPS-Daten
    const gps = getEffectiveGpsPosition();
    const effectiveLat = gps?.lat || userLat || undefined;
    const effectiveLon = gps?.lon || userLon || undefined;
    
    const galleryParams: any = {};
    if (effectiveLat && effectiveLon) {
      galleryParams.lat = effectiveLat;
      galleryParams.lon = effectiveLon;
    }
    
    console.log('[Search-Clear] About to resetGallery with params:', galleryParams);
    console.log('[Search-Clear] GPS data:', { gps, userLat, userLon, effectiveLat, effectiveLon });
    
    // Kurze Verzögerung um sicherzustellen dass clearSearch abgeschlossen ist
    setTimeout(() => {
      // Setze fromItem, wenn Location-Filter aktiv
      if ($filterStore.locationFilter) {
        galleryParams.fromItem = true;
      }
      resetGallery(galleryParams);
      console.log('[Search-Clear] resetGallery called');
    }, 50);
  }

  // Location Filter löschen und Galerie neu laden
  function clearLocationFilterAndReloadGallery() {
    console.log('[Location-Clear] Starting clearLocationFilterAndReloadGallery');
    console.log('[Location-Clear] Current mode - isManual3x3Mode:', isManual3x3Mode);
    
    // Lade die normale Galerie mit aktuellen GPS-Daten
    const gps = getEffectiveGpsPosition();
    const effectiveLat = gps?.lat || userLat || undefined;
    const effectiveLon = gps?.lon || userLon || undefined;
    
    const galleryParams: any = {};
    if (effectiveLat && effectiveLon) {
      galleryParams.lat = effectiveLat;
      galleryParams.lon = effectiveLon;
    }
    
    console.log('[Location-Clear] About to resetGallery with params:', galleryParams);
    console.log('[Location-Clear] GPS data:', { gps, userLat, userLon, effectiveLat, effectiveLon });
    
    // Kurze Verzögerung um sicherzustellen dass clearLocationFilter abgeschlossen ist
    setTimeout(() => {
      // Only reset normal gallery, mobile gallery handles its own state
      if (!isManual3x3Mode) {
        // Setze fromItem, wenn Location-Filter aktiv
        if ($filterStore.locationFilter) {
          galleryParams.fromItem = true;
        }
        resetGallery(galleryParams);
        console.log('[Location-Clear] resetGallery called for normal gallery');
      } else {
        console.log('[Location-Clear] Skipping resetGallery for mobile gallery mode');
      }
    }, 50);
  }

  // Berechne effektive GPS-Koordinaten für alle Components
  $: {
    const gps = getEffectiveGpsPosition();
    effectiveLat = gps?.lat || userLat;
    effectiveLon = gps?.lon || userLon;
  }
  
  let effectiveLat: number | null = null;
  let effectiveLon: number | null = null;
  
  // Derive hasLocationFilter from filterStore
  $: hasLocationFilter = $filterStore.locationFilter !== null;
  
  // Debug: Log gallery display decisions
  $: {
    if (browser) {
      console.log('[Gallery-Display] Decision variables:', {
        isManual3x3Mode,
        hasLocationFilter,
        locationFilter: $filterStore.locationFilter,
        willShowMobileGallery: isManual3x3Mode && !hasLocationFilter,
        willShowNormalGallery: !(isManual3x3Mode && !hasLocationFilter)
      });
    }
  }
</script>

{#if gpsStatus === 'denied' || gpsStatus === 'unavailable'}
  <div style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(30,30,30,0.92);z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;">
    <div style="background:#222;padding:2rem 2.5rem;border-radius:1rem;box-shadow:0 2px 16px #0008;max-width:90vw;text-align:center;">
      <h2 style="color:#fff;margin-bottom:1rem;">Standort-Freigabe benötigt</h2>
      <p style="color:#ccc;font-size:1.1rem;margin-bottom:1.5rem;">
        Um die Galerie nach Entfernung zu sortieren, benötigen wir Zugriff auf deinen Standort.<br>
        Du kannst aber auch ohne Standort die Galerie nutzen.
      </p>
      <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;">
      <button on:click={initializeGPS} style="padding: 0.9rem 2.2rem; font-size: 1.15rem; border-radius: 0.5rem; background: #3a7; color: #fff; border: none; cursor: pointer; font-weight:600;">
        📍 Standort verwenden
      </button>
        <button on:click={() => gpsStatus = 'none'} style="padding: 0.9rem 2.2rem; font-size: 1.15rem; border-radius: 0.5rem; background: #666; color: #fff; border: none; cursor: pointer; font-weight:600;">
          Ohne Standort fortfahren
        </button>
      </div>
      {#if gpsStatus === 'denied'}
        <div style="margin-top:1.2rem;color:#f66;font-size:1.05rem;">
          Standort-Freigabe wurde abgelehnt.<br>Du kannst die Galerie trotzdem nutzen.
        </div>
      {/if}
      {#if gpsStatus === 'unavailable'}
        <div style="margin-top:1.2rem;color:#f66;font-size:1.05rem;">
          Standort konnte nicht ermittelt werden.<br>Du kannst die Galerie trotzdem nutzen.
        </div>
      {/if}
    </div>
  </div>
{:else}
  <!-- Galerie-Komponenten und restliche Seite -->
  <FilterBar
    userLat={effectiveLat}
    userLon={effectiveLon}
    {showDistance}
    {isLoggedIn}
    gpsStatus={gpsStatus}
    lastGPSUpdateTime={lastGPSUpdateTime}
    isManual3x3Mode={isManual3x3Mode}
    originalGalleryLat={originalGalleryLat}
    originalGalleryLon={originalGalleryLon}
    onLocationFilterClear={clearLocationFilterAndReloadGallery}
  />
  <SearchBar
    searchQuery={$searchQuery}
    isSearching={$isSearching}
    showSearchField={true}
    useJustifiedLayout={$useJustifiedLayout}
    onSearch={performSearch}
    onInput={q => setSearchQuery(q)}
    onToggleSearchField={() => {}}
    onToggleLayout={toggleLayout}
    onClear={clearSearchAndReloadGallery}
  />
  {#if newsFlashMode !== 'aus'}
    <NewsFlash 
      mode={newsFlashMode}
      userId={null}
      layout={$useJustifiedLayout ? 'justified' : 'grid'}
      limit={15}
      showToggles={false}
      showDistance={showDistance}
      userLat={effectiveLat}
      userLon={effectiveLon}
      getDistanceFromLatLonInMeters={getDistanceFromLatLonInMeters}
      displayedImageCount={$galleryStats.loadedCount}
    />
  {/if}
  <WelcomeSection />
  {#if isManual3x3Mode && !hasLocationFilter}
    <MobileGallery
      userLat={userLat}
      userLon={userLon}
      useJustifiedLayout={$useJustifiedLayout}
      showDistance={showDistance}
      showCompass={showCompass}
      getDistanceFromLatLonInMeters={getDistanceFromLatLonInMeters}
      filterStore={filterStore}
      sessionStore={sessionStore}
      dynamicLoader={dynamicImageLoader}
    />
  {:else}
    <NormalGallery
      useJustifiedLayout={$useJustifiedLayout}
      showDistance={showDistance}
      showCompass={showCompass}
      userLat={userLat}
      userLon={userLon}
      originalGalleryLat={originalGalleryLat}
      originalGalleryLon={originalGalleryLon}
      getDistanceFromLatLonInMeters={getDistanceFromLatLonInMeters}
      filterStore={filterStore}
      sessionStore={sessionStore}
    />
  {/if}
  <StatusOverlay visible={showStatusOverlay} message={statusOverlayMessage} />
  <StatusOverlay visible={false} message={""} />
  {#if !isInIframe}
    <FloatingActionButtons
      {showScrollToTop}
      showTestMode={true}
      showMapButton={true}
      isLoggedIn={isLoggedIn}
      {simulationMode}
      profileAvatar={profileAvatar}
      settingsIconRotation={settingsIconRotation}
      continuousRotation={continuousRotation}
      rotationSpeed={rotationSpeed}
      on:upload={() => isLoggedIn ? window.location.href = '/bulk-upload' : window.location.href = '/login'}
      on:publicContent={() => {}}
      on:bulkUpload={() => isLoggedIn ? window.location.href = '/bulk-upload' : window.location.href = '/login'}
      on:profile={() => isLoggedIn ? window.location.href = '/profile' : window.location.href = '/login'}
      on:settings={() => isLoggedIn ? window.location.href = '/settings' : window.location.href = '/login'}
      on:map={() => showFullscreenMap = true}
      on:testMode={() => simulationMode ? window.location.href = '/' : window.location.href = '/simulation'}
    />
  {/if}
  {#if showLoginOverlay}
    <LoginOverlay
      show={true}
      isLoggedIn={isLoggedIn}
      authChecked={authChecked}
      onClose={() => showLoginOverlay = false}
      loginWithProvider={() => {}}
      loginWithEmail={() => {}}
      signupWithEmail={() => {}}
      resetPassword={() => {}}
      setAnonymousMode={() => {}}
    />
  {/if}
  {#if showFullscreenMap}
    <FullscreenMap 
      images={[]}
      userLat={effectiveLat}
      userLon={effectiveLon}
      {deviceHeading}
      {isManual3x3Mode}
      on:close={() => showFullscreenMap = false}
      on:imageClick={(event) => {
        const imageSlug = event.detail.imageSlug || event.detail.slug || event.detail.imageId;
        console.log('[FullscreenMap] Image clicked:', imageSlug);
        window.location.href = `/item/${imageSlug}`;
      }}
      on:locationSelected={(event) => {
        const { lat, lon } = event.detail;
        console.log('[FullscreenMap] Location selected:', lat, lon);
        // Optional: Set location filter or handle location selection
      }}
    />
  {/if}
  <a class="impressum-link" href="/impressum" target="_blank" rel="noopener">Impressum</a>
  <a class="datenschutz-link" href="/datenschutz" target="_blank" rel="noopener">Datenschutz</a>
{/if}

<style>
/* Nur globale Styles, falls benötigt */
.impressum-link, .datenschutz-link {
  position: fixed;
  bottom: 0.3rem;
  font-size: 0.95rem;
  color: #ffffff;
}
.impressum-link { left: 2.7rem; }
.datenschutz-link { left: 11.2rem; }
.impressum-link:hover, .datenschutz-link:hover {
  opacity: 1;
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
</style>