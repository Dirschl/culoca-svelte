<script>
  import InfoPageLayout from '$lib/InfoPageLayout.svelte';
</script>

<InfoPageLayout 
  currentPage="datenschutz"
  title="Datenschutz - DIRSCHL.com GmbH"
  description="Datenschutzerklärung der DIRSCHL.com GmbH - Informationen zur Verarbeitung personenbezogener Daten gemäß DSGVO"
>
  <h1>Datenschutzerklärung</h1>
  
  <h2>1. Datenschutz auf einen Blick</h2>
  
  <h3>Allgemeine Hinweise</h3>
  <p>
    Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten 
    passiert, wenn Sie diese Website besuchen. Personenbezogene Daten sind alle Daten, mit denen Sie 
    persönlich identifiziert werden können.
  </p>
  
  <h3>Datenerfassung auf dieser Website</h3>
  <p>
    Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber. Dessen Kontaktdaten 
    können Sie dem Abschnitt „Hinweis zur Verantwortlichen Stelle" in dieser Datenschutzerklärung entnehmen.
  </p>
  
  <h2>2. Hosting</h2>
  
  <h3>Hetzner Cloud</h3>
  <p>
    Wir hosten unsere Website bei Hetzner Cloud. Anbieter ist die Hetzner Online GmbH, 
    Industriestr. 25, 91710 Gunzenhausen (nachfolgend Hetzner) wenn Sie unsere Website besuchen, 
    erfasst Hetzner verschiedene Logfiles inklusive Ihrer IP-Adressen.
  </p>
  
  <h2>3. Allgemeine Hinweise und Pflichtinformationen</h2>
  
  <h3>Hinweis zur verantwortlichen Stelle</h3>
  <p>
    Die verantwortliche Stelle für die Datenverarbeitung auf dieser Website ist:
  </p>
  <div class="contact-info">
    <h4>Verantwortliche Stelle</h4>
    <ul>
      <li><strong>Firma:</strong> DIRSCHL.com GmbH</li>
      <li><strong>Geschäftsführer:</strong> Johann Dirschl</li>
      <li><strong>Adresse:</strong> Waldberg 84, 84571 Reischach</li>
      <li><strong>Telefon:</strong> <a href="tel:+49-179-9766666">+49-179-9766666</a></li>
      <li><strong>E-Mail:</strong> <a href="mailto:johann.dirschl@gmx.de">johann.dirschl@gmx.de</a></li>
    </ul>
  </div>
  
  <h3>Datenschutz</h3>
  <p>
    Die Betreiber dieser Seiten nehmen den Schutz Ihrer persönlichen Daten sehr ernst. 
    Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend den gesetzlichen 
    Datenschutzvorschriften sowie dieser Datenschutzerklärung.
  </p>
  
  <h3>SSL- bzw. TLS-Verschlüsselung</h3>
  <p>
    Diese Seite nutzt aus Sicherheitsgründen und zum Schutz der Übertragung vertraulicher Inhalte 
    eine SSL-bzw. TLS-Verschlüsselung. Eine verschlüsselte Verbindung erkennen Sie daran, dass die 
    Adresszeile des Browsers von "http://" auf "https://" wechselt und an dem Schloss-Symbol in Ihrer Browserzeile.
  </p>
  
  <h2>4. Datenerfassung auf dieser Website</h2>
  
  <h3>Cookies</h3>
  <p>
    Die Internetseiten verwenden teilweise so genannte Cookies. Cookies richten auf Ihrem Rechner 
    keinen Schaden an und enthalten keine Viren. Cookies dienen dazu, unser Angebot nutzerfreundlicher, 
    effektiver und sicherer zu machen.
  </p>
  
  <h3>Server-Log-Files</h3>
  <p>
    Der Provider der Seiten erhebt und speichert automatisch Informationen in so genannten 
    Server-Log Files, die Ihr Browser automatisch an uns übermittelt. Dies sind:
  </p>
  <ul>
    <li>Browsertyp und Browserversion</li>
    <li>verwendetes Betriebssystem</li>
    <li>Referrer URL</li>
    <li>Hostname des zugreifenden Rechners</li>
    <li>Uhrzeit der Serveranfrage</li>
    <li>IP-Adresse</li>
  </ul>
  
  <h2>5. Ihre Rechte</h2>
  
  <h3>Auskunft, Löschung und Berichtigung</h3>
  <p>
    Sie haben im Rahmen der geltenden gesetzlichen Bestimmungen jederzeit das Recht auf unentgeltliche 
    Auskunft über Ihre gespeicherten personenbezogenen Daten, deren Herkunft und Empfänger und den 
    Zweck der Datenverarbeitung und ggf. ein Recht auf Berichtigung oder Löschung dieser Daten.
  </p>
  
  <h3>Recht auf Datenübertragbarkeit</h3>
  <p>
    Sie haben das Recht, Daten, die wir auf Grundlage Ihrer Einwilligung oder in Erfüllung eines 
    Vertrags automatisiert verarbeiten, an sich oder an einen Dritten in einem gängigen, 
    maschinenlesbaren Format aushändigen zu lassen.
  </p>
  
  <div class="contact-info">
    <h4>Kontakt</h4>
    <p>
      Bei Fragen zur Erhebung, Verarbeitung oder Nutzung Ihrer personenbezogenen Daten wenden 
      Sie sich bitte an:
    </p>
    <ul>
      <li><strong>E-Mail:</strong> <a href="mailto:johann.dirschl@gmx.de">johann.dirschl@gmx.de</a></li>
      <li><strong>Telefon:</strong> <a href="tel:+49-179-9766666">+49-179-9766666</a></li>
    </ul>
  </div>
  
  <div class="warning-box">
    <h4>Wichtiger Hinweis</h4>
    <p>
      Diese Datenschutzerklärung wurde zuletzt am 3. August 2025 aktualisiert. 
      Wir behalten uns vor, diese Datenschutzerklärung anzupassen, damit sie stets den 
      aktuellen rechtlichen Anforderungen entspricht oder um Änderungen unserer Leistungen 
      in der Datenschutzerklärung umzusetzen.
    </p>
  </div>
</InfoPageLayout>

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

  section#datenschutz {
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 1rem;
    line-height: 1.7;
  }

  section#datenschutz h2 {
    margin: 0 0 2rem 0;
    font-size: 2.5rem;
    color: var(--text-primary);
  }

  section#datenschutz h3 {
    margin: 2.5rem 0 1rem 0;
    font-size: 1.5rem;
    color: var(--text-primary);
  }

  section#datenschutz h4 {
    margin: 1.5rem 0 0.5rem 0;
    font-size: 1.2rem;
    color: var(--text-primary);
  }

  section#datenschutz p,
  section#datenschutz ul,
  section#datenschutz li {
    color: var(--text-secondary);
    margin-bottom: 1rem;
    font-size: 1.1rem;
  }

  section#datenschutz ul {
    margin-left: 1.5rem;
    margin-bottom: 1.5rem;
  }

  section#datenschutz a {
    color: var(--culoca-orange);
    text-decoration: none;
  }

  section#datenschutz a:hover {
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

    section#datenschutz h2 {
      font-size: 2rem;
      margin-bottom: 1.5rem;
    }

    section#datenschutz h3 {
      font-size: 1.3rem;
      margin: 2rem 0 0.8rem 0;
    }

    .back-button {
      padding: 0.6rem 1rem;
      font-size: 0.85rem;
    }
  }
</style> 