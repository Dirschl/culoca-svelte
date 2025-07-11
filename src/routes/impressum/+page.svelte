<script lang="ts">
</script>

<svelte:head>
  <title>Impressum - Culoca</title>
  <link rel="icon" type="image/png" href="/culoca-icon.png" />
</svelte:head>

<div class="container">
  <header>
    <a href="/" class="back-link">← Zurück zur Hauptseite</a>
  </header>
  
  <main>
    <section id="impressum">
      <h1>Impressum</h1>
      
      <h3>Angaben gemäß § 5 TMG</h3>
      <p>
        DIRSCHL.com GmbH<br>
        Johann Dirschl<br>
        Waldberg 84<br>
        84571 Reischach<br>
        Deutschland
      </p>
      
      <h3>Kontakt</h3>
      <p>
        Mobil: +49 179 9766666<br>
        Festnetz: +49 8670 5590127<br>
        Büro: +49 8670 8674004<br>
        Fax: +49 8670 8674005<br>
        E-Mail: <a href="mailto:johann.dirschl@gmx.de">johann.dirschl@gmx.de</a>
      </p>
      
      <h3>Handelsregister</h3>
      <p>
        Registergericht: Traunstein<br>
        Registernummer: HRB 18130
      </p>
      
      <h3>Steuernummer</h3>
      <p>Steuernummer: 141/124/50220</p>
      
      <h3>Umsatzsteuer-ID</h3>
      <p>Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz: DE258218256</p>
      
      <h3>Redaktionell verantwortlich</h3>
      <p>Johann Dirschl</p>
      
      <h3>EU-Streitschlichtung</h3>
      <p>Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer">https://ec.europa.eu/consumers/odr/</a><br>
      Unsere E-Mail-Adresse finden Sie oben im Impressum.</p>
      
      <h3>Verbraucher­streit­beilegung/Universal­schlichtungs­stelle</h3>
      <p>Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
      
      <h3>Datenschutzerklärung</h3>
      <p>Bitte beachten Sie unsere <a href="/datenschutz">Datenschutzerklärung</a>.</p>
      
      <h3>Nutzungsbedingungen</h3>
      <p>Mit der Nutzung unserer Website und der Anmeldung über soziale Medien (Facebook, Google) erklären Sie sich mit folgenden Nutzungsbedingungen einverstanden:</p>
      
      <h4>1. Geltungsbereich</h4>
      <p>Diese Nutzungsbedingungen gelten für die Nutzung der Website culoca.com und der damit verbundenen Dienste.</p>
      
      <h4>2. Anmeldung und Nutzerkonto</h4>
      <p>Sie können sich über verschiedene Anmeldeverfahren registrieren:</p>
      <ul>
        <li>E-Mail und Passwort</li>
        <li>Facebook Login (OAuth)</li>
        <li>Google Login (OAuth)</li>
      </ul>
      <p>Bei der Anmeldung über Facebook oder Google werden nur die für den Service notwendigen Daten übertragen (Name, E-Mail-Adresse, Profilbild). Eine Weiterverwendung Ihrer Daten erfolgt nur gemäß unserer Datenschutzerklärung.</p>
      
      <h4>3. Nutzung der Plattform</h4>
      <p>Culoca ist eine Foto-Sharing-Plattform mit GPS-basierten Funktionen. Sie können:</p>
      <ul>
        <li>Fotos mit GPS-Koordinaten hochladen</li>
        <li>Fotos auf einer Karte anzeigen lassen</li>
        <li>Ihre Fotos verwalten und organisieren</li>
        <li>Profile anderer Nutzer einsehen (falls öffentlich)</li>
      </ul>
      
      <h4>4. Verantwortlichkeiten</h4>
      <p>Sie sind verantwortlich für:</p>
      <ul>
        <li>Die Rechtmäßigkeit der hochgeladenen Inhalte</li>
        <li>Die Einhaltung von Urheberrechten</li>
        <li>Die Korrektheit der angegebenen Daten</li>
      </ul>
      
      <h4>5. Haftungsausschluss</h4>
      <p>Wir übernehmen keine Haftung für:</p>
      <ul>
        <li>Von Nutzern hochgeladene Inhalte</li>
        <li>Technische Ausfälle oder Datenverlust</li>
        <li>Schäden durch Nutzung der GPS-Funktionen</li>
      </ul>
      
      <h4>6. Kündigung</h4>
      <p>Sie können Ihr Konto jederzeit löschen. Informationen zur Datenlöschung finden Sie in unserer <a href="/datenschutz">Datenschutzerklärung</a>.</p>
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
  
  p {
    margin-bottom: 1rem;
  }
  
  a {
    color: var(--culoca-orange);
    text-decoration: none;
  }
  
  a:hover {
    color: var(--accent-color);
    text-decoration: underline;
  }
  
  ul {
    margin-bottom: 1rem;
    padding-left: 2rem;
  }
  
  li {
    margin-bottom: 0.5rem;
  }
  
  h4 {
    color: var(--text-primary);
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
    font-size: 1.1rem;
  }
  
  @media (max-width: 768px) {
    .container {
      padding: 1rem;
    }
    
    h1 {
      font-size: 2rem;
    }
  }
</style> 