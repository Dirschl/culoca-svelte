<svelte:head>
  <title>Culoca - See You Local | System FAQ</title>
  <meta name="description" content="Entdecke alle Funktionen von Culoca: GPS-basierte Fotogalerie, Open Graph Integration, Account-System, Sicherheit und mehr. Vollständige System-Erklärung der DIRSCHL.com GmbH." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://culoca.com/see-you-local-system-faq" />
  <!-- Open Graph -->
  <meta property="og:title" content="Culoca - See You Local | System FAQ" />
  <meta property="og:description" content="Entdecke alle Funktionen von Culoca: GPS-basierte Fotogalerie, Open Graph Integration, Account-System und mehr." />
  <meta property="og:url" content="https://culoca.com/see-you-local-system-faq" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="DIRSCHL.com GmbH" />
  <meta property="og:locale" content="de_DE" />
  
  <!-- JSON-LD -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Culoca - See You Local | System FAQ",
    "description": "Entdecke alle Funktionen von Culoca: GPS-basierte Fotogalerie, Open Graph Integration, Account-System, Sicherheit und mehr.",
    "url": "https://culoca.com/see-you-local-system-faq",
    "inLanguage": "de",
    "publisher": {
      "@type": "Organization",
      "name": "DIRSCHL.com GmbH",
      "url": "https://culoca.com",
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
    }
  }
  </script>
</svelte:head>

<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { browser } from '$app/environment';
  import SearchBar from '$lib/SearchBar.svelte';
  import FloatingActionButtons from '$lib/FloatingActionButtons.svelte';
  import { goto } from '$app/navigation';
  import InfoPageLayout from '$lib/InfoPageLayout.svelte';

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

<InfoPageLayout 
  currentPage="system"
  title="Culoca - See You Local | System FAQ"
  description="Entdecke alle Funktionen von Culoca: GPS-basierte Fotogalerie, Open Graph Integration, Account-System, Sicherheit und mehr."
