<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import SiteNav from '$lib/SiteNav.svelte';
  import LocationPickerCard from '$lib/LocationPickerCard.svelte';
  import { filterStore } from '$lib/filterStore';
  import { currentPathWithSearch, sanitizeReturnTo } from '$lib/returnTo';
  import {
    clearRememberedLocation,
    readRememberedLocation,
    saveRememberedLocation,
    setGpsPromptPreference,
    type RememberedLocation
  } from '$lib/locationPreferences';

  let returnTo = '/';
  let currentLocation: RememberedLocation | null = null;
  let message = '';
  let messageType: 'success' | 'error' = 'success';
  let locating = false;

  function showMessage(text: string, type: 'success' | 'error' = 'success') {
    message = text;
    messageType = type;
  }

  function syncLocationFromStorage() {
    currentLocation = readRememberedLocation();
  }

  function getReferrerFallback() {
    if (typeof window === 'undefined' || !document.referrer) return '/';

    try {
      const referrerUrl = new URL(document.referrer);
      if (referrerUrl.origin !== window.location.origin) return '/';
      if (referrerUrl.pathname === $page.url.pathname) return '/';
      return sanitizeReturnTo(`${referrerUrl.pathname}${referrerUrl.search}${referrerUrl.hash}`, '/');
    } catch {
      return '/';
    }
  }

  function maybeReturn() {
    if (!returnTo || returnTo === '/standort') return;
    setTimeout(() => goto(returnTo), 450);
  }

  function applyLocation(lat: number, lon: number, label: string | null, source: 'gps' | 'manual') {
    currentLocation = saveRememberedLocation(lat, lon, { label, source });
    filterStore.updateGpsStatus(true, { lat, lon });
    showMessage(source === 'gps' ? 'Standort automatisch übernommen.' : 'Standort auf der Karte übernommen.');
    maybeReturn();
  }

  function clearLocation() {
    clearRememberedLocation();
    filterStore.clearGpsData();
    filterStore.clearLocationFilter();
    syncLocationFromStorage();
    showMessage('Gespeicherter Standort wurde entfernt.');
  }

  function activateGpsLocation() {
    if (!navigator.geolocation) {
      showMessage('Standortzugriff wird in diesem Browser nicht unterstützt.', 'error');
      return;
    }

    locating = true;
    setGpsPromptPreference('ask');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        locating = false;
        applyLocation(position.coords.latitude, position.coords.longitude, 'Aktueller Standort', 'gps');
      },
      (error) => {
        locating = false;
        showMessage(
          error.code === error.PERMISSION_DENIED
            ? 'Standortzugriff wurde blockiert. Du kannst rechts einen Ort manuell festlegen.'
            : 'Standort konnte nicht ermittelt werden. Du kannst rechts einen Ort manuell festlegen.',
          'error'
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  function handleMapSave(event: CustomEvent<{ lat: number; lon: number; label: string | null }>) {
    applyLocation(event.detail.lat, event.detail.lon, event.detail.label, 'manual');
  }

  onMount(() => {
    returnTo = sanitizeReturnTo($page.url.searchParams.get('returnTo'), getReferrerFallback());
    syncLocationFromStorage();
  });
</script>

<svelte:head>
  <title>Standort - Culoca</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="location-page">
  <SiteNav />

  <main class="location-main">
    <section class="hero-grid">
      <div class="hero-copy surface-responsive surface-responsive--panel">
        <span class="eyebrow">Standort freigeben</span>
        <h1>{currentLocation?.source === 'gps' ? 'Live-Standort aktiv' : currentLocation ? 'Standortfreigabe ändern' : 'Standort für Culoca freigeben'}</h1>
        <p class="lead">
          Die Standortfreigabe macht Culoca interaktiv: Inhalte, Distanzen und Sortierung reagieren dann auf deine aktuelle
          Position. Du kannst Live-GPS aktivieren oder rechts einen festen Ort manuell setzen.
        </p>

        {#if message}
          <div class="message" class:messageError={messageType === 'error'}>{message}</div>
        {/if}

        <div class="status-card">
          <h2>Aktueller Status</h2>
          {#if currentLocation}
            <p>
              <strong>{currentLocation.label || 'Standort gespeichert'}</strong><br />
              {currentLocation.lat.toFixed(6)}, {currentLocation.lon.toFixed(6)}
            </p>
            <p class="status-meta">
              Modus: {currentLocation.source === 'gps' ? 'Live-GPS für interaktive Inhalte' : 'Fester Ort über Karte festgelegt'}
            </p>
          {:else}
            <p>Noch kein Standort gespeichert. Ohne Standort fehlen Live-Distanzen, dynamische Sortierung und die mobile Standortlogik.</p>
          {/if}
        </div>

        <div class="info-card surface-responsive surface-responsive--soft">
          <h3>So aktivierst du Live-GPS sicher</h3>
          <ul>
            <li><strong>1. Button klicken:</strong> Wähle hier `Live-GPS freigeben`.</li>
            <li><strong>2. Browser erlauben:</strong> Bestätige im Hinweisfenster `Erlauben` oder `Zulassen` für den Standort.</li>
            <li><strong>3. Wenn nichts erscheint:</strong> Prüfe die Freigabe direkt am Standortsymbol des Browsers oder in den Systemeinstellungen.</li>
          </ul>
          <p class="browser-help">
            <strong>Desktop:</strong> Meist sitzt das Standortsymbol rechts neben der URL in der Adressleiste.<br />
            <strong>Mobil:</strong> Öffne die Website-Einstellungen im Browser oder die App-/Website-Berechtigungen im Betriebssystem und setze Standort auf `Erlauben`.
          </p>
        </div>

        <div class="action-list">
          <button type="button" class="primary-action" on:click={activateGpsLocation} disabled={locating}>
            {locating ? 'Standort wird abgefragt...' : currentLocation ? 'Live-GPS erneut freigeben' : 'Live-GPS freigeben'}
          </button>
          {#if currentLocation}
            <button type="button" class="ghost-action" on:click={clearLocation}>Gespeicherten Standort entfernen</button>
          {/if}
        </div>

        <div class="info-grid">
          <section class="info-card surface-responsive surface-responsive--soft">
            <h3>Freigabeoptionen</h3>
            <ul>
              <li><strong>Live-GPS:</strong> Culoca darf deine aktuelle Position verwenden und Inhalte unterwegs laufend anpassen.</li>
              <li><strong>Fester Ort:</strong> Du suchst rechts einen Ort oder setzt ihn direkt auf der Karte als feste Basis.</li>
              <li><strong>Jederzeit änderbar:</strong> Du kannst den Modus später wieder wechseln, im Browser ändern oder den Standort ganz entfernen.</li>
            </ul>
          </section>

          <section class="info-card surface-responsive surface-responsive--soft">
            <h3>Wofür der Standort genutzt wird</h3>
            <ul>
              <li>Die Galerie kann Inhalte nach deiner aktuellen Position oder nach deinem festen Ort sortieren.</li>
              <li>Distanzangaben, mobile Galerie, Karte und nahe Inhalte reagieren präziser.</li>
              <li>Du kannst die Freigabe jederzeit hier, im Browser oder in den Betriebssystem-Einstellungen anpassen.</li>
            </ul>
          </section>
        </div>
      </div>

      <LocationPickerCard
        initialLat={currentLocation?.lat ?? null}
        initialLon={currentLocation?.lon ?? null}
        initialLabel={currentLocation?.label ?? ''}
        submitLabel={currentLocation ? 'Standortfreigabe ändern' : 'Standort speichern'}
        on:save={handleMapSave}
      />
    </section>
  </main>
</div>

<style>
  .location-page {
    min-height: 100vh;
    background:
      radial-gradient(circle at top right, rgba(238, 114, 33, 0.12), transparent 30%),
      var(--bg-primary);
  }

  .location-main {
    padding: 2rem;
  }

  .hero-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr);
    gap: 1.5rem;
    align-items: start;
  }

  .hero-copy {
    display: grid;
    gap: 1.25rem;
  }

  .eyebrow {
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--culoca-orange);
  }

  h1 {
    margin: 0;
    font-size: clamp(2.2rem, 4vw, 3.6rem);
    line-height: 1.05;
    color: var(--text-primary);
  }

  .lead {
    margin: 0;
    font-size: 1.08rem;
    line-height: 1.65;
    color: var(--text-secondary);
    max-width: 56rem;
  }

  .message {
    padding: 0.9rem 1rem;
    border-radius: 16px;
    background: color-mix(in srgb, #1b8f3d 14%, var(--bg-secondary));
    color: var(--text-primary);
    border: 1px solid color-mix(in srgb, #1b8f3d 32%, var(--border-color));
  }

  .messageError {
    background: color-mix(in srgb, #cb3f36 11%, var(--bg-secondary));
    border-color: color-mix(in srgb, #cb3f36 32%, var(--border-color));
  }

  .status-card {
    padding: 1.1rem 1.15rem;
    border-radius: 20px;
    background: color-mix(in srgb, var(--bg-secondary) 88%, transparent);
    border: 1px solid var(--border-color);
  }

  .status-card h2,
  .info-card h3 {
    margin: 0 0 0.65rem;
    color: var(--text-primary);
  }

  .status-card p,
  .info-card li {
    color: var(--text-secondary);
    line-height: 1.6;
  }

  .status-card p:last-child {
    margin-bottom: 0;
  }

  .status-meta {
    font-size: 0.95rem;
  }

  .browser-help {
    margin: 0.85rem 0 0;
    color: var(--text-secondary);
    line-height: 1.65;
  }

  .action-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.85rem;
  }

  .primary-action,
  .ghost-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 50px;
    padding: 0.95rem 1.2rem;
    border-radius: 16px;
    border: 1px solid transparent;
    font: inherit;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
  }

  .primary-action {
    background: var(--culoca-orange);
    color: white;
    box-shadow: 0 18px 34px rgba(238, 114, 33, 0.24);
  }
  .ghost-action {
    background: transparent;
    color: var(--text-primary);
    border-color: var(--border-color);
  }

  .primary-action:hover,
  .ghost-action:hover {
    transform: translateY(-1px);
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }

  .info-card ul {
    margin: 0;
    padding-left: 1.15rem;
  }

  @media (max-width: 960px) {
    .hero-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 768px) {
    .location-main {
      padding: 1.25rem;
    }

    .info-grid {
      grid-template-columns: 1fr;
    }

    .status-card {
      padding-left: 0;
      padding-right: 0;
      border: none;
      background: transparent;
      border-radius: 0;
    }
  }
</style>
