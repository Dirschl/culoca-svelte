<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import WelcomeEditor from '$lib/WelcomeEditor.svelte';
  import { welcomeVisible, hideWelcome, dismissWelcome, isWelcomeDismissed } from '$lib/welcomeStore';
  import { sessionStore } from '$lib/sessionStore';
  import { get } from 'svelte/store';

  const CREATOR_ID = '0ceb2320-0553-463b-971a-a0eef5ecdf09';

  // Props from server-side load
  export let initialWelcomeContent: any = {};
  export let featuredItems: any[] = [];

  let mounted = false;
  let showEditor = false;
  let welcomeContent: any = {};
  let userName = '';
  let currentUserId = '';
  let isLoggedIn = false;

  // Initialize with server-side data if available
  $: if (initialWelcomeContent && Object.keys(initialWelcomeContent).length > 0) {
    welcomeContent = initialWelcomeContent;
    console.log('[WelcomeSection] Using server-side content:', welcomeContent);
  }
  
  // Debug featured items
  $: console.log('[WelcomeSection] Featured items:', featuredItems);

  onMount(() => {
    mounted = true;
    // Only load from client if no server data was provided
    if (!initialWelcomeContent || Object.keys(initialWelcomeContent).length === 0) {
      console.log('[WelcomeSection] No server data, loading from client');
      loadWelcomeContent();
    }
  });

  // Subscribe to session changes
  $: {
    const session = get(sessionStore);
    isLoggedIn = session.isAuthenticated;
    currentUserId = session.userId || '';
    userName = session.user?.user_metadata?.name || session.user?.user_metadata?.full_name || '';
  }

  async function loadWelcomeContent() {
    try {
      const { data, error } = await supabase
        .from('welcome_content')
        .select('*')
        .eq('is_active', true)
        .order('id');
      if (error) throw error;
      const content = data || [];
      welcomeContent = {
        greeting: content.find(item => item.section_key === 'greeting'),
        gps: content.find(item => item.section_key === 'gps_feature'),
        discover: content.find(item => item.section_key === 'discover')
      };
    } catch (error) {
      console.error('Error loading welcome content:', error);
    }
  }

  function handleEditorSave() {
    loadWelcomeContent(); // Reload content after save
  }
</script>