>
  <!-- Banner mit zufälligem Querformat-Foto - randlos außerhalb des InfoPageLayout -->
  <svelte:fragment slot="fullwidth">
    {#if bannerImage}
    <div class="banner-section-fullwidth">
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
  </svelte:fragment>

  <h1 class="main-title">Culoca - See You Local | System FAQ</h1>
  
  <p>
    Culoca verwaltet Items die an GPS Koordinaten gebunden sind. In Verdingung mit deiner eigenen Position lässt sich so eine neue Art von sozialen Medien schaffen. Wir nennen es Reverse Social Media, denn hier macht nicht ein Content um berühmt zu werden, sondern viele um nur Dich zu erreichen. Du stehst im Mittelpunkt aller Informationen und Culoca zeigt dir diese an. Wir starten mit einer kleinen Region zwischen München, Oberösterreich und dem Bayerischen Wald und hoffen auf viele neue Culoca User, die das System aktiv mit Material versorgen.
  </p>
  
  <p>
    Du kannst ganz einfach neue Bilder hochladen und so deien Region in das System integrieren. Du hast deine Daten immer dabei und kannst später neue Funktionen wie Shop, Chat etc... teilnehmen. Das System ist aktuell kostenfrei und du kannst dich mit Google, Facebook oder Email im System registrieren um selbst Content erstellen zu können.
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
    
    {#if stats.latestItems.length > 0}
    <div class="latest-items">
      <h3>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; margin-right: 8px;">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
        Newsflash
      </h3>
      
      <p>
        Ganz oben sehen sie die aktuellsten Items. Dieser Bereich kann nach rechts verschoben werden um die Anzahl der geladenen Bilder zu sehen. Er dient Bots dazu, die Seite zu indexieren und wird SSR und Clientseitig gerendert. Wenn ihr selbst uploadet, dann seht ihr hier in Echtzeit eure neuesten Items. Angemeldete User können den Newsflah in den Settings deaktivieren.
      </p>
      
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

  <!-- SEO, JSON-LD & OpenGraph Integration -->
  <section class="seo-section">
    <h2>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; margin-right: 8px;">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </svg>
      SEO, JSON-LD & OpenGraph Integration
    </h2>
    
    <p>
      Die Anwendung ist auf Performance getrimmt, damit die Items aber auch in Suchmaschinen, Sozialen Medien und KI funktionieren, wurden Teile auf SSR umgestellt, damit SEO, Schemas und OpenGraph zu 100% greifen.
    </p>
    
    <p>
      Google Suche, Bildersuche, Facebook, Instagram, WhatsApp, LLMs, Email u.v.m. können Culoca Inhalte direkt darstellen.
    </p>
  </section>

  <!-- OpenGraph Beispiele Section -->
  <section class="opengraph-section">
    
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

  <!-- JSON-LD Strukturierte Daten -->
  <section class="jsonld-section">
    <h2>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; margin-right: 8px;">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14,2 14,8 20,8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10,9 9,9 8,9"/>
      </svg>
      JSON-LD Strukturierte Daten
    </h2>
    
    <p>
      Culoca verwendet moderne JSON-LD (JavaScript Object Notation for Linked Data) Schema.org Markup für maximale Suchmaschinen-Kompatibilität. Diese strukturierten Daten ermöglichen es Google, Bing und anderen Suchmaschinen, Culoca-Inhalte als reichhaltige Snippets mit Bildern, Metadaten und GPS-Koordinaten zu verstehen und anzuzeigen. Die Innovation liegt in der automatischen Generierung von ImageObject-Schemas mit vollständigen EXIF-Daten, Creator-Informationen und geografischen Koordinaten.
    </p>
    
          <div class="jsonld-example">
        <h3>Live JSON-LD von: <a href="https://culoca.com/item/nachts-in-mitterskirchen-herbstbild-rottal-inn-johann-dirschl" target="_blank" rel="noopener">Nachts in Mitterskirchen</a></h3>
        <pre><code>{`{
  "@context": "https://schema.org",
  "@type": "ImageObject",
  "name": "Nachts in Mitterskirchen, Herbstbild, Rottal-Inn",
  "description": "Herbstliche Nachtaufnahme von Mitterskirchen in Niederbayern, Deutschland. Ruhige Abendstimmung mit beleuchteten Häusern und Kirche. Idyllische Landschaft.",
  "contentUrl": "https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/ed0e9820-4206-4da0-beb5-925e6440a835.jpg",
  "thumbnailUrl": "https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/ed0e9820-4206-4da0-beb5-925e6440a835.jpg",
  "width": 9504,
  "height": 6336,
  "encodingFormat": "image/jpeg",
  "uploadDate": "2025-07-15T00:00:00Z",
  "dateCreated": "2023-11-06T00:00:00Z",
  "creator": {
    "@type": "Person",
    "name": "Johann Dirschl",
    "url": "https://www.dirschl.com",
    "email": "johann.dirschl@gmx.de",
    "telephone": "+49-179-9766666",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Waldberg 84",
      "addressLocality": "Reischach",
      "postalCode": "84571",
      "addressCountry": "DE"
    }
  },
  "copyrightHolder": {
    "@type": "Organization",
    "name": "DIRSCHL.com GmbH",
    "url": "https://www.dirschl.com"
  },
  "copyrightNotice": "© 2025 DIRSCHL.com GmbH - Alle Rechte vorbehalten",
  "contentLocation": {
    "@type": "Place",
    "name": "Mitterskirchen, Rottal-Inn, Niederbayern",
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 48.34104,
      "longitude": 12.72582
    },
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Mitterskirchen",
      "addressRegion": "Niederbayern",
      "addressCountry": "DE"
    }
  },
  "keywords": "AbendAtmosphäre,Baum,Bayern,Deutschland,Dorf,Fotografie,Friedlich,Gemeinde,Gemütlich,Herbst,Häuser,Kirche,Landschaft,Mitterskirchen,Nacht,Nachtaufnahme,Natur,Niederbayern,Ortsansicht,Panorama,Region,Reise,Sternenhimmel,Tourismus,beleuchtet,dunkel,idyllisch,ländlich,ruhig",
  "camera": {
    "@type": "Product",
    "name": "SONY ILCE-7RM5",
    "brand": "Sony"
  },
  "lens": {
    "@type": "Product", 
    "name": "Sony FE 135mm F1.8 GM",
    "brand": "Sony"
  },
  "exifData": {
    "focalLength": "135 mm",
    "iso": 100,
    "aperture": "ƒ/1.8",
    "exposureTime": "30 s"
  }
}`}</code></pre>
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

<!-- Floating Action Buttons -->
<FloatingActionButtons />

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

  .opengraph-section {
    margin: 3rem 0;
  }

  .og-examples {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
    margin-top: 2rem;
  }

  .og-example {
    border: 1px solid var(--border-color);
    border-radius: 8px;
    overflow: hidden;
    background: var(--bg-tertiary);
  }

  .og-preview {
    width: 100%;
    height: 200px;
    overflow: hidden;
  }

  .og-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .og-details {
    padding: 1rem;
    display: flex;
    gap: 0.75rem;
  }

  .og-favicon {
    flex-shrink: 0;
  }

  .favicon {
    width: 16px;
    height: 16px;
  }

  .og-text {
    flex: 1;
  }

  .og-text h5 {
    font-size: 0.9rem;
    margin: 0 0 0.25rem 0;
    color: var(--text-primary);
  }

  .og-text p {
    font-size: 0.8rem;
    margin: 0 0 0.25rem 0;
    color: var(--text-secondary);
  }

  .og-link {
    font-size: 0.75rem;
    color: var(--text-tertiary);
    text-transform: lowercase;
  }

  .jsonld-section {
    margin: 3rem 0;
  }

  .jsonld-example {
    margin-top: 2rem;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
    overflow-x: auto;
  }

  .jsonld-example h3 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
    font-size: 1.1rem;
  }

  .jsonld-example h3 a {
    color: var(--accent-color);
    text-decoration: none;
  }

  .jsonld-example h3 a:hover {
    text-decoration: underline;
  }

  .jsonld-example pre {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 1rem;
    overflow-x: auto;
    font-size: 0.85rem;
    line-height: 1.4;
    color: var(--text-secondary);
    margin: 0;
  }

  .jsonld-example code {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    color: var(--text-primary);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .stat-card {
    background: var(--bg-tertiary);
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
    background: var(--bg-tertiary);
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

    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .items-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style> 