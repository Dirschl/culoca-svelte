<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import Justified from '$lib/Justified.svelte';

  const pics = writable<any[]>([]);
  let page = 0, size = 40, loading = false, hasMoreImages = true;
  let useJustifiedLayout = true;
  let profileAvatar: string | null = null;

  async function loadMore() {
    if (loading || !hasMoreImages) return; 
    loading = true;
    
    const { data } = await supabase
      .from('images')
      .select('id,path_512,path_2048,width,height')
      .order('created_at', { ascending: false })
      .range(page * size, page * size + size - 1);
    
    if (data) {
      // Check if we got fewer items than requested - means we reached the end
      if (data.length < size) {
        hasMoreImages = false;
      }
      
      pics.update((p) => [...p, ...data.map((d) => ({
        id: d.id,
        src: `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${d.path_512}`,
        srcHD: `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${d.path_2048}`,
        width: d.width,
        height: d.height
      }))]);
    } else {
      // No data returned - we've reached the end
      hasMoreImages = false;
    }
    
    page++; 
    loading = false;
  }

  let uploading = false;
  let uploadMessage = '';
  let uploadProgress = 0;
  let currentUploading = '';
  let uploadPreviews: string[] = [];
  let isDragOver = false;

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
        pics.set([]); // Clear the gallery
        page = 0; // Reset pagination
        hasMoreImages = true; // Reset for future uploads
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

  // Drag & Drop handlers
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
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  }

  async function processFiles(files: FileList) {
    if (!files || files.length === 0) {
      uploadMessage = 'Bitte Bilder auswählen';
      return;
    }

    // Validate file types
    const validFiles = Array.from(files).filter(file => 
      file.type === 'image/jpeg' || file.type === 'image/jpg'
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
    uploadPreviews = [];
    const totalFiles = validFiles.length;

    try {
      // Create preview URLs for immediate display
      for (const file of validFiles) {
        const previewUrl = URL.createObjectURL(file);
        uploadPreviews = [...uploadPreviews, previewUrl];
      }

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        currentUploading = file.name;
        uploadMessage = `Uploading ${file.name} (${i + 1}/${totalFiles})...`;

        const formData = new FormData();
        formData.append('files', file);
        
        const response = await fetch('/api/upload', { method: 'POST', body: formData });
        const result = await response.json();
        
        if (result.status !== 'success') {
          throw new Error(result.message);
        }

        // Update progress
        uploadProgress = Math.round(((i + 1) / totalFiles) * 100);
        
        // Add new images immediately to gallery
        if (result.images) {
          pics.update(p => [
            ...result.images.map((img: any) => ({
              id: img.id,
              src: `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${img.path_512}`,
              srcHD: `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${img.path_2048}`,
              width: img.width,
              height: img.height
            })),
            ...p
          ]);
        }
      }

      uploadMessage = `✅ Successfully uploaded ${totalFiles} image(s)!`;

    } catch (error) {
      const err = error as Error;
      uploadMessage = `❌ Upload failed: ${err.message}`;
    } finally {
      uploading = false;
      currentUploading = '';
      
      // Cleanup preview URLs
      uploadPreviews.forEach(url => URL.revokeObjectURL(url));
      uploadPreviews = [];
      
      // Clear message after 5 seconds
      setTimeout(() => {
        uploadMessage = '';
        uploadProgress = 0;
      }, 5000);
    }
  }

  async function uploadImages(event: Event) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const files = (form.elements.namedItem('files') as HTMLInputElement).files;
    
    if (files) {
      await processFiles(files);
      form.reset();
    }
  }

  // Infinite scroll handler
  function handleScroll() {
    if (loading || !hasMoreImages) return;
    
    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    const scrolledToBottom = scrollTop + clientHeight >= scrollHeight - 1000;
    
    if (scrolledToBottom) {
      loadMore();
    }
  }

  function updateLayoutFromStorage() {
    if (typeof localStorage !== 'undefined') {
      const savedLayout = localStorage.getItem('galleryLayout');
      useJustifiedLayout = savedLayout === 'justified';
    }
  }

  async function loadProfileAvatar() {
    // Try localStorage cache first
    if (typeof localStorage !== 'undefined') {
      const cached = localStorage.getItem('profileAvatar');
      if (cached) {
        profileAvatar = cached;
        return;
      }
    }
    // Get user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Fetch profile
    const { data, error } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .single();
    if (data && data.avatar_url) {
      if (data.avatar_url.startsWith('http')) {
        profileAvatar = data.avatar_url;
      } else {
        profileAvatar = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/avatars/${data.avatar_url}`;
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('profileAvatar', profileAvatar);
      }
    }
  }

  onMount(() => {
    updateLayoutFromStorage();
    loadProfileAvatar();
    loadMore();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('galleryLayoutChanged', updateLayoutFromStorage);
    window.addEventListener('profileSaved', loadProfileAvatar);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('galleryLayoutChanged', updateLayoutFromStorage);
      window.removeEventListener('profileSaved', loadProfileAvatar);
    };
  });
</script>

<div class="upload-section">
  <form on:submit|preventDefault={uploadImages}>
    <!-- Drag & Drop Zone -->
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
          <small>Nur JPEG-Dateien erlaubt</small>
        {/if}
      </div>
      
      <input 
        type="file" 
        name="files" 
        multiple 
        accept="image/jpeg,image/jpg" 
        disabled={uploading}
        class="file-input"
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
        disabled={uploading || $pics.length === 0}
      >
        🗑️ Alle Bilder löschen
      </button>
    </div>
  </form>
  
  <!-- Upload Progress -->
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

  <!-- Upload Previews -->
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

<style>


  /* Drag & Drop Zone */
  .drop-zone {
    position: relative;
    border: 2px dashed #2d2d44;
    border-radius: 12px;
    padding: 3rem 2rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s ease;
    background: #1a1a2e;
    margin-bottom: 1rem;
  }

  .drop-zone:hover {
    border-color: #0066cc;
    background: #1e1e3a;
  }

  .drop-zone.drag-over {
    border-color: #0099ff;
    background: #1e1e3a;
    transform: scale(1.02);
    box-shadow: 0 4px 20px rgba(0, 153, 255, 0.2);
  }

  .drop-zone.uploading {
    border-color: #28a745;
    background: #1a2e1a;
    cursor: not-allowed;
  }

  .drop-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    pointer-events: none;
  }

  .upload-icon {
    color: #666;
    transition: color 0.3s ease;
  }

  .drop-zone:hover .upload-icon {
    color: #0066cc;
  }

  .drop-zone.drag-over .upload-icon {
    color: #0099ff;
  }

  .drop-zone.uploading .upload-icon {
    color: #28a745;
  }

  .drop-content h3 {
    margin: 0;
    font-size: 1.2rem;
    color: white;
    font-weight: 600;
  }

  .drop-content p {
    margin: 0;
    color: #aaa;
    font-size: 0.9rem;
  }

  .link-text {
    color: #0066cc;
    text-decoration: underline;
    font-weight: 500;
  }

  .drop-content small {
    color: #666;
    font-size: 0.8rem;
  }

  .file-input {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }

  .file-input:disabled {
    cursor: not-allowed;
  }

  /* Upload Actions */
  .upload-actions {
    display: flex;
    gap: 1rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .upload-btn {
    flex: 1;
    min-width: 200px;
    padding: 0.75rem 1rem;
    background: #0066cc;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    font-size: 0.9rem;
    transition: background-color 0.2s ease;
  }

  .upload-btn:hover:not(:disabled) {
    background: #0052a3;
  }

  .upload-btn:disabled {
    background: #666;
    cursor: not-allowed;
  }

  .delete-all-btn {
    background: #dc3545 !important;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    transition: background-color 0.2s ease;
  }

  .delete-all-btn:hover:not(:disabled) {
    background: #c82333 !important;
  }

  .delete-all-btn:disabled {
    background: #999 !important;
    cursor: not-allowed;
  }

  .upload-message {
    margin-top: 1rem;
    padding: 0.75rem;
    border-radius: 4px;
    font-weight: 500;
  }

  .upload-message.success {
    background: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
  }

  .upload-message.error {
    background: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
  }

  /* Upload Progress */
  .upload-progress {
    margin-top: 1rem;
    padding: 1rem;
    background: #f0f8ff;
    border-radius: 6px;
    border: 1px solid #b8daff;
  }

  .progress-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
  }

  .current-file {
    color: #0066cc;
    font-weight: 500;
    max-width: 60%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .progress-percent {
    color: #333;
    font-weight: 600;
  }

  .progress-bar {
    width: 100%;
    height: 8px;
    background: #e9ecef;
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #0066cc, #0099ff);
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  /* Upload Previews */
  .upload-previews {
    margin-top: 1rem;
    padding: 1rem;
    background: #f8f9fa;
    border-radius: 6px;
    border: 1px solid #dee2e6;
  }

  .upload-previews h4 {
    margin: 0 0 1rem 0;
    color: #495057;
    font-size: 0.9rem;
    font-weight: 600;
  }

  .preview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 0.5rem;
    max-height: 200px;
    overflow-y: auto;
  }

  .preview-item {
    aspect-ratio: 1;
    border-radius: 4px;
    overflow: hidden;
    background: #e9ecef;
    border: 2px solid transparent;
    transition: border-color 0.2s ease;
  }

  .preview-item:hover {
    border-color: #0066cc;
  }

  .preview-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .upload-form {
      flex-direction: column;
      align-items: stretch;
    }

    .upload-form input[type="file"] {
      min-width: unset;
      margin-bottom: 0.5rem;
    }

    .preview-grid {
      grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
    }

    .progress-info {
      flex-direction: column;
      align-items: stretch;
      gap: 0.25rem;
    }

    .current-file {
      max-width: 100%;
    }
  }

  /* Gallery Styles */
  .gallery-container {
    width: 100%;
    margin: 0;
    padding: 0;
  }

  .loading-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 1rem;
    color: #ccc;
    font-size: 0.85rem;
  }

  .end-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    color: #28a745;
    font-weight: 500;
    background: rgba(40, 167, 69, 0.1);
    margin: 0.5rem 0.75rem;
    font-size: 0.85rem;
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #e9ecef;
    border-top: 2px solid #0066cc;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    color: #6c757d;
  }

  .empty-state h3 {
    margin: 0 0 1rem 0;
    font-size: 1.5rem;
    font-weight: 500;
  }

  .empty-state p {
    margin: 0;
    font-size: 1rem;
  }

  /* Floating Settings Button */
  .settings-fab {
    position: fixed;
    right: 1.5rem;
    bottom: 1.5rem;
    z-index: 50;
    width: 56px;
    height: 56px;
    background: #222b45;
    color: #fff;
    border-radius: 50%;
    box-shadow: 0 4px 16px rgba(0,0,0,0.18);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s, box-shadow 0.2s, transform 0.1s;
    border: none;
    outline: none;
    cursor: pointer;
    font-size: 1.5rem;
    text-decoration: none;
  }
  .settings-fab:hover {
    background: #0066cc;
    color: #fff;
    box-shadow: 0 8px 24px rgba(0,102,204,0.18);
    transform: scale(1.08);
  }
  @media (max-width: 600px) {
    .settings-fab {
      right: 1rem;
      bottom: 1rem;
      width: 48px;
      height: 48px;
      font-size: 1.2rem;
    }
  }

  /* Floating Profile Button */
  .profile-fab {
    position: fixed;
    right: 1.5rem;
    bottom: 5.5rem;
    z-index: 51;
    width: 56px;
    height: 56px;
    background: #444;
    color: #fff;
    border-radius: 50%;
    box-shadow: 0 4px 16px rgba(0,0,0,0.18);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s, box-shadow 0.2s, transform 0.1s;
    border: none;
    outline: none;
    cursor: pointer;
    font-size: 1.5rem;
    text-decoration: none;
    overflow: hidden;
  }
  .profile-fab:hover {
    background: #0066cc;
    color: #fff;
    box-shadow: 0 8px 24px rgba(0,102,204,0.18);
    transform: scale(1.08);
  }
  .profile-avatar-btn {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
    display: block;
  }
  @media (max-width: 600px) {
    .profile-fab {
      right: 1rem;
      bottom: 4.5rem;
      width: 48px;
      height: 48px;
      font-size: 1.2rem;
    }
  }

  /* Grid Layout (klassisch) */
  .grid-layout {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(256px, 1fr));
    gap: 2px;
    width: 100%;
    margin: 0 auto;
    padding: 1rem 0 2rem 0;
  }
  @media (max-width: 600px) {
    .grid-layout {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  .grid-item {
    background: #181828;
    border-radius: 0;
    overflow: hidden;
    /* box-shadow: 0 2px 8px rgba(0,0,0,0.10); */
    transition: box-shadow 0.2s, transform 0.2s;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1/1;
    position: relative;
  }
  .grid-item:hover {
    /* Kein box-shadow oder transform auf dem Container */
  }
  .grid-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.3s cubic-bezier(.4,0,.2,1);
  }
  .grid-item:hover img {
    transform: scale(1.04);
  }

</style>

<!-- Gallery with Infinite Scroll -->
<div class="gallery-container">
  {#if useJustifiedLayout}
    <div class="justified-wrapper">
      <Justified items={$pics} gap={1} targetRowHeight={220} />
    </div>
  {:else}
    <div class="grid-layout">
      {#each $pics as pic}
        <div class="grid-item">
          <img 
            src={pic.src} 
            alt="Gallery image {pic.id}"
            on:click={() => location.href = `/image/${pic.id}`}
            on:keydown={(e) => e.key === 'Enter' && (location.href = `/image/${pic.id}`)}
            tabindex="0"
            role="button"
            aria-label="View image {pic.id}"
          />
        </div>
      {/each}
    </div>
  {/if}
  
  {#if loading}
    <div class="loading-indicator">
      <div class="spinner"></div>
      <span>Lade weitere Bilder...</span>
    </div>
  {:else if $pics.length > 0 && !hasMoreImages}
    <div class="end-indicator">
      <span>✅ Alle {$pics.length} Bilder geladen</span>
    </div>
  {/if}
  
  {#if $pics.length === 0 && !loading}
    <div class="empty-state">
      <h3>Noch keine Bilder vorhanden</h3>
      <p>Lade deine ersten Bilder hoch, um die Galerie zu starten!</p>
    </div>
  {/if}
</div>

<!-- Floating Settings Button -->
<a href="/settings" class="settings-fab" title="Einstellungen">
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 16 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 8c.14.31.22.65.22 1v.09A1.65 1.65 0 0 0 21 12c0 .35-.08.69-.22 1z"/>
  </svg>
</a>

<!-- Floating Profile Button -->
<a href="/profile" class="profile-fab" title="Profil">
  {#if profileAvatar}
    <img src={profileAvatar || ''} alt="Profilbild" class="profile-avatar-btn" />
  {:else}
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M2 20c0-4 8-6 10-6s10 2 10 6"/>
    </svg>
  {/if}
</a>
