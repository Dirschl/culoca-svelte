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
  import SearchBar from '$lib/SearchBar.svelte';
  import FloatingActionButtons from '$lib/FloatingActionButtons.svelte';
  import { goto } from '$app/navigation';

  let stats = {
    totalItems: 0,
    totalUsers: 0,
    topUser: null as any,
    latestItems: [] as any[]
  };

  let bannerImage = null as any;

  onMount(async () => {
    if (browser) {
      try {
        // Banner-Bild laden (zufälliges Querformat-Foto)
        const { data: bannerData } = await supabase
          .from('items')
          .select('id, title, slug, path_512, width, height')
          .not('path_512', 'is', null)
          .gte('width', 2000) // Nur große Bilder
          .gte('height', 1000)
          .order('RANDOM()') // Zufällige Auswahl
          .limit(1)
          .maybeSingle();

        if (bannerData) {
          bannerImage = bannerData;
        }

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
          .select('id, full_name, accountname')
          .limit(1)
          .maybeSingle();

        // Neueste Items
        const { data: latestItems } = await supabase
          .from('items')
          .select('id, title, slug, created_at, path_512')
          .order('created_at', { ascending: false })
          .limit(5);

        stats = {
          totalItems: itemsCount || 0,
          totalUsers: usersCount || 0,
          topUser: topUserData,
          latestItems: latestItems || []
        };
      } catch (error) {
        console.error('Fehler beim Laden der Daten:', error);
      }
    }
  });

  function goToDetail(slug: string) {
    goto(`/item/${slug}`);
  }
</script>

