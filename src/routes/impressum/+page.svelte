<script>
  import { goto } from '$app/navigation';
  
  function goBackToApp() {
    goto('/');
  }
</script>

<div class="fullscreen-page">
  <header class="page-header">
    <button class="back-button" on:click={goBackToApp}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.42-1.41L7.83 13H20v-2z"/>
      </svg>
      Zurück zur App
    </button>
  </header>

  <main class="content">
<section id="impressum">
  <h2>Impressum</h2>
  <p><strong>Autor, Herausgeber, Design und technische Umsetzung</strong><br>
  DIRSCHL.com GmbH<br>
  Waldberg 84<br>
  84571 Reischach<br>
  Deutschland</p>
  <p><strong>Geschäftsführer:</strong><br>
  Johann Dirschl</p>
  <p><strong>Kontakt:</strong><br>
  Mobil: 0179 9766666<br>
  Festnetz: 08670 5590127<br>
  E-Mail: <a href="mailto:johann.dirschl@gmx.de">johann.dirschl@gmx.de</a></p>
  <p><strong>Handelsregister:</strong><br>
  Amtsgericht Traunstein, HRB 18130</p>
  <p><strong>USt-IdNr.:</strong><br>
  DE258218256</p>
  <p><strong>Steuernummer:</strong><br>
  141/124/50220</p>
  <p><strong>Verantwortlich für den Inhalt gemäß § 55 Abs. 2 RStV:</strong><br>
  Johann Dirschl<br>
  Waldberg 84<br>
  84571 Reischach</p>
  <p><strong>Social Media:</strong><br>
  <a href="https://www.facebook.com/johann.dirschl" target="_blank" rel="noopener noreferrer">Facebook – DIRSCHL.com GmbH</a></p>
  <h3>Haftungsausschluss</h3>
  <p>Die Inhalte dieser Website wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte übernehmen wir jedoch keine Gewähr. Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte verantwortlich. Für Links auf externe Webseiten übernehmen wir keine Haftung – für deren Inhalte sind ausschließlich deren Betreiber verantwortlich.</p>
  <h3>Datenschutzerklärung</h3>
  <p>Bitte beachten Sie unsere <a href="/datenschutz">Datenschutzerklärung</a>.</p>
  <h3>Allgemeine Geschäftsbedingungen (AGB)</h3>
  <p>Unsere vollständigen AGB finden Sie <a href="/agb">hier</a>.</p>
</section>
  </main>
</div>

<style>
  .fullscreen-page {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .page-header {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    padding: 1rem 2rem;
    background: var(--bg-secondary);
    box-shadow: 0 2px 8px var(--shadow);
  }
  
  .back-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--culoca-orange);
    color: white;
    padding: 0.75rem 1.25rem;
    border-radius: 8px;
    font-weight: 500;
    font-size: 0.9rem;
    transition: background 0.2s;
    border: none;
    cursor: pointer;
  }
  
  .back-button:hover {
    background: var(--accent-color);
  }

  .content {
    flex-grow: 1;
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
  }
  
  section#impressum {
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 1rem;
    line-height: 1.7;
  }

  section#impressum h2 {
    margin: 0 0 2rem 0;
    font-size: 2.5rem;
    color: var(--text-primary);
  }

  section#impressum h3 {
    margin: 2.5rem 0 1rem 0;
    font-size: 1.5rem;
    color: var(--text-primary);
  }

  section#impressum h4 {
    margin: 1.5rem 0 0.5rem 0;
    font-size: 1.2rem;
    color: var(--text-primary);
  }

  section#impressum p,
  section#impressum ul,
  section#impressum li {
    color: var(--text-secondary);
    margin-bottom: 1rem;
    font-size: 1.1rem;
  }

  section#impressum ul {
    margin-left: 1.5rem;
    margin-bottom: 1.5rem;
  }

  section#impressum a {
    color: var(--culoca-orange);
    text-decoration: none;
  }

  section#impressum a:hover {
    color: var(--accent-color);
    text-decoration: underline;
  }

  @media (max-width: 768px) {
    .page-header {
      padding: 1rem;
    }

    .content {
      padding: 1.5rem 1rem;
    }

    section#impressum h2 {
      font-size: 2rem;
      margin-bottom: 1.5rem;
    }

    section#impressum h3 {
      font-size: 1.3rem;
      margin: 2rem 0 0.8rem 0;
    }

    .back-button {
      padding: 0.6rem 1rem;
      font-size: 0.85rem;
    }
  }
</style> 