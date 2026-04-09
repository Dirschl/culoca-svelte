<script lang="ts">
  export let countries: Array<{ label: string; path: string; count: number }> = [];
</script>

{#if countries.length > 0}
  <section class="geo-explorer" aria-labelledby="geo-explorer-heading">
    <div class="geo-explorer__header">
      <p class="geo-explorer__kicker">Geo-Navigation</p>
      <h2 id="geo-explorer-heading">Nach Land starten und Schritt fuer Schritt vertiefen</h2>
      <p>
        Wähle ein Land als Einstieg. Auf den folgenden Hub-Seiten führen dich klickbare Unterebenen
        weiter bis zu Regionen, Landkreisen und Gemeinden.
      </p>
    </div>

    <div class="geo-explorer__grid">
      {#each countries as country}
        <a href={country.path} class="geo-explorer__card">
          <span class="geo-explorer__label">{country.label}</span>
          <span class="geo-explorer__count">
            {country.count.toLocaleString('de-DE')} {country.count === 1 ? 'Eintrag' : 'Einträge'}
          </span>
        </a>
      {/each}
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
  .geo-explorer__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.9rem;
    margin-top: 1.25rem;
  }
  .geo-explorer__card {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 1rem;
    border-radius: 1rem;
    background: var(--bg-primary);
    border: 1px solid rgba(238, 114, 33, 0.15);
    text-decoration: none;
    color: var(--text-primary);
    transition: transform 0.16s ease, border-color 0.16s ease;
  }
  .geo-explorer__card:hover {
    transform: translateY(-1px);
    border-color: rgba(238, 114, 33, 0.45);
  }
  .geo-explorer__label {
    font-weight: 700;
  }
  .geo-explorer__count {
    color: var(--text-secondary);
    font-size: 0.92rem;
  }
</style>
