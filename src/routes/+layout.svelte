<script lang="ts">
  import '../app.css';
  import { darkMode } from '$lib/darkMode';
  import { onMount } from 'svelte';
  import { sessionStore } from '$lib/sessionStore';
  import { supabase } from '$lib/supabaseClient';
  import { sessionReady } from '$lib/sessionStore';

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
    
    // OAuth-Redirect: Tokens aus URL-Fragment übernehmen
    let oAuthHandled = false;
    if (typeof window !== 'undefined' && window.location.hash && window.location.hash.includes('access_token')) {
      const params = new URLSearchParams(window.location.hash.substring(1));
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (access_token && refresh_token) {
        console.log('🔐 OAuth tokens found, setting session...');
        supabase.auth.setSession({ access_token, refresh_token }).then(() => {
          window.location.hash = '';
          oAuthHandled = true;
          console.log('✅ Supabase session from OAuth fragment gesetzt');
          window.location.reload(); // Seite neu laden, damit Session sofort aktiv ist
        });
        return; // Verhindere, dass der Rest des Codes ausgeführt wird, bevor reload
      }
    }
    
    // Initialize session store safely
    try {
      sessionStore.init();
      console.log('✅ Session store initialized');
    } catch (error) {
      console.error('❌ Failed to initialize session store:', error);
    }
    
    // Set up authentication listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth state change:', event, session?.user?.id);
      try {
        if (session?.user) {
          // User is logged in
          sessionStore.setUser(session.user.id, true);
          console.log('🔐 User authenticated:', session.user.id);
        } else {
          // User is logged out
          sessionStore.setUser(null, false);
          console.log('🔓 User logged out');
        }
      } catch (error) {
        console.error('❌ Failed to update session store:', error);
      }
    });

    // Check current session on mount with proper OAuth handling
    const sessionCheckPromise = supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('📋 Session check result:', session?.user?.id || 'no session');
      try {
        if (session?.user) {
          sessionStore.setUser(session.user.id, true);
          console.log('✅ Session found and set:', session.user.id);
        } else {
          console.log('ℹ️ No active session found');
        }
      } catch (error) {
        console.error('❌ Failed to check session:', error);
      }
    }).catch((error) => {
      console.error('❌ Failed to get session:', error);
    });

    // If OAuth was handled, wait a bit longer for the session to be properly set
    const timeoutDuration = oAuthHandled ? 5000 : 2000;
    
    // Set a timeout to ensure sessionReady is set even if session check fails
    const timeoutPromise = new Promise(resolve => {
      setTimeout(() => {
        console.log(`⏰ Session initialization timeout reached (${timeoutDuration}ms)`);
        resolve(null);
      }, timeoutDuration);
    });

    // Wait for either session check to complete or timeout
    Promise.race([sessionCheckPromise, timeoutPromise]).then(() => {
      console.log('✅ Session initialization complete, setting sessionReady to true');
      sessionReady.set(true);
    }).catch((error) => {
      console.error('❌ Session initialization failed:', error);
      sessionReady.set(true); // Still set to true to prevent infinite loading
    });
    
    // FALLBACK: Set sessionReady to true after timeout regardless
    setTimeout(() => {
      console.log('⚠️ FALLBACK: Setting sessionReady to true after timeout');
      sessionReady.set(true);
    }, timeoutDuration + 1000);
    
    // Service Worker registrieren für bessere Cache-Kontrolle (temporarily disabled)
    // if ('serviceWorker' in navigator) {
    //   navigator.serviceWorker.register('/sw.js').then((registration) => {
    //     console.log('Service Worker registered:', registration);
    //     
    //     // Handle Service Worker Updates
    //     registration.addEventListener('updatefound', () => {
    //       const newWorker = registration.installing;
    //       if (newWorker) {
    //         newWorker.addEventListener('statechange', () => {
    //           if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
    //             console.log('New Service Worker available, consider refreshing');
    //           }
    //         });
    //       }
    //     });
    //   }).catch((error) => {
    //     console.log('Service Worker registration failed:', error);
    //   });
    // }

    // Cleanup subscription on component destroy
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
