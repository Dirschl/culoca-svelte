<script lang="ts">
  import { onMount } from 'svelte';

  let loading = false;
  let result = '';
  let error = '';

  async function setupGalleryField() {
    loading = true;
    result = '';
    error = '';

    try {
      const response = await fetch('/api/setup-gallery-field', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        result = `✅ Success: ${data.message}`;
      } else {
        error = `❌ Error: ${data.error}`;
      }
    } catch (err) {
      error = `❌ Network error: ${err}`;
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Setup Gallery Field</title>
</svelte:head>

<div class="container">
  <h1>🔧 Setup Gallery Field</h1>
  
  <p>This page will add the gallery field to the database and update the items_search_view.</p>
  
  <button 
    on:click={setupGalleryField} 
    disabled={loading}
    class="setup-button"
  >
    {loading ? 'Setting up...' : 'Setup Gallery Field'}
  </button>

  {#if result}
    <div class="success">
      {result}
    </div>
  {/if}

  {#if error}
    <div class="error">
      {error}
    </div>
  {/if}

  <div class="info">
    <h3>What this does:</h3>
    <ul>
      <li>Adds gallery BOOLEAN column to items table</li>
      <li>Sets gallery = true for all existing items</li>
      <li>Creates index for better performance</li>
      <li>Updates items_search_view to include gallery field</li>
      <li>Grants necessary permissions</li>
    </ul>
  </div>
</div>

<style>
  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    font-family: system-ui, -apple-system, sans-serif;
  }

  h1 {
    color: #333;
    margin-bottom: 1rem;
  }

  .setup-button {
    background: #007bff;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 6px;
    font-size: 16px;
    cursor: pointer;
    margin: 1rem 0;
  }

  .setup-button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .success {
    background: #d4edda;
    color: #155724;
    padding: 1rem;
    border-radius: 6px;
    margin: 1rem 0;
    border: 1px solid #c3e6cb;
  }

  .error {
    background: #f8d7da;
    color: #721c24;
    padding: 1rem;
    border-radius: 6px;
    margin: 1rem 0;
    border: 1px solid #f5c6cb;
  }

  .info {
    background: #e7f3ff;
    padding: 1rem;
    border-radius: 6px;
    margin: 1rem 0;
    border: 1px solid #b3d9ff;
  }

  .info h3 {
    margin-top: 0;
    color: #0056b3;
  }

  .info ul {
    margin: 0.5rem 0;
    padding-left: 1.5rem;
  }

  .info li {
    margin: 0.25rem 0;
  }
</style> 