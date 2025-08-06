<svelte:head>
  <title>Culoca - Entdecke deine Umgebung mit GPS & Fotos</title>
  <meta name="description" content="Entdecke versteckte Orte, teile Fotos mit GPS-Koordinaten und starte deine eigene Culoca-Galerie. Finde lokale Events, Sehenswürdigkeiten und teile deine Entdeckungen." />
  <meta name="robots" content="index, follow" />
  <meta name="author" content="DIRSCHL.com GmbH" />
  <meta name="keywords" content="GPS, Geo-Lokalisierung, Fotos, Bilder, Galerie, lokale Suche, versteckte Orte, Sehenswürdigkeiten, Events, Culoca, Entdeckungen, Umgebung, Regional, Fotografie, Wandern, Freizeit, Plattform, App, Landschaft, Lost Places, Fotolocations, Reiseführer, Urlaub, kennenlernen, Social Media, digital, für alle, Standort, Lokal, Items, Distanz, Entfernung, Freigeben, Download, Karten, Routenplaner, Anzeigen, Unterhaltung, Orte, Ort" />
  <link rel="canonical" href="https://culoca.com/" />
  
  <!-- Open Graph Meta-Tags -->
  <meta property="og:locale" content="de_DE" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Culoca - Entdecke deine Umgebung mit GPS & Fotos" />
  <meta property="og:description" content="Entdecke versteckte Orte, teile Fotos mit GPS-Koordinaten und starte deine eigene Culoca-Galerie. Finde lokale Events, Sehenswürdigkeiten und teile deine Entdeckungen." />
  <meta property="og:url" content="https://culoca.com/" />
  <meta property="og:site_name" content="Culoca" />
  <meta property="og:image" content="https://culoca.com/culoca-see-you-local-entdecke-deine-umgebung.jpg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="Culoca - Entdecke deine Umgebung mit GPS & Fotos" />
  
  <!-- Twitter Card Meta-Tags -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Culoca - Entdecke deine Umgebung mit GPS & Fotos" />
  <meta name="twitter:description" content="Entdecke versteckte Orte, teile Fotos mit GPS-Koordinaten und starte deine eigene Culoca-Galerie. Finde lokale Events, Sehenswürdigkeiten und teile deine Entdeckungen." />
  <meta name="twitter:image" content="https://culoca.com/culoca-see-you-local-entdecke-deine-umgebung.jpg" />
  
  <!-- Strukturierte Daten (JSON-LD) für bessere SEO -->
  <script type="application/ld+json">
  {JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Culoca - Entdecke deine Umgebung mit GPS & Fotos",
    "description": "Entdecke versteckte Orte, teile Fotos mit GPS-Koordinaten und starte deine eigene Culoca-Galerie. Finde lokale Events, Sehenswürdigkeiten und teile deine Entdeckungen.",
    "url": "https://culoca.com",
    "inLanguage": "de",
    "image": {
      "@type": "ImageObject",
      "url": "https://culoca.com/culoca-see-you-local-entdecke-deine-umgebung.jpg",
      "width": 1200,
      "height": 630,
      "alt": "Culoca - Entdecke deine Umgebung mit GPS & Fotos"
    },
    "author": {
      "@type": "Organization",
      "name": "DIRSCHL.com GmbH",
      "url": "https://culoca.com"
    },
    "publisher": {
      "@type": "Organization",
      "name": "DIRSCHL.com GmbH",
      "url": "https://culoca.com",
      "logo": {
        "@type": "ImageObject",
        "url": "https://culoca.com/culoca-icon.svg",
        "width": 32,
        "height": 32
      }
    },
    "mainEntity": {
      "@type": "SoftwareApplication",
      "name": "Culoca",
      "applicationCategory": "SocialNetworkingApplication",
      "operatingSystem": "Web Browser",
      "description": "GPS-basierte Foto-Sharing-Plattform für lokale Entdeckungen",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "EUR"
      }
    },
    "keywords": "GPS, Geo-Lokalisierung, Fotos, Bilder, Galerie, lokale Suche, versteckte Orte, Sehenswürdigkeiten, Events, Culoca, Entdeckungen, Umgebung, Regional, Fotografie, Wandern, Freizeit, Plattform, App, Landschaft, Lost Places, Fotolocations, Reiseführer, Urlaub, kennenlernen, Social Media, digital, für alle, Standort, Lokal, Items, Distanz, Entfernung, Freigeben, Download, Karten, Routenplaner, Anzeigen, Unterhaltung, Orte, Ort",
    "about": [
      {
        "@type": "Thing",
        "name": "GPS-basierte Fotografie"
      },
      {
        "@type": "Thing", 
        "name": "Lokale Entdeckungen"
      },
      {
        "@type": "Thing",
        "name": "Social Media Plattform"
      }
    ]
  })}
  </script>
