<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let showModal = false;
  export let shareUrl = '';
  export let shareTitle = '';
  export let shareDescription = '';
  export let screenshot: string | null = null;
  
  const dispatch = createEventDispatcher();
  
  function closeModal() {
    dispatch('close');
  }
  
  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      // Show success feedback
      console.log('URL copied to clipboard');
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  }
</script>

{#if showModal}
  <div class="share-modal-overlay" on:click={closeModal}>
    <div class="share-modal" on:click|stopPropagation>
      <div class="share-modal-header">
        <h3>Kartenausschnitt teilen</h3>
        <button class="close-btn" on:click={closeModal}>×</button>
      </div>
      
      <div class="share-modal-content">
        {#if screenshot}
          <div class="map-preview">
            <img src={screenshot} alt="Kartenausschnitt" />
          </div>
        {/if}
        
        <form class="share-form">
          <div class="form-group">
            <label for="share-title">Titel</label>
            <input 
              id="share-title"
              bind:value={shareTitle} 
              maxlength="60" 
              placeholder="Titel (max. 60 Zeichen)"
            />
            <span class="char-count">{shareTitle.length}/60</span>
          </div>
          
          <div class="form-group">
            <label for="share-description">Beschreibung</label>
            <textarea 
              id="share-description"
              bind:value={shareDescription} 
              maxlength="160" 
              placeholder="Beschreibung (max. 160 Zeichen)"
            />
            <span class="char-count">{shareDescription.length}/160</span>
          </div>
          
          <div class="share-url-group">
            <label>Teilbarer Link</label>
            <div class="url-input-group">
              <input readonly value={shareUrl} />
              <button type="button" on:click={copyUrl}>Kopieren</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}

<style>
  .share-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }
  
  .share-modal {
    background: var(--bg-primary);
    border-radius: 12px;
    padding: 0;
    max-width: 500px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  }
  
  .share-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .share-modal-header h3 {
    margin: 0;
    color: var(--text-primary);
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0.5rem;
  }
  
  .share-modal-content {
    padding: 1.5rem;
  }
  
  .map-preview {
    margin-bottom: 1.5rem;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--border-color);
  }
  
  .map-preview img {
    width: 100%;
    height: auto;
    display: block;
  }
  
  .share-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .form-group {
    position: relative;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    color: var(--text-primary);
    font-weight: 500;
  }
  
  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 0.9rem;
  }
  
  .form-group textarea {
    resize: vertical;
    min-height: 80px;
  }
  
  .char-count {
    position: absolute;
    bottom: 0.5rem;
    right: 0.75rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }
  
  .share-url-group {
    margin-top: 1rem;
  }
  
  .url-input-group {
    display: flex;
    gap: 0.5rem;
  }
  
  .url-input-group input {
    flex: 1;
    font-size: 0.8rem;
    background: var(--bg-secondary) !important;
    color: var(--text-primary) !important;
    border: 1px solid var(--border-color) !important;
  }
  
  .url-input-group button {
    padding: 0.75rem 1rem;
    background: var(--admin-primary);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
  }
  
  .url-input-group button:hover {
    background: var(--admin-primary-dark);
  }
</style> 