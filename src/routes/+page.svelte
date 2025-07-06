<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { onMount } from 'svelte';
  import { writable, get } from 'svelte/store';
  import Justified from '$lib/Justified.svelte';
  import NewsFlash from '$lib/NewsFlash.svelte';
  import FloatingActionButtons from '$lib/FloatingActionButtons.svelte';
import { beforeNavigate, afterNavigate } from '$app/navigation';
  import { showPublicContentModal } from '$lib/modalStore';

  import { updateGalleryStats, galleryStats } from '$lib/galleryStats';


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
  let userLat: number | null = null;
  let userLon: number | null = null;
  let deviceHeading: number | null = null;
  let showUploadDialog = false;

  let isLoggedIn = false;
  let currentUser: any = null;

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
  const GPS_UPDATE_THRESHOLD = 10; // meters
  const GPS_UPDATE_INTERVAL = 5000; // 5 seconds
  const RADIUS_CHECK_INTERVAL = 10000; // 10 seconds - check if we need more images
  let radiusCheckInterval: number | null = null;

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

  // Global variable to track speech state
  let speechRetryCount = 0;
  let lastSpeechText = '';
  let currentImageId = ''; // Track current image ID to know when to update text
  
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
    
    // Don't speak the same text twice in a row for the same image
    if (text === lastSpeechText && imageId === currentImageId) {
      console.log('🎤 Skipping duplicate speech for same image:', text);
      return;
    }
    
    lastSpeechText = text;
    currentImageId = imageId || '';
    speechRetryCount = 0;
    
    console.log('🎤 Speaking:', text, 'for image:', imageId);
    autoguideText = text;
    
    // Cancel any ongoing speech, but only if we're not already speaking the same text
    if (speechSynthesis && lastSpeechText !== text) {
      speechSynthesis.cancel();
    }
    
    const currentSpeech = new SpeechSynthesisUtterance(text);
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
    console.log('🎤 autoguide:', autoguide);
    console.log('🎤 audioActivated:', audioActivated);
    
    if (!autoguide) {
      console.log('🎤 Autoguide not enabled, skipping announcement');
      return;
    }
    
    // Only announce if audio has been activated by user interaction
    if (!audioActivated) {
      console.log('🎤 Audio not activated by user yet, skipping announcement');
      return;
    }
    
    const currentPics = get(pics);
    console.log('🎤 Current pics length:', currentPics.length);
    
    if (currentPics.length > 0) {
      const firstImage = currentPics[0];
      console.log('🎤 First image:', firstImage);
      console.log('🎤 First image title:', firstImage.title);
      
      if (firstImage.title) {
        console.log('🎤 First image has title:', firstImage.title);
        speakTitle(firstImage.title, firstImage.id);
      } else {
        console.log('🎤 First image has no title, using fallback');
        // Fallback: Verwende den Dateinamen oder eine Standardnachricht
        const fallbackText = firstImage.original_name || 'Bild ohne Titel';
        speakTitle(fallbackText, firstImage.id);
      }
    } else {
      console.log('🎤 No images available for announcement');
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
        const sortedPics = [...$pics].sort((a, b) => {
          const distA = a.lat && a.lon ? getDistanceInMeters(userLat!, userLon!, a.lat, a.lon) : Number.MAX_VALUE;
          const distB = b.lat && b.lon ? getDistanceInMeters(userLat!, userLon!, b.lat, b.lon) : Number.MAX_VALUE;
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
    
    // Check if we need to load more images based on current position
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
      console.log(`[Auto-Load] Total loaded images: ${currentPics.length}`);
      console.log(`[Auto-Load] Nearest image distance: ${nearestDistance.toFixed(0)}m`);
      console.log(`[Auto-Load] Coverage check - Uncovered directions: ${uncoveredDirections.join(', ') || 'All covered'}`);
      
      // If we have no nearby images at all, reset and load from new position
      if (nearbyImages.length === 0 && currentPics.length > 0) {
        console.log(`[Auto-Load] No nearby images found, resetting and loading from new position...`);
        pics.set([]);
        page = 0;
        hasMoreImages = true;
        await loadMore('auto-load-new-position');
        return;
      }
      
      // If the nearest image is more than 10km away, we're probably outside the cached area
      if (nearestDistance > 10000 && currentPics.length > 0) {
        console.log(`[Auto-Load] Nearest image is ${nearestDistance.toFixed(0)}m away (>10km), resetting and loading from new position...`);
        pics.set([]);
        page = 0;
        hasMoreImages = true;
        await loadMore('auto-load-outside-cached-area');
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
      // Load all images in one request
      const { data } = await supabase
        .from('images')
        .select('id,path_512,path_2048,path_64,width,height,lat,lon,title,description,keywords')
        .not('lat', 'is', null)
        .not('lon', 'is', null)
        .order('created_at', { ascending: false });
      
      if (data) {
        const allPics = data.map((d: any) => ({
          id: d.id,
          src: `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${d.path_512}`,
          srcHD: `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${d.path_2048}`,
          width: d.width,
          height: d.height,
          lat: d.lat,
          lon: d.lon,
          title: d.title,
          description: d.description,
          keywords: d.keywords
        }));

        // Sort by distance if user is logged in and distance is enabled
        if (isLoggedIn && showDistance && userLat !== null && userLon !== null) {
          allPics.sort((a, b) => {
            const distA = a.lat && a.lon ? getDistanceInMeters(userLat!, userLon!, a.lat, a.lon) : Number.MAX_VALUE;
            const distB = b.lat && b.lon ? getDistanceInMeters(userLat!, userLon!, b.lat, b.lon) : Number.MAX_VALUE;
            return distA - distB;
          });
        }

        pics.set(allPics);
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
      const { count, error } = await supabase
        .from('images')
        .select('id', { count: 'exact' })
        .not('lat', 'is', null)
        .not('lon', 'is', null);
      
      if (error) {
        console.error('Error getting total image count:', error);
        return 0;
      }
      
      return count || 0;
    } catch (error) {
      console.error('Error getting total image count:', error);
      return 0;
    }
  }

  async function loadMore(reason = 'default') {
    console.log(`[Gallery] loadMore called, reason: ${reason}, page: ${page}, size: ${size}, hasMoreImages: ${hasMoreImages}, loading: ${loading}`);
    if (loading || !hasMoreImages) return; 
    loading = true;

    // Debug: Check if specific image exists in database
    const specificImageCheck = await supabase
      .from('images')
      .select('id, lat, lon, path_512, title')
      .eq('id', '2c6407f6-1ca5-4e82-afb1-0e0fe37db0ea')
      .single();
    
    if (specificImageCheck.data) {
      console.log('🔍 Specific image found in database:', specificImageCheck.data);
    } else {
      console.log('❌ Specific image not found in database');
    }

    if (userLat !== null && userLon !== null) {
      // Lade die nächste Seite nach Entfernung sortiert per RPC
      const { data, error } = await supabase
        .rpc('images_by_distance', {
          user_lat: userLat,
          user_lon: userLon,
          page,
          page_size: size
        });
      if (error) {
        console.error('RPC error:', error);
        hasMoreImages = false;
        loading = false;
        return;
      }
      if (data && data.length > 0) {
        // Filter out images without GPS coordinates
        const imagesWithGPS = data.filter((d: any) => d.lat && d.lon);
        
        if (imagesWithGPS.length !== data.length) {
          console.log(`[Gallery] RPC returned ${data.length} images, but only ${imagesWithGPS.length} have GPS coordinates`);
        }
        
        const newPics = imagesWithGPS.map((d: any) => ({
          id: d.id,
          src: `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${d.path_512}`,
          srcHD: `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${d.path_2048}`,
          width: d.width,
          height: d.height,
          lat: d.lat,
          lon: d.lon,
          title: d.title,
          description: d.description,
          keywords: d.keywords
        }));
        // Prüfe auf Duplikate vor dem Hinzufügen
        const currentPics = get(pics);
        const existingIds = new Set(currentPics.map((p: any) => p.id));
        const uniqueNewPics = newPics.filter((pic: any) => !existingIds.has(pic.id));
        
        if (uniqueNewPics.length !== newPics.length) {
          console.log(`[Gallery] Filtered out ${newPics.length - uniqueNewPics.length} duplicate images`);
        }
        
        pics.update((p: any[]) => [...p, ...uniqueNewPics]);
        
        // Update gallery stats
        const totalCount = await getTotalImageCount();
        updateGalleryStats($pics.length, totalCount);
        
        console.log(`[Gallery] RPC loaded ${uniqueNewPics.length} unique images with GPS, total now: ${$pics.length}`);
        
        // Announce first image if autoguide is enabled and new images were loaded
        if (autoguide && uniqueNewPics.length > 0) {
          console.log('🎤 Autoguide enabled and new images loaded, announcing first image...');
          setTimeout(() => announceFirstImage(), 500);
        }
        
        // Wenn weniger Bilder geladen wurden als erwartet, könnte das bedeuten, dass wir am Ende sind
        if (imagesWithGPS.length < size) {
          console.log(`[Gallery] RPC returned ${imagesWithGPS.length} images with GPS, expected ${size}. This might be the end.`);
          
          // Prüfe, ob es noch mehr Bilder mit GPS gibt
          const totalImagesWithGPS = await supabase
            .from('images')
            .select('id', { count: 'exact' })
            .not('lat', 'is', null)
            .not('lon', 'is', null);
          
          if (totalImagesWithGPS.count && $pics.length >= totalImagesWithGPS.count) {
            hasMoreImages = false;
            console.log(`[Gallery] All ${totalImagesWithGPS.count} images with GPS loaded, hasMoreImages set to false`);
          }
        }
      } else {
        hasMoreImages = false;
        console.log(`[Gallery] RPC no data returned, hasMoreImages set to false`);
      }
      page++;
      loading = false;
      return;
    }

    // Normale Pagination für nicht eingeloggte User oder wenn Distanz deaktiviert ist
    console.log(`[Gallery] Using normal pagination, range: ${page * size} to ${page * size + size - 1}`);
    const { data } = await supabase
      .from('images')
      .select('id,path_512,path_2048,width,height,lat,lon,title,description,keywords')
      .not('lat', 'is', null)
      .not('lon', 'is', null)
      .order('created_at', { ascending: false })
      .range(page * size, page * size + size - 1);

    if (data) {
      console.log(`[Gallery] Normal pagination loaded ${data.length} images`);
      if (data.length < size) {
        hasMoreImages = false;
        console.log(`[Gallery] Normal pagination hasMoreImages set to false, data.length (${data.length}) < size (${size})`);
      }
      const newPics = data.map((d: any) => ({
        id: d.id,
        src: `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${d.path_512}`,
        srcHD: `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${d.path_2048}`,
        width: d.width,
        height: d.height,
        lat: d.lat,
        lon: d.lon,
        title: d.title,
        description: d.description,
        keywords: d.keywords
      }));
      
      // Prüfe auf Duplikate vor dem Hinzufügen
      const currentPics = get(pics);
      const existingIds = new Set(currentPics.map((p: any) => p.id));
      const uniqueNewPics = newPics.filter((pic: any) => !existingIds.has(pic.id));
      
      if (uniqueNewPics.length !== newPics.length) {
        console.log(`[Gallery] Normal pagination: Filtered out ${newPics.length - uniqueNewPics.length} duplicate images`);
      }
      
      pics.update((p: any[]) => [...p, ...uniqueNewPics]);
      
      // Update gallery stats
      const totalCount = await getTotalImageCount();
      updateGalleryStats($pics.length, totalCount);
      
      console.log(`[Gallery] Total images now: ${$pics.length}`);
      
      // Announce first image if autoguide is enabled and new images were loaded
      if (autoguide && uniqueNewPics.length > 0) {
        setTimeout(() => announceFirstImage(), 500);
      }
    } else {
      hasMoreImages = false;
      console.log(`[Gallery] Normal pagination no data returned, hasMoreImages set to false`);
    }

    page++; 
    loading = false;
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

      const response = await fetch('/api/delete-all', { method: 'POST' });
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
    if (!files || files.length === 0) {
      uploadMessage = 'Bitte Bilder auswählen';
      return;
    }

    // Validate file types
    const validFiles = Array.from(files).filter(file => 
      file.type === 'image/jpeg' || file.type === 'image/jpg'
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

        const formData = new FormData();
        formData.append('files', file);
        // Attach profile_id so that the server can persist it
        const sessionResult = await supabase.auth.getSession();
        const currentUser = sessionResult.data.user;
        const session = sessionResult.data.session;
        if (currentUser) {
          formData.append('profile_id', currentUser.id);
        }
        const access_token = session?.access_token;
        const response = await fetch('/api/upload', {
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
    if (loading || !hasMoreImages) return;

    // Scroll-to-top-Button nur zeigen, wenn gescrollt wurde
    showScrollToTop = window.scrollY > 100;

    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    const scrolledToBottom = scrollTop + clientHeight >= scrollHeight - 1000;

    if (scrolledToBottom) {
      loadMore();
    }
  }

  function updateLayoutFromStorage() {
    if (typeof localStorage !== 'undefined') {
      const savedLayout = localStorage.getItem('galleryLayout');
      useJustifiedLayout = savedLayout === 'justified';
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
      .select('show_distance, show_compass, autoguide, use_justified_layout, newsflash_mode')
      .eq('id', user.id)
      .single();
    showDistance = data?.show_distance ?? false;
    showCompass = data?.show_compass ?? false;
    autoguide = data?.autoguide ?? false;
    useJustifiedLayout = data?.use_justified_layout ?? true;
    newsFlashMode = data?.newsflash_mode ?? 'alle';
    
    // Start GPS tracking if distance is enabled
    if (showDistance && navigator.geolocation) {
      startGPSTracking();
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
      // Erfolgreicher Login - isLoggedIn wird automatisch aktualisiert
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
      loginInfo = 'Bitte bestätige deine E-Mail-Adresse. Du kannst dich nach der Bestätigung anmelden.';
      loginEmail = '';
      loginPassword = '';
      showRegister = false;
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
    if (!navigator.geolocation || gpsTrackingActive) return;
    gpsTrackingActive = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lastKnownLat = pos.coords.latitude;
        lastKnownLon = pos.coords.longitude;
        userLat = pos.coords.latitude;
        userLon = pos.coords.longitude;
        saveLastKnownLocation(userLat, userLon);
        // Wenn GPS-Koordinaten verfügbar sind, lade Bilder nach Entfernung sortiert
        if (userLat !== null && userLon !== null) {
          pics.set([]);
          page = 0;
          hasMoreImages = true;
          loadMore('initial mount');
        }
        gpsWatchId = navigator.geolocation.watchPosition(
          handlePositionUpdate,
          (error) => console.error('GPS tracking error:', error),
          { enableHighAccuracy: true, maximumAge: 3000, timeout: 5000 }
        );
        radiusCheckInterval = window.setInterval(checkRadiusForNewImages, RADIUS_CHECK_INTERVAL);
      },
      (error) => console.error('Initial GPS error:', error),
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
    
    if (lastKnownLat === null || lastKnownLon === null) {
      lastKnownLat = newLat;
      lastKnownLon = newLon;
      return;
    }
    
    // Calculate distance moved
    const distance = getDistanceInMeters(lastKnownLat, lastKnownLon, newLat, newLon);
    
    if (distance > GPS_UPDATE_THRESHOLD) {
      console.log(`Moved ${distance.toFixed(1)}m, updating position...`);
      
      lastKnownLat = newLat;
      lastKnownLon = newLon;
      userLat = newLat;
      userLon = newLon;
      
      // Check if we should reload gallery to get closer images
      const shouldReload = checkIfCloserImagesAvailable();
      
      if (shouldReload) {
        console.log('Closer images available, reloading gallery...');
        reloadGalleryWithNewPosition();
      } else {
        // Only resort existing images if no closer images are available
        console.log('No closer images available, just resorting existing images...');
        resortExistingImages();
      }
    }
  }

  function checkIfCloserImagesAvailable(): boolean {
    if (!userLat || !userLon || !$pics.length) return false;
    
    // Get the distance to the farthest currently loaded image
    const currentPics = $pics;
    let maxDistance = 0;
    
    for (const pic of currentPics) {
      if (pic.lat && pic.lon) {
        const distance = getDistanceInMeters(userLat, userLon, pic.lat, pic.lon);
        maxDistance = Math.max(maxDistance, distance);
      }
    }
    
    console.log(`Current max distance to loaded images: ${maxDistance.toFixed(1)}m`);
    
    // If we have a reasonable number of images loaded and they're all within a good radius,
    // we probably don't need to reload. But if the max distance is very large,
    // there might be closer images we haven't loaded yet.
    return maxDistance > 10000; // 10km threshold - if farthest image is >10km away, reload
  }

  function resortExistingImages() {
    if (!userLat || !userLon || !$pics.length) return;
    
    console.log('Resorting existing images based on new position...');
    
    // Sort existing images by distance without reloading
    const sortedPics = [...$pics].sort((a: any, b: any) => {
      if (!a.lat || !a.lon || !b.lat || !b.lon) return 0;
      
      const distA = getDistanceInMeters(userLat, userLon, a.lat, a.lon);
      const distB = getDistanceInMeters(userLat, userLon, b.lat, b.lon);
      
      return distA - distB;
    });
    
    pics.set(sortedPics);
  }

  function checkRadiusForNewImages() {
    if (!userLat || !userLon || !hasMoreImages || loading) return;

    // Sicherstellen, dass $pics ein Array ist
    const currentPics = Array.isArray($pics) ? $pics : [];

    const visibleImages = currentPics.filter((pic: any) => {
      if (!pic.lat || !pic.lon) return false;
      const distance = getDistanceInMeters(userLat, userLon, pic.lat, pic.lon);
      return distance <= 5000; // 5km radius
    });

    if (visibleImages.length < 20) {
      console.log(`Only ${visibleImages.length} images in 5km radius, loading more...`);
      loadMore();
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
  
  async function reloadGalleryWithNewPosition() {
    if (!isLoggedIn || !showDistance) return;
    
    console.log('Reloading gallery with fresh GPS position...');
    
    // First, get a fresh GPS position to ensure we have the most current location
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0 // Force fresh position
        });
      });
      
      // Update position variables
      const newLat = position.coords.latitude;
      const newLon = position.coords.longitude;
      
      console.log(`Fresh GPS position: ${newLat}, ${newLon}`);
      
      // Update stored positions
      lastKnownLat = newLat;
      lastKnownLon = newLon;
      userLat = newLat;
      userLon = newLon;
      
      // Now reload gallery with fresh position
      const { data } = await supabase
        .from('images')
        .select('id,path_512,path_2048,width,height,lat,lon,title,description,keywords')
        .not('lat', 'is', null)
        .not('lon', 'is', null);
      
      if (data) {
        const allPics = data.map((d: any) => ({
          id: d.id,
          src: `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${d.path_512}`,
          srcHD: `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${d.path_2048}`,
          width: d.width,
          height: d.height,
          lat: d.lat,
          lon: d.lon,
          title: d.title,
          description: d.description,
          keywords: d.keywords
        }));

        // Sort by distance to fresh position
        const sortedPics = allPics.sort((a, b) => {
          const distA = a.lat && a.lon ? getDistanceInMeters(userLat!, userLon!, a.lat, a.lon) : Number.MAX_VALUE;
          const distB = b.lat && b.lon ? getDistanceInMeters(userLat!, userLon!, b.lat, b.lon) : Number.MAX_VALUE;
          return distA - distB;
        });

        pics.set(sortedPics);
        hasMoreImages = false;
        console.log(`Gallery reordered with fresh position: ${sortedPics.length} images sorted by distance`);
        
        // Announce first image if autoguide is enabled
        if (autoguide && sortedPics.length > 0) {
          setTimeout(() => announceFirstImage(), 500);
        }
      }
    } catch (error) {
      console.error('Error getting fresh GPS position or reloading gallery:', error);
      // Fallback: try with current position if fresh position fails
      if (userLat !== null && userLon !== null) {
        console.log('Falling back to current position...');
        // Use existing reloadGalleryWithNewPosition logic with current position
        try {
          const { data } = await supabase
            .from('images')
            .select('id,path_512,path_2048,width,height,lat,lon,title,description,keywords')
            .not('lat', 'is', null)
            .not('lon', 'is', null);
          
          if (data) {
            const allPics = data.map((d: any) => ({
              id: d.id,
              src: `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${d.path_512}`,
              srcHD: `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${d.path_2048}`,
              width: d.width,
              height: d.height,
              lat: d.lat,
              lon: d.lon,
              title: d.title,
              description: d.description,
              keywords: d.keywords
            }));

            const sortedPics = allPics.sort((a, b) => {
              const distA = a.lat && a.lon ? getDistanceInMeters(userLat!, userLon!, a.lat, a.lon) : Number.MAX_VALUE;
              const distB = b.lat && b.lon ? getDistanceInMeters(userLat!, userLon!, b.lat, b.lon) : Number.MAX_VALUE;
              return distA - distB;
            });

            pics.set(sortedPics);
            hasMoreImages = false;
            console.log(`Gallery reordered with fallback position: ${sortedPics.length} images sorted by distance`);
          }
        } catch (fallbackError) {
          console.error('Fallback gallery reload also failed:', fallbackError);
        }
      }
    }
  }

  // Navigation-Handler direkt im Komponenten-Scope (nicht im onMount!)
  beforeNavigate(({ to }) => {
    if (to?.url.pathname.startsWith('/image/')) {
      console.log('Navigating to detail page, starting gallery preload...');
      startGalleryPreload();
    }
  });

  afterNavigate(({ to }) => {
    if (to?.url.pathname === '/') {
      console.log('Back on main page, preload complete');
    }
  });

  onMount(async () => {
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
    }

    // Check for GPS simulation parameters
    const urlParams = new URLSearchParams(window.location.search);
    const simulation = urlParams.get('simulation');
    const stopSimulation = urlParams.get('stop');
    
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      isLoggedIn = !!session;
      currentUser = session?.user || null;
      authChecked = true;
      if (isLoggedIn) {
        loadShowDistanceAndCompass();
        loadProfileAvatar();
      } else {
        useJustifiedLayout = true;
        showDistance = false;
        showCompass = false;
        autoguide = false;
        newsFlashMode = 'alle';
      }
    });

    // WICHTIG: Erst Einstellungen laden, dann Galerie
    await loadShowDistanceAndCompass();
    // updateLayoutFromStorage(); // <-- Entfernt, da Einstellungen bereits aus DB geladen wurden
    await loadProfileAvatar();

    // Prüfe, ob Daten aus sessionStorage geladen werden
    const sessionPics = sessionStorage.getItem('galleryPics');
    if (sessionPics) {
      pics.set(JSON.parse(sessionPics));
    } else {
      // Galerie erst laden, nachdem alle Einstellungen geladen sind
      if (!showDistance) {
        loadMore('initial mount');
      }
      // Wenn showDistance aktiv ist, wird loadMore im GPS-Callback von startGPSTracking aufgerufen
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('galleryLayoutChanged', updateLayoutFromStorage);
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

    // Vor dem ersten GPS-Fix: Letzte bekannte Koordinaten verwenden
    if (showDistance && (userLat === null || userLon === null)) {
      const lastLocation = loadLastKnownLocation();
      if (lastLocation && lastLocation.lat !== null && lastLocation.lon !== null) {
        userLat = lastLocation.lat;
        userLon = lastLocation.lon;
        // Galerie mit diesen Koordinaten laden
        pics.set([]);
        page = 0;
        hasMoreImages = true;
        loadMore('last known location');
      }
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('galleryLayoutChanged', updateLayoutFromStorage);
      window.removeEventListener('profileSaved', loadProfileAvatar);
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
      subscription?.unsubscribe();
      stopGPSTracking();
    };
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
    console.log(`[Auto-Load] Total loaded images: ${currentPics.length}`);
    console.log(`[Auto-Load] Nearest image distance: ${nearestDistance.toFixed(0)}m`);
    console.log(`[Auto-Load] Coverage check - Uncovered directions: ${uncoveredDirections.join(', ') || 'All covered'}`);
    
    // If we have no nearby images at all, reset and load from new position
    if (nearbyImages.length === 0 && currentPics.length > 0) {
      console.log(`[Auto-Load] No nearby images found, resetting and loading from new position...`);
      pics.set([]);
      page = 0;
      hasMoreImages = true;
      await loadMore('auto-load-new-position');
      return;
    }
    
    // If the nearest image is more than 10km away, we're probably outside the cached area
    if (nearestDistance > 10000 && currentPics.length > 0) {
      console.log(`[Auto-Load] Nearest image is ${nearestDistance.toFixed(0)}m away (>10km), resetting and loading from new position...`);
      pics.set([]);
      page = 0;
      hasMoreImages = true;
      await loadMore('auto-load-outside-cached-area');
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
                <small>Nur JPEG-Dateien erlaubt</small>
              {/if}
            </div>
            
            <input 
              type="file" 
              name="files" 
              multiple 
              accept="image/jpeg,image/jpg" 
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



<!-- Culoca Logo -->
<img src="/culoca-logo-512px.png" alt="Culoca" class="culoca-logo" />

<!-- NewsFlash Component -->
{#if isLoggedIn && newsFlashMode !== 'aus'}
  <NewsFlash 
    mode={newsFlashMode}
    userId={currentUser?.id}
    layout="strip"
    limit={15}
    showToggles={false}
    showDistance={showDistance}
    userLat={userLat}
    userLon={userLon}
    getDistanceFromLatLonInMeters={getDistanceFromLatLonInMeters}
    {displayedImageCount}
  />
{/if}

<!-- Autoguide Bar -->
{#if isLoggedIn && autoguide}
  <div class="autoguide-bar">
    <div class="autoguide-content">
      <div class="autoguide-text">
        {audioActivated ? 'Audio aktiviert - Bildtitel werden vorgelesen' : 'Audio deaktiviert - Klicke auf den Lautsprecher'}
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
    {isLoggedIn}
    {simulationMode}
    {profileAvatar}
    on:upload={() => showUploadDialog = true}
    on:publicContent={() => showPublicContentModal.set(true)}
    on:profile={() => location.href = '/profile'}
    on:settings={() => location.href = '/settings'}
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
  {#if useJustifiedLayout}
    <div class="justified-wrapper">
      <Justified 
        items={$pics} 
        gap={2} 
        targetRowHeight={220}
        showDistance={isLoggedIn && showDistance}
        showCompass={isLoggedIn && showCompass}
        userLat={userLat}
        userLon={userLon}
        getDistanceFromLatLonInMeters={getDistanceFromLatLonInMeters}
      />
    </div>
  {:else}
    <div class="grid-layout">
      {#each $pics as pic}
        <div class="grid-item">
          {#if isLoggedIn}
            <img 
              src={pic.src} 
              alt="Gallery image {pic.id}"
              on:click={() => location.href = `/image/${pic.id}`}
              on:keydown={(e) => e.key === 'Enter' && (location.href = `/image/${pic.id}`)}
              tabindex="0"
              role="button"
              aria-label="View image {pic.id}"
            />
          {:else}
            <img 
              src={pic.src} 
              alt="Gallery image {pic.id}"
              style="cursor: default; pointer-events: none;"
            />
          {/if}
          

          {#if isLoggedIn && showDistance && userLat !== null && userLon !== null && pic.lat && pic.lon}
            <div class="distance-label">
              {getDistanceFromLatLonInMeters(userLat, userLon, pic.lat, pic.lon)}
            </div>
          {/if}
          {#if isLoggedIn && showCompass && userLat !== null && userLon !== null && pic.lat && pic.lon && deviceHeading !== null}
            <div class="compass" style="position: absolute; left: 12px; bottom: 48px; z-index: 3;">
              <svg width="36" height="36" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="16" fill="rgba(24,24,40,0.55)" stroke="#fff" stroke-width="2" />
                <g transform="rotate({getAzimuth(userLat, userLon, pic.lat, pic.lon) - deviceHeading}, 18, 18)">
                  <polygon points="18,6 24,24 18,20 12,24" fill="#ff5252" />
                </g>
              </svg>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
  
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
    </div>
  {/if}

  <!-- Login Overlay für nicht eingeloggte User -->
  {#if !isLoggedIn && authChecked}
    <div class="login-overlay">
      <div class="login-overlay-content">
        <img src="/culoca-logo-512px.png" alt="Culoca Logo" class="login-logo" />

        {#if loginError}
          <div class="login-error">{loginError}</div>
        {/if}
        {#if loginInfo}
          <div class="login-info">{loginInfo}</div>
        {/if}

        <div class="social-login">
          <button class="social-btn google-btn" on:click={() => loginWithProvider('google')} disabled={loginLoading}>
            <svg class="social-icon" viewBox="0 0 48 48" fill="none">
              <g>
                <path fill="#4285F4" d="M24 9.5c3.54 0 6.7 1.22 9.19 3.23l6.85-6.85C36.45 2.36 30.68 0 24 0 14.82 0 6.71 5.06 2.69 12.44l7.98 6.2C12.13 13.13 17.62 9.5 24 9.5z"/>
                <path fill="#34A853" d="M46.1 24.5c0-1.64-.15-3.22-.42-4.74H24v9.01h12.42c-.54 2.9-2.18 5.36-4.65 7.03l7.19 5.6C43.98 37.13 46.1 31.3 46.1 24.5z"/>
                <path fill="#FBBC05" d="M9.67 28.64c-1.13-3.36-1.13-6.92 0-10.28l-7.98-6.2C-1.13 17.13-1.13 31.87 1.69 37.84l7.98-6.2z"/>
                <path fill="#EA4335" d="M24 46c6.48 0 11.92-2.14 15.9-5.82l-7.19-5.6c-2.01 1.35-4.6 2.15-8.71 2.15-6.38 0-11.87-3.63-14.33-8.94l-7.98 6.2C6.71 42.94 14.82 48 24 48z"/>
              </g>
            </svg>
          </button>
          <button class="social-btn facebook-btn" on:click={() => loginWithProvider('facebook')} disabled={loginLoading}>
            <svg class="social-icon" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="16" fill="white"/>
              <path d="M20.5 16H18V24H15V16H13.5V13.5H15V12.25C15 10.73 15.67 9 18 9H20.5V11.5H19.25C18.84 11.5 18.5 11.84 18.5 12.25V13.5H20.5L20 16Z" fill="#23272F"/>
            </svg>
          </button>
        </div>

        <div class="login-tabs">
          <button class="tab-btn" class:active={!showRegister} on:click={() => showRegister = false}>Anmelden</button>
          <button class="tab-btn" class:active={showRegister} on:click={() => showRegister = true}>Registrieren</button>
        </div>

        {#if !showRegister}
          <form class="login-form" on:submit|preventDefault={loginWithEmail}>
            <input class="login-input" type="email" placeholder="E-Mail" bind:value={loginEmail} required />
            <input class="login-input" type="password" placeholder="Passwort" bind:value={loginPassword} required />
            <button class="login-submit-btn" type="submit" disabled={loginLoading}>
              {loginLoading ? 'Anmelden...' : 'Anmelden'}
            </button>
          </form>
        {:else}
          <form class="login-form" on:submit|preventDefault={signupWithEmail}>
            <input class="login-input" type="email" placeholder="E-Mail" bind:value={loginEmail} required />
            <input class="login-input" type="password" placeholder="Passwort" bind:value={loginPassword} required />
            <button class="login-submit-btn" type="submit" disabled={loginLoading}>
              {loginLoading ? 'Registrieren...' : 'Registrieren'}
            </button>
          </form>
        {/if}
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

  .justified-wrapper {
    width: 100%;
    margin: 0;
    padding: 0;
    background: var(--bg-primary);
    border: none;
    box-shadow: none;
  }

  .gallery {
    position: relative;
    width: 100%;
    min-height: 200px;
    margin: 0 !important;
    padding: 0 !important;
    background: var(--bg-primary) !important;
    border: none !important;
    box-shadow: none !important;
    transition: background-color 0.3s ease;
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
  @media (max-width: 600px) {
    .culoca-logo {
      width: 10rem;
    }
  }
  .distance-label {
    font-size: 0.7rem;
    font-weight: 500;
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  }

  /* Login Overlay */
  .login-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .login-overlay-content {
    background: var(--bg-secondary);
    color: var(--text-primary);
    padding: 3rem;
    border-radius: 16px;
    text-align: center;
    max-width: 400px;
    margin: 2rem;
    box-shadow: 0 8px 32px var(--shadow);
  }

  .login-logo {
    width: 256px;
    height: 256px;
    margin-bottom: 2rem;
    margin-top: 1rem;
    object-fit: contain;
  }

  .login-error {
    background: #dc3545;
    color: #fff;
    padding: 0.75rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    font-weight: 500;
  }

  .login-info {
    background: #28a745;
    color: #fff;
    padding: 0.75rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    font-weight: 500;
  }

  .social-login {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-bottom: 2rem;
  }

  .social-btn {
    background: #fff;
    border: none;
    border-radius: 50%;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: transform 0.2s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .social-btn:hover:not(:disabled) {
    transform: scale(1.05);
  }

  .social-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .social-icon {
    width: 32px;
    height: 32px;
  }

  .login-tabs {
    display: flex;
    margin-bottom: 1.5rem;
    border-radius: 8px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.1);
  }

  .tab-btn {
    flex: 1;
    padding: 0.75rem 1rem;
    background: transparent;
    border: none;
    color: #fff;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .tab-btn.active {
    background: #ff6b35;
    color: #fff;
  }

  .tab-btn:not(.active) {
    color: #ff6b35;
  }

  .login-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .login-input {
    width: 100%;
    padding: 0.75rem;
    border: none;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.8);
    color: #000;
    font-size: 1rem;
    box-sizing: border-box;
  }

  .login-input::placeholder {
    color: #666;
  }

  .login-input:focus {
    outline: none;
    box-shadow: 0 0 0 2px #ff6b35;
  }

  .login-submit-btn {
    width: 100%;
    padding: 0.75rem;
    background: #ff6b35;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .login-submit-btn:hover:not(:disabled) {
    background: #e55a2b;
  }

  .login-submit-btn:disabled {
    background: #666;
    cursor: not-allowed;
  }

  @media (max-width: 600px) {
    .login-overlay-content {
      padding: 2rem;
      margin: 1rem;
    }
    
    .login-logo {
      width: 120px;
      height: 120px;
      margin-top: 0.25rem;
    }
  }

  /* Autoguide Bar */
  .autoguide-bar {
    position: static;
    background: linear-gradient(135deg, var(--accent-color), var(--accent-hover));
    color: white;
    padding: 0.75rem 1rem;
    box-shadow: 0 2px 10px var(--shadow);
    animation: slideDown 0.3s ease-out;
    border-bottom: 2px solid var(--bg-primary);
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





</style>
