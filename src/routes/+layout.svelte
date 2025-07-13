<script lang="ts">
  import '../app.css';
  import { darkMode } from '$lib/darkMode';
  import { onMount } from 'svelte';
  import { sessionStore } from '$lib/sessionStore';
  import { supabase } from '$lib/supabaseClient';
  import { sessionReady } from '$lib/sessionStore';
  import { browser } from '$app/environment';

  // Apply dark mode class to document
  $: if (typeof document !== 'undefined') {
    if ($darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  onMount(() => {
    console.log('🚀 Layout mounted, starting session initialization...');
    
    // Initialize session store
    try {
      sessionStore.init();
      console.log('✅ Session store initialized');
    } catch (error) {
      console.error('❌ Failed to initialize session store:', error);
    }
    
    // Handle OAuth redirect tokens
    if (typeof window !== 'undefined' && window.location.hash && window.location.hash.includes('access_token')) {
      const params = new URLSearchParams(window.location.hash.substring(1));
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (access_token && refresh_token) {
        console.log('🔐 OAuth tokens found, setting session...');
        supabase.auth.setSession({ access_token, refresh_token }).then(() => {
          window.location.hash = '';
          console.log('✅ Supabase session from OAuth fragment set');
        }).catch((error) => {
          console.error('❌ Failed to set OAuth session:', error);
        });
      }
    }
    
    // Set up authentication listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth state change:', event, session?.user?.id);
      try {
        if (session?.user) {
          sessionStore.setUser(session.user.id, true);
          console.log('🔐 User authenticated:', session.user.id);
        } else {
          sessionStore.setUser(null, false);
          console.log('🔓 User logged out');
        }
      } catch (error) {
        console.error('❌ Failed to update session store:', error);
      }
    });

    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('📋 Session check result:', session?.user?.id || 'no session');
      
      if (session?.user) {
        sessionStore.setUser(session.user.id, true);
        console.log('✅ Session found and set:', session.user.id);
      } else {
        console.log('ℹ️ No active session found');
      }
    }).catch((error) => {
      console.error('❌ Failed to check session:', error);
    });

    // Set session ready after a short delay
    setTimeout(() => {
      console.log('✅ Setting sessionReady to true');
      sessionReady.set(true);
    }, 1000);

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  });
</script>

<svelte:head>
  <title>Culoca - Deine Bilder auf der Karte</title>
  <meta name="description" content="Teile deine Bilder mit GPS-Koordinaten auf einer interaktiven Karte. Culoca macht es einfach, deine Erinnerungen zu organisieren und zu teilen." />
  <meta name="keywords" content="Bilder, Karte, GPS, Fotografie, Teilen, Erinnerungen" />
  <meta name="author" content="Culoca" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta charset="UTF-8" />
  <link rel="icon" type="image/png" href="/culoca-icon.png" />
</svelte:head>

{#if $sessionReady}
  <div class="app">
    <slot />
  </div>
{:else}
  <div class="loading-spinner">Lade...</div>
{/if}

<style>
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
</style>
