<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import type { NewsFlashImage } from '$lib/types';
  export let searchTerm: string = '';
  export let userId: string = '';
  let results: NewsFlashImage[] = [];
  let loading = false;

  async function search() {
    if (!searchTerm) {
      results = [];
      return;
    }
    loading = true;
    // Query auf die neue View
    let query = supabase
      .from('items_search_view')
      .select('*')
      .ilike('searchtext', `%${searchTerm.toLowerCase()}%`)
      .order('created_at', { ascending: false })
      .limit(1000);
    if (userId) {
      query = query.or(`is_private.eq.false,user_id.eq.${userId}`);
    } else {
      query = query.eq('is_private', false);
    }
    const { data, error } = await query;
    console.log('🔍 Supabase-View-Query:', { searchTerm, userId, data, error });
    results = data ?? [];
    loading = false;
  }

  $: searchTerm, userId, search();
</script>

{#if loading}
  <p>🔄 Suche läuft…</p>
{:else if results.length === 0 && searchTerm}
  <p>❌ Keine Treffer gefunden.</p>
{:else if results.length > 0}
  <ul>
    {#each results as item}
      <li>{item.title} ({item.id})</li>
    {/each}
  </ul>
{/if} 