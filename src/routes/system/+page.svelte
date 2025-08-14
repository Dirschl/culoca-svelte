<script>
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    // Redirect to main page instead of non-existent accountname
    goto('/', { replaceState: true });
  });
</script>

<!-- Temporary content while redirecting -->
<div style="text-align: center; padding: 2rem;">
  <p>Weiterleitung zur Hauptseite...</p>
</div>