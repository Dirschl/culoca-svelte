<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import Justified from '$lib/Justified.svelte';
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';

  const pics = writable<any[]>([]);
  let page = 0, size = 40, loading = false, hasMoreImages = true;

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

  // Layout toggle
  let useJustifiedLayout = true;

  // Toggle layout and save preference
  function toggleLayout(justified: boolean) {
    useJustifiedLayout = justified;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('galleryLayout', justified ? 'justified' : 'grid');
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
        pics.set([]); // Clear the gallery
        page = 0; // Reset pagination
        hasMoreImages = true; // Reset for future uploads
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      uploadMessage = `❌ Fehler beim Löschen: ${error.message}`;
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
      uploadMessage = `❌ Upload failed: ${error.message}`;
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

  onMount(() => {
    // Load saved layout preference
    if (typeof localStorage !== 'undefined') {
      const savedLayout = localStorage.getItem('galleryLayout');
      if (savedLayout) {
        useJustifiedLayout = savedLayout === 'justified';
      }
    }

    loadMore();
    
    // Add scroll listener for infinite scroll
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Cleanup on destroy
    return () => {
      window.removeEventListener('scroll', handleScroll);
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

  /* Layout Toggle Controls */
  .layout-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
  }



  .toggle-container {
    display: flex;
    gap: 0;
    border-radius: 4px;
    overflow: hidden;
  }

  .layout-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 500;
    transition: all 0.2s ease;
    position: relative;
    border-right: none;
  }

  .layout-btn:last-child {
    border-right: 1px solid #2d2d44;
  }

  .layout-btn svg {
    opacity: 0.7;
  }

  .layout-btn.active svg {
    opacity: 1;
  }

  /* Grid Layout */
  .grid-layout {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1px;
    padding: 0;
  }

  .grid-item {
    aspect-ratio: 1;
    overflow: hidden;
    background: #1a1a2e;
    border: none;
    transition: all 0.3s ease;
    cursor: pointer;
    position: relative;
  }

  .grid-item:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  }

  .grid-item:focus-within {
    outline: 2px solid #0066cc;
    outline-offset: 2px;
  }

  .grid-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: all 0.3s ease;
  }

  .grid-item:hover img {
    filter: brightness(1.1) contrast(1.05);
  }

  .grid-item img:focus {
    outline: none;
  }

  /* Full Size Mobile Responsive */
  @media (max-width: 768px) {
    .grid-layout {
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 1px;
    }

    .layout-controls {
      flex-direction: row;
      align-items: center;
      justify-content: center;
      gap: 0;
      padding: 0.5rem 0.75rem;
    }

    .upload-section {
      padding: 0.5rem 0.75rem;
    }

    .drop-zone {
      padding: 2rem 1rem;
    }

    .drop-content h3 {
      font-size: 1rem;
    }

    .drop-content p {
      font-size: 0.85rem;
    }

    .upload-actions {
      flex-direction: column;
      gap: 0.75rem;
    }

    .upload-btn {
      min-width: 100%;
      padding: 0.75rem;
      font-size: 16px; /* Prevents zoom on iOS */
    }
  }

  @media (max-width: 480px) {
    .grid-layout {
      grid-template-columns: repeat(3, 1fr);
      gap: 1px;
    }

    .layout-btn {
      padding: 0.5rem 0.75rem;
      font-size: 0.8rem;
    }


  }

     /* Ultra mobile - maximize screen usage */
   @media (max-width: 375px) {
     .grid-layout {
       grid-template-columns: repeat(3, 1fr);
     }
     
     .upload-section {
       padding: 0.25rem 0.5rem;
     }
     
     .layout-controls {
       padding: 0.25rem 0.5rem;
     }

     .drop-zone {
       padding: 1.5rem 0.75rem;
     }

     .drop-content h3 {
       font-size: 0.9rem;
     }

     .upload-icon svg {
       width: 36px;
       height: 36px;
     }
   }

  /* Dark Night Blue Theme - Full Size Mobile App */
  :global(html, body) {
    background: #0f1419;
    color: white;
    margin: 0;
    padding: 0;
    font-family: system-ui, -apple-system, sans-serif;
    min-height: 100vh;
    width: 100%;
    overflow-x: hidden;
  }

  :global(*) {
    box-sizing: border-box;
  }

  /* Touch-optimized for mobile */
  :global(body) {
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  .upload-section {
    background: #0f1419;
    color: white;
    padding: 0.75rem;
  }

  .upload-form input[type="file"] {
    background: #1a1a2e;
    border: 1px solid #2d2d44;
    color: white;
  }

  .upload-form input[type="file"]::-webkit-file-upload-button {
    background: #0066cc;
    color: white;
    border: none;
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    margin-right: 0.5rem;
  }

  .layout-controls {
    background: #0f1419;
    color: white;
    padding: 0.75rem;
    margin: 0;
  }



  .layout-btn {
    background: #1a1a2e;
    color: #ccc;
    border: 1px solid #2d2d44;
  }

  .layout-btn:hover {
    background: #242447;
    color: white;
  }

  .layout-btn.active {
    background: #0066cc;
    color: white;
    border-color: #0066cc;
  }

  .loading-indicator {
    color: white;
  }

  .empty-state {
    color: #ccc;
  }

  .empty-state h3 {
    color: white;
  }
</style>

<!-- Layout Toggle -->
<div class="layout-controls">
  <div class="toggle-container">
    <button 
      class="layout-btn"
      class:active={useJustifiedLayout}
      on:click={() => toggleLayout(true)}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M2 4h20v4H2V4zm0 6h8v4H2v-4zm10 0h10v4H12v-4zM2 16h6v4H2v-4zm8 0h14v4H10v-4z"/>
      </svg>
      Justified
    </button>
    <button 
      class="layout-btn"
      class:active={!useJustifiedLayout}
      on:click={() => toggleLayout(false)}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z"/>
      </svg>
      Grid
    </button>
  </div>
</div>

<!-- Gallery with Infinite Scroll -->
<div class="gallery-container">
  {#if useJustifiedLayout}
    <Justified items={$pics} gap={1} targetRowHeight={220} />
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
