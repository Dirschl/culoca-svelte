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
  let showScrollToTop = false;


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

  // Scroll to top functionality
  if (browser) {
    const handleScroll = () => {
      showScrollToTop = window.scrollY > 300;
    };
    
    window.addEventListener('scroll', handleScroll);
  }

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

  function scrollToTop() {
    if (browser) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
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

      <!-- Transition Area with Shadow -->
      <div class="transition-area" class:dark={$darkMode}>
        <div class="shadow-overlay"></div>
        
        <!-- Controls Section -->
        <div class="controls-section">
          {#if image.lat && image.lon}
            <div class="action-buttons">
              <a class="gmaps-btn" href={`https://www.google.com/maps?q=${image.lat},${image.lon}`} target="_blank" rel="noopener">Google Maps</a>
              <button class="share-btn" on:click={copyLink}>Link kopieren</button>
            </div>
          {/if}

          <!-- Radius-Control: Nur Wert, zentriert -->
          {#if image.lat && image.lon}
            <div class="radius-control">
              <div class="radius-value">{formatRadius(radius)}</div>
              <input id="radius" type="range" min="50" max="5000" step="50" bind:value={radius}>
            </div>
          {/if}
        </div>
      </div>

      <!-- Image Information -->
      <div class="info-section">
        <div class="centered-content">

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
                    getDistanceFromLatLonInMeters={getDistanceFromLatLonInMeters}
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

        <!-- Meta Section: three columns -->
        <div class="meta-section single-exif">
          <!-- Column 1: Keywords -->
          <div class="keywords-column">
            <h2>Keywords</h2>
            {#if keywordsList.length}
              <div class="keywords">
                {#each keywordsList as kw}
                  <span class="chip">{kw}</span>
                {/each}
              </div>
            {/if}
            
            <h2>Original Filename</h2>
            <div class="filename">
              {image.original_name || 'Unbekannt'}
            </div>
          </div>
          <!-- Column 2: All EXIF/Meta -->
          <div class="meta-column">
            <h2>Aufnahmedaten</h2>
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
          <!-- Column 3: Creator Card (if available) -->
          <div class="column-card">
            <h2>Ersteller</h2>
            {#if profile}
              {#if profile.avatar_url}
                <img src={profile.avatar_url.startsWith('http') ? profile.avatar_url : `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/avatars/${profile.avatar_url}`} alt="Avatar" class="avatar"/>
              {/if}
              <div class="creator-details">
                <h3>{profile.full_name}</h3>
                
                <!-- Address Information -->
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
                
                <!-- Contact Information -->
                <div class="creator-contact">
                  {#if profile.show_phone && profile.phone}
                    <div>
                      <svg class="contact-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                      </svg>
                      <a href="tel:{profile.phone}">{profile.phone}</a>
                    </div>
                  {/if}
                  {#if profile.show_email && profile.email}
                    <div>
                      <svg class="contact-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                      </svg>
                      <a href="mailto:{profile.email}">{profile.email}</a>
                    </div>
                  {/if}
                  {#if profile.show_website && profile.website}
                    <div>
                      <svg class="contact-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                      </svg>
                      <a href="{profile.website}" target="_blank" rel="noopener noreferrer">{profile.website}</a>
                    </div>
                  {/if}
                </div>
                
                <!-- Social Media -->
                <div class="creator-socials">
                  {#if profile.show_social && profile.instagram}
                    <a href="{profile.instagram}" target="_blank" rel="noopener noreferrer" class="social-link">
                      <svg class="social-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                    </a>
                  {/if}
                  {#if profile.show_social && profile.facebook}
                    <a href="{profile.facebook}" target="_blank" rel="noopener noreferrer" class="social-link">
                      <svg class="social-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    </a>
                  {/if}
                  {#if profile.show_social && profile.twitter}
                    <a href="{profile.twitter}" target="_blank" rel="noopener noreferrer" class="social-link">
                      <svg class="social-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                      </svg>
                    </a>
                  {/if}
                </div>
                
                <!-- Bio/Description -->
                {#if profile.show_bio && profile.bio}
                  <div class="creator-bio">
                    <div>{@html profile.bio.replace(/\n/g, '<br>')}</div>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        </div>

        <!-- Location / Sharing Section -->
        <div class="location-section" style="background: transparent;">
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

  <!-- Scroll to Top Button -->
  {#if showScrollToTop}
    <button class="scroll-to-top" on:click={scrollToTop} aria-label="Nach oben scrollen">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
      </svg>
    </button>
  {/if}
</div>

<style>
  /* Night Blue Theme - Same as main page */
  :global(html, body) {
    background: var(--bg-primary);
    color: var(--text-primary);
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
    background: var(--bg-primary);
    color: var(--text-primary);
    min-height: 100vh;
    padding: 0;
    overflow-x: hidden;
  }

  /* Loading & Error States */
  .loading, .error {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    min-height: 400px;
    color: #ccc;
    background: transparent;
  }

  .error {
    color: #ff6b6b;
    background: transparent;
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #2d2d44;
    border-top: 2px solid #0066cc;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    background: transparent;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Main Content */
  .content {
    padding: 0;
    background: transparent;
  }

  /* Passepartout Effect - Photo in Photo Card */
  .passepartout-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    width: 100%;
    padding: 12px 12px 12px 12px;
    background: #f5f5f5;
    margin: 0 auto;
    overflow: hidden;
  }

  .passepartout-container.dark {
    background: #1a1a1a; /* Dark photo card background */
    overflow: hidden;
  }

  .passepartout-info {
    margin-top: 1.5rem;
    text-align: center;
    width: 100%;
    padding: 0.7rem 0.5rem 0.5rem 0.5rem;
    background: transparent;
  }

  .main-image {
    display: block;
    width: auto;
    max-height: 800px; /* Max height for all resolutions */
    max-width: 100%;
    object-fit: contain;
    border: 1px solid #ffffff; /* White border around the image */
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    background: transparent;
  }

  /* Info Section */
  .info-section {
    background: var(--bg-primary);
    color: var(--text-primary);
    margin-top: 0;
    padding: 0;
  }

  .title {
    font-size: 1.8rem;
    font-weight: 600;
    color: white;
    margin: 0 0 1rem 0;
    line-height: 1.3;
    background: transparent;
  }

  /* Light mode title styling */
  .passepartout-container:not(.dark) .title {
    color: #4a4a4a; /* Noble gray for light mode */
    font-weight: 700;
    background: transparent;
  }

  .description {
    font-size: 1rem;
    color: #ccc;
    line-height: 1.6;
    margin: 0 0 0.5rem 0;
    background: transparent;
  }

  /* Light mode description styling */
  .passepartout-container:not(.dark) .description {
    color: #6b6b6b; /* Noble gray for light mode */
    font-weight: 500;
    background: transparent;
  }

  .description.placeholder {
    color: #666;
    font-style: italic;
    background: transparent;
  }

  /* Light mode placeholder styling */
  .passepartout-container:not(.dark) .description.placeholder {
    color: #999;
    font-style: italic;
    background: transparent;
  }



  @media (max-width: 480px) {
    .passepartout-container {
      padding: 0; /* Randlos */
    }

    .passepartout-info {
      margin-top: 0.75rem;
      padding: 0 0.75rem; /* Padding nur für den Inhalt */
    }

    /* Randlose Darstellung für Justified und Grid */
    .info-section .edge-to-edge-gallery,
    .info-section .justified-wrapper,
    .info-section .grid-layout {
      margin-left: -0.75rem;
      margin-right: -0.75rem;
      width: calc(100% + 1.5rem);
    }

    .title {
      font-size: 1.2rem;
    }
  }

  /* Transition Area with Shadow */
  .transition-area {
    position: relative;
    background: var(--bg-secondary);
    padding: 1rem 0.5rem;
    margin-top: -2px;
    overflow: hidden;
  }

  .transition-area.dark {
    background: #18181b;
  }

  .shadow-overlay {
    position: absolute;
    top: -12px;
    left: 0;
    right: 0;
    height: 12px;
    background: linear-gradient(to bottom, rgba(0,0,0,0.12) 0%, transparent 100%);
    pointer-events: none;
  }

  .transition-area.dark .shadow-overlay {
    background: linear-gradient(to bottom, rgba(0,0,0,0.22) 0%, transparent 100%);
  }

  .controls-section {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.7rem;
    margin-bottom: 0.2rem;
    background: transparent;
  }

  .action-buttons {
    display: flex;
    gap: 0.7rem;
    justify-content: center;
    margin-top: 0;
    margin-bottom: 0.2rem;
    background: transparent;
  }
  .gmaps-btn,
  .share-btn {
    background: var(--accent-color);
    color: #fff;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    font-size: 0.9rem;
    cursor: pointer;
    text-decoration: none;
    transition: background-color 0.2s ease;
  }
  .share-btn { 
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  .gmaps-btn:hover {
    background: var(--accent-hover);
  }
  .share-btn:hover { 
    background: var(--border-color);
  }
  .coords { color: var(--text-secondary); margin-bottom: 0.5rem; background: transparent; }
  .keywords { display:flex; flex-wrap:wrap; gap:0.5rem; margin:0 0 2rem; background: transparent; }
  .chip { 
    background: var(--bg-tertiary); 
    padding: 0.25rem 0.75rem; 
    border-radius: 999px; 
    font-size: 0.8rem; 
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
  }
  .map-wrapper { height:400px; width:100%; border:1px solid var(--border-color); margin-bottom:1rem; background: transparent; }
  .map { height:100%; width:100%; background: transparent; }
  .image-link {
    display: block;
    width: 100%;
    height: 100%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
  }
  .centered-content {
    text-align: center;
    margin-bottom: 2rem;
    background: transparent;
    padding: 0;
  }
  .radius-control {
    width: 100%;
    margin: 0.2rem 0 0.1rem 0;
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
  .radius-control input[type="range"] {
    width: 100%;
    background: transparent;
  }
  .published-date {
    color: var(--text-muted);
    font-size: 0.9rem;
    margin-top: 1rem;
    background: transparent;
  }

  /* Metadata Grid */
  .metadata {
    background: var(--bg-tertiary);
    border-radius: 0;
    padding: 1.5rem;
    margin-top: 1rem;
    overflow: hidden;
  }

  .meta-section.single-exif {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    gap: 2rem;
    margin: 2rem 0 1.5rem 0;
    background: transparent;
    border-radius: 0;
    padding: 1rem;
    align-items: flex-start;
    overflow: hidden;
  }
  .meta-column, .column-card, .keywords-column {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    background: transparent;
  }

  .meta-column h2, .column-card h2, .keywords-column h2 {
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 1rem 0;
    padding: 0;
  }

  .filename {
    color: var(--text-secondary);
    font-size: 0.9rem;
    font-family: 'Courier New', monospace;
    word-break: break-all;
  }
  .meta-line {
    color: var(--text-secondary);
    font-size: 0.85em;
    padding: 0.05em 0;
    word-break: break-word;
    background: transparent;
  }
  .column-card {
    background: transparent;
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
    background: transparent;
  }
  @media (max-width: 900px) {
    .meta-section.single-exif {
      grid-template-columns: 1fr;
      padding: 1rem 0.5rem;
      gap: 1.5rem;
    }
    
    .keywords-column, .meta-column, .column-card {
      text-align: center;
    }
    
    .keywords {
      justify-content: center;
    }
    
    .avatar {
      margin: 0 auto 0.5rem auto;
    }
  }

  @media (max-width: 1200px) {
    .meta-section.single-exif {
      grid-template-columns: 1fr;
      gap: 2rem;
    }
    
    .keywords-column, .meta-column, .column-card {
      text-align: center;
    }
    
    .keywords {
      justify-content: center;
    }
    
    .avatar {
      margin: 0 auto 0.5rem auto;
    }
  }

  .creator-details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: transparent;
  }
  .creator-address {
    margin-bottom: 0.5rem;
    color: var(--text-secondary);
    font-size: 0.95em;
    line-height: 1.3;
    background: transparent;
  }
  .creator-contact {
    margin-bottom: 0.5rem;
    color: var(--text-secondary);
    font-size: 0.95em;
    line-height: 1.3;
    background: transparent;
  }
  .creator-contact {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .creator-contact > div {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .contact-icon {
    width: 16px;
    height: 16px;
    color: var(--text-secondary);
    flex-shrink: 0;
  }
  
  .creator-contact a {
    color: var(--text-secondary);
    text-decoration: none;
  }
  .creator-contact a:hover {
    color: var(--accent-color);
    text-decoration: underline;
  }
  
  .creator-bio {
    margin-top: 0.5rem;
    color: var(--text-secondary);
    font-size: 0.9em;
    line-height: 1.4;
    background: transparent;
  }
  .creator-socials {
    margin-top: 0.5rem;
    display: flex;
    gap: 0.5rem;
    align-items: center;
    background: transparent;
  }
  .social-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    color: var(--text-secondary);
    text-decoration: none;
    border-radius: 4px;
    transition: all 0.2s ease;
    background: transparent;
  }
  .social-icon {
    width: 20px;
    height: 20px;
    color: var(--text-secondary);
  }
  .social-link:hover {
    background: var(--bg-tertiary);
    transform: scale(1.1);
  }
  .social-link:hover .social-icon {
    color: var(--accent-color);
  }

  /* Scroll to Top Button */
  .scroll-to-top {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    width: 48px;
    height: 48px;
    background: var(--accent-color);
    color: white;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    transition: all 0.3s ease;
    z-index: 1000;
    opacity: 0;
    transform: translateY(20px);
    animation: fadeInUp 0.3s ease forwards;
  }

  .scroll-to-top:hover {
    background: var(--accent-hover);
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
  }

  .scroll-to-top svg {
    width: 24px;
    height: 24px;
  }

  @keyframes fadeInUp {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 768px) {
    .scroll-to-top {
      bottom: 1rem;
      right: 1rem;
      width: 44px;
      height: 44px;
    }
    
    .scroll-to-top svg {
      width: 20px;
      height: 20px;
    }
  }

  .edge-to-edge-gallery {
    width: 100%;
    margin: 0 auto;
  }

  .justified-wrapper {
    width: 100%;
    margin: 0;
    padding: 0;
    background: transparent;
    border: none;
    box-shadow: none;
  }

  @media (max-width: 768px) {
    .edge-to-edge-gallery {
      width: 100%;
      margin: 0 auto;
    }
  }
  @media (max-width: 480px) {
    .edge-to-edge-gallery {
      width: 100%;
      margin: 0 auto;
    }
  }

  /* Title editing styles */
  .title.editable {
    cursor: pointer;
    transition: color 0.2s;
    background: transparent;
  }

  .title.editable:hover {
    color: #ee731f;
    background: transparent;
  }

  .title-edit-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    justify-content: center;
    background: transparent;
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
    background: transparent;
  }

  .title-edit-input.valid {
    border-color: #4ade80;
    background: transparent;
  }

  .char-count {
    font-size: 0.8rem;
    color: #666;
    min-width: 40px;
    text-align: right;
    background: transparent;
  }

  .char-count.valid {
    color: #4ade80;
    background: transparent;
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
    background: transparent;
  }

  .description.editable:hover {
    color: #ee731f;
    background: transparent;
  }

  .description-edit-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 1rem 0 2rem 0;
    background: transparent;
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
    background: transparent;
  }

  .description-edit-input.valid {
    border-color: #4ade80;
    background: transparent;
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
    overflow: hidden;
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

  /* Light/Dark Mode Background Colors for Justified and Grid */
  .edge-to-edge-gallery {
    background: var(--bg-primary);
  }

  .justified-wrapper {
    background: var(--bg-primary);
  }

  .grid-layout {
    background: var(--bg-primary);
  }

  /* Dark mode specific overrides */
  .passepartout-container.dark .edge-to-edge-gallery,
  .passepartout-container.dark .justified-wrapper,
  .passepartout-container.dark .grid-layout {
    background: var(--bg-primary);
  }

  /* Light mode specific overrides */
  .passepartout-container:not(.dark) .edge-to-edge-gallery,
  .passepartout-container:not(.dark) .justified-wrapper,
  .passepartout-container:not(.dark) .grid-layout {
    background: var(--bg-primary);
  }

</style> 