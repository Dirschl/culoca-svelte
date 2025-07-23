<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import * as exifr from 'exifr';
  import { env as publicEnv } from '$env/dynamic/public';
  import { authFetch } from '$lib/authFetch';

  // Map picker state
  let mapContainer: HTMLElement;
  let map: any = null;
  let marker: any = null;
  let selectedImage: ImageFile | null = null;
  let showMapPicker = false;
  let mapType: 'standard' | 'hybrid' = 'standard';
  let searchQuery = '';
  let searchResults: any[] = [];
  let isSearching = false;
  let searchInput: HTMLInputElement;
  
  // Camera functionality
  let isMobile = false;
  let cameraInput: HTMLInputElement;
  let isCameraActive = false;
  
  // Location management
  let userLat: number | null = null;
  let userLon: number | null = null;
  let lastSelectedLat: number | null = null;
  let lastSelectedLon: number | null = null;
  let isGettingUserLocation = false;
  let currentMapLat: number = 48.1351;
  let currentMapLon: number = 11.5820;
  let isLocationSuccess = false;

  // Helper: fix IPTC strings that were decoded as Latin-1 instead of UTF-8
  function fixEncoding(str: string | null): string | null {
    if (!str) return str;
    
    // Einfache, saubere UTF-8 Konvertierung
    try {
      // Wenn der String Umlaut-Probleme hat, konvertiere von Latin1 zu UTF-8
      if (str.includes('Ã')) {
        // Browser-kompatible Latin1 zu UTF-8 Konvertierung
        const latin1Bytes = new Uint8Array(str.length);
        for (let i = 0; i < str.length; i++) {
          latin1Bytes[i] = str.charCodeAt(i);
        }
        const fixed = new TextDecoder('utf-8').decode(latin1Bytes);
        console.log('🔧 Fixed encoding:', str, '->', fixed);
        return fixed;
      }
    } catch (e) {
      console.log('🔧 Encoding fix failed for:', str);
    }
    
    return str;
  }

  interface ImageFile {
    file: File;
    id: string;
    name: string;
    originalFileName: string; // Ursprünglicher Dateiname für Datenbank
    preview: string;
    exifData: any;
    title: string;
    description: string;
    keywords: string;
    lat: number | null;
    lon: number | null;
    isValid: boolean;
    errors: string[];
    isUploading: boolean;
    uploadProgress: number;
    statusMessage: string;
  }

  let files: ImageFile[] = [];
  let dragOver = false;
  let isProcessing = false;
  let isUploading = false;
  let message = '';
  let messageType: 'success' | 'error' | 'info' = 'info';

  // Validation limits
  const TITLE_MIN_LENGTH = 40;
  const TITLE_MAX_LENGTH = 60;
  const DESCRIPTION_MIN_LENGTH = 100; // Von 120 auf 100 reduziert
  const DESCRIPTION_MAX_LENGTH = 160; // 160 ist inklusiv, nicht exklusiv
  const KEYWORDS_MIN = 10;
  const KEYWORDS_MAX = 50;

  function getKeywordCount(text: string): number {
    return text.split(',').map(w => w.trim()).filter(w => w.length > 0).length;
  }

  function validateImage(image: ImageFile): boolean {
    image.errors = [];
    
    // Title validation
    if (!image.title.trim()) {
      image.errors.push('Titel ist erforderlich');
    } else if (image.title.length < TITLE_MIN_LENGTH) {
      image.errors.push(`Titel muss mindestens ${TITLE_MIN_LENGTH} Zeichen haben`);
    } else if (image.title.length > TITLE_MAX_LENGTH) {
      image.errors.push(`Titel darf maximal ${TITLE_MAX_LENGTH} Zeichen haben`);
    }
    
    // Description validation
    if (!image.description.trim()) {
      image.errors.push('Beschreibung ist erforderlich');
    } else if (image.description.length < DESCRIPTION_MIN_LENGTH) {
      image.errors.push(`Beschreibung muss mindestens ${DESCRIPTION_MIN_LENGTH} Zeichen haben`);
    } else if (image.description.length > DESCRIPTION_MAX_LENGTH) {
      image.errors.push(`Beschreibung darf maximal ${DESCRIPTION_MAX_LENGTH} Zeichen haben`);
    }
    
    // Keywords validation
    if (!image.keywords.trim()) {
      image.errors.push('Keywords sind erforderlich');
    } else {
      const keywordCount = getKeywordCount(image.keywords);
      if (keywordCount < KEYWORDS_MIN) {
        image.errors.push(`Mindestens ${KEYWORDS_MIN} Keywords erforderlich`);
      } else if (keywordCount > KEYWORDS_MAX) {
        image.errors.push(`Maximal ${KEYWORDS_MAX} Keywords erlaubt`);
      }
    }
    
    // GPS coordinates validation
    if (image.lat === null || image.lon === null) {
      image.errors.push('GPS-Koordinaten sind erforderlich');
    }
    
    image.isValid = image.errors.length === 0;
    return image.isValid;
  }

  function validateAllImages(): boolean {
    return files.every(validateImage);
  }

  function getWordCount(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  function getCharacterCount(text: string): number {
    return text.length;
  }
  
  // Helper function to start upload with simple status
  function startUpload(image: ImageFile) {
    image.isUploading = true;
    image.uploadProgress = 0;
  }

  function removeImage(index: number) {
    files = files.filter((_, i) => i !== index);
  }

  function handleFileSelect(event: Event) {
    console.log('DEBUG: handleFileSelect ausgelöst', event);
    const input = event.target as HTMLInputElement;
    if (input.files) {
      processFiles(Array.from(input.files));
    }
  }

  function openCamera() {
    if (cameraInput) {
      isCameraActive = true;
      cameraInput.click();
    }
  }

  function handleCameraCapture(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      processFiles(Array.from(input.files));
      isCameraActive = false;
      // Reset the input so the same file can be selected again
      input.value = '';
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    dragOver = false;
    
    if (event.dataTransfer?.files) {
      processFiles(Array.from(event.dataTransfer.files));
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    dragOver = true;
  }

  function handleDragLeave() {
    dragOver = false;
  }

  let lastImageData: { title?: string; description?: string; keywords?: string; lat?: number | null; lon?: number | null } = {};
  let currentUserId: string | null = null;

  async function processFiles(fileList: File[]) {
    isProcessing = true;
    message = 'Verarbeite Dateien...';
    messageType = 'info';

    // Hole User-ID für Dateinamen
    if (!currentUserId) {
      const sessionResult = await supabase.auth.getSession();
      currentUserId = sessionResult.data.session?.user?.id || null;
    }

    const newImages: ImageFile[] = [];
    const autoUploadImages: ImageFile[] = [];
    
    for (const file of fileList) {
      // Check if file is an image
      if (!file.type.startsWith('image/')) {
        message = `Datei "${file.name}" ist kein Bild`;
        messageType = 'error';
        continue;
      }

      // Check file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        message = `Datei "${file.name}" ist zu groß (max 50MB)`;
        messageType = 'error';
        continue;
      }

      const imageFile: ImageFile = {
        file,
        id: crypto.randomUUID(),
        name: file.name,
        originalFileName: file.name, // Initialwert, wird später überschrieben
        preview: URL.createObjectURL(file),
        exifData: null,
        title: '',
        description: '',
        keywords: '',
        lat: null,
        lon: null,
        isValid: false,
        errors: [],
        isUploading: false,
        uploadProgress: 0,
        statusMessage: ''
      };

      try {
        // Extract EXIF data
        const arrayBuffer = await file.arrayBuffer();
        const exifData = await exifr.parse(arrayBuffer, { iptc: true });
        
        if (exifData) {
          imageFile.exifData = exifData;
          
          // Title - IPTC Headline hat Priorität, dann andere Quellen (wie im Backend)
          if (exifData['IPTC:Headline']) {
            imageFile.title = fixEncoding(exifData['IPTC:Headline']) || '';
          } else if (exifData.iptc && exifData.iptc.Headline) {
            imageFile.title = fixEncoding(exifData.iptc.Headline) || '';
          } else if (exifData.iptc && exifData.iptc.ObjectName) {
            imageFile.title = fixEncoding(exifData.iptc.ObjectName) || '';
          } else if (exifData['IPTC:ObjectName']) {
            imageFile.title = fixEncoding(exifData['IPTC:ObjectName']) || '';
          }
          
          // Heuristische Suche: jedes Feld, das auf 'title' oder 'headline' endet
          if (!imageFile.title) {
            for (const [k, v] of Object.entries(exifData)) {
              const keyLower = k.toLowerCase();
              if (keyLower.endsWith('title') || keyLower.endsWith('headline') || keyLower.endsWith('objectname')) {
                imageFile.title = fixEncoding(v as string) || '';
                break;
              }
            }
          }
          
          // Description - IPTC Description hat Priorität, dann andere Quellen
          if (exifData['IPTC:Description']) {
            imageFile.description = fixEncoding(exifData['IPTC:Description']) || '';
          } else if (exifData.iptc && exifData.iptc.Description) {
            imageFile.description = fixEncoding(exifData.iptc.Description) || '';
          } else if (exifData.iptc && exifData.iptc.CaptionAbstract) {
            imageFile.description = fixEncoding(exifData.iptc.CaptionAbstract) || '';
          } else if (exifData['IPTC:CaptionAbstract']) {
            imageFile.description = fixEncoding(exifData['IPTC:CaptionAbstract']) || '';
          } else if (exifData.ImageDescription) {
            // ImageDescription ist eine Beschreibung, nicht ein Titel
            imageFile.description = fixEncoding(exifData.ImageDescription) || '';
          }
          
          // Keywords – unterstützen mehrere Quellen (EXIF, IPTC)
          if (Array.isArray(exifData.Keywords)) {
            imageFile.keywords = fixEncoding(exifData.Keywords.join(', ')) || '';
          } else if (typeof exifData.Keywords === 'string') {
            imageFile.keywords = fixEncoding(exifData.Keywords) || '';
          }

          if (!imageFile.keywords && exifData.iptc && Array.isArray(exifData.iptc.Keywords)) {
            imageFile.keywords = fixEncoding(exifData.iptc.Keywords.join(', ')) || '';
          }

          if (!imageFile.keywords && typeof exifData['IPTC:Keywords'] === 'string') {
            imageFile.keywords = fixEncoding(exifData['IPTC:Keywords']) || '';
          }
          
          // Heuristische Suche: jedes Feld, das auf 'keywords' endet und ein Array/String ist
          if (!imageFile.keywords) {
            for (const [k, v] of Object.entries(exifData)) {
              if (k.toLowerCase().endsWith('keywords')) {
                if (Array.isArray(v)) {
                  imageFile.keywords = fixEncoding((v as any).join(', ')) || '';
                } else if (typeof v === 'string') {
                  imageFile.keywords = fixEncoding(v as string) || '';
                }
                if (imageFile.keywords) break;
              }
            }
          }
          
          // Extract GPS coordinates
          if (exifData.latitude && exifData.longitude) {
            imageFile.lat = exifData.latitude;
            imageFile.lon = exifData.longitude;
          }
        }
      } catch (error) {
        console.error('Error extracting EXIF data:', error);
      }

      // Fallback: Hole aktuellen Standort, falls keine EXIF-GPS-Daten
      if ((imageFile.lat === null || imageFile.lon === null) && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 });
          });
          imageFile.lat = pos.coords.latitude;
          imageFile.lon = pos.coords.longitude;
        } catch (e) {
          // Kein Standort verfügbar, bleibt null
        }
      }

      // WICHTIG: originalName wird für Datenbank verwendet, imageFile.name für Anzeige
      const originalFileName = file.name; // Bewahre ursprünglichen Dateinamen auf
      
      // Prüfe ob Dateiname generisch/automatisch generiert ist
      const genericNames = ['image.jpg', 'image.jpeg', 'photo.jpg', 'photo.jpeg', 'image.png', 'photo.png', 'image', 'photo'];
      const isGeneric = !imageFile.name || genericNames.includes(imageFile.name.toLowerCase());
      
      // Nur für ANZEIGE-Zwecke einen besseren Namen generieren, NICHT für Datenbank
      if ((isGeneric || imageFile.name.startsWith('PXL_') || imageFile.name.startsWith('IMG_')) && currentUserId && imageFile.lat && imageFile.lon) {
        const ts = Date.now();
        const latStr = imageFile.lat.toFixed(6);
        const lonStr = imageFile.lon.toFixed(6);
        // Für Anzeige: verwende generierten Namen
        imageFile.name = `📍 ${originalFileName} (${latStr}, ${lonStr})`;
      }
      
      // Bewahre den ursprünglichen Dateinamen für Upload auf
      imageFile.originalFileName = originalFileName;

      // Validate the image
      validateImage(imageFile);
      
      // Check if image is complete and valid
      if (imageFile.isValid) {
        autoUploadImages.push(imageFile);
      } else {
        newImages.push(imageFile);
      }
    }

    // Add images that need correction to the list
    files = [...files, ...newImages];
    
    // Auto-upload complete images
    if (autoUploadImages.length > 0) {
      message = `${newImages.length} Bilder zur Korrektur, ${autoUploadImages.length} werden automatisch hochgeladen...`;
      messageType = 'info';
      
      // Start auto-upload
      await autoUploadImagesSequentially(autoUploadImages);
    } else {
      message = `${newImages.length} Bilder zur Korrektur hinzugefügt`;
      messageType = 'info';
    }
    
    isProcessing = false;
  }

  async function uploadImages() {
    if (!validateAllImages()) {
      message = 'Bitte alle Fehler beheben, bevor du den Upload startest';
      messageType = 'error';
      return;
    }

    isUploading = true;
    message = 'Starte Upload...';
    messageType = 'info';

    const sessionResult = await supabase.auth.getSession();
    const currentUser = sessionResult.data.session?.user;
    
    if (!currentUser) {
      message = '❌ Bitte zuerst einloggen';
      messageType = 'error';
      isUploading = false;
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    const successfulUploads: { title: string; description: string; keywords: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const image = files[i];
      image.isUploading = true;
      image.uploadProgress = 0;

      try {
        // --- NEUE LOGIK ---
        // 1) Original in Supabase hochladen
        const id = crypto.randomUUID();
        const supabasePath = await uploadOriginalToSupabase(image.file, id);

        // 2) Metadaten für Backend-Route vorbereiten (kein Original mehr mitsenden!)
        const access_token = sessionResult.data.session?.access_token;
        const formData = new FormData();
        formData.append('filename', `${id}.jpg`);
        formData.append('original_path', supabasePath);
        formData.append('original_filename', image.originalFileName); // Ursprünglicher Dateiname
        formData.append('title', image.title);
        formData.append('description', image.description);
        formData.append('keywords', image.keywords);
        if (image.lat !== null) formData.append('lat', image.lat.toString());
        if (image.lon !== null) formData.append('lon', image.lon.toString());

        // EXIF JSON anhängen (bereinigt, ohne MakerNotes)
        if (image.exifData) {
          const cleanExif: Record<string, any> = {};
          for (const [k, v] of Object.entries(image.exifData)) {
            if (k.toLowerCase().includes('makernotes')) continue;
            if (typeof v === 'bigint') {
              cleanExif[k] = v.toString();
            } else if (v instanceof ArrayBuffer || v instanceof Uint8Array) {
              // Binary Felder auslassen
              continue;
            } else {
              cleanExif[k] = v;
            }
          }
          try {
            formData.append('exif_json', JSON.stringify(cleanExif));
          } catch (jsonErr) {
            console.warn('⚠️  Could not stringify EXIF data:', jsonErr);
          }
        }

        // Logge das gesamte FormData
        for (const [key, value] of formData.entries()) {
          console.log('DEBUG: FormData:', key, value);
        }

        const response = await authFetch('/api/upload', {
          method: 'POST',
          headers: {
            ...(access_token ? { 'Authorization': `Bearer ${access_token}` } : {})
          },
          body: formData
        });
        console.log('DEBUG: Response von /api/upload:', response);
        if (response.ok) {
          successCount++;
          image.uploadProgress = 100;
          successfulUploads.push({
            title: image.title,
            description: image.description,
            keywords: image.keywords
          });
        } else {
          errorCount++;
          image.errors.push(`Upload fehlgeschlagen: ${response.statusText}`);
        }
      } catch (error) {
        errorCount++;
        image.errors.push(`Upload fehlgeschlagen: ${error}`);
      } finally {
        image.isUploading = false;
      }
    }

    isUploading = false;
    if (errorCount === 0) {
      // lastImageData auf das letzte erfolgreich hochgeladene Bild setzen
      if (successfulUploads.length > 0) {
        const last = successfulUploads[successfulUploads.length - 1];
        lastImageData = {
          title: last.title,
          description: last.description,
          keywords: last.keywords
        };
      }
      message = `✅ Alle ${successCount} Bilder erfolgreich hochgeladen!`;
      messageType = 'success';
      // Wichtig: Erst nach der Erfolgsmeldung die files leeren
      setTimeout(() => {
        files = [];
      }, 1000); // Kurze Verzögerung, damit die Erfolgsmeldung sichtbar ist
    } else {
      message = `⚠️ ${successCount} erfolgreich, ${errorCount} fehlgeschlagen`;
      messageType = 'error';
    }

    // lastImageData auf das letzte erfolgreich hochgeladene Bild setzen
    if (successfulUploads.length > 0) {
      const last = successfulUploads[successfulUploads.length - 1];
      lastImageData = {
        title: last.title,
        description: last.description,
        keywords: last.keywords
      };
    }
    localStorage.setItem('culoca-lastImageData', JSON.stringify(lastImageData));
  }

  function openMapPicker(image: ImageFile) {
    selectedImage = image;
    showMapPicker = true;
    
    console.log('Opening map picker for image:', {
      imageId: image.id,
      currentLat: image.lat,
      currentLon: image.lon
    });
    
    // Initialize map on next tick to ensure container is rendered
    setTimeout(() => {
      initMap();
    }, 100);
  }

  function initMap() {
    if (!mapContainer || map) return;

    // Load Leaflet CSS and JS dynamically
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      const L = (window as any).L;
      
      // Initialize map with intelligent position
      const [initialLat, initialLon, initialZoom] = getInitialMapPosition();
      map = L.map(mapContainer).setView([initialLat, initialLon], initialZoom);
      
      // Set initial coordinates
      currentMapLat = initialLat;
      currentMapLon = initialLon;
      
      // Add tile layers
      const standardLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      });
      
      const hybridLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri'
      });
      
      // Add default layer
      standardLayer.addTo(map);
      
      // Store layers for toggling
      (map as any).standardLayer = standardLayer;
      (map as any).hybridLayer = hybridLayer;
      (map as any).currentLayer = standardLayer;
      
      // Create a fixed center marker
      const centerIcon = L.divIcon({
        className: 'center-marker',
        html: '<div style="background-color: #ff4444; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      
      marker = L.marker(map.getCenter(), { 
        icon: centerIcon,
        draggable: false,
        zIndexOffset: 1000
      }).addTo(map);
      
      // Set initial position if coordinates exist
      if (selectedImage && selectedImage.lat && selectedImage.lon) {
        map.setView([selectedImage.lat, selectedImage.lon], 13);
        marker.setLatLng([selectedImage.lat, selectedImage.lon]);
        // Update current coordinates to match the selected image
        currentMapLat = selectedImage.lat;
        currentMapLon = selectedImage.lon;
      }
      
      // Update marker position and coordinates when map moves
      map.on('move', () => {
        const center = map.getCenter();
        marker.setLatLng(center);
        
        // Update current coordinates
        currentMapLat = center.lat;
        currentMapLon = center.lng;
        
        if (selectedImage) {
          selectedImage.lat = center.lat;
          selectedImage.lon = center.lng;
          validateImage(selectedImage);
        }
      });
    };
    document.head.appendChild(script);
  }

  function toggleMapType() {
    if (!map) return;
    
    mapType = mapType === 'standard' ? 'hybrid' : 'standard';
    
    const currentLayer = (map as any).currentLayer;
    const newLayer = mapType === 'standard' ? (map as any).standardLayer : (map as any).hybridLayer;
    
    currentLayer.remove();
    newLayer.addTo(map);
    (map as any).currentLayer = newLayer;
  }

  function closeMapPicker() {
    showMapPicker = false;
    selectedImage = null;
    if (map) {
      map.remove();
      map = null;
      marker = null;
    }
  }

  function confirmMapSelection() {
    if (selectedImage && map) {
      // Use the current map coordinates that are displayed in the footer
      const newLat = currentMapLat;
      const newLon = currentMapLon;
      
      console.log('Before setting coordinates:', {
        imageId: selectedImage.id,
        oldLat: selectedImage.lat,
        oldLon: selectedImage.lon,
        newLat: newLat,
        newLon: newLon
      });
      
      selectedImage.lat = newLat;
      selectedImage.lon = newLon;
      
      console.log('After setting coordinates:', {
        imageId: selectedImage.id,
        lat: selectedImage.lat,
        lon: selectedImage.lon
      });
      
      // Force Svelte to recognize the change by triggering a reactive update
      files = [...files];
      
      validateImage(selectedImage);
      
      // Save last selected position for future use
      lastSelectedLat = newLat;
      lastSelectedLon = newLon;
      
      console.log('Map selection confirmed:', {
        imageId: selectedImage.id,
        lat: selectedImage.lat,
        lon: selectedImage.lon
      });
    }
    closeMapPicker();
  }

  async function searchLocation() {
    if (!searchQuery.trim()) return;
    
    isSearching = true;
    searchResults = [];
    
    try {
      // Use Nominatim (OpenStreetMap geocoding service)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&addressdetails=1`
      );
      
      if (response.ok) {
        const data = await response.json();
        searchResults = data;
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      isSearching = false;
    }
  }

  function selectSearchResult(result: any) {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    
    if (!isNaN(lat) && !isNaN(lon)) {
      // Update map view - marker will automatically follow center
      map.setView([lat, lon], 15);
      
      // Update current coordinates
      currentMapLat = lat;
      currentMapLon = lon;
      
      // Update selected image
      if (selectedImage) {
        selectedImage.lat = lat;
        selectedImage.lon = lon;
        validateImage(selectedImage);
      }
      
      // Clear search
      searchQuery = '';
      searchResults = [];
    }
  }

  function handleSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      searchLocation();
    }
  }
  
  // Get user's current location
  function getUserLocation() {
    if (!navigator.geolocation) {
      message = 'Geolocation wird von diesem Browser nicht unterstützt';
      messageType = 'error';
      return;
    }
    
    isGettingUserLocation = true;
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        userLat = position.coords.latitude;
        userLon = position.coords.longitude;
        isGettingUserLocation = false;
        isLocationSuccess = true;
        
        // If map is open, center it on user location
        if (map && userLat && userLon) {
          map.setView([userLat, userLon], 15);
          currentMapLat = userLat;
          currentMapLon = userLon;
        }
        
      },
      (error) => {
        isGettingUserLocation = false;
        isLocationSuccess = false;
        console.error('Geolocation error:', error);
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Standortzugriff verweigert. Bitte erlaube den Zugriff in den Browsereinstellungen.';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Standortinformationen nicht verfügbar.';
            break;
          case error.TIMEOUT:
            message = 'Standortabfrage hat zu lange gedauert.';
            break;
          default:
            message = 'Fehler beim Ermitteln des Standorts.';
        }
        messageType = 'error';
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  }
  
  // Determine initial map position
  function getInitialMapPosition(): [number, number, number] {
    // If we have a last selected position, use that (likely more images nearby)
    if (lastSelectedLat && lastSelectedLon) {
      return [lastSelectedLat, lastSelectedLon, 13];
    }
    
    // If we have user location, use that
    if (userLat && userLon) {
      return [userLat, userLon, 13];
    }
    
    // Default to Munich
    return [48.1351, 11.5820, 8];
  }

  let saveOriginals = true;

  onMount(async () => {
    // Check if device is mobile
    isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Check authentication
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      message = 'Bitte zuerst einloggen';
      messageType = 'error';
      return;
    }
    // Load user profile for image format/quality
    const user = data.session.user;
    if (user) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('save_originals')
        .eq('id', user.id)
        .single();
              if (profile) {
          saveOriginals = profile.save_originals ?? true;
        }
    }
    
    // Try to get user location on page load
    getUserLocation();

    // lastImageData beim Laden aus localStorage holen
    const stored = localStorage.getItem('culoca-lastImageData');
    if (stored) {
      try {
        lastImageData = JSON.parse(stored);
      } catch (e) {
        // Fehler beim Parsen ignorieren
      }
    }
  });

  async function uploadSingleImage(image: ImageFile) {
    if (!image.isValid || image.isUploading) return;
    
    startUpload(image);
          image.statusMessage = '🔧 Fixed encoding...';
      // Simulate the encoding fix messages from the log
      setTimeout(() => {
        if (image.isUploading) {
          image.statusMessage = '📤 DEBUG: FormData: filename ' + crypto.randomUUID() + '.jpg';
        }
      }, 500);
      
      // Add more detailed status messages
      setTimeout(() => {
        if (image.isUploading) {
          image.statusMessage = '📥 Downloading from Supabase...';
        }
      }, 1000);
      
      setTimeout(() => {
        if (image.isUploading) {
          image.statusMessage = '🔍 Extracting EXIF data...';
        }
      }, 1500);
      
      setTimeout(() => {
        if (image.isUploading) {
          image.statusMessage = '🖼️ Processing image...';
        }
      }, 2000);
    try {
      const sessionResult = await supabase.auth.getSession();
      const currentUser = sessionResult.data.session?.user;
      if (!currentUser) {
        message = '❌ Bitte zuerst einloggen';
        messageType = 'error';
        image.isUploading = false;
        return;
      }
      const id = crypto.randomUUID();
      // 1) Original zu Supabase Storage
      const supabasePath = await uploadOriginalToSupabase(image.file, id);

      // 2) Metadaten an Vercel senden
      const access_token = sessionResult.data.session?.access_token;
              // Create FormData for upload API
        const formData = new FormData();
        formData.append('filename', `${id}.jpg`);
        formData.append('original_path', supabasePath);
        formData.append('original_filename', image.originalFileName); // Ursprünglicher Dateiname
        formData.append('title', image.title);
        formData.append('description', image.description);
        formData.append('keywords', image.keywords);
        if (image.lat !== null) formData.append('lat', image.lat.toString());
        if (image.lon !== null) formData.append('lon', image.lon.toString());
        
        // Logge das gesamte FormData
        for (const [key, value] of formData.entries()) {
          console.log('DEBUG: FormData:', key, value);
        }

        const response = await authFetch('/api/upload', {
          method: 'POST',
          headers: {
            ...(access_token ? { 'Authorization': `Bearer ${access_token}` } : {})
          },
          body: formData
        });
      const result = await response.json();
      console.log('DEBUG: JSON-Resultat:', result);
      if (result.status === 'success') {
        image.uploadProgress = 100;
        message = `✅ "${image.originalFileName}" erfolgreich hochgeladen!`;
        messageType = 'success';
        files = files.filter(f => f.id !== image.id);
        // lastImageData nach Upload setzen
        lastImageData = {
          title: image.title,
          description: image.description,
          keywords: image.keywords
        };
        image.statusMessage = '✅ Upload abgeschlossen';
              } else {
          image.errors.push(`Upload fehlgeschlagen: ${result.message}`);
          message = `❌ Upload von "${image.originalFileName}" fehlgeschlagen`;
          messageType = 'error';
          image.statusMessage = `❌ Upload failed: ${result.message}`;
        }
    } catch (error) {
      image.errors.push(`Upload fehlgeschlagen: ${error}`);
      message = `❌ Upload von "${image.originalFileName}" fehlgeschlagen`;
      messageType = 'error';
      image.statusMessage = `Upload fehlgeschlagen: ${error}`;
    } finally {
      image.isUploading = false;
    }
    localStorage.setItem('culoca-lastImageData', JSON.stringify(lastImageData));
  }

  async function autoUploadImagesSequentially(images: ImageFile[]) {
    const sessionResult = await supabase.auth.getSession();
    const currentUser = sessionResult.data.session?.user;
    if (!currentUser) {
      message = '❌ Bitte zuerst einloggen';
      messageType = 'error';
      return;
    }
    let successCount = 0;
    let errorCount = 0;
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      startUpload(image);
      try {
        const id = crypto.randomUUID();
        // 1) Original zu Supabase Storage
        const supabasePath = await uploadOriginalToSupabase(image.file, id);

        // 2) Metadaten an Vercel senden
        const access_token = sessionResult.data.session?.access_token;
        // Create FormData for upload API
        const formData = new FormData();
        formData.append('filename', `${id}.jpg`);
        formData.append('original_path', supabasePath);
        formData.append('original_filename', image.originalFileName); // Ursprünglicher Dateiname
        formData.append('title', image.title);
        formData.append('description', image.description);
        formData.append('keywords', image.keywords);
        if (image.lat !== null) formData.append('lat', image.lat.toString());
        if (image.lon !== null) formData.append('lon', image.lon.toString());
        
        // EXIF JSON anhängen (bereinigt, ohne MakerNotes)
        if (image.exifData) {
          const cleanExif: Record<string, any> = {};
          for (const [k, v] of Object.entries(image.exifData)) {
            if (k.toLowerCase().includes('makernotes')) continue;
            cleanExif[k] = v;
          }
          formData.append('exif_json', JSON.stringify(cleanExif));
        }

        // Logge das gesamte FormData
        for (const [key, value] of formData.entries()) {
          console.log('DEBUG: FormData:', key, value);
        }

        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            ...(access_token ? { 'Authorization': `Bearer ${access_token}` } : {})
          },
          body: formData
        });
        const result = await response.json();
        console.log('DEBUG: JSON-Resultat:', result);
        if (result.status === 'success') {
          successCount++;
          image.uploadProgress = 100;
          // lastImageData nach Upload setzen
          lastImageData = {
            title: image.title,
            description: image.description,
            keywords: image.keywords
          };
        } else {
          errorCount++;
          image.errors.push(`Auto-Upload fehlgeschlagen: ${result.message}`);
          files = [...files, image];
        }
      } catch (error) {
        errorCount++;
        image.errors.push(`Auto-Upload fehlgeschlagen: ${error}`);
        files = [...files, image];
      } finally {
        image.isUploading = false;
      }
      message = `📤 Auto-Upload: ${i + 1}/${images.length} (${successCount} erfolgreich, ${errorCount} fehlgeschlagen)`;
    }
    if (errorCount === 0) {
      message = `✅ Alle ${successCount} Bilder automatisch hochgeladen!`;
      messageType = 'success';
    } else {
      message = `⚠️ ${successCount} automatisch hochgeladen, ${errorCount} zur manuellen Korrektur`;
      messageType = 'error';
    }
    localStorage.setItem('culoca-lastImageData', JSON.stringify(lastImageData));
  }



  // Hilfsfunktion: Original in Supabase Storage hochladen
  async function uploadOriginalToSupabase(file: File, id: string) {
    const path = `${id}.jpg`;
    const { data, error } = await supabase.storage
      .from('originals')
      .upload(path, file, {
        contentType: file.type,
        upsert: false
      });
    
    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }
    
    return path;
  }
