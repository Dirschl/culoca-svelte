<script lang="ts">
  import type { RememberedLocation } from '$lib/locationPreferences';

  /** Eingeloggtes Dashboard: aktueller Standort aus LocalStorage */
  export let savedLocation: RememberedLocation | null;

  function buildLocationPreviewUrl(location: RememberedLocation | null): string {
    if (!location) return '';
    const delta = 0.018;
    const left = location.lon - delta;
    const right = location.lon + delta;
    const top = location.lat + delta;
    const bottom = location.lat - delta;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${location.lat}%2C${location.lon}`;
  }

  $: previewUrl = buildLocationPreviewUrl(savedLocation);
  $: coordLine =
    savedLocation != null
      ? `${savedLocation.lat.toFixed(5)}, ${savedLocation.lon.toFixed(5)}`
      : '';
</script>

<section class="dashboard-location-panel">
  <span class="kicker">Standort</span>
  <h2>
    {savedLocation?.source === 'gps'
      ? 'Live-Standort aktiv'
      : savedLocation
        ? 'Location manuell gesetzt'
        : 'Standort freigeben'}
  </h2>
  <p class="lede">
    {#if savedLocation?.source === 'gps'}
      Culoca nutzt deinen aktuellen Live-Standort und kann Inhalte, Distanzen und Sortierung laufend an deine Position
      anpassen.
    {:else if savedLocation}
      Bei einem manuell gesetzten Punkt bleibt der Standort fix. Die mobile Galerie mit Live-GPS ist dann nicht verfügbar.
    {:else}
      Ohne Standort kann nur nach Aktualität, nicht nach Entfernung sortiert werden. Mit Standort wird die Galerie auf deine
      Umgebung ausgerichtet.
    {/if}
  </p>

  {#if savedLocation}
    <div class="status">
      <strong>{savedLocation.label || 'Standort gespeichert'}</strong>
      <p class="coords" title="Breitengrad, Längengrad (WGS84)">{coordLine}</p>
      <div class="map">
        <iframe
          src={previewUrl}
          title="Kartenausschnitt des aktuell verwendeten Standorts"
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
        ></iframe>
      </div>
    </div>
  {/if}

  <div class="actions">
    <a href="/standort?returnTo=%2F" class="cta" class:cta--pulse={!savedLocation}>
      {savedLocation ? 'Standortfreigabe ändern' : 'Standort jetzt festlegen'}
    </a>
  </div>
</section>

<style>
  .dashboard-location-panel {
    display: grid;
    gap: 0.75rem;
    align-content: start;
    padding: 1rem;
    border-radius: 20px;
    background: color-mix(in srgb, var(--bg-secondary) 88%, white 12%);
    border: 1px solid color-mix(in srgb, var(--culoca-orange) 10%, var(--border-color) 90%);
    min-width: 0;
  }

  .kicker {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--culoca-orange);
  }

  h2 {
    margin: 0;
    font-size: 1.15rem;
    line-height: 1.25;
    color: var(--text-primary);
  }

  .lede {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.55;
    color: var(--text-secondary);
  }

  .status {
    display: grid;
    gap: 0.5rem;
  }

  .status strong {
    font-size: 0.95rem;
  }

  .coords {
    margin: 0;
    font-size: 0.8rem;
    font-family: ui-monospace, monospace;
    color: var(--text-secondary);
    word-break: break-all;
  }

  .map {
    min-height: 160px;
    overflow: hidden;
    border-radius: 12px;
    border: 1px solid color-mix(in srgb, var(--border-color) 80%, white 20%);
    background: var(--bg-secondary);
  }

  .map iframe {
    display: block;
    width: 100%;
    height: 160px;
    border: 0;
  }

  .actions {
    display: grid;
    gap: 0.5rem;
  }

  .cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    box-sizing: border-box;
    padding: 0.7rem 1.25rem;
    font-size: 0.95rem;
    font-weight: 600;
    border-radius: 10px;
    text-decoration: none;
    text-align: center;
    background: var(--culoca-orange);
    color: #fff;
    box-shadow: 0 2px 12px rgba(238, 114, 33, 0.3);
    transition: transform 0.15s, box-shadow 0.15s;
  }

  .cta:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 20px rgba(238, 114, 33, 0.4);
  }

  .cta--pulse {
    animation: locPulse 2.4s ease-in-out infinite;
    box-shadow:
      0 0 0 0 rgba(238, 114, 33, 0.4),
      0 0 28px rgba(238, 114, 33, 0.2);
  }

  @keyframes locPulse {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-2px);
    }
  }
</style>
