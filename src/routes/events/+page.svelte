<svelte:head>
  <title>Events - Culoca</title>
  <meta
    name="description"
    content="Aktuelle, kommende und vergangene Termine auf Culoca. Veranstaltungen mit Standort nach Entfernung, ohne Standort nach Datum."
  />
  <link rel="canonical" href="https://culoca.com/events" />
</svelte:head>

<script lang="ts">
  import { getPublicItemHref } from '$lib/content/routing';
  import {
    compareEventStartsAscending,
    formatEventSchedule,
    getEventSettings,
    type EventSettings
  } from '$lib/events';
  import { filterStore, getEffectiveGpsPosition } from '$lib/filterStore';
  import { onMount } from 'svelte';

  export let data: {
    withGpsEvents: EventCard[];
    withoutGpsEvents: EventCard[];
    pastEvents: EventCard[];
  };

  type EventCard = {
    id: string;
    slug: string | null;
    canonical_path: string | null;
    href?: string;
    title: string | null;
    caption: string | null;
    description: string | null;
    starts_at: string | null;
    ends_at: string | null;
    lat: number | null;
    lon: number | null;
    path_64: string | null;
    path_512: string | null;
    width: number | null;
    height: number | null;
    page_settings: Record<string, unknown> | null;
    eventSettings?: EventSettings;
  };

  function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) *
      Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function formatDistance(distance: number) {
    return distance >= 1000
      ? `${(distance / 1000).toFixed(1).replace('.', ',')} km`
      : `${Math.round(distance)} m`;
  }

  function buildImageUrl(event: EventCard) {
    if (event.path_64) {
      return `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-64/${event.path_64}`;
    }
    if (event.path_512) {
      return `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${event.path_512}`;
    }
    return '';
  }

  function toDisplayEvent(event: EventCard) {
    const settings = event.eventSettings || getEventSettings(event.page_settings);
    return {
      ...event,
      href: event.href || getPublicItemHref(event),
      eventSettings: settings,
      schedule: formatEventSchedule(event, settings)
    };
  }

  let withGpsEvents = (data.withGpsEvents || []).map(toDisplayEvent);
  let withoutGpsEvents = (data.withoutGpsEvents || []).map(toDisplayEvent);
  let pastEvents = (data.pastEvents || []).map(toDisplayEvent);

  $: withGpsEvents = (data.withGpsEvents || []).map(toDisplayEvent);
  $: withoutGpsEvents = (data.withoutGpsEvents || []).map(toDisplayEvent);
  $: pastEvents = (data.pastEvents || []).map(toDisplayEvent);

  $: effectivePosition = getEffectiveGpsPosition() || $filterStore.lastGpsPosition || null;
  $: withGpsSorted = effectivePosition
    ? [...withGpsEvents]
        .map((event) => ({
          ...event,
          distanceMeters: getDistanceInMeters(
            effectivePosition.lat,
            effectivePosition.lon,
            event.lat as number,
            event.lon as number
          )
        }))
        .sort((a, b) => a.distanceMeters - b.distanceMeters || compareEventStartsAscending(a, b))
    : withGpsEvents.map((event) => ({ ...event, distanceMeters: null }));

  onMount(() => {
    if (getEffectiveGpsPosition()) return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        filterStore.updateGpsStatus(true, {
          lat: position.coords.latitude,
          lon: position.coords.longitude
        });
      },
      () => {
        // ignore denied/unavailable state here, the page can fall back to date sorting
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  });
</script>

