<script lang="ts">
</script>

<svelte:head>
  <title>Datenlöschung - Culoca</title>
  <link rel="icon" type="image/png" href="/culoca-icon.png" />
</svelte:head>

<div class="container">
  <header>
    <a href="/" class="back-link">← Zurück zur Hauptseite</a>
  </header>
  
  <main>
    <section id="data-deletion">
      <h1>Datenlöschung</h1>
      
      <p>Wenn Sie Ihre Daten aus unserem System löschen möchten, haben Sie verschiedene Optionen:</p>
      
      <h3>1. Löschung über Ihr Culoca-Profil</h3>
      <div class="option-box">
        <ol>
          <li>Loggen Sie sich in Ihr Culoca-Konto ein</li>
          <li>Gehen Sie zu "Profil" → "Einstellungen"</li>
          <li>Klicken Sie auf "Konto löschen"</li>
          <li>Bestätigen Sie die Löschung</li>
        </ol>
      </div>
      
      <h3>2. Löschung per E-Mail</h3>
      <div class="option-box">
        <p>Senden Sie eine E-Mail an <a href="mailto:johann.dirschl@gmx.de">johann.dirschl@gmx.de</a> mit dem Betreff "Datenlöschung" und geben Sie folgende Informationen an:</p>
        <ul>
          <li>Ihren Namen</li>
          <li>Ihre E-Mail-Adresse (mit der Sie sich registriert haben)</li>
          <li>Den Grund der Löschung (optional)</li>
        </ul>
      </div>
      
      <h3>3. Automatische Löschung über Facebook</h3>
      <div class="option-box">
        <p>Wenn Sie die Verbindung zu Culoca über Ihre Facebook-Einstellungen entfernen, werden wir automatisch über die Löschung informiert und Ihre Daten innerhalb von 30 Tagen löschen.</p>
      </div>
      
      <h3>Was wird gelöscht?</h3>
      <div class="deletion-list">
        <ul>
          <li>✓ Ihr Benutzerprofil und alle Profilinformationen</li>
          <li>✓ Alle von Ihnen hochgeladenen Fotos</li>
          <li>✓ Alle Metadaten (EXIF-Daten, GPS-Koordinaten)</li>
          <li>✓ Alle Kommentare und Bewertungen</li>
          <li>✓ Alle Anmeldedaten und Sitzungsinformationen</li>
          <li>✓ Alle Verbindungen zu sozialen Medien</li>
        </ul>
      </div>
      
      <div class="important-note">
        <h4>⏱️ Bearbeitungszeit</h4>
        <p>Ihre Löschungsanfrage wird innerhalb von <strong>30 Tagen</strong> bearbeitet. Sie erhalten eine Bestätigung per E-Mail, sobald die Löschung abgeschlossen ist.</p>
      </div>
      
      <div class="contact-info">
        <h3>Kontakt</h3>
        <p>Bei Fragen zur Datenlöschung wenden Sie sich bitte an:</p>
        <p>
          <strong>DIRSCHL.com GmbH</strong><br>
          <strong>Johann Dirschl</strong><br>
          Waldberg 84<br>
          84571 Reischach<br><br>
          E-Mail: <a href="mailto:johann.dirschl@gmx.de">johann.dirschl@gmx.de</a><br>
          Mobil: +49 179 9766666<br>
          Büro: +49 8670 8674004
        </p>
      </div>
    </section>
  </main>
</div>

<style>
  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    background: var(--bg-primary);
    color: var(--text-primary);
    min-height: 100vh;
  }
  
  header {
    margin-bottom: 2rem;
  }
  
  .back-link {
    color: var(--culoca-orange);
    text-decoration: none;
    font-weight: 500;
    transition: color 0.2s;
  }
  
  .back-link:hover {
    color: var(--accent-color);
    text-decoration: underline;
  }
  
  main {
    line-height: 1.6;
  }
  
  h1 {
    color: var(--text-primary);
    margin-bottom: 2rem;
    font-size: 2.5rem;
  }
  
  h3 {
    color: var(--text-primary);
    margin-top: 2rem;
    margin-bottom: 1rem;
    font-size: 1.25rem;
  }
  
  h4 {
    color: var(--text-primary);
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
    font-size: 1.1rem;
  }
  
  p {
    margin-bottom: 1rem;
  }
  
  .option-box {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }
  
  .deletion-list {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }
  
  .deletion-list ul {
    list-style: none;
    padding: 0;
  }
  
  .deletion-list li {
    margin-bottom: 0.5rem;
    color: var(--text-primary);
  }
  
  .important-note {
    background: #fef3cd;
    border: 1px solid #ffeaa7;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }
  
  .important-note h4 {
    color: #856404;
    margin-top: 0;
  }
  
  .important-note p {
    color: #856404;
    margin-bottom: 0;
  }
  
  .contact-info {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
    margin-top: 2rem;
  }
  
  .contact-info h3 {
    margin-top: 0;
  }
  
  ul {
    margin-bottom: 1rem;
    padding-left: 2rem;
  }
  
  ol {
    margin-bottom: 1rem;
    padding-left: 2rem;
  }
  
  li {
    margin-bottom: 0.5rem;
  }
  
  a {
    color: var(--culoca-orange);
    text-decoration: none;
  }
  
  a:hover {
    color: var(--accent-color);
    text-decoration: underline;
  }
  
  @media (max-width: 768px) {
    .container {
      padding: 1rem;
    }
    
    h1 {
      font-size: 2rem;
    }
    
    .option-box, .deletion-list, .important-note, .contact-info {
      padding: 1rem;
    }
  }
</style> 