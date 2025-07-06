<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let showScrollToTop = false;
  export let showTestMode = false;
  export let isLoggedIn = false;
  export let simulationMode = false;
  export let profileAvatar: string | null = null;
  
  const dispatch = createEventDispatcher();
  
  function handleScrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
</script>

<div class="fab-container">
  <!-- Simulation/Test mode button (top) -->
  {#if showTestMode}
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
        <!-- Pirate wheel icon when simulation is not active -->
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="12" cy="12" r="8"/>
          <circle cx="12" cy="12" r="6"/>
          <path d="M12 2v20"/>
          <path d="M2 12h20"/>
          <path d="M4.5 4.5l15 15"/>
          <path d="M19.5 4.5l-15 15"/>
          <circle cx="12" cy="12" r="2"/>
          <!-- Add diagonal lines for more pirate wheel detail -->
          <path d="M6 6l12 12"/>
          <path d="M18 6l-12 12"/>
        </svg>
      {/if}
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
  
  <!-- Public Content button -->
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
  
  <!-- Profile button -->
  {#if isLoggedIn}
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
  {/if}
  
  <!-- Settings button -->
  <button 
    class="fab-button settings"
    on:click={handleSettings}
    aria-label="Einstellungen"
    title="Einstellungen"
  >
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  </button>
  
  <!-- Scroll to top button (bottom) -->
  {#if showScrollToTop}
    <button 
      class="fab-button scroll-to-top"
      on:click={handleScrollToTop}
      aria-label="Nach oben scrollen"
      title="Nach oben scrollen"
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
    gap: 1rem;
    z-index: 1000;
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
    color: var(--text-primary);
    font-weight: bold;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px var(--shadow);
    backdrop-filter: blur(10px);
    background: var(--bg-secondary);
    overflow: hidden;
  }
  
  .fab-button:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 20px var(--shadow);
    background: var(--bg-tertiary);
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
  
  /* Button specific colors - using theme variables for consistent dark/light mode */
  .scroll-to-top {
    background: var(--bg-secondary);
  }
  
  .settings {
    background: var(--bg-secondary);
  }
  
  .profile {
    background: var(--bg-secondary);
  }
  
  .public-content {
    background: var(--bg-secondary);
  }
  
  .upload {
    background: var(--bg-secondary);
  }
  
  .test-mode {
    background: var(--bg-secondary);
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