<script lang="ts">
  import { unifiedRightsStore } from '$lib/unifiedRightsStore';

  export let image: any;
  export let isCreator: boolean;
  export let onSetLocationFilter: () => void;
  export let onCopyLink: () => void;
  export let onDeleteImage: () => void;
  export let onDownloadOriginal: (id: string, name: string) => void;
  export let onToggleFavorite: () => void;
  export let onToggleLike: () => void;
  export let onToggleGallery: () => void;
  export let calendarUrl: string | null = null;
  export let editMode = false;
  export let externalUrl = '';
  export let videoUrl = '';
  export let contentHtml = '';
  export let nearbyGalleryMode = 'default';
  export let showGalleryToggle = true;
  export let showCalendarDownload = false;
  export let highlightCalendar = false;
  export let darkMode = false;
  export let rotating = false;
  export let canFavorite = false;
  export let isFavorited = false;
  export let favoriteLoading = false;
  export let canLike = false;
  export let isLiked = false;
  export let likeLoading = false;

  type HtmlSnippet = {
    label: string;
    title: string;
    start: string;
    end?: string;
    placeholder?: string;
  };

  const htmlTools: HtmlSnippet[] = [
    { label: 'H2', title: 'Zwischenüberschrift H2', start: '<h2>', end: '</h2>', placeholder: 'Zwischenüberschrift' },
    { label: 'H3', title: 'Zwischenüberschrift H3', start: '<h3>', end: '</h3>', placeholder: 'Abschnitt' },
    { label: 'P', title: 'Absatz', start: '<p>', end: '</p>', placeholder: 'Text' },
    { label: 'BR', title: 'Zeilenumbruch', start: '<br>' },
    { label: 'UL', title: 'Unsortierte Liste', start: '<ul>\n  <li>', end: '</li>\n</ul>', placeholder: 'Punkt' },
    { label: 'OL', title: 'Nummerierte Liste', start: '<ol>\n  <li>', end: '</li>\n</ol>', placeholder: 'Punkt' },
    { label: 'LI', title: 'Listenpunkt', start: '<li>', end: '</li>', placeholder: 'Punkt' },
    { label: 'Strong', title: 'Fett', start: '<strong>', end: '</strong>', placeholder: 'Wichtig' },
    { label: 'Link', title: 'Link', start: '<a href="https://">', end: '</a>', placeholder: 'Linktext' },
  ];

  let contentTextarea: HTMLTextAreaElement | null = null;

  $: rights = $unifiedRightsStore.rights;
  $: loading = $unifiedRightsStore.loading;
  $: hasMapLocation = !!(image?.lat && image?.lon);
  $: canDownload = !!(rights?.download || rights?.download_original || isCreator);
  $: showControls = hasMapLocation || canFavorite || canLike || canDownload || (isCreator && editMode);

  function insertHtmlSnippet(tool: HtmlSnippet) {
    if (!contentTextarea) {
      const value = tool.end ? `${tool.start}${tool.placeholder || ''}${tool.end}` : tool.start;
      contentHtml = `${contentHtml}${contentHtml ? '\n' : ''}${value}`;
      return;
    }

    const start = contentTextarea.selectionStart ?? contentHtml.length;
    const end = contentTextarea.selectionEnd ?? start;
    const selected = contentHtml.slice(start, end);
    const middle = selected || tool.placeholder || '';
    const snippet = tool.end ? `${tool.start}${middle}${tool.end}` : tool.start;

    contentHtml = `${contentHtml.slice(0, start)}${snippet}${contentHtml.slice(end)}`;

    requestAnimationFrame(() => {
      if (!contentTextarea) return;
      const cursorStart = start + tool.start.length;
      const cursorEnd = tool.end ? cursorStart + middle.length : start + snippet.length;
      contentTextarea.focus();
      contentTextarea.setSelectionRange(cursorStart, cursorEnd);
    });
  }
</script>

