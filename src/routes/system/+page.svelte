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
  let ogExamples = [] as any[];

  onMount(async () => {
    if (browser) {
      try {
        // Banner-Bild laden (zufälliges Querformat-Foto mit breitestem Seitenverhältnis)
        const { data: bannerData, error: bannerError } = await supabase
          .from('items')
          .select('id, title, slug, path_2048, width, height, profile_id')
          .not('path_2048', 'is', null)
          .not('width', 'is', null)
          .not('height', 'is', null)
          .gt('width', 0)
          .gt('height', 0)
          .order('width', { ascending: false }) // Breiteste zuerst
          .limit(5); // Top 5 breiteste Bilder

        if (bannerError) {
          console.error('Banner-Fehler:', bannerError);
        }

        if (bannerData && bannerData.length > 0) {
          // Zufällige Auswahl aus den 5 breitesten Bildern
          const randomIndex = Math.floor(Math.random() * bannerData.length);
          bannerImage = bannerData[randomIndex];
          
          // Creator-Information laden
          if (bannerImage.profile_id) {
            const { data: creatorData } = await supabase
              .from('profiles')
              .select('full_name, accountname')
              .eq('id', bannerImage.profile_id)
              .maybeSingle();
            
            if (creatorData) {
              bannerImage.creator = creatorData.full_name || creatorData.accountname || 'Unbekannt';
            } else {
              bannerImage.creator = 'Unbekannt';
            }
          } else {
            bannerImage.creator = 'Unbekannt';
          }
          
          console.log('Banner-Bild gefunden (breitestes Seitenverhältnis):', bannerImage);
          console.log('Seitenverhältnis:', bannerImage.width / bannerImage.height);
        } else {
          console.log('Kein Banner-Bild gefunden - versuche Fallback');
          // Fallback: Jedes Bild mit path_2048
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('items')
            .select('id, title, slug, path_2048, width, height, profile_id')
            .not('path_2048', 'is', null)
            .order('created_at', { ascending: false })
            .limit(10);
          
          if (fallbackError) {
            console.error('Fallback-Fehler:', fallbackError);
          }
          
          if (fallbackData && fallbackData.length > 0) {
            // Zufällige Auswahl aus den Fallback-Bildern
            const randomIndex = Math.floor(Math.random() * fallbackData.length);
            bannerImage = fallbackData[randomIndex];
            
            // Creator-Information laden
            if (bannerImage.profile_id) {
              const { data: creatorData } = await supabase
                .from('profiles')
                .select('full_name, accountname')
                .eq('id', bannerImage.profile_id)
                .maybeSingle();
              
              if (creatorData) {
                bannerImage.creator = creatorData.full_name || creatorData.accountname || 'Unbekannt';
              } else {
                bannerImage.creator = 'Unbekannt';
              }
            } else {
              bannerImage.creator = 'Unbekannt';
            }
          }
        }

        // OG Examples laden - genau 1 Hochformat, 1 Querformat und 1 Map Share
        const { data: allItems, error: itemsError } = await supabase
          .from('items')
          .select('id, title, slug, width, height, profile_id, description')
          .not('slug', 'is', null)
          .not('width', 'is', null)
          .not('height', 'is', null)
          .gt('width', 0)
          .gt('height', 0)
          .order('created_at', { ascending: false })
          .limit(50);

        if (itemsError) {
          console.error('OG Examples Fehler:', itemsError);
        }

        if (allItems && allItems.length > 0) {
          // Trenne in Hoch- und Querformat
          const portraitItems = allItems.filter(item => item.height > item.width);
          const landscapeItems = allItems.filter(item => item.width > item.height);
          
          // Wähle genau 1 Hochformat und 1 Querformat
          const selectedItems = [];
          
          if (portraitItems.length > 0) {
            const randomPortrait = portraitItems[Math.floor(Math.random() * portraitItems.length)];
            selectedItems.push(randomPortrait);
          }
          
          if (landscapeItems.length > 0) {
            const randomLandscape = landscapeItems[Math.floor(Math.random() * landscapeItems.length)];
            selectedItems.push(randomLandscape);
          }
          
          // Füge Map Share als drittes Item hinzu
          const { data: mapShareData } = await supabase
            .from('map_shares')
            .select('id, title, description, screenshot_url')
            .eq('id', '7dc738c4-9ea1-4859-a2e3-761d43e6d253')
            .single();
          
          if (mapShareData) {
            selectedItems.push({
              id: 'map-share',
              title: mapShareData.title,
              slug: `map-view-share/${mapShareData.id}`,
              width: 1200,
              height: 630,
              creator: 'Culoca',
              description: mapShareData.description,
              screenshot_url: mapShareData.screenshot_url
            });
          }
          
          // Creator-Informationen für echte Items laden
          for (const item of selectedItems) {
            if (item.id !== 'map-share' && item.profile_id) {
              const { data: creatorData } = await supabase
                .from('profiles')
                .select('full_name, accountname')
                .eq('id', item.profile_id)
                .maybeSingle();
              
              if (creatorData) {
                item.creator = creatorData.full_name || creatorData.accountname || 'Unbekannt';
              } else {
                item.creator = 'Unbekannt';
              }
            }
          }
          
          ogExamples = selectedItems;
          console.log('OG Examples geladen:', ogExamples);
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
    </div>
  </header>

  <!-- Banner mit zufälligem Querformat-Foto -->
  {#if bannerImage}
  <div class="banner-section">
    <div class="banner-image-container" on:click={() => goToDetail(bannerImage.slug)}>
      <img 
        src="https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/{bannerImage.path_2048}" 
        alt={bannerImage.title || 'Banner Bild'} 
        class="banner-image" 
      />
      <div class="banner-overlay">
        <p class="banner-title">{bannerImage.title || 'Ohne Titel'}</p>
        <p class="banner-creator">{bannerImage.creator}</p>
        <p class="banner-resolution">{bannerImage.width} x {bannerImage.height} px</p>
      </div>
    </div>
  </div>
  {/if}



  <main class="main-content">
    <!-- Galerie-Funktionen -->
    <section class="gallery-section">
      <h2>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; margin-right: 8px;">
          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
          <circle cx="12" cy="13" r="3"/>
        </svg>
        Galerie-Funktionen
      </h2>
      
      <div class="feature-grid">
        <div class="feature-card">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; margin-right: 8px;">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21,15 16,10 5,21"/>
            </svg>
            Normale Galerie
          </h3>
          <p>
            Default, 2 GPS Koordinaten untereinander:<br>
            Die Standard-Galerie zeigt ALLE Fotos nach Entfernung an. 
            Es ist eine statische Liste in der du endlos scrollen kannst. 
            Ideal für zu Hause oder im hotel, wenn du eine Umgebung kennenlernenn wilst.
          </p>
          <div class="feature-example">
            <strong>Features:</strong>
            <ul>
              <li>Responsive Layout</li>
              <li>Infinite Scroll</li>
            </ul>
          </div>
        </div>

        <div class="feature-card">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; margin-right: 8px;">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            Mobile Galerie
          </h3>
          <p>
            Aktivieren duch GPS Klick (eine Koordinate):<br>
            Deine Position verändert sich, weil du am Wandern, Fahren etc... bist?
            Hier werden die Items dynamisch nach deiner Position geladen und clientseitig sortiert.
            So siehst du immer das aktuelle Umfeld.
          </p>
          <div class="feature-example">
            <strong>Features:</strong>
            <ul>
              <li>Intelligente Sortierung</li>
              <li>Lädt Umkreis von ca. 5 km.</li>
              <li>für Unterwegs optimiert</li>
              <li>Audioguide-Möglichkeit</li>
            </ul>
          </div>
        </div>

        <div class="feature-card">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; margin-right: 8px;">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            Item-Ansicht & Nearby
          </h3>
          <p>
            Detaillierte Ansicht einzelner Fotos mit Nearby-Galerie. 
            Zeigt Items in der Umgebung und ermöglicht Standort-Filterung.
            Standort wird mit dem Culoca Icon in der Buttonleiste aktiviert, so kannst du entfernte Locations Filtern.
            User Filter: Klicke auf den Avatar des Erstellers um nur seine Items zu sehen.
          </p>
          <div class="feature-example">
            <strong>Features:</strong>
            <ul>
              <li>Nearby-Galerie</li>
              <li>Location Filter</li>
              <li>User Filter</li>
              <li>GPS-Koordinaten</li>
              <li>Live-Editieren für Ersteller</li>
              <li>Hetzner Download für Ersteller</li>
            </ul>
          </div>
        </div>

        <div class="feature-card">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; margin-right: 8px;">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2"/>
              <line x1="8" y1="2" x2="8" y2="18"/>
              <line x1="16" y1="6" x2="16" y2="22"/>
            </svg>
            Kartenansicht
          </h3>
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
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; margin-right: 8px;">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16,6 12,2 8,6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            Bulk Upload
          </h3>
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
      <h2>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; margin-right: 8px;">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        SEO & Open Graph Integration
      </h2>
      
      <div class="feature-grid">
        <div class="feature-card">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; margin-right: 8px;">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Open Graph Beispiele
          </h3>
          <p>
            Jede Seite unterstützt Open Graph Meta-Tags für optimale Darstellung 
            in sozialen Medien. Hier sind echte Beispiele:
          </p>
        </div>

        <div class="feature-card">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; margin-right: 8px;">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16,6 12,2 8,6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            Dynamische Sitemap
          </h3>
          <p>
            Automatisch generierte XML-Sitemap mit allen öffentlichen Fotos. 
            Wird von Suchmaschinen automatisch gecrawlt und aktualisiert.
          </p>
          <div class="feature-example">
            <strong>Features:</strong>
            <ul>
              <li>Automatische Generierung</li>
              <li>Alle öffentlichen Fotos</li>
              <li>SEO-optimiert</li>
              <li>Google-kompatibel</li>
            </ul>
          </div>
        </div>

        <div class="feature-card">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; margin-right: 8px;">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            Datenschutz & DSGVO
          </h3>
          <p>
            Vollständige DSGVO-Konformität mit transparenten Datenschutzrichtlinien 
            und Benutzerrechten.
          </p>
          <div class="feature-example">
            <strong>Features:</strong>
            <ul>
              <li>DSGVO-konform</li>
              <li>Transparente Datenschutzerklärung</li>
              <li>Benutzerrechte</li>
              <li>Datenlöschung</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- Hetzner Integration -->
    <section class="hetzner-section">
      <h2>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; margin-right: 8px;">
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
          </svg>
          Hetzner Cloud Hosting
        </h2>
        
        <div class="feature-grid">
          <div class="feature-card">
            <h3>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; margin-right: 8px;">
                <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
              </svg>
              Hetzner Cloud Hosting
            </h3>
            <p>
              Professionelles Hosting auf deutschen Servern mit hoher Verfügbarkeit 
              und DSGVO-konformer Datenverarbeitung.
            </p>
            <div class="feature-example">
              <strong>Features:</strong>
              <ul>
                <li>Deutsche Server</li>
                <li>99.9% Uptime</li>
                <li>DSGVO-konform</li>
                <li>Automatische Backups</li>
              </ul>
            </div>
          </div>

          <div class="feature-card">
            <h3>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; margin-right: 8px;">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              Datenschutz & DSGVO
            </h3>
            <p>
              Vollständige DSGVO-Konformität mit transparenten Datenschutzrichtlinien 
              und Benutzerrechten.
            </p>
            <div class="feature-example">
              <strong>Features:</strong>
              <ul>
                <li>DSGVO-konform</li>
                <li>Transparente Datenschutzerklärung</li>
                <li>Benutzerrechte</li>
                <li>Datenlöschung</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <!-- OpenGraph Beispiele Section -->
      <section class="opengraph-section">
        <h2>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; margin-right: 8px;">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          OpenGraph Beispiele
        </h2>
        <p>So werden Culoca-Inhalte in sozialen Netzwerken angezeigt:</p>
        
        <div class="og-examples">
          {#each ogExamples as item}
          <div class="og-example">
            <div class="og-preview">
              {#if item.id === 'map-share'}
                <img src={item.screenshot_url} 
                     alt="Open Graph Preview - Karte" class="og-image" />
              {:else}
                <img src={`/api/og-image/${item.slug}`} 
                     alt="Open Graph Preview - {item.width > item.height ? 'Querformat' : 'Hochformat'}" class="og-image" />
              {/if}
            </div>
            <div class="og-details">
              <div class="og-favicon">
                {#if item.id === 'map-share'}
                  <img src="/culoca-favicon.svg" alt="Favicon" class="favicon" />
                {:else}
                  <img src={`/api/favicon/${item.slug}`} alt="Favicon" class="favicon" />
                {/if}
              </div>
              <div class="og-text">
                <h5>{item.title || 'Ohne Titel'}{item.id !== 'map-share' ? ', ' + item.creator : ''}</h5>
                <p>{item.description || 'Keine Beschreibung verfügbar.'}</p>
                <span class="og-link">https://culoca.com/{item.id === 'map-share' ? item.slug : 'item/' + item.slug}</span>
              </div>
            </div>
          </div>
          {/each}
        </div>
      </section>

      <!-- Live-Statistiken -->
      <section class="stats-section">
        <h2>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; margin-right: 8px;">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          Live-Statistiken
        </h2>
      
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
    /*transform: scale(1.02);*/
  }

  .banner-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* 2-Spaltiges Layout */
  .two-column-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3rem;
    width: 100%;
    margin: 0;
    padding: 0 2rem;
  }

  .column-left,
  .column-right {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .content-section {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 1.5rem;
    transition: all 0.3s ease;
  }

  .content-section:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  }

  .content-section h1 {
    font-size: 2.5rem;
    margin: 0 0 1rem 0;
    color: var(--text-primary);
    line-height: 1.2;
  }

  .content-section h2 {
    font-size: 1.5rem;
    margin: 0 0 1rem 0;
    color: var(--text-primary);
    line-height: 1.3;
  }

  .subtitle {
    font-size: 1.2rem;
    color: var(--text-secondary);
    margin: 0 0 2rem 0;
    font-weight: 500;
  }

  .content-section p {
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0 0 1rem 0;
  }

  .content-section ul {
    margin: 1rem 0;
    padding-left: 1.5rem;
  }

  .content-section li {
    margin: 0.5rem 0;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .two-column-layout {
      grid-template-columns: 1fr;
      gap: 2rem;
      padding: 0 1rem;
    }

    .content-section h1 {
      font-size: 2rem;
    }

    .content-section h2 {
      font-size: 1.3rem;
    }
  }

  .banner-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.7) 0%, transparent 50%);
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: 1.5rem;
  }

  .banner-title {
    font-size: 1.2rem;
    font-weight: 500;
    color: var(--text-primary);
    margin: 0;
  }

  .banner-creator {
    font-size: 1rem;
    color: var(--text-primary);
    margin: 0rem 0 0 0;
  }

  .banner-resolution {
    font-size: 0.8rem;
    color: var(--text-primary);
    margin: 0.25rem 0 0 0;
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

  .intro-section {
    text-align: center;
  }

  .intro-title {
    font-size: 2rem;
    margin-bottom: 1rem;
    color: var(--text-primary);
  }

  .intro-text {
    font-size: 1.1rem;
    line-height: 1.6;
    color: var(--text-secondary);
    margin: 0;
  }

  .feature-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
    gap: 2rem;
  }

  .feature-card {
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
    margin: 0;
    padding: 0;
  }

  .feature-example ul {
    margin: 0.5rem 0 0 0;
    padding-left: 1.5rem;
  }

  .feature-example li {
    margin: 0.25rem 0;
  }

  .opengraph-section {
    margin: 3rem 0;
  }

  .og-examples {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2rem;
    margin-top: 2rem;
  }

  @media (max-width: 768px) {
    .og-examples {
      grid-template-columns: 1fr;
    }
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

  .og-details {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    margin-top: 1rem;
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }

  .og-favicon {
    flex-shrink: 0;
  }

  .favicon {
    width: 32px;
    height: 32px;
    border-radius: 4px;
  }

  .og-text {
    flex: 1;
    min-width: 0;
  }

  .og-text h5 {
    font-size: 0.9rem;
    font-weight: 600;
    margin: 0 0 0.25rem 0;
    color: var(--text-primary);
    line-height: 1.3;
  }

  .og-text p {
    font-size: 0.8rem;
    margin: 0 0 0.5rem 0;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  .og-link {
    font-size: 0.75rem;
    color: var(--text-tertiary);
    text-transform: lowercase;
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