<script>
  import { page } from '$app/stores';
  
  // Set page metadata
  $: $page.meta.title = 'Lizenz - Culoca';
  $: $page.meta.description = 'Lizenzinformationen für Bilder auf Culoca - Nutzungsbedingungen und Copyright-Hinweise';
</script>

<svelte:head>
  <title>Lizenz - Culoca</title>
  <meta name="description" content="Lizenzinformationen für Bilder auf Culoca - Nutzungsbedingungen und Copyright-Hinweise" />
  <meta name="robots" content="noindex, nofollow" />
  
  <!-- Open Graph -->
  <meta property="og:title" content="Lizenz - Culoca" />
  <meta property="og:description" content="Lizenzinformationen für Bilder auf Culoca - Nutzungsbedingungen und Copyright-Hinweise" />
  <meta property="og:url" content="https://culoca.com/license" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Culoca" />
  <meta property="og:locale" content="de_DE" />
  
  <!-- JSON-LD -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Lizenz - Culoca",
    "description": "Lizenzinformationen für Bilder auf Culoca - Nutzungsbedingungen und Copyright-Hinweise",
    "url": "https://culoca.com/license",
    "inLanguage": "de",
    "publisher": {
      "@type": "Organization",
      "name": "Culoca",
      "url": "https://culoca.com"
    }
  }
  </script>
</svelte:head>

<div class="container mx-auto px-4 py-8 max-w-4xl">
  <h1 class="text-3xl font-bold mb-6">Lizenzinformationen</h1>
  
  <div class="prose prose-lg max-w-none">
    <h2>Allgemeine Nutzungsbedingungen für Bilder auf Culoca</h2>
    
    <p>
      Alle auf Culoca veröffentlichten Bilder unterliegen den folgenden Lizenzbedingungen:
    </p>
    
    <h3>1. Urheberrecht</h3>
    <p>
      Die Urheberrechte an allen Bildern bleiben bei den jeweiligen Fotografen. 
      Jedes Bild ist mit dem Namen des Fotografen gekennzeichnet.
    </p>
    
    <h3>2. Nutzungsrechte</h3>
    <p>
      <strong>Private Nutzung:</strong> Bilder dürfen für private Zwecke verwendet werden.
    </p>
    <p>
      <strong>Kommerzielle Nutzung:</strong> Für kommerzielle Nutzung ist eine separate Vereinbarung mit dem Fotografen erforderlich.
    </p>
    
    <h3>3. Attribution</h3>
    <p>
      Bei jeder Nutzung muss der Name des Fotografen und ein Link zu Culoca angegeben werden.
      Format: "Foto: [Fotografenname] / Culoca.com"
    </p>
    
    <h3>4. Einschränkungen</h3>
    <ul>
      <li>Bilder dürfen nicht ohne Zustimmung des Fotografen verändert werden</li>
      <li>Die kommerzielle Nutzung ist nur nach Absprache erlaubt</li>
      <li>Bilder dürfen nicht in einem anstößigen oder schädlichen Kontext verwendet werden</li>
    </ul>
    
    <h3>5. Kontakt</h3>
    <p>
      Für Fragen zu Lizenzen oder kommerzieller Nutzung kontaktieren Sie bitte:
    </p>
    <ul>
      <li>Email: johann.dirschl@gmx.de</li>
      <li>Telefon: +49-179-9766666</li>
    </ul>
    
    <h3>6. Haftungsausschluss</h3>
    <p>
      Culoca übernimmt keine Haftung für die Nutzung der Bilder durch Dritte. 
      Alle Nutzer sind verpflichtet, die geltenden Urheberrechte zu respektieren.
    </p>
    
    <div class="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
      <h4 class="font-bold mb-2">Wichtiger Hinweis</h4>
      <p class="text-sm">
        Diese Lizenzinformationen gelten als allgemeine Richtlinie. 
        Für spezifische Bilder können abweichende Bedingungen gelten, 
        die auf der jeweiligen Bildseite angegeben sind.
      </p>
    </div>
  </div>
</div> 