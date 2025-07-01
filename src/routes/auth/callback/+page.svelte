<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { goto } from '$app/navigation';

  onMount(async () => {
    try {
      // Verarbeite OAuth-Callback
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Auth callback error:', error);
        goto('/login?error=auth_failed');
        return;
      }

      if (data.session) {
        // Erfolgreicher Login - weiterleiten zu Settings
        goto('/settings');
      } else {
        // Keine Session - zurück zum Login
        goto('/login');
      }
    } catch (error) {
      console.error('Unexpected error in auth callback:', error);
      goto('/login?error=unexpected');
    }
  });
</script>

<div class="min-h-screen flex items-center justify-center bg-[#0a1124]">
  <div class="text-center text-white">
    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
    <p>Verarbeite Anmeldung...</p>
  </div>
</div> 