</svelte:head>
<script lang="ts">
  import type { PageData } from './$types';
  import { onMount } from 'svelte';
  
  export let data: PageData;
  
  // Debug: Log server data
  console.log('[Page] Server data received:', {
    newsFlashItems: data.newsFlashItems?.length || 0,
    seo: !!data.seo
  });
  
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
  import { sessionStore, hasPublicContentPermission } from '$lib/sessionStore';
  import { filterStore, locationFilter, userFilter } from '$lib/filterStore';
  import { page as pageStore } from '$app/stores';
  import { galleryStats } from '$lib/galleryStats';
  import { dynamicImageLoader } from '$lib/dynamicImageLoader';
  import { loadMoreGallery, galleryItems, resetGallery, useJustifiedLayout, toggleLayout } from '$lib/galleryStore';
  import { browser } from '$app/environment';
  import { getEffectiveGpsPosition } from '$lib/filterStore';
  import { supabase } from '$lib/supabaseClient';
  import { get } from 'svelte/store';

  // Gallery store
  const pics = galleryItems;

  // Effective GPS position for components
  $: effectiveLat = getEffectiveGpsPosition()?.lat || userLat;
  $: effectiveLon = getEffectiveGpsPosition()?.lon || userLon;

  // Check if location filter is active
  $: hasLocationFilter = !!$locationFilter;

  // Permission states - now using sessionStore
  $: hasPublicContentPermissionValue = $hasPublicContentPermission;



  // Globale States für Umschaltung, Overlay, etc.
  let showLoginOverlay = false;
  let showFullscreenMap = false;
  let isManual3x3Mode = false;
  let userLat: number | null = null;
  let userLon: number | null = null;
  let cachedLat: number | null = null;
  let cachedLon: number | null = null;
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
  let autoguide = false;
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
  let galleryInitialized = false;
  let gpsUpdateTimeout: any = null;
  
  // Ursprüngliche GPS-Koordinaten für Normal Mode (werden nur einmal gesetzt)
  let originalGalleryLat: number | null = null;
  let originalGalleryLon: number | null = null;

  // Debug-Variable für die aktuelle API-URL
  let lastApiUrl = '';

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

  // Function to load user settings including autoguide
  async function loadUserSettings() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[Settings] No user found, using defaults');
        return;
      }
      
      const { data, error } = await supabase
        .from('profiles')
        .select('show_distance, show_compass, autoguide, enable_search, use_justified_layout, newsflash_mode, home_lat, home_lon')
        .eq('id', user.id)
        .single();
        
      if (error) {
        console.error('[Settings] Error loading user settings:', error);
        return;
      }
      
      if (data) {
        showDistance = data?.show_distance ?? true;
        showCompass = data?.show_compass ?? false;
        autoguide = data?.autoguide ?? false;
        newsFlashMode = data?.newsflash_mode ?? 'alle';
        
        console.log('[Settings] Loaded user settings:', {
          showDistance,
          showCompass,
          autoguide,
          newsFlashMode
        });
        
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
    } catch (error) {
      console.error('[Settings] Error loading user settings:', error);
    }
  }

  // Function to get currently visible image for autoguide
  function getCurrentlyVisibleImage() {
    if (!browser) return null;
    
    const galleryContainer = document.querySelector('.gallery-container, .justified-wrapper');
    if (!galleryContainer) return null;
    
    const images = galleryContainer.querySelectorAll('.pic-container, .justified-item');
    if (images.length === 0) return null;
    
    const containerRect = galleryContainer.getBoundingClientRect();
    const containerCenter = containerRect.top + containerRect.height / 2;
    
    let closestImage: any = null;
    let closestDistance = Infinity;
    
    images.forEach((img: any) => {
      const rect = img.getBoundingClientRect();
      const imageCenter = rect.top + rect.height / 2;
      const distance = Math.abs(imageCenter - containerCenter);
      
      if (distance < closestDistance) {
        closestDistance = distance;
        closestImage = img;
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
  
  function speakTitle(text: string, imageId: string) {
    if (!speechSynthesis || !audioActivated) {
      console.log('🎤 Speech synthesis not available or audio not activated');
      return;
    }
    
    // NUR im mobilen Modus sprechen
    if (!isManual3x3Mode) {
      console.log('🎤 Not in mobile mode - skipping speech');
      return;
    }
    
    // Reset retry count for new speech
    speechRetryCount = 0;
    
    // Clean the text (same as in announceFirstImage)
    let cleanText = text;
    const commaIndex = cleanText.indexOf(',');
    if (commaIndex !== -1) {
      cleanText = cleanText.substring(0, commaIndex);
    }
    
    cleanText = cleanText
      .replace(/;/g, ' - ')
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log('🎤 Speaking:', cleanText, 'for image:', imageId);
    autoguideText = cleanText; // Show cleaned text in the UI too
    currentImageTitle = cleanText; // Update current image title for display
    
    // SOFORT alle anderen Ansagen abbrechen - unabhängig vom Text
    if (speechSynthesis) {
      console.log('🎤 Canceling all ongoing speech for new image');
      speechSynthesis.cancel();
      
      // Kurze Verzögerung um sicherzustellen, dass alle Ansagen gestoppt sind
      setTimeout(() => {
        startNewSpeech(cleanText, imageId);
      }, 50);
    } else {
      startNewSpeech(cleanText, imageId);
    }
  }

  // Separate function to start new speech
  function startNewSpeech(cleanText: string, imageId: string) {
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
      console.log('🎤 Speech started:', cleanText);
    };
    
    currentSpeech.onend = () => {
      console.log('🎤 Speech ended:', cleanText);
      // Don't clear the text automatically - it should stay until image changes
    };
    
    currentSpeech.onerror = (event) => {
      if (event.error === 'canceled') {
        console.log('🎤 Speech was canceled (expected behavior)');
        return;
      }
      
      if (event.error === 'not-allowed') {
        console.log('🎤 Speech not allowed - user interaction required, but text is still displayed');
        // Don't retry automatically - just log the error
        return;
      }
      
      console.error('🎤 Speech error:', event.error);
      
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
        console.log(`🎤 Retrying speech (attempt ${speechRetryCount}/3):`, cleanText);
        
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
    
    // Im mobilen Modus nur über Events arbeiten, nicht über pics
    if (isManual3x3Mode) {
      console.log('🎤 Mobile mode detected - relying on mobile gallery events only');
      return;
    }
    
    // Always update the first image title, even when autoguide is disabled
    let currentPics = get(pics);
    console.log('🎤 Current pics length:', currentPics.length);
    
    if (currentPics.length === 0) {
      console.log('🎤 No images available for announcement');
      currentImageTitle = 'Keine Bilder verfügbar';
      return;
    }
    
    const firstImage = currentPics[0];
    console.log('🎤 First image:', firstImage);
    console.log('🎤 First image title:', firstImage.title);
    console.log('🎤 First image original_name:', firstImage.original_name);
    
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
    console.log('🎤 Previous currentImageTitle:', currentImageTitle);
    console.log('🎤 Previous lastAnnouncedImageId:', lastAnnouncedImageId);
    
    // Update the display title
    currentImageTitle = displayTitle;
    lastAnnouncedImageId = firstImage.id;
    
    console.log('🎤 Updated currentImageTitle to:', currentImageTitle);
    console.log('🎤 Updated lastAnnouncedImageId to:', lastAnnouncedImageId);
    
    // NUR im mobilen Modus sprechen - normale Galerie soll nicht sprechen
    if (autoguide && audioActivated && isManual3x3Mode) {
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
      
      // Stille Aktivierung des Audioguides ohne Sprachausgabe
      console.log('🎤 Audio guide activated silently');
      audioActivated = true;
      
      // Announce first image after activation - nur im mobilen Modus
      if (isManual3x3Mode) {
        setTimeout(() => {
          announceFirstImage();
        }, 200);
      }
    }
  }

  function buildGalleryApiUrl() {
    if (!browser) return '';
    const gps = getEffectiveGpsPosition();
    const url = new URL('/api/gallery-items-normal', window.location.origin);
    url.searchParams.set('page', '0');
    if (gps && gps.lat !== undefined && gps.lon !== undefined) {
      url.searchParams.set('lat', String(gps.lat));
      url.searchParams.set('lon', String(gps.lon));
    }
    return url.toString();
  }

  $: lastApiUrl = buildGalleryApiUrl();

  $: isLoggedIn = $sessionStore.isAuthenticated;
  $: simulationMode = $pageStore.url.pathname.startsWith('/simulation');

  // Lade Avatar und Settings wenn Login-Status sich ändert
  $: if (isLoggedIn) {
    if (!profileAvatar) {
      loadUserAvatar();
    }
    loadUserSettings();
  }

  // Setze anonyme User Defaults wenn Login-Status sich ändert
  $: if (browser) {
    setAnonymousUserDefaults();
  }

  // NEU: Reaktive Gallery-Neuladen bei Filter-Änderungen
  let lastLocationFilter = null;
  let lastUserFilter = null;
  let isHandlingFilterChange = false; // Prevent infinite loops
  
  $: if (browser && galleryInitialized && !isHandlingFilterChange) {
    const currentLocationFilter = $locationFilter;
    const currentUserFilter = $userFilter;
    
    // Prevent infinite loops by checking if filters actually changed
    const locationFilterChanged = JSON.stringify(currentLocationFilter) !== JSON.stringify(lastLocationFilter);
    const userFilterChanged = JSON.stringify(currentUserFilter) !== JSON.stringify(lastUserFilter);
    
    // Wenn sich Location-Filter ändert, lade Gallery neu
    if (locationFilterChanged && currentLocationFilter) {
      console.log('[Reactive] Location filter changed, loading more gallery:', currentLocationFilter);
      isHandlingFilterChange = true;
      lastLocationFilter = JSON.parse(JSON.stringify(currentLocationFilter));
      resetGallery({
        lat: currentLocationFilter.lat,
        lon: currentLocationFilter.lon,
        fromItem: currentLocationFilter.fromItem,
        locationFilterLat: currentLocationFilter.lat,
        locationFilterLon: currentLocationFilter.lon
      });
      setTimeout(() => { isHandlingFilterChange = false; }, 100);
    }
    
    // Wenn sich User-Filter ändert, lade Gallery neu
    if (userFilterChanged) {
      // WICHTIG: Prüfe ob die Galerie bereits mit diesem User-Filter geladen wurde
      const isInitialLoadWithUserFilter = galleryInitialized && 
        currentUserFilter && 
        lastUserFilter && 
        currentUserFilter.userId === lastUserFilter.userId;
      
      if (isInitialLoadWithUserFilter) {
        console.log('[Reactive] Skipping user filter change - already loaded with this filter');
      } else if (currentUserFilter) {
        // User-Filter gesetzt
        console.log('[Reactive] User filter set, loading filtered gallery:', currentUserFilter);
        isHandlingFilterChange = true;
        lastUserFilter = JSON.parse(JSON.stringify(currentUserFilter));
        
        // WICHTIG: GPS-Koordinaten für User-Filter bereitstellen
        const gpsParams = {
          user_id: currentUserFilter.userId,
          lat: userLat || 0,
          lon: userLon || 0
        };
        
        resetGallery(gpsParams);
        setTimeout(() => { isHandlingFilterChange = false; }, 100);
      } else {
        // User-Filter gelöscht
        console.log('[Reactive] User filter cleared, loading all images');
        isHandlingFilterChange = true;
        lastUserFilter = null;
        
        // Galerie ohne User-Filter neu laden
        const gpsParams = {
          lat: userLat || 0,
          lon: userLon || 0
        };
        
        resetGallery(gpsParams);
        setTimeout(() => { isHandlingFilterChange = false; }, 100);
      }
    }
    
    // Update last values for next comparison
    if (!locationFilterChanged) {
      lastLocationFilter = currentLocationFilter ? JSON.parse(JSON.stringify(currentLocationFilter)) : null;
    }
    if (!userFilterChanged) {
      lastUserFilter = currentUserFilter ? JSON.parse(JSON.stringify(currentUserFilter)) : null;
    }
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
    
    // URL-Parameter für mobilen Modus verarbeiten (nur für Audioguide)
    const urlParams = new URLSearchParams(window.location.search);
    const mobileParam = urlParams.get('mobile');
    if (mobileParam === 'true') {
      console.log('[onMount] Mobile mode detected via URL parameter');
      // Nur für Audioguide-Zwecke, nicht für Galerie-Logik
    }
    
    // WICHTIG: Kurze Verzögerung um sicherzustellen, dass der FilterStore korrekt initialisiert wurde
    setTimeout(() => {
      console.log('[onMount] FilterStore state after initialization:', {
        userFilter: $filterStore.userFilter,
        locationFilter: $filterStore.locationFilter
      });
      
      // WICHTIG: Galerie erst nach FilterStore-Initialisierung starten
      initializeGalleryIntelligently();
    }, 100);
    
    const onScroll = () => {
      showScrollToTop = window.scrollY > 200;
    };
    window.addEventListener('scroll', onScroll);
    
    // Add scroll event listener for autoguide
    const onScrollForAudioguide = () => {
      handleScrollForAudioguide();
    };
    window.addEventListener('scroll', onScrollForAudioguide);
    isInIframe = window.self !== window.top;
    
    // Event-Listener für FilterBar Events
    window.addEventListener('toggle3x3Mode', handleToggle3x3Mode);
    window.addEventListener('openMap', handleOpenMap);
    window.addEventListener('locationSelected', handleLocationSelected);
    
    // GPS-Simulation Message-Listener
    const handleGPSSimulation = (event: MessageEvent) => {
      if (event.data && event.data.type === 'gps-simulation') {
        console.log('[GPS-Simulation] Received GPS data from simulation:', event.data);
        
        // Setze simulierte GPS-Daten als echte GPS-Position
        userLat = event.data.lat;
        userLon = event.data.lon;
        gpsStatus = 'active';
        lastGPSUpdateTime = Date.now();
        
        // WICHTIG: GPS-Position in filterStore speichern für getEffectiveGpsPosition()
        filterStore.updateGpsStatus(true, { lat: userLat, lon: userLon });
        
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
        
        // WICHTIG: GPS-Status in filterStore zurücksetzen
        filterStore.updateGpsStatus(false);
        
        console.log('[GPS-Simulation] Cleared simulated GPS data');
        
        // Versuche echtes GPS zu reaktivieren falls verfügbar
        if (navigator.geolocation) {
          initializeGPSIntelligently();
        }
      }
    };
    
    window.addEventListener('message', handleGPSSimulation);
    
    // NEU: Prüfe gespeicherte GPS-Daten beim App-Start
    if (browser) {
      const savedGps = localStorage.getItem('userGps');
      if (savedGps) {
        try {
          const gpsData = JSON.parse(savedGps);
          const now = Date.now();
          const gpsAge = now - gpsData.timestamp;
          
          // Verwende gespeicherte GPS-Daten nur wenn sie nicht älter als 24 Stunden sind
          if (gpsData.lat && gpsData.lon && gpsAge < 24 * 60 * 60 * 1000) {
            console.log('[App-Start] Found saved GPS data:', gpsData);
            
            // WICHTIG: Setze sowohl userLat/userLon als auch cachedLat/cachedLon
            userLat = gpsData.lat;
            userLon = gpsData.lon;
            cachedLat = gpsData.lat;
            cachedLon = gpsData.lon;
            gpsStatus = 'active'; // Setze auf 'active' da wir GPS-Daten haben
            lastGPSUpdateTime = gpsData.timestamp;
            
            // Update filterStore with saved GPS data
            filterStore.updateGpsStatus(true, { lat: userLat, lon: userLon });
            
            console.log('[App-Start] Using saved GPS data:', { userLat, userLon, cachedLat, cachedLon, gpsAge: Math.round(gpsAge / 1000 / 60) + ' minutes' });
          } else {
            console.log('[App-Start] Saved GPS data too old, clearing:', { gpsAge: Math.round(gpsAge / 1000 / 60) + ' minutes' });
            localStorage.removeItem('userGps');
          }
        } catch (error) {
          console.warn('[App-Start] Error parsing saved GPS data:', error);
          localStorage.removeItem('userGps');
        }
      } else {
        console.log('[App-Start] No saved GPS data found');
      }
    }
    
    // NEU: Lade gespeicherte GPS-Daten zuerst
    const hasLoadedGPS = loadGPSData();
    
    // Intelligente GPS-Initialisierung
    console.log('[App-Start] Starting GPS initialization...');
    
    // EINFACH: GPS-Initialisierung sofort starten (auch wenn gespeicherte Daten vorhanden sind)
    if (navigator.geolocation) {
      console.log('[App-Start] Geolocation available, initializing...');
      gpsStatus = 'checking';
      initializeGPS();
    } else {
      console.log('[App-Start] Geolocation not available');
      gpsStatus = 'unavailable';
    }
    
    // Setze Default-Settings für anonyme User
    setAnonymousUserDefaults();
    
    // Lade NewsFlash-Modus aus localStorage
    if (browser) {
      const storedNewsFlash = localStorage.getItem('newsFlashMode');
      if (storedNewsFlash === 'aus' || storedNewsFlash === 'eigene' || storedNewsFlash === 'alle') {
        newsFlashMode = storedNewsFlash;
      }
    }
    
    // Galerie intelligenter initialisieren - WARTE auf GPS wie in der mobilen Galerie
    const initializeGalleryIntelligently = async () => {
      if (!galleryInitialized) {
        galleryInitialized = true;
        
        console.log('[Gallery-Init] Starting intelligent gallery initialization...');
        
        // Prüfe Querystring für Suchparameter
        const urlParams = new URLSearchParams(window.location.search);
        const searchParam = urlParams.get('search') || urlParams.get('s');
        
        // NEU: Lade sofort ohne auf GPS zu warten
        console.log('[Gallery-Init] Loading gallery immediately without waiting for GPS...');
        
        // Setze lastLoaded-Werte um doppelte GPS-Trigger zu vermeiden
        lastLoadedLat = 0;
        lastLoadedLon = 0;
        lastLoadedSource = 'fallback';
        
        // Setze ursprüngliche Galerie-Koordinaten für Normal Mode (nur einmal)
        if (originalGalleryLat === null && originalGalleryLon === null) {
          originalGalleryLat = 0;
          originalGalleryLon = 0;
          console.log('[Gallery-Init] Set original gallery coordinates:', { originalGalleryLat, originalGalleryLon });
        }
        
        const galleryParams: any = {
          lat: 0,
          lon: 0
        };
        
        // WICHTIG: User-Filter beibehalten falls gesetzt
        if ($filterStore.userFilter) {
          galleryParams.user_id = $filterStore.userFilter.userId;
          console.log('[Gallery-Init] Including user filter in initial load:', $filterStore.userFilter.userId);
        }
        
        // Füge Suchparameter hinzu falls vorhanden
        if (searchParam) {
          galleryParams.search = searchParam;
          setSearchQuery(searchParam);
        }
        // Setze fromItem, wenn Location-Filter aktiv
        if ($filterStore.locationFilter) {
          galleryParams.fromItem = true;
        }
        
        console.log('[Gallery-Init] Loading gallery with fallback coordinates:', galleryParams);
        resetGallery(galleryParams);
        
        // NEU: Versuche GPS-Koordinaten im Hintergrund zu laden
        setTimeout(async () => {
          console.log('[Gallery-Init] Attempting to get GPS coordinates in background...');
          
          let attempts = 0;
          const maxAttempts = 10; // 10 Sekunden warten
          const checkInterval = 1000; // Jede Sekunde prüfen
          
          while (attempts < maxAttempts) {
            const gps = getEffectiveGpsPosition();
            const effectiveLat = gps?.lat || userLat;
            const effectiveLon = gps?.lon || userLon;
            
            console.log(`[Gallery-Init] Background GPS attempt ${attempts + 1}/${maxAttempts}:`, {
              gps,
              userLat,
              userLon,
              effectiveLat,
              effectiveLon
            });
            
            // Wenn GPS-Koordinaten verfügbar sind, lade Galerie neu
            if (effectiveLat && effectiveLon) {
              console.log('[Gallery-Init] GPS coordinates available, updating coordinates...');
              
              // Setze lastLoaded-Werte um doppelte GPS-Trigger zu vermeiden
              lastLoadedLat = effectiveLat;
              lastLoadedLon = effectiveLon;
              lastLoadedSource = gps?.source || 'background';
              
              // Setze ursprüngliche Galerie-Koordinaten für Normal Mode (nur einmal)
              if (originalGalleryLat === 0 && originalGalleryLon === 0) {
                originalGalleryLat = effectiveLat;
                originalGalleryLon = effectiveLon;
                console.log('[Gallery-Init] Updated original gallery coordinates:', { originalGalleryLat, originalGalleryLon });
              }
              
              // Nur für Mobile Mode: Galerie neu laden
              if (isManual3x3Mode) {
                const galleryParams: any = {
                  lat: effectiveLat,
                  lon: effectiveLon
                };
                
                // WICHTIG: User-Filter beibehalten falls gesetzt
                if ($filterStore.userFilter) {
                  galleryParams.user_id = $filterStore.userFilter.userId;
                }
                
                // Füge Suchparameter hinzu falls vorhanden
                if (searchParam) {
                  galleryParams.search = searchParam;
                  setSearchQuery(searchParam);
                }
                // Setze fromItem, wenn Location-Filter aktiv
                if ($filterStore.locationFilter) {
                  galleryParams.fromItem = true;
                }
                
                console.log('[Gallery-Init] Reloading mobile gallery with GPS coordinates:', galleryParams);
                resetGallery(galleryParams);
              } else {
                // Normal Mode: Nur Koordinaten aktualisieren, keine Neuladung
                console.log('[Gallery-Init] Normal mode: Updated GPS coordinates without reloading gallery');
              }
              
              return; // Koordinaten aktualisiert, beende Warteschleife
            }
            
            // Warte eine Sekunde bevor nächster Versuch
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            attempts++;
          }
          
          console.log('[Gallery-Init] No GPS coordinates available in background, keeping fallback gallery');
        }, 1000); // 1 Sekunde warten bevor GPS-Versuch
      }
    };
    
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScrollForAudioguide);
      window.removeEventListener('toggle3x3Mode', handleToggle3x3Mode);
      window.removeEventListener('openMap', handleOpenMap);
      window.removeEventListener('locationSelected', handleLocationSelected);
      window.removeEventListener('message', handleGPSSimulation);
      if (rotationInterval) {
        clearInterval(rotationInterval);
      }
      if (gpsUpdateTimeout) {
        clearTimeout(gpsUpdateTimeout);
      }
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      stopGPSTracking();
    };
  });

  // GPS-Trigger für neue GPS-Daten mit Debouncing
  let lastTriggerLog = '';
  
  $: if (galleryInitialized && browser) {
    const gps = getEffectiveGpsPosition();
    // EINFACH: Verwende nur aktive GPS oder Fallback
    let effectiveLat: number | null = null;
    let effectiveLon: number | null = null;
    
    if (gpsStatus === 'active' && userLat !== null && userLon !== null) {
      // Aktive GPS verwenden
      effectiveLat = userLat;
      effectiveLon = userLon;
    } else if (gps?.lat && gps?.lon) {
      // Fallback auf filterStore GPS
      effectiveLat = gps.lat;
      effectiveLon = gps.lon;
    }
    
    // Debug-Logging für reaktive Trigger
    const triggerLog = `GPS-Trigger: lat=${effectiveLat}, lon=${effectiveLon}, gpsStatus=${gpsStatus}, source=${gps?.source || 'direct'}, lastLat=${lastLoadedLat}, lastLon=${lastLoadedLon}, lastSource=${lastLoadedSource}`;
    
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
          // Normal Mode: KEINE automatischen Reloads - nur clientseitige Sortierung
          console.log('[GPS-Trigger] Normal Mode: No automatic reloads, only client-side sorting');
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
  
  // Handle location selection from map
  function handleLocationSelected(event: CustomEvent) {
    const { lat, lon } = event.detail;
    console.log('[Location-Selected] User selected location from map:', { lat, lon });
    
    // WICHTIG: Stoppe GPS-Watcher um Konflikte zu vermeiden
    if (gpsWatchId) {
      navigator.geolocation.clearWatch(gpsWatchId);
      gpsWatchId = null;
      console.log('[Location-Selected] Stopped GPS watcher to prevent conflicts');
    }
    
    // EINFACH: Setze ausgewählte Koordinaten als GPS
    userLat = lat;
    userLon = lon;
    
    lastGPSUpdateTime = Date.now();
    
    // Save to localStorage
    if (browser) {
      localStorage.setItem('gpsAllowed', 'true');
      saveGPSData(lat, lon);
      console.log('[Location-Selected] Saved selected location as GPS gemerkt:', { lat, lon });
    }
    
    // Update filterStore with the selected location
    filterStore.updateGpsStatus(true, { lat, lon });
    
    // Close the map
    showFullscreenMap = false;
    
    // Trigger gallery reload with new coordinates
    if (galleryInitialized) {
      console.log('[Location-Selected] Reloading gallery with selected location');
      resetGallery({ lat, lon });
    }
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
    console.log('[GPS] initializeGPS called');
    
    if (!navigator.geolocation) {
      gpsStatus = "unavailable";
      console.log('[GPS] Geolocation not available');
      return;
    }

    console.log('[GPS] Starting GPS watch...');
    gpsStatus = "checking";

    try {
      // EINFACH: Direkt GPS anfordern - das sollte das Location-Symbol im Browser anzeigen
      gpsWatchId = navigator.geolocation.watchPosition(
        (position) => {
          console.log('[GPS] Position received:', position);
          userLat = position.coords.latitude;
          userLon = position.coords.longitude;
          lastGPSUpdateTime = Date.now();
          
          // WICHTIG: Status auf 'active' setzen wenn GPS erfolgreich ist
          gpsStatus = 'active';
          
          if (browser) localStorage.setItem('gpsAllowed', 'true');
          console.log("[GPS] Position geändert:", userLat, userLon);
          
          // WICHTIG: GPS-Position in filterStore speichern
          filterStore.updateGpsStatus(true, { lat: userLat, lon: userLon });
          
          // WICHTIG: GPS-Daten in localStorage speichern für Persistierung
          saveGPSData(userLat, userLon);
        },
        (error) => {
          console.warn("GPS-Fehler:", error.message, "Code:", error.code);
          // EINFACH: Lösche GPS-Koordinaten bei Fehler
          userLat = null;
          userLon = null;
          
          // WICHTIG: Status entsprechend setzen
          if (error.code === 1) {
            gpsStatus = 'denied';
          } else if (error.code === 2) {
            gpsStatus = 'unavailable';
          } else {
            gpsStatus = 'none';
          }
          
          filterStore.updateGpsStatus(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
      
      console.log('[GPS] GPS watch started with ID:', gpsWatchId);
    } catch (error) {
      console.error('[GPS] Error starting GPS watch:', error);
      gpsStatus = "unavailable";
      filterStore.updateGpsStatus(false);
    }
  }

  // Intelligente GPS-Initialisierung, die Berechtigungen berücksichtigt
  function initializeGPSIntelligently() {
    console.log('[GPS-Init] initializeGPSIntelligently called');
    
    if (!navigator.geolocation) {
      console.log('[GPS-Init] Geolocation not available');
      gpsStatus = "unavailable";
      return;
    }

    // NEU: Wenn bereits cached GPS-Daten vorhanden sind, nicht sofort live GPS starten
    if (gpsStatus === 'cached' && cachedLat && cachedLon) {
      console.log('[GPS-Init] Using cached GPS data, not starting live GPS immediately');
      return;
    }

    // NEU: Setze Status auf 'checking' bevor GPS gestartet wird
    gpsStatus = 'checking';
    console.log('[GPS-Init] Starting GPS initialization...');

    // NEU: Versuche immer GPS zu starten, auch wenn Permissions API nicht verfügbar ist
    try {
      // Prüfe zuerst den aktuellen Berechtigungsstatus
      if ('permissions' in navigator) {
        navigator.permissions.query({ name: 'geolocation' }).then((permissionStatus) => {
          console.log('[GPS] Permission status:', permissionStatus.state);
          
          if (permissionStatus.state === 'granted') {
            // Berechtigung bereits erteilt - starte GPS
            console.log('[GPS] Permission granted - starting GPS...');
            initializeGPS();
          } else if (permissionStatus.state === 'denied') {
            // Berechtigung verweigert - zeige Galerie ohne GPS
            gpsStatus = "denied";
            console.log('[GPS] Permission denied - showing gallery without GPS');
          } else {
            // Berechtigung noch nicht entschieden - versuche GPS zu starten
            console.log('[GPS] Permission not decided - trying GPS...');
            initializeGPS();
          }
        }).catch((error) => {
          // Fallback: Versuche GPS zu starten
          console.log('[GPS] Permission check failed - trying GPS as fallback:', error);
          initializeGPS();
        });
      } else {
        // Fallback für Browser ohne Permissions API
        console.log('[GPS] No permissions API - trying GPS directly...');
        initializeGPS();
      }
    } catch (error) {
      // NEU: Fehlerbehandlung für GPS-Initialisierung
      console.error('[GPS-Init] Error during GPS initialization:', error);
      gpsStatus = 'unavailable';
    }
  }
  
  // Neue Funktion: Versuche GPS zu initialisieren mit besserer Fehlerbehandlung
  function tryInitializeGPS() {
    console.log('[GPS] User clicked "Standort verwenden" - trying to initialize GPS...');
    
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
          console.log('[GPS] Permission granted - starting GPS...');
          initializeGPS();
        } else if (permissionStatus.state === 'denied') {
          // Berechtigung verweigert - zeige Hinweis für Browser-Einstellungen
          console.log('[GPS] Permission denied - showing browser settings hint');
          showGPSSettingsHint();
        } else {
          // Berechtigung noch nicht entschieden - versuche GPS zu starten
          console.log('[GPS] Permission not decided - trying GPS...');
          initializeGPS();
        }
      }).catch(() => {
        // Fallback: Versuche GPS zu starten
        console.log('[GPS] Permission check failed - trying GPS as fallback...');
        initializeGPS();
      });
    } else {
      // Fallback für Browser ohne Permissions API
      console.log('[GPS] No permissions API - trying GPS directly...');
      initializeGPS();
    }
  }
  
  // Funktion: Zeige Hinweis für Browser-Einstellungen
  function showGPSSettingsHint() {
    // Erstelle ein Modal mit Hinweis für Browser-Einstellungen
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0,0,0,0.8);
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
      background: #222;
      padding: 2rem;
      border-radius: 1rem;
      max-width: 90vw;
      text-align: center;
      color: white;
    `;
    
    content.innerHTML = `
      <h2 style="margin-bottom: 1rem;">GPS-Berechtigung erforderlich</h2>
      <p style="margin-bottom: 1.5rem; color: #ccc; font-size: 1.1rem;">
        GPS wurde in den Browser-Einstellungen blockiert. Um deinen Standort zu verwenden, musst du die Berechtigung manuell aktivieren:
      </p>
      <div style="margin-bottom: 1.5rem; text-align: left; background: #333; padding: 1rem; border-radius: 0.5rem;">
        <h3 style="margin-bottom: 0.5rem;">Chrome/Edge:</h3>
        <p style="margin-bottom: 0.5rem; color: #ccc;">1. Klicke auf das Schloss-Symbol in der Adressleiste</p>
        <p style="margin-bottom: 0.5rem; color: #ccc;">2. Ändere "Standort" von "Blockiert" zu "Erlauben"</p>
        <p style="margin-bottom: 1rem; color: #ccc;">3. Lade die Seite neu</p>
        
        <h3 style="margin-bottom: 0.5rem;">Firefox:</h3>
        <p style="margin-bottom: 0.5rem; color: #ccc;">1. Klicke auf das Schloss-Symbol in der Adressleiste</p>
        <p style="margin-bottom: 0.5rem; color: #ccc;">2. Klicke auf "Berechtigungen verwalten"</p>
        <p style="margin-bottom: 0.5rem; color: #ccc;">3. Ändere "Standortzugriff" zu "Erlauben"</p>
        <p style="margin-bottom: 1rem; color: #ccc;">4. Lade die Seite neu</p>
        
        <h3 style="margin-bottom: 0.5rem;">Safari:</h3>
        <p style="margin-bottom: 0.5rem; color: #ccc;">1. Safari → Einstellungen → Websites → Standort</p>
        <p style="margin-bottom: 0.5rem; color: #ccc;">2. Finde diese Website und ändere zu "Erlauben"</p>
        <p style="margin-bottom: 0.5rem; color: #ccc;">3. Lade die Seite neu</p>
      </div>
      <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
        <button onclick="window.location.reload()" style="padding: 0.9rem 2.2rem; font-size: 1.15rem; border-radius: 0.5rem; background: #4CAF50; color: #fff; border: none; cursor: pointer; font-weight: 600;">
          🔄 Seite neu laden
        </button>
        <button onclick="this.closest('.gps-settings-modal').remove()" style="padding: 0.9rem 2.2rem; font-size: 1.15rem; border-radius: 0.5rem; background: #666; color: #fff; border: none; cursor: pointer; font-weight: 600;">
          Schließen
        </button>
      </div>
    `;
    
    content.className = 'gps-settings-modal';
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // Schließe Modal bei Klick außerhalb
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  function stopGPSTracking() {
    if (gpsWatchId !== null) {
      navigator.geolocation.clearWatch(gpsWatchId);
      gpsWatchId = null;
      console.log('[GPS] Tracking gestoppt');
    }
  }
  
  // NEU: Funktion zum Speichern von GPS-Daten
  function saveGPSData(lat: number, lon: number) {
    if (browser) {
      const gpsData = { lat, lon, timestamp: Date.now() };
      localStorage.setItem('userGps', JSON.stringify(gpsData));
      console.log('[GPS] Saved GPS data to localStorage:', gpsData);
    }
  }
  
  // NEU: Funktion zum Laden von GPS-Daten
  function loadGPSData() {
    if (browser) {
      try {
        const savedGPS = localStorage.getItem('userGps');
        if (savedGPS) {
          const gpsData = JSON.parse(savedGPS);
          const now = Date.now();
          const gpsAge = now - gpsData.timestamp;
          
          // Verwende gespeicherte GPS-Daten nur wenn sie nicht älter als 24 Stunden sind
          if (gpsData.lat && gpsData.lon && gpsAge < 24 * 60 * 60 * 1000) {
            console.log('[GPS] Loading saved GPS data:', gpsData);
            userLat = gpsData.lat;
            userLon = gpsData.lon;
            cachedLat = gpsData.lat;
            cachedLon = gpsData.lon;
            gpsStatus = 'active';
            lastGPSUpdateTime = gpsData.timestamp;
            
            // Update filterStore with saved GPS data
            filterStore.updateGpsStatus(true, { lat: userLat, lon: userLon });
            
            console.log('[GPS] Loaded GPS data:', { userLat, userLon, cachedLat, cachedLon });
            return true;
          } else {
            console.log('[GPS] Saved GPS data too old, clearing');
            localStorage.removeItem('userGps');
          }
        }
      } catch (error) {
        console.warn('[GPS] Error loading saved GPS data:', error);
        localStorage.removeItem('userGps');
      }
    }
    return false;
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
    let effectiveLat: number | undefined = undefined;
    let effectiveLon: number | undefined = undefined;
    
    // EINFACH: Verwende nur aktive GPS oder Fallback
    if (gpsStatus === 'active' && userLat !== null && userLon !== null) {
      effectiveLat = userLat;
      effectiveLon = userLon;
    } else if (gps?.lat && gps?.lon) {
      effectiveLat = gps.lat;
      effectiveLon = gps.lon;
    }
    
    const galleryParams: any = {};
    if (effectiveLat && effectiveLon) {
      galleryParams.lat = effectiveLat;
      galleryParams.lon = effectiveLon;
    }
    
    console.log('[Search-Clear] About to resetGallery with params:', galleryParams);
    console.log('[Search-Clear] GPS data:', { gps, userLat, userLon, effectiveLat, effectiveLon, gpsStatus });
    
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
    let effectiveLat: number | undefined = undefined;
    let effectiveLon: number | undefined = undefined;
    
    // EINFACH: Verwende nur aktive GPS oder Fallback
    if (gpsStatus === 'active' && userLat !== null && userLon !== null) {
      effectiveLat = userLat;
      effectiveLon = userLon;
    } else if (gps?.lat && gps?.lon) {
      effectiveLat = gps.lat;
      effectiveLon = gps.lon;
    }
    
    const galleryParams: any = {};
    if (effectiveLat && effectiveLon) {
      galleryParams.lat = effectiveLat;
      galleryParams.lon = effectiveLon;
    }
    
    console.log('[Location-Clear] About to resetGallery with params:', galleryParams);
    console.log('[Location-Clear] GPS data:', { gps, userLat, userLon, effectiveLat, effectiveLon, gpsStatus });
    
    // Kurze Verzögerung um sicherzustellen dass clearLocationFilter abgeschlossen ist
    setTimeout(() => {
      // Only reset normal gallery, mobile gallery handles its own state
      if (!isManual3x3Mode) {
        // Setze fromItem, wenn Location-Filter aktiv
        if ($filterStore.locationFilter) {
          galleryParams.fromItem = true;
          galleryParams.locationFilterLat = $filterStore.locationFilter.lat;
          galleryParams.locationFilterLon = $filterStore.locationFilter.lon;
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
    // EINFACH: Verwende nur aktive GPS oder Fallback
    if (gpsStatus === 'active' && userLat !== null && userLon !== null) {
      // Aktive GPS verwenden
      effectiveLat = userLat;
      effectiveLon = userLon;
    } else if (gps?.lat && gps?.lon) {
      // Fallback auf filterStore GPS
      effectiveLat = gps.lat;
      effectiveLon = gps.lon;
    } else {
      effectiveLat = null;
      effectiveLon = null;
    }
    
    // EINFACH: Bessere Logging für GPS-Priorität
    if (browser) {
      console.log('[GPS-Priority] Effective GPS calculation:', {
        gpsStatus,
        gpsSource: gps?.source,
        gpsFromItem: gps?.fromItem,
        effectiveLat,
        effectiveLon,
        hasLocationFilter: $filterStore.locationFilter !== null,
        locationFilter: $filterStore.locationFilter,
        userLat,
        userLon
      });
    }
    
    // NEU: Mache GPS-Koordinaten global verfügbar für galleryStore
    if (typeof window !== 'undefined') {
      (window as any).userLat = effectiveLat;
      (window as any).userLon = effectiveLon;
    }
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



  // Event-basierte Audioguide-Updates für Simulation
  function updateAudioguideForSimulation() {
    if (simulationMode && autoguide && isManual3x3Mode) {
      console.log('🎤 [Simulation] Manual audioguide update triggered');
      setTimeout(() => {
        announceFirstImage();
      }, 200);
    }
  }

  // Funktion um Audioguide mit mobilem Galerie-Bild zu aktualisieren
  function updateAudioguideWithMobileImage(firstImage: any) {
    if (autoguide && isManual3x3Mode && firstImage) {
      console.log('🎤 Updating autoguide with mobile gallery image:', firstImage);
      
      // Verhindere doppelte Ansagen für dasselbe Bild
      if (firstImage.id === lastAnnouncedImageId) {
        console.log('🎤 Skipping duplicate announcement for same image:', firstImage.id);
        return;
      }
      
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
      
      console.log('🎤 Mobile gallery display title:', displayTitle);
      
      // Update the display title
      currentImageTitle = displayTitle;
      lastAnnouncedImageId = firstImage.id;
      
      // If autoguide and audio are activated, also speak it
      if (autoguide && audioActivated) {
        speakTitle(firstImage.title || firstImage.original_name || 'Bild ohne Titel', firstImage.id);
      }
    }
  }

  // NEU: Funktion zum manuellen Starten von GPS
  function startGPS() {
    console.log('[GPS] User requested GPS start');
    if (navigator.geolocation) {
      gpsStatus = 'checking';
      initializeGPS();
    } else {
      gpsStatus = 'unavailable';
    }
  }

</script>

{#if browser && (gpsStatus === 'denied' || gpsStatus === 'unavailable') && !userLat && !userLon}
  <div style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(30,30,30,0.92);z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;">
    <div style="background:#222;padding:2rem 2.5rem;border-radius:1rem;box-shadow:0 2px 16px #0008;max-width:90vw;text-align:center;">
      <h2 style="color:#fff;margin-bottom:1rem;">Standort auswählen</h2>
      <p style="color:#ccc;font-size:1.1rem;margin-bottom:1.5rem;">
        {#if browser && gpsStatus === 'denied'}
          GPS ist nicht verfügbar. Wähle deinen Standort auf der Karte aus, um die Galerie nach Entfernung zu sortieren.
        {:else if browser && gpsStatus === 'unavailable'}
          GPS ist nicht verfügbar. Wähle deinen Standort auf der Karte aus, um die Galerie nach Entfernung zu sortieren.
        {:else}
          Keine GPS-Daten verfügbar. Wähle deinen Standort aus, um die Galerie nach Entfernung zu sortieren.
        {/if}
      </p>
      <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;">
        <button on:click={startGPS} style="padding: 0.9rem 2.2rem; font-size: 1.15rem; border-radius: 0.5rem; background: #3a7; color: #fff; border: none; cursor: pointer; font-weight:600;">
          📍 Standort verwenden
        </button>
        <button on:click={() => {
          // WICHTIG: Stoppe GPS-Watcher um Konflikte zu vermeiden
          if (gpsWatchId) {
            navigator.geolocation.clearWatch(gpsWatchId);
            gpsWatchId = null;
            console.log('[GPS-Modal] Stopped GPS watcher when user chose "Standort auf Karte auswählen"');
          }
          gpsStatus = 'none';
          showFullscreenMap = true;
        }} style="padding: 0.9rem 2.2rem; font-size: 1.15rem; border-radius: 0.5rem; background: #4CAF50; color: #fff; border: none; cursor: pointer; font-weight:600;">
          🗺️ Standort auf Karte auswählen
        </button>
        <button on:click={() => {
          // WICHTIG: Stoppe GPS-Watcher um Konflikte zu vermeiden
          if (gpsWatchId) {
            navigator.geolocation.clearWatch(gpsWatchId);
            gpsWatchId = null;
            console.log('[GPS-Modal] Stopped GPS watcher when user chose "Ohne Standort"');
          }
          gpsStatus = 'none';
        }} style="padding: 0.9rem 2.2rem; font-size: 1.15rem; border-radius: 0.5rem; background: #666; color: #fff; border: none; cursor: pointer; font-weight:600;">
          Ohne Standort fortfahren
        </button>
      </div>
      {#if browser && gpsStatus === 'denied'}
        <div style="margin-top:1.2rem;color:#f66;font-size:1.05rem;">
          Standort-Freigabe wurde abgelehnt.<br>Du kannst die Galerie trotzdem nutzen.
        </div>
      {/if}
      {#if browser && gpsStatus === 'unavailable'}
        <div style="margin-top:1.2rem;color:#f66;font-size:1.05rem;">
          Standort konnte nicht ermittelt werden.<br>Du kannst die Galerie trotzdem nutzen.
        </div>
      {/if}
    </div>
  </div>
{:else if browser && gpsStatus === 'checking'}
  <!-- GPS wird geladen - zeige Ladeindikator -->
  <div style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(30,30,30,0.92);z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;">
    <div style="background:#222;padding:2rem 2.5rem;border-radius:1rem;box-shadow:0 2px 16px #0008;max-width:90vw;text-align:center;">
      <h2 style="color:#fff;margin-bottom:1rem;">GPS wird geladen...</h2>
      <p style="color:#ccc;font-size:1.1rem;margin-bottom:1.5rem;">
        Bitte warte, während dein Standort ermittelt wird.
      </p>
      <div style="display:flex;justify-content:center;margin-top:1rem;">
        <div style="width:40px;height:40px;border:4px solid #3a7;border-top:4px solid transparent;border-radius:50%;animation:spin 1s linear infinite;"></div>
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    </div>
  </div>
{:else}
  <!-- Galerie-Komponenten und restliche Seite -->
  <FilterBar
    userLat={userLat}
    userLon={userLon}
    {showDistance}
    {isLoggedIn}
    gpsStatus={browser && typeof gpsStatus !== 'undefined' ? gpsStatus : 'none'}
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
                  initialItems={data.newsFlashItems || []}
                  currentPage={data.page || 1}
                  totalPages={data.totalPages || 1}
                  on:click={() => console.log('[Page] NewsFlash clicked, data:', data.newsFlashItems?.length || 0)}
                />
  {/if}
  <WelcomeSection />
  
  <!-- Autoguide Bar - nur im mobilen 3x3-Modus -->
  {#if isLoggedIn && autoguide && isManual3x3Mode}
    <div class="autoguide-bar {audioActivated ? 'audio-active' : 'audio-inactive'}">
      <div class="autoguide-content">
        <div class="autoguide-text">
          {#if simulationMode}
            {currentImageTitle || 'Simulation: Erster Bildtitel wird geladen...'}
          {:else}
            {currentImageTitle || (audioActivated ? 'Bildtitel werden vorgelesen' : 'Audio deaktiviert - Klicke auf den Lautsprecher')}
          {/if}
        </div>
        <button class="speaker-btn" on:click={() => {
          console.log('🎤 Speaker button clicked, audioActivated:', audioActivated);
          if (audioActivated) {
            console.log('🎤 Deactivating audio...');
            speechSynthesis?.cancel();
            audioActivated = false;
          } else {
            console.log('🎤 Activating audio...');
            activateAudioGuide();
            // Also announce first image after activation
            setTimeout(() => {
              console.log('🎤 Announcing first image after manual activation...');
              announceFirstImage();
            }, 1500);
          }
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
        </button>
      </div>
    </div>
  {/if}
  
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
      on:firstImageChanged={(event) => {
        console.log('🎤 Mobile gallery first image changed:', event.detail);
        if (autoguide && isManual3x3Mode) {
          // Update the first image title for autoguide
          const firstImage = event.detail;
          if (firstImage && firstImage.id !== lastAnnouncedImageId) {
            console.log('🎤 Updating autoguide for new first image from mobile gallery');
            updateAudioguideWithMobileImage(firstImage);
          }
        }
      }}
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
      userLat={effectiveLat}
      userLon={effectiveLon}
      {deviceHeading}
      {isManual3x3Mode}
      on:close={() => showFullscreenMap = false}
      on:imageClick={(event) => {
        const imageSlug = event.detail.imageSlug || event.detail.slug || event.detail.imageId;
        window.location.href = `/item/${imageSlug}`;
      }}
      on:locationSelected={(event) => {
        const { lat, lon } = event.detail;
        console.log('[FullscreenMap] Location selected:', lat, lon);
        
        // WICHTIG: Stoppe GPS-Watcher um Konflikte zu vermeiden
        if (gpsWatchId) {
          navigator.geolocation.clearWatch(gpsWatchId);
          gpsWatchId = null;
          console.log('[FullscreenMap] Stopped GPS watcher to prevent conflicts');
        }
        
        // Set the selected location as both active and cached GPS
        userLat = lat;
        userLon = lon;
        cachedLat = lat;
        cachedLon = lon;
        
        // Update GPS status to active (as if GPS was working)
        gpsStatus = 'active';
        lastGPSUpdateTime = Date.now();
        
        // Save to localStorage as "GPS gemerkt"
        if (browser) {
          localStorage.setItem('gpsAllowed', 'true');
          saveGPSData(lat, lon);
          console.log('[FullscreenMap] Saved selected location as GPS gemerkt:', { lat, lon });
        }
        
        // Update filterStore with the selected location
        filterStore.updateGpsStatus(true, { lat, lon });
        
        // Close the map
        showFullscreenMap = false;
        
        // Trigger gallery reload with new coordinates
        if (galleryInitialized) {
          console.log('[FullscreenMap] Reloading gallery with selected location');
          resetGallery({ lat, lon });
        }
      }}
    />
  {/if}
  <a class="impressum-link" href="/web/impressum" target="_blank" rel="noopener">Impressum</a>
  <a class="datenschutz-link" href="/web/datenschutz" target="_blank" rel="noopener">Datenschutz</a>
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

@media (max-width: 768px) {
  .autoguide-bar {
    padding: 0.5rem 0.75rem;
  }
  
  .autoguide-text {
    font-size: 0.9rem;
  }
}
</style>