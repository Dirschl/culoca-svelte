<script lang="ts">
  import { goto } from '$app/navigation';

  export let countries: Array<{ label: string; path: string; count: number }> = [];

  let selectedCountryPath = '';

  async function handleCountryChange(event: Event) {
    const value = (event.currentTarget as HTMLSelectElement | null)?.value || '';
    if (!value) return;

    selectedCountryPath = value;
    await goto(value);
  }
</script>

{#if countries.length > 0}
  <section id="geo-explorer" class="geo-explorer" aria-labelledby="geo-explorer-heading">
    <div class="geo-explorer__header">
      <p class="geo-explorer__kicker">Geo-Navigation</p>
      <h2 id="geo-explorer-heading">Nach Land starten und Schritt fuer Schritt vertiefen</h2>
      <p>Wähle ein Land als Einstieg in den Location Hub. Danach geht es Ebene für Ebene tiefer.</p>
    </div>

    <div class="geo-explorer__selector">
      <label class="geo-explorer__label" for="geo-country-select">Land auswählen</label>
      <select
        id="geo-country-select"
        class="geo-explorer__select"
        bind:value={selectedCountryPath}
        on:change={handleCountryChange}
      >
        <option value="">Land wählen ...</option>
        {#each countries as country}
          <option value={country.path}>
            {country.label} ({country.count.toLocaleString('de-DE')})
          </option>
        {/each}
      </select>
      <p class="geo-explorer__hint">Die Auswahl öffnet direkt den passenden Einstiegspunkt des Location Hub.</p>
    </div>
  </section>
{/if}

<style>
  .geo-explorer {
    margin-top: 2rem;
    padding: 1.5rem;
    border: 1px solid var(--border-color);
    border-radius: 1.5rem;
    background:
      linear-gradient(135deg, rgba(238, 114, 33, 0.08), rgba(255, 209, 102, 0.08)),
      var(--bg-secondary);
  }
  .geo-explorer__header h2 {
    margin: 0.15rem 0 0.5rem;
    font-size: clamp(1.4rem, 2.6vw, 2rem);
  }
  .geo-explorer__header p {
    margin: 0;
    max-width: 48rem;
    color: var(--text-secondary);
    line-height: 1.6;
  }
  .geo-explorer__kicker {
    margin: 0;
    color: var(--culoca-orange);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.8rem;
    font-weight: 700;
  }
  .geo-explorer__selector {
    margin-top: 1.25rem;
    max-width: 32rem;
  }
  .geo-explorer__label {
    display: block;
    margin-bottom: 0.55rem;
    font-weight: 700;
  }
  .geo-explorer__select {
    width: 100%;
    min-height: 52px;
    padding: 0.85rem 1rem;
    border-radius: 1rem;
    border: 1px solid rgba(238, 114, 33, 0.25);
    background: var(--bg-primary);
    color: var(--text-primary);
    font: inherit;
  }
  .geo-explorer__select:focus {
    outline: none;
    border-color: rgba(238, 114, 33, 0.7);
    box-shadow: 0 0 0 4px rgba(238, 114, 33, 0.12);
  }
  .geo-explorer__hint {
    margin: 0.55rem 0 0;
    color: var(--text-secondary);
    font-size: 0.92rem;
  }
</style>
