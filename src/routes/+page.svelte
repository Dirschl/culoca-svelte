<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { onMount } from 'svelte';
  import { writable, get } from 'svelte/store';
  import GalleryLayout from '$lib/GalleryLayout.svelte';
  import NewsFlash from '$lib/NewsFlash.svelte';
  import FloatingActionButtons from '$lib/FloatingActionButtons.svelte';
  import FullscreenMap from '$lib/FullscreenMap.svelte';
  import WelcomeSection from '$lib/WelcomeSection.svelte';
  import FilterBar from '$lib/FilterBar.svelte';
  import { beforeNavigate, afterNavigate } from '$app/navigation';
  import { showPublicContentModal } from '$lib/modalStore';
  import { welcomeVisible, hideWelcome, dismissWelcome, isWelcomeDismissed } from '$lib/welcomeStore';
  import { filterStore, userFilter, locationFilter, hasActiveFilters } from '$lib/filterStore';
  import { page as pageStore } from '$app/stores';

  import { updateGalleryStats, galleryStats } from '$lib/galleryStats';
  import { sessionStore } from '$lib/sessionStore';
  import { authFetch } from '$lib/authFetch';


  const pics = writable<any[]>([]);
  let page = 0, size = 50, loading = false, hasMoreImages = true;
  let displayedImageCount = 0; // Zähler für tatsächlich angezeigte Bilder
  let removedDuplicatesList: any[] = []; // Liste der entfernten Duplikate
  let showRemovedDuplicates = false; // Flag zum Anzeigen der entfernten Duplikate
  

  
  // Reaktive Funktion: Update displayed count whenever pics store changes
  $: if ($pics) {
    const newCount = $pics.length;
    if (newCount !== displayedImageCount) {
      displayedImageCount = newCount;
      console.log(`📊 Angezeigte Bilder: ${displayedImageCount}/${$galleryStats.totalCount}`);
      
      // Event für NewsFlash-Komponente
      window.dispatchEvent(new CustomEvent('displayedImageCountChanged', {
        detail: { displayedCount: displayedImageCount, totalCount: $galleryStats.totalCount }
      }));
    }
  }
  
  // Reaktive Funktion: Reload gallery when filters change
  $: if ($filterStore && authChecked) {
    console.log('[Filter Change] Filter store changed, reloading gallery:', $filterStore);
    
    // Don't reload during search
    if (!searchQuery.trim() && !isSearching) {
      // Reset gallery state
      pics.set([]);
      page = 0;
      hasMoreImages = true;
      
      // Small delay to ensure filter state is properly set
      setTimeout(() => {
        loadMore('filter change');
      }, 100);
    }
  }
  
  // Funktion zum Entfernen von Duplikaten aus der Galerie
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
      
      // Store removed duplicates for display
      removedDuplicatesList = removedDuplicates;
      showRemovedDuplicates = true;
      
              pics.set(uniquePics);
    }
  }
  let useJustifiedLayout = true;
  let profileAvatar: string | null = null;
  let showDistance = false;
  let showCompass = false;
  let autoguide = false;
  let newsFlashMode: 'aus' | 'eigene' | 'alle' = 'alle';
  let showSearchField = false; // Default: Logo sichtbar, Suchfeld versteckt
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
  
  // Search functionality
  let searchQuery = '';
  let searchResults: any[] = [];
  let isSearching = false;
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;
  let searchInput: HTMLInputElement;

  // Login-Overlay Variablen
  let loginEmail = '';
  let loginPassword = '';
  let loginLoading = false;
  let loginError = '';
  let loginInfo = '';
  let showRegister = false;
  let authChecked = false; // Prüft, ob der Login-Status bereits geladen wurde

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
  const RADIUS_CHECK_INTERVAL = 60000; // 60 seconds - erhöht von 10s auf 60s
  let radiusCheckInterval: number | null = null;
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
    const LOAD_MORE_CHECK_INTERVAL = 2000; // Check every 2 seconds
    
        async function updateGPSFromSimulation(lat: number, lon: number) {
      const now = Date.now();
      
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
      
      // Only resort existing images, don't reload from server
      if ($pics.length > 0) {
        // Get current filter state for effective coordinates
        const currentFilters = get(filterStore);
        const hasLocationFilter = currentFilters.locationFilter !== null;
        const effectiveLat = hasLocationFilter ? currentFilters.locationFilter!.lat : userLat;
        const effectiveLon = hasLocationFilter ? currentFilters.locationFilter!.lon : userLon;
        
        const sortedPics = [...$pics].sort((a, b) => {
          const distA = a.lat && a.lon ? getDistanceInMeters(effectiveLat!, effectiveLon!, a.lat, a.lon) : Number.MAX_VALUE;
          const distB = b.lat && b.lon ? getDistanceInMeters(effectiveLat!, effectiveLon!, b.lat, b.lon) : Number.MAX_VALUE;
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
          checkAndLoadMoreImages();
        }
      } else {
        // Only load from server if no images are cached
        pics.set([]);
        page = 0;
        hasMoreImages = true;
        loadMore('gps simulation - no cached images');
      }
    }
    
    // VEREINFACHTE Check-Funktion: Weniger aggressiv, nur bei echtem Bedarf
    async function checkAndLoadMoreImages() {
      if (!userLat || !userLon || loading) {
        return;
      }
      
      const currentPics = get(pics);
      
      // Prüfe nur Bilder im direkten Umkreis
      const nearbyImages = currentPics.filter((pic: any) => {
        if (!pic.lat || !pic.lon) return false;
        const distance = getDistanceInMeters(userLat as number, userLon as number, pic.lat, pic.lon);
        return distance <= 5000; // 5km radius
      });
      
      console.log(`[Check] Position: ${userLat}, ${userLon}`);
      console.log(`[Check] Nearby images (5km): ${nearbyImages.length}/${currentPics.length}`);
      
      // Nur laden wenn wir gar keine Bilder in der Nähe haben
      if (nearbyImages.length === 0 && currentPics.length > 0) {
        console.log(`[Check] No nearby images found, loading from new position...`);
        showNoItemsMessage = true;
        
        // Nur komplett neu laden wenn optimierte Funktion verfügbar ist
        if (isLoggedIn && showDistance) {
          pics.set([]);
          page = 0;
          hasMoreImages = true;
          await loadMore('auto-load-new-area');
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



  function startGalleryPreload() {
    // Only preload if we're not already on the main page
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      console.log('Starting gallery preload in background...');
      
      // Load all images at once instead of batching
      loadAllImages();
    }
  }
  
  async function loadAllImages() {
    if (loading) return;
    
    console.log('Loading all images for preload...');
    loading = true;
    
    try {
      let data;
      
      // Use distance function if user has GPS coordinates and distance is enabled
      if (isLoggedIn && showDistance && userLat !== null && userLon !== null) {
        const result = await supabase
          .rpc('images_by_distance', {
            user_lat: userLat,
            user_lon: userLon,
            page: 0,
            page_size: 2000 // Load alle verfügbaren Bilder
          });
        data = result.data;
      } else {
        // FIXED: Use API instead of direct database query to ensure consistent privacy filtering
        let url = `/api/images?limit=2000&offset=0`;
        if (isLoggedIn && currentUser) {
          url += `&current_user_id=${currentUser.id}`;
        }
        
        console.log(`[Gallery] LoadAllImages using API: ${url}`);
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.status === 'success') {
          data = result.images;
          console.log(`[Gallery] LoadAllImages got ${data?.length || 0} images from API`);
        } else {
          console.error('[Gallery] LoadAllImages API error:', result.message);
          data = [];
        }
      }
      
      if (data) {
        const allPics = data.map((d: any) => ({
          id: d.id,
          src: d.path_512 ? `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${d.path_512}` : '',
          srcHD: d.path_2048 ? `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${d.path_2048}` : '',
          width: d.width,
          height: d.height,
          lat: d.lat,
          lon: d.lon,
          title: d.title,
          description: d.description,
          keywords: d.keywords,
          path_64: d.path_64,
          path_512: d.path_512,
          path_2048: d.path_2048,
          distance: d.distance || null
        })).filter((pic: any) => pic.path_512); // Filter out images without path_512

        pics.set(allPics);
        page = Math.ceil(allPics.length / size); // Page korrekt setzen
        hasMoreImages = false;
        
        // Announce first image if autoguide is enabled
        if (autoguide && allPics.length > 0) {
          console.log('🎤 Autoguide enabled and images loaded, announcing first image...');
          setTimeout(() => announceFirstImage(), 500);
        }
        
        // Update gallery stats
        const totalCount = await getTotalImageCount();
        updateGalleryStats(allPics.length, totalCount);
        
        console.log(`Preload complete: ${allPics.length} images loaded, total: ${totalCount}`);
      }
    } catch (error) {
      console.error('Error during preload:', error);
    } finally {
      loading = false;
    }
  }

  async function getTotalImageCount() {
    try {
      // Use the API to get the total count that respects privacy filtering
      let url = `/api/images?limit=1&offset=0`;
      if (isLoggedIn && currentUser) {
        url += `&current_user_id=${currentUser.id}`;
      }
      
      const response = await fetch(url);
      const result = await response.json();
      
      if (result.status === 'success') {
        console.log(`[Gallery] Total count from API: ${result.totalCount}`);
        return result.totalCount || 0;
      } else {
        console.error('Error getting total image count from API:', result.message);
        return 0;
      }
    } catch (error) {
      console.error('Error getting total image count:', error);
      return 0;
    }
  }

  async function loadMore(reason = 'default') {
    console.log(`[Gallery] loadMore called, reason: ${reason}, loading: ${loading}, hasMoreImages: ${hasMoreImages}, page: ${page}`);
    console.log(`[Gallery] Current state: isLoggedIn=${isLoggedIn}, currentUser=${currentUser?.id}, authChecked=${authChecked}`);
    
    // Verhindere zu häufiges Neuladen
    const now = Date.now();
    if (reason.includes('auto-load') && (now - lastGalleryLoadTime) < MIN_RELOAD_INTERVAL) {
      console.log(`[Gallery] Skipping auto-load, last load was ${(now - lastGalleryLoadTime)/1000}s ago`);
      return;
    }
    
    if (loading || !hasMoreImages) {
      console.log(`[Gallery] Skipping loadMore - loading: ${loading}, hasMoreImages: ${hasMoreImages}`);
      return;
    } 
    
    // Don't load more images if a search is active
    if (searchQuery.trim() || searchResults.length > 0) {
      console.log(`[Gallery] Skipping loadMore because search is active: "${searchQuery}"`);
      return;
    }
    
    loading = true;
    lastGalleryLoadTime = now;

    let data;
    
    // Get current filter state
    const currentFilters = get(filterStore);
    const hasUserFilter = currentFilters.userFilter !== null;
    const hasLocationFilter = currentFilters.locationFilter !== null;
    const effectiveLat = hasLocationFilter ? currentFilters.locationFilter!.lat : userLat;
    const effectiveLon = hasLocationFilter ? currentFilters.locationFilter!.lon : userLon;
    
    console.log(`[Gallery] Loading with filters:`, {
      hasUserFilter,
      hasLocationFilter,
      effectiveLat,
      effectiveLon,
      userFilter: currentFilters.userFilter?.username,
      locationFilter: currentFilters.locationFilter?.name
    });
    
    // Use GPS-based loading if location is available (from GPS or location filter)
    if ((isLoggedIn && showDistance && userLat !== null && userLon !== null) || hasLocationFilter) {
      const loadLat = effectiveLat!;
      const loadLon = effectiveLon!;
      console.log(`[Gallery] Loading images by distance from ${loadLat}, ${loadLon}`);
      
      // FIXED: For first few pages, use normal loading with GPS parameters for distance sorting
      if (page < 3) {
        console.log(`[Gallery] Page ${page} < 3, using normal loading with GPS parameters for distance sorting`);
        data = await loadImagesNormal();
      } else {
        try {
          // Use the optimized function with filter support for later pages
          const optimizedResult = await supabase.rpc('images_by_distance_optimized', {
            user_lat: loadLat,
            user_lon: loadLon,
            max_results: size,
            offset_count: page * size,
            filter_user_id: hasUserFilter ? currentFilters.userFilter!.userId : null
          });
          
          if (optimizedResult.error) {
            console.log('[Gallery] Optimized function not available, using fallback');
            // Fallback: Use API endpoint with filter support
            let fallbackUrl = `/api/images?limit=${size}&offset=${page * size}&lat=${loadLat}&lon=${loadLon}`;
            if (hasUserFilter) {
              fallbackUrl += `&filter_user_id=${currentFilters.userFilter!.userId}`;
            }
            if (isLoggedIn && currentUser) {
              fallbackUrl += `&current_user_id=${currentUser.id}`;
            }
            console.log(`[Gallery] GPS fallback from: ${fallbackUrl}`);
            const response = await fetch(fallbackUrl);
            const fallbackResult = await response.json();
            
            if (fallbackResult.status !== 'success') {
              console.error('[Gallery] Fallback API also failed:', fallbackResult.message);
              data = await loadImagesNormal();
            } else {
              data = fallbackResult.images;
              console.log(`[Gallery] Loaded ${data?.length || 0} images via fallback API`);
            }
          } else {
            data = optimizedResult.data;
            console.log(`[Gallery] Loaded ${data?.length || 0} images via optimized function (page ${page})`);
            
            // FIXED: If GPS mode returns too few images, fall back to normal mode
            if (data && data.length < 10 && page === 0) {
              console.log(`[Gallery] GPS mode returned only ${data.length} images, falling back to normal mode`);
              data = await loadImagesNormal();
            }
            
            // Let the main logic handle hasMoreImages based on total count
            console.log(`[Gallery] GPS optimized: got ${data?.length || 0} images`);
            // Don't set hasMoreImages here - let the main logic handle it
          }
        } catch (error) {
          console.error('[Gallery] Error with distance loading:', error);
          data = await loadImagesNormal();
        }
      }
    } else {
      // Normal mode: Use API endpoint with possible user filter
      if (hasUserFilter) {
        let url = `/api/images?limit=${size}&offset=${page * size}&filter_user_id=${currentFilters.userFilter!.userId}`;
        if (isLoggedIn && currentUser) {
          url += `&current_user_id=${currentUser.id}`;
        }
        console.log(`[Gallery] Loading with user filter from: ${url}`);
        const response = await fetch(url);
        const result = await response.json();
        if (result.status === 'success') {
          data = result.images;
          console.log(`[Gallery] Loaded ${data?.length || 0} images with user filter`);
        } else {
          console.error('[Gallery] Error loading with user filter:', result.message);
          data = await loadImagesNormal();
        }
      } else {
        // Normal pagination without filters
        console.log(`[Gallery] Loading images in normal mode...`);
        data = await loadImagesNormal();
      }
    }
    
    console.log(`[Gallery] Final data result:`, data ? `${data.length} images` : 'null/undefined');

    if (data && data.length > 0) {
      const newPics = data.map((d: any) => ({
        id: d.id,
        src: d.path_512 ? `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${d.path_512}` : '',
        srcHD: d.path_2048 ? `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${d.path_2048}` : '',
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
        distance: d.distance || null
      })).filter((pic: any) => pic.path_512);
      
      // Debug: Log sample dimensions
      if (newPics.length > 0) {
        console.log('[Gallery] Sample image dimensions:', newPics.slice(0, 3).map(p => ({
          id: p.id,
          width: p.width,
          height: p.height,
          hasSrc: !!p.src
        })));
      }
      
      // Prüfe auf Duplikate vor dem Hinzufügen
      const currentPics = get(pics);
      const existingIds = new Set(currentPics.map((p: any) => p.id));
      const uniqueNewPics = newPics.filter((pic: any) => !existingIds.has(pic.id));
      
      if (uniqueNewPics.length !== newPics.length) {
        console.log(`[Gallery] Filtered out ${newPics.length - uniqueNewPics.length} duplicate images`);
      }
      
      // Intelligente Bild-Verwaltung je nach Datenquelle
      if ((isLoggedIn && showDistance && userLat !== null && userLon !== null) || hasLocationFilter) {
        if (data[0]?.distance !== undefined) {
          // Optimierte Daten bereits sortiert - APPEND new images for pagination
          pics.update((p: any[]) => [...p, ...uniqueNewPics]);
          console.log(`[Gallery] Added ${uniqueNewPics.length} optimized images (already sorted by distance, total: ${$pics.length})`);
        } else {
          // GPS-Modus aber normale Daten - sortiere client-seitig nach Entfernung
          pics.update((p: any[]) => {
            // Bei GPS-Modus: Append new images, then sort all
            const allImages = [...p, ...uniqueNewPics];
            
            // Sortiere alle Bilder nach Entfernung (verwende effektive Koordinaten)
            const sortedImages = allImages.sort((a: any, b: any) => {
              const distA = a.lat && a.lon ? getDistanceInMeters(effectiveLat!, effectiveLon!, a.lat, a.lon) : Number.MAX_VALUE;
              const distB = b.lat && b.lon ? getDistanceInMeters(effectiveLat!, effectiveLon!, b.lat, b.lon) : Number.MAX_VALUE;
              return distA - distB;
            });
            
            console.log(`[Gallery] Client-side sorted ${sortedImages.length} images by distance from ${effectiveLat}, ${effectiveLon}`);
            return sortedImages;
          });
        }
      } else {
        // Normaler Modus ohne GPS - einfach anhängen
        pics.update((p: any[]) => [...p, ...uniqueNewPics]);
        console.log(`[Gallery] Added ${uniqueNewPics.length} unique images (total: ${$pics.length})`);
      }
      
      // Update gallery stats
      const totalCount = await getTotalImageCount();
      updateGalleryStats($pics.length, totalCount);
      
      // Check if we have more images to load - use normal pagination for ALL modes
      console.log(`[Gallery] Checking pagination: current=${$pics.length}, total=${totalCount}, hasMoreImages=${hasMoreImages}`);
      
      if ($pics.length >= totalCount) {
        hasMoreImages = false;
        console.log(`[Gallery] All images loaded: ${$pics.length} of ${totalCount}`);
      } else {
        hasMoreImages = true;
        console.log(`[Gallery] More images available: ${$pics.length} of ${totalCount}, hasMoreImages set to true`);
      }
      
      if (autoguide && uniqueNewPics.length > 0) {
        setTimeout(() => announceFirstImage(), 500);
      }
    } else {
      hasMoreImages = false;
      console.log(`[Gallery] No data returned, hasMoreImages set to false (page ${page})`);
    }

    // Erhöhe page für alle Modi (normaler Modus und GPS-Modus)
    page++;
    loading = false;
    console.log(`[Gallery] loadMore completed, page now: ${page}, total images: ${$pics.length}, hasMoreImages: ${hasMoreImages}`);
  }
  
  // Hilfsfunktion für normales Laden
  async function loadImagesNormal() {
    console.log(`[Gallery] Loading images with normal pagination, range: ${page * size} to ${page * size + size - 1}`);
    
    // SIMPLIFIED: Use the API endpoint that we know works
    try {
      // Add current user to query if logged in
      let url = `/api/images?limit=${size}&offset=${page * size}`;
      if (isLoggedIn && currentUser) {
        url += `&current_user_id=${currentUser.id}`;
      }
      
      // FIXED: Add GPS parameters for distance sorting if available
      if (userLat !== null && userLon !== null) {
        url += `&lat=${userLat}&lon=${userLon}`;
        console.log(`[Gallery Normal] Adding GPS parameters for distance sorting: ${userLat}, ${userLon}`);
      }
      
      console.log(`[Gallery Normal] Fetching from: ${url}`);
      const response = await fetch(url);
      const result = await response.json();
      
      console.log(`[Gallery Normal] API response:`, result);
      
      if (result.status === 'success') {
        // Don't set hasMoreImages to false here - let the main loadMore function handle it
        console.log(`[Gallery Normal] Got ${result.images?.length || 0} images, total available: ${result.totalCount || 0}, GPS mode: ${result.gpsMode}`);
        
        return result.images;
      } else {
        console.error('[Gallery Normal] API error:', result.message);
        return [];
      }
    } catch (error) {
      console.error('[Gallery Normal] Fetch error:', error);
      return [];
    }
  }



  // NEW: Function to load all user's own images without pagination limit
  async function loadAllUserImages() {
    console.log(`[Gallery] Loading ALL user images for: ${currentUser?.id}`);
    
    try {
      // Use a large limit to get all user images at once
      let url = `/api/images?limit=2000&offset=0&user_id=${currentUser.id}`;
      if (isLoggedIn && currentUser) {
        url += `&current_user_id=${currentUser.id}`;
      }
      
      console.log(`[Gallery AllUser] Fetching from: ${url}`);
      const response = await fetch(url);
      const result = await response.json();
      
      console.log(`[Gallery AllUser] API response:`, result);
      
      if (result.status === 'success') {
        console.log(`[Gallery AllUser] Got ${result.images?.length || 0} user images, total available: ${result.totalCount || 0}`);
        return result.images;
      } else {
        console.error('[Gallery AllUser] API error:', result.message);
        return [];
      }
    } catch (error) {
      console.error('[Gallery AllUser] Fetch error:', error);
      return [];
    }
  }

  // TEST: Function to create sample data for testing justified layout
  function createSampleImages() {
    const sampleImages = [
      {
        id: 'test1',
        src: 'https://picsum.photos/400/300?random=1',
        width: 400,
        height: 300,
        lat: 52.5200,
        lon: 13.4050,
        title: 'Sample Image 1',
        description: 'Test image for justified layout',
        distance: 150
      },
      {
        id: 'test2',
        src: 'https://picsum.photos/600/400?random=2',
        width: 600,
        height: 400,
        lat: 52.5201,
        lon: 13.4051,
        title: 'Sample Image 2',
        description: 'Test image for justified layout',
        distance: 250
      },
      {
        id: 'test3',
        src: 'https://picsum.photos/500/350?random=3',
        width: 500,
        height: 350,
        lat: 52.5202,
        lon: 13.4052,
        title: 'Sample Image 3',
        description: 'Test image for justified layout',
        distance: 350
      },
      {
        id: 'test4',
        src: 'https://picsum.photos/450/300?random=4',
        width: 450,
        height: 300,
        lat: 52.5203,
        lon: 13.4053,
        title: 'Sample Image 4',
        description: 'Test image for justified layout',
        distance: 450
      },
      {
        id: 'test5',
        src: 'https://picsum.photos/550/400?random=5',
        width: 550,
        height: 400,
        lat: 52.5204,
        lon: 13.4054,
        title: 'Sample Image 5',
        description: 'Test image for justified layout',
        distance: 550
      }
    ];
    
    pics.set(sampleImages);
    console.log('[TEST] Added sample images for justified layout testing');
  }

  let uploading = false;
  let uploadMessage = '';
  let uploadProgress = 0;
  let currentUploading = '';
  let uploadPreviews: string[] = [];
  let isDragOver = false;

  async function deleteAllImages() {
    if (!confirm('Wirklich ALLE Bilder löschen? Diese Aktion kann nicht rückgängig gemacht werden!')) {
      return;
    }

    try {
      uploading = true;
      uploadMessage = 'Lösche alle Bilder...';

      const response = await authFetch('/api/delete-all', { method: 'POST' });
      const result = await response.json();

      if (result.status === 'success') {
        uploadMessage = `✅ ${result.deletedCount} Bilder erfolgreich gelöscht!`;
        pics.set([]); // Clear the gallery
        page = 0; // Reset pagination
        hasMoreImages = true; // Reset for future uploads
        
        // Reset gallery stats
        updateGalleryStats(0, 0);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      const err = error as Error;
      uploadMessage = `❌ Fehler beim Löschen: ${err.message}`;
    } finally {
      uploading = false;
      setTimeout(() => {
        uploadMessage = '';
      }, 5000);
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
            
            // Sort by distance if user is logged in, has distance enabled, and has GPS coordinates
            if (isLoggedIn && showDistance && userLat !== null && userLon !== null) {
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
    const scrolledToBottom = scrollTop + clientHeight >= scrollHeight - 1000;

    if (scrolledToBottom) {
      console.log(`[Scroll] Reached bottom, loading more images... (current: ${$pics.length}, hasMoreImages: ${hasMoreImages}, loading: ${loading})`);
      loadMore('infinite scroll');
    }
  }

  function updateLayoutFromStorage() {
    if (typeof localStorage !== 'undefined') {
      const savedLayout = localStorage.getItem('galleryLayout');
      // Only update if there's a saved layout preference, otherwise keep justified
      if (savedLayout) {
        useJustifiedLayout = savedLayout === 'justified';
      } else {
        useJustifiedLayout = true; // Default to justified layout
      }
    }
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
      .select('show_distance, show_compass, autoguide, enable_search, use_justified_layout, newsflash_mode')
      .eq('id', user.id)
      .single();
    
    console.log('[Settings] Loading user settings:', data);
    
    showDistance = data?.show_distance ?? false;
    showCompass = data?.show_compass ?? false;
    autoguide = data?.autoguide ?? false;
          // Load showSearchField from localStorage (default: false = Logo visible)
      showSearchField = localStorage.getItem('showSearchField') === 'true';
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
    
    // Start GPS tracking if distance is enabled
    if (showDistance && navigator.geolocation) {
      // Nur GPS-Tracking starten, wenn wir noch keine gültigen Koordinaten haben
      if (userLat === null || userLon === null) {
        startGPSTracking();
      }
    } else {
      stopGPSTracking();
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

  // ESC key handler
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      closeDialogs();
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

  function startGPSTracking() {
    if (!navigator.geolocation || gpsTrackingActive) {
      console.log('🔄 [GPS] Already tracking or geolocation not available');
      return;
    }
    
    console.log('🔄 [GPS] Starting GPS tracking...');
    gpsStatus = 'checking';
    gpsTrackingActive = true;
    
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        gpsStatus = 'active';
        showGPSMessage = false;
        lastKnownLat = pos.coords.latitude;
        lastKnownLon = pos.coords.longitude;
        userLat = pos.coords.latitude;
        userLon = pos.coords.longitude;
        saveLastKnownLocation(userLat, userLon);
        console.log('🔄 [GPS] Active:', { lat: userLat, lon: userLon });
        
        // Resort existing images immediately for distance display
        resortExistingImages();
        
        // Wenn GPS-Koordinaten verfügbar sind, lade Bilder nach Entfernung sortiert
        // Aber nur wenn keine Suche aktiv ist
        if (userLat !== null && userLon !== null && !searchQuery.trim()) {
          pics.set([]);
          page = 0;
          hasMoreImages = true;
          loadMore('initial GPS mount');
        }
        
        gpsWatchId = navigator.geolocation.watchPosition(
          handlePositionUpdate,
          (error) => {
            console.error('GPS tracking error:', error);
            // Don't immediately mark as unavailable, keep the last known position
            // Only mark as unavailable if we haven't had an update in 5 minutes
            if (lastGPSUpdateTime && (Date.now() - lastGPSUpdateTime) > GPS_MEMORY_TIMEOUT) {
              gpsStatus = 'unavailable';
              showGPSMessage = true;
            }
          },
          { enableHighAccuracy: true, maximumAge: 1000, timeout: 3000 }
        );
        radiusCheckInterval = window.setInterval(checkRadiusForNewImages, RADIUS_CHECK_INTERVAL);
      },
      (error) => {
        console.error('Initial GPS error:', error);
        if (error.code === error.PERMISSION_DENIED) {
          gpsStatus = 'denied';
        } else {
          gpsStatus = 'unavailable';
        }
        showGPSMessage = false;
        gpsTrackingActive = false;
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function handlePositionUpdate(pos: GeolocationPosition) {
    // Ignore real GPS updates if GPS simulation is active
    if (gpsSimulationActive) {
      console.log('GPS simulation active, ignoring real GPS update');
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
    
    // Update GPS status and timestamp
    gpsStatus = 'active';
    lastGPSUpdateTime = Date.now();
    
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
      .limit(100) // Kleine Stichprobe
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
    const hasLocationFilter = currentFilters.locationFilter !== null;
    const effectiveLat = hasLocationFilter ? currentFilters.locationFilter!.lat : userLat;
    const effectiveLon = hasLocationFilter ? currentFilters.locationFilter!.lon : userLon;
    
    if ((!effectiveLat || !effectiveLon) || !$pics.length) return;
    
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

  function checkRadiusForNewImages() {
    if (!userLat || !userLon || !hasMoreImages || loading) return;
    
    // Don't load more images if a search is active
    if (searchQuery.trim() || searchResults.length > 0) {
      return;
    }

    // Sicherstellen, dass $pics ein Array ist
    const currentPics = Array.isArray($pics) ? $pics : [];

    const visibleImages = currentPics.filter((pic: any) => {
      if (!pic.lat || !pic.lon || !userLat || !userLon) return false;
      const distance = getDistanceInMeters(userLat, userLon, pic.lat, pic.lon);
      return distance <= 5000; // 5km radius
    });

    // NEUE PRÜFUNG: Auch hier den 100-Bilder-Schwellenwert für erweiterten Radius prüfen
    const widerRadiusImages = currentPics.filter((pic: any) => {
      if (!pic.lat || !pic.lon || !userLat || !userLon) return false;
      const distance = getDistanceInMeters(userLat, userLon, pic.lat, pic.lon);
      return distance <= 10000; // 10km radius für 100-Bilder-Check
    });

    // Priorität 1: Proaktives Nachladen bei weniger als 100 Bildern im 10km Umkreis
    if (widerRadiusImages.length < 100) {
      console.log(`[Radius Check] Only ${widerRadiusImages.length} images in 10km radius (< 100 threshold), proactively loading more for offline capability...`);
      loadMore('radius-check-proactive-100-threshold');
      return;
    }

    // Priorität 2: Standard-Check für 5km Radius
    if (visibleImages.length < 20) {
      console.log(`[Radius Check] Only ${visibleImages.length} images in 5km radius, loading more...`);
      loadMore('radius-check-standard');
    }
  }
  
  function stopGPSTracking() {
    if (gpsWatchId !== null) {
      navigator.geolocation.clearWatch(gpsWatchId);
      gpsWatchId = null;
    }
    if (radiusCheckInterval !== null) {
      clearInterval(radiusCheckInterval);
      radiusCheckInterval = null;
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
      pics.set([]);
      page = 0;
      hasMoreImages = true;
      loadMore('location from map');
    }
    
    console.log(`Location set from map: ${lat}, ${lon}`);
  }
  
  async function reloadGalleryWithNewPosition() {
    if (!isLoggedIn || !showDistance) return;
    
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
      pics.set([]);
      page = 0;
      hasMoreImages = true;
      
      // Versuche effizientes Nachladen von neuer Position
      await loadMoreEfficiently('teleportation-detected');
      return;
    }
    
    // Normale Positionsaktualisierung: Nur bestehende Bilder neu sortieren
    if (currentPics.length > 0) {
      console.log(`[Position Update] Resorting ${currentPics.length} existing images by new position`);
      
      // Get current filter state for effective coordinates
      const currentFilters = get(filterStore);
      const hasLocationFilter = currentFilters.locationFilter !== null;
      const effectiveLat = hasLocationFilter ? currentFilters.locationFilter!.lat : userLat;
      const effectiveLon = hasLocationFilter ? currentFilters.locationFilter!.lon : userLon;
      
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
      console.log('Back on main page, preload complete');
    }
  });

  let initialSearchParam = '';
  
      onMount(() => {
    (async () => {
    // SIMPLIFIED: Force initial gallery load for debugging
    console.log('🔄 [DEBUG] onMount - forcing immediate gallery load');
    
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
    
    // Handle search parameter from URL
    if (searchParam && searchParam.trim()) {
      searchQuery = searchParam.trim();
      // Perform search immediately if search parameter is present
      setTimeout(() => {
        performSearch(searchQuery, false); // Don't update URL since it's already there
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
    if (!gpsTrackingActive && !gpsSimulationActive) {
      console.log('🔄 [FORCE] Starting GPS tracking as fallback...');
      startGPSTracking();
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const wasAuthChecked = authChecked;
      isLoggedIn = !!session;
      currentUser = session?.user || null;
      authChecked = true;
      
      console.log(`🔐 Auth state changed: ${event}, isLoggedIn: ${isLoggedIn}, wasAuthChecked: ${wasAuthChecked}`);
      
      if (isLoggedIn) {
        await loadShowDistanceAndCompass();
        await loadProfileAvatar();
      } else {
        useJustifiedLayout = true;
        showDistance = false;
        showCompass = false;
        autoguide = false;
        newsFlashMode = 'alle';
        profileAvatar = null;
      }
      
      // Only load gallery on first auth check, not on subsequent auth changes
      if (!wasAuthChecked) {
        console.log('🔐 First auth check complete, loading gallery...');
        
        // Load gallery with proper auth context
        const sessionPics = sessionStorage.getItem('galleryPics');
        if (sessionPics) {
          pics.set(JSON.parse(sessionPics));
        } else {
                   // Load gallery based on distance settings
                    if (!initialSearchParam.trim()) {
             if (showDistance) {
               // For distance mode: only load if GPS is available
               const lastLocation = loadLastKnownLocation();
               if (lastLocation && lastLocation.lat !== null && lastLocation.lon !== null) {
                 userLat = lastLocation.lat;
                 userLon = lastLocation.lon;
                           gpsStatus = 'active';
          setTimeout(() => loadMore('initial mount with last known location'), 100);
               } else {
                 // No GPS data available
                 gpsStatus = 'unavailable';
                 showGPSMessage = false;
               }
             } else {
               // Normal mode: always load
               setTimeout(() => loadMore('initial mount normal'), 100);
             }
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
          showDistance = false;
          showCompass = false;
          autoguide = false;
          newsFlashMode = 'alle';
          profileAvatar = null;
        } else {
          await loadShowDistanceAndCompass();
          await loadProfileAvatar();
        }
        
        // Load gallery
        if (!initialSearchParam.trim()) {
          // Reset gallery state for fresh loading
          pics.set([]);
          page = 0;
          hasMoreImages = true;
          console.log('🔄 Reset gallery state for fallback loading');
          
          if (showDistance) {
            const lastLocation = loadLastKnownLocation();
            if (lastLocation && lastLocation.lat !== null && lastLocation.lon !== null) {
              userLat = lastLocation.lat;
              userLon = lastLocation.lon;
              gpsStatus = 'active';
              loadMore('fallback mount with last known location');
            } else {
              gpsStatus = 'unavailable';
              showGPSMessage = false;
            }
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
    
    // SIMPLIFIED: Force gallery load immediately after setup
    console.log('🔄 [DEBUG] Forcing immediate gallery load after setup');
    setTimeout(() => {
      console.log('🔄 [DEBUG] About to call loadMore from onMount');
      
      // TEST: First test the API directly
      authFetch('/api/images?limit=10&offset=0')
        .then(response => response.json())
        .then(result => {
          console.log('🔄 [DEBUG] Direct API test result:', result);
          if (result.status === 'success') {
            console.log('🔄 [DEBUG] API works, got', result.images?.length, 'images');
            loadMore('debug force load');
          } else {
            console.error('🔄 [DEBUG] API failed:', result.message);
          }
        })
        .catch(error => {
          console.error('🔄 [DEBUG] API test failed:', error);
        });
    }, 500);
    
    // DOUBLE SAFETY: Force another load after 2 seconds
    setTimeout(() => {
      console.log('🔄 [DEBUG] Second forced load attempt');
      if ($pics.length === 0) {
        console.log('🔄 [DEBUG] No pics loaded yet, forcing another load');
        loadMore('debug second force load');
      }
    }, 2000);
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
      pics.set([]);
      page = 0;
      hasMoreImages = true;
      await loadMoreEfficiently('auto-load-outside-coverage');
      return;
    }
    
    // NEUE PRÜFUNG: Proaktives Nachladen bei weniger als 100 Bildern im Umkreis
    // Dies passiert BEVOR der Benutzer den aktuellen Radius verlässt
    if (widerRadiusImages.length < 100 && hasMoreImages) {
      console.log(`[Auto-Load] Only ${widerRadiusImages.length} images in 10km radius (< 100 threshold), proactively loading more for offline capability...`);
      await loadMore('auto-load-proactive-100-threshold');
      return;
    }
    
    // If we have uncovered directions, load more to fill the gaps
    if (uncoveredDirections.length > 0 && hasMoreImages) {
      console.log(`[Auto-Load] Uncovered directions detected: ${uncoveredDirections.join(', ')}, loading more to fill gaps...`);
      await loadMore('auto-load-fill-coverage-gaps');
      return;
    }
    
    // If we have less than 10 nearby images, load more
    if (nearbyImages.length < 10 && hasMoreImages) {
      console.log(`[Auto-Load] Only ${nearbyImages.length} nearby images, loading more...`);
      await loadMore('auto-load-nearby');
    }
  }

  let showScrollToTop = false;

  // Search functions
    async function performSearch(query: string = searchQuery, updateURL: boolean = false) {
    if (!query.trim()) {
      searchResults = [];
      if (updateURL) {
        // Clear search from URL
        const url = new URL(window.location.href);
        url.searchParams.delete('s');
        window.history.replaceState({}, '', url.toString());
      }
      return;
    }
    
    isSearching = true;
    console.log('🔍 Performing search for:', query);
    
    // Update URL if requested
    if (updateURL) {
      const url = new URL(window.location.href);
      url.searchParams.set('s', query);
      window.history.replaceState({}, '', url.toString());
    }
    
    try {
      console.log('🔍 Search query:', query);
      
      // First, let's see what's in the database
      const { data: allData, error: allError } = await supabase
        .from('items')
        .select('id,title,description,keywords')
        .limit(5);
      
      console.log('🔍 Sample data from database:', allData);
      
      // Split query into individual terms for multi-term search
      const searchTerms = query.trim().split(/\s+/).filter(term => term.length > 0);
      console.log('🔍 Search terms:', searchTerms);
      
      // Build the search query with proper Supabase syntax
      // Search in title and description first
      let itemsQuery = supabase
        .from('items')
        .select('id,path_512,path_2048,path_64,width,height,lat,lon,title,description,keywords,profile_id')
        .limit(1000); // Get more data for client-side filtering
      
      // Exclude private items from search (using denormalized is_private field)
      itemsQuery = itemsQuery.eq('is_private', false);
      
      let { data, error } = await itemsQuery;
      
      if (error) {
        console.error('🔍 Supabase error:', error);
        throw error;
      }
      
      // Filter results client-side for multi-term search
      if (data && searchTerms.length > 0) {
        data = data.filter((img: any) => {
          const searchText = `${img.title || ''} ${img.description || ''}`.toLowerCase();
          
          // All search terms must be present (AND logic)
          return searchTerms.every(term => 
            searchText.includes(term.toLowerCase())
          );
        });
        
        console.log(`🔍 Title/description search found ${data.length} results for terms:`, searchTerms);
      }
      
      // If no results from title/description search, try searching in keywords
      if (!data || data.length === 0) {
        console.log('🔍 No results from title/description search, trying keywords...');
        
        // Get all images and filter by keywords on client side
        let allImagesQuery = supabase
          .from('items')
          .select('id,path_512,path_2048,path_64,width,height,lat,lon,title,description,keywords,profile_id')
          .limit(1000);
        
        // Apply privacy filtering for search (using denormalized is_private field)
        if (isLoggedIn && currentUser) {
          // For logged in users: show their own images (all) + other users' public images
          allImagesQuery = allImagesQuery.or(`profile_id.eq.${currentUser.id},is_private.eq.false,is_private.is.null`);
        } else {
          // For anonymous users: only show public images
          allImagesQuery = allImagesQuery.or('is_private.eq.false,is_private.is.null');
        }
        
        const { data: allImages, error: allError } = await allImagesQuery;
        
        if (allError) {
          console.error('🔍 Error fetching all images for keyword search:', allError);
          throw allError;
        }
        
        if (allImages) {
          // Filter images that have ALL search terms in their keywords (AND logic)
          data = allImages.filter((img: any) => {
            if (!img.keywords) return false;
            
            // Handle both array and string formats
            let keywords: string[] = [];
            if (Array.isArray(img.keywords)) {
              keywords = img.keywords;
            } else if (typeof img.keywords === 'string') {
              keywords = img.keywords.split(',').map((k: string) => k.trim());
            }
            
            // Check if ALL search terms are present in keywords (case insensitive)
            return searchTerms.every(searchTerm => 
              keywords.some((keyword: string) => 
                keyword.toLowerCase().includes(searchTerm.toLowerCase())
              )
            );
          });
          
          console.log(`🔍 Keyword search found ${data.length} results for terms:`, searchTerms);
        }
      }
      
      console.log('🔍 Raw search results:', data);
      
      if (data) {
        const searchPics = data.map((d: any) => ({
          id: d.id,
          src: d.path_512 ? `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${d.path_512}` : '',
          srcHD: d.path_2048 ? `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${d.path_2048}` : '',
          width: d.width,
          height: d.height,
          lat: d.lat,
          lon: d.lon,
          title: d.title,
          description: d.description,
          keywords: d.keywords,
          path_64: d.path_64,
          path_512: d.path_512,
          path_2048: d.path_2048
        })).filter((pic: any) => pic.path_512); // Filter out images without path_512
        
        // If user is logged in and has GPS coordinates or location filter, sort by distance
        const currentFilters = get(filterStore);
        const hasLocationFilter = currentFilters.locationFilter !== null;
        const effectiveLat = hasLocationFilter ? currentFilters.locationFilter!.lat : userLat;
        const effectiveLon = hasLocationFilter ? currentFilters.locationFilter!.lon : userLon;
        
        if ((isLoggedIn && userLat !== null && userLon !== null) || hasLocationFilter) {
          searchPics.sort((a: any, b: any) => {
            const distA = a.lat && a.lon && effectiveLat && effectiveLon ? getDistanceInMeters(effectiveLat, effectiveLon, a.lat, a.lon) : Number.MAX_VALUE;
            const distB = b.lat && b.lon && effectiveLat && effectiveLon ? getDistanceInMeters(effectiveLat, effectiveLon, b.lat, b.lon) : Number.MAX_VALUE;
            return distA - distB;
          });
        }
        
        searchResults = searchPics;
        pics.set(searchPics);
        
        // Update gallery stats
        const totalCount = await getTotalImageCount();
        updateGalleryStats(searchPics.length, totalCount);
        
        console.log(`🔍 Search found ${searchPics.length} results`);
        
        // Update placeholder with result count
        updateSearchPlaceholder();
      }
    } catch (error) {
      console.error('🔍 Search error:', error);
    } finally {
      isSearching = false;
    }
  }
  
  function clearSearch() {
    searchQuery = '';
    searchResults = [];
    
    // Clear search from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('s');
    window.history.replaceState({}, '', url.toString());
    
    // Reset placeholder
    updateSearchPlaceholder();
    
    // Reload original gallery
    pics.set([]);
    page = 0;
    hasMoreImages = true;
    loadMore('clear search');
  }
  
  function handleSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      performSearch(searchQuery, true); // URL aktualisieren
    }
  }
  
  function updateSearchPlaceholder() {
    if (searchResults.length > 0) {
      searchInput.placeholder = `${searchResults.length} Ergebnis${searchResults.length !== 1 ? 'se' : ''} gefunden`;
    } else if (searchQuery.trim()) {
      searchInput.placeholder = 'Keine Ergebnisse gefunden';
    } else {
      searchInput.placeholder = '';
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
      // If hiding search field, clear search
      clearSearch();
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

<!-- Dialoge für Upload und EXIF Upload -->
{#if showUploadDialog}
  <div class="dialog-overlay" on:click={closeDialogs}>
    <div class="dialog-content" on:click|stopPropagation>
      <div class="dialog-header">
        <h2>Bilder hochladen</h2>
        <button class="close-btn" on:click={closeDialogs}>×</button>
      </div>
      
      <div class="upload-section">
        <form on:submit|preventDefault={uploadImages}>
          <!-- Drag & Drop Zone -->
          <div 
            class="drop-zone"
            class:drag-over={isDragOver}
            class:uploading={uploading}
            on:dragover={handleDragOver}
            on:dragleave={handleDragLeave}
            on:drop={handleDrop}
            role="button"
            tabindex="0"
          >
            <div class="drop-content">
              {#if uploading}
                <div class="upload-icon">
                  <div class="spinner"></div>
                </div>
                <h3>Uploading...</h3>
                <p>Bitte warten...</p>
              {:else}
                <div class="upload-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                  </svg>
                </div>
                <h3>Bilder hier hinziehen</h3>
                <p>oder <span class="link-text">Dateien auswählen</span></p>
                <small>Nur JPEG- und WebP-Dateien erlaubt</small>
              {/if}
            </div>
            
            <input 
              type="file" 
              name="files" 
              multiple 
              accept="image/jpeg,image/jpg,image/webp" 
              disabled={uploading}
              class="file-input"
            />
          </div>

          <div class="upload-actions">
            <button type="submit" disabled={uploading} class="upload-btn">
              {uploading ? 'Uploading...' : 'Ausgewählte Bilder hochladen'}
            </button>
            <button 
              type="button" 
              class="delete-all-btn"
              on:click={deleteAllImages}
              disabled={uploading || $pics.length === 0}
            >
              🗑️ Alle Bilder löschen
            </button>
          </div>
        </form>
        
        <!-- Upload Progress -->
        {#if uploading}
          <div class="upload-progress">
            <div class="progress-info">
              <span class="current-file">{currentUploading}</span>
              <span class="progress-percent">{uploadProgress}%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: {uploadProgress}%"></div>
            </div>
          </div>
        {/if}

        <!-- Upload Previews -->
        {#if uploadPreviews.length > 0}
          <div class="upload-previews">
            <h4>Upload-Vorschau:</h4>
            <div class="preview-grid">
              {#each uploadPreviews as preview, i}
                <div class="preview-item">
                  <img src={preview} alt="Upload preview {i + 1}" />
                </div>
              {/each}
            </div>
          </div>
        {/if}
        
        {#if uploadMessage}
          <div class="upload-message" class:success={uploadMessage.includes('✅')} class:error={uploadMessage.includes('❌')}>
            {uploadMessage}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}



<!-- Search Bar or Culoca Logo -->
{#if isLoggedIn}
  {#if showSearchField}
    <div class="search-container">
      <div class="search-box">
        <!-- Culoca Logo SVG als klickbares Icon -->
        <svg class="culoca-icon" width="20" height="20" viewBox="0 0 83.86 100.88" fill="currentColor" on:click={toggleSearchField}>
          <path d="M0,41.35c0-5.67,1.1-11.03,3.29-16.07,2.19-5.04,5.19-9.43,8.98-13.17,3.79-3.74,8.25-6.69,13.36-8.86,5.11-2.17,10.54-3.25,16.29-3.25s11.18,1.08,16.29,3.25c5.11,2.17,9.56,5.12,13.36,8.86,3.79,3.74,6.79,8.13,8.98,13.17,2.19,5.04,3.29,10.4,3.29,16.07s-1.1,11.03-3.29,16.07c-2.2,5.04-5.19,9.43-8.98,13.17-3.8,3.74-8.25,6.7-13.36,8.86-5.11,2.17-9.49,21.42-15.25,21.42s-12.23-19.25-17.34-21.42c-5.11-2.17-9.56-5.12-13.36-8.86-3.79-3.74-6.79-8.13-8.98-13.17-2.2-5.04-3.29-10.4-3.29-16.07ZM25.16,41.35c0,2.29.44,4.43,1.32,6.44.88,2.01,2.07,3.76,3.59,5.26,1.52,1.5,3.29,2.68,5.33,3.55,2.04.87,4.21,1.3,6.53,1.3s4.49-.43,6.53-1.3c2.04-.87,3.81-2.05,5.33-3.55,1.52-1.5,2.71-3.25,3.59-5.26.88-2.01,1.32-4.15,1.32-6.44s-.44-4.43-1.32-6.44c-.88-2.01-2.08-3.76-3.59-5.26-1.52-1.5-3.29-2.68-5.33-3.55-2.03-.87-4.21-1.3-6.53-1.3s-4.49.43-6.53,1.3c-2.04.87-3.81,2.05-5.33,3.55-1.52,1.5-2.72,3.25-3.59,5.26-.88,2.01-1.32,4.16-1.32,6.44Z"/>
        </svg>
        <input 
          type="text" 
          placeholder=""
          bind:value={searchQuery}
          on:keydown={handleSearchKeydown}
          class="search-input"
          disabled={isSearching}
          bind:this={searchInput}
        />
        {#if searchQuery}
          <button class="clear-search-btn" on:click={clearSearch} disabled={isSearching}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        {/if}
        {#if isSearching}
          <div class="search-spinner"></div>
        {/if}
      </div>
    </div>
  {/if}
{/if}

<!-- Originales Culoca Logo (PNG) - immer sichtbar außer wenn Suchfeld aktiv ist -->
{#if !isLoggedIn || !showSearchField}
  <img 
    src="/culoca-logo-512px.png" 
    alt="Culoca" 
    class="culoca-logo"
    class:clickable={isLoggedIn}
    on:click|preventDefault={isLoggedIn ? toggleSearchField : undefined}
  />
{/if}



<!-- Filter Bar - at the very top of the page -->
        <FilterBar showOnMap={false} userLat={userLat} userLon={userLon} isPermalinkMode={isPermalinkMode} permalinkImageId={permalinkImageId} showDistance={showDistance} isLoggedIn={isLoggedIn} gpsStatus={gpsStatus} lastGPSUpdateTime={lastGPSUpdateTime} />

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
{#if isLoggedIn && $welcomeVisible && !isWelcomeDismissed()}
  <WelcomeSection 
    visible={$welcomeVisible}
    userName={currentUser?.user_metadata?.name || currentUser?.user_metadata?.full_name || 'Fotograf'}
    currentUserId={currentUser?.id || ''}
    onClose={() => hideWelcome()}
    onDismiss={() => dismissWelcome()}
  />
{/if}

<!-- Autoguide Bar -->
{#if isLoggedIn && autoguide}
  <div class="autoguide-bar {audioActivated ? 'audio-active' : 'audio-inactive'}">
    <div class="autoguide-content">
      <div class="autoguide-text">
        {currentImageTitle || (audioActivated ? 'Bildtitel werden vorgelesen' : 'Audio deaktiviert - Klicke auf den Lautsprecher')}
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

<!-- Floating Action Buttons -->
{#if isLoggedIn}
  <FloatingActionButtons 
    {showScrollToTop}
    showTestMode={true}
    showMapButton={$pics.some(pic => pic.lat && pic.lon)}
    {isLoggedIn}
    {simulationMode}
    {profileAvatar}
    on:upload={() => location.href = '/bulk-upload'}
    on:publicContent={() => showPublicContentModal.set(true)}
    on:bulkUpload={() => location.href = '/bulk-upload'}
    on:profile={() => location.href = '/profile'}
    on:settings={() => location.href = '/settings'}
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
{/if}

<!-- Galerie bleibt erhalten -->
<div class="gallery-container">
  <GalleryLayout
    items={$pics}
    layout={useJustifiedLayout ? 'justified' : 'grid'}
    gap={2}
    targetRowHeight={220}
    showDistance={isLoggedIn && showDistance}
    showCompass={isLoggedIn && showCompass}
    userLat={userLat}
    userLon={userLon}
    getDistanceFromLatLonInMeters={getDistanceFromLatLonInMeters}
  />
  
  {#if loading}
    <div class="loading-indicator">
      <div class="spinner"></div>
      <span>Lade weitere Bilder...</span>
    </div>
  {:else if $pics.length > 0}
    <div class="end-indicator">
      <span>✅ {displayedImageCount} Bilder angezeigt</span>
      
      {#if showRemovedDuplicates && removedDuplicatesList.length > 0}
        <div class="removed-duplicates-section">
          <h4>🗑️ Entfernte Duplikate ({removedDuplicatesList.length})</h4>
          <div class="removed-duplicates-grid">
            {#each removedDuplicatesList as duplicate}
              <div class="removed-duplicate-item">
                <img src={duplicate.src} alt={duplicate.title || 'Bild'} />
                <div class="duplicate-info">
                  <strong>ID:</strong> {duplicate.id}<br>
                  <strong>Titel:</strong> {duplicate.title || 'Kein Titel'}<br>
                  <strong>GPS:</strong> {duplicate.lat && duplicate.lon ? `${duplicate.lat.toFixed(6)}, ${duplicate.lon.toFixed(6)}` : 'Keine GPS-Daten'}
                </div>
              </div>
            {/each}
          </div>
          <button class="hide-duplicates-btn" on:click={() => showRemovedDuplicates = false}>
            Liste ausblenden
          </button>
        </div>
      {/if}
    </div>
  {/if}
  
  {#if $pics.length === 0 && !loading}
    <div class="empty-state">
      <h3>Noch keine Bilder vorhanden</h3>
      <p>Lade deine ersten Bilder hoch, um die Galerie zu starten!</p>
      <button on:click={createSampleImages} style="margin-top: 1rem; padding: 0.5rem 1rem; background: #0066cc; color: white; border: none; border-radius: 4px; cursor: pointer;">
        🧪 Test Justified Layout
      </button>
    </div>
  {/if}

  <!-- Keine Items in der Nähe Meldung -->
  {#if showNoItemsMessage}
    <div class="no-items-message">
      <div class="no-items-content">
        <div class="no-items-icon">📍</div>
        <h3>Dieses Gebiet ist noch nicht erschlossen</h3>
        <p>In einem Umkreis von 5km sind keine Bilder verfügbar.</p>
        <p><strong>Du kannst dazu beitragen, dieses Gebiet zu erschließen!</strong></p>
        <p>Lade deine eigenen Fotos mit GPS-Daten hoch und werde der erste, der diese Region auf Culoca präsentiert.</p>
        <div class="no-items-actions">
          <button class="map-nav-btn" on:click={() => showMap = true}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM10 5.47l4 1.4v11.66l-4-1.4V5.47z"/>
            </svg>
            Karte öffnen
          </button>
          <button class="dismiss-btn" on:click={() => showNoItemsMessage = false}>
            Verstanden
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Login Overlay für nicht eingeloggte User -->
  {#if !isLoggedIn && authChecked}
    <div class="modern-login-overlay">
      <div class="modern-login-content">
        <!-- Compact Logo -->
        <img src="/culoca-logo-512px.png" alt="Culoca Logo" class="modern-login-logo" />

        {#if loginError}
          <div class="modern-login-error">{loginError}</div>
        {/if}
        {#if loginInfo}
          <div class="modern-login-info">{loginInfo}</div>
        {/if}

        <!-- Social Login Buttons -->
        <div class="modern-social-login">
          <button class="modern-social-btn google-btn" on:click={() => loginWithProvider('google')} disabled={loginLoading}>
            <svg class="modern-social-icon" viewBox="0 0 48 48" fill="none">
              <g>
                <path fill="#4285F4" d="M24 9.5c3.54 0 6.7 1.22 9.19 3.23l6.85-6.85C36.45 2.36 30.68 0 24 0 14.82 0 6.71 5.06 2.69 12.44l7.98 6.2C12.13 13.13 17.62 9.5 24 9.5z"/>
                <path fill="#34A853" d="M46.1 24.5c0-1.64-.15-3.22-.42-4.74H24v9.01h12.42c-.54 2.9-2.18 5.36-4.65 7.03l7.19 5.6C43.98 37.13 46.1 31.3 46.1 24.5z"/>
                <path fill="#FBBC05" d="M9.67 28.64c-1.13-3.36-1.13-6.92 0-10.28l-7.98-6.2C-1.13 17.13-1.13 31.87 1.69 37.84l7.98-6.2z"/>
                <path fill="#EA4335" d="M24 46c6.48 0 11.92-2.14 15.9-5.82l-7.19-5.6c-2.01 1.35-4.6 2.15-8.71 2.15-6.38 0-11.87-3.63-14.33-8.94l-7.98 6.2C6.71 42.94 14.82 48 24 48z"/>
              </g>
            </svg>
          </button>
          <button class="modern-social-btn facebook-btn" on:click={() => loginWithProvider('facebook')} disabled={loginLoading}>
            <svg class="modern-social-icon" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="16" fill="white"/>
              <path d="M20.5 16H18V24H15V16H13.5V13.5H15V12.25C15 10.73 15.67 9 18 9H20.5V11.5H19.25C18.84 11.5 18.5 11.84 18.5 12.25V13.5H20.5L20 16Z" fill="#23272F"/>
            </svg>
          </button>
        </div>

        <!-- Login/Register Tabs -->
        <div class="modern-login-tabs">
          <button class="modern-tab-btn" class:active={!showRegister} on:click={() => showRegister = false}>
            Anmelden
          </button>
          <button class="modern-tab-btn" class:active={showRegister} on:click={() => showRegister = true}>
            Registrieren
          </button>
        </div>

        <!-- Login Form -->
        {#if !showRegister}
          <form class="modern-login-form" on:submit|preventDefault={loginWithEmail}>
            <input class="modern-login-input" type="email" placeholder="E-Mail" bind:value={loginEmail} required />
            <input class="modern-login-input" type="password" placeholder="Passwort" bind:value={loginPassword} required />
            <button class="modern-login-submit-btn" type="submit" disabled={loginLoading}>
              {loginLoading ? 'Anmelden...' : 'Anmelden'}
            </button>
            <button type="button" class="modern-forgot-password" on:click={resetPassword}>
              Passwort vergessen?
            </button>
          </form>
        {:else}
          <form class="modern-login-form" on:submit|preventDefault={signupWithEmail}>
            <input class="modern-login-input" type="email" placeholder="E-Mail" bind:value={loginEmail} required />
            <input class="modern-login-input" type="password" placeholder="Passwort" bind:value={loginPassword} required />
            <button class="modern-login-submit-btn" type="submit" disabled={loginLoading}>
              {loginLoading ? 'Registrieren...' : 'Registrieren'}
            </button>
          </form>
        {/if}

        <!-- Footer Links -->
        <div class="modern-login-footer">
          <div class="modern-footer-links">
            <a href="/impressum" class="modern-footer-link">Impressum</a>
            <span class="modern-footer-separator">•</span>
            <a href="/datenschutz" class="modern-footer-link">Datenschutz</a>
          </div>
        </div>
      </div>
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
    margin-left: 0.5rem;
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

  /* Modern Login Overlay */
  .modern-login-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, #0a1124 0%, #1a202c 100%);
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.3s ease-out;
  }

  .modern-login-content {
    background: rgba(26, 32, 44, 0.95);
    backdrop-filter: blur(20px);
    border-radius: 24px;
    padding: 2.5rem;
    text-align: center;
    max-width: 440px;
    width: 90%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(238, 114, 33, 0.3);
    position: relative;
    overflow: hidden;
  }

  .modern-login-content::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #ee7221, #ff8c42);
    border-radius: 24px 24px 0 0;
  }

  .modern-login-logo {
    width: 200px;
    height: 200px;
    margin: 0 auto 1.5rem;
    object-fit: contain;
    filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3));
  }

  .modern-login-error {
    background: linear-gradient(135deg, #dc3545, #c82333);
    color: #fff;
    padding: 1rem;
    border-radius: 12px;
    margin-bottom: 1.5rem;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
  }

  .modern-login-info {
    background: linear-gradient(135deg, #28a745, #218838);
    color: #fff;
    padding: 1rem;
    border-radius: 12px;
    margin-bottom: 1.5rem;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
  }

  .modern-social-login {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-bottom: 2rem;
  }

  .modern-social-btn {
    background: #fff;
    border: 2px solid #f0f0f0;
    border-radius: 16px;
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .modern-social-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
    border-color: #ee7221;
  }

  .modern-social-btn:active {
    transform: translateY(0);
  }

  .modern-social-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .modern-social-icon {
    width: 32px;
    height: 32px;
  }

  .modern-login-tabs {
    display: flex;
    margin-bottom: 2rem;
    border-radius: 12px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .modern-tab-btn {
    flex: 1;
    padding: 0.75rem 1rem;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
  }

  .modern-tab-btn.active {
    background: linear-gradient(135deg, #ee7221, #ff8c42);
    color: #fff;
    box-shadow: 0 2px 8px rgba(238, 114, 33, 0.3);
  }

  .modern-tab-btn:not(.active):hover {
    background: rgba(238, 114, 33, 0.2);
    color: #ee7221;
  }

  .modern-login-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .modern-login-input {
    width: 100%;
    padding: 1rem;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.9);
    color: #2d3748;
    font-size: 1rem;
    box-sizing: border-box;
    transition: all 0.3s ease;
  }

  .modern-login-input::placeholder {
    color: #718096;
  }

  .modern-login-input:focus {
    outline: none;
    border-color: #ee7221;
    box-shadow: 0 0 0 4px rgba(238, 114, 33, 0.2);
    background: rgba(255, 255, 255, 0.95);
  }

  .modern-login-submit-btn {
    width: 100%;
    padding: 1rem;
    background: linear-gradient(135deg, #ee7221, #ff8c42);
    color: #fff;
    border: none;
    border-radius: 12px;
    font-weight: 700;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px rgba(238, 114, 33, 0.3);
  }

  .modern-login-submit-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #d6610a, #ee7221);
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(238, 114, 33, 0.4);
  }

  .modern-login-submit-btn:active {
    transform: translateY(0);
  }

  .modern-login-submit-btn:disabled {
    background: linear-gradient(135deg, #6c757d, #495057);
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .modern-forgot-password {
    background: none;
    border: none;
    color: #ee7221;
    font-size: 0.9rem;
    cursor: pointer;
    padding: 0.5rem 0;
    text-decoration: underline;
    transition: color 0.3s ease;
  }

  .modern-forgot-password:hover {
    color: #d6610a;
  }

  .modern-login-footer {
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
  }

  .modern-footer-links {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .modern-footer-link {
    color: rgba(255, 255, 255, 0.7);
    text-decoration: none;
    transition: color 0.3s ease;
  }

  .modern-footer-link:hover {
    color: #ee7221;
  }

  .modern-footer-separator {
    color: rgba(255, 255, 255, 0.5);
    font-weight: bold;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @media (max-width: 600px) {
    .modern-login-content {
      padding: 1.5rem;
      margin: 1rem;
      border-radius: 20px;
    }
    
    .modern-login-logo {
      width: 160px;
      height: 160px;
      margin-bottom: 1rem;
    }

    .modern-social-btn {
      width: 56px;
      height: 56px;
    }

    .modern-social-icon {
      width: 28px;
      height: 28px;
    }

    .modern-login-input,
    .modern-login-submit-btn {
      padding: 0.875rem;
      font-size: 0.95rem;
    }
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

  /* End indicator and duplicate removal */
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
  
  .remove-duplicates-btn {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 8px 16px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .remove-duplicates-btn:hover {
    background: var(--accent-color);
    color: white;
  }

  /* Removed duplicates section */
  .removed-duplicates-section {
    margin-top: 20px;
    padding: 20px;
    background: var(--bg-secondary);
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }

  .removed-duplicates-section h4 {
    margin: 0 0 15px 0;
    color: var(--text-primary);
    font-size: 1.1em;
  }

  .removed-duplicates-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 15px;
    margin-bottom: 15px;
  }

  .removed-duplicate-item {
    display: flex;
    flex-direction: column;
    background: var(--bg-tertiary);
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid var(--border-color);
  }

  .removed-duplicate-item img {
    width: 100%;
    height: 120px;
    object-fit: cover;
  }

  .duplicate-info {
    padding: 10px;
    font-size: 0.8em;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  .hide-duplicates-btn {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 8px 16px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .hide-duplicates-btn:hover {
    background: var(--border-color);
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
  
  .impressum-modal-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.45);
    z-index: 3000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }
  
  .impressum-modal {
    background: var(--bg-primary);
    color: var(--text-primary);
    border-radius: 12px;
    max-width: 720px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 8px 32px var(--shadow);
    padding: 2.5rem 2rem 2rem 2rem;
    position: relative;
  }
  
  .impressum-modal h2 {
    margin: 0 0 2rem 0;
    font-size: 1.8rem;
    color: var(--text-primary);
  }
  
  .impressum-modal h3 {
    margin: 2.5rem 0 1rem 0;
    font-size: 1.3rem;
    color: var(--text-primary);
  }
  
  .impressum-modal p {
    margin: 0 0 1.5rem 0;
    line-height: 1.6;
    color: var(--text-secondary);
  }
  
  .impressum-modal a {
    color: var(--accent-color);
    text-decoration: none;
  }
  
  .impressum-modal a:hover {
    text-decoration: underline;
  }
  
  .impressum-close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: none;
    border: none;
    font-size: 2rem;
    color: var(--text-secondary);
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.2s;
  }
  
  .impressum-close:hover {
    opacity: 1;
    color: var(--accent-color);
  }
  
  @media (max-width: 600px) {
    .impressum-modal {
      max-width: 98vw;
      padding: 1.5rem 1rem 1rem 1rem;
    }
    
    .impressum-modal h2 {
      font-size: 1.5rem;
      margin-bottom: 1.5rem;
    }
    
    .impressum-modal h3 {
      font-size: 1.2rem;
      margin: 2rem 0 0.8rem 0;
    }
    




  /* Keine Items in der Nähe Meldung */
  .no-items-message {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .no-items-content {
    background: var(--bg-secondary);
    border-radius: 16px;
    padding: 2rem;
    max-width: 400px;
    width: 100%;
    text-align: center;
    border: 1px solid var(--border-color);
    box-shadow: 0 8px 32px var(--shadow);
  }

  .no-items-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    display: block;
  }

  .no-items-content h3 {
    margin: 0 0 1rem 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .no-items-content p {
    margin: 0 0 1rem 0;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .no-items-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1.5rem;
    flex-direction: column;
  }

  .map-nav-btn, .dismiss-btn {
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
      location.href = `/item/${event.detail.imageId}`;
    }}
    on:locationSelected={(event) => setLocationFromMap(event.detail.lat, event.detail.lon)}
  />
{/if}

<!-- Impressum-Link links unten -->
<a class="impressum-link" href="#" on:click|preventDefault={() => showImpressum = true}>Impressum</a>
<a class="datenschutz-link" href="#" on:click|preventDefault={() => showDatenschutz = true}>Datenschutz</a>

{#if showImpressum}
  <div class="impressum-modal-overlay" on:click={() => showImpressum = false}>
    <div class="impressum-modal" on:click|stopPropagation>
      <button class="impressum-close" on:click={() => showImpressum = false} title="Schließen">×</button>
      <section id="impressum">
        <h2>Impressum</h2>
        <p><strong>Autor, Herausgeber, Design und technische Umsetzung</strong><br>
        DIRSCHL.com GmbH<br>
        Waldberg 84<br>
        84571 Reischach<br>
        Deutschland</p>
        <p><strong>Geschäftsführer:</strong><br>
        Johann Dirschl</p>
        <p><strong>Kontakt:</strong><br>
        Mobil: 0179 9766666<br>
        Festnetz: 08670 5590127<br>
        E-Mail: <a href="mailto:johann.dirschl@gmx.de">johann.dirschl@gmx.de</a></p>
        <p><strong>Handelsregister:</strong><br>
        Amtsgericht Traunstein, HRB 18130</p>
        <p><strong>USt-IdNr.:</strong><br>
        DE258218256</p>
        <p><strong>Steuernummer:</strong><br>
        141/124/50220</p>
        <p><strong>Verantwortlich für den Inhalt gemäß § 55 Abs. 2 RStV:</strong><br>
        Johann Dirschl<br>
        Waldberg 84<br>
        84571 Reischach</p>
        <p><strong>Social Media:</strong><br>
        <a href="https://www.facebook.com/johann.dirschl" target="_blank" rel="noopener noreferrer">Facebook – DIRSCHL.com GmbH</a></p>
        <h3>Haftungsausschluss</h3>
        <p>Die Inhalte dieser Website wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte übernehmen wir jedoch keine Gewähr. Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte verantwortlich. Für Links auf externe Webseiten übernehmen wir keine Haftung – für deren Inhalte sind ausschließlich deren Betreiber verantwortlich.</p>
        <h3>Datenschutzerklärung</h3>
        <p>Bitte beachten Sie unsere <a href="#" on:click|preventDefault={() => { showImpressum = false; showDatenschutz = true; }}>Datenschutzerklärung</a>.</p>
        <h3>Allgemeine Geschäftsbedingungen (AGB)</h3>
        <p>Unsere vollständigen AGB finden Sie <a href="/agb">hier</a>.</p>
      </section>
    </div>
  </div>
{/if}

{#if showDatenschutz}
  <div class="impressum-modal-overlay" on:click={() => showDatenschutz = false}>
    <div class="impressum-modal" on:click|stopPropagation>
      <button class="impressum-close" on:click={() => showDatenschutz = false} title="Schließen">×</button>
      <section id="datenschutz">
        <h2>Datenschutzerklärung</h2>
        
        <h3>1. Datenschutz auf einen Blick</h3>
        
        <h4>Allgemeine Hinweise</h4>
        <p>Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten passiert, wenn Sie diese Website besuchen. Personenbezogene Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können. Ausführliche Informationen zum Thema Datenschutz entnehmen Sie unserer unter diesem Text aufgeführten Datenschutzerklärung.</p>
        
        <h4>Datenerfassung auf dieser Website</h4>
        <p><strong>Wer ist verantwortlich für die Datenerfassung auf dieser Website?</strong><br>
        Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber. Dessen Kontaktdaten können Sie dem Abschnitt „Hinweis zur Verantwortlichen Stelle" in dieser Datenschutzerklärung entnehmen.</p>
        
        <p><strong>Wie erfassen wir Ihre Daten?</strong><br>
        Ihre Daten werden zum einen dadurch erhoben, dass Sie uns diese mitteilen. Hierbei kann es sich z. B. um Daten handeln, die Sie in ein Kontaktformular eingeben. Andere Daten werden automatisch oder nach Ihrer Einwilligung beim Besuch der Website durch unsere IT-Systeme erfasst. Das sind vor allem technische Daten (z. B. Internetbrowser, Betriebssystem oder Uhrzeit des Seitenaufrufs). Die Erfassung dieser Daten erfolgt automatisch, sobald Sie diese Website betreten.</p>
        
        <p><strong>Wofür nutzen wir Ihre Daten?</strong><br>
        Ein Teil der Daten wird erhoben, um eine fehlerfreie Bereitstellung der Website zu gewährleisten. Andere Daten können zur Analyse Ihres Nutzerverhaltens verwendet werden.</p>
        
        <p><strong>Welche Rechte haben Sie bezüglich Ihrer Daten?</strong><br>
        Sie haben jederzeit das Recht, unentgeltlich Auskunft über Herkunft, Empfänger und Zweck Ihrer gespeicherten personenbezogenen Daten zu erhalten. Sie haben außerdem ein Recht, die Berichtigung oder Löschung dieser Daten zu verlangen. Wenn Sie eine Einwilligung zur Datenverarbeitung erteilt haben, können Sie diese Einwilligung jederzeit für die Zukunft widerrufen. Außerdem haben Sie das Recht, unter bestimmten Umständen die Einschränkung der Verarbeitung Ihrer personenbezogenen Daten zu verlangen. Des Weiteren steht Ihnen ein Beschwerderecht bei der zuständigen Aufsichtsbehörde zu. Hierzu sowie zu weiteren Fragen zum Thema Datenschutz können Sie sich jederzeit an uns wenden.</p>
        
        <h3>2. Hosting</h3>
        <p>Wir hosten unsere Website bei Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, USA. Vercel verarbeitet Daten im Auftrag und ist durch Standardvertragsklauseln der EU-Kommission zur Einhaltung europäischer Datenschutzstandards verpflichtet.</p>
        
        <h3>3. Allgemeine Hinweise und Pflichtinformationen</h3>
        
        <h4>Datenschutz</h4>
        <p>Die Betreiber dieser Seiten nehmen den Schutz Ihrer persönlichen Daten sehr ernst. Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend den gesetzlichen Datenschutzvorschriften sowie dieser Datenschutzerklärung. Wenn Sie diese Website benutzen, werden verschiedene personenbezogene Daten erhoben. Personenbezogene Daten sind Daten, mit denen Sie persönlich identifiziert werden können. Die vorliegende Datenschutzerklärung erläutert, welche Daten wir erheben und wofür wir sie nutzen. Sie erläutert auch, wie und zu welchem Zweck das geschieht. Wir weisen darauf hin, dass die Datenübertragung im Internet (z. B. bei der Kommunikation per E-Mail) Sicherheitslücken aufweisen kann. Ein lückenloser Schutz der Daten vor dem Zugriff durch Dritte ist nicht möglich.</p>
        
        <h4>Hinweis zur verantwortlichen Stelle</h4>
        <p>Die verantwortliche Stelle für die Datenverarbeitung auf dieser Website ist:</p>
        <p>DIRSCHL.com GmbH<br>
        Waldberg 84<br>
        84571 Reischach<br>
        Deutschland</p>
        <p>Telefon: 0179 9766666<br>
        E-Mail: johann.dirschl@gmx.de</p>
        <p>Verantwortliche Stelle ist die natürliche oder juristische Person, die allein oder gemeinsam mit anderen über die Zwecke und Mittel der Verarbeitung von personenbezogenen Daten (z. B. Namen, E-Mail-Adressen o. Ä.) entscheidet.</p>
        
        <h4>Speicherdauer</h4>
        <p>Soweit innerhalb dieser Datenschutzerklärung keine speziellere Speicherdauer genannt wurde, verbleiben Ihre personenbezogenen Daten bei uns, bis der Zweck für die Datenverarbeitung entfällt. Wenn Sie ein berechtigtes Löschersuchen geltend machen oder eine Einwilligung zur Datenverarbeitung widerrufen, werden Ihre Daten gelöscht, sofern wir keine anderen rechtlich zulässigen Gründe für die Speicherung Ihrer personenbezogenen Daten haben (z. B. steuer- oder handelsrechtliche Aufbewahrungsfristen); im letztgenannten Fall erfolgt die Löschung nach Fortfall dieser Gründe.</p>
        
        <h4>Allgemeine Hinweise zu den Rechtsgrundlagen der Datenverarbeitung auf dieser Website</h4>
        <p>Sofern Sie in die Datenverarbeitung eingewilligt haben, verarbeiten wir Ihre personenbezogenen Daten auf Grundlage von Art. 6 Abs. 1 lit. a DSGVO bzw. Art. 9 Abs. 2 lit. a DSGVO, sofern besondere Datenkategorien nach Art. 9 Abs. 1 DSGVO verarbeitet werden. Im Falle einer ausdrücklichen Einwilligung in die Übertragung personenbezogener Daten in Drittstaaten erfolgt die Datenverarbeitung außerdem auf Grundlage von Art. 49 Abs. 1 lit. a DSGVO. Sofern Sie in die Speicherung von Cookies oder in den Zugriff auf Informationen in Ihr Endgerät (z. B. via Device Fingerprinting) eingewilligt haben, erfolgt die Datenverarbeitung außerdem auf Grundlage von § 25 Abs. 1 TTDSG. Die Einwilligung ist jederzeit widerrufbar. Sind Ihre Daten zur Vertragserfüllung oder zur Durchführung vorvertraglicher Maßnahmen erforderlich, verarbeiten wir Ihre Daten auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO. Des Weiteren verarbeiten wir Ihre Daten, sofern diese zur Erfüllung einer rechtlichen Verpflichtung erforderlich sind auf Grundlage von Art. 6 Abs. 1 lit. c DSGVO. Die Datenverarbeitung kann ferner auf Grundlage unseres berechtigten Interesses nach Art. 6 Abs. 1 lit. f DSGVO erfolgen. Über die jeweils im Einzelfall einschlägigen Rechtsgrundlagen wird in den folgenden Absätzen dieser Datenschutzerklärung informiert.</p>
        
        <h4>Hinweis zur Datenweitergabe in die USA und andere Drittstaaten</h4>
        <p>Wir verwenden unter anderem Tools von Unternehmen mit Sitz in den USA oder anderen datenschutzrechtlich nicht sicheren Drittstaaten. Wenn diese Tools aktiv sind, können Ihre personenbezogenen Daten in diese Drittstaaten übertragen und dort verarbeitet werden. Wir weisen darauf hin, dass in diesen Ländern kein mit der EU vergleichbares Datenschutzniveau garantiert werden kann. Beispielsweise sind US-Unternehmen dazu verpflichtet, personenbezogene Daten an Sicherheitsbehörden herauszugeben, ohne dass Sie als Betroffener hiergegen gerichtlich vorgehen könnten. Es kann daher nicht ausgeschlossen werden, dass US-Behörden (z. B. Geheimdienste) Ihre auf US-Servern befindlichen Daten zu Überwachungszwecken verarbeiten, auswerten und dauerhaft speichern. Wir haben auf diese Verarbeitungstätigkeiten keinen Einfluss.</p>
        
        <h4>Widerruf Ihrer Einwilligung zur Datenverarbeitung</h4>
        <p>Viele Datenverarbeitungsvorgänge sind nur mit Ihrer ausdrücklichen Einwilligung möglich. Sie können eine bereits erteilte Einwilligung jederzeit widerrufen. Die Rechtmäßigkeit der bis zum Widerruf erfolgten Datenverarbeitung bleibt vom Widerruf unberührt.</p>
        
        <h4>Widerspruchsrecht gegen die Datenerhebung in besonderen Fällen sowie gegen Direktwerbung (Art. 21 DSGVO)</h4>
        <p>WENN DIE DATENVERARBEITUNG AUF GRUNDLAGE VON ART. 6 ABS. 1 LIT. E ODER F DSGVO ERFOLGT, HABEN SIE JEDERZEIT DAS RECHT, AUS GRÜNDEN, DIE SICH AUS IHRER BESONDEREN SITUATION ERGEBEN, GEGEN DIE VERARBEITUNG IHRER PERSONENBEZOGENEN DATEN WIDERSPRUCH EINZULEGEN; DIES GILT AUCH FÜR EIN AUF DIESE BESTIMMUNGEN GESTÜTZTES PROFILING. DIE JEWEILIGE RECHTSGRUNDLAGE, AUF DENEN EINE VERARBEITUNG BERUHT, ENTNEHMEN SIE DIESER DATENSCHUTZERKLÄRUNG. WENN SIE WIDERSPRUCH EINLEGEN, WERDEN WIR IHRE BETROFFENEN PERSONENBEZOGENEN DATEN NICHT MEHR VERARBEITEN, ES SEI DENN, WIR KÖNNEN ZWINGENDE SCHUTZWÜRDIGE GRÜNDE FÜR DIE VERARBEITUNG NACHWEISEN, DIE IHRE INTERESSEN, RECHTE UND FREIHEITEN ÜBERWIEGEN ODER DIE VERARBEITUNG DIENT DER GELTENDMACHUNG, AUSÜBUNG ODER VERTEIDIGUNG VON RECHTSANSPRÜCHEN (WIDERSPRUCH NACH ART. 21 ABS. 1 DSGVO). WENN IHRE PERSONENBEZOGENEN DATEN VERARBEITET WERDEN, UM DIREKTWERBUNG ZU BETREIBEN, HABEN SIE DAS RECHT, JEDERZEIT WIDERSPRUCH GEGEN DIE VERARBEITUNG SIE BETREFFENDER PERSONENBEZOGENER DATEN ZUM ZWECKE DERARTIGER WERBUNG EINZULEGEN; DIES GILT AUCH FÜR DAS PROFILING, SOWEIT ES MIT SOLCHER DIREKTWERBUNG IN VERBINDUNG STEHT. WENN SIE WIDERSPRECHEN, WERDEN IHRE PERSONENBEZOGENEN DATEN ANSCHLIESSEND NICHT MEHR ZUM ZWECKE DER DIREKTWERBUNG VERWENDET (WIDERSPRUCH NACH ART. 21 ABS. 2 DSGVO).</p>
        
        <h4>Beschwerderecht bei der zuständigen Aufsichtsbehörde</h4>
        <p>Im Falle von Verstößen gegen die DSGVO steht den Betroffenen ein Beschwerderecht bei einer Aufsichtsbehörde, insbesondere in dem Mitgliedstaat ihres gewöhnlichen Aufenthalts, ihres Arbeitsplatzes oder des Orts des mutmaßlichen Verstoßes zu. Das Beschwerderecht besteht unbeschadet anderweitiger verwaltungsrechtlicher oder gerichtlicher Rechtsbehelfe.</p>
        
        <h4>Recht auf Datenübertragbarkeit</h4>
        <p>Sie haben das Recht, Daten, die wir auf Grundlage Ihrer Einwilligung oder in Erfüllung eines Vertrags automatisiert verarbeiten, an sich oder an einen Dritten in einem gängigen, maschinenlesbaren Format aushändigen zu lassen. Sofern Sie die direkte Übertragung der Daten an einen anderen Verantwortlichen verlangen, erfolgt dies nur, soweit es technisch machbar ist.</p>
        
        <h4>Auskunft, Löschung und Berichtigung</h4>
        <p>Sie haben im Rahmen der geltenden gesetzlichen Bestimmungen jederzeit das Recht auf unentgeltliche Auskunft über Ihre gespeicherten personenbezogenen Daten, deren Herkunft und Empfänger und den Zweck der Datenverarbeitung sowie ein Recht auf Berichtigung oder Löschung dieser Daten. Hierzu sowie zu weiteren Fragen zum Thema personenbezogene Daten können Sie sich jederzeit an uns wenden.</p>
        
        <h4>Recht auf Einschränkung der Verarbeitung</h4>
        <p>Sie haben das Recht, die Einschränkung der Verarbeitung Ihrer personenbezogenen Daten zu verlangen. Hierzu können Sie sich jederzeit an uns wenden. Das Recht auf Einschränkung der Verarbeitung besteht in folgenden Fällen:</p>
        <ul>
          <li>Wenn Sie die Richtigkeit Ihrer bei uns gespeicherten personenbezogenen Daten bestreiten, benötigen wir in der Regel Zeit, um dies zu überprüfen. Für die Dauer der Prüfung haben Sie das Recht, die Einschränkung der Verarbeitung Ihrer personenbezogenen Daten zu verlangen.</li>
          <li>Wenn die Verarbeitung Ihrer personenbezogenen Daten unrechtmäßig geschah/geschieht, können Sie statt der Löschung die Einschränkung der Datenverarbeitung verlangen.</li>
          <li>Wenn wir Ihre personenbezogenen Daten nicht mehr benötigen, Sie sie jedoch zur Ausübung, Verteidigung oder Geltendmachung von Rechtsansprüchen benötigen, haben Sie das Recht, statt der Löschung die Einschränkung der Verarbeitung Ihrer personenbezogenen Daten zu verlangen.</li>
          <li>Wenn Sie einen Widerspruch nach Art. 21 Abs. 1 DSGVO eingelegt haben, muss eine Abwägung zwischen Ihren und unseren Interessen vorgenommen werden. Solange noch nicht feststeht, wessen Interessen überwiegen, haben Sie das Recht, die Einschränkung der Verarbeitung Ihrer personenbezogenen Daten zu verlangen.</li>
        </ul>
        
        <h4>SSL- bzw. TLS-Verschlüsselung</h4>
        <p>Diese Seite nutzt aus Sicherheitsgründen und zum Schutz der Übertragung vertraulicher Inhalte, wie zum Beispiel der Anfragen, die Sie an uns als Seitenbetreiber senden, eine SSL- bzw. TLS-Verschlüsselung. Eine verschlüsselte Verbindung erkennen Sie daran, dass die Adresszeile des Browsers von „http://" auf „https://" wechselt und an dem Schloss-Symbol in Ihrer Browserzeile. Wenn die SSL- bzw. TLS-Verschlüsselung aktiviert ist, können die Daten, die Sie an uns übermitteln, nicht von Dritten mitgelesen werden.</p>
        
        <h3>4. Datenerfassung auf dieser Website</h3>
        
        <h4>Cookies</h4>
        <p>Die Internetseiten verwenden teilweise so genannte Cookies. Cookies richten auf Ihrem Rechner keinen Schaden an und enthalten keine Viren. Cookies dienen dazu, unser Angebot nutzerfreundlicher, effektiver und sicherer zu machen. Cookies sind kleine Textdateien, die auf Ihrem Rechner abgelegt werden und die Ihr Browser speichert. Die meisten der von uns verwendeten Cookies sind so genannte „Session-Cookies". Sie werden nach Ende Ihres Besuchs automatisch gelöscht. Andere Cookies bleiben auf Ihrem Endgerät gespeichert, bis Sie diese löschen. Diese Cookies ermöglichen es uns, Ihren Browser beim nächsten Besuch wiederzuerkennen. Sie können Ihren Browser so einstellen, dass Sie über das Setzen von Cookies informiert werden und Cookies nur im Einzelfall erlauben, die Annahme von Cookies für bestimmte Fälle oder generell ausschließen sowie das automatische Löschen der Cookies beim Schließen des Browsers aktivieren. Bei der Deaktivierung von Cookies kann die Funktionalität dieser Website eingeschränkt sein.</p>
        
        <h4>Server-Log-Dateien</h4>
        <p>Der Provider der Seiten erhebt und speichert automatisch Informationen in so genannten Server-Log-Dateien, die Ihr Browser automatisch an uns übermittelt. Dies sind:</p>
        <ul>
          <li>Browsertyp und Browserversion</li>
          <li>verwendetes Betriebssystem</li>
          <li>Referrer URL</li>
          <li>Hostname des zugreifenden Rechners</li>
          <li>Uhrzeit der Serveranfrage</li>
          <li>IP-Adresse</li>
        </ul>
        <p>Eine Zusammenführung dieser Daten mit anderen Datenquellen wird nicht vorgenommen. Die Erfassung dieser Daten erfolgt auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO. Der Websitebetreiber hat ein berechtigtes Interesse an der technisch fehlerfreien Darstellung und der Optimierung seiner Website – hierzu müssen die Server-Log-Dateien erfasst werden.</p>
        
        <h4>Kontaktformular</h4>
        <p>Wenn Sie uns per Kontaktformular Anfragen zukommen lassen, werden Ihre Angaben aus dem Anfrageformular inklusive der von Ihnen dort angegebenen Kontaktdaten zwecks Bearbeitung der Anfrage und für den Fall von Anschlussfragen bei uns gespeichert. Diese Daten geben wir nicht ohne Ihre Einwilligung weiter. Die Verarbeitung dieser Daten erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO, sofern Ihre Anfrage mit der Erfüllung eines Vertrags zusammenhängt oder zur Durchführung vorvertraglicher Maßnahmen erforderlich ist. In allen übrigen Fällen beruht die Verarbeitung auf unserem berechtigten Interesse an der effektiven Bearbeitung der an uns gerichteten Anfragen (Art. 6 Abs. 1 lit. f DSGVO) oder auf Ihrer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), sofern diese abgefragt wurde; die Einwilligung ist jederzeit widerrufbar. Die von Ihnen im Kontaktformular eingegebenen Daten verbleiben bei uns, bis Sie uns zur Löschung auffordern, Ihre Einwilligung zur Speicherung widerrufen oder der Zweck für die Datenspeicherung entfällt (z. B. nach abgeschlossener Bearbeitung Ihrer Anfrage). Zwingende gesetzliche Bestimmungen – insbesondere Aufbewahrungsfristen – bleiben unberührt.</p>
        
        <h4>Anfrage per E-Mail, Telefon oder Telefax</h4>
        <p>Wenn Sie uns per E-Mail, Telefon oder Telefax kontaktieren, wird Ihre Anfrage inklusive aller daraus abgeleiteten personenbezogenen Daten (Name, Anfrage) zum Zwecke der Bearbeitung Ihres Anliegens bei uns gespeichert und verarbeitet. Diese Daten geben wir nicht ohne Ihre Einwilligung weiter. Die Verarbeitung dieser Daten erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO, sofern Ihre Anfrage mit der Erfüllung eines Vertrags zusammenhängt oder zur Durchführung vorvertraglicher Maßnahmen erforderlich ist. In allen übrigen Fällen beruht die Verarbeitung auf unserem berechtigten Interesse an der effektiven Bearbeitung der an uns gerichteten Anfragen (Art. 6 Abs. 1 lit. f DSGVO) oder auf Ihrer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), sofern diese abgefragt wurde; die Einwilligung ist jederzeit widerrufbar. Die von Ihnen an uns übermittelten Daten verbleiben bei uns, bis Sie uns zur Löschung auffordern, Ihre Einwilligung zur Speicherung widerrufen oder der Zweck für die Datenspeicherung entfällt (z. B. nach abgeschlossener Bearbeitung Ihres Anliegens). Zwingende gesetzliche Bestimmungen – insbesondere gesetzliche Aufbewahrungsfristen – bleiben unberührt.</p>
        
        <h3>5. Analyse-Tools und Tools von Drittanbietern</h3>
        <p>Beim Besuch dieser Website kann Ihr Surf-Verhalten statistisch ausgewertet werden. Das geschieht vor allem mit sogenannten Analyseprogrammen. Detaillierte Informationen zu diesen Analyseprogrammen finden Sie in der folgenden Datenschutzerklärung.</p>
        
        <h3>6. Newsletter</h3>
        <p>Falls Sie den auf der Website angebotenen Newsletter beziehen möchten, benötigen wir von Ihnen eine E-Mail-Adresse sowie Informationen, welche uns die Überprüfung gestatten, dass Sie der Inhaber der angegebenen E-Mail-Adresse sind und mit dem Empfang des Newsletters einverstanden sind (sog. Double-Opt-In). Weitere Daten werden nicht bzw. nur auf freiwilliger Basis erhoben. Diese Daten verwenden wir ausschließlich für den Versand der angeforderten Informationen und geben diese nicht an Dritte weiter. Die Verarbeitung der in das Newsletter-Anmeldeformular eingegebenen Daten erfolgt ausschließlich auf Grundlage Ihrer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Die erteilte Einwilligung zur Speicherung der Daten, der E-Mail-Adresse sowie deren Nutzung zum Versand des Newsletters können Sie jederzeit widerrufen, etwa über den „Austragen"-Link im Newsletter. Die Rechtmäßigkeit der bereits erfolgten Datenverarbeitungsvorgänge bleibt vom Widerruf unberührt. Die von Ihnen zum Zwecke des Newsletter-Bezugs bei uns hinterlegten Daten werden von uns bis zu Ihrer Austragung gespeichert und nach der Abmeldung des Newsletters sowohl von unseren Servern als auch von den Servern des Newsletter-Dienstleisters gelöscht. Sofern wir Ihnen Newsletter-Dienstleister mitteilen, erfolgt dies nur, wenn dies gesetzlich erforderlich ist oder eine gerichtliche Anordnung vorliegt.</p>
        
        <h3>7. Plugins und Tools</h3>
        
        <h4>Google Fonts (lokales Hosting)</h4>
        <p>Diese Seite nutzt zur einheitlichen Darstellung von Schriftarten so genannte Google Fonts, die von Google bereitgestellt werden. Die Google Fonts sind lokal installiert. Eine Verbindung zu Servern von Google findet dabei nicht statt. Weitere Informationen zu Google Fonts finden Sie unter <a href="https://developers.google.com/fonts/faq" target="_blank" rel="noopener noreferrer">https://developers.google.com/fonts/faq</a> und in der Datenschutzerklärung von Google: <a href="https://policies.google.com/privacy?hl=de" target="_blank" rel="noopener noreferrer">https://policies.google.com/privacy?hl=de</a>.</p>
        
        <h4>Google Maps</h4>
        <p>Diese Seite nutzt den Kartendienst Google Maps. Anbieter ist die Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland. Zur Nutzung der Funktionen von Google Maps ist es notwendig, Ihre IP-Adresse zu speichern. Diese Informationen werden in der Regel an einen Server von Google in den USA übertragen und dort gespeichert. Der Anbieter dieser Seite hat keinen Einfluss auf diese Datenübertragung. Die Nutzung von Google Maps erfolgt im Interesse einer ansprechenden Darstellung unserer Online-Angebote und an einer leichten Auffindbarkeit der von uns auf der Website angegebenen Orte. Dies stellt ein berechtigtes Interesse im Sinne von Art. 6 Abs. 1 lit. f DSGVO dar. Sofern eine entsprechende Einwilligung abgefragt wurde, erfolgt die Verarbeitung ausschließlich auf Grundlage von Art. 6 Abs. 1 lit. a DSGVO und § 25 Abs. 1 TTDSG, soweit die Einwilligung die Speicherung von Cookies oder den Zugriff auf Informationen im Endgerät des Nutzers (z. B. Device Fingerprinting) umfasst. Die Einwilligung ist jederzeit widerrufbar. Mehr Informationen zum Umgang mit Nutzerdaten finden Sie in der Datenschutzerklärung von Google: <a href="https://policies.google.com/privacy?hl=de" target="_blank" rel="noopener noreferrer">https://policies.google.com/privacy?hl=de</a>.</p>
        
        <h3>8. Eigene Dienste</h3>
        
        <h4>Bewerbung und Bewerbungsverfahren</h4>
        <p>Wir erheben und verarbeiten personenbezogene Daten von Bewerbern zum Zwecke der Bewerbungsabwicklung. Die Verarbeitung kann auch auf elektronischem Wege erfolgen. Dies ist insbesondere dann der Fall, wenn ein Bewerber entsprechende Bewerbungsunterlagen auf elektronischem Wege, etwa per E-Mail oder über ein auf der Website befindliches Webformular, an uns übermittelt. Schließen wir einen Anstellungsvertrag mit einem Bewerber, werden die übermittelten Daten zum Zwecke der Abwicklung des Beschäftigungsverhältnisses unter Beachtung der gesetzlichen Vorschriften gespeichert. Wird von uns kein Anstellungsvertrag mit dem Bewerber geschlossen, so werden die Bewerbungsunterlagen zwei Monate nach Bekanntgabe der Ablehnungsentscheidung automatisch gelöscht, sofern einer Löschung keine sonstigen berechtigten Interessen unsererseits entgegenstehen. Ein sonstiges berechtigtes Interesse liegt in diesem Sinne zum Beispiel in einem Beweisverfahren in einem Verfahren nach dem Allgemeinen Gleichbehandlungsgesetz (AGG).</p>
        
        <h3>9. Datenschutz für Bewerbungen und im Bewerbungsverfahren</h3>
        <p>Wir erheben und verarbeiten personenbezogene Daten von Bewerbern zum Zwecke der Bewerbungsabwicklung. Die Verarbeitung kann auch auf elektronischem Wege erfolgen. Dies ist insbesondere dann der Fall, wenn ein Bewerber entsprechende Bewerbungsunterlagen auf elektronischem Wege, etwa per E-Mail oder über ein auf der Website befindliches Webformular, an uns übermittelt. Schließen wir einen Anstellungsvertrag mit einem Bewerber, werden die übermittelten Daten zum Zwecke der Abwicklung des Beschäftigungsverhältnisses unter Beachtung der gesetzlichen Vorschriften gespeichert. Wird von uns kein Anstellungsvertrag mit dem Bewerber geschlossen, so werden die Bewerbungsunterlagen zwei Monate nach Bekanntgabe der Ablehnungsentscheidung automatisch gelöscht, sofern einer Löschung keine sonstigen berechtigten Interessen unsererseits entgegenstehen. Ein sonstiges berechtigtes Interesse liegt in diesem Sinne zum Beispiel in einem Beweisverfahren in einem Verfahren nach dem Allgemeinen Gleichbehandlungsgesetz (AGG).</p>
        
        <h3>10. Datenschutz für Bewerbungen und im Bewerbungsverfahren</h3>
        <p>Wir erheben und verarbeiten personenbezogene Daten von Bewerbern zum Zwecke der Bewerbungsabwicklung. Die Verarbeitung kann auch auf elektronischem Wege erfolgen. Dies ist insbesondere dann der Fall, wenn ein Bewerber entsprechende Bewerbungsunterlagen auf elektronischem Wege, etwa per E-Mail oder über ein auf der Website befindliches Webformular, an uns übermittelt. Schließen wir einen Anstellungsvertrag mit einem Bewerber, werden die übermittelten Daten zum Zwecke der Abwicklung des Beschäftigungsverhältnisses unter Beachtung der gesetzlichen Vorschriften gespeichert. Wird von uns kein Anstellungsvertrag mit dem Bewerber geschlossen, so werden die Bewerbungsunterlagen zwei Monate nach Bekanntgabe der Ablehnungsentscheidung automatisch gelöscht, sofern einer Löschung keine sonstigen berechtigten Interessen unsererseits entgegenstehen. Ein sonstiges berechtigtes Interesse liegt in diesem Sinne zum Beispiel in einem Beweisverfahren in einem Verfahren nach dem Allgemeinen Gleichbehandlungsgesetz (AGG).</p>
      </section>
    </div>
  </div>
{/if}