<div class="system-page">
  <!-- Header mit Logo und Navigation -->
  <header class="header">
    <div class="header-content">
      <a href="/" class="logo-link">
        <img src="/culoca-logo-512px.png" alt="Culoca" class="logo" />
      </a>
      <h1 class="page-title">Culoca System</h1>
      <p class="page-subtitle">Vollständige Übersicht aller Funktionen</p>
    </div>
  </header>

  <!-- Banner mit zufälligem Querformat-Foto -->
  {#if bannerImage}
  <div class="banner-section">
    <div class="banner-image-container" on:click={() => goToDetail(bannerImage.slug)}>
      <img 
        src="https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/{bannerImage.path_512}" 
        alt={bannerImage.title || 'Banner Bild'} 
        class="banner-image" 
      />
      <div class="banner-overlay">
        <div class="banner-title">{bannerImage.title || 'Ohne Titel'}</div>
      </div>
    </div>
  </div>
  {/if}

  <main class="main-content">
    <!-- Einführung -->
    <section class="intro-section">
      <h2>🎯 Was ist Culoca?</h2>
      <p>
        Culoca ist eine <strong>GPS-basierte Fotogalerie-Plattform</strong>, die es Nutzern ermöglicht, 
        Fotos mit präzisen Standortdaten zu teilen und zu entdecken. Das System kombiniert moderne 
        Web-Technologien mit intelligenten Funktionen für eine optimale Nutzererfahrung.
      </p>
    </section>

    <!-- Galerie-Funktionen -->
    <section class="gallery-section">
      <h2>📸 Galerie-Funktionen</h2>
      
      <div class="feature-grid">
        <div class="feature-card">
          <h3>🖼️ Normale Galerie</h3>
          <p>
            Die Standard-Galerie zeigt Fotos in einem responsiven Grid-Layout. 
            Nutzer können durch Fotos scrollen, nach Standorten filtern und 
            detaillierte Informationen zu jedem Foto anzeigen.
          </p>
          <div class="feature-example">
            <strong>Features:</strong>
            <ul>
              <li>Responsive Grid-Layout</li>
              <li>Infinite Scroll</li>
              <li>Standort-basierte Filterung</li>
              <li>Detaillierte Foto-Informationen</li>
            </ul>
          </div>
        </div>

        <div class="feature-card">
          <h3>📱 Mobile Galerie (3x3)</h3>
          <p>
            Speziell für mobile Geräte optimiert - zeigt 9 Fotos gleichzeitig 
            in einem 3x3 Grid. Perfekt für schnelle Übersicht und Navigation.
          </p>
          <div class="feature-example">
            <strong>Features:</strong>
            <ul>
              <li>3x3 Grid-Layout</li>
              <li>Touch-optimiert</li>
              <li>Audioguide-Unterstützung</li>
              <li>Schnelle Navigation</li>
            </ul>
          </div>
        </div>

        <div class="feature-card">
          <h3>🔍 Item-Ansicht & Nearby</h3>
          <p>
            Detaillierte Ansicht einzelner Fotos mit Nearby-Galerie. 
            Zeigt ähnliche Fotos in der Umgebung und ermöglicht Standort-Filterung.
          </p>
          <div class="feature-example">
            <strong>Features:</strong>
            <ul>
              <li>Nearby-Galerie</li>
              <li>Location Filter</li>
              <li>User Filter</li>
              <li>GPS-Koordinaten</li>
            </ul>
          </div>
        </div>

        <div class="feature-card">
          <h3>🗺️ Kartenansicht</h3>
          <p>
            Interaktive Kartenansicht mit OpenStreetMap-Integration. 
            Fotos werden direkt auf der Karte angezeigt und können 
            per Klick geöffnet werden.
          </p>
          <div class="feature-example">
            <strong>Features:</strong>
            <ul>
              <li>OpenStreetMap Integration</li>
              <li>Foto-Marker auf Karte</li>
              <li>Zoom & Pan</li>
              <li>Standort-Auswahl</li>
            </ul>
          </div>
        </div>

        <div class="feature-card">
          <h3>📤 Bulk Upload</h3>
          <p>
            Massen-Upload von Fotos mit automatischer GPS-Extraktion. 
            Unterstützt Drag & Drop und Batch-Verarbeitung.
          </p>
          <div class="feature-example">
            <strong>Features:</strong>
            <ul>
              <li>Drag & Drop Upload</li>
              <li>Automatische GPS-Extraktion</li>
              <li>Batch-Verarbeitung</li>
              <li>Fortschrittsanzeige</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- SEO & Open Graph -->
    <section class="seo-section">
      <h2>🔍 SEO & Open Graph Integration</h2>
      
      <div class="feature-grid">
        <div class="feature-card">
          <h3>🌐 Open Graph Beispiele</h3>
          <p>
            Jede Seite unterstützt Open Graph Meta-Tags für optimale Darstellung 
            in sozialen Medien. Hier sind echte Beispiele:
          </p>
          
          <div class="og-examples">
            <div class="og-example">
              <h4>📐 Hochformat Fotos</h4>
              <p>
                <strong>Beispiel:</strong> 
                <a href="https://culoca.com/item/baum-am-weiherer-schachten-arbing-reischach-oberbayern-johann-dirschl" target="_blank">
                  Baum am Weiherer Schachten
                </a>
              </p>
              <div class="og-preview">
                <img src="https://culoca.com/api/og-image/baum-am-weiherer-schachten-arbing-reischach-oberbayern-johann-dirschl" 
                     alt="Open Graph Preview - Hochformat" class="og-image" />
              </div>
            </div>

            <div class="og-example">
              <h4>📏 Querformat Fotos</h4>
              <p>
                <strong>Beispiel:</strong> 
                <a href="http://localhost:5173/item/arbing-laerche-richtung-weiher-arbing-gemeinde-reischach-johann-dirschl" target="_blank">
                  Arbing Lärche Richtung Weiher
                </a>
              </p>
              <div class="og-preview">
                <img src="http://localhost:5173/api/og-image/arbing-laerche-richtung-weiher-arbing-gemeinde-reischach-johann-dirschl" 
                     alt="Open Graph Preview - Querformat" class="og-image" />
              </div>
            </div>

            <div class="og-example">
              <h4>🗺️ Kartenausschnitt</h4>
              <p>
                <strong>Beispiel:</strong> 
                <a href="https://culoca.com/map-view-share/cf0390c1-76b6-43f7-a0a6-1c51ff501f8f" target="_blank">
                  Kartenausschnitt mit Fotos
                </a>
              </p>
              <div class="og-preview">
                <img src="https://culoca.com/api/og-image/map-view-share/cf0390c1-76b6-43f7-a0a6-1c51ff501f8f" 
                     alt="Open Graph Preview - Karte" class="og-image" />
              </div>
            </div>
          </div>
        </div>

        <div class="feature-card">
          <h3>🔗 Dynamische Favicons</h3>
          <p>
            Jedes Foto erhält ein eigenes Favicon, das automatisch aus dem 512px-Thumbnail 
            generiert wird. Dies verbessert die Erkennbarkeit in Browser-Tabs.
          </p>
          <div class="feature-example">
            <strong>Beispiel:</strong>
            <code>culoca.com/api/favicon/baum-am-weiherer-schachten-arbing-reischach-oberbayern-johann-dirschl</code>
          </div>
        </div>

        <div class="feature-card">
          <h3>📊 Dynamische Sitemap</h3>
          <p>
            Eine automatisch generierte XML-Sitemap enthält alle öffentlichen Fotos und Seiten. 
            Google crawlt regelmäßig die Sitemap und indexiert neue Inhalte automatisch.
          </p>
          <div class="feature-example">
            <strong>URL:</strong> <code>culoca.com/sitemap.xml</code>
          </div>
        </div>

        <div class="feature-card">
          <h3>🌍 Deutsche Umlaute</h3>
          <p>
            URLs unterstützen korrekte deutsche Umlaute (ä→ae, ö→oe, ü→ue, ß→ss) für 
            bessere Lesbarkeit und SEO-Optimierung.
          </p>
          <div class="feature-example">
            <strong>Beispiel:</strong>
            <code>culoca.com/item/altötting → culoca.com/item/altoetting</code>
          </div>
        </div>
      </div>
    </section>

    <!-- Hetzner Integration -->
    <section class="hetzner-section">
      <h2>🏢 Hetzner Integration</h2>
      
      <div class="feature-grid">
        <div class="feature-card">
          <h3>☁️ Hetzner Cloud Hosting</h3>
          <p>
            Das System läuft auf hochverfügbaren Hetzner Cloud Servern in Deutschland. 
            Automatische Backups und Monitoring gewährleisten maximale Verfügbarkeit.
          </p>
          <div class="feature-example">
            <strong>Features:</strong>
            <ul>
              <li>Hochverfügbare Server</li>
              <li>Automatische Backups</li>
              <li>24/7 Monitoring</li>
              <li>Deutsche Datenschutz-Standards</li>
            </ul>
          </div>
        </div>

        <div class="feature-card">
          <h3>📦 Storage Box Integration</h3>
          <p>
            Bilder werden über WebDAV-Protokoll auf einer Hetzner Storage Box gespeichert. 
            UUID-basierte Dateinamen verhindern Konflikte.
          </p>
          <div class="feature-example">
            <strong>Protokoll:</strong> WebDAV<br>
            <strong>Pfad:</strong> /items/<br>
            <strong>Naming:</strong> UUID-basiert
          </div>
        </div>

        <div class="feature-card">
          <h3>🔐 Supabase Backend</h3>
          <p>
            Sichere Datenbank mit Row Level Security (RLS). Jeder Nutzer kann nur seine 
            eigenen Daten sehen und bearbeiten.
          </p>
          <div class="feature-example">
            <strong>Features:</strong>
            <ul>
              <li>Row Level Security</li>
              <li>Automatische Authentifizierung</li>
              <li>Real-time Updates</li>
              <li>PostgreSQL Backend</li>
            </ul>
          </div>
        </div>

        <div class="feature-card">
          <h3>🛡️ Datenschutz & DSGVO</h3>
          <p>
            Vollständige DSGVO-Konformität mit transparenten Datenschutzerklärungen. 
            Nutzer haben volle Kontrolle über ihre Daten.
          </p>
          <div class="feature-example">
            <strong>Compliance:</strong>
            <ul>
              <li>DSGVO-konform</li>
              <li>Transparente Datenschutzerklärung</li>
              <li>Recht auf Löschung</li>
              <li>Deutsche Server-Standorte</li>
            </ul>
          </div>
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
  </main>

  <!-- Floating Action Buttons -->
  <FloatingActionButtons />
</div>

<style>
  .system-page {
    min-height: 100vh;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .header {
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    padding: 1rem 0;
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .header-content {
    margin: 0 auto;
    padding: 0 2rem;
    display: flex;
    align-items: center;
    gap: 2rem;
  }

  .logo {
    height: 40px;
    width: auto;
  }

  .logo-link {
    text-decoration: none;
  }

  .page-title {
    font-size: 2rem;
    margin: 0;
    color: var(--text-primary);
  }

  .page-subtitle {
    font-size: 1rem;
    color: var(--text-secondary);
    margin: 0;
  }

  .banner-section {
    width: 100%;
    height: 400px;
    position: relative;
    overflow: hidden;
    margin-bottom: 3rem;
  }

  .banner-image-container {
    width: 100%;
    height: 100%;
    position: relative;
    cursor: pointer;
    transition: transform 0.3s ease;
  }

  .banner-image-container:hover {
    transform: scale(1.02);
  }

  .banner-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
  }

  .banner-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.7) 0%, transparent 50%);
    display: flex;
    align-items: flex-end;
    padding: 1.5rem;
  }

  .banner-title {
    font-size: 1.2rem;
    font-weight: 500;
    color: var(--text-primary);
    background: var(--bg-secondary);
    padding: 0.5rem 1rem;
    border-radius: 6px;
    box-shadow: 0 2px 8px var(--shadow);
    backdrop-filter: blur(10px);
    border: 1px solid var(--border-color);
  }

  .main-content {
    margin: 0 auto;
    padding: 2rem;
  }

  section {
    margin-bottom: 3rem;
  }

  section h2 {
    font-size: 1.8rem;
    margin: 0 0 1.5rem 0;
    color: var(--text-primary);
    border-bottom: 2px solid var(--accent-color);
    padding-bottom: 0.5rem;
  }

  .intro-section p {
    font-size: 1.1rem;
    line-height: 1.6;
    color: var(--text-secondary);
  }

  .feature-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
    gap: 2rem;
  }

  .feature-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
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
    padding: 1rem;
    border-radius: 4px;
    font-size: 0.9rem;
  }

  .feature-example ul {
    margin: 0.5rem 0 0 0;
    padding-left: 1.5rem;
  }

  .feature-example li {
    margin: 0.25rem 0;
  }

  .og-examples {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .og-example {
    background: var(--bg-tertiary);
    border-radius: 8px;
    padding: 1rem;
  }

  .og-example h4 {
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
  }

  .og-example p {
    margin: 0 0 1rem 0;
  }

  .og-example a {
    color: var(--accent-color);
    text-decoration: none;
  }

  .og-example a:hover {
    text-decoration: underline;
  }

  .og-preview {
    text-align: center;
  }

  .og-image {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .stat-card {
    background: var(--bg-secondary);
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

  .latest-items h3 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
  }

  .items-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.5rem;
  }

  .item-card {
    background: var(--bg-secondary);
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

  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      gap: 1rem;
      text-align: center;
    }

    .main-content {
      padding: 1rem;
    }

    .banner-section {
      height: 250px;
      margin-bottom: 2rem;
    }

    .banner-title {
      font-size: 1rem;
      padding: 0.4rem 0.8rem;
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