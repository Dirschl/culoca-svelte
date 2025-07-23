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
  import { searchQuery, searchResults, isSearching, useSearchResults, performSearch, clearSearch, setSearchQuery } from '$lib/searchStore';
  import { sessionStore } from '$lib/sessionStore';
  import { filterStore } from '$lib/filterStore';
  import { page as pageStore } from '$app/stores';
  import { galleryStats } from '$lib/galleryStats';
  import { dynamicImageLoader } from '$lib/dynamicImageLoader';
  import { loadMoreGallery } from '$lib/galleryStore';
  import { browser } from '$app/environment';
  import { getEffectiveGpsPosition } from '$lib/filterStore';

  // Globale States für Umschaltung, Overlay, etc.
  let showLoginOverlay = false;
  let showFullscreenMap = false;
  let isManual3x3Mode = false;
  let userLat = null;
  let userLon = null;
  let showDistance = true;
  let showCompass = false;
  let useJustifiedLayout = true;
  let isLoggedIn = false;
  let newsFlashMode = 'alle';
  let profileAvatar = null;
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

  // Debug-Variable für die aktuelle API-URL
  let lastApiUrl = '';

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

  $: {
    const gps = getEffectiveGpsPosition();
    if (gps && (gps.lat !== lastLoadedLat || gps.lon !== lastLoadedLon || gps.source !== lastLoadedSource)) {
      lastLoadedLat = gps.lat;
      lastLoadedLon = gps.lon;
      lastLoadedSource = gps.source;
      loadMoreGallery({ lat: gps.lat, lon: gps.lon });
      console.log('[GPS-Trigger] Lade Galerie mit:', gps);
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
    isManual3x3Mode = !isManual3x3Mode;
    settingsIconRotation += 180; // Rotiere das Settings-Symbol um 180 Grad
    console.log('📱 Mobile Mode:', isManual3x3Mode, 'Settings Rotation:', settingsIconRotation);
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
           // if (browser) localStorage.removeItem('gpsAllowed');
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

  // Dummy-Implementierung für GPS, Auth, etc. (kann nach Bedarf erweitert werden)
  onMount(() => {
    const onScroll = () => {
      showScrollToTop = window.scrollY > 200;
    };
    window.addEventListener('scroll', onScroll);
    isInIframe = window.self !== window.top;
    
    // Event-Listener für FilterBar Events
    window.addEventListener('toggle3x3Mode', handleToggle3x3Mode);
    window.addEventListener('openMap', handleOpenMap);
    
    // GPS NICHT mehr automatisch initialisieren!
    // initializeGPS();
    
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('toggle3x3Mode', handleToggle3x3Mode);
      window.removeEventListener('openMap', handleOpenMap);
      if (rotationInterval) {
        clearInterval(rotationInterval);
      }
      stopGPSTracking();
    };
  });
</script>

{#if gpsStatus !== 'active'}
  <div style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(30,30,30,0.92);z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;">
    <div style="background:#222;padding:2rem 2.5rem;border-radius:1rem;box-shadow:0 2px 16px #0008;max-width:90vw;text-align:center;">
      <h2 style="color:#fff;margin-bottom:1rem;">Standort-Freigabe benötigt</h2>
      <p style="color:#ccc;font-size:1.1rem;margin-bottom:1.5rem;">
        Um die Galerie nach Entfernung zu sortieren, benötigen wir Zugriff auf deinen Standort.<br>
        Bitte erteile die Freigabe, um die Galerie zu sehen.
      </p>
      <button on:click={initializeGPS} style="padding: 0.9rem 2.2rem; font-size: 1.15rem; border-radius: 0.5rem; background: #3a7; color: #fff; border: none; cursor: pointer; font-weight:600;">
        📍 Standort verwenden
      </button>
      {#if gpsStatus === 'denied'}
        <div style="margin-top:1.2rem;color:#f66;font-size:1.05rem;">
          Standort-Freigabe wurde abgelehnt.<br>Bitte erlaube den Zugriff in den Browsereinstellungen und lade die Seite neu.
        </div>
      {/if}
      {#if gpsStatus === 'unavailable'}
        <div style="margin-top:1.2rem;color:#f66;font-size:1.05rem;">
          Standort konnte nicht ermittelt werden.<br>Bitte prüfe deine Geräteeinstellungen.
        </div>
      {/if}
    </div>
  </div>
{:else}
  <!-- Galerie-Komponenten und restliche Seite -->
  <FilterBar
    {userLat}
    {userLon}
    {showDistance}
    {isLoggedIn}
    gpsStatus={gpsStatus}
    lastGPSUpdateTime={lastGPSUpdateTime}
    isManual3x3Mode={isManual3x3Mode}
  />
  <SearchBar
    searchQuery={$searchQuery}
    isSearching={$isSearching}
    searchResults={$searchResults}
    showSearchField={true}
    onSearch={performSearch}
    onInput={q => setSearchQuery(q)}
    onToggleSearchField={() => {}}
  />
  {#if browser}
    <div style="background:#222;color:#fff;padding:8px 12px;font-size:0.95rem;margin-bottom:8px;word-break:break-all;">
      <b>API-Request:</b> {lastApiUrl}
    </div>
  {/if}
  {#if isLoggedIn && newsFlashMode !== 'aus'}
    <NewsFlash 
      mode={newsFlashMode}
      userId={null}
      layout={useJustifiedLayout ? 'justified' : 'grid'}
      limit={15}
      showToggles={false}
      showDistance={showDistance}
      userLat={userLat}
      userLon={userLon}
      getDistanceFromLatLonInMeters={getDistanceFromLatLonInMeters}
      displayedImageCount={$galleryStats.loadedCount}
    />
  {/if}
  <WelcomeSection />
  {#if isManual3x3Mode}
    <MobileGallery
      userLat={userLat}
      userLon={userLon}
      useJustifiedLayout={useJustifiedLayout}
      showDistance={showDistance}
      showCompass={showCompass}
      getDistanceFromLatLonInMeters={getDistanceFromLatLonInMeters}
      filterStore={filterStore}
      sessionStore={sessionStore}
      dynamicLoader={dynamicImageLoader}
    />
  {:else}
    <NormalGallery
      useJustifiedLayout={useJustifiedLayout}
      showDistance={showDistance}
      showCompass={showCompass}
      userLat={userLat}
      userLon={userLon}
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
      on:upload={() => isLoggedIn ? window.location.href = '/bulk-upload' : showLoginOverlay = true}
      on:publicContent={() => {}}
      on:bulkUpload={() => isLoggedIn ? window.location.href = '/bulk-upload' : showLoginOverlay = true}
      on:profile={() => isLoggedIn ? window.location.href = '/profile' : showLoginOverlay = true}
      on:settings={() => isLoggedIn ? window.location.href = '/settings' : showLoginOverlay = true}
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
      {userLat}
      {userLon}
      {deviceHeading}
      on:close={() => showFullscreenMap = false}
      on:imageClick={() => {}}
      on:locationSelected={() => {}}
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