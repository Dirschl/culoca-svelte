<script lang="ts">
  import { onMount } from 'svelte';
  
  export let radius: number;
  export let onRadiusInput: () => void;
  export let onRadiusChange: () => void;
  export let formatRadius: (meters: number) => string;
  export let nearby: any[] = [];
  export let hiddenItems: any[] = [];
  export let showHiddenItems: boolean;
  export let toggleHiddenItems: () => void;

  // Slider-Fortschritt aktualisieren
  function updateSliderProgress(slider: HTMLInputElement) {
    const min = +slider.min || 0, max = +slider.max || 100, val = +slider.value;
    const pct = ((val - min) * 100 / (max - min)) + '%';
    slider.style.setProperty('--pct', pct);
  }

  // Slider-Event-Handler
  function handleSliderInput(event: Event) {
    const slider = event.target as HTMLInputElement;
    updateSliderProgress(slider);
    onRadiusInput();
  }

  onMount(() => {
    const slider = document.querySelector('#radius') as HTMLInputElement;
    if (slider) {
      updateSliderProgress(slider);
    }
  });
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
  <input id="radius" type="range" min="50" max="2000" step="50" bind:value={radius} on:input={handleSliderInput} on:change={onRadiusChange}>
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
    width: 320px;
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    --thumb: 32px;      /* Thumb-Größe */
    --track: 8px;       /* Track-Höhe */
    --pct: 0%;          /* wird per JS gesetzt */
  }

  /* ===== WebKit (Chrome/Safari/Edge) ===== */
  input[type="range"]::-webkit-slider-runnable-track {
    height: var(--track);
    border-radius: 999px;
    background:
      linear-gradient(to right,
        #4f46e5 0%,
        #4f46e5 var(--pct),
        #e5e7eb var(--pct),
        #e5e7eb 100%);
  }
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: var(--thumb);
    height: var(--thumb);
    border-radius: 50%;
    background: #fff;
    border: 12px solid #4f46e5;
    cursor: pointer;
    /* Track mittig unter dem Thumb ausrichten */
    margin-top: calc((var(--track) - var(--thumb)) / 2);
    transition: transform .1s ease;
  }

  /* ===== Firefox ===== */
  input[type="range"]::-moz-range-track {
    height: var(--track);
    background: #e5e7eb;
    border-radius: 999px;
  }
  input[type="range"]::-moz-range-progress {
    height: var(--track);
    background: #4f46e5;
    border-radius: 999px;
  }
  input[type="range"]::-moz-range-thumb {
    width: var(--thumb);
    height: var(--thumb);
    border-radius: 50%;
    background: #fff;
    border: 12px solid #4f46e5;
    cursor: pointer;
    transition: transform .1s ease;
  }

  /* (optional) kleine Interaktions-Details */
  input[type="range"]:hover::-webkit-slider-thumb,
  input[type="range"]:hover::-moz-range-thumb { 
    transform: scale(.98); 
  }
</style> 