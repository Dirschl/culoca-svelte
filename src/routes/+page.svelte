<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import Justified from '$lib/Justified.svelte';
  import { beforeNavigate, afterNavigate } from '$app/navigation';

  const pics = writable<any[]>([]);
  let page = 0, size = 40, loading = false, hasMoreImages = true;
  let useJustifiedLayout = true;
  let profileAvatar: string | null = null;
  let showDistance = false;
  let showCompass = false;
  let userLat: number | null = null;
  let userLon: number | null = null;
  let deviceHeading: number | null = null;
  let showUploadDialog = false;
  let showExifDialog = false;
  let isLoggedIn = false;

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
        .select('id,path_512,path_2048,width,height,lat,lon,title,description,keywords')
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
        console.log(`Preload complete: ${allPics.length} images loaded`);
      }
    } catch (error) {
      console.error('Error during preload:', error);
    } finally {
      loading = false;
    }
  }

  async function loadMore() {
    if (loading || !hasMoreImages) return; 
    loading = true;
    
    // Wenn User eingeloggt ist und Distanz aktiviert ist, lade alle Bilder für Sortierung
    if (isLoggedIn && showDistance && userLat !== null && userLon !== null && page === 0) {
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

        // Sortiere nach Entfernung
        const sortedPics = allPics.sort((a, b) => {
          const distA = a.lat && a.lon ? getDistanceInMeters(userLat!, userLon!, a.lat, a.lon) : Number.MAX_VALUE;
          const distB = b.lat && b.lon ? getDistanceInMeters(userLat!, userLon!, b.lat, b.lon) : Number.MAX_VALUE;
          return distA - distB; // Geringste Entfernung zuerst
        });

        pics.set(sortedPics);
        hasMoreImages = false; // Alle Bilder geladen
      }
    } else {
      // Normale Pagination für nicht eingeloggte User oder wenn Distanz deaktiviert ist
      const { data } = await supabase
        .from('images')
        .select('id,path_512,path_2048,width,height,lat,lon,title,description,keywords')
        .order('created_at', { ascending: false })
        .range(page * size, page * size + size - 1);
      
      if (data) {
        // Check if we got fewer items than requested - means we reached the end
        if (data.length < size) {
          hasMoreImages = false;
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
      } else {
        // No data returned - we've reached the end
        hasMoreImages = false;
      }
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
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          formData.append('profile_id', currentUser.id);
        }
        
        const response = await fetch('/api/upload', { method: 'POST', body: formData });
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
    // Try localStorage cache first
    if (typeof localStorage !== 'undefined') {
      const cached = localStorage.getItem('profileAvatar');
      if (cached) {
        profileAvatar = cached;
        return;
      }
    }
    // Get user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
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
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('profileAvatar', profileAvatar);
      }
    }
  }

  async function loadShowDistanceAndCompass() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('show_distance, show_compass')
      .eq('id', user.id)
      .single();
    showDistance = data?.show_distance ?? false;
    showCompass = data?.show_compass ?? false;
    
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
        console.log('Added file to formData:', file.name, file.size);
      });
      
      // Attach profile_id once for batch upload
      const { data: { user: batchUser } } = await supabase.auth.getUser();
      if (batchUser) {
        formData.append('profile_id', batchUser.id);
      }
      
      console.log('Sending request to /api/upload');
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
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

  function startGPSTracking() {
    if (!navigator.geolocation || gpsTrackingActive) return;
    
    console.log('Starting GPS tracking for automatic sorting...');
    gpsTrackingActive = true;
    
    // Get initial position
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lastKnownLat = pos.coords.latitude;
        lastKnownLon = pos.coords.longitude;
        userLat = pos.coords.latitude;
        userLon = pos.coords.longitude;
        console.log(`Initial GPS position: ${userLat}, ${userLon}`);
        
        // If distance sorting is enabled, reload gallery with new position
        if (isLoggedIn && showDistance) {
          reloadGalleryWithNewPosition();
        }
      },
      (error) => {
        console.error('GPS tracking error:', error);
        gpsTrackingActive = false;
      }
    );
    
    // Start watching for position changes
    gpsWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newLat = pos.coords.latitude;
        const newLon = pos.coords.longitude;
        
        if (lastKnownLat !== null && lastKnownLon !== null) {
          const distance = getDistanceInMeters(lastKnownLat, lastKnownLon, newLat, newLon);
          
          if (distance > GPS_UPDATE_THRESHOLD) {
            console.log(`Position changed by ${distance}m, updating gallery...`);
            lastKnownLat = newLat;
            lastKnownLon = newLon;
            userLat = newLat;
            userLon = newLon;
            
            // Reload gallery with new position
            if (isLoggedIn && showDistance) {
              reloadGalleryWithNewPosition();
            }
          }
        } else {
          lastKnownLat = newLat;
          lastKnownLon = newLon;
          userLat = newLat;
          userLon = newLon;
        }
      },
      (error) => {
        console.error('GPS watch error:', error);
        gpsTrackingActive = false;
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: GPS_UPDATE_INTERVAL
      }
    );
  }
  
  function stopGPSTracking() {
    if (gpsWatchId !== null) {
      navigator.geolocation.clearWatch(gpsWatchId);
      gpsWatchId = null;
    }
    gpsTrackingActive = false;
    console.log('GPS tracking stopped');
  }
  
  async function reloadGalleryWithNewPosition() {
    if (!isLoggedIn || !showDistance || userLat === null || userLon === null) return;
    
    console.log('Reloading gallery with new GPS position...');
    
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

        // Sort by distance to new position
        const sortedPics = allPics.sort((a, b) => {
          const distA = a.lat && a.lon ? getDistanceInMeters(userLat!, userLon!, a.lat, a.lon) : Number.MAX_VALUE;
          const distB = b.lat && b.lon ? getDistanceInMeters(userLat!, userLon!, b.lat, b.lon) : Number.MAX_VALUE;
          return distA - distB;
        });

        pics.set(sortedPics);
        hasMoreImages = false;
        console.log(`Gallery reordered: ${sortedPics.length} images sorted by distance`);
      }
    } catch (error) {
      console.error('Error reloading gallery with new position:', error);
    }
  }

  onMount(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    isLoggedIn = !!user;
    authChecked = true; // Markiere, dass der Login-Status geprüft wurde
    if (!isLoggedIn) {
      useJustifiedLayout = true;
      showDistance = false;
      showCompass = false;
    }
    
    // Auth State Listener für Echtzeit-Updates
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      isLoggedIn = !!session;
      authChecked = true;
      if (isLoggedIn) {
        loadShowDistanceAndCompass();
        loadProfileAvatar();
      } else {
        useJustifiedLayout = true;
        showDistance = false;
        showCompass = false;
      }
    });
    
    loadShowDistanceAndCompass();
    updateLayoutFromStorage();
    loadProfileAvatar();
    
      // Normal load for main page
    loadMore();
    
    // Set up navigation event handlers for preloading
    beforeNavigate(({ to }) => {
      // If navigating to a detail page, start preloading gallery
      if (to?.url.pathname.startsWith('/image/')) {
        console.log('Navigating to detail page, starting gallery preload...');
        startGalleryPreload();
      }
    });
    
    afterNavigate(({ to }) => {
      // If we're back on the main page, stop preloading and show loaded images
      if (to?.url.pathname === '/') {
        console.log('Back on main page, preload complete');
      }
    });
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('galleryLayoutChanged', updateLayoutFromStorage);
    window.addEventListener('profileSaved', loadProfileAvatar);
    window.addEventListener('keydown', handleKeydown);
    if (showCompass && window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientationabsolute', handleOrientation, true);
      window.addEventListener('deviceorientation', handleOrientation, true);
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
    border: 2px dashed #2d2d44;
    border-radius: 12px;
    padding: 3rem 2rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s ease;
    background: #1a1a2e;
    margin-bottom: 1rem;
  }

  .drop-zone:hover {
    border-color: #0066cc;
    background: #1e1e3a;
  }

  .drop-zone.drag-over {
    border-color: #0099ff;
    background: #1e1e3a;
    transform: scale(1.02);
    box-shadow: 0 4px 20px rgba(0, 153, 255, 0.2);
  }

  .drop-zone.uploading {
    border-color: #28a745;
    background: #1a2e1a;
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
    color: white;
    font-weight: 600;
  }

  .drop-content p {
    margin: 0;
    color: #aaa;
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
    background: #0066cc;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    font-size: 0.9rem;
    transition: background-color 0.2s ease;
  }

  .upload-btn:hover:not(:disabled) {
    background: #0052a3;
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
    background: transparent;
    border: none;
    box-shadow: none;
  }

  .justified-wrapper {
    width: 100%;
    margin: 0;
    padding: 0;
    background: transparent;
    border: none;
    box-shadow: none;
  }

  .gallery {
    position: relative;
    width: 100%;
    min-height: 200px;
    margin: 0 !important;
    padding: 0 !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
  }

  .grid-layout {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(256px, 1fr));
    gap: 2px;
    width: 100%;
    margin: 0 auto;
    /* padding: 1rem 0 2rem 0; */
    padding: 0;
    background: transparent;
    border: none;
    box-shadow: none;
  }

  .grid-item {
    background: #181828;
    border-radius: 0;
    overflow: hidden;
    /* box-shadow: 0 2px 8px rgba(0,0,0,0.10); */
    transition: box-shadow 0.2s, transform 0.2s;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1/1;
    position: relative;
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
  @media (max-width: 600px) {
    .plus-fab {
      right: 1rem;
      bottom: 12.5rem;
      width: 48px;
      height: 48px;
      font-size: 1.2rem;
    }
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
    background: #1a1a2e;
    border-radius: 12px;
    max-width: 600px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    border: 1px solid #2d2d44;
  }

  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #2d2d44;
  }

  .dialog-header h2 {
    margin: 0;
    color: white;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .close-btn {
    background: none;
    border: none;
    color: #aaa;
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
    background: #2d2d44;
    color: white;
  }

  /* EXIF Upload Styles */
  .exif-upload-section {
    padding: 1.5rem;
  }

  .exif-description {
    color: #ccc;
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
    background: #2d2d44;
    border: 2px dashed #0066cc;
    border-radius: 8px;
    cursor: pointer;
    color: #ccc;
    transition: all 0.2s ease;
    font-weight: 500;
  }

  .exif-file-label:hover {
    background: #3d3d54;
    border-color: #0099ff;
    color: white;
  }

  .exif-file-label svg {
    color: #0066cc;
  }

  .selected-files {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: #2d2d44;
    border-radius: 8px;
  }

  .selected-files h4 {
    margin: 0 0 0.75rem 0;
    color: white;
    font-size: 1rem;
  }

  .selected-files ul {
    margin: 0;
    padding-left: 1.5rem;
    color: #ccc;
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
    top: 0rem;
    right: 20px;
    left: auto;
    bottom: auto;
    z-index: 50;
    width: 128px;
    height: 128px;
    transition: opacity 0.2s ease;
    object-fit: contain;
  }
  .culoca-logo:hover {
    opacity: 1;
  }
  @media (max-width: 600px) {
    .culoca-logo {
      top: 0.5rem;
      right: 8px;
      left: auto;
      width: 96px;
      height: 96px;
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
  @media (max-width: 600px) {
    .settings-fab {
      right: 1rem;
      bottom: 1rem;
      width: 48px;
      height: 48px;
      font-size: 1.2rem;
    }
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
    background: #181a20;
    color: #fff;
    padding: 3rem;
    border-radius: 16px;
    text-align: center;
    max-width: 400px;
    margin: 2rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
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

</style>
