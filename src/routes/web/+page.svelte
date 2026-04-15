<svelte:head>
  <title>Galeriemodus, Mobile Ansicht, Items und Nearby Galerie in Culoca - FAQ</title>
  <meta name="description" content="Vollständige Anleitung zu Culoca: Galeriemodus, mobile Ansicht, GPS-Items, Nearby-Funktion, Upload, Account-System und alle Features. FAQ für neue Nutzer und Entdecker." />
  <meta name="keywords" content="Culoca FAQ, Galeriemodus, Mobile Ansicht, GPS Items, Nearby Galerie, Upload Anleitung, Account System, GPS Fotos, lokale Entdeckungen, Reverse Social Media, Culoca Tutorial, Features, Funktionen, Hilfe, Anleitung" />
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
  <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
  <meta name="bingbot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
  <link rel="canonical" href="https://culoca.com/web" />
  
  <!-- Favicon für /web Seite -->
  <link rel="icon" type="image/svg+xml" href="/culoca-icon.svg">
  <link rel="icon" type="image/png" href="/culoca-icon.png" sizes="32x32">
  <link rel="apple-touch-icon" href="/culoca-icon.png" sizes="180x180">
  
  <!-- Open Graph -->
  <meta property="og:title" content="Galeriemodus, Mobile Ansicht, Items und Nearby Galerie in Culoca - FAQ" />
  <meta property="og:description" content="Vollständige Anleitung zu Culoca: Galeriemodus, mobile Ansicht, GPS-Items, Nearby-Funktion, Upload, Account-System und alle Features. FAQ für neue Nutzer und Entdecker." />
  <meta property="og:url" content="https://culoca.com/web" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="DIRSCHL.com GmbH" />
  <meta property="og:locale" content="de_DE" />
  <meta property="og:image" content="https://culoca.com/culoca-see-you-local-entdecke-deine-umgebung.jpg" />
  
  <!-- JSON-LD -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "name": "Galeriemodus, Mobile Ansicht, Items und Nearby Galerie in Culoca - FAQ",
    "description": "Vollständige Anleitung zu Culoca: Galeriemodus, mobile Ansicht, GPS-Items, Nearby-Funktion, Upload, Account-System und alle Features. FAQ für neue Nutzer und Entdecker.",
    "url": "https://culoca.com/web",
    "inLanguage": "de",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Was ist der Galeriemodus in Culoca?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Der Galeriemodus zeigt alle verfügbaren GPS-Items in einer übersichtlichen Galerie-Ansicht an. Nutzer können zwischen verschiedenen Ansichten wechseln und Items nach Entfernung, Datum oder Typ filtern."
        }
      },
      {
        "@type": "Question",
        "name": "Wie funktioniert die Mobile Ansicht?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Die mobile Ansicht ist optimiert für Smartphones und Tablets. Sie bietet Touch-Navigation, GPS-Integration und eine benutzerfreundliche Oberfläche für das Entdecken lokaler Inhalte unterwegs."
        }
      },
      {
        "@type": "Question",
        "name": "Was sind GPS Items in Culoca?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "GPS Items sind Fotos, Videos oder andere Inhalte, die an spezifischen geografischen Koordinaten verankert sind. Sie können von Nutzern entdeckt werden, die sich in der Nähe befinden."
        }
      },
      {
        "@type": "Question",
        "name": "Wie funktioniert die Nearby Galerie?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Die Nearby Galerie zeigt alle GPS-Items in der Umgebung des Nutzers an, sortiert nach Entfernung. So können lokale Entdeckungen und versteckte Orte einfach gefunden werden."
        }
      }
    ],
    "publisher": {
      "@type": "Organization",
      "name": "DIRSCHL.com GmbH",
      "url": "https://culoca.com",
      "logo": "https://culoca.com/culoca-icon.png",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Waldberg 84",
        "addressLocality": "Reischach",
        "postalCode": "84571",
        "addressCountry": "DE"
      },
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": "+49-179-9766666",
        "email": "johann.dirschl@gmx.de"
      }
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
        }
      ]
    }
  }
  </script>
