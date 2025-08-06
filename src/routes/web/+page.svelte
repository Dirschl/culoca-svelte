<svelte:head>
  <title>Culoca - See You Local - Entdecke deine Umgebung</title>
  <meta name="description" content="Alles, was du über Culoca wissen willst: Schnapp dir dein Handy, erkunde deine Umgebung, teile Momente und sammle lokale Schätze. FAQ für Entdecker!" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://culoca.com/see-you-local-system-faq" />
  
  <!-- Favicon für /web Seite -->
  <link rel="icon" type="image/svg+xml" href="/culoca-favicon.svg">
  <link rel="icon" type="image/png" href="/culoca-icon.png" sizes="32x32">
  <link rel="apple-touch-icon" href="/culoca-icon.png" sizes="180x180">
  
  <!-- Open Graph -->
  <meta property="og:title" content="Culoca - See You Local - Entdecke deine Umgebung" />
  <meta property="og:description" content="Alles, was du über Culoca wissen willst: Schnapp dir dein Handy, erkunde deine Umgebung, teile Momente und sammle lokale Schätze. FAQ für Entdecker!" />
  <meta property="og:url" content="https://culoca.com/see-you-local-system-faq" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="DIRSCHL.com GmbH" />
  <meta property="og:locale" content="de_DE" />
  <meta property="og:image" content="https://culoca.com/culoca-see-you-local-entdecke-deine-umgebung.jpg" />
  
  <!-- JSON-LD -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Culoca - See You Local - Entdecke deine Umgebung",
    "description": "Alles, was du über Culoca wissen willst: Schnapp dir dein Handy, erkunde deine Umgebung, teile Momente und sammle lokale Schätze. FAQ für Entdecker!",
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
  //import FloatingActionButtons from '$lib/FloatingActionButtons.svelte';
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

  // JSON-LD Test Feature
  let testUrl = '';
  let jsonLdData = '';
  let isLoading = false;
  let error = '';

  // HTML Head Test Feature
  let headData = null;
  let isHeadLoading = false;
  let headError = '';
          let activeTab = 'images';
  
  // Editierbare SEO-Textfelder
  let editableTitle = '';
  let editableDescription = '';
  let editableCaption = '';
  let editablePageType = 'WebPage';
  let editableKeywords = '';
  let editableAuthor = '';
  let editableLocation = '';

  function clearInput() {
    testUrl = '';
    headData = null;
    jsonLdData = '';
    error = '';
    isLoading = false;
  }

  function handleUrlSubmit(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      fetchHeadData();
    }
  }

  async function copyPrompt() {
    const promptText = `Bitte ändere auf der Seite ${testUrl} den Title auf "${editableTitle || headData?.title || 'Titel eingeben'}" und die Description auf "${editableDescription || headData?.metaTags?.find(tag => tag.name === 'description' || tag.property === 'og:description')?.content || 'Description eingeben'}"`;
    
    try {
      await navigator.clipboard.writeText(promptText);
      // Optional: Zeige eine kurze Bestätigung
      const copyButton = document.querySelector('.copy-button') as HTMLElement;
      if (copyButton) {
        const originalHTML = copyButton.innerHTML;
        copyButton.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        `;
        setTimeout(() => {
          copyButton.innerHTML = originalHTML;
        }, 1000);
      }
    } catch (err) {
      console.error('Fehler beim Kopieren:', err);
    }
  }

  async function copyAdvancedPrompt() {
    const promptText = `Bitte optimiere die SEO-Daten für die Seite ${testUrl}:

Title: "${editableTitle || headData?.title || 'Titel eingeben'}"
Description: "${editableDescription || headData?.metaTags?.find(tag => tag.name === 'description' || tag.property === 'og:description')?.content || 'Description eingeben'}"
Caption: "${editableCaption || headData?.metaTags?.find(tag => tag.name === 'caption' || tag.property === 'og:caption')?.content || 'Caption eingeben'}"
Seitentyp: ${editablePageType}
Keywords: "${editableKeywords || headData?.metaTags?.find(tag => tag.name === 'keywords')?.content || 'Keywords eingeben'}"
Autor: "${editableAuthor || headData?.metaTags?.find(tag => tag.name === 'author' || tag.property === 'og:author')?.content || 'Autor eingeben'}"
Standort: "${editableLocation || headData?.metaTags?.find(tag => tag.name === 'geo.region' || tag.property === 'og:locale')?.content || 'Standort eingeben'}"

Bitte optimiere alle diese Felder für maximale SEO-Performance und erstelle auch das entsprechende JSON-LD Schema.`;
    
    try {
      await navigator.clipboard.writeText(promptText);
      // Optional: Zeige eine kurze Bestätigung
      const copyButton = document.querySelector('.copy-button') as HTMLElement;
      if (copyButton) {
        const originalHTML = copyButton.innerHTML;
        copyButton.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        `;
        setTimeout(() => {
          copyButton.innerHTML = originalHTML;
        }, 1000);
      }
    } catch (err) {
      console.error('Fehler beim Kopieren:', err);
    }
  }

  async function fetchHeadData() {
    if (!testUrl.trim()) {
      error = 'Bitte gib eine URL ein';
      return;
    }

    // Remove URL validation - allow any URL for testing
    // if (!testUrl.includes('culoca.com')) {
    //   error = 'Fehler: Bitte gib eine gültige Culoca Item URL ein (z.B. https://culoca.com/item/...)';
    //   return;
    // }

    isLoading = true;
    error = '';
    headError = '';
    headData = null;
    jsonLdData = '';

    try {
      // Use our server-side API to avoid CORS issues
      const response = await fetch(`/api/test-head?url=${encodeURIComponent(testUrl)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        headData = result;
        
        // Initialisiere editierbare Felder mit den ursprünglichen Werten
        editableTitle = result.title || '';
        const description = result.metaTags?.find(tag => tag.name === 'description' || tag.property === 'og:description')?.content;
        editableDescription = description || '';
        
        // Erweiterte Felder initialisieren
        const caption = result.metaTags?.find(tag => tag.name === 'caption' || tag.property === 'og:caption')?.content;
        editableCaption = caption || '';
        
        // JSON-LD Daten sind optional - setze Standard-Werte
        const pageType = result.jsonLdData?.[0]?.data?.['@type'] || 'WebPage';
        editablePageType = pageType;
        
        const keywords = result.metaTags?.find(tag => tag.name === 'keywords')?.content;
        editableKeywords = keywords || '';
        
        const author = result.metaTags?.find(tag => tag.name === 'author' || tag.property === 'og:author')?.content;
        editableAuthor = author || '';
        
        const location = result.metaTags?.find(tag => tag.name === 'geo.region' || tag.property === 'og:locale')?.content;
        editableLocation = location || '';
        
        // Also fetch JSON-LD data
        await fetchJsonLd();
      } else {
        throw new Error(result.error || 'Unbekannter Fehler');
      }
      
    } catch (err: any) {
      headError = err.message || 'Fehler beim Laden der HTML Head Daten';
    } finally {
      isHeadLoading = false;
    }
  }

  async function fetchJsonLd() {
    if (!testUrl.trim()) {
      error = 'Bitte gib eine URL ein';
      return;
    }

    isLoading = true;
    error = '';
    jsonLdData = '';

    try {
      // Use our server-side API to avoid CORS issues
      const response = await fetch(`/api/test-jsonld?url=${encodeURIComponent(testUrl)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const result = await response.json();
      
              if (result.success) {
          // Speichere JSON-LD Daten in headData für die SEO-Analyse
          if (headData) {
            headData.jsonLdData = result.jsonLdData;
          }
          
          // Format all JSON-LD data found
          let formattedData = `Gefunden: ${result.totalFound} JSON-LD Strukturen\n`;
          formattedData += `Gültig: ${result.validCount}, Fehler: ${result.errorCount}\n\n`;
          
          // Add each valid JSON-LD structure
          result.jsonLdData.forEach((item: any, index: number) => {
            formattedData += `=== ${item.index}. ${item.type}: ${item.name} ===\n`;
            formattedData += item.formatted;
            formattedData += '\n\n';
          });
          
          // Add any errors
          if (result.errors && result.errors.length > 0) {
            formattedData += '=== FEHLER ===\n';
            result.errors.forEach((err: any) => {
              formattedData += `${err.index}. ${err.error}: ${err.content}\n`;
            });
          }
          
          jsonLdData = formattedData;
        } else {
          // JSON-LD nicht gefunden ist kein Fehler - setze Standard-Werte
          if (headData) {
            headData.jsonLdData = [];
          }
          jsonLdData = 'Keine JSON-LD Daten gefunden';
        }
      
    } catch (err: any) {
      error = err.message || 'Fehler beim Laden der JSON-LD Daten';
    } finally {
      isLoading = false;
    }
  }

  // Auto-execute first example on page load
  onMount(async () => {
    // Set the example URL and execute it automatically
    testUrl = 'https://culoca.com/item/nachts-in-mitterskirchen-herbstbild-rottal-inn-johann-dirschl';
    await fetchHeadData();
  });

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
              slug: mapShareData.id,
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

  <h1 class="main-title">Culoca - See You Local, Entdecke deine Umgebung</h1>
  
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
        <a href="/item/{item.slug}" class="item-card-link">
          <div class="item-card">
            <img src="https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/{item.path_512}" 
                 alt={item.title || 'Foto'} class="item-thumbnail" />
            <div class="item-info">
              <h4>{item.title || 'Ohne Titel'}</h4>
              <p>{new Date(item.created_at).toLocaleDateString('de-DE')}</p>
            </div>
          </div>
        </a>
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
      <a href={item.id === 'map-share' ? `/map-view-share/${item.slug}` : `/item/${item.slug}`} class="og-example-link">
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
                <img src="/culoca-icon.png" alt="Favicon" class="favicon" />
              {:else}
                <img src={`/api/favicon/${item.slug}`} alt="Favicon" class="favicon" />
              {/if}
            </div>
            <div class="og-text">
              <h5>{item.title || 'Ohne Titel'}{item.id !== 'map-share' ? ', ' + item.creator : ''}</h5>
              <p>{item.description || 'Keine Beschreibung verfügbar.'}</p>
              <span class="og-link">https://culoca.com/{item.id === 'map-share' ? 'map-view-share/' + item.slug : 'item/' + item.slug}</span>
            </div>
          </div>
        </div>
      </a>
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
    
    <p>
      Google stellt zum testen der Schemas ein eigenes Werkzeug zur Verfügung. Hier könnt ihr eure Daten auf perfektion trimmen: <a href="https://search.google.com/test/rich-results" target="_blank" rel="noopener">https://search.google.com/test/rich-results</a>
    </p>
    
    <div class="jsonld-test-section">
      <h3>SEO & Meta-Daten Analyse</h3>
      <p>
        Teste die SEO & Meta-Daten von beliebigen Webseiten. Gib eine URL ein und analysiere JSON-LD, Meta-Tags, Favicons und mehr.
      </p>
      
      <div class="url-input-section">
        <input 
          type="text" 
          bind:value={testUrl}
          placeholder="https://example.com oder https://culoca.com/item/..."
          on:click={clearInput}
          on:keydown={handleUrlSubmit}
          class="url-input"
        />
        <button on:click={fetchHeadData} class="analyze-btn" disabled={isLoading}>
          {isLoading ? 'Analysiere...' : 'Analysieren'}
        </button>
      </div>
      
      {#if isHeadLoading}
        <div class="loading">Lade HTML Head Daten...</div>
      {/if}
      
      {#if headData}
        <div class="analysis-example">
          <h4>HTML Head von: <a href={testUrl} target="_blank" rel="noopener">{testUrl}</a></h4>
          <div class="head-tabs">
            <button class="tab-button" class:active={activeTab === 'images'} on:click={() => activeTab = 'images'}>Bilder & Icons</button>
            <button class="tab-button" class:active={activeTab === 'prompt'} on:click={() => activeTab = 'prompt'}>Prompt</button>
            <button class="tab-button" class:active={activeTab === 'jsonld'} on:click={() => activeTab = 'jsonld'}>JSON-LD</button>
            <button class="tab-button" class:active={activeTab === 'formatted'} on:click={() => activeTab = 'formatted'}>Formatiert</button>
            <button class="tab-button" class:active={activeTab === 'meta'} on:click={() => activeTab = 'meta'}>Meta-Tags</button>
            <button class="tab-button" class:active={activeTab === 'raw'} on:click={() => activeTab = 'raw'}>Raw HTML</button>
          </div>
          
          {#if activeTab === 'prompt'}
            <div class="prompt-analysis">
              <h5>📊 SEO-Informationen & KI-Prompt Generator:</h5>
              
              <!-- Title Analysis -->
              <div class="seo-item">
                <h6>📝 Title:</h6>
                {#if headData.title}
                  {@const titleLength = editableTitle.length || headData.title.length}
                  {@const titleStatus = titleLength >= 30 && titleLength <= 60 ? '✅ Optimal' : titleLength < 30 ? '⚠️ Zu kurz' : '⚠️ Zu lang'}
                  <p><strong>Länge ({titleLength} Zeichen):</strong> <span class="status-{titleStatus.includes('✅') ? 'good' : 'warning'}">{titleStatus}</span></p>
                  <div class="editable-text-field">
                    <textarea 
                      bind:value={editableTitle} 
                      placeholder={headData.title || 'Title eingeben...'}
                      rows="2"
                      class="seo-textarea"
                    ></textarea>
                  </div>
                {:else}
                  <p class="no-data">❌ Kein Title gefunden</p>
                {/if}
              </div>
              
              <!-- Description Analysis -->
              <div class="seo-item">
                <h6>📄 Description:</h6>
                {#if headData.metaTags}
                  {@const description = headData.metaTags.find(tag => tag.name === 'description' || tag.property === 'og:description')?.content}
                  {#if description}
                    {@const descLength = editableDescription.length || description.length}
                    {@const descStatus = descLength >= 120 && descLength <= 160 ? '✅ Optimal' : descLength < 120 ? '⚠️ Zu kurz' : '⚠️ Zu lang'}
                    <p><strong>Länge ({descLength} Zeichen):</strong> <span class="status-{descStatus.includes('✅') ? 'good' : 'warning'}">{descStatus}</span></p>
                    <div class="editable-text-field">
                      <textarea 
                        bind:value={editableDescription} 
                        placeholder={description || 'Description eingeben...'}
                        rows="3"
                        class="seo-textarea"
                      ></textarea>
                    </div>
                  {:else}
                    <p class="no-data">❌ Keine Description gefunden</p>
                  {/if}
                {:else}
                  <p class="no-data">❌ Keine Meta-Tags verfügbar</p>
                {/if}
              </div>

              <!-- Caption Analysis -->
              <div class="seo-item">
                <h6>📷 Caption:</h6>
                {#if headData.metaTags}
                  {@const caption = headData.metaTags.find(tag => tag.name === 'caption' || tag.property === 'og:caption')?.content}
                  {#if caption}
                    {@const captionLength = editableCaption.length || caption.length}
                    <p><strong>Länge ({captionLength} Zeichen):</strong> <span class="status-{captionLength <= 200 ? 'good' : 'warning'}">{captionLength <= 200 ? '✅ Optimal' : '⚠️ Zu lang'}</span></p>
                    <div class="editable-text-field">
                      <textarea 
                        bind:value={editableCaption} 
                        placeholder={caption || 'Caption eingeben...'}
                        rows="2"
                        class="seo-textarea"
                      ></textarea>
                    </div>
                  {:else}
                    <p class="no-data">❌ Keine Caption gefunden</p>
                    <div class="editable-text-field">
                      <textarea 
                        bind:value={editableCaption} 
                        placeholder="Caption eingeben..."
                        rows="2"
                        class="seo-textarea"
                      ></textarea>
                    </div>
                  {/if}
                {:else}
                  <p class="no-data">❌ Keine Meta-Tags verfügbar</p>
                  <div class="editable-text-field">
                    <textarea 
                      bind:value={editableCaption} 
                      placeholder="Caption eingeben..."
                      rows="2"
                      class="seo-textarea"
                    ></textarea>
                  </div>
                {/if}
              </div>

              <!-- Page Type Analysis -->
              <div class="seo-item">
                <h6>🏷️ Seitentyp (JSON-LD @type):</h6>
                {#if headData.jsonLdData}
                  {@const pageType = headData.jsonLdData[0]?.data?.['@type'] || 'WebPage'}
                  <p><strong>Aktueller Typ:</strong> {pageType}</p>
                {:else}
                  <p><strong>Aktueller Typ:</strong> WebPage (Standard)</p>
                {/if}
                <div class="editable-text-field">
                  <select bind:value={editablePageType} class="seo-select">
                    <option value="WebPage">WebPage (Standard)</option>
                    <option value="Article">Article (Artikel)</option>
                    <option value="BlogPosting">BlogPosting (Blog)</option>
                    <option value="Product">Product (Produkt)</option>
                    <option value="Organization">Organization (Unternehmen)</option>
                    <option value="Person">Person (Person)</option>
                    <option value="Place">Place (Ort)</option>
                    <option value="Event">Event (Veranstaltung)</option>
                    <option value="FAQPage">FAQPage (FAQ)</option>
                    <option value="ContactPage">ContactPage (Kontakt)</option>
                    <option value="ImageObject">ImageObject (Bild)</option>
                    <option value="CreativeWork">CreativeWork (Kreative Arbeit)</option>
                  </select>
                </div>
              </div>

              <!-- Keywords Analysis -->
              <div class="seo-item">
                <h6>🔑 Keywords:</h6>
                {#if headData.metaTags}
                  {@const keywords = headData.metaTags.find(tag => tag.name === 'keywords')?.content}
                  {#if keywords}
                    <p><strong>Aktuelle Keywords:</strong> {keywords}</p>
                  {/if}
                  <div class="editable-text-field">
                    <textarea 
                      bind:value={editableKeywords} 
                      placeholder={keywords || 'Keywords eingeben (kommagetrennt)...'}
                      rows="2"
                      class="seo-textarea"
                    ></textarea>
                  </div>
                {:else}
                  <p class="no-data">❌ Keine Meta-Tags verfügbar</p>
                  <div class="editable-text-field">
                    <textarea 
                      bind:value={editableKeywords} 
                      placeholder="Keywords eingeben (kommagetrennt)..."
                      rows="2"
                      class="seo-textarea"
                    ></textarea>
                  </div>
                {/if}
              </div>

              <!-- Author Analysis -->
              <div class="seo-item">
                <h6>👤 Autor:</h6>
                {#if headData.metaTags}
                  {@const author = headData.metaTags.find(tag => tag.name === 'author' || tag.property === 'og:author')?.content}
                  {#if author}
                    <p><strong>Aktueller Autor:</strong> {author}</p>
                  {/if}
                  <div class="editable-text-field">
                    <input 
                      type="text" 
                      bind:value={editableAuthor} 
                      placeholder={author || 'Autor eingeben...'}
                      class="seo-input"
                    />
                  </div>
                {:else}
                  <p class="no-data">❌ Keine Meta-Tags verfügbar</p>
                  <div class="editable-text-field">
                    <input 
                      type="text" 
                      bind:value={editableAuthor} 
                      placeholder="Autor eingeben..."
                      class="seo-input"
                    />
                  </div>
                {/if}
              </div>

              <!-- Location Analysis -->
              <div class="seo-item">
                <h6>📍 Standort:</h6>
                {#if headData.metaTags}
                  {@const location = headData.metaTags.find(tag => tag.name === 'geo.region' || tag.property === 'og:locale')?.content}
                  {#if location}
                    <p><strong>Aktueller Standort:</strong> {location}</p>
                  {/if}
                  <div class="editable-text-field">
                    <input 
                      type="text" 
                      bind:value={editableLocation} 
                      placeholder={location || 'Standort eingeben...'}
                      class="seo-input"
                    />
                  </div>
                {:else}
                  <p class="no-data">❌ Keine Meta-Tags verfügbar</p>
                  <div class="editable-text-field">
                    <input 
                      type="text" 
                      bind:value={editableLocation} 
                      placeholder="Standort eingeben..."
                      class="seo-input"
                    />
                  </div>
                {/if}
              </div>

              <!-- KI-Prompt Section -->
              {#if testUrl && (editableTitle || editableDescription)}
                <div class="prompt-section">
                  <h6>📋 Erweiterter KI-Prompt zum Kopieren:</h6>
                  <div class="prompt-container">
                    <textarea 
                      readonly 
                      class="prompt-textarea"
                      rows="8"
                    >Bitte optimiere die SEO-Daten für die Seite {testUrl}:

Title: "{editableTitle || headData.title || 'Titel eingeben'}"
Description: "{editableDescription || headData.metaTags?.find(tag => tag.name === 'description' || tag.property === 'og:description')?.content || 'Description eingeben'}"
Caption: "{editableCaption || headData.metaTags?.find(tag => tag.name === 'caption' || tag.property === 'og:caption')?.content || 'Caption eingeben'}"
Seitentyp: {editablePageType}
Keywords: "{editableKeywords || headData.metaTags?.find(tag => tag.name === 'keywords')?.content || 'Keywords eingeben'}"
Autor: "{editableAuthor || headData.metaTags?.find(tag => tag.name === 'author' || tag.property === 'og:author')?.content || 'Autor eingeben'}"
Standort: "{editableLocation || headData.metaTags?.find(tag => tag.name === 'geo.region' || tag.property === 'og:locale')?.content || 'Standort eingeben'}"

Bitte optimiere alle diese Felder für maximale SEO-Performance und erstelle auch das entsprechende JSON-LD Schema.</textarea>
                    <button 
                      class="copy-button" 
                      on:click={() => copyAdvancedPrompt()}
                      title="Erweiterten Prompt kopieren"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                    </button>
                  </div>
                </div>
              {/if}
            </div>
                    {:else if activeTab === 'images'}
            <div class="images-analysis">
              <h5>Bilder & Icons Analyse:</h5>
              
              <!-- Main Image Section -->
              {#if headData.mainImage}
                <div class="image-section">
                  <h6>📸 Hauptbild:</h6>
                  <div class="image-info">
                    <p><strong>Typ:</strong> {headData.mainImage.type}</p>
                    <p><strong>Quelle:</strong> {headData.mainImage.source}</p>
                    <p><strong>URL:</strong> <a href={headData.mainImage.url} target="_blank" rel="noopener">{headData.mainImage.url}</a></p>
                    <div class="image-preview">
                      <img src={headData.mainImage.url} alt="Hauptbild Vorschau" on:error={(e) => e.target.style.display = 'none'} />
                    </div>
                  </div>
                </div>
              {:else}
                <div class="image-section">
                  <h6>📸 Hauptbild:</h6>
                  <p class="no-data">Kein Hauptbild gefunden</p>
                </div>
              {/if}
              
              <!-- Favicon Section -->
              <div class="favicon-section">
                <h6>🎨 Favicons ({headData.faviconInfo.count} gefunden):</h6>
                {#if headData.faviconInfo.favicons.length > 0}
                  <div class="favicon-list">
                    {#each headData.faviconInfo.favicons as favicon}
                      <div class="favicon-item">
                        <div class="favicon-info">
                          <p><strong>URL:</strong> <a href={favicon.url} target="_blank" rel="noopener">{favicon.url}</a></p>
                          {#if favicon.sizes}<p><strong>Größen:</strong> {favicon.sizes}</p>{/if}
                          {#if favicon.type}<p><strong>Typ:</strong> {favicon.type}</p>{/if}
                          {#if favicon.rel}<p><strong>Rel:</strong> {favicon.rel}</p>{/if}
                        </div>
                        <div class="favicon-preview">
                          <img 
                            src={favicon.url} 
                            alt="Favicon Vorschau" 
                            on:error={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextElementSibling.style.display = 'block';
                            }} 
                          />
                          <svg 
                            class="culoca-fallback" 
                            style="display: none; width: 64px; height: 64px;" 
                            viewBox="0 0 24 24" 
                            fill="currentColor"
                          >
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                          </svg>
                        </div>
                      </div>
                    {/each}
                  </div>
                  
                  <!-- Actual Size Favicon Display -->
                  <div class="favicon-sizes-display">
                    <h6>📏 Favicon-Größen in echter Größe:</h6>
                    <div class="favicon-sizes-grid">
                      {#each headData.faviconInfo.favicons as favicon}
                        {#if favicon.sizes}
                          {#each favicon.sizes.split(' ').filter(size => size.includes('x')) as size}
                            {@const [width, height] = size.split('x').map(Number)}
                            {#if width && height && width <= 512 && height <= 512}
                              <div class="favicon-size-item">
                                <div class="favicon-size-label">{size}</div>
                                <div class="favicon-size-display" style="width: {width}px; height: {height}px;">
                                  <img 
                                    src={favicon.url} 
                                    alt="Favicon {size}" 
                                    style="width: 100%; height: 100%; object-fit: contain;"
                                    on:error={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.nextElementSibling.style.display = 'block';
                                    }} 
                                  />
                                  <svg 
                                    class="culoca-fallback-size" 
                                    style="display: none; width: 100%; height: 100%;" 
                                    viewBox="0 0 24 24" 
                                    fill="currentColor"
                                  >
                                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                                  </svg>
                                </div>
                              </div>
                            {/if}
                          {/each}
                        {/if}
                      {/each}
                    </div>
                  </div>
                  
                  <div class="favicon-stats">
                    <p><strong>Mehrere Größen:</strong> {headData.faviconInfo.hasMultipleSizes ? '✅ Ja' : '❌ Nein'}</p>
                    <p><strong>Apple Touch Icon:</strong> {headData.faviconInfo.hasAppleTouchIcon ? '✅ Ja' : '❌ Nein'}</p>
                  </div>
                {:else}
                  <p class="no-data">Keine Favicons gefunden</p>
                  <!-- Show Culoca Fallback when no favicons are found -->
                  <div class="favicon-fallback-display">
                    <h6>🛡️ Culoca Fallback-Icon (wenn keine Favicons gefunden):</h6>
                    <div class="favicon-sizes-grid">
                      <div class="favicon-size-item">
                        <div class="favicon-size-label">32x32</div>
                        <div class="favicon-size-display" style="width: 32px; height: 32px;">
                          <svg 
                            class="culoca-fallback-size" 
                            style="width: 100%; height: 100%;" 
                            viewBox="0 0 24 24" 
                            fill="currentColor"
                          >
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                          </svg>
                        </div>
                      </div>
                      <div class="favicon-size-item">
                        <div class="favicon-size-label">48x48</div>
                        <div class="favicon-size-display" style="width: 48px; height: 48px;">
                          <svg 
                            class="culoca-fallback-size" 
                            style="width: 100%; height: 100%;" 
                            viewBox="0 0 24 24" 
                            fill="currentColor"
                          >
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                          </svg>
                        </div>
                      </div>
                      <div class="favicon-size-item">
                        <div class="favicon-size-label">96x96</div>
                        <div class="favicon-size-display" style="width: 96px; height: 96px;">
                          <svg 
                            class="culoca-fallback-size" 
                            style="width: 100%; height: 100%;" 
                            viewBox="0 0 24 24" 
                            fill="currentColor"
                          >
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                {/if}
              </div>
              
              <!-- Culoca Logo Fallback Section -->
              <div class="culoca-fallback-section">
                <h6>🛡️ Culoca Logo Fallback (Wenn kein Icon möglich):</h6>
                {#if headData.culocaLogoFallback}
                  <div class="culoca-fallback-info">
                    <p><strong>Culoca Logo Referenz:</strong> {headData.culocaLogoFallback.hasCulocaLogoReference ? '✅ Ja' : '❌ Nein'}</p>
                    <p><strong>Fallback Referenz:</strong> {headData.culocaLogoFallback.hasFallbackReference ? '✅ Ja' : '❌ Nein'}</p>
                    {#if headData.culocaLogoFallback.culocaLogoReferences.length > 0}
                      <p><strong>Culoca Logo Referenzen:</strong></p>
                      <ul>
                        {#each headData.culocaLogoFallback.culocaLogoReferences as ref}
                          <li>{ref}</li>
                        {/each}
                      </ul>
                    {/if}
                    {#if headData.culocaLogoFallback.fallbackReferences.length > 0}
                      <p><strong>Fallback Referenzen:</strong></p>
                      <ul>
                        {#each headData.culocaLogoFallback.fallbackReferences as ref}
                          <li>{ref}</li>
                        {/each}
                      </ul>
                    {/if}
                  </div>
                {:else}
                  <p class="no-data">Keine Culoca Logo Fallback-Information verfügbar</p>
                {/if}
              </div>
            </div>
          {:else if activeTab === 'jsonld'}
            {#if jsonLdData}
              <pre><code>{jsonLdData}</code></pre>
            {:else}
              <div class="loading">Lade JSON-LD Daten...</div>
            {/if}
          {:else if activeTab === 'formatted'}
            <pre><code>{headData.headContent}</code></pre>
          {:else if activeTab === 'meta'}
            <div class="meta-analysis">
              <h5>Meta-Tags Analyse:</h5>
              {#if headData.metaTags}
                <div class="meta-stats">
                  <span>Meta-Tags: {headData.metaTags.length}</span>
                  <span>Link-Tags: {headData.linkTags?.length || 0}</span>
                  <span>Script-Tags: {headData.scriptTags?.length || 0}</span>
                </div>
                <div class="meta-list">
                  {#each headData.metaTags as tag}
                    <div class="meta-item">
                      <strong>{tag.name || tag.property || 'Unbekannt'}:</strong> {tag.content || 'Kein Inhalt'}
                    </div>
                  {/each}
                </div>
              {:else}
                <p class="no-data">Keine Meta-Tags verfügbar</p>
              {/if}
            </div>
          {:else if activeTab === 'raw'}
            <pre><code>{headData.rawHead}</code></pre>
          {/if}
        </div>
      {/if}
      
      {#if error}
        <div class="error">Fehler: {error}</div>
      {/if}
      
      {#if headError}
        <div class="error">Fehler: {headError}</div>
      {/if}
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

  .og-example-link {
    text-decoration: none;
    color: inherit;
    display: block;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .og-example-link:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px var(--shadow);
  }

  .og-example-link:hover .og-example {
    border-color: var(--accent-color);
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

  .jsonld-test-section {
    margin-top: 2rem;
  }

  .url-input-container {
    display: flex;
    gap: 1rem;
    margin: 1rem 0;
    align-items: center;
    flex-wrap: wrap;
  }

  .url-input-section {
    display: flex;
    gap: 1rem;
    margin: 1rem 0;
    align-items: center;
    flex-wrap: wrap;
  }

  .url-input {
    flex: 1;
    min-width: 300px;
    padding: 0.75rem 1rem;
    border: 2px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 0.9rem;
    transition: border-color 0.2s ease;
  }

  .url-input:focus {
    outline: none;
    border-color: var(--accent-color);
  }

  .url-input::placeholder {
    color: var(--text-tertiary);
  }

  .analyze-btn {
    padding: 0.75rem 1.5rem;
    background: var(--accent-color);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s ease;
    white-space: nowrap;
  }

  .analyze-btn:hover {
    background: var(--accent-hover);
  }

  .analyze-btn:disabled {
    background: var(--text-tertiary);
    cursor: not-allowed;
  }

  .loading {
    margin: 1rem 0;
    padding: 1rem;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-secondary);
    text-align: center;
  }

  .error {
    margin: 1rem 0;
    padding: 1rem;
    background: #fee;
    border: 1px solid #fcc;
    border-radius: 6px;
    color: #c33;
  }

  .analysis-example {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
    overflow-x: auto;
    margin-top: 1rem;
  }

  .analysis-example h4 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
    font-size: 1rem;
  }

  .analysis-example h4 a {
    color: var(--accent-color);
    text-decoration: none;
  }

  .analysis-example h4 a:hover {
    text-decoration: underline;
  }

  .analysis-example pre {
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

  .analysis-example code {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    color: var(--text-primary);
  }

  .head-tabs {
    display: flex;
    /* margin-bottom: 1rem; */
    border-bottom: 1px solid var(--border-color);
  }

  .tab-button {
    padding: 0.5rem 1rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-bottom: none;
    border-radius: 8px 8px 0 0;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-secondary);
    transition: background-color 0.2s ease, color 0.2s ease;
  }

  .tab-button:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .tab-button.active {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border-bottom: 1px solid var(--bg-tertiary);
  }

  .meta-analysis {
    margin-top: 1rem;
  }

  .meta-stats {
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
  }

  .meta-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .meta-item {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 0.25rem 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .meta-item svg {
    width: 12px;
    height: 12px;
    color: var(--accent-color);
  }

  .images-analysis {
    /* margin-top: 1rem; */
  }

  .image-section {
    margin-bottom: 1.5rem;
  }

  .image-section h6 {
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
  }

  .image-info p {
    font-size: 0.8rem;
    color: var(--text-secondary);
    margin: 0.25rem 0;
  }

  .image-preview img {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
    margin-top: 0.5rem;
  }

  .no-data {
    font-style: italic;
    color: var(--text-tertiary);
    margin-top: 0.5rem;
  }

  .favicon-section {
    margin-top: 1.5rem;
  }

  .favicon-section h6 {
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
  }

  .favicon-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .favicon-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 0.25rem 0.75rem;
  }

  .favicon-info {
    flex: 1;
  }

  .favicon-info p {
    margin: 0.25rem 0;
  }

  .favicon-info a {
    color: var(--accent-color);
    text-decoration: none;
  }

  .favicon-info a:hover {
    text-decoration: underline;
  }

  .favicon-preview img {
    max-width: 64px;
    max-height: 64px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
  }

  .culoca-fallback {
    color: var(--culoca-orange);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-secondary);
    padding: 8px;
  }

  .culoca-fallback-size {
    color: var(--culoca-orange);
    background: var(--bg-secondary);
  }

  .favicon-fallback-display {
    margin-top: 1.5rem;
    padding: 1rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
  }

  .favicon-fallback-display h6 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .culoca-fallback-section {
    margin-top: 1.5rem;
    padding: 1rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
  }

  .culoca-fallback-section h6 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .culoca-fallback-info p {
    margin: 0.5rem 0;
    color: var(--text-primary);
  }

  .culoca-fallback-info ul {
    margin: 0.5rem 0;
    padding-left: 1.5rem;
    color: var(--text-secondary);
  }

  .culoca-fallback-info li {
    margin: 0.25rem 0;
    font-size: 0.9rem;
  }

  .favicon-sizes-display {
    margin-top: 1.5rem;
    padding: 1rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
  }

  .favicon-sizes-display h6 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .favicon-sizes-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: flex-end;
  }

  .favicon-size-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .favicon-size-label {
    font-size: 0.8rem;
    color: var(--text-secondary);
    font-weight: 500;
    text-align: center;
  }

  .favicon-size-display {
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .favicon-size-display img {
    display: block;
  }

  .favicon-stats {
    font-size: 0.8rem;
    color: var(--text-secondary);
    margin-top: 0.5rem;
  }

  .culoca-logo-section {
    margin-top: 1.5rem;
  }

  .culoca-logo-section h6 {
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
  }

  .culoca-logo-info {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .culoca-logo-info p {
    margin: 0.25rem 0;
  }

  .culoca-references {
    margin-top: 0.5rem;
  }

  .culoca-references ul {
    margin-left: 1rem;
    padding-left: 1rem;
  }

  .culoca-references li {
    list-style: disc;
    margin-bottom: 0.25rem;
  }

  .fallback-references {
    margin-top: 0.5rem;
  }

  .fallback-references ul {
    margin-left: 1rem;
    padding-left: 1rem;
  }

  .fallback-references li {
    list-style: disc;
    margin-bottom: 0.25rem;
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

  .item-card-link {
    text-decoration: none;
    color: inherit;
    display: block;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .item-card-link:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px var(--shadow);
  }

  .item-card-link:hover .item-card {
    border-color: var(--accent-color);
  }

  /* SEO Information Styles */
  .seo-info-section {
    margin: 0 0 1.5rem 0;
    padding: 1.5rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
  }

  .seo-item {
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);
  }

  .seo-item:last-child {
    border-bottom: none;
    margin-bottom: 0;
  }

  .seo-item h6 {
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
    font-size: 1rem;
  }

  .seo-item p {
    margin: 0.25rem 0;
    color: var(--text-secondary);
  }

  .status-good {
    color: #28a745;
    font-weight: 600;
  }

  .status-warning {
    color: #ffc107;
    font-weight: 600;
  }

  /* Editierbare SEO-Textfelder */
  .editable-text-field {
    margin-top: 0.5rem;
  }

  .seo-textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: inherit;
    font-size: 0.9rem;
    line-height: 1.4;
    resize: vertical;
    min-height: 60px;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .seo-textarea:focus {
    outline: none;
    border-color: var(--accent-color);
    box-shadow: 0 0 0 2px rgba(238, 114, 33, 0.1);
  }

  .seo-textarea::placeholder {
    color: var(--text-tertiary);
    font-style: italic;
  }

  /* Erweiterte SEO-Eingabefelder */
  .seo-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: inherit;
    font-size: 0.9rem;
    line-height: 1.4;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .seo-input:focus {
    outline: none;
    border-color: var(--accent-color);
    box-shadow: 0 0 0 2px rgba(238, 114, 33, 0.1);
  }

  .seo-select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: inherit;
    font-size: 0.9rem;
    line-height: 1.4;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    cursor: pointer;
  }

  .seo-select:focus {
    outline: none;
    border-color: var(--accent-color);
    box-shadow: 0 0 0 2px rgba(238, 114, 33, 0.1);
  }

  .seo-select option {
    background: var(--bg-primary);
    color: var(--text-primary);
    padding: 0.5rem;
  }

  /* Prompt Section Styles */
  .prompt-section {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
  }

  .prompt-section h6 {
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
    font-size: 1rem;
  }

  .prompt-container {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .prompt-textarea {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-family: inherit;
    font-size: 0.85rem;
    line-height: 1.4;
    resize: none;
    min-height: 80px;
    cursor: text;
  }

  .prompt-textarea:focus {
    outline: none;
    border-color: var(--accent-color);
  }

  .copy-button {
    flex-shrink: 0;
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 40px;
    height: 40px;
  }

  .copy-button:hover {
    background: var(--bg-secondary);
    border-color: var(--accent-color);
    color: var(--accent-color);
  }

  .copy-button:active {
    transform: scale(0.95);
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