<div class="controls-section" class:dark={darkMode}>
  {#if showControls}
    {#if hasMapLocation || canFavorite || canLike || canDownload}
      <div class="action-buttons">
        {#if externalUrl?.trim()}
          <a class="square-btn website-btn" href={externalUrl} target="_blank" rel="noopener noreferrer" title="Webseite öffnen">
            <svg width="35" height="35" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M14 4h6v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M20 4l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M10 6H7a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </a>
        {/if}
        <a class="square-btn gmaps-btn" href={`https://www.google.com/maps?q=${image.lat},${image.lon}`} target="_blank" rel="noopener" title="Google Maps öffnen">
          <svg width="35" height="35" viewBox="0 0 24 24" class="google-logo">
            <path class="google-blue" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor"/>
            <path class="google-green" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor"/>
            <path class="google-yellow" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="currentColor"/>
            <path class="google-red" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor"/>
          </svg>
        </a>
        <button class="square-btn location-filter-btn" on:click={onSetLocationFilter} title="Als Location-Filter setzen">
          <svg width="35" height="35" viewBox="0 0 83.86 100.88" fill="currentColor">
            <path d="M0,41.35c0-5.67,1.1-11.03,3.29-16.07,2.19-5.04,5.19-9.43,8.98-13.17,3.79-3.74,8.25-6.69,13.36-8.86,5.11-2.17,10.54-3.25,16.29-3.25s11.18,1.08,16.29,3.25c5.11,2.17,9.56,5.12,13.36,8.86,3.79,3.74,6.79,8.13,8.98,13.17,2.19,5.04,3.29,10.4,3.29,16.07s-1.1,11.03-3.29,16.07c-2.2,5.04-5.19,9.43-8.98,13.17-3.8,3.74-8.25,6.7-13.36,8.86-5.11,2.17-9.49,21.42-15.25,21.42s-12.23-19.25-17.34-21.42c-5.11-2.17-9.56-5.12-13.36-8.86-3.79-3.74-6.79-8.13-8.98-13.17-2.2-5.04-3.29-10.4-3.29-16.07ZM25.16,41.35c0,2.29.44,4.43,1.32,6.44.88,2.01,2.07,3.76,3.59,5.26,1.52,1.5,3.29,2.68,5.33,3.55,2.04.87,4.21,1.3,6.53,1.3s4.49-.43,6.53-1.3c2.04-.87,3.81-2.05,5.33-3.55,1.52-1.5,2.71-3.25,3.59-5.26.88-2.01,1.32-4.15,1.32-6.44s-.44-4.43-1.32-6.44c-.88-2.01-2.08-3.76-3.59-5.26-1.52-1.5-3.29-2.68-5.33-3.55-2.03-.87-4.21-1.3-6.53-1.3s-4.49.43-6.53,1.3c-2.04.87-3.81,2.05-5.33,3.55-1.52,1.5-2.72,3.25-3.59,5.26-.88,2.01-1.32,4.16-1.32,6.44Z"/>
          </svg>
        </button>
        <button class="square-btn share-btn" on:click={onCopyLink} title="Link kopieren">
          <svg width="35" height="35" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
          </svg>
        </button>

        {#if canFavorite}
          <button
            class="square-btn favorite-btn"
            class:is-active={isFavorited}
            on:click={onToggleFavorite}
            title={isFavorited ? 'Aus Merkliste entfernen' : 'Merken'}
            disabled={favoriteLoading}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill={isFavorited ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
        {/if}

        {#if canLike}
          <button
            class="square-btn like-btn"
            class:is-active={isLiked}
            on:click={onToggleLike}
            title={isLiked ? 'Like entfernen' : 'Gefällt mir'}
            disabled={likeLoading}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M7 11V21" />
              <path d="M14 5.88L13 10H18.76A2 2 0 0 1 20.72 12.39L19.77 18.39A2 2 0 0 1 17.79 20H7V10L10.59 3.82A1 1 0 0 1 12.4 4.22V5.88Z" />
            </svg>
          </button>
        {/if}

        {#if rights?.delete || isCreator}
          <button class="square-btn delete-btn" on:click={onDeleteImage} title="Bild löschen" disabled={loading}>
            <svg width="35" height="35" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
          </button>
        {/if}

        {#if canDownload}
          <button class="square-btn download-btn" data-download-id={image.id} on:click={() => onDownloadOriginal(image.id, image.original_name)} title="Download öffnen" disabled={rotating || loading}>
            <svg width="35" height="35" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 6v7m0 0l-3-3m3 3l3-3M6 18h12"/>
            </svg>
          </button>
        {/if}

        {#if showCalendarDownload && calendarUrl}
          <a class="square-btn calendar-btn" class:alarm={highlightCalendar} href={calendarUrl} title="Termin in Kalender öffnen">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M7 2h2v2h6V2h2v2h2a2 2 0 0 1 2 2v13a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2h2V2zm12 8H5v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9zM6 6a1 1 0 0 0-1 1v1h14V7a1 1 0 0 0-1-1H6zm2 6h3v3H8v-3z"/>
            </svg>
          </a>
        {/if}

        {#if showGalleryToggle && (rights?.edit || isCreator)}
          <button class="square-btn gallery-toggle-btn" on:click={onToggleGallery} title="Variante loesen" class:active={!!image?.group_root_item_id} disabled={loading}>
            {#if image?.group_root_item_id}
              <svg width="25" height="25" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="3" width="4" height="4"/>
                <rect x="10" y="3" width="4" height="4"/>
                <rect x="17" y="3" width="4" height="4"/>
                <rect x="3" y="10" width="4" height="4"/>
                <rect x="10" y="10" width="4" height="4"/>
                <rect x="17" y="10" width="4" height="4"/>
                <rect x="3" y="17" width="4" height="4"/>
                <rect x="10" y="17" width="4" height="4"/>
                <rect x="17" y="17" width="4" height="4"/>
              </svg>
            {:else}
              <svg width="25" height="25" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" stroke="currentColor" stroke-width="1" fill="none"/>
              </svg>
            {/if}
          </button>
        {/if}
      </div>
    {/if}

    {#if isCreator && editMode}
      <div class="external-url-row">
        <label class="external-url-label" for="external-url-input">Webseite</label>
        <input
          id="external-url-input"
          type="url"
          bind:value={externalUrl}
          placeholder="https://..."
          autocomplete="off"
          autocorrect="off"
          autocapitalize="none"
          inputmode="url"
        />
      </div>

      <div class="content-editor-row">
        <label class="external-url-label" for="video-url-input">Video URL</label>
        <input
          id="video-url-input"
          type="url"
          bind:value={videoUrl}
          placeholder="https://youtube.com/... oder https://vimeo.com/..."
          autocomplete="off"
          autocorrect="off"
          autocapitalize="none"
          inputmode="url"
        />
      </div>

      <div class="content-editor-row">
        <div class="content-editor-header">
          <label class="external-url-label" for="content-html-input">HTML</label>
          <span class="content-editor-hint">Erlaubt: h2, h3, h4, h5, p, br, ul, ol, li, strong, a</span>
        </div>
        <div class="content-toolbar" aria-label="HTML Werkzeuge">
          {#each htmlTools as tool}
            <button type="button" class="content-tool-btn" title={tool.title} on:click={() => insertHtmlSnippet(tool)}>
              {tool.label}
            </button>
          {/each}
        </div>
        <textarea
          id="content-html-input"
          bind:this={contentTextarea}
          bind:value={contentHtml}
          rows="8"
          placeholder="<p>Kurzer, sicherer HTML-Inhalt</p>"
          spellcheck="false"
        ></textarea>
      </div>

      <div class="external-url-row">
        <label class="external-url-label" for="nearby-gallery-mode">NearBy Galerie</label>
        <select id="nearby-gallery-mode" bind:value={nearbyGalleryMode}>
          <option value="default">Type Default</option>
          <option value="enabled">Aktiviert</option>
          <option value="disabled">Deaktiviert</option>
        </select>
      </div>
    {/if}
  {/if}
</div>

<style>
  .controls-section {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.7rem;
    margin-bottom: 0.2rem;
    background: transparent;
    margin-top: 12px;
  }
  .action-buttons {
    display: flex;
    gap: 0.7rem;
    justify-content: center;
    margin-top: 0;
    margin-bottom: 0.2rem;
    background: transparent;
    flex-wrap: wrap;
  }
  .square-btn {
    width: 50px;
    height: 50px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 8px;
    text-decoration: none;
    font-size: 0;
    padding: 0;
  }
  .square-btn:hover {
    background: var(--bg-tertiary);
    border-color: var(--text-primary);
    transform: scale(1.05);
  }
  .square-btn:focus {
    outline: none;
    border-color: var(--accent-color);
  }
  .square-btn svg {
    width: 35px;
    height: 35px;
    fill: currentColor;
  }
  .gmaps-btn .google-logo .google-blue,
  .gmaps-btn .google-logo .google-green,
  .gmaps-btn .google-logo .google-yellow,
  .gmaps-btn .google-logo .google-red {
    transition: fill 0.2s;
    fill: currentColor;
  }
  .website-btn:hover {
    background: var(--culoca-orange);
    border-color: var(--culoca-orange);
    color: #fff;
  }
  .gmaps-btn:hover .google-logo .google-blue { fill: #4285F4; }
  .gmaps-btn:hover .google-logo .google-green { fill: #34A853; }
  .gmaps-btn:hover .google-logo .google-yellow { fill: #FBBC05; }
  .gmaps-btn:hover .google-logo .google-red { fill: #EA4335; }
  .external-url-row,
  .content-editor-row {
    width: 100%;
    max-width: 640px;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin-top: 0.25rem;
  }
  .external-url-label {
    font-size: 0.78rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-secondary);
    text-align: center;
  }
  .external-url-row input,
  .external-url-row select,
  .content-editor-row textarea {
    width: 100%;
    padding: 0.55rem 0.75rem;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font: inherit;
  }
  .content-editor-header {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    align-items: center;
  }
  .content-editor-hint {
    color: var(--text-secondary);
    font-size: 0.85rem;
    text-align: center;
  }
  .content-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: flex-start;
    padding: 0.35rem 0.15rem 0;
  }
  .content-tool-btn {
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
    color: var(--text-primary);
    border-radius: 10px;
    padding: 0.45rem 0.8rem;
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .content-tool-btn:hover {
    border-color: var(--culoca-orange);
    color: var(--culoca-orange);
    background: color-mix(in srgb, var(--culoca-orange) 8%, var(--bg-secondary));
  }
  .content-editor-row textarea {
    min-height: 12rem;
    resize: vertical;
    line-height: 1.6;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  }
  .location-filter-btn {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
  .location-filter-btn:hover svg {
    fill: #ee7221;
  }
  .delete-btn {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
  .favorite-btn {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
  .favorite-btn:hover,
  .favorite-btn.is-active {
    background: rgba(238, 114, 33, 0.12);
    color: #ee7221;
    border-color: rgba(238, 114, 33, 0.4);
  }
  .like-btn {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
  .like-btn:hover,
  .like-btn.is-active {
    background: rgba(37, 99, 235, 0.12);
    color: #2563eb;
    border-color: rgba(37, 99, 235, 0.36);
  }
  .delete-btn:hover {
    background: #dc3545;
    color: white;
    border-color: #dc3545;
  }
  .download-btn {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
  .download-btn:hover {
    background: #28a745;
    color: white;
    border-color: #28a745;
  }
  .calendar-btn:hover {
    background: #f59e0b;
    color: white;
    border-color: #f59e0b;
  }
  .calendar-btn {
    color: var(--text-primary);
    fill: currentColor;
  }
  :global(body[data-theme='dark']) .calendar-btn {
    color: #f8fafc;
  }
  .calendar-btn svg,
  .calendar-btn path {
    fill: currentColor;
  }
  .calendar-btn.alarm {
    color: #dbeafe;
    border-color: #60a5fa;
    background: radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.78), rgba(30, 64, 175, 0.92));
    box-shadow:
      0 0 0 1px rgba(147, 197, 253, 0.55),
      0 0 12px rgba(59, 130, 246, 0.95),
      0 0 24px rgba(37, 99, 235, 0.7);
    animation: calendar-alarm-pulse 1.05s ease-in-out infinite;
  }
  .calendar-btn.alarm:hover {
    background: radial-gradient(circle at 50% 50%, rgba(96, 165, 250, 0.92), rgba(30, 64, 175, 1));
    border-color: #bfdbfe;
    color: #fff;
  }

  @keyframes calendar-alarm-pulse {
    0%,
    100% {
      transform: scale(1);
      box-shadow:
        0 0 0 1px rgba(147, 197, 253, 0.55),
        0 0 10px rgba(59, 130, 246, 0.95),
        0 0 20px rgba(37, 99, 235, 0.65);
    }
    50% {
      transform: scale(1.08);
      box-shadow:
        0 0 0 1px rgba(191, 219, 254, 0.75),
        0 0 18px rgba(96, 165, 250, 1),
        0 0 34px rgba(59, 130, 246, 0.82);
    }
  }
  .gallery-toggle-btn {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
  .gallery-toggle-btn:hover,
  .gallery-toggle-btn.active:hover {
    background: #007bff;
    color: #fff;
    border-color: #007bff;
  }
  .gallery-toggle-btn.active {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border-color: var(--border-color);
  }
  @media (max-width: 700px) {
    .external-url-row,
    .content-editor-row {
      max-width: 100%;
    }

    .square-btn {
      margin-left: 0;
    }
  }
</style>
