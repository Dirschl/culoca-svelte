<script>
  import InfoPageLayout from '$lib/InfoPageLayout.svelte';
</script>

<svelte:head>
  <title>Google Earth KML Download - Alle Culoca GPS Items als Karte | Culoca</title>
  <meta name="description" content="Lade alle Culoca GPS-Items als KML-Datei für Google Earth herunter. Entdecke lokale Fotos, Events und Sehenswürdigkeiten in Google Earth mit direkten Links zu Culoca." />
  <meta name="keywords" content="Culoca KML, Google Earth, GPS Items, Karte, Download, lokale Fotos, Google Earth Integration, GPS Koordinaten, Culoca Karte, Earth Viewer" />
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
  <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
  <meta name="bingbot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
  <link rel="canonical" href="https://culoca.com/web/google" />
  
  <!-- Favicon -->
  <link rel="icon" type="image/svg+xml" href="/culoca-icon.svg" />
  <link rel="icon" type="image/png" href="/culoca-icon.png" sizes="32x32" />
  <link rel="apple-touch-icon" href="/culoca-icon.png" sizes="180x180" />
  
  <!-- Open Graph -->
  <meta property="og:title" content="Google Earth KML Download - Alle Culoca GPS Items als Karte" />
  <meta property="og:description" content="Lade alle Culoca GPS-Items als KML-Datei für Google Earth herunter. Entdecke lokale Fotos, Events und Sehenswürdigkeiten in Google Earth mit direkten Links zu Culoca." />
  <meta property="og:url" content="https://culoca.com/web/google" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Culoca" />
  <meta property="og:locale" content="de_DE" />
  <meta property="og:image" content="https://culoca.com/culoca-see-you-local-entdecke-deine-umgebung.jpg" />
  
  <!-- JSON-LD -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Google Earth KML Download - Alle Culoca GPS Items als Karte",
    "description": "Lade alle Culoca GPS-Items als KML-Datei für Google Earth herunter. Entdecke lokale Fotos, Events und Sehenswürdigkeiten in Google Earth mit direkten Links zu Culoca.",
    "url": "https://culoca.com/web/google",
    "inLanguage": "de",
    "mainEntity": {
      "@type": "SoftwareApplication",
      "name": "Culoca KML Export",
      "description": "Export aller GPS-Items als KML-Datei für Google Earth",
      "applicationCategory": "MapApplication",
      "operatingSystem": "Web Browser, Google Earth",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "EUR"
      }
    },
    "publisher": {
      "@type": "Organization",
      "name": "DIRSCHL.com GmbH",
      "url": "https://culoca.com",
      "logo": "https://culoca.com/culoca-icon.png"
    },
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Startseite",
          "item": "https://culoca.com"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "FAQ & Anleitung",
          "item": "https://culoca.com/web"
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": "Google Earth KML",
          "item": "https://culoca.com/web/google"
        }
      ]
    }
  }
  </script>
</svelte:head>

<InfoPageLayout 
  currentPage="google"
  title="Google Earth KML Download"
  description="Alle Culoca GPS-Items als KML-Datei für Google Earth"
