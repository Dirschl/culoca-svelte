<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  
  export let showModal = false;
  export let shareUrl = '';
  export let shareTitle = '';
  export let shareDescription = '';
  
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
  
  async function saveShare() {
    try {
      const response = await fetch('/api/save-map-share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: shareTitle,
          description: shareDescription,
          params: shareUrl.split('?')[1] // Extract query parameters
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save share');
      }

      const result = await response.json();
      if (result.success) {
        // Update the share URL with the new permanent URL
        shareUrl = result.shareUrl;
        console.log('Share saved successfully, new URL:', shareUrl);
        // Don't close the modal automatically - let user see the updated URL
      }
    } catch (error) {
      console.error('Error saving share:', error);
    }
  }
  
  // Screenshot will be generated dynamically when shared
  onMount(() => {
    if (showModal) {
      console.log('Screenshot will be generated dynamically for OpenGraph');
    }
  });
</script>

{#if showModal}
  <div class="share-modal-overlay" on:click={closeModal}>
    <div class="share-modal" on:click|stopPropagation>
      <div class="share-modal-header">
        <h3>Kartenausschnitt teilen</h3>
        <button class="close-btn" on:click={closeModal}>×</button>
      </div>
      
      <div class="share-modal-content">
        <div class="map-preview">
          <p>Screenshot wird dynamisch für Social Media generiert</p>
        </div>
        
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
            <button type="button" class="save-share-btn" on:click={saveShare}>
              Für Social Media speichern
            </button>
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
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200px; /* Fixed height for preview */
    background-color: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 1rem;
    font-weight: 500;
    padding: 1rem;
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
    margin-bottom: 0.5rem; /* Reduce space before the button */
  }
  
  .url-input-group {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem; /* Add space between input and button */
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
  
  .save-share-btn {
    width: 100%;
    padding: 0.75rem 1rem;
    background: var(--accent-color);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
  }
  
  .save-share-btn:hover {
    background: var(--accent-hover);
  }
</style> 