{#if $welcomeVisible && !isWelcomeDismissed()}
  <div class="welcome-section">
    <div class="welcome-content">
      <!-- Edit Button for Creator -->
      {#if currentUserId === CREATOR_ID}
        <button class="edit-btn" on:click={() => showEditor = true} title="Welcome Section bearbeiten">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
          </svg>
          Bearbeiten
        </button>
      {/if}
      
      <!-- H1 für SEO -->
      <h1 class="main-heading">Entdecke deine Umgebung mit GPS & Fotos</h1>
      
      <!-- Debug -->
      <p style="color: white; font-size: 0.8rem;">Debug: {featuredItems?.length || 0} featured items</p>
      
      {#if featuredItems && featuredItems.length > 0}
        <p class="featured-intro">Entdecke zufällige Locations und teile was dir gefällt</p>
        <div class="featured-items">
          {#each featuredItems as item}
            <a href={`/item/${item.slug}`} class="featured-item">
              <div class="featured-image">
                <img 
                  src={`https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048-og/${item.path_2048_og}`}
                  alt={item.title}
                  loading="lazy"
                />
              </div>
              <div class="featured-content">
                <div class="featured-header">
                  <svg class="featured-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  <h3 class="featured-title">{item.title}</h3>
                </div>
                {#if item.description}
                  <p class="featured-description">{item.description.substring(0, 120)}{item.description.length > 120 ? '...' : ''}</p>
                {/if}
              </div>
            </a>
          {/each}
        </div>
      {/if}
      
      <div class="welcome-grid">
        <div class="welcome-column">
          <h2>{@html (welcomeContent.greeting?.title || 'Hallo {userName}! 👋').replace('{userName}', userName)}</h2>
          {#if welcomeContent.greeting?.content}
            <div class="dynamic-content">{@html welcomeContent.greeting.content.replace('{userName}', userName)}</div>
          {:else}
            <p>Willkommen bei <strong>Culoca</strong> – deiner GPS-basierten Foto-Community!</p>
            <p class="beta-notice">Du nutzt die <span class="beta-badge">Beta-Version</span>. Wir haben viele Ideen, lass dich überraschen! 🚀</p>
          {/if}
        </div>
        <div class="welcome-column">
          <h2>{@html (welcomeContent.gps?.title || 'GPS zeigt dir was du willst').replace('{userName}', userName)}</h2>
          {#if welcomeContent.gps?.content}
            <div class="dynamic-content">{@html welcomeContent.gps.content.replace('{userName}', userName)}</div>
          {:else}
            <p>Entdecke <strong>Fotos genau dort</strong>, wo du gerade bist oder hinfahren möchtest.</p>
            <p>Deine Kamera kennt bereits jeden Ort – wir machen ihn für andere sichtbar.</p>
          {/if}
        </div>
        <div class="welcome-column">
          <h2>{@html (welcomeContent.discover?.title || 'Entdecke deine Region').replace('{userName}', userName)}</h2>
          {#if welcomeContent.discover?.content}
            <div class="dynamic-content">{@html welcomeContent.discover.content.replace('{userName}', userName)}</div>
          {:else}
            <p>Sieh deine Umgebung mit <strong>neuen Augen</strong>. Versteckte Schätze, bekannte Orte, unentdeckte Perspektiven.</p>
            <p>Teile deine schönsten Momente und inspiriere andere Fotografen.</p>
          {/if}
        </div>
      </div>
      <div class="welcome-footer">
        <label class="dont-show-again">
          <input type="checkbox" on:change={dismissWelcome} />
          <span>Nicht mehr anzeigen</span>
        </label>
      </div>
    </div>
  </div>
{/if}

<!-- Welcome Editor (Creator only) -->
{#if currentUserId === CREATOR_ID}
  <WelcomeEditor
    visible={showEditor}
    onClose={() => showEditor = false}
    onSave={handleEditorSave}
  />
{/if}

<style>
  .welcome-section {
    position: static;
    background: #4b5563;
    color: white;
    padding: 1.5rem 2rem;
    box-shadow: 0 4px 20px var(--shadow);
    animation: slideDown 0.5s ease-out;
    border-bottom: 2px solid var(--bg-primary);
  }

  .welcome-content {
    max-width: 100%;
    margin: 0 auto;
    position: relative;
  }

  .edit-btn {
    position: absolute;
    top: -0.5rem;
    right: 0;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.8rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s ease;
    z-index: 10;
  }

  .edit-btn:hover {
    background: rgba(0, 0, 0, 0.9);
    transform: translateY(-1px);
  }

  .dynamic-content {
    font-size: 0.95rem;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.95);
  }

  .dynamic-content p {
    margin: 0 0 0.75rem 0;
  }

  .dynamic-content p:last-child {
    margin-bottom: 0;
  }



  .welcome-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2rem;
    margin-bottom: 1.5rem;
  }

  .welcome-column {
    /* text-align: center; */
  }

  .main-heading {
    font-size: 2rem;
    font-weight: 800;
    margin: 0 0 1rem 0;
    color: white;
    text-align: center;
  }

  .featured-intro {
    text-align: center;
    font-size: 1.1rem;
    color: rgba(255, 255, 255, 0.9);
    margin: 0 0 1.5rem 0;
  }

  .featured-items {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .featured-item {
    display: flex;
    flex-direction: column;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    overflow: hidden;
    text-decoration: none;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .featured-item:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .featured-image {
    width: 100%;
    aspect-ratio: 1200/630;
    overflow: hidden;
    background: #222;
  }

  .featured-image img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: #222;
  }

  .featured-content {
    padding: 1rem;
    color: white;
  }

  .featured-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .featured-icon {
    flex-shrink: 0;
    color: #ee7221;
  }

  .featured-title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
    color: white;
    flex: 1;
  }

  .featured-description {
    font-size: 0.85rem;
    line-height: 1.4;
    color: rgba(255, 255, 255, 0.85);
    margin: 0;
  }

  .welcome-column h2 {
    font-size: 1.4rem;
    font-weight: 700;
    margin: 0 0 0.75rem 0;
    color: white;
  }

  .welcome-column p {
    font-size: 0.95rem;
    line-height: 1.5;
    margin: 0 0 0.75rem 0;
    color: rgba(255, 255, 255, 0.95);
  }

  .beta-notice {
    font-size: 0.9rem !important;
    color: rgba(255, 255, 255, 0.8) !important;
  }

  .beta-badge {
    background: rgba(255, 255, 255, 0.2);
    padding: 0.2rem 0.5rem;
    border-radius: 12px;
    font-weight: 600;
    font-size: 0.8rem;
  }

  .welcome-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    padding-top: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
  }

  .dont-show-again {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.9rem;
  }

  .dont-show-again input[type="checkbox"] {
    margin: 0;
    transform: scale(1.2);
  }



  @keyframes slideDown {
    from {
      transform: translateY(-100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  /* Mobile responsiveness */
  @media (max-width: 768px) {
    .welcome-section {
      padding: 1.5rem 1rem;
    }

    .featured-items {
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .welcome-grid {
      grid-template-columns: 1fr;
      gap: 2rem;
    }

    .welcome-footer {
      flex-direction: column;
      gap: 1rem;
      text-align: center;
    }

    .main-heading {
      font-size: 1.5rem;
    }

    .welcome-column h2 {
      font-size: 1.2rem;
    }

    .welcome-column p {
      font-size: 0.9rem;
    }
  }

  @media (max-width: 480px) {
    .welcome-section {
      padding: 1rem 0.75rem;
    }





    .main-heading {
      font-size: 1.3rem;
    }

    .welcome-column h2 {
      font-size: 1.1rem;
    }

    .welcome-column p {
      font-size: 0.85rem;
    }
  }
</style> 