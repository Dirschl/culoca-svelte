<script lang="ts">
  export let radius: number;
  export let onRadiusInput: () => void;
  export let onRadiusChange: () => void;
  export let formatRadius: (meters: number) => string;
  export let nearby: any[] = [];
  export let hiddenItems: any[] = [];
  export let showHiddenItems: boolean;
  export let toggleHiddenItems: () => void;
</script>

<div class="radius-control">
  <div class="radius-value">
    {formatRadius(radius)}
    {#if nearby.length > 0}
      <span class="nearby-count">• {nearby.length} Items</span>
    {/if}
    {#if hiddenItems.length > 0}
      <span class="hidden-count" class:active={showHiddenItems} on:click={toggleHiddenItems}>
        + {hiddenItems.length} ausgeblendet
      </span>
    {/if}
  </div>
  <input id="radius" type="range" min="50" max="2000" step="50" bind:value={radius} on:input={onRadiusInput} on:change={onRadiusChange}>
</div>

<style>
  .radius-control {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 1.2rem 0 1.2rem 0;
    gap: 0.5rem;
  }
  .radius-value {
    font-size: 1.1rem;
    color: var(--text-primary);
    margin-bottom: 0.2rem;
    display: flex;
    align-items: center;
    gap: 0.7rem;
  }
  .nearby-count {
    color: var(--accent-color);
    font-weight: 500;
    margin-left: 0.5rem;
  }
  .hidden-count {
    color: var(--text-muted);
    margin-left: 0.5rem;
    cursor: pointer;
    font-size: 0.98rem;
    border-bottom: 1px dashed var(--border-color);
    transition: color 0.2s;
  }
  .hidden-count.active {
    color: var(--accent-color);
    font-weight: 600;
    border-bottom: 1px solid var(--accent-color);
  }
  input[type="range"] {
    width: 100vw;
    max-width: 100vw;
    margin: 0.2rem auto 0 auto;
    display: block;
  }
</style> 