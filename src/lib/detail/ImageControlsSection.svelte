<script lang="ts">
  import { unifiedRightsStore } from '$lib/unifiedRightsStore';
  
  export let image: any;
  export let isCreator: boolean;
  export let onSetLocationFilter: () => void;
  export let onCopyLink: () => void;
  export let onDeleteImage: () => void;
  export let onDownloadOriginal: (id: string, name: string) => void;
  export let onToggleGallery: () => void;
  export let darkMode: boolean = false;
  export let rotating: boolean = false;

  // Subscribe to unified rights store
  $: rights = $unifiedRightsStore.rights;
  $: loading = $unifiedRightsStore.loading;
  $: error = $unifiedRightsStore.error;
  $: isOwner = $unifiedRightsStore.isOwner;

  // Debug logging
  $: {
    console.log('🔍 [ImageControlsSection] Rights updated:', {
      rights,
      loading,
      error,
      isOwner,
      isCreator,
      imageId: image?.id
    });
    
    if (rights) {
      console.log('🔍 [ImageControlsSection] Button visibility decisions:', {
        deleteButton: rights.delete || isCreator,
        downloadButton: rights.download || rights.download_original || isCreator,
        galleryButton: rights.edit || isCreator
      });
    }
  }
</script>

<div class="controls-section" class:dark={darkMode}>
  {#if image.lat && image.lon}
    <div class="action-buttons">
      <a class="square-btn gmaps-btn" href={`https://www.google.com/maps?q=${image.lat},${image.lon}`} target="_blank" rel="noopener" title="Google Maps öffnen">
        <!-- Google Logo SVG -->
        <svg width="35" height="35" viewBox="0 0 24 24" class="google-logo">
          <path class="google-blue" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor"/>
          <path class="google-green" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor"/>
          <path class="google-yellow" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="currentColor"/>
          <path class="google-red" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor"/>
        </svg>
      </a>
      <button class="square-btn location-filter-btn" on:click={onSetLocationFilter} title="Als Location-Filter setzen">
        <!-- Culoca O Icon SVG -->
        <svg width="35" height="35" viewBox="0 0 83.86 100.88" fill="currentColor">
          <path d="M0,41.35c0-5.67,1.1-11.03,3.29-16.07,2.19-5.04,5.19-9.43,8.98-13.17,3.79-3.74,8.25-6.69,13.36-8.86,5.11-2.17,10.54-3.25,16.29-3.25s11.18,1.08,16.29,3.25c5.11,2.17,9.56,5.12,13.36,8.86,3.79,3.74,6.79,8.13,8.98,13.17,2.19,5.04,3.29,10.4,3.29,16.07s-1.1,11.03-3.29,16.07c-2.2,5.04-5.19,9.43-8.98,13.17-3.8,3.74-8.25,6.7-13.36,8.86-5.11,2.17-9.49,21.42-15.25,21.42s-12.23-19.25-17.34-21.42c-5.11-2.17-9.56-5.12-13.36-8.86-3.79-3.74-6.79-8.13-8.98-13.17-2.2-5.04-3.29-10.4-3.29-16.07ZM25.16,41.35c0,2.29.44,4.43,1.32,6.44.88,2.01,2.07,3.76,3.59,5.26,1.52,1.5,3.29,2.68,5.33,3.55,2.04.87,4.21,1.3,6.53,1.3s4.49-.43,6.53-1.3c2.04-.87,3.81-2.05,5.33-3.55,1.52-1.5,2.71-3.25,3.59-5.26.88-2.01,1.32-4.15,1.32-6.44s-.44-4.43-1.32-6.44c-.88-2.01-2.08-3.76-3.59-5.26-1.52-1.5-3.29-2.68-5.33-3.55-2.03-.87-4.21-1.3-6.53-1.3s-4.49.43-6.53,1.3c-2.04.87-3.81,2.05-5.33,3.55-1.52,1.5-2.72,3.25-3.59,5.26-.88,2.01-1.32,4.16-1.32,6.44Z"/>
        </svg>
      </button>
      <button class="square-btn share-btn" on:click={onCopyLink} title="Link kopieren">
        <svg width="35" height="35" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
        </svg>
      </button>
      
      {#if rights?.delete || isCreator}
        <button class="square-btn delete-btn" on:click={onDeleteImage} title="Bild löschen" disabled={loading}>
          <svg width="35" height="35" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
          </svg>
        </button>
      {/if}
      
      {#if rights?.download || rights?.download_original || isCreator}
        <button class="square-btn download-btn" data-download-id={image.id} on:click={() => onDownloadOriginal(image.id, image.original_name)} title="Original herunterladen" disabled={rotating || loading}>
          <svg width="35" height="35" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 6v7m0 0l-3-3m3 3l3-3M6 18h12"/>
          </svg>
        </button>
      {/if}
      
      <!-- Rotate button auskommentiert - gefährlich -->
      <!--
      <button class="square-btn rotate-btn" on:click={rotateImage} title="Bild 90° nach links drehen" disabled={rotating}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
        </svg>
      </button>
      -->
      
      {#if rights?.edit || isCreator}
        <button class="square-btn gallery-toggle-btn" on:click={onToggleGallery} title="Aus Galerie entfernen/hinzufügen" class:active={image.gallery ?? true} disabled={loading}>
          {#if image.gallery ?? true}
            <svg width="25" height="25" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="3" width="4" height="4"/>
              <rect x="10" y="3" width="4" height="4"/>
              <rect x="17" y="3" width="4" height="4"/>
              <rect x="3" y="10" width="4" height="4"/>
              <rect x="10" y="10" width="4" height="4"/>
              <rect x="17" y="10" width="4" height="4"/>
              <rect x="3" y="17" width="4" height="4"/>
              <rect x="10" y="17" width="4" height="4"/>
              <rect x="17" y="17" width="4" height="4"/>
            </svg>
          {:else}
            <svg width="25" height="25" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="16" height="16" stroke="currentColor" stroke-width="1" fill="none"/>
            </svg>
          {/if}
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .controls-section {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.7rem;
    margin-bottom: 0.2rem;
    background: transparent;
    margin-top: 12px;
  }
  .action-buttons {
    display: flex;
    gap: 0.7rem;
    justify-content: center;
    margin-top: 0;
    margin-bottom: 0.2rem;
    background: transparent;
  }
  .square-btn {
    width: 50px;
    height: 50px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 8px;
    text-decoration: none;
    font-size: 0;
    padding: 0;
  }
  .square-btn:hover {
    background: var(--bg-tertiary);
    border-color: var(--text-primary);
    transform: scale(1.05);
  }
  .square-btn:focus {
    outline: none;
    border-color: var(--accent-color);
  }
  .square-btn svg {
    width: 35px;
    height: 35px;
    fill: currentColor;
  }
  .gmaps-btn .google-logo .google-blue,
  .gmaps-btn .google-logo .google-green,
  .gmaps-btn .google-logo .google-yellow,
  .gmaps-btn .google-logo .google-red {
    transition: fill 0.2s;
    fill: currentColor;
  }
  .gmaps-btn:hover .google-logo .google-blue { fill: #4285F4; }
  .gmaps-btn:hover .google-logo .google-green { fill: #34A853; }
  .gmaps-btn:hover .google-logo .google-yellow { fill: #FBBC05; }
  .gmaps-btn:hover .google-logo .google-red { fill: #EA4335; }
  .location-filter-btn {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
  .location-filter-btn:hover svg {
    fill: #ee7221;
  }
  .delete-btn {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
  .delete-btn:hover {
    background: #dc3545;
    color: white;
    border-color: #dc3545;
  }
  .download-btn {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
  .download-btn:hover {
    background: #28a745;
    color: white;
    border-color: #28a745;
  }
  .gallery-toggle-btn {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
  .gallery-toggle-btn:hover {
    background: var(--bg-tertiary);
    border-color: var(--text-primary);
  }
  .gallery-toggle-btn.active {
    background: #007bff;
    color: white;
    border-color: #007bff;
  }
  .gallery-toggle-btn.active:hover {
    background: #0056b3;
    border-color: #0056b3;
  }
  .radius-control {
    width: 100%;
    margin: 0.2rem auto 0.1rem auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: transparent;
  }
  .radius-value {
    color: var(--text-secondary);
    font-weight: 500;
    font-size: 1rem;
    margin-bottom: 0.1rem;
    text-align: center;
    background: transparent;
  }
  .nearby-count {
    font-size: 0.85rem;
    font-weight: 400;
    color: var(--text-muted);
    margin-left: 0.3rem;
  }
  .hidden-count {
    font-size: 0.85rem;
    font-weight: 400;
    color: var(--text-muted);
    margin-left: 0.3rem;
    cursor: pointer;
    transition: color 0.2s;
    opacity: 0.7;
  }
  .hidden-count:hover {
    color: var(--culoca-orange);
    opacity: 1;
  }
  .hidden-count.active {
    color: var(--culoca-orange);
    opacity: 1;
  }
  .radius-control input[type="range"] {
    width: 100vw;
    max-width: 100vw;
    margin: 0 -50vw 0 -50vw;
    left: 50%;
    position: relative;
    display: block;
    background: transparent;
    -webkit-appearance: none;
    appearance: none;
    --thumb: 30px;      /* Thumb-Größe */
    --track: 2px;       /* Track-Höhe */
    --pct: 0%;          /* wird per JS gesetzt */
  }

  /* ===== WebKit (Chrome/Safari/Edge) ===== */
  .radius-control input[type="range"]::-webkit-slider-runnable-track {
    height: var(--track);
    border-radius: 999px;
    background:
      linear-gradient(to right,
        var(--tw-ring-color) 0%,
        var(--tw-ring-color) var(--pct),
        #e5e7eb var(--pct),
        #e5e7eb 100%);
  }
  .radius-control input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: var(--thumb);
    height: var(--thumb);
    border-radius: 50%;
    background: var(--accent-color);
    border: 2px solid var(--bg-primary);
    cursor: pointer;
    /* Track mittig unter dem Thumb ausrichten */
    margin-top: calc((var(--track) - var(--thumb)) / 2);
    transition: transform .1s ease;
  }

  /* ===== Firefox ===== */
  .radius-control input[type="range"]::-moz-range-track {
    height: var(--track);
    background: #e5e7eb;
    border-radius: 999px;
  }
  .radius-control input[type="range"]::-moz-range-progress {
    height: var(--track);
    background: var(--tw-ring-color);
    border-radius: 999px;
  }
  .radius-control input[type="range"]::-moz-range-thumb {
    width: var(--thumb);
    height: var(--thumb);
    border-radius: 50%;
    background: var(--accent-color);
    border: 2px solid var(--bg-primary);
    cursor: pointer;
    transition: transform .1s ease;
  }

  /* (optional) kleine Interaktions-Details */
  .radius-control input[type="range"]:hover::-webkit-slider-thumb,
  .radius-control input[type="range"]:hover::-moz-range-thumb { 
    transform: scale(.98); 
  }
</style> 