</svelte:head>

<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import InfoPageLayout from '$lib/InfoPageLayout.svelte';
  import NewsFlash from '$lib/NewsFlash.svelte';
  import { getPublicItemHref, PRIMARY_REGIONAL_FEED_PATH } from '$lib/content/routing';

  let stats = {
    totalItems: 0,
    totalUsers: 0,
    topUser: null as any
  };

  let bannerImage = null as any;


  onMount(async () => {
    if (browser) {
      try {
        // Banner-Bild laden (zufälliges Querformat-Foto mit breitestem Seitenverhältnis)
        const { data: bannerData, error: bannerError } = await supabase
          .from('items')
          .select('id, title, slug, canonical_path, path_2048, width, height, profile_id')
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
            .select('id, title, slug, canonical_path, path_2048, width, height, profile_id')
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
            }
          }
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

        stats = {
          totalItems: itemsCount || 0,
          totalUsers: usersCount || 0,
          topUser: topUserData
        };
      } catch (error) {
        console.error('Fehler beim Laden der Daten:', error);
      }
    }
  });

  function goToDetail(item: { slug?: string | null; canonical_path?: string | null; canonicalPath?: string | null }) {
    goto(getPublicItemHref(item));
  }
</script>

<InfoPageLayout 
  currentPage="system"
  title="Culoca - See You Local | System FAQ"
  description="Entdecke alle Funktionen von Culoca: GPS-basierte Fotogalerie, Open Graph Integration, Account-System, Sicherheit und mehr."
