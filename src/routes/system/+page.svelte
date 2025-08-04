<script>
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    goto('/see-you-local-system-faq', { replaceState: true });
  });
</script>

<!-- Temporary content while redirecting -->
<div style="text-align: center; padding: 2rem;">
  <p>Weiterleitung...</p>
</div> 