<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { onMount } from 'svelte';
  import { writable, get } from 'svelte/store';
  import Justified from '$lib/Justified.svelte';
  import NewsFlash from '$lib/NewsFlash.svelte';
  import { beforeNavigate, afterNavigate } from '$app/navigation';
  import { updateGalleryStats } from '$lib/galleryStats';

  const pics = writable<any[]>([]);
  let page = 0, size = 50, loading = false, hasMoreImages = true;
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
  let showExifDialog = false;
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
  let exifFiles: FileList | null = null;
  let exifUploading = false;
  let exifMessage = '';

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

  // Speech synthesis for autoguide
  let speechSynthesis: SpeechSynthesis | null = null;
  let currentSpeech: SpeechSynthesisUtterance | null = null;
  let autoguideBarVisible = true; // Always visible when autoguide is enabled
  let autoguideText = '';
  let lastSpokenText = '';

  let audioActivated = false;

  // Autoguide functions
  function initSpeechSynthesis() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      speechSynthesis = window.speechSynthesis;
      
      // On mobile, we need to resume speech synthesis if it was paused
      if (speechSynthesis.paused) {
        speechSynthesis.resume();
      }
      
      // Check if speech synthesis is supported and working
      console.log('Speech synthesis available:', !!speechSynthesis);
      console.log('Speech synthesis speaking:', speechSynthesis.speaking);
      console.log('Speech synthesis paused:', speechSynthesis.paused);
      
      // On mobile, we need user interaction to enable speech
      if (speechSynthesis && autoguide) {
        // Add a one-time click handler to enable speech
        const enableSpeech = () => {
          console.log('User interaction detected - enabling speech synthesis');
          speechSynthesis.resume();
          document.removeEventListener('click', enableSpeech);
          document.removeEventListener('touchstart', enableSpeech);
        };
        
        document.addEventListener('click', enableSpeech, { once: true });
        document.addEventListener('touchstart', enableSpeech, { once: true });
      }
    }
  }

  function speakTitle(title: string) {
    if (!autoguide || !speechSynthesis) {
      console.log('Autoguide or speech synthesis not available');
      return;
    }
    
    // Stop any current speech
    if (currentSpeech) {
      speechSynthesis.cancel();
    }
    
    // Extract title up to first comma
    const titleToSpeak = title.split(',')[0].trim();
    
    // Verhindere doppelte Ansage
    if (titleToSpeak === lastSpokenText) {
      console.log('Audioguide: Text wurde bereits angesagt, keine Wiederholung.');
      return;
    }
    lastSpokenText = titleToSpeak;
    
    // Create new speech utterance
    currentSpeech = new SpeechSynthesisUtterance(titleToSpeak);
    currentSpeech.lang = 'de-DE';
    currentSpeech.rate = 0.9;
    currentSpeech.pitch = 1.0;
    currentSpeech.volume = 1.0; // Increased volume for mobile
    
    // Show autoguide bar
    autoguideText = titleToSpeak;
    autoguideBarVisible = true;
    
    // Add event listeners for debugging
    currentSpeech.onstart = () => {
      console.log('Speech started:', titleToSpeak);
    };
    
    currentSpeech.onend = () => {
      console.log('Speech ended:', titleToSpeak);
      // Keep the bar visible, just clear the text after a delay
      setTimeout(() => {
        autoguideText = '';
      }, 2000);
    };
    
    currentSpeech.onerror = (event) => {
      console.error('Speech error:', event.error);
      // Keep the bar visible, just clear the text after a delay
      setTimeout(() => {
        autoguideText = '';
      }, 3000);
    };
    
    // Mobile-specific handling
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      console.log('Mobile device detected - using mobile speech handling');
      
      // On mobile, we need to resume speech synthesis if it was paused
      if (speechSynthesis.paused) {
        console.log('Mobile: Resuming paused speech synthesis');
        speechSynthesis.resume();
      }
      
      // Add a small delay for mobile devices
      setTimeout(() => {
        try {
          speechSynthesis.speak(currentSpeech);
          console.log('Mobile: Speech synthesis speak called');
        } catch (error) {
          console.error('Mobile: Error calling speech synthesis:', error);
        }
      }, 100);
    } else {
      // Desktop handling
      try {
        speechSynthesis.speak(currentSpeech);
        console.log('Desktop: Speech synthesis speak called');
      } catch (error) {
        console.error('Desktop: Error calling speech synthesis:', error);
      }
    }
  }

  function announceFirstImage() {
    if (!autoguide) return;
    
    const currentPics = get(pics);
    if (currentPics.length > 0) {
      const firstImage = currentPics[0];
      if (firstImage.title) {
        speakTitle(firstImage.title);
      }
    }
  }

  function activateAudioGuide() {
    if (!speechSynthesis) initSpeechSynthesis();
    if (speechSynthesis) {
      // iOS: Einmal Dummy sprechen, um zu aktivieren
      const dummy = new SpeechSynthesisUtterance(' ');
      dummy.lang = 'de-DE';
      dummy.volume = 0;
      speechSynthesis.speak(dummy);
      speechSynthesis.resume();
      
      // Teste die Sprachausgabe mit einem kurzen Text
      const testUtterance = new SpeechSynthesisUtterance('Sprachausgabe aktiviert');
      testUtterance.lang = 'de-DE';
      testUtterance.volume = 1.0;
      testUtterance.onend = () => {
        console.log('Audio guide activated');
      };
      speechSynthesis.speak(testUtterance);
      audioActivated = true;
    }
  }

  // Test function for speech synthesis
  function testSpeech() {
    console.log('Testing speech synthesis...');
    if (speechSynthesis) {
      const testUtterance = new SpeechSynthesisUtterance('Test der Sprachausgabe');
      testUtterance.lang = 'de-DE';
      testUtterance.volume = 1.0;
      testUtterance.onstart = () => console.log('Test speech started');
      testUtterance.onend = () => console.log('Test speech ended');
      testUtterance.onerror = (e) => console.error('Test speech error:', e.error);
      
      // Resume if paused (common on mobile)
      if (speechSynthesis.paused) {
        speechSynthesis.resume();
      }
      
      speechSynthesis.speak(testUtterance);
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
        .select('id', { count: 'exact' });
      
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
        pics.update((p: any[]) => [...p, ...newPics]);
        
        // Update gallery stats
        const totalCount = await getTotalImageCount();
        updateGalleryStats($pics.length, totalCount);
        
        console.log(`[Gallery] RPC loaded ${data.length} images, total now: ${$pics.length}`);
        
        // Wenn RPC weniger Bilder zurückgibt als erwartet, lade den Rest mit normaler Pagination
        if (data.length < size) {
          console.log(`[Gallery] RPC returned ${data.length} images, expected ${size}. Loading remaining with normal pagination.`);
          
          // Lade die restlichen Bilder mit normaler Pagination
          const remainingSize = size - data.length;
          const normalPage = Math.floor($pics.length / size);
          console.log(`[Gallery] Loading remaining ${remainingSize} images with normal pagination, page: ${normalPage}`);
          
          const { data: remainingData } = await supabase
            .from('images')
            .select('id,path_512,path_2048,width,height,lat,lon,title,description,keywords')
            .order('created_at', { ascending: false })
            .range(normalPage * size + data.length, normalPage * size + size - 1);
          
          if (remainingData && remainingData.length > 0) {
            const remainingPics = remainingData.map((d: any) => ({
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
            pics.update((p: any[]) => [...p, ...remainingPics]);
            console.log(`[Gallery] Normal pagination loaded ${remainingData.length} additional images, total now: ${$pics.length}`);
          }
          
          // Prüfe, ob es noch mehr Bilder gibt
          const totalImages = await supabase
            .from('images')
            .select('id', { count: 'exact' });
          
          if (totalImages.count && $pics.length >= totalImages.count) {
            hasMoreImages = false;
            console.log(`[Gallery] All ${totalImages.count} images loaded, hasMoreImages set to false`);
          }
          
          // Nach dem Laden aller Bilder eine globale Neusortierung durchführen
          if (userLat !== null && userLon !== null) {
            console.log(`[Gallery] Performing global resort after loading all images...`);
            const currentPics = get(pics);
            const sortedPics = [...currentPics].sort((a: any, b: any) => {
              const distA = a.lat && a.lon ? getDistanceInMeters(userLat!, userLon!, a.lat, a.lon) : Number.MAX_VALUE;
              const distB = b.lat && b.lon ? getDistanceInMeters(userLat!, userLon!, b.lat, b.lon) : Number.MAX_VALUE;
              return distA - distB;
            });
            pics.set(sortedPics);
            console.log(`[Gallery] Global resort completed: ${sortedPics.length} images sorted by distance`);
            
            // Update gallery stats after resort
            const totalCount = await getTotalImageCount();
            updateGalleryStats(sortedPics.length, totalCount);
          }
        }
        
        if (autoguide && page === 0 && newPics.length > 0) {
          setTimeout(() => announceFirstImage(), 500);
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
      pics.update((p: any[]) => [...p, ...newPics]);
      
      // Update gallery stats
      const totalCount = await getTotalImageCount();
      updateGalleryStats($pics.length, totalCount);
      
      console.log(`[Gallery] Total images now: ${$pics.length}`);
      if (autoguide && page === 0 && newPics.length > 0) {
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
        const { data: { user: currentUser }, data: { session } } = await supabase.auth.getSession();
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
        
        // Add new images immediately to gallery
        if (result.images) {
          pics.update(p => [
            ...result.images.map((img: any) => ({
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
            })),
            ...p
          ]);
          
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

  async function uploadExifFiles() {
    console.log('uploadExifFiles called');
    console.log('exifFiles:', exifFiles);
    
    if (!exifFiles || exifFiles.length === 0) {
      exifMessage = 'Bitte Bilder auswählen';
      console.log('No files selected');
      return;
    }

    exifUploading = true;
    exifMessage = 'Upload wird gestartet...';
    console.log(`Starting upload of ${exifFiles.length} files`);

    try {
      const formData = new FormData();
      Array.from(exifFiles).forEach((file) => {
        formData.append('files', file);
      });
      const { data: { user: batchUser }, data: { session } } = await supabase.auth.getSession();
      if (batchUser) {
        formData.append('profile_id', batchUser.id);
      }
      const access_token = session?.access_token;
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          ...(access_token ? { 'Authorization': `Bearer ${access_token}` } : {})
        },
        body: formData
      });
      console.log('Response received:', response.status, response.statusText);
      
      const result = await response.json();
      console.log('Response JSON:', result);
      
      if (result.status === 'success') {
        exifMessage = `✅ ${exifFiles.length} Bild(er) erfolgreich hochgeladen!`;
        
        // Add new images to gallery
        if (result.images) {
          pics.update(p => [
            ...result.images.map((img: any) => ({
              id: img.id,
              src: `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${img.path_512}`,
              srcHD: `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${img.path_2048}`,
              width: img.width,
              height: img.height,
              lat: img.lat,
              lon: img.lon,
              title: img.title || null,
              description: img.description || null,
              keywords: img.keywords || null
            })),
            ...p
          ]);
          
          // Update gallery stats after EXIF upload
          const totalCount = await getTotalImageCount();
          updateGalleryStats($pics.length, totalCount);
        }
        
        // Close dialog after success
        setTimeout(() => {
          showExifDialog = false;
          exifMessage = '';
        }, 2000);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      const err = error as Error;
      console.error('Upload error:', err);
      exifMessage = `❌ Upload fehlgeschlagen: ${err.message}`;
    } finally {
      exifUploading = false;
      console.log('Upload finished');
    }
  }

  function closeDialogs() {
    showUploadDialog = false;
    showExifDialog = false;
    exifMessage = '';
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

  function saveLastKnownLocation(lat, lon) {
    if (typeof localStorage !== 'undefined') {
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
        .select('id,path_512,path_2048,width,height,lat,lon,title,description,keywords');
      
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
            .select('id,path_512,path_2048,width,height,lat,lon,title,description,keywords');
          
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

    // Vor dem ersten GPS-Fix: Letzte bekannte Koordinaten verwenden
    if (showDistance && (userLat === null || userLon === null)) {
      const lastLocation = loadLastKnownLocation();
      if (lastLocation) {
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

{#if showExifDialog}
  <div class="dialog-overlay" on:click={closeDialogs}>
    <div class="dialog-content" on:click|stopPropagation>
      <div class="dialog-header">
        <h2>EXIF Upload</h2>
        <button class="close-btn" on:click={closeDialogs}>×</button>
      </div>
      
      <div class="exif-upload-section">
        <p class="exif-description">
          Wähle Bilder mit EXIF-Daten aus, um sie hochzuladen. 
          Diese Funktion ist nur auf Desktop verfügbar.
        </p>
        
        <div class="file-input-section">
          <input 
            type="file" 
            bind:files={exifFiles} 
            multiple 
            accept="image/*" 
            disabled={exifUploading}
            class="exif-file-input"
          />
          <label for="exif-file-input" class="exif-file-label">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7,10 12,15 17,10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Dateien auswählen
          </label>
        </div>
        
        {#if exifFiles && exifFiles.length > 0}
          <div class="selected-files">
            <h4>Ausgewählte Dateien ({exifFiles.length}):</h4>
            <ul>
              {#each Array.from(exifFiles) as file}
                <li>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</li>
              {/each}
            </ul>
          </div>
        {/if}
        
        <div class="exif-actions">
          <button 
            on:click={() => console.log('Button clicked!')} 
            class="exif-upload-btn"
          >
            Test Button
          </button>
          <button 
            on:click={uploadExifFiles} 
            disabled={exifUploading || !exifFiles || exifFiles.length === 0}
            class="exif-upload-btn"
          >
            {exifUploading ? 'Uploading...' : 'Hochladen'}
          </button>
        </div>
        
        {#if exifMessage}
          <div class="exif-message" class:success={exifMessage.includes('✅')} class:error={exifMessage.includes('❌')}>
            {exifMessage}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Floating Settings Button -->
{#if isLoggedIn}
<a href="/settings" class="settings-fab" title="Einstellungen">
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 16 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 8c.14.31.22.65.22 1v.09A1.65 1.65 0 0 0 21 12c0 .35-.08.69-.22 1z"/>
  </svg>
</a>
{/if}

<!-- Culoca Logo -->
<img src="/culoca-logo-512px.png" alt="Culoca" class="culoca-logo" />

<!-- Floating EXIF Upload Button (nur Desktop) -->
{#if isLoggedIn}
<button class="exif-fab" on:click={() => showExifDialog = true} title="EXIF Upload">
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <path d="M9 9h6v6H9z"/>
  </svg>
</button>
{/if}

<!-- Floating + Button (Upload) -->
{#if isLoggedIn}
<button class="plus-fab" on:click={() => showUploadDialog = true} title="Bild hochladen">
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="16"/>
    <line x1="8" y1="12" x2="16" y2="12"/>
  </svg>
</button>
{/if}

<!-- Floating Profile Button -->
{#if isLoggedIn}
<a href="/profile" class="profile-fab" title="Profil">
  {#if profileAvatar}
    <img src={profileAvatar || ''} alt="Profilbild" class="profile-avatar-btn" />
  {:else}
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M2 20c0-4 8-6 10-6s10 2 10 6"/>
    </svg>
  {/if}
</a>
{/if}

<!-- Autoguide Bar -->
{#if autoguide}
  <div class="autoguide-bar">
    <div class="autoguide-content">
      <span class="autoguide-text">{autoguideText || 'Audioguide aktiv'}</span>
      {#if !audioActivated}
        <button class="speaker-btn" on:click={activateAudioGuide} title="Sprachausgabe aktivieren">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </button>
      {/if}
    </div>
  </div>
{/if}

<!-- NewsFlash-Komponente über der Galerie -->
{#if newsFlashMode !== 'aus'}
  <NewsFlash 
    mode={newsFlashMode} 
    userId={currentUser?.id} 
    layout="strip"
    showToggles={false}
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
  
    <div class="end-indicator">
      <span>✅ Alle {$pics.length} Bilder geladen</span>
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

  /* FAB Styles */
  .plus-fab {
    background: #28a745;
    color: #fff;
    position: fixed;
    right: 1.5rem;
    bottom: 9.5rem;
    z-index: 52;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    box-shadow: 0 4px 16px rgba(0,0,0,0.18);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s, box-shadow 0.2s, transform 0.1s;
    border: none;
    outline: none;
    cursor: pointer;
    font-size: 1.8rem;
    text-decoration: none;
  }
  .plus-fab:hover {
    background: #218838;
  }
  .exif-fab {
    background: #ff9800;
    color: #fff;
    position: fixed;
    right: 1.5rem;
    bottom: 13.5rem;
    z-index: 53;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    box-shadow: 0 4px 16px rgba(0,0,0,0.18);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s, box-shadow 0.2s, transform 0.1s;
    border: none;
    outline: none;
    cursor: pointer;
    font-size: 1.5rem;
    text-decoration: none;
  }
  .exif-fab:hover {
    background: #e65100;
  }
  @media (max-width: 768px) {
    .exif-fab {
      display: none !important;
    }
  }

  /* Mobile FAB alignment */
  @media (max-width: 600px) {
    .plus-fab {
      right: 1rem;
      bottom: 12rem;
      width: 48px;
      height: 48px;
      font-size: 1.2rem;
    }
    
    .settings-fab {
      right: 1rem;
      bottom: 1rem;
      width: 48px;
      height: 48px;
      font-size: 1.2rem;
    }
    
    .profile-fab {
      right: 1rem;
      bottom: 6.5rem;
      width: 48px;
      height: 48px;
      font-size: 1.2rem;
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
    top: 15px;
    right: 20px;
    left: auto;
    bottom: auto;
    z-index: 50;
    width: 140px;
    /* height: 72px; */
    transition: opacity 0.2s ease;
    object-fit: contain;
  }
  .culoca-logo:hover {
    opacity: 1;
  }
  @media (max-width: 600px) {
    .culoca-logo {
      top: 0.5rem;
      right: 0.5rem;
      left: auto;
      width: 6rem;
      height: 6rem;
    }
  }
  .distance-label {
    font-size: 0.7rem;
    font-weight: 500;
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  }
  .plus-fab {
    background: #28a745;
    color: #fff;
    position: fixed;
    right: 1.5rem;
    bottom: 9.5rem;
    z-index: 52;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    box-shadow: 0 4px 16px rgba(0,0,0,0.18);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s, box-shadow 0.2s, transform 0.1s;
    border: none;
    outline: none;
    cursor: pointer;
    font-size: 1.8rem;
    text-decoration: none;
  }
  .plus-fab:hover {
    background: #218838;
  }

  /* Floating Settings Button */
  .settings-fab {
    position: fixed;
    right: 1.5rem;
    bottom: 1.5rem;
    z-index: 50;
    width: 56px;
    height: 56px;
    background: #222b45;
    color: #fff;
    border-radius: 50%;
    box-shadow: 0 4px 16px rgba(0,0,0,0.18);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s, box-shadow 0.2s, transform 0.1s;
    border: none;
    outline: none;
    cursor: pointer;
    font-size: 1.5rem;
    text-decoration: none;
  }
  .settings-fab:hover {
    background: #0066cc;
    color: #fff;
    box-shadow: 0 8px 24px rgba(0,102,204,0.18);
    transform: scale(1.08);
  }

  /* Floating Profile Button */
  .profile-fab {
    position: fixed;
    right: 1.5rem;
    bottom: 5.5rem;
    z-index: 51;
    width: 56px;
    height: 56px;
    background: #444;
    color: #fff;
    border-radius: 50%;
    box-shadow: 0 4px 16px rgba(0,0,0,0.18);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s, box-shadow 0.2s, transform 0.1s;
    border: none;
    outline: none;
    cursor: pointer;
    font-size: 1.5rem;
    text-decoration: none;
    overflow: hidden;
  }
  .profile-fab:hover {
    background: #0066cc;
    color: #fff;
    box-shadow: 0 8px 24px rgba(0,102,204,0.18);
    transform: scale(1.08);
  }
  .profile-avatar-btn {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
    display: block;
  }
  @media (max-width: 600px) {
    .profile-fab {
      right: 1rem;
      bottom: 4.5rem;
      width: 48px;
      height: 48px;
      font-size: 1.2rem;
    }
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
    width: 128px;
    height: 128px;
    margin-bottom: 1rem;
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
      width: 96px;
      height: 96px;
    }
  }

  .fab-stack {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    position: fixed;
    right: 1.5rem;
    bottom: 1.5rem;
    z-index: 100;
    gap: 1.1rem;
  }
  @media (max-width: 600px) {
    .fab-stack {
      right: 1rem;
      bottom: 1rem;
      gap: 0.7rem;
    }
    .fab-stack .plus-fab,
    .fab-stack .profile-fab,
    .fab-stack .settings-fab {
      width: 3rem !important;
      height: 3rem !important;
      min-width: 3rem !important;
      min-height: 3rem !important;
      max-width: 3rem !important;
      max-height: 3rem !important;
      font-size: 1.2rem !important;
      margin: 0 !important;
      position: static !important;
      border-radius: 50% !important;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 !important;
    }
    .fab-stack .plus-fab svg,
    .fab-stack .profile-fab svg,
    .fab-stack .settings-fab svg,
    .fab-stack .profile-fab img {
      width: 100% !important;
      height: 100% !important;
      max-width: 100% !important;
      max-height: 100% !important;
      object-fit: cover;
      display: block;
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
    margin-bottom: 2px;
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

</style>
