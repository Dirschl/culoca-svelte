<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  onMount(() => {
    const slug = $page.params.slug;
    
    // Handle specific slugs that should redirect to main web page
    if (slug === 'see-you-local-system-faq') {
      goto('/web', { replaceState: true });
      return;
    }
    
    // For any other slug, redirect to main page
    goto('/', { replaceState: true });
  });
</script>

<!-- Temporary content while redirecting -->
<div style="text-align: center; padding: 2rem;">
  <p>Weiterleitung...</p>
</div>
