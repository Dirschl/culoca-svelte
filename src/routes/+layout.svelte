<script lang="ts">
  import '../app.css';
  import '../admin.css';
  import { darkMode } from '$lib/darkMode';
  import { onMount } from 'svelte';
  import { sessionStore } from '$lib/sessionStore';
  import { supabase } from '$lib/supabaseClient';
  import { sessionReady } from '$lib/sessionStore';
  import { browser } from '$app/environment';
  import { afterNavigate } from '$app/navigation';
  import { isDetailPath, LAST_LOCAL_ROUTE_KEY } from '$lib/returnTo';
  import GlobalUtilityFabs from '$lib/GlobalUtilityFabs.svelte';

  function storeLastLocalRoute(url: URL) {
    if (!browser || isDetailPath(url.pathname)) return;
    sessionStorage.setItem(LAST_LOCAL_ROUTE_KEY, `${url.pathname}${url.search}${url.hash}`);
  }

  afterNavigate((navigation) => {
    if (!navigation.to?.url) return;
    storeLastLocalRoute(navigation.to.url);
  });

  onMount(() => {
    console.log('🚀 Layout mounted, starting session initialization...');
    storeLastLocalRoute(new URL(window.location.href));
    
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
        supabase.auth.setSession({ access_token, refresh_token }).then(({ data, error }) => {
          if (error) {
            console.error('❌ Failed to set OAuth session:', error);
          } else {
            window.location.hash = '';
            console.log('✅ Supabase session from OAuth fragment set:', data.session?.user?.id);
            
            // Immediately update session store
            if (data.session?.user) {
              sessionStore.setUser(data.session.user.id, true);
              console.log('✅ Session store updated with OAuth user:', data.session.user.id);
            }
          }
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
          // Load user permissions
          sessionStore.loadPermissions(session.user.id);
        } else {
          sessionStore.setUser(null, false);
          console.log('🔓 User logged out - loading anonymous permissions');
          sessionStore.loadPermissions(null);
        }
      } catch (error) {
        console.error('❌ Failed to update session store:', error);
        // Set anonymous permissions on error
        sessionStore.setUser(null, false);
        sessionStore.loadPermissions(null);
      }
    });

    // Check current session after a short delay to allow OAuth processing
    setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        console.log('📋 Session check result:', session?.user?.id || 'no session');
        
        if (session?.user) {
          sessionStore.setUser(session.user.id, true);
          console.log('✅ Session found and set:', session.user.id);
          
          // Load user permissions
          sessionStore.loadPermissions(session.user.id);
        } else {
          console.log('ℹ️ No active session found - loading anonymous permissions');
          sessionStore.setUser(null, false);
          sessionStore.loadPermissions(null);
        }
      }).catch((error) => {
        console.error('❌ Failed to check session:', error);
        // Set anonymous permissions on error
        sessionStore.setUser(null, false);
        sessionStore.loadPermissions(null);
      });
    }, 500);

    // Set session ready immediately when session is available
    const setSessionReady = async () => {
      console.log('✅ Setting sessionReady to true');
      
      // Final session check before setting ready
      const { data: { session } } = await supabase.auth.getSession();
      console.log('🔍 Final session check before ready:', session?.user?.id || 'no session');
      
      if (session?.user) {
        sessionStore.setUser(session.user.id, true);
        console.log('✅ Final session store update:', session.user.id);
      }
      
      sessionReady.set(true);
    };

    // Set ready immediately - no need to wait for session
    setSessionReady();

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  });
</script>

<div class="app">
  <slot />
  <GlobalUtilityFabs />
</div>

<style>
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background-color: var(--bg-primary);
  }
</style>
