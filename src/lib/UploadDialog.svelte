<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { createEventDispatcher } from 'svelte';
  export let show = false;
  // export let onClose: () => void; // Entfernt, da nicht mehr als Prop benötigt

  const dispatch = createEventDispatcher();

  let uploading = false;
  let uploadMessage = '';
  let uploadProgress = 0;
  let currentUploading = '';
  let uploadPreviews: string[] = [];
  let isDragOver = false;
  let files: FileList | null = null;

  function closeDialog() {
    resetState();
    onClose?.();
  }

  function resetState() {
    uploading = false;
    uploadMessage = '';
    uploadProgress = 0;
    currentUploading = '';
    uploadPreviews.forEach(url => URL.revokeObjectURL(url));
    uploadPreviews = [];
    files = null;
    isDragOver = false;
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    isDragOver = true;
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    isDragOver = false;
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragOver = false;
    if (event.dataTransfer?.files) {
      handleFilesSelected(event.dataTransfer.files);
    }
  }

  function handleFilesSelected(selectedFiles: FileList | null) {
    files = selectedFiles;
    if (!files || files.length === 0) {
      uploadMessage = 'Bitte Bilder auswählen';
      return;
    }
    // Create preview URLs
    uploadPreviews.forEach(url => URL.revokeObjectURL(url));
    uploadPreviews = [];
    for (const file of Array.from(files)) {
      const previewUrl = URL.createObjectURL(file);
      uploadPreviews = [...uploadPreviews, previewUrl];
    }
    uploadMessage = '';
  }

  async function uploadImages(event?: Event) {
    if (event) event.preventDefault();
    if (!files || files.length === 0) {
      uploadMessage = 'Bitte Bilder auswählen';
      return;
    }
    // Check if user is authenticated
    const sessionResult = await supabase.auth.getSession();
    const currentUser = sessionResult.data.session?.user;
    const session = sessionResult.data.session;
    if (!currentUser) {
      uploadMessage = '❌ Bitte zuerst einloggen, um Bilder hochzuladen';
      return;
    }
    // Validate file types
    const validFiles = Array.from(files).filter(file => 
      file.type === 'image/jpeg' || file.type === 'image/jpg' || file.type === 'image/webp'
    );
    if (validFiles.length === 0) {
      uploadMessage = 'Nur JPEG-Dateien sind erlaubt';
      return;
    }
    if (validFiles.length !== files.length) {
      uploadMessage = `${files.length - validFiles.length} Dateien übersprungen (nur JPEG erlaubt)`;
    }
    uploading = true;
    uploadProgress = 0;
    const totalFiles = validFiles.length;
    try {
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        currentUploading = file.name;
        uploadMessage = `Uploading ${file.name} (${i + 1}/${totalFiles})...`;
        // STEP 1: Upload original to Supabase originals bucket
        const id = crypto.randomUUID();
        const filename = `${id}.jpg`;
        const { error: originalUploadError } = await supabase.storage
          .from('originals')
          .upload(filename, file, { 
            contentType: 'image/jpeg',
            upsert: false
          });
        if (originalUploadError) {
          throw new Error(`Original upload failed: ${originalUploadError.message}`);
        }
        // STEP 2: Send metadata to API for processing
        const formData = new FormData();
        formData.append('filename', filename);
        formData.append('original_path', filename);
        if (currentUser) {
          formData.append('profile_id', currentUser.id);
          try {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('save_originals')
              .eq('id', currentUser.id)
              .single();
            const saveOriginals = profileData?.save_originals ?? true;
            formData.append('save_originals', saveOriginals ? 'true' : 'false');
          } catch {
            formData.append('save_originals', 'true');
          }
        }
        const access_token = session?.access_token;
        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            ...(access_token ? { 'Authorization': `Bearer ${access_token}` } : {})
          },
          body: formData
        });
        const result = await response.json();
        if (result.status !== 'success') {
          throw new Error(result.message);
        }
        uploadProgress = Math.round(((i + 1) / totalFiles) * 100);
      }
      uploadMessage = `✅ Successfully uploaded ${totalFiles} image(s)!`;
      dispatch('uploaded');
    } catch (error) {
      const err = error as Error;
      uploadMessage = `❌ Upload failed: ${err.message}`;
    } finally {
      uploading = false;
      currentUploading = '';
      setTimeout(() => {
        uploadMessage = '';
        uploadProgress = 0;
        resetState();
      }, 5000);
    }
  }

  async function deleteAllImages() {
    if (!confirm('Wirklich ALLE Bilder löschen? Diese Aktion kann nicht rückgängig gemacht werden!')) {
      return;
    }
    try {
      uploading = true;
      uploadMessage = 'Lösche alle Bilder...';
      const response = await fetch('/api/delete-all', { method: 'POST' });
      const result = await response.json();
      if (result.status === 'success') {
        uploadMessage = `✅ ${result.deletedCount} Bilder erfolgreich gelöscht!`;
        dispatch('deletedAll');
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      const err = error as Error;
      uploadMessage = `❌ Fehler beim Löschen: ${err.message}`;
    } finally {
      uploading = false;
      setTimeout(() => {
        uploadMessage = '';
      }, 5000);
    }
  }
</script>

{#if show}
  <div class="dialog-overlay" on:click={closeDialog}>
    <div class="dialog-content" on:click|stopPropagation>
      <div class="dialog-header">
        <h2>Bilder hochladen</h2>
        <button class="close-btn" on:click={closeDialog}>×</button>
      </div>
      <div class="upload-section">
        <form on:submit|preventDefault={uploadImages}>
          <div 
            class="drop-zone"
            class:drag-over={isDragOver}
            class:uploading={uploading}
            on:dragover={handleDragOver}
            on:dragleave={handleDragLeave}
            on:drop={handleDrop}
            role="button"
            tabindex="0"
          >
            <div class="drop-content">
              {#if uploading}
                <div class="upload-icon">
                  <div class="spinner"></div>
                </div>
                <h3>Uploading...</h3>
                <p>Bitte warten...</p>
              {:else}
                <div class="upload-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                  </svg>
                </div>
                <h3>Bilder hier hinziehen</h3>
                <p>oder <span class="link-text">Dateien auswählen</span></p>
                <small>Nur JPEG- und WebP-Dateien erlaubt</small>
              {/if}
            </div>
            <input 
              type="file" 
              name="files" 
              multiple 
              accept="image/jpeg,image/jpg,image/webp" 
              disabled={uploading}
              class="file-input"
              on:change={e => handleFilesSelected(e.target.files)}
            />
          </div>
          <div class="upload-actions">
            <button type="submit" disabled={uploading} class="upload-btn">
              {uploading ? 'Uploading...' : 'Ausgewählte Bilder hochladen'}
            </button>
            <button 
              type="button" 
              class="delete-all-btn"
              on:click={deleteAllImages}
              disabled={uploading}
            >
              🗑️ Alle Bilder löschen
            </button>
          </div>
        </form>
        {#if uploading}
          <div class="upload-progress">
            <div class="progress-info">
              <span class="current-file">{currentUploading}</span>
              <span class="progress-percent">{uploadProgress}%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: {uploadProgress}%"></div>
            </div>
          </div>
        {/if}
        {#if uploadPreviews.length > 0}
          <div class="upload-previews">
            <h4>Upload-Vorschau:</h4>
            <div class="preview-grid">
              {#each uploadPreviews as preview, i}
                <div class="preview-item">
                  <img src={preview} alt="Upload preview {i + 1}" />
                </div>
              {/each}
            </div>
          </div>
        {/if}
        {#if uploadMessage}
          <div class="upload-message" class:success={uploadMessage.includes('✅')} class:error={uploadMessage.includes('❌')}>
            {uploadMessage}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  /* Dialog Styles (wie in +page.svelte) */
  .dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(4px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }
  .dialog-content {
    background: var(--bg-secondary);
    border-radius: 12px;
    max-width: 600px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 40px var(--shadow);
    border: 1px solid var(--border-color);
  }
  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }
  .dialog-header h2 {
    margin: 0;
    color: var(--text-primary);
    font-size: 1.5rem;
    font-weight: 600;
  }
  .close-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 2rem;
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.2s ease;
  }
  .close-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }
  .drop-zone {
    position: relative;
    border: 2px dashed var(--border-color);
    border-radius: 12px;
    padding: 3rem 2rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s ease;
    background: var(--bg-tertiary);
    margin-bottom: 1rem;
  }
  .drop-zone:hover {
    border-color: var(--accent-color);
    background: var(--border-color);
  }
  .drop-zone.drag-over {
    border-color: var(--accent-hover);
    background: var(--border-color);
  }
  .drop-zone.uploading {
    opacity: 0.6;
    pointer-events: none;
  }
  .upload-icon {
    margin-bottom: 1rem;
  }
  .spinner {
    border: 4px solid var(--border-color);
    border-top: 4px solid var(--accent-color);
    border-radius: 50%;
    width: 32px;
    height: 32px;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem auto;
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  .upload-actions {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
    justify-content: flex-end;
  }
  .upload-btn, .delete-all-btn {
    background: var(--accent-color);
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.2s ease;
  }
  .upload-btn:disabled, .delete-all-btn:disabled {
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    cursor: not-allowed;
  }
  .upload-progress {
    margin-top: 1rem;
  }
  .progress-info {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }
  .progress-bar {
    width: 100%;
    height: 8px;
    background: var(--bg-tertiary);
    border-radius: 4px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: var(--accent-color);
    transition: width 0.3s ease;
  }
  .upload-previews {
    margin-top: 1.5rem;
  }
  .preview-grid {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .preview-item img {
    width: 64px;
    height: 64px;
    object-fit: cover;
    border-radius: 8px;
    box-shadow: 0 2px 8px var(--shadow);
  }
  .upload-message {
    margin-top: 1rem;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    font-weight: 500;
    font-size: 1rem;
    text-align: center;
  }
  .upload-message.success {
    background: var(--success-bg);
    color: var(--success-text);
  }
  .upload-message.error {
    background: var(--error-bg);
    color: var(--error-text);
  }
</style> 