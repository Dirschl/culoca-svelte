<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { darkMode } from '$lib/darkMode';

  let user: any = null;
  let profile: any = null;
  let loading = true;
  let saving = false;
  let avatarFile: File | null = null;
  let avatarPreview: string | null = null;
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

  let galleryLayout = 'grid';

  let userLat: number | null = null;
  let userLon: number | null = null;

  // GPS tracking variables
  let gpsWatchId: number | null = null;
  let lastKnownLat: number | null = null;
  let lastKnownLon: number | null = null;
  let gpsTrackingActive = false;

  onMount(async () => {
    // Check if user is authenticated
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      goto('/login');
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
        showAddress = data.show_address ?? false;
        showPhone = data.show_phone ?? false;
        showWebsite = data.show_website ?? false;
        showSocial = data.show_social ?? false;
        showDistance = data.show_distance ?? false;
        showCompass = data.show_compass ?? false;
        autoguide = data.autoguide ?? false;
        newsFlashMode = data.newsflash_mode ?? 'alle';
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      showMessage('Fehler beim Laden des Profils', 'error');
    }
  }

  function handleAvatarChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      avatarFile = input.files[0];
      avatarPreview = URL.createObjectURL(avatarFile);
    }
  }

  async function uploadAvatar() {
    if (!avatarFile) return null;

    try {
      const fileExt = avatarFile.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;

      const { error } = await supabase.storage
        .from('avatars')
        .upload(fileName, avatarFile);

      if (error) throw error;

      return fileName;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      throw error;
    }
  }

  async function saveProfile() {
    saving = true;
    message = '';

    try {
      let avatarPath = profile?.avatar_url;

      // Upload new avatar if selected
      if (avatarFile) {
        avatarPath = await uploadAvatar();
      }

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
        avatar_url: avatarPath,
        newsflash_mode: newsFlashMode,
        updated_at: new Date().toISOString()
      };

      // Insert or update profile
      const { error } = await supabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'id' });

      if (error) throw error;

      // Save layout preference to localStorage
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('galleryLayout', useJustifiedLayout ? 'justified' : 'grid');
        localStorage.setItem('showDistance', showDistance ? 'true' : 'false');
        localStorage.setItem('showCompass', showCompass ? 'true' : 'false');
        localStorage.setItem('autoguide', autoguide ? 'true' : 'false');
        localStorage.setItem('newsFlashMode', newsFlashMode);

      }

      profile = profileData;
      showMessage('Profil erfolgreich gespeichert!', 'success');

      // Start GPS tracking if distance is enabled
      if (showDistance && navigator.geolocation) {
        startGPSTracking();
      } else {
        stopGPSTracking();
      }

      // Clear avatar preview
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
        avatarPreview = null;
      }
      avatarFile = null;

      // Nach dem Speichern direkt zur Startseite
      setTimeout(() => goto('/'), 500);

    } catch (error) {
      console.error('Error saving profile:', error);
      showMessage('Fehler beim Speichern des Profils', 'error');
    } finally {
      saving = false;
    }
  }

  function showMessage(text: string, type: 'success' | 'error') {
    message = text;
    messageType = type;
    setTimeout(() => {
      message = '';
    }, 5000);
  }

  async function signOut() {
    await supabase.auth.signOut();
    goto('/');
  }

  function getAvatarUrl() {
    if (avatarPreview) return avatarPreview;
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

  // Whenever useJustifiedLayout changes, update localStorage and fire a custom event
  if (typeof window !== 'undefined') {
    localStorage.setItem('galleryLayout', useJustifiedLayout ? 'justified' : 'grid');
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
</script>

<svelte:head>
  <title>Einstellungen - Culoca</title>
</svelte:head>

{#if loading}
  <div class="loading-container">
    <div class="spinner"></div>
    <span>Lade Profil...</span>
  </div>
{:else}
  <div class="settings-container">
    <!-- Header -->
    <header class="header">
      <h1>Einstellungen</h1>
      <button class="signout-btn" on:click={signOut}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
        </svg>
        Abmelden
      </button>
    </header>

    <!-- Message -->
    {#if message}
      <div class="message" class:success={messageType === 'success'} class:error={messageType === 'error'}>
        {message}
      </div>
    {/if}

    <form class="settings-form" on:submit|preventDefault={saveProfile}>
      <!-- Galerie-Einstellungen -->
      <section class="section">
        <h2>Galerie-Einstellungen</h2>
        <div class="gallery-toggle-row">
          <span class="toggle-label">Layout:</span>
          <label class="switch">
            <input type="checkbox" bind:checked={useJustifiedLayout} />
            <span class="slider"></span>
          </label>
          <span class="toggle-desc">{useJustifiedLayout ? 'Justified' : 'Grid'}</span>
        </div>
        <div class="gallery-toggle-row">
          <span class="toggle-label">Entfernung anzeigen:</span>
          <label class="switch">
            <input type="checkbox" bind:checked={showDistance} on:change={startGPSTracking} />
            <span class="slider"></span>
          </label>
          <span class="toggle-desc">{showDistance ? 'Ja' : 'Nein'}</span>
        </div>
        <div class="gallery-toggle-row">
          <span class="toggle-label">Kompass anzeigen:</span>
          <label class="switch">
            <input type="checkbox" bind:checked={showCompass} />
            <span class="slider"></span>
          </label>
          <span class="toggle-desc">{showCompass ? 'Ja' : 'Nein'}</span>
        </div>
        <div class="gallery-toggle-row">
          <span class="toggle-label">Autoguide:</span>
          <label class="switch">
            <input type="checkbox" bind:checked={autoguide} />
            <span class="slider"></span>
          </label>
          <span class="toggle-desc">{autoguide ? 'Aktiviert' : 'Deaktiviert'}</span>
        </div>
        <div class="gallery-toggle-row">
          <span class="toggle-label">News-Flash:</span>
          <div class="toggle-group">
            <button type="button" class="toggle-btn {newsFlashMode === 'aus' ? 'active' : ''}" on:click={() => newsFlashMode = 'aus'}>Aus</button>
            <button type="button" class="toggle-btn {newsFlashMode === 'eigene' ? 'active' : ''}" on:click={() => newsFlashMode = 'eigene'}>Eigene</button>
            <button type="button" class="toggle-btn {newsFlashMode === 'alle' ? 'active' : ''}" on:click={() => newsFlashMode = 'alle'}>Alle</button>
          </div>
          <span class="toggle-desc">
            {newsFlashMode === 'aus' ? 'Ausgeblendet' : newsFlashMode === 'eigene' ? 'Nur eigene Uploads' : 'Alle Uploads'}
          </span>
        </div>
        <div class="gallery-toggle-row">
          <span class="toggle-label">Dark Mode:</span>
          <label class="switch">
            <input type="checkbox" bind:checked={$darkMode} />
            <span class="slider"></span>
          </label>
          <span class="toggle-desc">{$darkMode ? 'Dunkel' : 'Hell'}</span>
        </div>
      </section>

      <!-- Save Button -->
      <div class="actions">
        <button type="submit" class="save-btn" disabled={saving}>
          {#if saving}
            <div class="spinner-small"></div>
            Speichern...
          {:else}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            Profil speichern & Startseite
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

<style>
  /* Dark Night Blue Theme */
  :global(html, body) {
    background: #0f1419;
    color: white;
    margin: 0;
    padding: 0;
    font-family: system-ui, -apple-system, sans-serif;
    min-height: 100vh;
    width: 100%;
    overflow-x: hidden;
  }

  :global(*) {
    box-sizing: border-box;
  }

  .settings-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 0;
    background: #0f1419;
    min-height: 100vh;
  }

  /* Loading */
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    gap: 1rem;
    color: #ccc;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #2d2d44;
    border-top: 3px solid #0066cc;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .spinner-small {
    width: 16px;
    height: 16px;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Header */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #2d2d44;
    background: #0f1419;
  }

  .header h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: white;
  }

  .signout-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    transition: background-color 0.2s ease;
  }

  .signout-btn:hover {
    background: #c82333;
  }

  /* Message */
  .message {
    margin: 1rem 1.5rem;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    font-weight: 500;
  }

  .message.success {
    background: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
  }

  .message.error {
    background: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
  }

  /* Form */
  .settings-form {
    padding: 0 1.5rem 2rem;
  }

  .section {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: #1a1a2e;
    border-radius: 8px;
    border: 1px solid #2d2d44;
  }

  .section h2 {
    margin: 0 0 1.5rem 0;
    font-size: 1.2rem;
    font-weight: 600;
    color: white;
  }

  /* Gallery Toggle */
  .gallery-toggle-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: 0.5rem;
  }
  .toggle-label {
    color: #ccc;
    font-size: 1rem;
    font-weight: 500;
  }
  .toggle-desc {
    color: #fff;
    font-size: 1rem;
    font-weight: 600;
    min-width: 80px;
  }
  .switch {
    position: relative;
    display: inline-block;
    width: 48px;
    height: 28px;
  }
  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #444;
    transition: .4s;
    border-radius: 28px;
  }
  .slider:before {
    position: absolute;
    content: "";
    height: 20px;
    width: 20px;
    left: 4px;
    bottom: 4px;
    background-color: #fff;
    transition: .4s;
    border-radius: 50%;
  }
  input:checked + .slider {
    background-color: #0066cc;
  }
  input:checked + .slider:before {
    transform: translateX(20px);
  }

  /* Actions */
  .actions {
    display: flex;
    justify-content: center;
    margin-top: 2rem;
    gap: 1rem;
  }

  .save-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 2rem;
    background: #28a745;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 600;
    transition: background-color 0.2s ease;
  }

  .save-btn:hover:not(:disabled) {
    background: #218838;
  }

  .save-btn:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 2rem;
    background: #444;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 600;
    transition: background-color 0.2s ease;
  }

  .back-btn:hover:not(:disabled) {
    background: #222b45;
  }

  .back-btn:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }

  /* Mobile Responsive */
  @media (max-width: 768px) {
    .settings-container {
      padding: 0;
    }

    .header {
      padding: 1rem;
    }

    .header h1 {
      font-size: 1.3rem;
    }

    .settings-form {
      padding: 0 1rem 1.5rem;
    }

    .section {
      padding: 1rem;
      margin-bottom: 1.5rem;
    }

    .save-btn {
      width: 100%;
      justify-content: center;
    }
  }

  @media (max-width: 480px) {
    .header {
      flex-direction: column;
      gap: 1rem;
      align-items: stretch;
    }

    .signout-btn {
      justify-content: center;
    }
  }

  .toggle-group {
    display: flex;
    gap: 0.5rem;
  }
  .toggle-btn.active {
    background: #4fa3f7;
    color: #fff;
    font-weight: bold;
  }
</style> 