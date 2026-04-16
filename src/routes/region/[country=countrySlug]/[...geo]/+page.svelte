<script lang="ts">
  import GeoHubPage from '$lib/seo/GeoHubPage.svelte';
  import ItemDetailPage from '../../../item/[slug]/+page.svelte';

  export let data: any;

  $: isGeoHub = Array.isArray(data?.breadcrumbs) && Array.isArray(data?.items);
</script>

{#if isGeoHub}
  <GeoHubPage {data} />
{:else}
  <ItemDetailPage {data} />
{/if}
