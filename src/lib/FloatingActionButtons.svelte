<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { onMount } from 'svelte';
  import { trackStore } from './trackStore';
  
  export let showScrollToTop = false;
  export let showTestMode = false;
  export let isLoggedIn = false;
  export let simulationMode = false;
  export let profileAvatar: string | null = null;
  export let showMapButton = false;
  export let showTrackButtons = false;
  export let settingsIconRotation = 0; // Rotation for movement mode
  
  // Track state
  let isRecording = false;
  let currentTrack: any = null;
  
  trackStore.subscribe(state => {
    isRecording = state.isRecording;
    currentTrack = state.currentTrack;
  });
  
  // Fullscreen state
  let isFullscreen = false;
  
  const dispatch = createEventDispatcher();
  
  function handleScrollToTop(event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    
    // Smooth scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Force state update after scroll completes to ensure FAB switches
    setTimeout(() => {
      const currentScrollY = window.scrollY || document.documentElement.scrollTop;
      if (currentScrollY <= 100) {
        
        // Trigger a scroll event to ensure parent component updates
        window.dispatchEvent(new Event('scroll'));
      }
    }, 800); // Wait for smooth scroll animation
  }
  
  function handleUpload() {
    dispatch('upload');
  }
  
  function handleProfile() {
    dispatch('profile');
  }
  
  function handleSettings() {
    dispatch('settings');
  }
  
  function handleTestMode() {
    dispatch('testMode');
  }
  
  function handlePublicContent() {
    dispatch('publicContent');
  }
  
  function handleBulkUpload() {
    dispatch('bulkUpload');
  }
  
  function handleMap() {
    dispatch('map');
  }
  
  function startTrack() {
    const trackName = prompt('Name für die Tour eingeben:', `Tour ${new Date().toLocaleDateString()}`);
    if (trackName) {
      trackStore.startTrack(trackName);
    }
  }
  
  function stopTrack() {
    if (confirm('Tour beenden?')) {
      trackStore.stopTrack();
    }
  }
  
  function showTracks() {
    dispatch('showTracks');
  }
  
  function handleFullscreenToggle() {
    if (!document.fullscreenElement) {
      // Enter fullscreen
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      } else if ((document.documentElement as any).webkitRequestFullscreen) {
        (document.documentElement as any).webkitRequestFullscreen();
      } else if ((document.documentElement as any).mozRequestFullScreen) {
        (document.documentElement as any).mozRequestFullScreen();
      } else if ((document.documentElement as any).msRequestFullscreen) {
        (document.documentElement as any).msRequestFullscreen();
      }
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
    }
  }
  
  // Listen for fullscreen changes
  function updateFullscreenState() {
    isFullscreen = !!document.fullscreenElement || 
                   !!(document as any).webkitFullscreenElement || 
                   !!(document as any).mozFullScreenElement || 
                   !!(document as any).msFullscreenElement;
  }
  
  // Add event listeners for fullscreen changes
  onMount(() => {
    document.addEventListener('fullscreenchange', updateFullscreenState);
    document.addEventListener('webkitfullscreenchange', updateFullscreenState);
    document.addEventListener('mozfullscreenchange', updateFullscreenState);
    document.addEventListener('MSFullscreenChange', updateFullscreenState);
    
    return () => {
      document.removeEventListener('fullscreenchange', updateFullscreenState);
      document.removeEventListener('webkitfullscreenchange', updateFullscreenState);
      document.removeEventListener('mozfullscreenchange', updateFullscreenState);
      document.removeEventListener('MSFullscreenChange', updateFullscreenState);
    };
  });
</script>