>
  <h1>Google Earth KML Download - Alle Culoca GPS Items</h1>
  
  <div class="kml-download-section">
    <h2>🚀 Culoca GPS-Items in Google Earth</h2>
    <p>
      Entdecke alle öffentlichen Culoca GPS-Items direkt in Google Earth. Wähle zwischen Live-Updates oder Download.
    </p>
    
    <div class="download-options">
      <div class="option-card">
        <h3>📍 Direkt in Google Earth öffnen</h3>
        <p>Öffnet die Culoca-Items sofort in Google Earth (empfohlen)</p>
        <a href="/api/kml/network" class="download-button primary" target="_blank">
          🌍 In Google Earth öffnen
        </a>
        <p class="option-note">Kleines Starter-File mit Live-Updates</p>
      </div>
      
      <div class="option-card">
        <h3>📥 KML-Datei herunterladen</h3>
        <p>Lade die komplette KML-Datei herunter</p>
        <a href="/api/kml" class="download-button secondary" download="culoca-items.kml">
          📥 KML herunterladen
        </a>
        <p class="option-note">Statische Datei mit allen aktuellen Items</p>
      </div>
    </div>
    
    <div class="download-info">
      <strong>Live-Updates:</strong> Network Link aktualisiert sich alle 5 Minuten<br>
      <strong>Format:</strong> KML (Keyhole Markup Language)<br>
      <strong>Kompatibilität:</strong> Google Earth, Google Maps, QGIS, ArcGIS
    </div>
  </div>

  <h2>🗺️ Was ist eine KML-Datei?</h2>
  <p>
    KML (Keyhole Markup Language) ist ein Dateiformat, das geografische Daten für Anwendungen wie Google Earth, Google Maps und andere Kartenprogramme beschreibt. Unsere KML-Datei enthält:
  </p>
  
  <ul class="feature-list">
    <li><strong>GPS-Koordinaten</strong> aller öffentlichen Culoca-Items</li>
    <li><strong>512px Vorschaubilder</strong> für jedes Item</li>
    <li><strong>Direkte Links</strong> zu den Culoca-Items</li>
    <li><strong>Titel und Beschreibungen</strong> der Items</li>
    <li><strong>Kategorisierung</strong> nach Item-Typen</li>
  </ul>

  <h2>📱 Wie verwende ich die Culoca GPS-Items?</h2>
  
  <div class="usage-section">
    <h3>🌍 Direkt in Google Earth öffnen (Empfohlen)</h3>
    <ol>
      <li>Klicke auf "🌍 In Google Earth öffnen"</li>
      <li>Google Earth öffnet sich automatisch</li>
      <li>Alle Culoca-Items werden geladen</li>
      <li>Die Daten aktualisieren sich alle 5 Minuten automatisch</li>
    </ol>
    
    <h3>Google Earth (Desktop) - Manueller Import</h3>
    <ol>
      <li>Lade die KML-Datei herunter</li>
      <li>Öffne Google Earth</li>
      <li>Gehe zu "Datei" → "Öffnen"</li>
      <li>Wähle die heruntergeladene KML-Datei aus</li>
      <li>Alle Culoca-Items werden als Markierungen angezeigt</li>
    </ol>
    
    <h3>Google Earth (Web)</h3>
    <ol>
      <li>Öffne <a href="https://earth.google.com" target="_blank" rel="noopener">earth.google.com</a></li>
      <li>Klicke auf das "Projekte" Symbol (Ordner-Icon)</li>
      <li>Wähle "Import KML-Datei"</li>
      <li>Lade die Culoca KML-Datei hoch</li>
    </ol>
    
    <h3>Google Maps</h3>
    <ol>
      <li>Öffne <a href="https://maps.google.com" target="_blank" rel="noopener">maps.google.com</a></li>
      <li>Klicke auf das Menü (drei Linien)</li>
      <li>Wähle "Deine Orte" → "Karten"</li>
      <li>Klicke "Karte erstellen"</li>
      <li>Importiere die KML-Datei</li>
    </ol>
  </div>

  <h2>🔍 Was findest du in der KML-Datei?</h2>
  
  <div class="content-section">
    <h3>📸 Fotografische Entdeckungen</h3>
    <p>
      Alle öffentlichen Fotos mit GPS-Koordinaten, die von Culoca-Nutzern hochgeladen wurden. 
      Entdecke versteckte Orte, Sehenswürdigkeiten und lokale Highlights.
    </p>
    
    <h3>📍 Präzise Standorte</h3>
    <p>
      Jedes Item ist mit exakten GPS-Koordinaten verknüpft, sodass du die Orte 
      in Google Earth oder anderen Kartenanwendungen genau lokalisieren kannst.
    </p>
    
    <h3>🔗 Direkte Links</h3>
    <p>
      Klicke auf jedes Item in der Karte, um direkt zur vollständigen Culoca-Seite 
      mit allen Details, Kommentaren und weiteren Informationen zu gelangen.
    </p>
    
    <h3>📱 Mobile Optimierung</h3>
    <p>
      Die 512px Vorschaubilder sind perfekt für mobile Geräte optimiert und 
      laden schnell, auch bei langsamen Internetverbindungen.
    </p>
  </div>

  <h2>⚡ Technische Details</h2>
  
  <div class="technical-section">
    <h3>Datenformat</h3>
    <ul>
      <li><strong>Koordinatensystem:</strong> WGS84 (GPS Standard)</li>
      <li><strong>Bildformat:</strong> 512px JPEG Vorschaubilder</li>
      <li><strong>Zeichenkodierung:</strong> UTF-8</li>
      <li><strong>Kompatibilität:</strong> Google Earth, Google Maps, QGIS, ArcGIS</li>
    </ul>
    
    <h3>Datenschutz</h3>
    <p>
      Nur öffentliche Items werden in die KML-Datei aufgenommen. Private oder 
      geschützte Inhalte bleiben ausgeschlossen. Die Datei wird bei jedem 
      Download neu generiert und enthält immer die aktuellsten Daten.
    </p>
    
    <h3>Performance</h3>
    <p>
      Die KML-Datei wird serverseitig generiert und optimiert für schnelle 
      Ladezeiten. Große Bilddateien werden als separate Links bereitgestellt, 
      um die Dateigröße gering zu halten.
    </p>
  </div>

  <div class="cta-section">
    <h2>🎯 Jetzt entdecken!</h2>
    <p>
      Öffne alle Culoca GPS-Items direkt in Google Earth oder lade die KML-Datei herunter. 
      Entdecke deine Umgebung aus einer neuen Perspektive!
    </p>
    
    <div class="cta-buttons">
      <a href="/api/kml/network" class="download-button large primary" target="_blank">
        🌍 In Google Earth öffnen
      </a>
      <a href="/api/kml" class="download-button large secondary" download="culoca-items.kml">
        📥 KML herunterladen
      </a>
    </div>
  </div>
