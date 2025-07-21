<script lang="ts">
  export let visible = false;
  export let message = '';
</script>

{#if visible}
  <div class="mode-status-overlay">
    <div class="mode-status-message">
      {message}
    </div>
  </div>
{/if}

<style>
  .mode-status-overlay {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10000;
    pointer-events: none;
  }
  .mode-status-message {
    background: var(--bg-secondary);
    color: var(--text-primary);
    padding: 12px 20px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    box-shadow: 0 4px 16px var(--shadow);
    font-size: 14px;
    font-weight: 500;
    text-align: center;
    white-space: nowrap;
  }
</style> 