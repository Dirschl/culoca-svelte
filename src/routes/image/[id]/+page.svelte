<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { page } from '$app/stores';

  let image = null;
  let loading = true;
  let error = '';

  $: imageId = $page.params.id;

  onMount(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('images')
        .select('*')
        .eq('id', imageId)
        .single();

      if (fetchError) {
        error = fetchError.message;
      } else {
        image = data;
      }
    } catch (err) {
      error = 'Failed to load image';
      console.error(err);
    }
    loading = false;
  });

  // Determine best image source
  $: imageSource = image ? (() => {
    const baseUrl = 'https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public';
    if (image.path_2048) {
      return `${baseUrl}/images-2048/${image.path_2048}`;
    }
    return `${baseUrl}/images-512/${image.path_512}`;
  })() : '';
</script>

<svelte:head>
  <title>{image?.title || image?.original_name || `Image ${image?.id}` || 'Loading...'}</title>
</svelte:head>

<div class="page">
  <!-- Navigation -->
  <nav class="nav">
    <a href="/" class="back-link">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
      </svg>
      Zurück zur Galerie
    </a>
  </nav>

  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <span>Lade Bild...</span>
    </div>
  {:else if error}
    <div class="error">❌ Fehler: {error}</div>
  {:else if image}
    <div class="content">
      <!-- Main Image -->
      <div class="image-wrapper">
        <img
          src={imageSource}
          alt={image.title || image.original_name || `Image ${image.id}`}
          class="main-image"
        />
      </div>

      <!-- Image Information -->
      <div class="info-section">
        <h1 class="title">
          {image.title || image.original_name || `Bild ${image.id.substring(0, 8)}...`}
        </h1>
        
        {#if image.description}
          <p class="description">{image.description}</p>
        {:else}
          <p class="description placeholder">Keine Beschreibung verfügbar</p>
        {/if}

        <!-- Metadata -->
        <div class="metadata">
          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Auflösung:</span>
              <span class="meta-value">{image.width} × {image.height} px</span>
            </div>
            {#if image.created_at}
              <div class="meta-item">
                <span class="meta-label">Hochgeladen:</span>
                <span class="meta-value">{new Date(image.created_at).toLocaleDateString('de-DE')}</span>
              </div>
            {/if}
            {#if image.camera}
              <div class="meta-item">
                <span class="meta-label">Kamera:</span>
                <span class="meta-value">{image.camera}</span>
              </div>
            {/if}
            {#if image.lens}
              <div class="meta-item">
                <span class="meta-label">Objektiv:</span>
                <span class="meta-value">{image.lens}</span>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {:else}
    <div class="error">❌ Bild nicht gefunden</div>
  {/if}
</div>

<style>
  /* Night Blue Theme - Same as main page */
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

  .page {
    background: #0f1419;
    color: white;
    min-height: 100vh;
    padding: 0;
  }

  /* Navigation */
  .nav {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #2d2d44;
    background: #0f1419;
  }

  .back-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #0066cc;
    text-decoration: none;
    font-weight: 500;
    font-size: 0.9rem;
    transition: color 0.2s ease;
  }

  .back-link:hover {
    color: #0099ff;
  }

  .back-link svg {
    flex-shrink: 0;
  }

  /* Loading & Error States */
  .loading, .error {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    min-height: 400px;
    color: #ccc;
  }

  .error {
    color: #ff6b6b;
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #2d2d44;
    border-top: 2px solid #0066cc;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Main Content */
  .content {
    padding: 0;
  }

  /* Image Display - Fixed 800px Height */
  .image-wrapper {
    width: 100%;
    height: 800px;
    background: #0f1419;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border-bottom: 1px solid #2d2d44;
  }

  .main-image {
    max-width: 100%;
    max-height: 100%;
    height: 800px;
    width: auto;
    object-fit: contain;
    display: block;
  }

  /* Info Section */
  .info-section {
    padding: 2rem 1.5rem;
    background: #0f1419;
  }

  .title {
    font-size: 1.8rem;
    font-weight: 600;
    color: white;
    margin: 0 0 1rem 0;
    line-height: 1.3;
  }

  .description {
    font-size: 1rem;
    color: #ccc;
    line-height: 1.6;
    margin: 0 0 2rem 0;
  }

  .description.placeholder {
    color: #666;
    font-style: italic;
  }

  /* Metadata Grid */
  .metadata {
    background: #1a1a2e;
    border-radius: 8px;
    padding: 1.5rem;
  }

  .meta-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: 1fr;
  }

  .meta-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid #2d2d44;
  }

  .meta-item:last-child {
    border-bottom: none;
  }

  .meta-label {
    color: #aaa;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .meta-value {
    color: white;
    font-size: 0.9rem;
    text-align: right;
  }

  /* Mobile Optimizations */
  @media (max-width: 768px) {
    .nav {
      padding: 0.75rem 1rem;
    }

    .back-link {
      font-size: 0.85rem;
    }

    .image-wrapper {
      height: 400px;
    }

    .main-image {
      height: 400px;
    }

    .info-section {
      padding: 1.5rem 1rem;
    }

    .title {
      font-size: 1.4rem;
    }

    .metadata {
      padding: 1rem;
    }

    .meta-grid {
      gap: 0.75rem;
    }
  }

  @media (max-width: 480px) {
    .image-wrapper {
      height: 300px;
    }

    .main-image {
      height: 300px;
    }

    .info-section {
      padding: 1rem 0.75rem;
    }

    .title {
      font-size: 1.2rem;
    }

    .meta-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
    }

    .meta-value {
      text-align: left;
    }
  }
</style> 