</script>

<svelte:head>
  <title>Massen-Upload - Culoca</title>
</svelte:head>

<div class="bulk-upload-container">
  
  {#if message}
    <div class="message {messageType}">
      {message}
    </div>
  {/if}

  <!-- Camera Input (hidden) -->
  <input 
    type="file" 
    bind:this={cameraInput}
    accept="image/*"
    capture="environment"
    on:change={handleCameraCapture}
    style="display: none;" 
  />

  <!-- File Upload Area -->
  <div class="upload-area" 
       class:drag-over={dragOver}
       on:dragover={handleDragOver}
       on:dragleave={handleDragLeave}
       on:drop={handleDrop}>
    
    <input type="file" 
           id="file-input" 
           multiple 
           accept="image/*"
           on:change={handleFileSelect}
           style="display: none;" />
    <div class="upload-header-row">
      <a href="/" class="back-to-app-btn">← Zurück zur App</a>
      <div class="upload-icon">
        {#if isMobile}
          <button 
            type="button" 
            class="camera-btn camera-round-btn mobile-camera-btn {isLocationSuccess ? 'location-success' : ''}"
            on:click={openCamera}
            disabled={isCameraActive}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
              <circle cx="12" cy="13" r="3"/>
            </svg>
          </button>
        {:else}
          <button 
            type="button" 
            class="camera-btn camera-round-btn desktop-camera-btn {isLocationSuccess ? 'location-success' : ''}"
            on:click={openCamera}
            disabled={isCameraActive}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
              <circle cx="12" cy="13" r="3"/>
            </svg>
          </button>
        {/if}
      </div>
    </div>
    <label for="file-input" class="upload-label">
      <div class="upload-text">
        <strong>Dateien hierher ziehen</strong> oder klicken zum Auswählen
      </div>
      <div class="upload-hint">
        Unterstützte Formate: JPEG, PNG, WebP (max. 50MB pro Datei)
      </div>
    </label>
  </div>

  <!-- Image List -->
  {#if files.length > 0}
    <div class="images-container">
      <h2>Bilder zur Korrektur ({files.length})</h2>
      
      <div class="validation-summary">
        {#if isUploading}
          <div class="validation-info">📤 Upload läuft...</div>
        {:else if validateAllImages()}
          <div class="validation-success">✅ Alle Bilder sind bereit für den Upload</div>
        {:else}
          <div class="validation-error">⚠️ Bitte alle Fehler beheben</div>
        {/if}
      </div>

      <div class="images-grid">
        {#each files as image, index (image.id)}
          <div class="image-card" class:valid={image.isValid} class:invalid={!image.isValid}>
            <div class="image-preview">
              <img src={image.preview} alt={image.name} />
              {#if image.isUploading}
                <div class="upload-status">
                  <span>{image.statusMessage || 'Upload gestartet...'}</span>
                </div>
              {:else if image.uploadProgress === 100}
                <div class="upload-success">
                  <span>✅ Upload abgeschlossen</span>
                </div>
              {/if}
            </div>

            <div class="image-info">
              <div class="image-name">{image.name}</div>
              
              <!-- Title Input -->
              <div class="input-group title-group">
                <label for="title-{image.id}" style="cursor:pointer" on:click={() => { image.title = ''; document.getElementById(`title-${image.id}`)?.focus(); }}>Titel *</label>
                <div class="title-row">
                  <input 
                    type="text" 
                    id="title-{image.id}"
                    bind:value={image.title}
                    maxlength={TITLE_MAX_LENGTH}
                    on:input={() => validateImage(image)}
                    class:error={image.title.length < TITLE_MIN_LENGTH || image.title.length > TITLE_MAX_LENGTH}
                  />
                  {#if lastImageData.title && !image.title}
                    <button type="button" class="copy-field-btn" title="Letzten Titel übernehmen" on:click={() => { image.title = lastImageData.title ?? ''; validateImage(image); }}>
                      ⎘
                    </button>
                  {/if}
                </div>
                <div class="char-counter" class:error={image.title.length < TITLE_MIN_LENGTH}>
                  {getCharacterCount(image.title)}/{TITLE_MIN_LENGTH}-{TITLE_MAX_LENGTH}
                </div>
                <div class="title-info">
                  {#if image.title && image.title.split(',')[0]}
                    <span class="audioguide-hint">Audio / Info: {image.title.split(',')[0]}</span>
                  {/if}
                </div>
              </div>

              <!-- Description Input -->
              <div class="input-group">
                <label for="desc-{image.id}" style="cursor:pointer" on:click={() => { image.description = ''; document.getElementById(`desc-${image.id}`)?.focus(); }}>Beschreibung *</label>
                <div class="desc-row">
                  <textarea 
                    id="desc-{image.id}"
                    bind:value={image.description}
                    maxlength={DESCRIPTION_MAX_LENGTH}
                    on:input={() => validateImage(image)}
                    class:error={image.description.length < DESCRIPTION_MIN_LENGTH || image.description.length > DESCRIPTION_MAX_LENGTH}
                  ></textarea>
                  {#if lastImageData.description && !image.description}
                    <button type="button" class="copy-field-btn" title="Letzte Beschreibung übernehmen" on:click={() => { image.description = lastImageData.description ?? ''; validateImage(image); }}>
                      ⎘
                    </button>
                  {/if}
                </div>
                <div class="char-counter" class:error={image.description.length < DESCRIPTION_MIN_LENGTH}>
                  {getCharacterCount(image.description)}/{DESCRIPTION_MIN_LENGTH}-{DESCRIPTION_MAX_LENGTH}
                </div>
              </div>

              <!-- Keywords Input -->
              <div class="input-group">
                <label for="keywords-{image.id}" style="cursor:pointer" on:click={() => { image.keywords = ''; document.getElementById(`keywords-${image.id}`)?.focus(); }}>Keywords *</label>
                <div class="keywords-row">
                  <textarea 
                    id="keywords-{image.id}"
                    bind:value={image.keywords}
                    on:input={() => validateImage(image)}
                    class:error={getKeywordCount(image.keywords) < KEYWORDS_MIN || getKeywordCount(image.keywords) > KEYWORDS_MAX}
                    placeholder="Keywords durch Kommas getrennt"
                  ></textarea>
                  {#if lastImageData.keywords && !image.keywords.trim()}
                    <button type="button" class="copy-field-btn" title="Letzte Keywords übernehmen" on:click={() => { image.keywords = lastImageData.keywords ?? ''; validateImage(image); }}>
                      ⎘
                    </button>
                  {/if}
                </div>
                <div class="char-counter" class:error={getKeywordCount(image.keywords) < KEYWORDS_MIN}>
                  {getKeywordCount(image.keywords)}/{KEYWORDS_MIN}-{KEYWORDS_MAX} Keywords
                </div>
              </div>

              <!-- GPS Coordinates -->
              <div class="input-group">
                <label>GPS-Koordinaten *</label>
                <div class="gps-inputs">
                  <input 
                    type="number" 
                    step="any"
                    placeholder="Latitude"
                    bind:value={image.lat}
                    on:input={() => validateImage(image)}
                    class:error={image.lat === null}
                  />
                  <input 
                    type="number" 
                    step="any"
                    placeholder="Longitude"
                    bind:value={image.lon}
                    on:input={() => validateImage(image)}
                    class:error={image.lon === null}
                  />
                  <button type="button" class="map-picker-btn" on:click={() => openMapPicker(image)}>
                    🗺️ Karte
                  </button>
                </div>
              </div>

              <!-- Error Messages -->
              {#if image.errors.length > 0}
                <div class="error-messages">
                  {#each image.errors as error}
                    <div class="error-message">• {error}</div>
                  {/each}
                </div>
              {/if}

              <!-- Image Actions -->
              <div class="image-actions">
                <button 
                  type="button" 
                  class="upload-single-btn" 
                  class:disabled={!image.isValid || image.isUploading}
                  on:click={() => uploadSingleImage(image)}
                  disabled={!image.isValid || image.isUploading}
                >
                  {image.isUploading ? '📤 Upload...' : '📤 Hochladen'}
                </button>
                <button type="button" class="remove-btn" on:click={() => removeImage(index)}>
                  ❌ Entfernen
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>

      <!-- Upload Button (only show if there are images to correct) -->
    </div>
  {/if}

  <!-- Map Picker Modal -->
  {#if showMapPicker}
    <div class="map-modal">
      <div class="map-modal-content">
        <div class="map-modal-header">
          <h3>Standort auswählen</h3>
          <div class="map-controls">
            <button type="button" class="map-type-btn" on:click={toggleMapType}>
              {mapType === 'standard' ? '🛰️ Hybrid' : '🗺️ Standard'}
            </button>
            <button type="button" class="map-close-btn" on:click={closeMapPicker}>
              ✕
            </button>
          </div>
        </div>

        <!-- Search Bar -->
        <div class="map-search">
          <div class="search-input-container">
            <button 
              type="button" 
              class="location-btn" 
              on:click={() => {
                getUserLocation();
                // Set focus to search input after a short delay
                setTimeout(() => {
                  if (searchInput) {
                    searchInput.focus();
                  }
                }, 100);
              }}
              disabled={isGettingUserLocation}
              title="Eigenen Standort verwenden"
            >
              {isGettingUserLocation ? '⏳' : '📍'}
            </button>
            <input 
              type="text" 
              bind:value={searchQuery}
              bind:this={searchInput}
              placeholder="Ort suchen (z.B. München, Altötting, Bayern)"
              on:keydown={handleSearchKeydown}
              class="search-input"
            />
            <button type="button" class="search-btn" on:click={searchLocation}>
              {isSearching ? '🔍' : '🔍'}
            </button>
          </div>
          
          <!-- Search Results -->
          {#if searchResults.length > 0}
            <div class="search-results">
              {#each searchResults as result}
                <div class="search-result" on:click={() => selectSearchResult(result)}>
                  <div class="result-name">{result.display_name}</div>
                  <div class="result-type">{result.type}</div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
        
        <div class="map-container" bind:this={mapContainer}></div>
        
        <div class="map-modal-footer">
          <p>Aktuelle Position: {currentMapLat.toFixed(6)}, {currentMapLon.toFixed(6)}</p>
          <div class="map-actions">
            <button type="button" class="map-cancel-btn" on:click={closeMapPicker}>
              Abbrechen
            </button>
            <button type="button" class="map-confirm-btn" on:click={confirmMapSelection}>
              Bestätigen
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .bulk-upload-container {
    max-width: 100%;
    margin: 0 auto;
    padding: 20px;
    width: 100%;
  }

  .back-to-app-btn {
    display: inline-block;
    margin-bottom: 24px;
    padding: 10px 20px;
    background: var(--accent-color);
    color: #fff;
    border-radius: 8px;
    font-weight: 600;
    text-decoration: none;
    font-size: 1.1rem;
    transition: background 0.2s;
  }
  .back-to-app-btn:hover {
    background: var(--accent-hover);
    color: #fff;
    text-decoration: none;
  }

  h1 {
    text-align: center;
    margin-bottom: 30px;
    color: var(--text-color);
  }

  .message {
    padding: 12px 16px;
    border-radius: 8px;
    margin-bottom: 20px;
    font-weight: 500;
  }

  .message.success {
    background-color: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
  }

  .message.error {
    background-color: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
  }

  .message.info {
    background-color: #d1ecf1;
    color: #0c5460;
    border: 1px solid #bee5eb;
  }

  .upload-area {
    border: 2px dashed #ccc;
    border-radius: 12px;
    padding: 40px;
    text-align: center;
    transition: all 0.3s ease;
    background-color: var(--bg-secondary);
  }

  .upload-area.drag-over {
    border-color: var(--accent-color);
    background-color: var(--accent-bg);
  }

  .upload-label {
    cursor: pointer;
    display: block;
  }

  .upload-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .upload-text {
    font-size: 18px;
    margin-bottom: 8px;
    color: var(--text-color);
  }

  .upload-hint {
    font-size: 14px;
    color: var(--text-muted);
  }

  .images-container {
    margin-top: 30px;
  }

  .validation-summary {
    margin-bottom: 20px;
    padding: 12px 16px;
    border-radius: 8px;
  }

  .validation-success {
    background-color: #d4edda;
    color: #155724;
  }

  .validation-error {
    background-color: #f8d7da;
    color: #721c24;
  }

  .validation-info {
    background-color: #d1ecf1;
    color: #0c5460;
  }

  .images-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
  }

  .image-card {
    border: 1px solid #ddd;
    border-radius: 12px;
    overflow: hidden;
    background-color: var(--bg-secondary);
    transition: all 0.3s ease;
  }

  .image-card.valid {
    border-color: #28a745;
  }

  .image-card.invalid {
    border-color: #dc3545;
  }

  .image-preview {
    position: relative;
    height: 200px;
    overflow: hidden;
  }

  .image-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .upload-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 8px;
    text-align: center;
  }

  .progress-bar {
    height: 4px;
    background-color: var(--accent-color);
    transition: width 0.3s ease;
  }

  .image-info {
    padding: 16px;
  }

  .image-name {
    font-weight: 600;
    margin-bottom: 16px;
    color: var(--text-color);
    word-break: break-all;
  }

  .input-group {
    margin-bottom: 16px;
  }

  .input-group label {
    display: block;
    margin-bottom: 4px;
    font-weight: 500;
    color: var(--text-color);
  }

  .input-group input,
  .input-group textarea {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
    background-color: var(--bg-primary);
    color: var(--text-color);
  }

  .input-group input.error,
  .input-group textarea.error {
    border-color: #dc3545;
    background-color: #fff5f5;
  }

  .char-counter {
    font-size: 12px;
    color: var(--text-muted);
    text-align: right;
    margin-top: 4px;
  }

  .char-counter.error {
    color: #dc3545;
    font-weight: 500;
  }

  .gps-inputs {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .gps-inputs input {
    flex: 1;
  }

  .map-picker-btn {
    padding: 8px 12px;
    background-color: var(--accent-color);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
  }

  .error-messages {
    margin-top: 12px;
  }

  .error-message {
    color: #dc3545;
    font-size: 12px;
    margin-bottom: 4px;
  }

  .image-actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .upload-single-btn {
    padding: 6px 12px;
    background-color: var(--accent-color);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.3s ease;
  }

  .upload-single-btn:hover:not(.disabled) {
    background-color: var(--accent-hover);
  }

  .upload-single-btn.disabled {
    background-color: #6c757d;
    cursor: not-allowed;
  }

  .remove-btn {
    padding: 6px 12px;
    background-color: #dc3545;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
  }

  .upload-actions {
    text-align: center;
    margin-top: 20px;
  }

  .upload-status {
    margin-top: 12px;
    font-size: 14px;
  }

  .status-success {
    color: #28a745;
  }

  .status-error {
    color: #dc3545;
  }

  .upload-btn {
    padding: 16px 32px;
    background-color: var(--accent-color);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .upload-btn:hover:not(.disabled) {
    background-color: var(--accent-hover);
  }

  .upload-btn.disabled {
    background-color: #6c757d;
    cursor: not-allowed;
  }

  /* Map Modal Styles */
  .map-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .map-modal-content {
    background-color: var(--bg-primary);
    border-radius: 12px;
    width: 90%;
    max-width: 800px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
  }

  .map-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #ddd;
  }

  .map-modal-header h3 {
    margin: 0;
    color: var(--text-color);
  }

  /* Search Styles */
  .map-search {
    padding: 16px 20px;
    border-bottom: 1px solid #ddd;
  }

  .search-input-container {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  
  .location-btn {
    padding: 8px 12px;
    background-color: white;
    color: #28a745;
    border: 1px solid #28a745;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s ease;
  }
  
  .location-btn:hover:not(:disabled) {
    background-color: #f8f9fa;
    border-color: #218838;
    color: #218838;
  }
  
  .location-btn:disabled {
    background-color: #f8f9fa;
    border-color: #6c757d;
    color: #6c757d;
    cursor: not-allowed;
  }

  .search-input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
    background-color: var(--bg-primary);
    color: var(--text-color);
  }

  .search-input:focus {
    outline: none;
    border-color: var(--accent-color);
  }

  .search-btn {
    padding: 8px 12px;
    background-color: var(--accent-color);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
  }

  .search-results {
    margin-top: 8px;
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid #ddd;
    border-radius: 6px;
    background-color: var(--bg-primary);
  }

  .search-result {
    padding: 8px 12px;
    border-bottom: 1px solid #eee;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .search-result:hover {
    background-color: var(--bg-secondary);
  }

  .search-result:last-child {
    border-bottom: none;
  }

  .result-name {
    font-weight: 500;
    color: var(--text-color);
    font-size: 14px;
  }

  .result-type {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 2px;
  }

  .map-controls {
    display: flex;
    gap: 8px;
  }

  .map-type-btn {
    padding: 6px 12px;
    background-color: var(--accent-color);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
  }

  .map-close-btn {
    padding: 6px 12px;
    background-color: #6c757d;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
  }

  .map-container {
    height: 400px;
    width: 100%;
    position: relative;
  }

  /* Center marker styles */
  .center-marker {
    background: transparent !important;
    border: none !important;
  }

  .map-modal-footer {
    padding: 16px 20px;
    border-top: 1px solid #ddd;
  }

  .map-modal-footer p {
    margin: 0 0 12px 0;
    color: var(--text-muted);
    font-size: 14px;
  }

  .map-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .map-cancel-btn {
    padding: 8px 16px;
    background-color: #6c757d;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  .map-confirm-btn {
    padding: 8px 16px;
    background-color: var(--accent-color);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: var(--text-muted);
  }

  .empty-state h2 {
    margin-bottom: 1rem;
    color: var(--text-color);
  }

  .empty-state p {
    font-size: 1.1rem;
    line-height: 1.6;
  }

  /* Large screens - optimize for 3 columns */
  @media (min-width: 1400px) {
    .images-grid {
      grid-template-columns: repeat(3, 1fr);
      max-width: 100%;
    }
    .bulk-upload-container {
      padding: 20px 40px;
    }
  }

  /* Medium screens - 2 columns */
  @media (min-width: 900px) and (max-width: 1399px) {
    .images-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  /* Mobile screens */
  @media (max-width: 899px) {
    .images-grid {
      grid-template-columns: 1fr;
    }
    .bulk-upload-container {
      padding: 10px;
    }
  }

  /* Camera Section */
  .camera-section {
    margin-bottom: 2rem;
    text-align: center;
  }

  .camera-btn {
    padding: 1rem 2rem;
    border: none;
    border-radius: 12px;
    font-size: 1.1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .mobile-camera-btn {
    background: linear-gradient(135deg, #28a745, #20c997);
    color: white;
    box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);
  }

  .mobile-camera-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #218838, #1ea085);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(40, 167, 69, 0.4);
  }

  .desktop-camera-btn {
    background: linear-gradient(135deg, #007bff, #0056b3);
    color: white;
    box-shadow: 0 4px 15px rgba(0, 123, 255, 0.3);
  }

  .desktop-camera-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #0056b3, #004085);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 123, 255, 0.4);
  }

  .camera-btn:disabled {
    background: #6c757d;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .camera-hint {
    margin-top: 0.5rem;
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  /* CSS für den Button */
  .copy-last-btn {
    margin-bottom: 1rem;
    background: linear-gradient(135deg, #ff9800, #ffc107);
    color: #222;
    border: none;
    border-radius: 8px;
    padding: 0.5rem 1.5rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
  }
  .copy-last-btn:hover {
    background: linear-gradient(135deg, #ffc107, #ff9800);
    color: #000;
  }
  .title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .copy-last-btn-inline {
    background: linear-gradient(135deg, #ff9800, #ffc107);
    color: #222;
    border: none;
    border-radius: 8px;
    padding: 0.3rem 0.7rem;
    font-size: 1.1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
    margin-left: 0.2rem;
    display: flex;
    align-items: center;
    height: 2.2rem;
  }
  .copy-last-btn-inline:hover {
    background: linear-gradient(135deg, #ffc107, #ff9800);
    color: #000;
  }
  .title-info {
    font-size: 0.85rem;
    color: #888;
    margin-top: 0.2rem;
    display: flex;
    gap: 1.5rem;
    align-items: center;
  }
  .title-shortinfo {
    font-style: italic;
  }
  .audioguide-hint {
    color: #aaa;
    font-size: 0.85em;
  }
  .title-row, .desc-row, .keywords-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .copy-field-btn {
    background: #eee;
    color: #666;
    border: none;
    border-radius: 8px;
    padding: 0.2rem 0.6rem;
    font-size: 1.1rem;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
    margin-left: 0.2rem;
    display: flex;
    align-items: center;
    height: 2.2rem;
  }
  .copy-field-btn:hover {
    background: #ccc;
    color: #222;
  }
  /* CSS für den grünen Button bei erfolgreichem Standort */
  .location-success {
    background: linear-gradient(135deg, #28a745, #20c997) !important;
    color: white !important;
    box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3) !important;
  }
  /* CSS für Upload-Header-Row */
.upload-header-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 1.2rem;
  justify-content: center;
}
.back-to-app-btn {
  font-size: 1.1rem;
  padding: 0.5rem 1.2rem;
  border-radius: 8px;
  background: #f5f5f5;
  color: #333;
  text-decoration: none;
  font-weight: 500;
  transition: background 0.2s, color 0.2s;
  border: 1px solid #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 3.2rem;
  min-width: 180px;
  box-sizing: border-box;
  margin: 0;
}
.back-to-app-btn:hover {
  background: #e0e0e0;
  color: #111;
}
.camera-btn {
  min-width: 180px;
  height: 3.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  margin: 0;
  font-size: 1.7rem;
}
/* Runde, große Kamera-Button-Variante */
.camera-round-btn {
  width: 4.5rem;
  height: 4.5rem;
  min-width: 4.5rem;
  min-height: 4.5rem;
  max-width: 4.5rem;
  max-height: 4.5rem;
  border-radius: 50%;
  font-size: 2.3rem;
  padding: 0;
  background: linear-gradient(135deg, #007bff, #0056b3);
  color: white;
  border: none;
  box-shadow: 0 4px 15px rgba(0, 123, 255, 0.3);
  transition: background 0.2s, color 0.2s, box-shadow 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.camera-round-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #0056b3, #004085);
  color: #fff;
  box-shadow: 0 6px 20px rgba(0, 123, 255, 0.4);
}
.camera-round-btn:disabled {
  background: #6c757d;
  color: #eee;
  cursor: not-allowed;
  box-shadow: none;
}
</style> 