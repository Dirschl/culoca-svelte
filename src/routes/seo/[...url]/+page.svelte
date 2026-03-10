<svelte:head>
  <title>SEO Analyse Tool - Culoca</title>
  <meta name="description" content="Analysiere SEO, Meta-Tags, JSON-LD, Open Graph und Favicons von beliebigen Webseiten. Kostenloser SEO-Check mit Bot-Simulation und KI-Prompt Generator." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://culoca.com/seo" />
  <meta property="og:title" content="SEO Analyse Tool - Culoca" />
  <meta property="og:description" content="Analysiere SEO, Meta-Tags, JSON-LD, Open Graph und Favicons von beliebigen Webseiten." />
  <meta property="og:url" content="https://culoca.com/seo" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Culoca" />
  <meta property="og:locale" content="de_DE" />
  <meta property="og:image" content="https://culoca.com/culoca-see-you-local-entdecke-deine-umgebung.jpg" />

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "Culoca SEO Analyse Tool",
    "description": "Analysiere SEO, Meta-Tags, JSON-LD, Open Graph und Favicons von beliebigen Webseiten.",
    "url": "https://culoca.com/seo",
    "applicationCategory": "SEO Tool",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "EUR"
    }
  }
  </script>
</svelte:head>

<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import SiteNav from '$lib/SiteNav.svelte';
  import SiteFooter from '$lib/SiteFooter.svelte';

  export let data: { targetUrl: string; directUrl: boolean };

  let testUrl = data.targetUrl || '';
  const autoFullscreen = data.directUrl && !!data.targetUrl;

  let isLoading = false;
  let error = '';

  let headData: any = null;
  let isHeadLoading = false;
  let headError = '';
  let activeTab = 'images';
  let fullscreenOpen = false;

  let isBotMode = false;
  let originalUserAgent = '';
  let botModeInitialized = false;

  let editableTitle = '';
  let editableDescription = '';
  let editableCaption = '';
  let editablePageType = 'WebPage';
  let editableKeywords = '';
  let editableAuthor = '';
  let editableLocation = '';
  let editableOgImage = '';
  let editableIcon = '';

  function clearInput() {
    testUrl = '';
    headData = null;
    error = '';
    isLoading = false;
  }

  function handleUrlSubmit(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      fetchHeadData();
    }
  }

  async function copyAdvancedPrompt() {
    const promptText = `Bitte optimiere die SEO-Daten für die Seite ${testUrl}:

Title: "${editableTitle || headData?.title || 'Titel eingeben'}"
Description: "${editableDescription || headData?.metaTags?.find((tag) => tag.name === 'description' || tag.property === 'og:description')?.content || 'Description eingeben'}"
Caption: "${editableCaption || headData?.metaTags?.find((tag) => tag.name === 'caption' || tag.property === 'og:caption')?.content || headData?.jsonLdData?.[0]?.data?.caption || 'Caption eingeben'}"
Seitentyp: ${editablePageType}
Keywords: "${editableKeywords || headData?.metaTags?.find((tag) => tag.name === 'keywords')?.content || 'Keywords eingeben'}"
Autor: "${editableAuthor || headData?.metaTags?.find((tag) => tag.name === 'author' || tag.property === 'og:author')?.content || 'Autor eingeben'}"
Standort: "${editableLocation || headData?.metaTags?.find((tag) => tag.name === 'geo.region' || tag.property === 'og:locale')?.content || 'Standort eingeben'}"
og:image: "${editableOgImage || headData?.metaTags?.find((tag) => tag.property === 'og:image')?.content || 'og:image eingeben'}"
Icon: "${editableIcon || headData?.linkTags?.find((tag) => tag.rel === 'icon')?.href || 'Icon eingeben'}"

Bitte optimiere alle diese Felder für maximale SEO-Performance und erstelle auch das entsprechende JSON-LD Schema.`;

    try {
      await navigator.clipboard.writeText(promptText);
    } catch (err) {
      console.error('Fehler beim Kopieren:', err);
    }
  }

  async function copyRawHtml(html: string) {
    try {
      await navigator.clipboard.writeText(html);
    } catch (err) {
      console.error('Fehler beim Kopieren des HTML:', err);
    }
  }

  function toggleExpand() {
    const content = document.querySelector('.raw-html-content') as HTMLElement;
    if (content) {
      content.classList.toggle('expanded');
    }
  }

  function toggleWordWrap() {
    const content = document.querySelector('.raw-html-content') as HTMLElement;
    if (content) {
      content.classList.toggle('word-wrap');
      if (content.classList.contains('word-wrap')) {
        content.style.whiteSpace = 'pre-wrap';
        content.style.wordWrap = 'break-word';
        content.style.overflowWrap = 'break-word';
      } else {
        content.style.whiteSpace = 'pre';
        content.style.wordWrap = 'normal';
        content.style.overflowWrap = 'normal';
      }
    }
  }

  function toggleHeadOnly() {
    const content = document.querySelector('.raw-html-content') as HTMLElement;
    if (content) {
      content.classList.toggle('head-only');
      if (content.classList.contains('head-only')) {
        content.style.maxHeight = '200px';
        content.style.overflow = 'hidden';
      } else {
        content.style.maxHeight = '400px';
        content.style.overflow = 'auto';
      }
    }
  }

  async function copyFormattedContent(content: string) {
    try {
      await navigator.clipboard.writeText(content);
    } catch (err) {
      console.error('Fehler beim Kopieren des formatierten Inhalts:', err);
    }
  }

  function toggleFormattedHeadOnly() {
    const content = document.querySelector('.formatted-content') as HTMLElement;
    if (content) {
      content.classList.toggle('head-only');
      if (content.classList.contains('head-only')) {
        content.style.maxHeight = '200px';
        content.style.overflow = 'hidden';
      } else {
        content.style.maxHeight = '400px';
        content.style.overflow = 'auto';
      }
    }
  }

  function toggleFormattedWordWrap() {
    const content = document.querySelector('.formatted-content') as HTMLElement;
    if (content) {
      content.classList.toggle('word-wrap');
      if (content.classList.contains('word-wrap')) {
        content.style.whiteSpace = 'pre-wrap';
        content.style.wordWrap = 'break-word';
        content.style.overflowWrap = 'break-word';
      } else {
        content.style.whiteSpace = 'pre';
        content.style.wordWrap = 'normal';
        content.style.overflowWrap = 'normal';
      }
    }
  }

  async function copyJsonLdContent(content: string) {
    try {
      await navigator.clipboard.writeText(content);
    } catch (err) {
      console.error('Fehler beim Kopieren des JSON-LD Inhalts:', err);
    }
  }

  function toggleJsonLdWordWrap() {
    const content = document.querySelector('.jsonld-content') as HTMLElement;
    if (content) {
      content.classList.toggle('word-wrap');
      if (content.classList.contains('word-wrap')) {
        content.style.whiteSpace = 'pre-wrap';
        content.style.wordWrap = 'break-word';
        content.style.overflowWrap = 'break-word';
      } else {
        content.style.whiteSpace = 'pre';
        content.style.wordWrap = 'normal';
        content.style.overflowWrap = 'normal';
      }
    }
  }

  async function fetchHeadData() {
    if (!testUrl.trim()) {
      error = 'Bitte gib eine URL ein';
      return;
    }

    isLoading = true;
    isHeadLoading = true;
    error = '';
    headError = '';
    headData = null;

    try {
      const response = await fetch(`/api/test-head?url=${encodeURIComponent(testUrl)}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        headData = result;

        editableTitle = result.title || '';
        const description = result.metaTags?.find((tag) => tag.name === 'description' || tag.property === 'og:description')?.content;
        editableDescription = description || '';

        const caption = result.metaTags?.find((tag) => tag.name === 'caption' || tag.property === 'og:caption')?.content;
        editableCaption = caption || '';

        if (!caption && headData?.jsonLdData?.[0]?.data?.caption) {
          editableCaption = headData.jsonLdData[0].data.caption;
        }

        const pageType = result.jsonLdData?.[0]?.data?.['@type'] || 'WebPage';
        editablePageType = pageType;

        const keywords = result.metaTags?.find((tag) => tag.name === 'keywords')?.content;
        editableKeywords = keywords || '';

        const author = result.metaTags?.find((tag) => tag.name === 'author' || tag.property === 'og:author')?.content;
        editableAuthor = author || '';

        const location = result.metaTags?.find((tag) => tag.name === 'geo.region' || tag.property === 'og:locale')?.content;
        editableLocation = location || '';

        const isCulocaUrl = testUrl.toLowerCase().includes('culoca') || testUrl.toLowerCase().includes('localhost');
        const ogImage = result.metaTags?.find((tag) => tag.property === 'og:image')?.content;
        const icon = result.linkTags?.find((tag) => tag.rel === 'icon')?.href;

        editableOgImage = ogImage || (isCulocaUrl ? 'culoca-see-you-local-entdecke-deine-umgebung.jpg' : '');
        editableIcon = icon || (isCulocaUrl ? 'culoca-icon.svg' : '');

        if (browser) {
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('url', testUrl);
          window.history.replaceState({}, '', newUrl.pathname.replace(/\/seo.*/, '/seo') + '?' + newUrl.searchParams.toString());
        }
      } else {
        throw new Error(result.error || 'Unbekannter Fehler');
      }
    } catch (err: any) {
      headError = err.message || 'Fehler beim Laden der HTML Head Daten';
    } finally {
      isHeadLoading = false;
      isLoading = false;
    }
  }

  onMount(async () => {
    if (browser) {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('bot_mode') === 'true') {
        isBotMode = true;
      }
      botModeInitialized = true;

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && fullscreenOpen) {
          fullscreenOpen = false;
        }
      });

      document.addEventListener('click', (e) => {
        if (!isBotMode) return;

        const target = e.target as HTMLElement;
        const link = target.closest('a');

        if (link && link.href) {
          const isInResults = link.closest('.seo-results, .items-grid, .item-card-link, pre, code');

          if (isInResults) {
            e.preventDefault();
            const linkUrl = link.href;
            testUrl = linkUrl;
            fetchHeadData();
          }
        }
      }, true);
    }

    if (testUrl) {
      if (autoFullscreen) {
        fullscreenOpen = true;
      }
      await fetchHeadData();
    }
  });

  $: if (browser && botModeInitialized) {
    if (isBotMode) {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('bot_mode')) {
        url.searchParams.set('bot_mode', 'true');
        window.history.replaceState({}, '', url.toString());
      }

      if (!originalUserAgent) {
        originalUserAgent = navigator.userAgent;
      }
      try {
        Object.defineProperty(navigator, 'userAgent', {
          value: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
          configurable: true
        });
      } catch (err) {
        console.warn('Konnte User-Agent nicht ändern:', err);
      }
    } else {
      const url = new URL(window.location.href);
      if (url.searchParams.has('bot_mode')) {
        url.searchParams.delete('bot_mode');
        window.history.replaceState({}, '', url.toString());
      }

      if (originalUserAgent) {
        try {
          Object.defineProperty(navigator, 'userAgent', {
            value: originalUserAgent,
            configurable: true
          });
          originalUserAgent = '';
        } catch (err) {
          console.warn('Konnte User-Agent nicht wiederherstellen:', err);
        }
      }
    }
  }
</script>

<div class="seo-page">
  <SiteNav />

  <main class="seo-main">
    <div class="seo-hero">
      <h1>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; vertical-align: middle; margin-right: 10px;">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        SEO Analyse Tool
      </h1>
      <p class="hero-subtitle">
        Teste die SEO & Meta-Daten von beliebigen Webseiten. Analysiere JSON-LD, Meta-Tags, Open Graph, Favicons und mehr.
      </p>
    </div>

    <div class="seo-content">
      <div class="url-input-section">
        <input
          type="text"
          bind:value={testUrl}
          placeholder="https://example.com oder https://culoca.com/foto/..."
          on:click={clearInput}
          on:keydown={handleUrlSubmit}
          class="url-input"
        />
        <button
          on:click={fetchHeadData}
          class="analyze-btn"
          disabled={isHeadLoading}
          type="button"
        >
          {isHeadLoading ? 'Analysiere...' : 'Analysieren'}
        </button>
      </div>

      <div class="bot-test-section">
        <label class="bot-label">
          <input
            type="checkbox"
            bind:checked={isBotMode}
          />
          <span class="bot-label-text">Als Bot agieren</span>
          <span class="bot-label-sub">(Simuliert Googlebot für SEO-Tests)</span>
        </label>
        {#if isBotMode}
          <div class="bot-info">
            <p>
              <strong>Bot-Modus aktiv:</strong> User-Agent wird zu Googlebot geändert.
              Die Seite wird so analysiert, wie Google sie sieht.
            </p>
            <p class="bot-ua">User-Agent: {navigator.userAgent}</p>
          </div>
        {/if}
      </div>

      {#if isHeadLoading}
        <div class="loading">Lade HTML Head Daten...</div>
      {/if}

      <div class="seo-results">
        {#if headData}
          <div class="analysis-section">
            <h3>Analyse: <a href={testUrl} target="_blank" rel="noopener">{testUrl}</a></h3>
            <div class="head-tabs">
              <button class="tab-button" class:active={activeTab === 'images'} on:click={() => activeTab = 'images'}>Bilder & Icons</button>
              <button class="tab-button" class:active={activeTab === 'prompt'} on:click={() => activeTab = 'prompt'}>Prompt</button>
              <button class="tab-button" class:active={activeTab === 'jsonld'} on:click={() => activeTab = 'jsonld'}>JSON-LD</button>
              <button class="tab-button" class:active={activeTab === 'formatted'} on:click={() => activeTab = 'formatted'}>Formatiert</button>
              <button class="tab-button" class:active={activeTab === 'meta'} on:click={() => activeTab = 'meta'}>Meta-Tags</button>
              <button class="tab-button" class:active={activeTab === 'raw'} on:click={() => activeTab = 'raw'}>Raw HTML</button>
              <button class="tab-button" class:active={activeTab === 'botview'} on:click={() => activeTab = 'botview'}>Bot View</button>
              <button class="tab-button" class:active={activeTab === 'fullscreen'} on:click={() => activeTab = 'fullscreen'}>Fullscreen</button>
            </div>

            {#if activeTab === 'prompt'}
              <div class="prompt-analysis">
                <h5>SEO-Informationen & KI-Prompt Generator:</h5>

                <div class="seo-item">
                  <h6>Title:</h6>
                  {#if headData.title}
                    {@const titleLength = editableTitle.length || headData.title.length}
                    {@const titleStatus = titleLength >= 30 && titleLength <= 60 ? 'Optimal' : titleLength < 30 ? 'Zu kurz' : 'Zu lang'}
                    <p><strong>Länge ({titleLength} Zeichen):</strong> <span class="status-{titleStatus === 'Optimal' ? 'good' : 'warning'}">{titleStatus === 'Optimal' ? '✅' : '⚠️'} {titleStatus}</span></p>
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

                <div class="seo-item">
                  <h6>Description:</h6>
                  {#if headData.metaTags}
                    {@const description = headData.metaTags.find((tag) => tag.name === 'description' || tag.property === 'og:description')?.content}
                    {#if description}
                      {@const descLength = editableDescription.length || description.length}
                      {@const descStatus = descLength >= 120 && descLength <= 160 ? 'Optimal' : descLength < 120 ? 'Zu kurz' : 'Zu lang'}
                      <p><strong>Länge ({descLength} Zeichen):</strong> <span class="status-{descStatus === 'Optimal' ? 'good' : 'warning'}">{descStatus === 'Optimal' ? '✅' : '⚠️'} {descStatus}</span></p>
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

                <div class="seo-item">
                  <h6>Caption:</h6>
                  {#if headData}
                    {@const captionFromMeta = headData.metaTags?.find((tag) => tag.name === 'caption' || tag.property === 'og:caption')?.content}
                    {@const captionFromJsonLd = headData.jsonLdData?.find((ld) => ld.data?.caption)?.data?.caption}
                    {@const caption = captionFromMeta || captionFromJsonLd}
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
                  {/if}
                </div>

                <div class="seo-item">
                  <h6>Seitentyp (JSON-LD @type):</h6>
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

                <div class="seo-item">
                  <h6>Keywords:</h6>
                  {#if headData}
                    {@const keywordsFromMeta = headData.metaTags?.find((tag) => tag.name === 'keywords')?.content}
                    {@const keywordsFromJsonLd = headData.jsonLdData?.find((ld) => ld.data?.keywords)?.data?.keywords}
                    {@const keywords = keywordsFromMeta || keywordsFromJsonLd}
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
                  {/if}
                </div>

                <div class="seo-item">
                  <h6>Autor:</h6>
                  {#if headData.metaTags}
                    {@const author = headData.metaTags.find((tag) => tag.name === 'author' || tag.property === 'og:author')?.content}
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
                  {/if}
                </div>

                <div class="seo-item">
                  <h6>Standort:</h6>
                  {#if headData}
                    {@const locationFromMeta = headData.metaTags?.find((tag) => tag.name === 'geo.region' || tag.property === 'og:locale')?.content}
                    {@const locationFromJsonLd = headData.jsonLdData?.find((ld) => ld.data?.contentLocation?.name)?.data?.contentLocation?.name}
                    {@const location = locationFromMeta || locationFromJsonLd}
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
                  {/if}
                </div>

                <div class="seo-item">
                  <h6>og:image:</h6>
                  {#if headData}
                    {@const ogImageFromMeta = headData.metaTags?.find((tag) => tag.property === 'og:image')?.content}
                    {@const isCulocaUrl = testUrl.toLowerCase().includes('culoca') || testUrl.toLowerCase().includes('localhost')}
                    {@const ogImage = ogImageFromMeta || (isCulocaUrl ? 'culoca-see-you-local-entdecke-deine-umgebung.jpg' : '')}
                    {#if ogImage}
                      <p><strong>Aktuelles og:image:</strong> {ogImage}</p>
                    {/if}
                    <div class="editable-text-field">
                      <input
                        type="text"
                        bind:value={editableOgImage}
                        placeholder={ogImage || 'og:image eingeben...'}
                        class="seo-input"
                      />
                    </div>
                  {/if}
                </div>

                <div class="seo-item">
                  <h6>Icon:</h6>
                  {#if headData}
                    {@const iconFromLink = headData.linkTags?.find((tag) => tag.rel === 'icon')?.href}
                    {@const isCulocaUrl = testUrl.toLowerCase().includes('culoca') || testUrl.toLowerCase().includes('localhost')}
                    {@const icon = iconFromLink || (isCulocaUrl ? 'culoca-icon.svg' : '')}
                    {#if icon}
                      <p><strong>Aktuelles Icon:</strong> {icon}</p>
                    {/if}
                    <div class="editable-text-field">
                      <input
                        type="text"
                        bind:value={editableIcon}
                        placeholder={icon || 'Icon eingeben...'}
                        class="seo-input"
                      />
                    </div>
                  {/if}
                </div>

                {#if testUrl && (editableTitle || editableDescription)}
                  <div class="prompt-section">
                    <h6>Erweiterter KI-Prompt zum Kopieren:</h6>
                    <div class="prompt-container">
                      <textarea
                        readonly
                        class="prompt-textarea"
                        rows="8"
                      >Bitte optimiere die SEO-Daten für die Seite {testUrl}:

Title: "{editableTitle || headData.title || 'Titel eingeben'}"
Description: "{editableDescription || headData.metaTags?.find((tag) => tag.name === 'description' || tag.property === 'og:description')?.content || 'Description eingeben'}"
Caption: "{editableCaption || headData.metaTags?.find((tag) => tag.name === 'caption' || tag.property === 'og:caption')?.content || headData.jsonLdData?.find((ld) => ld.data?.caption)?.data?.caption || 'Caption eingeben'}"
Seitentyp: {editablePageType}
Keywords: "{editableKeywords || headData.metaTags?.find((tag) => tag.name === 'keywords')?.content || headData.jsonLdData?.find((ld) => ld.data?.keywords)?.data?.keywords || 'Keywords eingeben'}"
Autor: "{editableAuthor || headData.metaTags?.find((tag) => tag.name === 'author' || tag.property === 'og:author')?.content || 'Autor eingeben'}"
Standort: "{editableLocation || headData.metaTags?.find((tag) => tag.name === 'geo.region' || tag.property === 'og:locale')?.content || headData.jsonLdData?.find((ld) => ld.data?.contentLocation?.name)?.data?.contentLocation?.name || 'Standort eingeben'}"
og:image: "{editableOgImage || headData.metaTags?.find((tag) => tag.property === 'og:image')?.content || 'og:image eingeben'}"
Icon: "{editableIcon || headData.linkTags?.find((tag) => tag.rel === 'icon')?.href || 'Icon eingeben'}"

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

                {#if headData.mainImage}
                  <div class="image-section">
                    <h6>Hauptbild:</h6>
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
                    <h6>Hauptbild:</h6>
                    <p class="no-data">Kein Hauptbild gefunden</p>
                  </div>
                {/if}

                <div class="favicon-section">
                  <h6>Favicons ({headData.faviconInfo.count} gefunden):</h6>
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
                              on:error={(e) => { e.target.style.display = 'none'; }}
                            />
                          </div>
                        </div>
                      {/each}
                    </div>

                    <div class="favicon-sizes-display">
                      <h6>Favicon-Größen in echter Größe:</h6>
                      <div class="favicon-sizes-grid">
                        {#each headData.faviconInfo.favicons as favicon}
                          {#if favicon.sizes}
                            {#each favicon.sizes.split(' ').filter((size) => size.includes('x')) as size}
                              {@const [width, height] = size.split('x').map(Number)}
                              {#if width && height && width <= 512 && height <= 512}
                                <div class="favicon-size-item">
                                  <div class="favicon-size-label">{size}</div>
                                  <div class="favicon-size-display" style="width: {width}px; height: {height}px;">
                                    <img
                                      src={favicon.url}
                                      alt="Favicon {size}"
                                      style="width: 100%; height: 100%; object-fit: contain;"
                                      on:error={(e) => { e.target.style.display = 'none'; }}
                                    />
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
                  {/if}
                </div>

                {#if headData.culocaLogoFallback}
                  <div class="culoca-fallback-section">
                    <h6>Culoca Logo Fallback:</h6>
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
                  </div>
                {/if}
              </div>
            {:else if activeTab === 'jsonld'}
              {#if headData && headData.jsonLdData && headData.jsonLdData.length > 0}
                <div class="jsonld-container">
                  <div class="jsonld-wrapper">
                    <div class="jsonld-actions">
                      <button
                        class="code-action-btn"
                        on:click={() => copyJsonLdContent(headData.jsonLdData.map((item) => `=== ${item.index}. ${item.type}: ${item.name} ===\n${item.formatted}`).join('\n\n'))}
                        title="JSON-LD Code kopieren"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                      </button>
                      <button
                        class="code-action-btn"
                        on:click={toggleJsonLdWordWrap}
                        title="Code umbrechen"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>
                        </svg>
                      </button>
                    </div>
                    <pre class="jsonld-content"><code>{headData.jsonLdData.map((item) => `=== ${item.index}. ${item.type}: ${item.name} ===\n${item.formatted}`).join('\n\n')}</code></pre>
                  </div>
                </div>
              {:else}
                <div class="loading">Keine JSON-LD Daten gefunden.</div>
              {/if}
            {:else if activeTab === 'formatted'}
              <div class="formatted-container">
                <div class="formatted-wrapper">
                  <div class="formatted-actions">
                    <button
                      class="code-action-btn"
                      on:click={() => copyFormattedContent(headData.headContent)}
                      title="Formatierten Code kopieren"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                    </button>
                    <button
                      class="code-action-btn"
                      on:click={toggleFormattedHeadOnly}
                      title="Nur Head-Bereich anzeigen"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M7 14l5-5 5 5"/>
                      </svg>
                    </button>
                    <button
                      class="code-action-btn"
                      on:click={toggleFormattedWordWrap}
                      title="Code umbrechen"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>
                      </svg>
                    </button>
                  </div>
                  <pre class="formatted-content"><code>{headData.headContent}</code></pre>
                </div>
              </div>
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
              <div class="raw-html-section">
                <h5>Kompletter HTML-Quelltext der Seite:</h5>
                <div class="raw-html-info">
                  <p><strong>URL:</strong> {testUrl}</p>
                  <p><strong>Bot-Modus:</strong> {isBotMode ? '✅ Aktiv (Googlebot Simulation)' : '❌ Inaktiv (Normaler Browser)'}</p>
                  <p><strong>User-Agent:</strong> <code>{navigator.userAgent}</code></p>
                  <p><strong>HTML-Länge:</strong> {headData.rawHtml ? headData.rawHtml.length.toLocaleString() : 'Unbekannt'} Zeichen</p>
                  {#if headData.responseInfo}
                    <p><strong>Server-Response:</strong> {headData.responseInfo.status} {headData.responseInfo.statusText}</p>
                    <p><strong>Content-Type:</strong> {headData.responseInfo.contentType || 'Unbekannt'}</p>
                    <p><strong>Server:</strong> {headData.responseInfo.server || 'Unbekannt'}</p>
                  {/if}
                  <p><strong>Status:</strong> <span class="status-good">✅ HTML erfolgreich geladen</span></p>
                </div>

                {#if headData.rawHtml}
                  <div class="raw-html-container">
                    <div class="raw-html-wrapper">
                      <div class="raw-html-actions">
                        <button
                          class="code-action-btn"
                          on:click={() => copyRawHtml(headData.rawHtml)}
                          title="HTML-Quelltext kopieren"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                          </svg>
                        </button>
                        <button
                          class="code-action-btn"
                          on:click={toggleHeadOnly}
                          title="Nur Head-Bereich anzeigen"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M7 14l5-5 5 5"/>
                          </svg>
                        </button>
                        <button
                          class="code-action-btn"
                          on:click={toggleWordWrap}
                          title="Code umbrechen"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>
                          </svg>
                        </button>
                      </div>
                      <pre class="raw-html-content"><code>{headData.rawHtml}</code></pre>
                    </div>
                  </div>
                {:else}
                  <div class="raw-html-error">
                    <p>❌ Kein HTML-Quelltext verfügbar</p>
                    <ul>
                      <li>Die Seite konnte nicht geladen werden</li>
                      <li>CORS-Beschränkungen verhindern den Zugriff</li>
                      <li>Die URL ist nicht erreichbar</li>
                    </ul>
                  </div>
                {/if}
              </div>
            {:else if activeTab === 'botview'}
              <div class="bot-view-section">
                <h5>Bot View - Wie Google & Bots die Seite sehen:</h5>
                <div class="bot-view-info">
                  <p><strong>URL:</strong> {testUrl}</p>
                  <p><strong>Bot-Modus:</strong> {isBotMode ? '✅ Aktiv (Googlebot Simulation)' : '❌ Inaktiv (Normaler Browser)'}</p>
                  <p><strong>User-Agent:</strong> <code>{navigator.userAgent}</code></p>
                  <p><strong>Content-Type:</strong> {headData?.responseInfo?.contentType || 'Unbekannt'}</p>
                </div>

                {#if headData && headData.rawHtml}
                  {#if headData.responseInfo?.contentType?.includes('xml')}
                    <div class="bot-view-container">
                      <div class="bot-view-header">
                        <div class="bot-view-controls">
                          <button class="bot-view-btn" on:click={() => { const iframe = document.querySelector('.bot-view-iframe'); if (iframe) iframe.src = iframe.src; }} title="Vorschau neu laden">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
                            Neu laden
                          </button>
                        </div>
                        <div class="bot-view-status">
                          <span class="status-good">✅ XML Bot View verfügbar</span>
                        </div>
                      </div>
                      <div class="bot-view-frame-container">
                        <iframe
                          class="bot-view-iframe"
                          srcdoc={`<!DOCTYPE html><html><head><title>XML Preview</title><style>body{font-family:monospace;padding:20px;background:#f5f5f5;margin:0;}pre{background:white;padding:20px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);overflow-x:auto;white-space:pre-wrap;word-wrap:break-word;}</style></head><body><pre>${headData.rawHtml.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body></html>`}
                          title="XML Bot View Vorschau"
                          style="width: 100%; height: 600px; border: 1px solid var(--border-color); border-radius: 8px; background: white;"
                          sandbox="allow-same-origin allow-scripts"
                        ></iframe>
                      </div>
                      <div class="bot-view-details">
                        <h6>XML Bot View Details:</h6>
                        <div class="bot-view-stats">
                          <div class="bot-stat"><strong>Content-Type:</strong> {headData.responseInfo?.contentType || 'Unbekannt'}</div>
                          <div class="bot-stat"><strong>Server:</strong> {headData.responseInfo?.server || 'Unbekannt'}</div>
                          <div class="bot-stat"><strong>Status:</strong> {headData.responseInfo?.status || 'Unbekannt'} {headData.responseInfo?.statusText || ''}</div>
                          <div class="bot-stat"><strong>XML-Länge:</strong> {headData.rawHtml.length.toLocaleString()} Zeichen</div>
                          <div class="bot-stat"><strong>URLs in Sitemap:</strong> {(headData.rawHtml.match(/<url>/g) || []).length} gefunden</div>
                          <div class="bot-stat"><strong>Images in Sitemap:</strong> {(headData.rawHtml.match(/<image:image>/g) || []).length} gefunden</div>
                        </div>
                      </div>
                    </div>
                  {:else}
                    <div class="bot-view-container">
                      <div class="bot-view-header">
                        <div class="bot-view-controls">
                          <button class="bot-view-btn" on:click={() => { const iframe = document.querySelector('.bot-view-iframe'); if (iframe) iframe.src = iframe.src; }} title="Vorschau neu laden">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
                            Neu laden
                          </button>
                          <button class="bot-view-btn" on:click={() => { const iframe = document.querySelector('.bot-view-iframe'); if (iframe) iframe.style.width = iframe.style.width === '100%' ? '375px' : '100%'; }} title="Mobile/Desktop Ansicht wechseln">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                            Mobile/Desktop
                          </button>
                          <button class="bot-view-btn" on:click={() => { const iframe = document.querySelector('.bot-view-iframe'); if (iframe) iframe.style.height = iframe.style.height === '600px' ? '400px' : '600px'; }} title="Höhe anpassen">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
                            Höhe
                          </button>
                        </div>
                        <div class="bot-view-status">
                          <span class="status-good">✅ HTML Bot View verfügbar</span>
                        </div>
                      </div>
                      <div class="bot-view-frame-container">
                        <iframe
                          class="bot-view-iframe"
                          srcdoc={headData.rawHtml}
                          title="HTML Bot View Vorschau"
                          style="width: 100%; height: 600px; border: 1px solid var(--border-color); border-radius: 8px; background: white;"
                          sandbox="allow-same-origin allow-scripts"
                        ></iframe>
                      </div>
                      <div class="bot-view-details">
                        <h6>HTML Bot View Details:</h6>
                        <div class="bot-view-stats">
                          <div class="bot-stat"><strong>Title:</strong> {headData.title || 'Kein Title gefunden'}</div>
                          <div class="bot-stat"><strong>Description:</strong> {headData.metaTags?.find((tag) => tag.name === 'description' || tag.property === 'og:description')?.content || 'Keine Description gefunden'}</div>
                          <div class="bot-stat"><strong>Meta Tags:</strong> {headData.metaTags?.length || 0} gefunden</div>
                          <div class="bot-stat"><strong>JSON-LD:</strong> {headData.jsonLdData?.length || 0} Schema(s) gefunden</div>
                          <div class="bot-stat"><strong>Favicons:</strong> {headData.faviconInfo?.count || 0} gefunden</div>
                          <div class="bot-stat"><strong>Open Graph:</strong> {headData.metaTags?.filter((tag) => tag.property?.startsWith('og:')).length || 0} Tags gefunden</div>
                        </div>
                      </div>
                    </div>
                  {/if}
                {:else}
                  <div class="raw-html-error">
                    <p>❌ Bot View nicht verfügbar</p>
                    <ul>
                      <li>Die Seite konnte nicht geladen werden</li>
                      <li>Kein Content verfügbar</li>
                      <li>CORS-Beschränkungen verhindern die Vorschau</li>
                    </ul>
                  </div>
                {/if}
              </div>
            {:else if activeTab === 'fullscreen'}
              <div class="fullscreen-section">
                <h5>Fullscreen — Seite im gesamten Browser anzeigen:</h5>
                <p class="fullscreen-hint">Die Seite wird als Vollbild-Overlay über dem gesamten Browserfenster geladen. Schließen mit dem X-Button oder Escape.</p>
                <button class="fullscreen-open-btn" on:click={() => fullscreenOpen = true}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
                  Fullscreen öffnen
                </button>
              </div>
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

      <div class="seo-info">
        <h3>Über dieses Tool</h3>
        <p>
          Die Anwendung ist auf Performance getrimmt, damit die Items aber auch in Suchmaschinen, Sozialen Medien und KI funktionieren, wurden Teile auf SSR umgestellt, damit SEO, Schemas und OpenGraph zu 100% greifen.
        </p>
        <p>
          Google Suche, Bildersuche, Facebook, Instagram, WhatsApp, LLMs, Email u.v.m. können Culoca Inhalte direkt darstellen.
        </p>
        <p>
          Google stellt zum Testen der Schemas ein eigenes Werkzeug zur Verfügung:
          <a href="https://search.google.com/test/rich-results" target="_blank" rel="noopener">Rich Results Test</a>
        </p>
      </div>
    </div>
  </main>

  <SiteFooter />
</div>

{#if fullscreenOpen && testUrl}
  <div class="fullscreen-overlay">
    <div class="fullscreen-toolbar">
      <span class="fullscreen-url">{testUrl}</span>
      <div class="fullscreen-actions">
        <a href={testUrl} target="_blank" rel="noopener" class="fullscreen-action-btn" title="In neuem Tab öffnen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
        <button class="fullscreen-close-btn" on:click={() => fullscreenOpen = false} title="Schließen (Esc)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
    <iframe
      src={testUrl}
      title="Fullscreen Vorschau"
      class="fullscreen-iframe"
      sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
    ></iframe>
  </div>
{/if}

<style>
  .seo-page {
    min-height: 100vh;
    background: var(--bg-primary);
    color: var(--text-primary);
    display: flex;
    flex-direction: column;
  }

  .seo-main {
    flex: 1;
    width: 100%;
  }

  .seo-hero {
    padding: 3rem 2rem 2rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .seo-hero h1 {
    font-size: 2rem;
    font-weight: 700;
    margin: 0 0 0.75rem;
    color: var(--text-primary);
    display: flex;
    align-items: center;
  }

  .hero-subtitle {
    font-size: 1.1rem;
    color: var(--text-secondary);
    margin: 0;
    max-width: 700px;
    line-height: 1.6;
  }

  .seo-content {
    padding: 2rem;
  }

  /* URL Input */
  .url-input-section {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .url-input {
    flex: 1;
    padding: 0.85rem 1rem;
    border: 2px solid var(--border-color);
    border-radius: 10px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 1rem;
    font-family: inherit;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .url-input:focus {
    outline: none;
    border-color: var(--culoca-orange);
    box-shadow: 0 0 0 3px rgba(238, 114, 33, 0.15);
  }

  .analyze-btn {
    padding: 0.85rem 1.5rem;
    background: var(--culoca-orange);
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.2s, transform 0.1s;
  }

  .analyze-btn:hover:not(:disabled) {
    background: #d4621a;
    transform: translateY(-1px);
  }

  .analyze-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Bot section */
  .bot-test-section {
    margin-bottom: 1.5rem;
    padding: 0.85rem 1rem;
    background: var(--bg-secondary);
    border-radius: 10px;
    border: 1px solid var(--border-color);
  }

  .bot-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .bot-label input[type="checkbox"] {
    margin: 0;
    accent-color: var(--culoca-orange);
  }

  .bot-label-text {
    font-weight: 500;
    color: var(--text-primary);
  }

  .bot-label-sub {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .bot-info {
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: color-mix(in srgb, var(--culoca-orange) 8%, var(--bg-primary));
    border-radius: 8px;
    border-left: 3px solid var(--culoca-orange);
  }

  .bot-info p {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .bot-ua {
    font-family: monospace;
    font-size: 0.75rem !important;
    margin-top: 0.25rem !important;
    color: var(--text-muted) !important;
  }

  /* Loading / Error */
  .loading {
    padding: 1.5rem;
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.95rem;
  }

  .error {
    padding: 1rem;
    background: color-mix(in srgb, #ef4444 10%, var(--bg-primary));
    color: #ef4444;
    border-radius: 10px;
    border: 1px solid color-mix(in srgb, #ef4444 25%, transparent);
    margin-top: 1rem;
    font-size: 0.95rem;
  }

  /* Analysis section */
  .analysis-section {
    margin-bottom: 2rem;
  }

  .analysis-section h3 {
    font-size: 1.15rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 1rem;
  }

  .analysis-section h3 a {
    color: var(--culoca-orange);
    text-decoration: none;
  }

  .analysis-section h3 a:hover {
    text-decoration: underline;
  }

  /* Tabs */
  .head-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-bottom: 1.25rem;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 0.5rem;
  }

  .tab-button {
    padding: 0.5rem 1rem;
    background: none;
    border: 1px solid transparent;
    border-radius: 8px;
    color: var(--text-secondary);
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }

  .tab-button:hover {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .tab-button.active {
    background: var(--bg-tertiary);
    color: var(--culoca-orange);
    border-color: var(--culoca-orange);
  }

  /* SEO Items */
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
    margin: 0 0 0.5rem;
    color: var(--text-primary);
    font-size: 1rem;
  }

  .seo-item p {
    margin: 0.25rem 0;
    color: var(--text-secondary);
  }

  .status-good { color: #22c55e; font-weight: 600; }
  .status-warning { color: #f59e0b; font-weight: 600; }
  .no-data { color: var(--text-muted); font-style: italic; }

  /* Editable fields */
  .editable-text-field { margin-top: 0.5rem; }

  .seo-textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: inherit;
    font-size: 0.9rem;
    line-height: 1.4;
    resize: vertical;
    min-height: 60px;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .seo-textarea:focus {
    outline: none;
    border-color: var(--culoca-orange);
    box-shadow: 0 0 0 2px rgba(238, 114, 33, 0.1);
  }

  .seo-textarea::placeholder { color: var(--text-muted); font-style: italic; }

  .seo-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: inherit;
    font-size: 0.9rem;
    line-height: 1.4;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .seo-input:focus {
    outline: none;
    border-color: var(--culoca-orange);
    box-shadow: 0 0 0 2px rgba(238, 114, 33, 0.1);
  }

  .seo-select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: inherit;
    font-size: 0.9rem;
    cursor: pointer;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .seo-select:focus {
    outline: none;
    border-color: var(--culoca-orange);
    box-shadow: 0 0 0 2px rgba(238, 114, 33, 0.1);
  }

  /* Prompt */
  .prompt-section {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
  }

  .prompt-section h6 {
    margin: 0 0 0.5rem;
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
    border-radius: 8px;
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
    border-color: var(--culoca-orange);
  }

  .copy-button {
    flex-shrink: 0;
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-primary);
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 40px;
    height: 40px;
  }

  .copy-button:hover {
    background: var(--bg-secondary);
    border-color: var(--culoca-orange);
    color: var(--culoca-orange);
  }

  /* Images tab */
  .images-analysis h5, .meta-analysis h5, .raw-html-section h5, .bot-view-section h5, .fullscreen-section h5 {
    margin: 0 0 1rem;
    color: var(--text-primary);
    font-size: 1.1rem;
  }

  .image-section, .favicon-section, .culoca-fallback-section {
    margin-bottom: 1.5rem;
  }

  .image-section h6, .favicon-section h6, .culoca-fallback-section h6,
  .favicon-sizes-display h6, .bot-view-details h6 {
    margin: 0 0 0.75rem;
    color: var(--text-primary);
    font-size: 1rem;
  }

  .image-info p, .favicon-info p, .favicon-stats p, .culoca-fallback-info p {
    margin: 0.25rem 0;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .image-preview {
    margin-top: 0.75rem;
  }

  .image-preview img {
    max-width: 100%;
    max-height: 300px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }

  .favicon-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .favicon-item {
    display: flex;
    gap: 1rem;
    align-items: center;
    padding: 0.75rem;
    background: var(--bg-secondary);
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }

  .favicon-preview img {
    width: 64px;
    height: 64px;
    object-fit: contain;
    border-radius: 4px;
  }

  .favicon-sizes-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: flex-end;
  }

  .favicon-size-item {
    text-align: center;
  }

  .favicon-size-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-bottom: 0.25rem;
  }

  .favicon-size-display {
    border: 1px solid var(--border-color);
    border-radius: 4px;
    overflow: hidden;
    background: var(--bg-secondary);
  }

  /* Code containers */
  .code-action-btn {
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
  }

  .code-action-btn:hover {
    background: var(--bg-secondary);
    border-color: var(--culoca-orange);
    color: var(--culoca-orange);
  }

  .raw-html-container, .formatted-container, .jsonld-container {
    margin-top: 1rem;
    border: 1px solid var(--border-color);
    border-radius: 10px;
    overflow: hidden;
  }

  .raw-html-wrapper, .formatted-wrapper, .jsonld-wrapper {
    position: relative;
  }

  .raw-html-actions, .formatted-actions, .jsonld-actions {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    display: flex;
    gap: 0.25rem;
    z-index: 10;
  }

  .raw-html-content, .formatted-content, .jsonld-content {
    background: var(--bg-secondary);
    padding: 1rem;
    overflow-x: auto;
    font-size: 0.85rem;
    line-height: 1.4;
    color: var(--text-secondary);
    margin: 0;
    max-height: 400px;
    transition: max-height 0.3s;
  }

  .raw-html-content.expanded { max-height: none; }

  .raw-html-content.word-wrap,
  .formatted-content.word-wrap,
  .jsonld-content.word-wrap {
    white-space: pre-wrap !important;
    word-wrap: break-word !important;
    overflow-wrap: break-word !important;
  }

  .raw-html-content.head-only,
  .formatted-content.head-only {
    max-height: 200px !important;
    overflow: hidden !important;
  }

  .raw-html-info, .bot-view-info {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .raw-html-info p, .bot-view-info p {
    margin: 0.4rem 0;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .raw-html-info code, .bot-view-info code {
    background: var(--bg-primary);
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    font-size: 0.8rem;
  }

  .raw-html-error {
    background: color-mix(in srgb, #ef4444 8%, var(--bg-primary));
    border: 1px solid color-mix(in srgb, #ef4444 20%, transparent);
    border-radius: 10px;
    padding: 1.5rem;
    color: #ef4444;
  }

  .raw-html-error p { margin: 0.4rem 0; }
  .raw-html-error ul { margin: 0.5rem 0; padding-left: 1.5rem; }
  .raw-html-error li { margin: 0.25rem 0; }

  /* Meta tab */
  .meta-stats {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .meta-stats span {
    padding: 0.5rem 1rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .meta-list {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .meta-item {
    padding: 0.65rem 0.85rem;
    background: var(--bg-secondary);
    border-radius: 6px;
    font-size: 0.9rem;
    color: var(--text-secondary);
    word-break: break-all;
  }

  .meta-item strong {
    color: var(--text-primary);
  }

  /* Bot view */
  .bot-view-container {
    border: 1px solid var(--border-color);
    border-radius: 10px;
    overflow: hidden;
    background: var(--bg-tertiary);
  }

  .bot-view-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .bot-view-controls {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .bot-view-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-primary);
    color: var(--text-primary);
    cursor: pointer;
    font-size: 0.85rem;
    font-family: inherit;
    transition: all 0.2s;
  }

  .bot-view-btn:hover {
    background: var(--bg-secondary);
    border-color: var(--culoca-orange);
    color: var(--culoca-orange);
  }

  .bot-view-btn svg { width: 14px; height: 14px; }
  .bot-view-status { font-size: 0.9rem; }

  .bot-view-frame-container {
    padding: 1rem;
    background: var(--bg-primary);
    display: flex;
    justify-content: center;
  }

  .bot-view-iframe {
    transition: all 0.3s;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .bot-view-details {
    padding: 1rem;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border-color);
  }

  .bot-view-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 0.75rem;
  }

  .bot-stat {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 0.75rem;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .bot-stat strong {
    color: var(--text-primary);
    display: block;
    margin-bottom: 0.15rem;
  }

  /* Info section */
  .seo-info {
    margin-top: 3rem;
    padding: 2rem;
    background: var(--bg-secondary);
    border-radius: 12px;
    border: 1px solid var(--border-color);
  }

  .seo-info h3 {
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.75rem;
  }

  .seo-info p {
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0 0 0.75rem;
  }

  .seo-info a {
    color: var(--culoca-orange);
    text-decoration: none;
  }

  .seo-info a:hover {
    text-decoration: underline;
  }

  /* Prompt analysis */
  .prompt-analysis h5 {
    margin: 0 0 1rem;
    color: var(--text-primary);
    font-size: 1.1rem;
  }

  @media (max-width: 768px) {
    .seo-hero { padding: 2rem 1rem 1.5rem; }
    .seo-hero h1 { font-size: 1.5rem; }
    .hero-subtitle { font-size: 0.95rem; }
    .seo-content { padding: 1rem; }
    .url-input-section { flex-direction: column; }
    .analyze-btn { width: 100%; }
    .bot-view-controls { flex-direction: column; }
    .bot-view-header { flex-direction: column; align-items: flex-start; }
  }

  /* Fullscreen tab */
  .fullscreen-section {
    padding: 1.5rem;
  }

  .fullscreen-hint {
    color: var(--text-secondary);
    margin: 0.5rem 0 1.25rem;
    font-size: 0.95rem;
  }

  .fullscreen-open-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: var(--culoca-orange, #e67e22);
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s, transform 0.15s;
  }

  .fullscreen-open-btn:hover {
    background: #cf6e17;
    transform: translateY(-1px);
  }

  /* Fullscreen overlay */
  :global(.fullscreen-overlay) {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary, #fff);
  }

  :global(.fullscreen-toolbar) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1rem;
    background: var(--bg-secondary, #1a1a2e);
    border-bottom: 1px solid var(--border-color, #333);
    min-height: 44px;
    flex-shrink: 0;
  }

  :global(.fullscreen-url) {
    font-size: 0.85rem;
    color: var(--text-secondary, #aaa);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: calc(100% - 100px);
  }

  :global(.fullscreen-actions) {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  :global(.fullscreen-action-btn) {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 6px;
    border: 1px solid var(--border-color, #444);
    background: transparent;
    color: var(--text-secondary, #aaa);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    text-decoration: none;
  }

  :global(.fullscreen-action-btn:hover) {
    background: var(--bg-tertiary, #333);
    color: var(--text-primary, #fff);
  }

  :global(.fullscreen-close-btn) {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 6px;
    border: 1px solid var(--border-color, #444);
    background: transparent;
    color: var(--text-secondary, #aaa);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  :global(.fullscreen-close-btn:hover) {
    background: #e74c3c;
    border-color: #e74c3c;
    color: #fff;
  }

  :global(.fullscreen-iframe) {
    flex: 1;
    width: 100%;
    border: none;
    background: #fff;
  }
</style>
