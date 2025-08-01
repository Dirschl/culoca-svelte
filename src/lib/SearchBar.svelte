<script lang="ts">
  export let searchQuery = '';
  export let isSearching = false;
  export let showSearchField = true;
  export let onSearch: (query: string) => void;
  export let onInput: (query: string) => void;
  export let onToggleSearchField: () => void;
  export let onClear: (() => void) | undefined = undefined;
  export let useJustifiedLayout = true;
  export let onToggleLayout: (() => void) | undefined = undefined;

  let searchInput: HTMLInputElement;

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      onSearch(searchQuery);
    }
  }

  function handleClear() {
    onInput(''); // Leere das Eingabefeld
    if (onClear) {
      onClear(); // Rufe clearSearch auf
    }
  }

  function handleLayoutToggle() {
    if (onToggleLayout) {
      onToggleLayout();
    }
  }
</script>

{#if showSearchField}
  <div class="search-container">
    <div class="search-box">
      <!-- Layout Toggle Icon - zeigt wohin man wechseln kann -->
      {#if useJustifiedLayout}
        <!-- Aktuell Justified → Zeige Grid Icon (Wohin wechseln) -->
        <svg class="layout-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" on:click={handleLayoutToggle} title="Zu Grid-Layout wechseln">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
      {:else}
        <!-- Aktuell Grid → Zeige Justified Icon (Wohin wechseln) -->
        <svg class="layout-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" on:click={handleLayoutToggle} title="Zu Justified-Layout wechseln">
          <rect x="2" y="6" width="20" height="4" rx="1"/>
          <rect x="2" y="14" width="20" height="4" rx="1"/>
      </svg>
      {/if}
      <input 
        type="text" 
        placeholder=""
        bind:value={searchQuery}
        on:keydown={handleKeydown}
        class="search-input"
        disabled={isSearching}
        bind:this={searchInput}
      />
      {#if searchQuery}
        <button class="clear-search-btn" on:click={handleClear} disabled={isSearching}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      {/if}
      {#if isSearching}
        <div class="search-spinner"></div>
      {/if}
    </div>
  </div>
{:else}
  <a href="/system" class="logo-link">
    <img 
      src="/culoca-logo-512px.png" 
      alt="Culoca" 
      class="culoca-logo clickable"
      on:click|preventDefault={onToggleSearchField}
    />
  </a>
{/if}

<style>
  .search-container {
    position: fixed;
    bottom: 1.8rem;
    left: 1.8rem;
    right: auto;
    z-index: 50;
    max-width: 300px;
    width: 15.8rem;
  }
  .search-box {
    position: relative;
    display: flex;
    align-items: center;
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: 50px;
    padding: 0.5rem 0.75rem;
    box-shadow: 0 4px 20px var(--shadow);
    transition: all 0.3s ease;
  }
  .search-box:focus-within {
    border-color: var(--accent-color);
    box-shadow: 0 4px 25px var(--shadow);
  }
  .layout-icon {
    color: var(--text-secondary);
    cursor: pointer;
    transition: color 0.2s ease;
    flex-shrink: 0;
  }

  .layout-icon:hover {
    color: var(--text-primary);
  }
  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-size: 16px; /* Mindestens 16px für iOS um Zoom zu verhindern */
    font-weight: 500;
    padding: 0;
  }
  .search-input::placeholder {
    color: var(--text-secondary);
  }
  .search-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .clear-search-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 50%;
    transition: all 0.2s ease;
    margin-left: 0.2rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .clear-search-btn:hover:not(:disabled) {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }
  .clear-search-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .search-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--border-color);
    border-top: 2px solid var(--accent-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-left: 0.5rem;
  }
  .search-results-info {
    margin-top: 0.5rem;
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.9rem;
    font-weight: 500;
    background: var(--bg-secondary);
    padding: 0.5rem 1rem;
    border-radius: 20px;
    border: 1px solid var(--border-color);
  }
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
  .culoca-logo.clickable {
    cursor: pointer;
    transition: opacity 0.2s ease;
  }
  .culoca-logo.clickable:hover {
    transform: scale(1.05);
  }

  .logo-link {
    display: inline-block;
    text-decoration: none;
  }

  .logo-link:hover {
    text-decoration: none;
  }
</style> 