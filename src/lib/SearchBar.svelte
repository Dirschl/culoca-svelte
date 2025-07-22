<script lang="ts">
  export let searchQuery = '';
  export let isSearching = false;
  export let searchResults: any[] = [];
  export let showSearchField = true;
  export let onSearch: (query: string) => void;
  export let onInput: (query: string) => void;
  export let onToggleSearchField: () => void;

  let searchInput: HTMLInputElement;

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      onSearch(searchQuery);
    }
  }
</script>

{#if showSearchField}
  <div class="search-container">
    <div class="search-box">
      <!-- Culoca Logo SVG als klickbares Icon -->
      <svg class="culoca-icon" width="20" height="20" viewBox="0 0 83.86 100.88" fill="currentColor" on:click={onToggleSearchField}>
        <path d="M0,41.35c0-5.67,1.1-11.03,3.29-16.07,2.19-5.04,5.19-9.43,8.98-13.17,3.79-3.74,8.25-6.69,13.36-8.86,5.11-2.17,10.54-3.25,16.29-3.25s11.18,1.08,16.29,3.25c5.11,2.17,9.56,5.12,13.36,8.86,3.79,3.74,6.79,8.13,8.98,13.17,2.19,5.04,3.29,10.4,3.29,16.07s-1.1,11.03-3.29,16.07c-2.2,5.04-5.19,9.43-8.98,13.17-3.8,3.74-8.25,6.7-13.36,8.86-5.11,2.17-9.49,21.42-15.25,21.42s-12.23-19.25-17.34-21.42c-5.11-2.17-9.56-5.12-13.36-8.86-3.79-3.74-6.79-8.13-8.98-13.17-2.2-5.04-3.29-10.4-3.29-16.07ZM25.16,41.35c0,2.29.44,4.43,1.32,6.44.88,2.01,2.07,3.76,3.59,5.26,1.52,1.5,3.29,2.68,5.33,3.55,2.04.87,4.21,1.3,6.53,1.3s4.49-.43,6.53-1.3c2.04-.87,3.81-2.05,5.33-3.55,1.52-1.5,2.71-3.25,3.59-5.26.88-2.01,1.32-4.15,1.32-6.44s-.44-4.43-1.32-6.44c-.88-2.01-2.08-3.76-3.59-5.26-1.52-1.5-3.29-2.68-5.33-3.55-2.03-.87-4.21-1.3-6.53-1.3s-4.49.43-6.53,1.3c-2.04-.87-3.81-2.05-5.33,3.55-1.52,1.5-2.72,3.25-3.59,5.26-.88,2.01-1.32,4.16-1.32,6.44Z"/>
      </svg>
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
        <button class="clear-search-btn" on:click={() => onInput('')} disabled={isSearching}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      {/if}
      {#if isSearching}
        <div class="search-spinner"></div>
      {/if}
    </div>
    {#if searchResults.length > 0}
      <div class="search-results-info">
        {searchResults.length} Ergebnis{searchResults.length !== 1 ? 'se' : ''} gefunden
      </div>
    {/if}
  </div>
{:else}
  <img 
    src="/culoca-logo-512px.png" 
    alt="Culoca" 
    class="culoca-logo clickable"
    on:click|preventDefault={onToggleSearchField}
  />
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
  .culoca-icon {
    color: #ee7221;
    margin-right: 0.75rem;
    flex-shrink: 0;
    cursor: pointer;
    transition: color 0.2s ease;
  }
  .culoca-icon:hover {
    color: #d55a1a;
  }
  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-size: 0.9rem;
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
    opacity: 0.8;
  }
</style> 