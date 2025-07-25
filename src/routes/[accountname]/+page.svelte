<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabaseClient';
  import { filterStore } from '$lib/filterStore';
  import { page } from '$app/stores';

  let loading = true;
  let error = '';

  onMount(async () => {
    const accountname = $page.params.accountname;
    if (!accountname) {
      error = 'Kein Accountname angegeben.';
      loading = false;
      goto('/');
      return;
    }
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('accountname', accountname.toLowerCase())
      .single();
    if (profile) {
      filterStore.setUserFilter({
        userId: profile.id,
        username: profile.full_name || profile.accountname || profile.id,
        avatarUrl: profile.avatar_url || '',
        accountName: profile.accountname || profile.full_name || profile.id
      });
      goto('/');
    } else {
      error = 'Profil nicht gefunden.';
      loading = false;
      goto('/');
    }
  });
</script>

{#if loading}
  <div>Profil wird geladen...</div>
{:else if error}
  <div>{error}</div>
{/if} 