<div class="events-page">
  <header class="events-hero">
    <p class="eyebrow">Events</p>
    <h1>Termine in Culoca</h1>
    <p class="intro">
      Aktuelle und kommende Veranstaltungen mit Standort erscheinen nach Entfernung. Termine ohne Standort
      folgen darunter nach Datum, vergangene Events bleiben im Archiv sichtbar.
    </p>
  </header>

  <section class="events-section">
    <div class="section-heading">
      <h2>Aktuelle Events nach Entfernung</h2>
      <span>{withGpsSorted.length}</span>
    </div>
    {#if withGpsSorted.length}
      <div class="events-grid">
        {#each withGpsSorted as event}
          <a class="event-card" href={event.href}>
            {#if buildImageUrl(event)}
              <img
                class="event-thumb"
                src={buildImageUrl(event)}
                alt={event.title || 'Event'}
                loading="lazy"
              />
            {/if}
            <div class="event-body">
              <h3>{event.title || 'Event ohne Titel'}</h3>
              {#if event.schedule}
                <p class="meta">{event.schedule}</p>
              {/if}
              {#if event.distanceMeters !== null}
                <p class="meta">{formatDistance(event.distanceMeters)}</p>
              {/if}
              {#if event.eventSettings.location_name}
                <p class="meta">{event.eventSettings.location_name}</p>
              {/if}
              {#if event.caption}
                <p class="text">{event.caption}</p>
              {:else if event.description}
                <p class="text">{event.description}</p>
              {/if}
            </div>
          </a>
        {/each}
      </div>
    {:else}
      <p class="empty">Derzeit gibt es keine aktiven Events mit Standort.</p>
    {/if}
  </section>

  <section class="events-section">
    <div class="section-heading">
      <h2>Events ohne GPS nach Datum</h2>
      <span>{withoutGpsEvents.length}</span>
    </div>
    {#if withoutGpsEvents.length}
      <div class="events-grid">
        {#each withoutGpsEvents as event}
          <a class="event-card" href={event.href}>
            {#if buildImageUrl(event)}
              <img
                class="event-thumb"
                src={buildImageUrl(event)}
                alt={event.title || 'Event'}
                loading="lazy"
              />
            {/if}
            <div class="event-body">
              <h3>{event.title || 'Event ohne Titel'}</h3>
              {#if event.schedule}
                <p class="meta">{event.schedule}</p>
              {/if}
              {#if event.eventSettings.location_name}
                <p class="meta">{event.eventSettings.location_name}</p>
              {/if}
              {#if event.caption}
                <p class="text">{event.caption}</p>
              {:else if event.description}
                <p class="text">{event.description}</p>
              {/if}
            </div>
          </a>
        {/each}
      </div>
    {:else}
      <p class="empty">Alle aktiven Events haben derzeit einen Standort.</p>
    {/if}
  </section>

  <section class="events-section">
    <div class="section-heading">
      <h2>Vergangene Events</h2>
      <span>{pastEvents.length}</span>
    </div>
    {#if pastEvents.length}
      <div class="events-grid">
        {#each pastEvents as event}
          <a class="event-card event-card--past" href={event.href}>
            {#if buildImageUrl(event)}
              <img
                class="event-thumb"
                src={buildImageUrl(event)}
                alt={event.title || 'Vergangenes Event'}
                loading="lazy"
              />
            {/if}
            <div class="event-body">
              <h3>{event.title || 'Event ohne Titel'}</h3>
              {#if event.schedule}
                <p class="meta">{event.schedule}</p>
              {/if}
              {#if event.eventSettings.location_name}
                <p class="meta">{event.eventSettings.location_name}</p>
              {/if}
              {#if event.caption}
                <p class="text">{event.caption}</p>
              {:else if event.description}
                <p class="text">{event.description}</p>
              {/if}
            </div>
          </a>
        {/each}
      </div>
    {:else}
      <p class="empty">Noch keine vergangenen Events vorhanden.</p>
    {/if}
  </section>
</div>

<style>
  .events-page {
    max-width: 1120px;
    margin: 0 auto;
    padding: 2rem 1rem 4rem;
  }

  .events-hero {
    margin-bottom: 2rem;
    padding: 1.25rem 1.5rem;
    border: 1px solid var(--border-color);
    border-radius: 20px;
    background:
      radial-gradient(circle at top right, color-mix(in srgb, var(--culoca-orange) 18%, transparent) 0, transparent 42%),
      linear-gradient(180deg, var(--bg-secondary), color-mix(in srgb, var(--bg-secondary) 65%, var(--bg-primary)));
  }

  .eyebrow {
    margin: 0 0 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-secondary);
    font-size: 0.82rem;
  }

  .events-hero h1,
  .section-heading h2,
  .event-body h3 {
    margin: 0;
  }

  .intro {
    max-width: 56rem;
    margin: 0.75rem 0 0;
    color: var(--text-secondary);
    line-height: 1.6;
  }

  .events-section + .events-section {
    margin-top: 2rem;
  }

  .section-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .section-heading span {
    min-width: 2.2rem;
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    background: var(--bg-secondary);
    color: var(--text-secondary);
    text-align: center;
  }

  .events-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1rem;
  }

  .event-card {
    display: grid;
    grid-template-columns: 72px 1fr;
    gap: 0.9rem;
    padding: 0.95rem;
    border: 1px solid var(--border-color);
    border-radius: 18px;
    background: var(--bg-secondary);
    color: inherit;
    text-decoration: none;
    transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  }

  .event-card:hover {
    transform: translateY(-1px);
    border-color: var(--culoca-orange);
    box-shadow: 0 14px 30px color-mix(in srgb, var(--culoca-orange) 16%, transparent);
  }

  .event-card--past {
    opacity: 0.86;
  }

  .event-thumb {
    width: 72px;
    height: 72px;
    object-fit: cover;
    border-radius: 12px;
    background: var(--bg-primary);
  }

  .event-body {
    min-width: 0;
  }

  .event-body h3 {
    font-size: 1rem;
    line-height: 1.3;
  }

  .meta,
  .text,
  .empty {
    margin: 0.35rem 0 0;
    color: var(--text-secondary);
  }

  .text {
    display: -webkit-box;
    line-clamp: 3;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .empty {
    padding: 1rem 0.1rem 0;
  }

  @media (max-width: 640px) {
    .events-page {
      padding-top: 1.25rem;
    }

    .events-hero {
      padding: 1rem 1rem 1.1rem;
    }

    .event-card {
      grid-template-columns: 60px 1fr;
      padding: 0.85rem;
    }

    .event-thumb {
      width: 60px;
      height: 60px;
    }
  }
</style>
