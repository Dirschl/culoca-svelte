<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { page } from '$app/stores';
  import Justified from '$lib/Justified.svelte';
  import { browser } from '$app/environment';
  import { tick } from 'svelte';
  import { darkMode } from '$lib/darkMode';

  let image: any = null;
  let loading = true;
  let error = '';
  let profile: any = null;
  let nearby: any[] = [];
  let radius = 500; // meters, default
  let radiusLoaded = false;
  let mapEl: HTMLDivElement;
  let map: any;
  let keywordsList: string[] = [];
  let useJustifiedLayout = true;
  let editingTitle = false;
  let titleEditValue = '';
  let currentUser: any = null;
  let editingDescription = false;
  let descriptionEditValue = '';


  $: imageId = $page.params.id;

  onMount(async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      currentUser = user;

      // Radius aus localStorage laden (pro User), erst wenn currentUser gesetzt ist
      if (browser && currentUser && !radiusLoaded) {
        const storedRadius = localStorage.getItem(`detailRadius_${currentUser.id}`);
        if (storedRadius) {
          radius = parseInt(storedRadius, 10) || 500;
        }
        radiusLoaded = true;
      }

      const { data, error: fetchError } = await supabase
        .from('images')
        .select('*')
        .eq('id', imageId)
        .single();

      if (fetchError) {
        error = fetchError.message;
      } else {
        image = data;
        if (!image.exif_data) image.exif_data = {};
        titleEditValue = image.title || '';
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

  function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number): string {
    const meters = getDistanceInMeters(lat1, lon1, lat2, lon2);
    return meters >= 1000 ? (meters / 1000).toFixed(1).replace('.', ',') + 'km' : meters + 'm';
  }

  function getDistanceForJustified(lat1: number, lon1: number, lat2: number, lon2: number): number {
    return getDistanceInMeters(lat1, lon1, lat2, lon2);
  }

  async function fetchProfile(profileId: string) {
    const { data, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .single();
    if (!profileErr) profile = data;
  }

  async function fetchNearbyImages(lat: number, lon: number, maxRadius: number) {
    const { data, error: nearErr } = await supabase
      .from('images')
      .select('*')
      .not('lat', 'is', null)
      .not('lon', 'is', null)
      .neq('id', imageId);
    if (nearErr || !data) return;
    const baseUrl = 'https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public';
    nearby = data.map((img: any) => {
      const dist = getDistanceInMeters(lat, lon, img.lat, img.lon);
      return {
        id: img.id,
        lat: img.lat,
        lon: img.lon,
        distance: dist,
        src: `${baseUrl}/images-512/${img.path_512}`,
        srcHD: `${baseUrl}/images-2048/${img.path_2048}`,
        width: img.width,
        height: img.height,
        title: img.title || null
      };
    }).filter((it: any) => it.distance <= maxRadius)
      .sort((a: any, b: any) => a.distance - b.distance);
  }

  // Recompute nearby list whenever radius or image changes
  $: if (image && image.lat && image.lon) {
    fetchNearbyImages(image.lat, image.lon, radius);
  }

  async function initMap() {
    if (!browser || !image || !image.lat || !image.lon) return;
    const leaflet = await import('leaflet');
    // add leaflet CSS once
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    await tick();
    map = leaflet.map(mapEl).setView([image.lat, image.lon], 13);
    leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    leaflet.marker([image.lat, image.lon]).addTo(map);
  }

  // After image fetch completed (reactively)
  $: if (image && image.profile_id) {
    fetchProfile(image.profile_id);
  }
  $: if (image && image.lat && image.lon) {
    initMap();
  }

  $: if (image && image.keywords) {
    if (Array.isArray(image.keywords)) {
      keywordsList = image.keywords as string[];
    } else if (typeof image.keywords === 'string') {
      keywordsList = image.keywords.split(',').map((k: string) => k.trim()).filter(Boolean);
    } else {
      keywordsList = [];
    }
  }

  function copyLink() {
    if (browser) {
      navigator.clipboard.writeText(window.location.href);
      alert('Link kopiert!');
    }
  }

  function formatFileSize(bytes: number): string {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return mb.toFixed(1).replace('.', ',') + ' MB';
  }

  function formatExposureTime(value: any): string {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') {
      return value.includes('/') ? value + ' s' : value + ' s';
    }
    if (typeof value === 'number') {
      if (value >= 1) return value + ' s';
      const denom = Math.round(1 / value);
      return `1/${denom} s`;
    }
    return String(value);
  }

  function startEditTitle() {
    if (currentUser && image && image.profile_id === currentUser.id) {
      editingTitle = true;
      titleEditValue = image.title || '';
              // Focus the input after it's rendered with longer delay for mobile
        setTimeout(() => {
          const input = document.getElementById('title-edit-input') as HTMLInputElement;
          if (input) {
            input.focus();
            input.select();
            // Force mobile keyboard to appear
            input.click();
          }
        }, 100);
    }
  }

  async function saveTitle() {
    if (!editingTitle || !currentUser || !image || image.profile_id !== currentUser.id) return;
    
    const newTitle = titleEditValue.trim();
    if (newTitle.length > 60) return; // Don't save if too long
    
    try {
      const { error: updateError } = await supabase
        .from('images')
        .update({ title: newTitle })
        .eq('id', image.id);
      
      if (updateError) {
        console.error('Error updating title:', updateError);
        return;
      }
      
      // Update local state
      image.title = newTitle;
      editingTitle = false;
    } catch (err) {
      console.error('Failed to save title:', err);
    }
  }

  function cancelEditTitle() {
    editingTitle = false;
    titleEditValue = image.title || '';
  }

  function handleTitleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveTitle();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelEditTitle();
    }
  }

  function startEditDescription() {
    if (currentUser && image && image.profile_id === currentUser.id) {
      editingDescription = true;
      descriptionEditValue = image.description || '';
      // Focus the input after it's rendered with longer delay for mobile
      setTimeout(() => {
        const input = document.getElementById('description-edit-input') as HTMLTextAreaElement;
        if (input) {
          input.focus();
          input.select();
          // Force mobile keyboard to appear
          input.click();
        }
      }, 100);
    }
  }

  async function saveDescription() {
    if (!editingDescription || !currentUser || !image || image.profile_id !== currentUser.id) return;
    
    const newDescription = descriptionEditValue.trim();
    if (newDescription.length > 160) return; // Don't save if too long
    
    try {
      const { error: updateError } = await supabase
        .from('images')
        .update({ description: newDescription })
        .eq('id', image.id);
      
      if (updateError) {
        console.error('Error updating description:', updateError);
        return;
      }
      
      // Update local state
      image.description = newDescription;
      editingDescription = false;
    } catch (err) {
      console.error('Failed to save description:', err);
    }
  }

  function cancelEditDescription() {
    editingDescription = false;
    descriptionEditValue = image.description || '';
  }

  function handleDescriptionKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveDescription();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelEditDescription();
    }
  }

  // Check if user is the creator
  $: isCreator = currentUser && image && image.profile_id === currentUser.id;

  function formatRadius(meters: number): string {
    if (meters >= 1000) {
      return (meters / 1000).toFixed(1).replace('.', ',') + ' km';
    }
    return meters + ' m';
  }

  if (typeof localStorage !== 'undefined') {
    const savedLayout = localStorage.getItem('galleryLayout');
    useJustifiedLayout = savedLayout === 'justified';
  }

  // Radius speichern, wenn er sich ändert und geladen wurde
  $: if (browser && currentUser && radiusLoaded) {
    localStorage.setItem(`detailRadius_${currentUser.id}`, String(radius));
  }


