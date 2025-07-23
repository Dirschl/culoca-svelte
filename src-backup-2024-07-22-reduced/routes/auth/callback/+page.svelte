<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { filterStore } from '$lib/filterStore';
  import { sessionStore } from '$lib/sessionStore';

  onMount(async () => {
    try {
      // Verarbeite OAuth-Callback
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Auth callback error:', error);
        goto('/?error=auth_failed');
        return;
      }

      if (data.session) {
        // Check if there's customer branding in session (from permalink visit)
        const sessionData = JSON.parse(localStorage.getItem('culoca-session') || '{}');
        
        if (sessionData.customerBranding) {
          // Permalink-based login: Keep customer branding
          console.log('🔗 OAuth callback with permalink context - keeping customer branding');
          
          if (sessionData.customerBranding.privacyMode === 'private') {
            // Private mode: Apply customer branding as user filter
            sessionStore.applyCustomerBrandingAsFilter();
            console.log('🔗 Private mode - applied customer branding as filter');
          }
          // For public mode, just display customer branding without filter
        } else {
          // Direct login: No permalink context, clear any old session data
          sessionStore.clearSession();
          console.log('🔓 OAuth callback without permalink context - cleared session data');
        }
        
        // Check for redirect URL in query parameters
        const redirectUrl = $page.url.searchParams.get('redirect');
        if (redirectUrl) {
          goto(redirectUrl);
        } else {
          // Erfolgreicher Login - weiterleiten zur Hauptseite
          goto('/');
        }
      } else {
        // Keine Session - zurück zur Hauptseite (Login-Overlay wird dort angezeigt)
        goto('/');
      }
    } catch (error) {
      console.error('Unexpected error in auth callback:', error);
      goto('/?error=unexpected');
    }
  });
</script>

<div class="min-h-screen flex items-center justify-center bg-[#0a1124]">
  <div class="text-center text-white">
    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
    <p>Verarbeite Anmeldung...</p>
  </div>
</div> 