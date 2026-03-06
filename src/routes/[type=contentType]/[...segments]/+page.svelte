<script lang="ts">
  import ItemDetailPage from '../../item/[slug]/+page.svelte';

  export let data: unknown;
</script>

<ItemDetailPage {data} />