</script>

<svelte:head>
  <title>{image?.title || image?.original_name || `Image ${image?.id}` || 'Loading...'}</title>
</svelte:head>

<div class="page">
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <span>Lade Bild...</span>
    </div>
  {:else if error}
    <div class="error">❌ Fehler: {error}</div>
  {:else if image}
    <div class="content">
      <!-- Main Image with Passepartout Effect -->
      <div class="passepartout-container" class:dark={$darkMode}>
        <a href="/" class="image-link">
          <img
            src={imageSource}
            alt={image.title || image.original_name || `Image ${image.id}`}
            class="main-image"
          />
        </a>
        
        <!-- Image Information inside Passepartout -->
        <div class="passepartout-info">
          <h1 class="title" class:editable={isCreator} on:click={startEditTitle}>
            {#if editingTitle}
              <div class="title-edit-container">
                <input
                  id="title-edit-input"
                  type="text"
                  bind:value={titleEditValue}
                  maxlength="60"
                  on:keydown={handleTitleKeydown}
                  on:blur={saveTitle}
                  class="title-edit-input"
                  class:valid={titleEditValue.length >= 40}
                  placeholder="Titel eingeben..."
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="sentences"
                  inputmode="text"
                />
                <span class="char-count" class:valid={titleEditValue.length >= 40}>
                  {titleEditValue.length}/60
                </span>
              </div>
            {:else}
              {image.title || image.original_name || `Bild ${image.id.substring(0, 8)}...`}
            {/if}
          </h1>
          
          {#if editingDescription}
            <div class="description-edit-container">
              <textarea
                id="description-edit-input"
                bind:value={descriptionEditValue}
                maxlength="160"
                on:keydown={handleDescriptionKeydown}
                on:blur={saveDescription}
                class="description-edit-input"
                class:valid={descriptionEditValue.length >= 140}
                placeholder="Beschreibung eingeben..."
                rows="3"
                autocomplete="off"
                autocorrect="off"
                autocapitalize="sentences"
                inputmode="text"
              ></textarea>
              <span class="char-count" class:valid={descriptionEditValue.length >= 140}>
                {descriptionEditValue.length}/160
              </span>
            </div>
          {:else}
            <p class="description" class:editable={isCreator} on:click={startEditDescription}>
              {#if image.description}
                {image.description}
              {:else}
                <span class="placeholder">Keine Beschreibung verfügbar</span>
              {/if}
            </p>
          {/if}
        </div>
      </div>

      <!-- Image Information -->
      <div class="info-section">
        <div class="centered-content">
          
          {#if image.lat && image.lon}
            <div class="action-buttons">
              <a class="gmaps-btn" href={`https://www.google.com/maps?q=${image.lat},${image.lon}`} target="_blank" rel="noopener">Google Maps</a>
              <button class="share-btn" on:click={copyLink}>Link kopieren</button>
            </div>
          {/if}

          {#if image.lat && image.lon}
            <div class="radius-control">
              <label for="radius">Radius: {formatRadius(radius)}</label>
              <input id="radius" type="range" min="50" max="5000" step="50" bind:value={radius}>
            </div>
          {/if}

          {#if image.lat && image.lon && nearby.length}
            <div class="edge-to-edge-gallery">
              {#if useJustifiedLayout}
                <div class="justified-wrapper">
                  <Justified
                    items={nearby}
                    gap={2}
                    showDistance={true}
                    userLat={image.lat}
                    userLon={image.lon}
                    getDistanceFromLatLonInMeters={getDistanceForJustified}
                  />
                </div>
              {:else}
                <div class="grid-layout">
                  {#each nearby as img}
                    <div class="grid-item" on:click={() => window.location.href = `/image/${img.id}` } tabindex="0" role="button" aria-label={`Bild ${img.title || img.id}` }>
                      <img src={img.src} alt={img.title || 'Bild'} />
                      <div class="distance-label">
                        {getDistanceFromLatLonInMeters(image.lat, image.lon, img.lat, img.lon)}
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Meta Section: single column -->
        <div class="meta-section single-exif">
          <!-- Column 1: Creator Card (if available) -->
          <div class="column-card">
            {#if profile}
              {#if profile.avatar_url}
                <img src={profile.avatar_url.startsWith('http') ? profile.avatar_url : `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/avatars/${profile.avatar_url}`} alt="Avatar" class="avatar"/>
              {/if}
              <div class="creator-details">
                <h3>{profile.full_name}</h3>
                <div class="creator-address">
                  {#if profile.show_address && profile.address}
                    <div>{@html profile.address.replace(/\n/g, '<br>')}</div>
                  {/if}
                  {#if profile.show_zip && profile.zip}
                    <span>{profile.zip}</span>
                  {/if}
                  {#if profile.show_city && profile.city}
                    <span> {profile.city}</span>
                  {/if}
                  {#if profile.show_country && profile.country}
                    <div>{profile.country}</div>
                  {/if}
                </div>
              </div>
            {/if}
          </div>
          <!-- Column 2: All EXIF/Meta -->
          <div class="meta-column">
            {#if image.exif_data && image.exif_data.ImageWidth}
              <div class="meta-line">Auflösung: {image.exif_data.ImageWidth}×{image.exif_data.ImageHeight} px</div>
            {/if}
            {#if image.exif_data && image.exif_data.FileSize}
              <div class="meta-line">Dateigröße: {formatFileSize(image.exif_data.FileSize)}</div>
            {/if}
            {#if image.exif_data && image.exif_data.Make}
              <div class="meta-line">Kamera: {image.exif_data.Make} {image.exif_data.Model}</div>
            {/if}
            {#if image.exif_data && image.exif_data.LensModel}
              <div class="meta-line">Objektiv: {image.exif_data.LensModel}</div>
            {/if}
            {#if image.exif_data && image.exif_data.FocalLength}
              <div class="meta-line">Brennweite: {image.exif_data.FocalLength} mm</div>
            {/if}
            {#if image.exif_data && image.exif_data.ISO}
              <div class="meta-line">ISO: {image.exif_data.ISO}</div>
            {/if}
            {#if image.exif_data && image.exif_data.FNumber}
              <div class="meta-line">Blende: ƒ/{image.exif_data.FNumber}</div>
            {/if}
            {#if image.exif_data && image.exif_data.ExposureTime}
              <div class="meta-line">Verschlusszeit: {formatExposureTime(image.exif_data.ExposureTime)}</div>
            {/if}
            {#if image.exif_data && image.exif_data.CreateDate}
              <div class="meta-line">Aufgenommen: {new Date(image.exif_data.CreateDate).toLocaleDateString('de-DE')}</div>
            {/if}
            {#if image.created_at}
              <div class="published-date">Veröffentlicht am: {new Date(image.created_at).toLocaleDateString('de-DE')}</div>
            {/if}
            {#if image.lat && image.lon}
              <div class="meta-line">GPS: {image.lat.toFixed(5)}, {image.lon.toFixed(5)}</div>
            {/if}
            {#if image.exif_data && image.exif_data.Artist}
              <div class="meta-line">Fotograf: {image.exif_data.Artist}</div>
            {/if}
            {#if image.exif_data && image.exif_data.Copyright}
              <div class="meta-line">© {image.exif_data.Copyright}</div>
            {/if}
          </div>
        </div>

        <!-- Location / Sharing Section -->
        <div class="location-section">
          <!-- Coordinates -->
          {#if image.lat && image.lon}
            <div class="coords">📍 {image.lat.toFixed(5)}, {image.lon.toFixed(5)}</div>
          {/if}

          <!-- Keyword chips -->
          {#if keywordsList.length}
            <div class="keywords">
              {#each keywordsList as kw}
                <span class="chip">{kw}</span>
              {/each}
            </div>
          {/if}

          <!-- Map -->
          {#if image.lat && image.lon}
            <div class="map-wrapper">
              <div bind:this={mapEl} class="map"></div>
            </div>
          {/if}
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

  /* Passepartout Effect - Photo in Photo Card */
  .passepartout-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    width: 100%;
    padding: 20px 20px 20px 20px; /* Equal padding top and bottom */
    background: #f5f5f5; /* Light photo card background */
    margin: 0 auto;
  }

  .passepartout-container.dark {
    background: #1a1a1a; /* Dark photo card background */
  }

  .passepartout-info {
    margin-top: 1.5rem;
    text-align: center;
    width: 100%;
  }

  .main-image {
    display: block;
    width: auto;
    height: 800px; /* Fixed height as requested */
    max-width: 100%;
    object-fit: contain;
    border: 1px solid #ffffff; /* White border around the image */
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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

  /* Light mode title styling */
  .passepartout-container:not(.dark) .title {
    color: #4a4a4a; /* Noble gray for light mode */
    font-weight: 700;
  }

  .description {
    font-size: 1rem;
    color: #ccc;
    line-height: 1.6;
    margin: 0 0 2rem 0;
  }

  /* Light mode description styling */
  .passepartout-container:not(.dark) .description {
    color: #6b6b6b; /* Noble gray for light mode */
    font-weight: 500;
  }

  .description.placeholder {
    color: #666;
    font-style: italic;
  }

  /* Light mode placeholder styling */
  .passepartout-container:not(.dark) .description.placeholder {
    color: #999;
    font-style: italic;
  }

  /* Mobile Optimizations */
  @media (max-width: 768px) {
    .passepartout-container {
      padding: 15px 15px 15px 15px; /* Equal padding */
    }

    .passepartout-info {
      margin-top: 1rem;
    }

    .main-image {
      height: 500px;
    }

    .info-section {
      padding: 1.5rem 1rem;
    }

    .title {
      font-size: 1.4rem;
    }
  }

  @media (max-width: 480px) {
    .passepartout-container {
      padding: 10px 10px 10px 10px; /* Equal padding */
    }

    .passepartout-info {
      margin-top: 0.75rem;
    }

    .main-image {
      height: 400px;
    }

    .info-section {
      padding: 1rem 0.75rem;
    }

    .title {
      font-size: 1.2rem;
    }
  }

  /* Additional styles for new sections */
  .location-section {
    padding: 1.5rem;
    background: #0f1419;
    border-top: 1px solid #2d2d44;
  }
  .action-buttons {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-top: 1rem;
  }
  .gmaps-btn,
  .share-btn {
    background: #0066cc;
    color: #fff;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    font-size: 0.9rem;
    cursor: pointer;
    text-decoration: none;
  }
  .share-btn { background: #2d2d44; }
  .gmaps-btn:hover,
  .share-btn:hover { opacity: 0.9; }
  .coords { color: #ccc; margin-bottom: 0.5rem; }
  .keywords { display:flex; flex-wrap:wrap; gap:0.5rem; margin:1rem 0; }
  .chip { background:#1a1a2e; padding:0.25rem 0.75rem; border-radius:999px; font-size:0.8rem; }
  .map-wrapper { height:400px; width:100%; border:1px solid #2d2d44; margin-bottom:1rem; }
  .map { height:100%; width:100%; }
  .image-link {
    display: block;
    width: 100%;
    height: 100%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .centered-content {
    text-align: center;
    margin-bottom: 2rem;
  }
  .radius-control {
    width: 100%;
    margin: 1rem 0;
  }
  .radius-control input[type="range"] {
    width: 100%;
  }
  .published-date {
    color: #aaa;
    font-size: 0.9rem;
    margin-top: 1rem;
  }

  /* Metadata Grid */
  .metadata {
    background: #1a1a2e;
    border-radius: 8px;
    padding: 1.5rem;
    margin-top: 1rem;
  }

  .meta-section.single-exif {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 2rem;
    margin: 2rem 0 1.5rem 0;
    background: #1a1a2e;
    border-radius: 8px;
    padding: 2rem 1.5rem;
    align-items: flex-start;
  }
  .meta-column, .column-card {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .meta-line {
    color: #bbb;
    font-size: 0.85em;
    padding: 0.05em 0;
    word-break: break-word;
  }
  .column-card {
    background: none;
    box-shadow: none;
    padding: 0;
    border-radius: 0;
  }
  .avatar {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    object-fit: cover;
    margin-bottom: 0.5rem;
  }
  @media (max-width: 900px) {
    .meta-section.single-exif {
      grid-template-columns: 1fr;
      padding: 1rem 0.5rem;
    }
  }

  .creator-details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .creator-address {
    margin-bottom: 0.5rem;
    color: #ccc;
    font-size: 0.95em;
    line-height: 1.3;
  }
  .creator-contact {
    margin-bottom: 0.5rem;
    color: #ccc;
    font-size: 0.95em;
    line-height: 1.3;
  }
  .creator-contact a {
    color: #8ecae6;
    text-decoration: none;
    margin-left: 0.2em;
  }
  .creator-contact a:hover {
    text-decoration: underline;
  }
  .creator-socials {
    margin-top: 0.5rem;
    display: flex;
    gap: 0.7em;
    align-items: center;
  }
  .social-link {
    display: inline-flex;
    align-items: center;
    gap: 0.2em;
    color: #8ecae6;
    font-size: 1em;
    text-decoration: none;
    padding: 0.1em 0.3em;
    border-radius: 4px;
    transition: background 0.15s;
  }
  .social-link:hover {
    background: #222b45;
    text-decoration: underline;
  }

  .edge-to-edge-gallery {
    margin-left: calc(-1 * var(--info-section-padding-x, 1.5rem));
    margin-right: calc(-1 * var(--info-section-padding-x, 1.5rem));
    width: calc(100% + 2 * var(--info-section-padding-x, 1.5rem));
  }

  @media (max-width: 768px) {
    .edge-to-edge-gallery {
      margin-left: calc(-1 * var(--info-section-padding-x-mobile, 1rem));
      margin-right: calc(-1 * var(--info-section-padding-x-mobile, 1rem));
      width: calc(100% + 2 * var(--info-section-padding-x-mobile, 1rem));
    }
  }
  @media (max-width: 480px) {
    .edge-to-edge-gallery {
      margin-left: calc(-1 * var(--info-section-padding-x-xs, 0.75rem));
      margin-right: calc(-1 * var(--info-section-padding-x-xs, 0.75rem));
      width: calc(100% + 2 * var(--info-section-padding-x-xs, 0.75rem));
    }
  }

  /* Title editing styles */
  .title.editable {
    cursor: pointer;
    transition: color 0.2s;
  }

  .title.editable:hover {
    color: #ee731f;
  }

  .title-edit-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    justify-content: center;
  }

  .title-edit-input {
    background: #1a1a2e;
    border: 2px solid #2d2d44;
    border-radius: 4px;
    color: white;
    font-size: 1.5rem;
    font-weight: bold;
    padding: 0.5rem;
    text-align: center;
    width: 100%;
    transition: border-color 0.2s;
    /* Mobile optimizations */
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    font-size: 16px; /* Prevents zoom on iOS */
  }

  .title-edit-input:focus {
    outline: none;
    border-color: #8ecae6;
  }

  .title-edit-input.valid {
    border-color: #4ade80;
  }

  .char-count {
    font-size: 0.8rem;
    color: #666;
    min-width: 40px;
    text-align: right;
  }

  .char-count.valid {
    color: #4ade80;
  }

  @media (max-width: 768px) {
    .title-edit-container {
      flex-direction: column;
      gap: 0.25rem;
    }
    
    .title-edit-input {
      font-size: 1.2rem;
    }
  }

  /* Description editing styles */
  .description.editable {
    cursor: pointer;
    transition: color 0.2s;
  }

  .description.editable:hover {
    color: #ee731f;
  }

  .description-edit-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 1rem 0 2rem 0;
  }

  .description-edit-input {
    background: #1a1a2e;
    border: 2px solid #2d2d44;
    border-radius: 4px;
    color: white;
    font-size: 1rem;
    padding: 0.5rem;
    width: 100%;
    min-height: 100px;
    resize: vertical;
    transition: border-color 0.2s;
    /* Mobile optimizations */
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    font-size: 16px; /* Prevents zoom on iOS */
  }

  .description-edit-input:focus {
    outline: none;
    border-color: #8ecae6;
  }

  .description-edit-input.valid {
    border-color: #4ade80;
  }

  /* Grid Layout Styles - Same as main page */
  .grid-layout {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(256px, 1fr));
    gap: 2px;
    width: 100%;
    margin: 0 auto;
    padding: 0;
    background: transparent;
    border: none;
    box-shadow: none;
  }

  /* Mobile responsive grid */
  @media (max-width: 768px) {
    .grid-layout {
      grid-template-columns: repeat(2, 1fr);
      gap: 1px;
    }
  }

  @media (max-width: 480px) {
    .grid-layout {
      grid-template-columns: repeat(2, 1fr);
      gap: 1px;
    }
  }

  .grid-item {
    background: #181828;
    border-radius: 0;
    overflow: hidden;
    transition: box-shadow 0.2s, transform 0.2s;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1/1;
    position: relative;
  }

  /* Mobile optimizations */
  @media (max-width: 768px) {
    .grid-item {
      aspect-ratio: 1/1;
      border-radius: 0;
    }
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

  .distance-label {
    position: absolute;
    left: 12px;
    bottom: 12px;
    background: rgba(24,24,40,0.55);
    backdrop-filter: blur(4px);
    color: #fff;
    font-size: 0.85rem;
    font-weight: 500;
    border-radius: 8px;
    padding: 2px 12px;
    z-index: 2;
    pointer-events: none;
  }

  /* Mobile distance label optimization */
  @media (max-width: 768px) {
    .distance-label {
      font-size: 1rem;
      padding: 4px 16px;
      left: 16px;
      bottom: 16px;
      border-radius: 12px;
    }
  }

  @media (max-width: 480px) {
    .distance-label {
      font-size: 1.1rem;
      padding: 6px 18px;
      left: 20px;
      bottom: 20px;
      border-radius: 14px;
    }
  }

</style> 