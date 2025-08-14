<script>
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    // Redirect to the web page - this is the correct behavior
    goto('/see-you-local-system-faq', { replaceState: true });
  });
</script>

<!-- Temporary content while redirecting -->
<div style="text-align: center; padding: 2rem;">
  <p>Weiterleitung zur Hauptseite...</p>
</div>