<script lang="ts">
  import { page } from '$app/stores';
  import { PRIMARY_REGIONAL_FEED_PATH } from '$lib/content/routing';

  const year = new Date().getFullYear();
  /** Region-SEO-Hubs: keine App-Links (Galerie/Karte), nur Inhaltsnavigation. */
  $: regionHubSeo = $page.url.pathname === '/region' || $page.url.pathname.startsWith('/region/');
</script>

<footer class="site-footer">
  <div class="footer-inner">
    <div class="footer-brand">
      <a href="/" class="footer-logo" aria-label="Culoca Startseite">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 473.74 100.88" aria-hidden="true">
          <defs><style>.sf1{fill:var(--text-muted,#999)}.sf2{fill:#ee7221}</style></defs>
          <path class="sf1" d="m0,41.35c0-6.3,1.12-11.99,3.35-17.07,2.24-5.08,5.27-9.43,9.1-13.06,3.83-3.62,8.31-6.4,13.42-8.33,5.11-1.93,10.54-2.89,16.29-2.89,4.55,0,8.61.43,12.16,1.3s6.61,1.85,9.17,2.95c2.95,1.26,5.51,2.64,7.67,4.14l-12.58,21.86c-1.28-.95-2.68-1.85-4.19-2.72-1.36-.63-2.98-1.24-4.85-1.83-1.88-.59-4.01-.89-6.41-.89s-4.75.43-6.83,1.3c-2.08.87-3.89,2.05-5.45,3.55-1.56,1.5-2.78,3.25-3.65,5.26-.88,2.01-1.32,4.16-1.32,6.44s.46,4.43,1.38,6.44c.92,2.01,2.18,3.76,3.77,5.26,1.6,1.5,3.48,2.68,5.63,3.55,2.16.87,4.51,1.3,7.07,1.3s4.83-.31,6.83-.95c2-.63,3.67-1.34,5.03-2.13,1.6-.87,3-1.89,4.2-3.07l12.58,21.86c-2.15,1.73-4.71,3.27-7.67,4.61-2.56,1.1-5.63,2.13-9.23,3.07-3.59.94-7.71,1.42-12.34,1.42-6.23,0-11.98-1-17.25-3.01-5.27-2.01-9.82-4.82-13.66-8.45-3.83-3.62-6.83-7.97-8.98-13.06-2.16-5.08-3.24-10.69-3.24-16.84Z"/>
          <path class="sf1" d="m114.95,82.71c-5.03,0-9.58-.63-13.66-1.89-4.07-1.26-7.55-3.15-10.42-5.67-2.88-2.52-5.09-5.71-6.65-9.57s-2.34-8.39-2.34-13.59V1.89h25.52v49.04c0,2.76.58,4.87,1.74,6.32,1.16,1.46,3.09,2.19,5.81,2.19s4.65-.73,5.81-2.19c1.16-1.46,1.74-3.56,1.74-6.32V1.89h25.64v50.1c0,5.2-.78,9.73-2.34,13.59s-3.79,7.05-6.71,9.57c-2.92,2.52-6.41,4.41-10.48,5.67-4.07,1.26-8.63,1.89-13.66,1.89Z"/>
          <path class="sf1" d="m165.07,1.89h26.6v58.13h22.04v20.68h-48.64V1.89Z"/>
          <path class="sf2" d="m221.15,41.35c0-5.67,1.1-11.03,3.29-16.07,2.19-5.04,5.19-9.43,8.98-13.17,3.79-3.74,8.25-6.69,13.36-8.86,5.11-2.17,10.54-3.25,16.29-3.25s11.18,1.08,16.29,3.25c5.11,2.17,9.56,5.12,13.36,8.86,3.79,3.74,6.79,8.13,8.98,13.17,2.19,5.04,3.29,10.4,3.29,16.07s-1.1,11.03-3.29,16.07c-2.2,5.04-5.19,9.43-8.98,13.17-3.8,3.74-8.25,6.7-13.36,8.86-5.11,2.17-9.49,21.42-15.25,21.42s-12.23-19.25-17.34-21.42c-5.11-2.17-9.56-5.12-13.36-8.86-3.79-3.74-6.79-8.13-8.98-13.17-2.2-5.04-3.29-10.4-3.29-16.07Zm25.16,0c0,2.29.44,4.43,1.32,6.44.88,2.01,2.07,3.76,3.59,5.26,1.52,1.5,3.29,2.68,5.33,3.55,2.04.87,4.21,1.3,6.53,1.3s4.49-.43,6.53-1.3c2.04-.87,3.81-2.05,5.33-3.55,1.52-1.5,2.71-3.25,3.59-5.26.88-2.01,1.32-4.15,1.32-6.44s-.44-4.43-1.32-6.44c-.88-2.01-2.08-3.76-3.59-5.26-1.52-1.5-3.29-2.68-5.33-3.55-2.03-.87-4.21-1.3-6.53-1.3s-4.49.43-6.53,1.3c-2.04.87-3.81,2.05-5.33,3.55-1.52,1.5-2.72,3.25-3.59,5.26-.88,2.01-1.32,4.16-1.32,6.44Z"/>
          <path class="sf1" d="m315.86,41.35c0-6.3,1.12-11.99,3.36-17.07,2.23-5.08,5.27-9.43,9.1-13.06,3.83-3.62,8.31-6.4,13.42-8.33,5.11-1.93,10.54-2.89,16.29-2.89,4.55,0,8.61.43,12.16,1.3s6.61,1.85,9.17,2.95c2.95,1.26,5.51,2.64,7.67,4.14l-12.58,21.86c-1.28-.95-2.68-1.85-4.19-2.72-1.36-.63-2.98-1.24-4.85-1.83-1.88-.59-4.01-.89-6.41-.89s-4.75.43-6.83,1.3c-2.08.87-3.89,2.05-5.45,3.55-1.56,1.5-2.78,3.25-3.65,5.26-.88,2.01-1.32,4.16-1.32,6.44s.46,4.43,1.38,6.44c.92,2.01,2.18,3.76,3.77,5.26,1.6,1.5,3.48,2.68,5.63,3.55,2.16.87,4.51,1.3,7.07,1.3s4.83-.31,6.83-.95c2-.63,3.67-1.34,5.03-2.13,1.6-.87,3-1.89,4.2-3.07l12.58,21.86c-2.15,1.73-4.71,3.27-7.67,4.61-2.56,1.1-5.63,2.13-9.23,3.07-3.59.94-7.71,1.42-12.34,1.42-6.23,0-11.98-1-17.25-3.01-5.27-2.01-9.82-4.82-13.66-8.45-3.83-3.62-6.83-7.97-8.98-13.06-2.16-5.08-3.24-10.69-3.24-16.84Z"/>
          <path class="sf1" d="m424.26,1.89h19.17l30.31,78.81h-25.16l-2.64-7.09h-24.2l-2.64,7.09h-25.16L424.26,1.89Zm14.97,54.35l-5.39-13.83-5.39,13.83h10.78Z"/>
        </svg>
      </a>
      <p class="footer-tagline">GPS-basierte Inhalte entdecken und teilen.</p>
    </div>

    <div class="footer-col">
      <h4>Entdecken</h4>
      <ul>
        <li><a href={PRIMARY_REGIONAL_FEED_PATH}>Regionale Fotos</a></li>
        <li><a href="/event">Events</a></li>
        <li><a href="/firma">Firmen</a></li>
        <li><a href="/video">Videos</a></li>
        <li><a href="/musik">Musik</a></li>
        {#if !regionHubSeo}
          <li><a href="/galerie">Galerie</a></li>
          <li><a href="/map-view">Karte</a></li>
        {/if}
      </ul>
    </div>

    <div class="footer-col">
      <h4>Informationen</h4>
      <ul>
        <li><a href="/web">System</a></li>
        <li><a href="/web/license">Lizenz</a></li>
        <li><a href="/web/google">Google Earth</a></li>
        <li><a href="/web/impressum">Impressum</a></li>
        <li><a href="/web/datenschutz">Datenschutz</a></li>
      </ul>
    </div>

    <div class="footer-col">
      <h4>Kontakt</h4>
      <p class="footer-company">DIRSCHL.com GmbH</p>
      <p><a href="mailto:johann.dirschl@gmx.de">johann.dirschl@gmx.de</a></p>
      <p><a href="tel:+491799766666">+49 179 9766666</a></p>
    </div>
  </div>

  <div class="footer-bottom">
    <span>&copy; {year} DIRSCHL.com GmbH</span>
    <span class="footer-sep" aria-hidden="true">&middot;</span>
    <a href="/web/impressum">Impressum</a>
    <span class="footer-sep" aria-hidden="true">&middot;</span>
    <a href="/web/datenschutz">Datenschutz</a>
  </div>
</footer>

<style>
  .site-footer {
    margin-top: auto;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border-color);
  }

  .footer-inner {
    padding: 3rem 2rem 2rem;
    display: grid;
    grid-template-columns: 1.6fr 1fr 1fr 1fr;
    gap: 2.5rem;
  }

  /* Brand column */
  .footer-logo {
    display: inline-block;
    margin-bottom: 0.75rem;
  }
  .footer-logo svg {
    height: 28px;
    width: auto;
  }
  .footer-tagline {
    color: var(--text-muted);
    font-size: 0.95rem;
    line-height: 1.5;
    margin: 0;
  }

  /* Columns */
  .footer-col h4 {
    font-size: 0.85rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin: 0 0 0.85rem;
  }
  .footer-col ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .footer-col li {
    margin: 0;
  }
  .footer-col a,
  .footer-col p {
    display: block;
    padding: 0.25rem 0;
    font-size: 0.95rem;
    color: var(--text-secondary);
    text-decoration: none;
    transition: color 0.15s;
    margin: 0;
  }
  .footer-col a:hover {
    color: var(--culoca-orange);
  }
  .footer-company {
    font-weight: 500;
    color: var(--text-primary) !important;
  }

  /* Bottom bar */
  .footer-bottom {
    padding: 1.25rem 2rem;
    border-top: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
    font-size: 0.875rem;
    color: var(--text-muted);
  }
  .footer-bottom a {
    color: var(--text-muted);
    text-decoration: none;
    transition: color 0.15s;
  }
  .footer-bottom a:hover {
    color: var(--culoca-orange);
  }
  .footer-sep {
    opacity: 0.5;
  }

  @media (max-width: 860px) {
    .footer-inner {
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
    }
  }
  @media (max-width: 520px) {
    .footer-inner {
      grid-template-columns: 1fr;
      gap: 1.5rem;
      padding: 2rem 1.25rem 1.5rem;
    }
    .footer-bottom {
      padding: 1rem 1.25rem;
    }
  }
</style>