<div class="fab-container">
  <!-- Track Start/Stop FAB -->
  {#if showTrackButtons}
    <button
      class="fab-button track {isRecording ? 'recording' : ''}"
      aria-label={isRecording ? 'Track beenden' : 'Track starten'}
      title={isRecording ? 'Track beenden' : 'Track starten'}
      on:click={isRecording ? stopTrack : startTrack}
    >
      {#if isRecording}
        <!-- Flaggen-Icon (Stop) -->
        <svg class="track-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 22V2"/>
          <path d="M4 4h16l-2 5 2 5H4"/>
        </svg>
      {:else}
        <!-- Raketen-Icon (Start) -->
        <svg class="track-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4.5 16.5L3 21l4.5-1.5"/>
          <path d="M21 3s-6.5 0-13 6.5A8.38 8.38 0 0 0 3 13l8 8a8.38 8.38 0 0 0 6.5-5.5C21 9.5 21 3 21 3z"/>
          <path d="M15 9l-6 6"/>
        </svg>
      {/if}
    </button>
    <!-- Track Übersicht FAB -->
    <button
      class="fab-button track-list"
      aria-label="Track-Übersicht"
      title="Track-Übersicht"
      on:click={showTracks}
    >
      <!-- Clipboard/List-Icon -->
      <svg class="track-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="2" width="6" height="4" rx="1"/>
        <path d="M4 7h16v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z"/>
        <line x1="9" y1="12" x2="15" y2="12"/>
        <line x1="9" y1="16" x2="15" y2="16"/>
      </svg>
    </button>
  {/if}
  
  <!-- Simulation/Test mode button - only for logged in users -->
  {#if showTestMode && isLoggedIn}
    <button 
      class="fab-button test-mode"
      on:click={handleTestMode}
      aria-label={simulationMode ? "Zurück zur Hauptansicht" : "Simulationsmodus"}
      title={simulationMode ? "Zurück zur Hauptansicht" : "Simulationsmodus"}
    >
      {#if simulationMode}
        <!-- House icon when simulation is active -->
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9,22 9,12 15,12 15,22"/>
        </svg>
      {:else}
        <!-- Competition Pro Joystick icon for simulation mode -->
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <!-- Competition Pro base (wider rectangular) -->
          <rect x="4" y="14" width="16" height="6" rx="1"/>
          <!-- Competition Pro stick -->
          <line x1="12" y1="14" x2="12" y2="6"/>
          <!-- Competition Pro handle (filled, larger) -->
          <circle cx="12" cy="6" r="3" fill="currentColor"/>
        </svg>
      {/if}
    </button>
  {/if}
  
  <!-- Map button -->
  {#if showMapButton}
    <button 
      class="fab-button map"
      on:click={handleMap}
      aria-label="Karte anzeigen"
      title="Karte anzeigen"
    >
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2"/>
      <line x1="8" y1="2" x2="8" y2="18"/>
      <line x1="16" y1="6" x2="16" y2="22"/>
    </svg>
    </button>
  {/if}

  <!-- Upload button -->
  <button 
    class="fab-button upload"
    on:click={handleUpload}
    aria-label="Bilder hochladen"
    title="Bilder hochladen"
  >
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
      <circle cx="12" cy="13" r="3"/>
    </svg>
  </button>
  
  <!-- Public Content button - only for logged in users -->
  {#if isLoggedIn}
    <button 
      class="fab-button public-content"
      on:click={handlePublicContent}
      aria-label="Öffentlichen Content hinzufügen"
      title="Öffentlichen Content hinzufügen"
    >
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="8" r="3"/>
        <circle cx="6" cy="16" r="3"/>
        <circle cx="18" cy="16" r="3"/>
        <path d="M12 11v3"/>
        <path d="M9 16h6"/>
      </svg>
    </button>
  {/if}
  
  <!-- Profile button -->
  <button 
    class="fab-button profile"
    on:click={handleProfile}
    aria-label="Profil"
    title="Profil"
  >
    {#if profileAvatar}
      <img 
        src={profileAvatar} 
        alt="Profilbild" 
        class="profile-avatar"
      />
    {:else}
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    {/if}
  </button>
  
  <!-- Settings button -->
  <button 
    class="fab-button settings"
    on:click={handleSettings}
    aria-label="Einstellungen"
    title="Einstellungen"
  >
    <svg 
      width="40" height="40" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      stroke-width="2"
      style="transform: rotate({settingsIconRotation}deg); transition: transform 0.5s ease;"
    >
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  </button>
  
  <!-- Fullscreen toggle button (bottom) - shows when not scrolled -->
  {#if !showScrollToTop}
    <button 
      class="fab-button fullscreen-toggle"
      on:click={handleFullscreenToggle}
      aria-label={isFullscreen ? "Vollbildmodus beenden" : "Vollbildmodus aktivieren"}
      title={isFullscreen ? "Vollbildmodus beenden" : "Vollbildmodus aktivieren"}
    >
      {#if isFullscreen}
        <!-- Exit fullscreen icon -->
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M8 3H5a2 2 0 0 0-2 2v3"/>
          <path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
          <path d="M3 16v3a2 2 0 0 0 2 2h3"/>
          <path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
        </svg>
      {:else}
        <!-- Enter fullscreen icon -->
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M8 3H5a2 2 0 0 0-2 2v3"/>
          <path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
          <path d="M3 16v3a2 2 0 0 0 2 2h3"/>
          <path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
        </svg>
      {/if}
    </button>
  {:else}
    <!-- Scroll to top button (bottom) - shows when scrolled -->
    <button 
      class="fab-button scroll-to-top"
      on:click={(e) => handleScrollToTop(e)}
      on:touchend={(e) => handleScrollToTop(e)}
      aria-label="Nach oben scrollen"
      title="Nach oben scrollen"
      data-testid="scroll-to-top"
    >
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="m18 15-6-6-6 6"/>
      </svg>
    </button>
  {/if}
</div>

<style>
  .fab-container {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    z-index: 1001;
    pointer-events: none;
  }
  
  .fab-button {
    width: 4rem;
    height: 4rem;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px var(--shadow);
    backdrop-filter: blur(10px);
    background: transparent;
    overflow: hidden;
    pointer-events: auto;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  
  .fab-button:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 20px var(--shadow);
    background: rgba(255, 255, 255, 0.1);
  }
  
  .fab-button:active {
    transform: scale(0.95);
  }
  
  /* Profile avatar styling */
  .profile-avatar {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
  }
  
  /* Track button specific styling */
  .fab-button.track {
    background: transparent;
    border: none;
  }
  
  .fab-button.track.recording {
    animation: pulse 2s infinite;
  }
  
  .fab-button.track-list {
    background: transparent;
    border: none;
  }
  
  .track-icon {
    font-size: 24px;
    line-height: 1;
  }
  
  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }
  
  /* Button specific colors - all transparent now */
  
  /* Fullscreen toggle specific styling - same as scroll-to-top */
  .fab-button.fullscreen-toggle {
    background: transparent;
    border: none;
  }
  
  .fab-button.fullscreen-toggle:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  
  /* Mobile responsive */
  @media (max-width: 768px) {
    .fab-container {
      bottom: 1rem;
      right: 1rem;
      gap: 0.7rem;
    }
    
    .fab-button {
      width: 3.5rem;
      height: 3.5rem;
    }
    
    .fab-button svg {
      width: 36px;
      height: 36px;
    }
  }
  
  /* Dark mode support - now handled by CSS variables */
</style> 