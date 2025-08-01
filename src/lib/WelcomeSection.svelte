<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import WelcomeEditor from '$lib/WelcomeEditor.svelte';
  import { welcomeVisible, hideWelcome, dismissWelcome, isWelcomeDismissed } from '$lib/welcomeStore';
  import { sessionStore } from '$lib/sessionStore';
  import { get } from 'svelte/store';

  const CREATOR_ID = '0ceb2320-0553-463b-971a-a0eef5ecdf09';

  let mounted = false;
  let showEditor = false;
  let welcomeContent: any = {};
  let userName = '';
  let currentUserId = '';
  let isLoggedIn = false;

  onMount(() => {
    mounted = true;
    loadWelcomeContent();
  });

  // Subscribe to session changes
  $: {
    const session = get(sessionStore);
    isLoggedIn = session.isAuthenticated;
    currentUserId = session.userId || '';
    userName = session.user?.user_metadata?.name || session.user?.user_metadata?.full_name || 'Fotograf';
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

{#if $welcomeVisible && !isWelcomeDismissed() && mounted}
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
      <div class="welcome-grid">
        <div class="welcome-column">
          <h3>{@html (welcomeContent.greeting?.title || 'Hallo {userName}! 👋').replace('{userName}', userName)}</h3>
          {#if welcomeContent.greeting?.content}
            <div class="dynamic-content">{@html welcomeContent.greeting.content.replace('{userName}', userName)}</div>
          {:else}
            <p>Willkommen bei <strong>Culoca</strong> – deiner GPS-basierten Foto-Community!</p>
            <p class="beta-notice">Du nutzt die <span class="beta-badge">Beta-Version</span>. Wir haben viele Ideen, lass dich überraschen! 🚀</p>
          {/if}
        </div>
        <div class="welcome-column">
          <h3>{@html (welcomeContent.gps?.title || 'GPS zeigt dir was du willst').replace('{userName}', userName)}</h3>
          {#if welcomeContent.gps?.content}
            <div class="dynamic-content">{@html welcomeContent.gps.content.replace('{userName}', userName)}</div>
          {:else}
            <p>Entdecke <strong>Fotos genau dort</strong>, wo du gerade bist oder hinfahren möchtest.</p>
            <p>Deine Kamera kennt bereits jeden Ort – wir machen ihn für andere sichtbar.</p>
          {/if}
        </div>
        <div class="welcome-column">
          <h3>{@html (welcomeContent.discover?.title || 'Entdecke deine Region').replace('{userName}', userName)}</h3>
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
    padding: 1.5rem 1rem;
    box-shadow: 0 4px 20px var(--shadow);
    animation: slideDown 0.5s ease-out;
    border-bottom: 2px solid var(--bg-primary);
  }

  .welcome-content {
    max-width: 1200px;
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
    text-align: center;
  }

  .welcome-column h3 {
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

    .welcome-grid {
      grid-template-columns: 1fr;
      gap: 2rem;
    }

    .welcome-footer {
      flex-direction: column;
      gap: 1rem;
      text-align: center;
    }

    .welcome-column h3 {
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





    .welcome-column h3 {
      font-size: 1.1rem;
    }

    .welcome-column p {
      font-size: 0.85rem;
    }
  }
</style> 