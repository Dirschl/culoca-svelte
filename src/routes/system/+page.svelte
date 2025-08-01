<svelte:head>
  <title>Culoca System - Vollständige Funktionsübersicht | See You Local</title>
  <meta name="description" content="Entdecke alle Funktionen von Culoca: GPS-basierte Fotogalerie, Open Graph Integration, Account-System, Sicherheit und mehr. Vollständige System-Erklärung." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://culoca.com/system" />
  <!-- Open Graph -->
  <meta property="og:title" content="Culoca System - Vollständige Funktionsübersicht" />
  <meta property="og:description" content="Entdecke alle Funktionen von Culoca: GPS-basierte Fotogalerie, Open Graph Integration, Account-System und mehr." />
  <meta property="og:url" content="https://culoca.com/system" />
  <meta property="og:type" content="website" />
</svelte:head>

<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { browser } from '$app/environment';

  let stats = {
    totalItems: 0,
    totalUsers: 0,
    topUser: null as any,
    latestItems: [] as any[],
    helgolandItems: 0
  };

  onMount(async () => {
    if (browser) {
      try {
        // Statistiken laden
        const { count: itemsCount } = await supabase
          .from('items')
          .select('*', { count: 'exact', head: true });

        const { count: usersCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        // Top User (meiste Items)
        const { data: topUserData } = await supabase
          .from('profiles')
          .select('id, full_name, accountname, items!inner(count)')
          .order('items.count', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Neueste Items
        const { data: latestItems } = await supabase
          .from('items')
          .select('id, title, slug, created_at, path_512')
          .order('created_at', { ascending: false })
          .limit(5);

        // Helgoland Items (Beispiel für GPS-Funktion)
        const { count: helgolandCount } = await supabase
          .from('items')
          .select('*', { count: 'exact', head: true })
          .gte('lat', 54.1)
          .lte('lat', 54.2)
          .gte('lon', 7.8)
          .lte('lon', 8.0);

        stats = {
          totalItems: itemsCount || 0,
          totalUsers: usersCount || 0,
          topUser: topUserData,
          latestItems: latestItems || [],
          helgolandItems: helgolandCount || 0
        };
      } catch (error) {
        console.error('Fehler beim Laden der Statistiken:', error);
      }
    }
  });
</script>

<div class="system-page">
  <header class="system-header">
    <a href="/" class="back-link">← Zurück zur Galerie</a>
    <h1>Culoca System</h1>
    <p class="subtitle">Vollständige Übersicht aller Funktionen und Features</p>
  </header>

  <main class="system-content">
    <!-- Einführung -->
    <section class="intro-section">
      <h2>🎯 Was ist Culoca?</h2>
      <p>
        Culoca ist eine <strong>GPS-basierte Fotogalerie-Plattform</strong>, die es Nutzern ermöglicht, 
        Fotos mit präzisen Standortdaten zu teilen und zu entdecken. Das System kombiniert moderne 
        Web-Technologien mit intelligenten Funktionen für eine optimale Nutzererfahrung.
      </p>
    </section>

    <!-- Kernfunktionen -->
    <section class="features-section">
      <h2>🚀 Kernfunktionen</h2>
      
      <div class="feature-grid">
        <div class="feature-card">
          <h3>📸 GPS-basierte Fotogalerie</h3>
          <p>
            Jedes Foto wird automatisch mit GPS-Koordinaten versehen und kann auf einer interaktiven 
            Karte angezeigt werden. Nutzer können Fotos in ihrer Nähe entdecken oder gezielt nach 
            Standorten suchen.
          </p>
          <div class="feature-example">
            <strong>Beispiel:</strong> Helgoland-Fotos werden automatisch auf der Karte bei den 
            Koordinaten 54.15°N, 7.88°E angezeigt.
          </div>
        </div>

        <div class="feature-card">
          <h3>👤 Persönliche Accounts</h3>
          <p>
            Jeder Nutzer kann einen persönlichen Account erstellen und erhält einen einzigartigen 
            Permalink (z.B. <code>culoca.com/username</code>). Alle Fotos werden dem Account 
            zugeordnet und können über das Profil gefunden werden.
          </p>
        </div>

        <div class="feature-card">
          <h3>🔍 Intelligente Suche</h3>
          <p>
            Das System bietet eine leistungsstarke Suchfunktion, die sowohl nach Titeln, 
            Beschreibungen als auch nach GPS-Standorten sucht. Ergebnisse werden nach Relevanz 
            und Entfernung sortiert.
          </p>
        </div>

        <div class="feature-card">
          <h3>📱 Responsive Design</h3>
          <p>
            Culoca funktioniert perfekt auf allen Geräten - von Smartphones über Tablets bis 
            zu Desktop-Computern. Das Design passt sich automatisch an die Bildschirmgröße an.
          </p>
        </div>
      </div>
    </section>

    <!-- Technische Features -->
    <section class="technical-section">
      <h2>⚙️ Technische Features</h2>
      
      <div class="feature-grid">
        <div class="feature-card">
          <h3>🌐 Open Graph Integration</h3>
          <p>
            Jede Seite unterstützt Open Graph Meta-Tags für optimale Darstellung in sozialen Medien. 
            Fotos werden automatisch mit Titel, Beschreibung und Bild in Facebook, Twitter und 
            anderen Plattformen angezeigt.
          </p>
          <div class="code-example">
            <strong>Meta-Tags Beispiel:</strong>
            <pre><code>&lt;meta property="og:title" content="Foto-Titel" /&gt;
&lt;meta property="og:image" content="https://culoca.com/api/og-image/slug" /&gt;</code></pre>
          </div>
        </div>

        <div class="feature-card">
          <h3>🔗 Dynamische Favicons</h3>
          <p>
            Jedes Foto erhält ein eigenes Favicon, das automatisch aus dem 512px-Thumbnail 
            generiert wird. Dies verbessert die Erkennbarkeit in Browser-Tabs und Lesezeichen.
          </p>
        </div>

        <div class="feature-card">
          <h3>🗺️ Interaktive Karten</h3>
          <p>
            Integration von OpenStreetMap für detaillierte Kartendarstellung. Nutzer können 
            Fotos direkt auf der Karte anzeigen und neue Standorte auswählen.
          </p>
        </div>

        <div class="feature-card">
          <h3>🎤 Audioguide (Mobile)</h3>
          <p>
            Im mobilen 3x3-Modus liest das System automatisch die Titel der Fotos vor. 
            Perfekt für barrierefreie Nutzung und hands-free Bedienung.
          </p>
        </div>
      </div>
    </section>

    <!-- SEO & Performance -->
    <section class="seo-section">
      <h2>🔍 SEO & Performance</h2>
      
      <div class="feature-grid">
        <div class="feature-card">
          <h3>📊 Dynamische Sitemap</h3>
          <p>
            Eine automatisch generierte XML-Sitemap enthält alle öffentlichen Fotos und Seiten. 
            Google crawlt regelmäßig die Sitemap und indexiert neue Inhalte automatisch.
          </p>
        </div>

        <div class="feature-card">
          <h3>⚡ Optimierte Performance</h3>
          <p>
            Bilder werden automatisch in verschiedenen Größen (512px, 64px Thumbnails) generiert 
            und über CDN ausgeliefert. Lazy Loading verbessert die Ladezeiten.
          </p>
        </div>

        <div class="feature-card">
          <h3>🌍 Deutsche Umlaute</h3>
          <p>
            URLs unterstützen korrekte deutsche Umlaute (ä→ae, ö→oe, ü→ue, ß→ss) für 
            bessere Lesbarkeit und SEO-Optimierung.
          </p>
        </div>

        <div class="feature-card">
          <h3>📱 Progressive Web App</h3>
          <p>
            Culoca funktioniert wie eine native App mit Offline-Funktionen, Push-Benachrichtigungen 
            und Installation auf dem Homescreen.
          </p>
        </div>
      </div>
    </section>

    <!-- Sicherheit & Hosting -->
    <section class="security-section">
      <h2>🔒 Sicherheit & Hosting</h2>
      
      <div class="feature-grid">
        <div class="feature-card">
          <h3>🏢 Hetzner Cloud Hosting</h3>
          <p>
            Das System läuft auf hochverfügbaren Hetzner Cloud Servern in Deutschland. 
            Automatische Backups und Monitoring gewährleisten maximale Verfügbarkeit.
          </p>
        </div>

        <div class="feature-card">
          <h3>🔐 Supabase Backend</h3>
          <p>
            Sichere Datenbank mit Row Level Security (RLS). Jeder Nutzer kann nur seine 
            eigenen Daten sehen und bearbeiten. Automatische Authentifizierung und Autorisierung.
          </p>
        </div>

        <div class="feature-card">
          <h3>📦 WebDAV Storage</h3>
          <p>
            Bilder werden über WebDAV-Protokoll auf einem Storage Box gespeichert. 
            UUID-basierte Dateinamen verhindern Konflikte und ermöglichen sichere Übertragung.
          </p>
        </div>

        <div class="feature-card">
          <h3>🛡️ Datenschutz</h3>
          <p>
            Vollständige DSGVO-Konformität mit transparenten Datenschutzerklärungen. 
            Nutzer haben volle Kontrolle über ihre Daten und können diese jederzeit löschen.
          </p>
        </div>
      </div>
    </section>

    <!-- Live-Statistiken -->
    <section class="stats-section">
      <h2>📊 Live-Statistiken</h2>
      
      <div class="stats-grid">
        <div class="stat-card">
          <h3>Gesamt Fotos</h3>
          <div class="stat-number">{stats.totalItems.toLocaleString()}</div>
        </div>
        
        <div class="stat-card">
          <h3>Registrierte Nutzer</h3>
          <div class="stat-number">{stats.totalUsers.toLocaleString()}</div>
        </div>
        
        <div class="stat-card">
          <h3>Helgoland Fotos</h3>
          <div class="stat-number">{stats.helgolandItems.toLocaleString()}</div>
        </div>
        
        {#if stats.topUser}
        <div class="stat-card">
          <h3>Top Nutzer</h3>
          <div class="stat-number">{stats.topUser.full_name || stats.topUser.accountname}</div>
        </div>
        {/if}
      </div>

      {#if stats.latestItems.length > 0}
      <div class="latest-items">
        <h3>Neueste Fotos</h3>
        <div class="items-grid">
          {#each stats.latestItems as item}
          <div class="item-card">
            <img src="https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/{item.path_512}" 
                 alt={item.title || 'Foto'} class="item-thumbnail" />
            <div class="item-info">
              <h4>{item.title || 'Ohne Titel'}</h4>
              <p>{new Date(item.created_at).toLocaleDateString('de-DE')}</p>
            </div>
          </div>
          {/each}
        </div>
      </div>
      {/if}
    </section>

    <!-- Verwendung -->
    <section class="usage-section">
      <h2>📖 Wie verwende ich Culoca?</h2>
      
      <div class="usage-steps">
        <div class="step">
          <div class="step-number">1</div>
          <div class="step-content">
            <h3>Account erstellen</h3>
            <p>Registriere dich kostenlos und wähle einen einzigartigen Accountnamen.</p>
          </div>
        </div>
        
        <div class="step">
          <div class="step-number">2</div>
          <div class="step-content">
            <h3>Fotos hochladen</h3>
            <p>Lade Fotos hoch - GPS-Daten werden automatisch hinzugefügt oder können manuell gesetzt werden.</p>
          </div>
        </div>
        
        <div class="step">
          <div class="step-number">3</div>
          <div class="step-content">
            <h3>Entdecken & Teilen</h3>
            <p>Entdecke Fotos in deiner Nähe oder teile deine eigenen mit der Community.</p>
          </div>
        </div>
        
        <div class="step">
          <div class="step-number">4</div>
          <div class="step-content">
            <h3>Permalink nutzen</h3>
            <p>Dein Account ist unter <code>culoca.com/deinname</code> erreichbar.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Support -->
    <section class="support-section">
      <h2>💬 Support & Kontakt</h2>
      <p>
        Bei Fragen oder Problemen stehen wir gerne zur Verfügung. Das System wird kontinuierlich 
        weiterentwickelt und verbessert, um die beste Nutzererfahrung zu bieten.
      </p>
      
      <div class="contact-info">
        <p><strong>Entwickelt von:</strong> DIRSCHL.com GmbH</p>
        <p><strong>Hosting:</strong> Hetzner Cloud, Deutschland</p>
        <p><strong>Backend:</strong> Supabase (PostgreSQL)</p>
        <p><strong>Frontend:</strong> SvelteKit + TypeScript</p>
      </div>
    </section>
  </main>
</div>

<style>
  .system-page {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .system-header {
    text-align: center;
    margin-bottom: 3rem;
    padding: 2rem 0;
    border-bottom: 2px solid var(--border-color);
  }

  .back-link {
    display: inline-block;
    color: var(--accent-color);
    text-decoration: none;
    margin-bottom: 1rem;
    font-weight: 500;
  }

  .back-link:hover {
    text-decoration: underline;
  }

  .system-header h1 {
    font-size: 2.5rem;
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
  }

  .subtitle {
    font-size: 1.2rem;
    color: var(--text-secondary);
    margin: 0;
  }

  .system-content {
    display: flex;
    flex-direction: column;
    gap: 3rem;
  }

  section {
    background: var(--bg-secondary);
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 2px 10px var(--shadow);
  }

  section h2 {
    font-size: 1.8rem;
    margin: 0 0 1.5rem 0;
    color: var(--text-primary);
    border-bottom: 2px solid var(--accent-color);
    padding-bottom: 0.5rem;
  }

  .feature-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .feature-card {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .feature-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px var(--shadow);
  }

  .feature-card h3 {
    font-size: 1.3rem;
    margin: 0 0 1rem 0;
    color: var(--text-primary);
  }

  .feature-card p {
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0 0 1rem 0;
  }

  .feature-example {
    background: var(--bg-tertiary);
    border-left: 4px solid var(--accent-color);
    padding: 0.75rem;
    border-radius: 4px;
    font-size: 0.9rem;
  }

  .code-example {
    background: var(--bg-tertiary);
    border-radius: 6px;
    padding: 1rem;
    margin-top: 1rem;
  }

  .code-example pre {
    margin: 0;
    font-size: 0.85rem;
    overflow-x: auto;
  }

  .code-example code {
    color: var(--accent-color);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .stat-card {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
    text-align: center;
  }

  .stat-card h3 {
    font-size: 1rem;
    margin: 0 0 0.5rem 0;
    color: var(--text-secondary);
  }

  .stat-number {
    font-size: 2rem;
    font-weight: bold;
    color: var(--accent-color);
  }

  .latest-items {
    margin-top: 2rem;
  }

  .items-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
  }

  .item-card {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    overflow: hidden;
  }

  .item-thumbnail {
    width: 100%;
    height: 120px;
    object-fit: cover;
  }

  .item-info {
    padding: 0.75rem;
  }

  .item-info h4 {
    font-size: 0.9rem;
    margin: 0 0 0.25rem 0;
    color: var(--text-primary);
  }

  .item-info p {
    font-size: 0.8rem;
    color: var(--text-secondary);
    margin: 0;
  }

  .usage-steps {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .step {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  .step-number {
    background: var(--accent-color);
    color: white;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    flex-shrink: 0;
  }

  .step-content h3 {
    font-size: 1.2rem;
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
  }

  .step-content p {
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0;
  }

  .contact-info {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
    margin-top: 1rem;
  }

  .contact-info p {
    margin: 0.5rem 0;
    color: var(--text-secondary);
  }

  @media (max-width: 768px) {
    .system-page {
      padding: 1rem;
    }

    .system-header h1 {
      font-size: 2rem;
    }

    .feature-grid {
      grid-template-columns: 1fr;
    }

    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .items-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style> 