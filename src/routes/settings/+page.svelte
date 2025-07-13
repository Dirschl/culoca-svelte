<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { darkMode } from '$lib/darkMode';
  import { welcomeVisible, resetWelcome } from '$lib/welcomeStore';

  let user: any = null;
  let profile: any = null;
  let loading = true;
  let saving = false;
  let message = '';
  let messageType: 'success' | 'error' = 'success';

  // Profile fields
  let fullName = '';
  let address = '';
  let phone = '';
  let website = '';
  let facebook = '';
  let instagram = '';
  let twitter = '';
  let useJustifiedLayout = true;
  let showAddress = false;
  let showPhone = false;
  let showWebsite = false;
  let showSocial = false;
  let showDistance = false;
  let showCompass = false;
  let autoguide = false;
  let newsFlashMode: 'aus' | 'eigene' | 'alle' = 'alle';
  let showWelcome = true;

  
  // Upload Einstellungen
  let saveOriginals = true;

  let galleryLayout = 'grid';

  let userLat: number | null = null;
  let userLon: number | null = null;

  // GPS tracking variables
  let gpsWatchId: number | null = null;
  let lastKnownLat: number | null = null;
  let lastKnownLon: number | null = null;
  let gpsTrackingActive = false;

  onMount(() => {
    (async () => {
      // Check if user is authenticated
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        goto('/');
        return;
      }

      user = currentUser;
      
      // Pre-fill with Google data if available
      if (user.user_metadata) {
        fullName = user.user_metadata.full_name || user.user_metadata.name || '';
        if (user.user_metadata.avatar_url) {
          // Use Google avatar as initial avatar
          profile = { ...profile, avatar_url: user.user_metadata.avatar_url };
        }
      }
      
      await loadProfile();
      loading = false;
      
      // Initialisiere showDistance aus localStorage oder Profil
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('showDistance');
        if (stored !== null) showDistance = stored === 'true';
      }
      
      // Start GPS tracking if distance is enabled
      if (showDistance && navigator.geolocation) {
        startGPSTracking();
      }
      
      if (typeof localStorage !== 'undefined') {
        const storedNewsFlash = localStorage.getItem('newsFlashMode');
        if (storedNewsFlash === 'aus' || storedNewsFlash === 'eigene' || storedNewsFlash === 'alle') {
          newsFlashMode = storedNewsFlash;
        }
      }
    })();
    
    // Cleanup function
    return () => {
      stopGPSTracking();
    };
  });

  async function loadProfile() {
    try {
      // Load profile from database
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }
      
      if (data) {
        profile = data;
        fullName = data.full_name || '';
        address = data.address || '';
        phone = data.phone || '';
        website = data.website || '';
        facebook = data.facebook || '';
        instagram = data.instagram || '';
        twitter = data.twitter || '';
        useJustifiedLayout = data.use_justified_layout ?? true;
        galleryLayout = useJustifiedLayout ? 'justified' : 'grid';
        showAddress = data.show_address ?? false;
        showPhone = data.show_phone ?? false;
        showWebsite = data.show_website ?? false;
        showSocial = data.show_social ?? false;
        showDistance = data.show_distance ?? false;
        showCompass = data.show_compass ?? false;
        autoguide = data.autoguide ?? false;
        newsFlashMode = data.newsflash_mode ?? 'alle';
        showWelcome = data.show_welcome ?? true;

        saveOriginals = data.save_originals ?? true;
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      showMessage('Fehler beim Laden des Profils', 'error');
    }
  }

  async function saveProfile() {
    saving = true;
    message = '';
    
    try {
      // Prepare profile data
      const profileData = {
        id: user.id,
        full_name: fullName,
        address,
        phone,
        website,
        facebook,
        instagram,
        twitter,
        use_justified_layout: useJustifiedLayout,
        show_address: showAddress,
        show_phone: showPhone,
        show_website: showWebsite,
        show_social: showSocial,
        show_distance: showDistance,
        show_compass: showCompass,
        autoguide: autoguide,
        show_welcome: showWelcome,

        avatar_url: profile?.avatar_url,
        newsflash_mode: newsFlashMode,
        save_originals: saveOriginals,
        updated_at: new Date().toISOString()
      };

      // Insert or update profile
      const { error } = await supabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'id' });
      
      if (error) throw error;
      
      // Save layout preference to localStorage for backward compatibility
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('galleryLayout', useJustifiedLayout ? 'justified' : 'grid');
        localStorage.setItem('showDistance', showDistance ? 'true' : 'false');
        localStorage.setItem('showCompass', showCompass ? 'true' : 'false');
        localStorage.setItem('autoguide', autoguide ? 'true' : 'false');
    
        localStorage.setItem('newsFlashMode', newsFlashMode);
        localStorage.setItem('saveOriginals', saveOriginals ? 'true' : 'false');
      }

      profile = profileData;
      showMessage('Profil erfolgreich gespeichert!', 'success');

      // Start GPS tracking if distance is enabled
      if (showDistance && navigator.geolocation) {
        startGPSTracking();
      } else {
        stopGPSTracking();
      }

      // Nach dem Speichern direkt zur Startseite
      setTimeout(() => goto('/'), 500);

    } catch (error) {
      console.error('Error saving profile:', error);
      showMessage('Fehler beim Speichern des Profils', 'error');
    } finally {
      saving = false;
    }
  }



  function getAvatarUrl() {
    if (profile?.avatar_url) {
      // Check if it's a Google avatar URL or our stored avatar
      if (profile.avatar_url.startsWith('http')) {
        return profile.avatar_url; // Google avatar
      } else {
        return `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/avatars/${profile.avatar_url}`;
      }
    }
    return null;
  }

  // Whenever useJustifiedLayout changes, update galleryLayout and localStorage for backward compatibility
  $: if (typeof window !== 'undefined') {
    galleryLayout = useJustifiedLayout ? 'justified' : 'grid';
    localStorage.setItem('galleryLayout', galleryLayout);
    window.dispatchEvent(new Event('galleryLayoutChanged'));
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

  function startGPSTracking() {
    if (!navigator.geolocation || gpsTrackingActive) return;
    
    console.log('Settings: Starting GPS tracking...');
    gpsTrackingActive = true;
    
    // Get initial position
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lastKnownLat = pos.coords.latitude;
        lastKnownLon = pos.coords.longitude;
        userLat = pos.coords.latitude;
        userLon = pos.coords.longitude;
        
        console.log(`Settings: Initial GPS position: ${userLat}, ${userLon}`);
        
        // Start continuous tracking
        gpsWatchId = navigator.geolocation.watchPosition(
          (newPos) => {
            const newLat = newPos.coords.latitude;
            const newLon = newPos.coords.longitude;
            
            if (lastKnownLat !== null && lastKnownLon !== null) {
              const distance = getDistanceInMeters(lastKnownLat, lastKnownLon, newLat, newLon);
              if (distance > 10) { // 10 meters threshold
                console.log(`Settings: Position updated: ${newLat}, ${newLon}`);
                lastKnownLat = newLat;
                lastKnownLon = newLon;
                userLat = newLat;
                userLon = newLon;
              }
            } else {
              lastKnownLat = newLat;
              lastKnownLon = newLon;
              userLat = newLat;
              userLon = newLon;
            }
          },
          (error) => console.error('Settings: GPS tracking error:', error),
          { 
            enableHighAccuracy: true, 
            maximumAge: 3000, 
            timeout: 5000 
          }
        );
      },
      (error) => console.error('Settings: Initial GPS error:', error),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function stopGPSTracking() {
    if (gpsWatchId !== null) {
      navigator.geolocation.clearWatch(gpsWatchId);
      gpsWatchId = null;
    }
    gpsTrackingActive = false;
    console.log('Settings: GPS tracking stopped');
  }

  function showMessage(text: string, type: 'success' | 'error') {
    message = text;
    messageType = type;
    setTimeout(() => {
      message = '';
    }, 5000);
  }

  function handleWelcomeToggle() {
    if (showWelcome) {
      resetWelcome();
    } else {
      welcomeVisible.set(false);
    }
  }
</script>

<svelte:head>
  <title>Einstellungen - Culoca</title>
</svelte:head>

<div class="settings-page">
  {#if loading}
    <div class="loading-container">
      <div class="spinner"></div>
      <span>Lade Profil...</span>
    </div>
  {:else}
    <div class="settings-container">
      <!-- Header -->
      <header class="header">
        <div class="header-content">
          <h1>Einstellungen</h1>
          <p class="header-subtitle">Passe deine Culoca-Erfahrung an</p>
        </div>
      </header>

      <!-- Message -->
      {#if message}
        <div class="message" class:success={messageType === 'success'} class:error={messageType === 'error'}>
          {message}
        </div>
      {/if}

      <form class="settings-form" on:submit|preventDefault={saveProfile}>
        <!-- Theme Settings -->
        <section class="settings-section">
          <div class="section-header">
            <h2>Erscheinungsbild</h2>
            <p class="section-description">Wähle zwischen hellem und dunklem Design</p>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label" for="dark-mode-toggle">Dark Mode</label>
              <p class="setting-description">Aktiviere das dunkle Design für bessere Lesbarkeit bei wenig Licht</p>
            </div>
            <div class="setting-control">
              <label class="toggle-switch" for="dark-mode-toggle">
                <input type="checkbox" id="dark-mode-toggle" bind:checked={$darkMode} />
                <span class="toggle-slider"></span>
              </label>
              <span class="setting-status">{$darkMode ? 'Aktiviert' : 'Deaktiviert'}</span>
            </div>
          </div>
        </section>

        <!-- Gallery Settings -->
        <section class="settings-section">
          <div class="section-header">
            <h2>Galerie-Einstellungen</h2>
            <p class="section-description">Passe die Darstellung deiner Bilder an</p>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label" for="layout-toggle">Layout</label>
              <p class="setting-description">Justified Layout zeigt Bilder in gleichmäßigen Reihen, Grid Layout in einem Raster</p>
            </div>
            <div class="setting-control">
              <label class="toggle-switch" for="layout-toggle">
                <input type="checkbox" id="layout-toggle" bind:checked={useJustifiedLayout} />
                <span class="toggle-slider"></span>
              </label>
              <span class="setting-status">{useJustifiedLayout ? 'Justified' : 'Grid'}</span>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label" for="distance-toggle">Entfernung anzeigen</label>
              <p class="setting-description">Zeigt die Entfernung zu jedem Bild basierend auf deinem GPS-Standort</p>
            </div>
            <div class="setting-control">
              <label class="toggle-switch" for="distance-toggle">
                <input type="checkbox" id="distance-toggle" bind:checked={showDistance} on:change={startGPSTracking} />
                <span class="toggle-slider"></span>
              </label>
              <span class="setting-status">{showDistance ? 'Aktiviert' : 'Deaktiviert'}</span>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label" for="compass-toggle">Kompass anzeigen (Beta)</label>
              <p class="setting-description">Zeigt die Himmelsrichtung zu jedem Bild basierend auf deiner Ausrichtung (nur Android)</p>
            </div>
            <div class="setting-control">
              <label class="toggle-switch" for="compass-toggle">
                <input type="checkbox" id="compass-toggle" bind:checked={showCompass} />
                <span class="toggle-slider"></span>
              </label>
              <span class="setting-status">{showCompass ? 'Aktiviert' : 'Deaktiviert'}</span>
            </div>
          </div>
        </section>



        <!-- Audio Settings -->
        <section class="settings-section">
          <div class="section-header">
            <h2>Audio-Einstellungen</h2>
            <p class="section-description">Konfiguriere die Sprachausgabe und Benachrichtigungen</p>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label" for="autoguide-toggle">Autoguide</label>
              <p class="setting-description">Lässt die App automatisch Bildtitel vorlesen, wenn du durch die Galerie scrollst</p>
            </div>
            <div class="setting-control">
              <label class="toggle-switch" for="autoguide-toggle">
                <input type="checkbox" id="autoguide-toggle" bind:checked={autoguide} />
                <span class="toggle-slider"></span>
              </label>
              <span class="setting-status">{autoguide ? 'Aktiviert' : 'Deaktiviert'}</span>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label">News-Flash</label>
              <p class="setting-description">Bestimme, welche Benachrichtigungen du erhalten möchtest</p>
            </div>
            <div class="setting-control">
              <div class="radio-group">
                <label class="radio-option">
                  <input type="radio" bind:group={newsFlashMode} value="aus" />
                  <span class="radio-custom"></span>
                  <span class="radio-label">Aus</span>
                </label>
                <label class="radio-option">
                  <input type="radio" bind:group={newsFlashMode} value="eigene" />
                  <span class="radio-custom"></span>
                  <span class="radio-label">Eigene</span>
                </label>
                <label class="radio-option">
                  <input type="radio" bind:group={newsFlashMode} value="alle" />
                  <span class="radio-custom"></span>
                  <span class="radio-label">Alle</span>
                </label>
              </div>
            </div>
          </div>
        </section>

        <!-- Interface Settings -->
        <section class="settings-section">
          <div class="section-header">
            <h2>Interface-Einstellungen</h2>
            <p class="section-description">Anpassungen der Benutzeroberfläche</p>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label" for="welcome-toggle">Willkommensbereich</label>
              <p class="setting-description">Zeigt eine Begrüßung für neue Mitglieder mit ersten Schritten und Tipps</p>
            </div>
            <div class="setting-control">
              <label class="toggle-switch" for="welcome-toggle">
                <input type="checkbox" id="welcome-toggle" bind:checked={showWelcome} on:change={handleWelcomeToggle} />
                <span class="toggle-slider"></span>
              </label>
              <span class="setting-status">{showWelcome ? 'Aktiviert' : 'Deaktiviert'}</span>
            </div>
          </div>
        </section>

        <!-- Upload Settings -->
        <section class="settings-section">
          <div class="section-header">
            <h2>Upload-Einstellungen</h2>
            <p class="section-description">Lege fest, ob du beim Upload die Originaldateien zusätzlich sichern möchtest (Hetzner)</p>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label class="setting-label" for="save-originals-toggle">Originale sichern (Hetzner)</label>
              <p class="setting-description">Wenn aktiviert, werden beim Upload zusätzlich die Originaldateien zu Hetzner gesichert. Standard: Ja</p>
            </div>
            <div class="setting-control">
              <label class="toggle-switch" for="save-originals-toggle">
                <input type="checkbox" id="save-originals-toggle" bind:checked={saveOriginals} />
                <span class="toggle-slider"></span>
              </label>
              <span class="setting-status">{saveOriginals ? 'Aktiviert' : 'Deaktiviert'}</span>
            </div>
          </div>
        </section>

        <!-- Actions -->
        <div class="actions">
          <button type="submit" class="save-btn" disabled={saving}>
            {#if saving}
              <div class="spinner-small"></div>
              Speichern...
            {:else}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              Einstellungen speichern
            {/if}
          </button>
          <button type="button" class="back-btn" on:click={() => goto('/')} disabled={saving}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Zurück zur Startseite
          </button>
        </div>
      </form>
    </div>
  {/if}
</div>

<style>
  .settings-page {
    min-height: 100vh;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

/* ============================================================= */
/* 🔄   CSS-Anpassungen – nur dieser Teil ist neu/aktualisiert   */
/* ============================================================= */

/* Distanz-Badge links unten */
.pic-container .distance-label {
  position: absolute;
  left: 8px;
  bottom: 8px;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(4px);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 500;
  border-radius: 6px;
  padding: 1px 8px;
  z-index: 10;
  pointer-events: none;
}

/* Spezifische Klasse für bessere CSS-Spezifität */
.pic-container .distance-label.s-prPRSjF7NRSe {
  position: absolute;
  left: 8px;
  bottom: 8px;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(4px);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 500;
  border-radius: 6px;
  padding: 1px 8px;
  z-index: 10;
  pointer-events: none;
}

/* ============================================================= */
/*   Bestehende Justified-Gallery-Styles (unverändert belassen)   */
/* ============================================================= */

/* Justified Gallery specific styles - higher specificity */
.justified-wrapper .gallery {
  position: relative !important;
  width: 100% !important;
  height: auto !important;
  min-height: 200px !important;
  margin: 0 !important;
  padding: 0 !important;
  background: var(--bg-primary) !important;
  border: none !important;
  box-shadow: none !important;
  overflow: hidden !important;
}

/* Bild-Container */
.justified-wrapper .pic-container {
  position: absolute !important;
  cursor: pointer !important;
  overflow: hidden !important;
  transition: box-shadow 0.3s ease, background-color 0.3s ease !important;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
  background: var(--bg-secondary) !important;
}

.justified-wrapper .pic {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  display: block !important;
  transition: transform 0.3s cubic-bezier(.4,0,.2,1) !important;
  background: transparent !important;
}

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    gap: 1rem;
    color: var(--text-secondary);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border-color);
    border-top: 3px solid var(--accent-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .settings-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 0;
  }

  /* Header */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 2rem 1.5rem 1rem;
  }

  .header-content h1 {
    margin: 0 0 0.5rem 0;
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .header-subtitle {
    margin: 0;
    font-size: 1rem;
    font-weight: 400;
    color: var(--text-secondary);
  }



  /* Message */
  .message {
    margin: 0 1.5rem 1rem;
    padding: 1rem 1.5rem;
    border-radius: 12px;
    font-weight: 500;
  }

  .message.success {
    background: var(--success-color);
    color: white;
  }

  .message.error {
    background: var(--error-color);
    color: white;
  }

  /* Form */
  .settings-form {
    padding: 0 1.5rem 2rem;
  }

  .settings-section {
    margin-bottom: 2rem;
    padding: 1.5rem;
    border-radius: 16px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    box-shadow: 0 2px 8px var(--shadow);
  }

  .section-header {
    margin-bottom: 1.5rem;
  }

  .section-header h2 {
    margin: 0 0 0.5rem 0;
    font-size: 1.3rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .section-description {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 400;
    color: var(--text-secondary);
  }

  /* Setting Rows */
  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 0;
    border-bottom: 1px solid var(--border-color);
  }

  .setting-row:last-child {
    border-bottom: none;
  }

  .setting-info {
    flex: 1;
    margin-right: 1rem;
  }

  .setting-label {
    display: block;
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 0.25rem;
    color: var(--text-primary);
  }

  .setting-description {
    margin: 0;
    font-size: 0.85rem;
    line-height: 1.4;
    color: var(--text-secondary);
  }

  .setting-control {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-shrink: 0;
  }

  .setting-status {
    font-size: 0.85rem;
    font-weight: 500;
    min-width: 80px;
    text-align: right;
    color: var(--text-secondary);
  }

  /* Toggle Switch */
  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 52px;
    height: 28px;
  }

  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    transition: 0.3s ease;
    border-radius: 28px;
    background-color: var(--border-color);
  }

  .toggle-slider:before {
    position: absolute;
    content: "";
    height: 20px;
    width: 20px;
    left: 4px;
    bottom: 4px;
    transition: 0.3s ease;
    border-radius: 50%;
    background-color: white;
    box-shadow: 0 2px 4px var(--shadow);
  }

  input:checked + .toggle-slider {
    background-color: var(--accent-color);
  }

  input:checked + .toggle-slider:before {
    transform: translateX(24px);
  }

  /* Radio Group */
  .radio-group {
    display: flex;
    gap: 0.5rem;
  }

  .radio-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .radio-option input[type="radio"] {
    display: none;
  }

  .radio-custom {
    width: 16px;
    height: 16px;
    border: 2px solid var(--border-color);
    border-radius: 50%;
    position: relative;
    transition: all 0.3s ease;
  }

  .radio-option input[type="radio"]:checked + .radio-custom {
    border-color: var(--accent-color);
    background-color: var(--accent-color);
  }

  .radio-option input[type="radio"]:checked + .radio-custom:after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 6px;
    height: 6px;
    background-color: white;
    border-radius: 50%;
  }

  .radio-label {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  /* Quality Control */
  .quality-control {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    min-width: 200px;
  }

  .quality-slider {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: var(--border-color);
    outline: none;
    -webkit-appearance: none;
    appearance: none;
  }

  .quality-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--accent-color);
    cursor: pointer;
    box-shadow: 0 2px 4px var(--shadow);
  }

  .quality-slider::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--accent-color);
    cursor: pointer;
    border: none;
    box-shadow: 0 2px 4px var(--shadow);
  }

  .quality-value {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--accent-color);
    min-width: 50px;
    text-align: center;
  }

  .quality-labels {
    display: flex;
    justify-content: space-between;
    width: 100%;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  /* Actions */
  .actions {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-top: 2rem;
    flex-wrap: wrap;
  }

  .save-btn, .back-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 2rem;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 600;
    transition: all 0.2s ease;
    min-width: 200px;
    justify-content: center;
  }

  .save-btn {
    background: var(--accent-color);
    color: white;
  }

  .save-btn:hover:not(:disabled) {
    background: var(--accent-hover);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px var(--shadow);
  }

  .save-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .back-btn {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .back-btn:hover:not(:disabled) {
    background: var(--border-color);
    transform: translateY(-1px);
  }

  .back-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .spinner-small {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top: 2px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  /* Mobile Responsive */
  @media (max-width: 768px) {
    .settings-container {
      padding: 0;
    }

    .header {
      padding: 1.5rem 1rem 1rem;
      flex-direction: column;
      gap: 1rem;
      align-items: stretch;
    }

    .header-content h1 {
      font-size: 1.8rem;
    }

    .settings-form {
      padding: 0 1rem 1.5rem;
    }

    .settings-section {
      padding: 1.25rem;
      margin-bottom: 1.5rem;
    }

    .setting-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }

    .setting-control {
      width: 100%;
      justify-content: space-between;
    }

    .actions {
      flex-direction: column;
      align-items: stretch;
    }

    .save-btn, .back-btn {
      width: 100%;
    }
  }

  @media (max-width: 480px) {
    .header-content h1 {
      font-size: 1.6rem;
    }

    .settings-section {
      padding: 1rem;
    }

    .radio-group {
      flex-direction: column;
      gap: 0.75rem;
    }

    /* Better mobile positioning for controls */
    .setting-control {
      justify-content: flex-end;
      gap: 0.75rem;
    }

    .setting-status {
      min-width: 60px;
      font-size: 0.8rem;
    }
  }
</style>