</InfoPageLayout>

<style>
  .kml-download-section {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 2rem;
    border-radius: 12px;
    margin: 2rem 0;
    text-align: center;
  }
  
  .download-button {
    display: inline-block;
    background: #4CAF50;
    color: white;
    padding: 1rem 2rem;
    text-decoration: none;
    border-radius: 8px;
    font-weight: bold;
    font-size: 1.1rem;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);
  }
  
  .download-button:hover {
    background: #45a049;
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(76, 175, 80, 0.4);
  }
  
  .download-button.large {
    font-size: 1.3rem;
    padding: 1.5rem 3rem;
  }
  
  .download-button-container {
    margin: 1.5rem 0;
  }
  
  .download-options {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    margin: 1.5rem 0;
  }
  
  .option-card {
    background: rgba(255, 255, 255, 0.1);
    padding: 1.5rem;
    border-radius: 12px;
    text-align: center;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  .option-card h3 {
    color: white;
    margin: 0 0 0.5rem 0;
    font-size: 1.1rem;
  }
  
  .option-card p {
    color: rgba(255, 255, 255, 0.9);
    margin: 0 0 1rem 0;
    font-size: 0.9rem;
  }
  
  .option-note {
    font-size: 0.8rem !important;
    color: rgba(255, 255, 255, 0.7) !important;
    margin-top: 0.5rem !important;
    font-style: italic;
  }
  
  .download-button.primary {
    background: #4CAF50;
    color: white;
  }
  
  .download-button.primary:hover {
    background: #45a049;
  }
  
  .download-button.secondary {
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
  }
  
  .download-button.secondary:hover {
    background: rgba(255, 255, 255, 0.3);
  }
  
  .cta-buttons {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
  }
  
  .download-info {
    background: rgba(255, 255, 255, 0.1);
    padding: 1rem;
    border-radius: 8px;
    margin-top: 1rem;
    text-align: left;
    display: inline-block;
  }
  
  .feature-list {
    background: var(--bg-secondary);
    padding: 1.5rem;
    border-radius: 8px;
    border-left: 4px solid #667eea;
  }
  
  .feature-list li {
    margin: 0.5rem 0;
  }
  
  .usage-section, .content-section, .technical-section {
    margin: 2rem 0;
  }
  
  .usage-section h3, .content-section h3, .technical-section h3 {
    color: #667eea;
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
  }
  
  .usage-section ol {
    background: var(--bg-secondary);
    padding: 1.5rem;
    border-radius: 8px;
    border-left: 4px solid #4CAF50;
  }
  
  .usage-section ol li {
    margin: 0.5rem 0;
  }
  
  .cta-section {
    background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
    color: white;
    padding: 2rem;
    border-radius: 12px;
    margin: 2rem 0;
    text-align: center;
  }
  
  .technical-section ul {
    background: var(--bg-secondary);
    padding: 1.5rem;
    border-radius: 8px;
    border-left: 4px solid #ff9800;
  }
  
  .technical-section ul li {
    margin: 0.5rem 0;
  }
  
  @media (max-width: 768px) {
    .download-button {
      font-size: 1rem;
      padding: 0.8rem 1.5rem;
    }
    
    .download-button.large {
      font-size: 1.1rem;
      padding: 1.2rem 2rem;
    }
    
    .kml-download-section, .cta-section {
      padding: 1.5rem;
    }
    
    .download-options {
      grid-template-columns: 1fr;
      gap: 1rem;
    }
    
    .cta-buttons {
      flex-direction: column;
      align-items: center;
    }
    
    .cta-buttons .download-button {
      width: 100%;
      max-width: 300px;
    }
  }
</style>
