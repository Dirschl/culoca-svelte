<script lang="ts">
  import '../app.css';
  import { darkMode } from '$lib/darkMode';
  import { onMount } from 'svelte';
  import { sessionStore } from '$lib/sessionStore';
  import { supabase } from '$lib/supabaseClient';

  // Apply dark mode class to document
  $: if (typeof document !== 'undefined') {
    if ($darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  onMount(() => {
    // Initialize session store safely
    try {
      sessionStore.init();
    } catch (error) {
      console.error('Failed to initialize session store:', error);
    }
    
    // Set up authentication listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
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
        console.error('Failed to update session store:', error);
      }
    });

    // Check current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      try {
        if (session?.user) {
          sessionStore.setUser(session.user.id, true);
        }
      } catch (error) {
        console.error('Failed to check session:', error);
      }
    }).catch((error) => {
      console.error('Failed to get session:', error);
    });
    
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

<div class="app">
  <slot />
</div>

<style>
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
</style>
