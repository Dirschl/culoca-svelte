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

    navigator.geolocation.getCurrentPosition(
      (position) => {
        userLat = position.coords.latitude;
        userLon = position.coords.longitude;
        gpsStatus = "active";
        lastGPSUpdateTime = Date.now();
        console.log("GPS initialisiert:", userLat, userLon);
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            gpsStatus = "denied";
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
    
    // GPS beim App-Start initialisieren
    initializeGPS();
    
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('toggle3x3Mode', handleToggle3x3Mode);
      window.removeEventListener('openMap', handleOpenMap);
      if (rotationInterval) {
        clearInterval(rotationInterval);
      }
    };
  });
</script>

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