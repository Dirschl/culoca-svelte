<script lang="ts">
  import ItemDetailPage from '../../../../../item/[slug]/+page.svelte';
  import GeoHubPage from '$lib/seo/GeoHubPage.svelte';

  export let data;
</script>

{#if data?.hubType}
  <GeoHubPage {data} />
{:else}
  <ItemDetailPage {data} />
{/if}