>
  <!-- Banner mit zufälligem Querformat-Foto - randlos außerhalb des InfoPageLayout -->
  <svelte:fragment slot="fullwidth">
    {#if bannerImage}
    <div class="banner-section-fullwidth">
      <div class="banner-image-container" on:click={() => goToDetail(bannerImage)}>
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
  </svelte:fragment>

  <h1 class="main-title">Culoca FAQ: Galeriemodus, Mobile Ansicht, GPS Items und Nearby Galerie</h1>
  
  <h2>Was ist Culoca? - Reverse Social Media mit GPS-Items</h2>
  <p>
    Culoca verwaltet <strong>GPS Items</strong> die an geografischen Koordinaten gebunden sind. In Verbindung mit deiner eigenen Position lässt sich so eine neue Art von sozialen Medien schaffen. Wir nennen es <strong>Reverse Social Media</strong>, denn hier macht nicht ein Content um berühmt zu werden, sondern viele um nur Dich zu erreichen. Du stehst im Mittelpunkt aller Informationen und Culoca zeigt dir diese in der <strong>Nearby Galerie</strong> an.
  </p>
  
  <h2>Galeriemodus und Mobile Ansicht</h2>
  <p>
    Der <strong>Galeriemodus</strong> bietet verschiedene Ansichten für deine Entdeckungen. Die <strong>Mobile Ansicht</strong> ist speziell für Smartphones optimiert und ermöglicht es dir, unterwegs lokale GPS-Items zu entdecken. Du kannst ganz einfach neue Bilder hochladen und so deine Region in das System integrieren. Das System ist aktuell kostenfrei und du kannst dich mit Google, Facebook oder Email registrieren.
  </p>

  <hr class="section-divider" />

  <!-- Galerie-Funktionen -->
  <section class="gallery-section">
    <h2>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; margin-right: 8px;">
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
        <circle cx="12" cy="13" r="3"/>
      </svg>
      Galerie-Funktionen
    </h2>
    
    <p>
      Beim ersten Start fragt Culoca nach ihrer GPS Standortfreigabe. Diese ist dann erforderlich, wenn sie die Mobile Galerie verwenden wollen oder Content leichter veröffentlichen wollen. Culoca errechenet die Entfernung von ihnen zu den Items, so daß es eine Art virtueller Reiseführer ist. Sie sehen rechts oben Ihre GPS Adresse, sowie eine letzte GPS Adresse, da dieses nicht immer zuverlässig funktioniert. Klicken sie auf die weisse GPS Adresse, können sie in den mobielen Modus wechseln. Hier deht ihr in Echtzeit die Objekte um euch herum.
    </p>
    
    <p>
      Default, 2 GPS Koordinaten untereinander: Die Standard-Galerie zeigt ALLE Fotos nach Entfernung an. Es ist eine statische Liste in der du endlos scrollen kannst. Ideal für zu Hause oder im Hotel, wenn du deine Umgebung kennenlernenn wilst.
    </p>
    
    <div class="kml-integration">
      <h3>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; margin-right: 8px;">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        Google Earth Integration
      </h3>
      <p>
        Alle Culoca GPS-Items können auch in Google Earth betrachtet werden. Lade die KML-Datei herunter und erkunde deine Umgebung in Google Earth mit allen Culoca-Inhalten.
      </p>
      <a href="/web/google" class="kml-link">
        🗺️ Google Earth KML Download
      </a>
    </div>
    
    <div class="latest-items">
      <h3>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; margin-right: 8px;">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
        Newsflash
      </h3>
      
      <p>
        Der Newsflash zeigt die aktuellsten Items als horizontalen Strip. Er aktualisiert sich automatisch und dient auch Suchmaschinen zur Indexierung. Angemeldete User können den Newsflash in den Settings deaktivieren.
      </p>
      
      <div class="newsflash-embed">
        <NewsFlash mode="alle" layout="strip" limit={10} showToggles={false} showImageCaptions={true} />
      </div>
    </div>
    
    <hr class="section-divider" />
    
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
            <li>Suche nach Titel, Beschreibung, Caption, Keywords</li>
            <li>Filter nach Ersteller, Kategorie, Tags</li>
            <li>Galerietyp Justified & Grid</li>
          </ul>
        </div>
      </div>

      <div class="feature-card">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; margin-right: 8px;">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
            <line x1="12" y1="18" x2="12.01" y2="18"/>
          </svg>
          Mobile Galerie
        </h3>
        <p>
          Wechseln mit GPS Klick (weisse Koordinate):<br>
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
            <li>Galerietyp Justified & Grid</li>
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
          Interaktive Karten oder Satellitenansicht. 
          Fotos werden direkt auf der Karte angezeigt und können 
          per Klick geöffnet werden.
        </p>
        <p>
          Interaktive Karten- und Satellitenansicht. Fotos werden direkt auf der Karte mit Entfernung oder Text angezeigt und können per Klick geöffnet werden.
        </p>
        <div class="feature-example">
          <strong>Features:</strong>
          <ul>
            <li>2 Kartentypen</li>
            <li>Foto-Marker auf Karte</li>
            <li>Zoom & Pan</li>
            <li>Standort-Auswahl</li>
            <li>Wegpunkte Aufzeichnung (Beta)</li>
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

      <div class="feature-card">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; margin-right: 8px;">
            <rect x="4" y="14" width="16" height="6" rx="1"/>
            <line x1="12" y1="14" x2="12" y2="6"/>
            <circle cx="12" cy="6" r="3" fill="currentColor"/>
          </svg>
          Simulation
        </h3>
        <p>
          Lerne Culoca und seine Funktionsweise kennen. In der Simulation können sie das Verhalten der Normalen Galerie und der Mobilen Galerie besser kennenlernen. Klicke auf die GPS Koordinate und fahre mit dem Marker über die Karte. In der Mobilen Version werden Inhalten dynamisch in Planquadraten geladen und verworfen.
        </p>
        <div class="feature-example">
          <strong>Features:</strong>
          <ul>
            <li>Test Normale Galerie</li>
            <li>Test Mobile Galerie</li>
            <li>Test Kartenansicht</li>
            <li>Home = Normale Galerie</li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <hr class="section-divider" />

  <!-- Content-Typen -->
  <section class="content-types-section">
    <h2>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; margin-right: 8px;">
        <path d="M4 6h16M4 12h16M4 18h16"/>
      </svg>
      Content-Typen
    </h2>

    <p>
      Culoca unterstützt verschiedene Inhaltstypen, die jeweils eigene Darstellungen und Funktionen bieten. Jeder Typ hat eine eigene Hub-Seite und kann in der Galerie gefiltert werden.
    </p>

    <div class="content-types-grid">
      <a href={PRIMARY_REGIONAL_FEED_PATH} class="content-type-card">
        <span class="ct-icon">📸</span>
        <h4>Fotos</h4>
        <p>Fotografien und Bilder mit GPS-Koordinaten, EXIF-Daten und automatischer Bildoptimierung</p>
      </a>
      <a href="/event" class="content-type-card">
        <span class="ct-icon">📅</span>
        <h4>Events & Termine</h4>
        <p>Veranstaltungen mit Datum, Zeitraum und Ort. Ideal für lokale Konzerte, Märkte und Feste</p>
      </a>
      <a href="/firma" class="content-type-card">
        <span class="ct-icon">🏢</span>
        <h4>Firmen</h4>
        <p>Unternehmenseinträge mit Kontaktdaten, Webseite und Standort auf der Karte</p>
      </a>
      <a href="/galerie" class="content-type-card">
        <span class="ct-icon">🎬</span>
        <h4>Videos</h4>
        <p>Videomaterial mit Embed-Unterstützung für YouTube, Vimeo und andere Plattformen</p>
      </a>
      <a href="/galerie" class="content-type-card">
        <span class="ct-icon">🎵</span>
        <h4>Musik</h4>
        <p>Audioinhalte mit integriertem Player, ideal für lokale Künstler und Audioguides</p>
      </a>
      <a href="/galerie" class="content-type-card">
        <span class="ct-icon">🤖</span>
        <h4>KI-Bilder</h4>
        <p>KI-generierte Bilder, die ebenfalls an GPS-Koordinaten verankert werden können</p>
      </a>
      <a href="/galerie" class="content-type-card">
        <span class="ct-icon">🔗</span>
        <h4>Links</h4>
        <p>Externe Verweise und Weblinks mit Vorschau, an einen Standort gebunden</p>
      </a>
      <a href="/galerie" class="content-type-card">
        <span class="ct-icon">📝</span>
        <h4>Texte</h4>
        <p>Textbeiträge und Artikel mit HTML-Formatierung und GPS-Verortung</p>
      </a>
    </div>
  </section>

  <hr class="section-divider" />

  <!-- Child-Items / Varianten -->
  <section class="childitems-section">
    <h2>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; margin-right: 8px;">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
      </svg>
      Child-Items & Varianten
    </h2>

    <p>
      Items können als <strong>Varianten</strong> gruppiert werden. Ein Root-Item kann beliebig viele Child-Items haben — z.B. verschiedene Perspektiven eines Ortes, verschiedene Tageszeiten oder Jahreszeiten. In der Galerie wird die Anzahl der Varianten als <strong>+N Badge</strong> angezeigt.
    </p>

    <div class="feature-highlight-grid">
      <div class="feature-highlight">
        <h4>Gruppierung</h4>
        <p>Items werden über eine gemeinsame <code>group_slug</code> verknüpft. Das Root-Item erscheint in der Galerie, die Varianten sind über einen Picker in der Detail-Ansicht erreichbar.</p>
      </div>
      <div class="feature-highlight">
        <h4>Varianten-Picker</h4>
        <p>In der Item-Ansicht können Nutzer zwischen allen Varianten einer Gruppe wechseln. Der Ersteller kann Varianten hinzufügen, verschieben und lösen.</p>
      </div>
      <div class="feature-highlight">
        <h4>Flexible Verwaltung</h4>
        <p>Varianten können jederzeit umgehängt oder aus der Gruppe gelöst werden. Beim Verschieben werden Kind-Items automatisch mit umgehängt.</p>
      </div>
    </div>
  </section>

  <hr class="section-divider" />

  <!-- Firmen & Events -->
  <section class="business-section">
    <h2>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; margin-right: 8px;">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
      Firmen, Events & lokale Inhalte
    </h2>

    <p>
      Culoca ist nicht nur eine Fotoplattform — es ist ein lokales Ökosystem. Firmen können ihren Standort eintragen und mit Fotos, Beschreibungen und Kontaktdaten sichtbar machen. Events und Termine werden mit Zeitraum und Ort dargestellt und erscheinen automatisch in der Nearby-Galerie.
    </p>

    <div class="feature-highlight-grid">
      <div class="feature-highlight">
        <h4>🏢 Firmeneinträge</h4>
        <p>Unternehmen erstellen GPS-verortete Einträge mit Logo, Beschreibung, externer Webseite und Kontaktdaten. Besucher in der Nähe entdecken sie automatisch.</p>
      </div>
      <div class="feature-highlight">
        <h4>📅 Events & Termine</h4>
        <p>Veranstaltungen mit Start- und Enddatum. Lokale Feste, Konzerte, Flohmärkte und mehr erscheinen standortbezogen in der Galerie und auf der Karte.</p>
      </div>
      <div class="feature-highlight">
        <h4>🗺️ Lokale Sichtbarkeit</h4>
        <p>Alle Inhaltstypen werden nach Entfernung zum Nutzer sortiert. Je näher, desto prominenter. So profitieren lokale Anbieter direkt von ihrer Umgebung.</p>
      </div>
    </div>
  </section>

  <hr class="section-divider" />

  <!-- SEO Tool Verweis -->
  <section class="seo-link-section">
    <h2>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; margin-right: 8px;">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </svg>
      SEO, JSON-LD & OpenGraph
    </h2>
    
    <p>
      Die Anwendung ist auf Performance getrimmt, damit die Items aber auch in Suchmaschinen, Sozialen Medien und KI funktionieren, wurden Teile auf SSR umgestellt, damit SEO, Schemas und OpenGraph zu 100% greifen.
    </p>
    
    <p>
      Google Suche, Bildersuche, Facebook, Instagram, WhatsApp, LLMs, Email u.v.m. können Culoca Inhalte direkt darstellen.
    </p>

    <a href="/seo" class="seo-tool-link">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; margin-right: 8px;">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </svg>
      SEO Analyse Tool öffnen
    </a>
  </section>

  <!-- JSON-LD Info (Tool jetzt unter /seo) -->

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
    
    <p>
      Wir erfassen zu den Items die üblichen Besucherdaten und unterscheiden zwischen Anonymen und angemeldeten Usern. Wir sortieren Bot Anfragen aus und speichern als besonderheit die Entfernung des Besuchers zum Item. Das ermöglicht später eine Auswertung nach Nähe, so dass der Erfolg besonders gut messbar ist.
    </p>
  
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

  <p>
    Culoca braucht also keine große Fanbase, sondern Content in einem bestimmten Umkreis und ist damit insb. für den Tourismus interessant.
  </p>

  </section>

  <!-- Profile Sektion -->
  <section class="profile-section">
    <h2>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; margin-right: 8px;">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
      Mach mit, melde dich jetzt an
    </h2>
    
    <p>
      Rechts sehen sie schon unsere FABs (Floatable Access Buttons). Klicke auf das Profil-Icon und nutzte oAuth von Googe, Facebook oder alternativ auch deine Email. Damit könnt ihr dann auch schon eure eigneen, ersten Bilder hochladen und die Anwendung unter Settings für euch individualisieren.
    </p>
    
    <p>
      Angemeldete User können ihren eigenen Accountnamen, Usernamen, Avar, Kontaktdaten und Sozial-Media Links eintragen und auf Wunsch bei ihren eigenen Items anzeigen. So haben andere Benutzer die Möglichkeit euch zu kontaktieren oder zu folgen.
    </p>
  </section>
</InfoPageLayout>

<style>
  .banner-section-fullwidth {
    width: 100%;
    height: 400px;
    position: relative;
    overflow: hidden;
    margin: 0;
    background: var(--bg-primary);
  }

  .feature-card {
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    padding: 1rem;
    border-radius: 7px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
  }

  .feature-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
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
    color: white;
    margin: 0;
  }

  .banner-creator {
    font-size: 1rem;
    color: white;
    margin: 0rem 0 0 0;
  }

  .banner-resolution {
    font-size: 0.8rem;
    color: white;
    margin: 0.25rem 0 0 0;
  }

  .main-title {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 1.5rem 0;
    line-height: 1.2;
    text-align: left;
  }

  p {
    font-size: 16px;
    line-height: 1.6;
    color: var(--text-secondary);
    margin: 0 0 1rem 0;
  }

  .section-divider {
    border: none;
    height: 1px;
    background: var(--border-color);
    margin: 2rem 0;
  }

  .seo-tool-link {
    display: inline-flex;
    align-items: center;
    padding: 0.85rem 1.5rem;
    background: var(--culoca-orange);
    color: white;
    text-decoration: none;
    border-radius: 10px;
    font-weight: 600;
    font-size: 1rem;
    transition: background 0.2s, transform 0.1s;
    margin-top: 0.5rem;
  }

  .seo-tool-link:hover {
    background: #d4621a;
    transform: translateY(-1px);
    color: white;
    text-decoration: none;
  }

  section {
    margin-bottom: 3rem;
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

  /* Newsflash Embed */
  .newsflash-embed {
    margin: 1rem 0;
    border: 1px solid var(--border-color);
    border-radius: 10px;
    overflow: hidden;
  }

  /* Content Types Grid */
  .content-types-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1rem;
    margin-top: 1.5rem;
  }

  .content-type-card {
    display: block;
    padding: 1.25rem;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    text-decoration: none;
    transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
  }

  .content-type-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px var(--shadow);
    border-color: var(--culoca-orange);
  }

  .ct-icon {
    font-size: 2rem;
    display: block;
    margin-bottom: 0.5rem;
  }

  .content-type-card h4 {
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.35rem;
  }

  .content-type-card p {
    font-size: 0.88rem;
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.45;
  }

  /* Feature highlight grid */
  .feature-highlight-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.25rem;
    margin-top: 1.5rem;
  }

  .feature-highlight {
    padding: 1.25rem;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 10px;
  }

  .feature-highlight h4 {
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.5rem;
  }

  .feature-highlight p {
    font-size: 0.92rem;
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.5;
  }

  .feature-highlight code {
    background: var(--bg-secondary);
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    font-size: 0.85rem;
    color: var(--culoca-orange);
  }

  /* Stats */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
    margin: 1.5rem 0;
  }

  .stat-card {
    padding: 1.25rem;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    text-align: center;
  }

  .stat-card h3 {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin: 0 0 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .stat-number {
    font-size: 1.8rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  @media (max-width: 768px) {
    .banner-section-fullwidth {
      height: 250px;
      margin: 0;
    }

    .main-title {
      font-size: 1.5rem;
      margin: 0 0 1rem 0;
    }

    .banner-title {
      font-size: 1rem;
    }

    .feature-grid {
      grid-template-columns: 1fr;
    }

    .content-types-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .feature-highlight-grid {
      grid-template-columns: 1fr;
    }

    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  /* KML Integration Styles */
  .kml-integration {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 1.5rem;
    border-radius: 12px;
    margin: 1.5rem 0;
  }

  .kml-integration h3 {
    color: white;
    margin: 0 0 1rem 0;
    display: flex;
    align-items: center;
  }

  .kml-integration p {
    color: rgba(255, 255, 255, 0.9);
    margin: 0 0 1rem 0;
  }

  .kml-link {
    display: inline-block;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    padding: 0.75rem 1.5rem;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    transition: all 0.3s ease;
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .kml-link:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  }
</style> 
