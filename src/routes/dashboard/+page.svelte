<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import SiteNav from '$lib/SiteNav.svelte';
  import SiteFooter from '$lib/SiteFooter.svelte';
  import { supabase } from '$lib/supabaseClient';
  import { getPublicItemHref } from '$lib/content/routing';
  import { getSeoImageUrl } from '$lib/utils/seoImageUrl';

  const PAGE_SIZE = 12;

  let currentUserId = '';
  let loading = true;
  let loadingItems = false;
  let errorMessage = '';
  let recentItems: any[] = [];
  let allItems: any[] = [];
  let searchQuery = '';
  let activeQuery = '';
  let currentPage = 1;
  let totalItems = 0;
  let historyBusy = false;
  let activeSection: 'recent' | 'photos' | 'notifications' | 'interactions' = 'recent';
  let notifications: any[] = [];
  let interactions: any[] = [];

  $: totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  $: canPrev = currentPage > 1;
  $: canNext = currentPage < totalPages;

  function formatDate(value: string | null | undefined): string {
    if (!value) return '';
    try {
      return new Date(value).toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  }

  function getItemThumb(item: any): string {
    return item?.slug && item?.path_512 ? getSeoImageUrl(item.slug, item.path_512, '512') : '';
  }

  function getNotificationActor(entry: any): string {
    return entry?.actor?.full_name || entry?.actor?.accountname || 'Jemand';
  }

  function getNotificationLabel(entry: any): string {
    switch (entry?.event_type) {
      case 'download':
        return 'hat ein Item heruntergeladen';
      case 'favorite_add':
        return 'hat ein Item gemerkt';
      case 'like_add':
        return 'hat ein Item geliked';
      case 'comment_create':
        return 'hat kommentiert';
      case 'comment_hide':
        return 'hat einen Kommentar ausgeblendet';
      case 'comment_restore':
        return 'hat einen Kommentar wiederhergestellt';
      case 'chat_message':
        return 'hat eine Nachricht gesendet';
      default:
        return entry?.event_type || 'hat interagiert';
    }
  }

  function getNotificationPreview(entry: any): string {
    if (entry?.payload?.message_excerpt) return entry.payload.message_excerpt;
    if (entry?.payload?.comment_excerpt) return entry.payload.comment_excerpt;
    return entry?.item?.title || entry?.item?.original_name || '';
  }

  function getNotificationHref(entry: any): string {
    if (entry?.event_type === 'chat_message' && entry?.payload?.conversation_id) {
      return `/chat?conversation=${encodeURIComponent(entry.payload.conversation_id)}`;
    }
    return entry?.item ? getPublicItemHref(entry.item) : '/dashboard';
  }

  function getInteractionActor(entry: any): string {
    return entry?.actor?.full_name || entry?.actor?.accountname || 'Jemand';
  }

  function getInteractionLabel(entry: any): string {
    switch (entry?.event_type) {
      case 'download':
        return 'hat dein Item heruntergeladen';
      case 'favorite_add':
        return 'hat dein Item gemerkt';
      case 'like_add':
        return 'hat dein Item geliked';
      case 'comment_create':
        return 'hat kommentiert';
      case 'comment_hide':
        return 'hat einen Kommentar ausgeblendet';
      case 'comment_restore':
        return 'hat einen Kommentar wiederhergestellt';
      case 'chat_message':
        return 'hat dir zu einem Item geschrieben';
      default:
        return entry?.event_type || 'hat interagiert';
    }
  }

  async function ensureAuthUser() {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id || '';
    if (!userId) {
      await goto('/login?returnTo=%2Fdashboard');
      return false;
    }
    currentUserId = userId;
    return true;
  }

  async function loadRecentItems() {
    const { data, error } = await supabase
      .from('item_events')
      .select(`
        item_id,
        created_at,
        items!inner(
          id,
          slug,
          title,
          original_name,
          canonical_path,
          country_slug,
          district_slug,
          municipality_slug,
          path_512
        )
      `)
      .eq('actor_user_id', currentUserId)
      .eq('event_type', 'item_view')
      .order('created_at', { ascending: false })
      .limit(24);

    if (error) throw error;

    const seen = new Set<string>();
    recentItems = (data || [])
      .filter((entry: any) => {
        const itemId = entry?.item_id;
        if (!itemId || seen.has(itemId)) return false;
        seen.add(itemId);
        return true;
      })
      .map((entry: any) => ({
        viewedAt: entry.created_at,
        ...(entry.items || {})
      }))
      .slice(0, 12);
  }

  async function removeFromHistory(itemId: string) {
    if (!itemId || !currentUserId || historyBusy) return;
    if (!browser) return;
    const ok = window.confirm('Diesen Eintrag aus deinem Verlauf entfernen?');
    if (!ok) return;

    historyBusy = true;
    errorMessage = '';
    try {
      const { error } = await supabase
        .from('item_events')
        .delete()
        .eq('actor_user_id', currentUserId)
        .eq('event_type', 'item_view')
        .eq('item_id', itemId);
      if (error) throw error;
      await loadRecentItems();
    } catch (error: any) {
      errorMessage = error?.message || 'Verlaufseintrag konnte nicht entfernt werden.';
    } finally {
      historyBusy = false;
    }
  }

  async function clearEntireHistory() {
    if (!currentUserId || historyBusy) return;
    if (!browser) return;
    const ok = window.confirm('Moechtest du deinen gesamten Verlauf wirklich loeschen?');
    if (!ok) return;

    historyBusy = true;
    errorMessage = '';
    try {
      const { error } = await supabase
        .from('item_events')
        .delete()
        .eq('actor_user_id', currentUserId)
        .eq('event_type', 'item_view');
      if (error) throw error;
      recentItems = [];
    } catch (error: any) {
      errorMessage = error?.message || 'Verlauf konnte nicht geloescht werden.';
    } finally {
      historyBusy = false;
    }
  }

  async function loadOwnItems(page = 1, query = activeQuery) {
    loadingItems = true;
    errorMessage = '';

    const offset = (page - 1) * PAGE_SIZE;
    let request = supabase
      .from('items')
      .select(
        'id, slug, title, original_name, canonical_path, country_slug, district_slug, municipality_slug, path_512, created_at, updated_at',
        { count: 'exact' }
      )
      .eq('profile_id', currentUserId)
      .eq('admin_hidden', false)
      .is('group_root_item_id', null)
      .not('slug', 'is', null)
      .order('updated_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (query) {
      const escaped = query.replace(/[%]/g, '');
      request = request.or(`title.ilike.%${escaped}%,original_name.ilike.%${escaped}%,slug.ilike.%${escaped}%`);
    }

    const { data, error, count } = await request;

    if (error) {
      loadingItems = false;
      throw error;
    }

    allItems = data || [];
    totalItems = count || 0;
    currentPage = page;
    loadingItems = false;
  }

  async function loadNotifications() {
    const { data, error } = await supabase
      .from('user_notifications')
      .select(`
        id,
        event_type,
        payload,
        read_at,
        created_at,
        items:item_id(
          id,
          slug,
          title,
          original_name,
          canonical_path,
          country_slug,
          district_slug,
          municipality_slug,
          path_512
        ),
        profiles:actor_user_id(
          full_name,
          accountname,
          avatar_url
        )
      `)
      .eq('recipient_user_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;
    notifications = (data || []).map((entry: any) => ({
      ...entry,
      item: entry.items || null,
      actor: entry.profiles || null
    }));
  }

  async function loadInteractions() {
    const { data, error } = await supabase
      .from('item_events')
      .select(`
        id,
        event_type,
        created_at,
        actor_user_id,
        metadata,
        items!inner(
          id,
          slug,
          title,
          original_name,
          canonical_path,
          country_slug,
          district_slug,
          municipality_slug,
          path_512
        ),
        profiles:actor_user_id(
          full_name,
          accountname,
          avatar_url
        )
      `)
      .eq('owner_user_id', currentUserId)
      .in('event_type', ['download', 'favorite_add', 'like_add', 'comment_create', 'comment_hide', 'comment_restore', 'chat_message'])
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw error;
    interactions = (data || []).map((entry: any) => ({
      ...entry,
      item: entry.items || null,
      actor: entry.profiles || null
    }));
  }

  async function applySearch() {
    activeQuery = searchQuery.trim();
    await loadOwnItems(1, activeQuery);
  }

  async function clearSearch() {
    searchQuery = '';
    activeQuery = '';
    await loadOwnItems(1, '');
  }

  async function goToPage(page: number) {
    if (page < 1 || page > totalPages || page === currentPage) return;
    await loadOwnItems(page, activeQuery);
  }

  async function initDashboard() {
    loading = true;
    errorMessage = '';
    try {
      const ok = await ensureAuthUser();
      if (!ok) return;
      await Promise.all([loadRecentItems(), loadOwnItems(1, ''), loadNotifications(), loadInteractions()]);
    } catch (error: any) {
      errorMessage = error?.message || 'Dashboard konnte nicht geladen werden.';
    } finally {
      loading = false;
      loadingItems = false;
    }
  }

  if (browser) {
    void initDashboard();
  }
</script>

<svelte:head>
  <title>Dashboard - Culoca</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<SiteNav />

<main class="dashboard-page">
  <section class="dashboard-page__hero">
    <h1>User Dashboard</h1>
    <p>Zuletzt angesehen und alle eigenen Einträge an einem Ort.</p>
  </section>

  {#if loading}
    <p class="dashboard-empty">Dashboard wird geladen...</p>
  {:else if errorMessage}
    <p class="dashboard-error">{errorMessage}</p>
  {:else}
    <section class="dashboard-layout">
      <aside class="dashboard-column dashboard-column--menu">
        <nav class="dashboard-menu" aria-label="Dashboard Navigation">
          <button
            type="button"
            class="dashboard-menu__link"
            class:is-active={activeSection === 'recent'}
            on:click={() => (activeSection = 'recent')}
          >
            <span>Zuletzt angesehen</span>
            <strong>{recentItems.length}</strong>
          </button>
          <button
            type="button"
            class="dashboard-menu__link"
            class:is-active={activeSection === 'photos'}
            on:click={() => (activeSection = 'photos')}
          >
            <span>Meine Fotos</span>
            <strong>{totalItems}</strong>
          </button>
          <button
            type="button"
            class="dashboard-menu__link"
            class:is-active={activeSection === 'notifications'}
            on:click={() => (activeSection = 'notifications')}
          >
            <span>Benachrichtigungen</span>
            <strong>{notifications.length}</strong>
          </button>
          <button
            type="button"
            class="dashboard-menu__link"
            class:is-active={activeSection === 'interactions'}
            on:click={() => (activeSection = 'interactions')}
          >
            <span>Interaktionen</span>
            <strong>{interactions.length}</strong>
          </button>
        </nav>
      </aside>

      <section class="dashboard-column dashboard-column--content">
        {#if activeSection === 'recent'}
          <div class="panel-head">
            <h2>Zuletzt angesehen</h2>
            {#if recentItems.length > 0}
              <button type="button" class="ghost-btn" on:click={clearEntireHistory} disabled={historyBusy}>
                Verlauf loeschen
              </button>
            {/if}
          </div>

          {#if recentItems.length === 0}
            <p class="dashboard-empty">Noch keine zuletzt angesehenen Einträge.</p>
          {:else}
            <div class="entry-list">
              {#each recentItems as item (item.id)}
                <article class="entry-card entry-card--history">
                  <a class="entry-preview" href={getPublicItemHref(item)}>
                    {#if getItemThumb(item)}
                      <img src={getItemThumb(item)} alt={item.title || item.original_name || 'Item'} width="56" height="56" loading="lazy" />
                    {:else}
                      <div class="entry-thumb-fallback">?</div>
                    {/if}
                  </a>
                  <span class="entry-content">
                    <a href={getPublicItemHref(item)}>
                      <strong>{item.title || item.original_name || 'Ohne Titel'}</strong>
                    </a>
                    <span>{formatDate(item.viewedAt)}</span>
                  </span>
                  <button
                    type="button"
                    class="ghost-btn entry-remove-btn"
                    on:click={() => removeFromHistory(item.id)}
                    disabled={historyBusy}
                  >
                    Entfernen
                  </button>
                </article>
              {/each}
            </div>
          {/if}
        {:else if activeSection === 'photos'}
          <div class="panel-head panel-head--space">
            <h2>Meine Fotos</h2>
            <span>{totalItems} gesamt</span>
          </div>

          <form class="search-row" on:submit|preventDefault={applySearch}>
            <input type="search" bind:value={searchQuery} placeholder="Suche nach Titel oder Slug" />
            <button type="submit">Suchen</button>
            {#if activeQuery}
              <button type="button" class="ghost-btn" on:click={clearSearch}>Zurücksetzen</button>
            {/if}
          </form>

          {#if loadingItems}
            <p class="dashboard-empty">Einträge werden geladen...</p>
          {:else if allItems.length === 0}
            <p class="dashboard-empty">Keine Einträge gefunden.</p>
          {:else}
            <div class="entry-list entry-list--large">
              {#each allItems as item (item.id)}
                <article class="entry-card entry-card--large">
                  <a class="entry-preview" href={getPublicItemHref(item)}>
                    {#if getItemThumb(item)}
                      <img src={getItemThumb(item)} alt={item.title || item.original_name || 'Item'} width="72" height="72" loading="lazy" />
                    {:else}
                      <div class="entry-thumb-fallback">?</div>
                    {/if}
                  </a>
                  <div class="entry-content entry-content--large">
                    <a href={getPublicItemHref(item)}>
                      <strong>{item.title || item.original_name || 'Ohne Titel'}</strong>
                    </a>
                    <span>Aktualisiert: {formatDate(item.updated_at || item.created_at)}</span>
                    <div class="entry-actions">
                      <a href={getPublicItemHref(item)}>Öffnen</a>
                      <a href={`/item/${encodeURIComponent(item.slug)}`}>Bearbeiten</a>
                      <a href={`/item/${encodeURIComponent(item.slug)}/download`}>Verwalten</a>
                    </div>
                  </div>
                </article>
              {/each}
            </div>
          {/if}

          <div class="pagination">
            <button type="button" on:click={() => goToPage(currentPage - 1)} disabled={!canPrev}>Zurück</button>
            <span>Seite {currentPage} von {totalPages}</span>
            <button type="button" on:click={() => goToPage(currentPage + 1)} disabled={!canNext}>Weiter</button>
          </div>
        {:else if activeSection === 'notifications'}
          <div class="panel-head panel-head--space">
            <h2>Benachrichtigungen</h2>
            <span>{notifications.length} gesamt</span>
          </div>

          {#if notifications.length === 0}
            <p class="dashboard-empty">Noch keine Benachrichtigungen vorhanden.</p>
          {:else}
            <div class="entry-list">
              {#each notifications as entry (entry.id)}
                <a class="entry-card entry-card--link" href={getNotificationHref(entry)}>
                  {#if entry.item && getItemThumb(entry.item)}
                    <img src={getItemThumb(entry.item)} alt={entry.item.title || entry.item.original_name || 'Item'} width="56" height="56" loading="lazy" />
                  {:else}
                    <div class="entry-thumb-fallback">{getNotificationActor(entry).slice(0, 1).toUpperCase()}</div>
                  {/if}
                  <span class="entry-content">
                    <strong>{getNotificationActor(entry)}</strong>
                    <span>{getNotificationLabel(entry)}</span>
                    {#if getNotificationPreview(entry)}
                      <span>{getNotificationPreview(entry)}</span>
                    {/if}
                    <span>{formatDate(entry.created_at)}</span>
                  </span>
                </a>
              {/each}
            </div>
          {/if}
        {:else}
          <div class="panel-head panel-head--space">
            <h2>Interaktionen auf deinen Items</h2>
            <span>{interactions.length} gesamt</span>
          </div>

          {#if interactions.length === 0}
            <p class="dashboard-empty">Noch keine Interaktionen auf deinen Items vorhanden.</p>
          {:else}
            <div class="entry-list">
              {#each interactions as entry (entry.id)}
                <a class="entry-card entry-card--link" href={entry.item ? getPublicItemHref(entry.item) : '/dashboard'}>
                  {#if entry.item && getItemThumb(entry.item)}
                    <img src={getItemThumb(entry.item)} alt={entry.item.title || entry.item.original_name || 'Item'} width="56" height="56" loading="lazy" />
                  {:else}
                    <div class="entry-thumb-fallback">{getInteractionActor(entry).slice(0, 1).toUpperCase()}</div>
                  {/if}
                  <span class="entry-content">
                    <strong>{getInteractionActor(entry)}</strong>
                    <span>{getInteractionLabel(entry)}</span>
                    {#if entry.item}
                      <span>{entry.item.title || entry.item.original_name || 'Ohne Titel'}</span>
                    {/if}
                    <span>{formatDate(entry.created_at)}</span>
                  </span>
                </a>
              {/each}
            </div>
          {/if}
        {/if}
      </section>
    </section>
  {/if}
</main>

<SiteFooter />

<style>
  .dashboard-page {
    padding: 1.4rem 2rem 2.2rem;
  }
  .dashboard-page__hero h1 {
    margin: 0;
    font-size: clamp(1.8rem, 3vw, 2.4rem);
  }
  .dashboard-page__hero p {
    margin: 0.45rem 0 0;
    color: var(--text-secondary);
  }
  .dashboard-layout {
    margin-top: 1.2rem;
    display: grid;
    gap: 1rem;
    grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
    align-items: start;
  }
  .dashboard-column--menu {
    position: sticky;
    top: 4.6rem;
  }
  .dashboard-menu {
    display: grid;
    gap: 0.55rem;
  }
  .dashboard-menu__link {
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-primary);
    border-radius: 12px;
    padding: 0.7rem 0.8rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
    cursor: pointer;
    font: inherit;
  }
  .dashboard-menu__link strong {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }
  .dashboard-menu__link.is-active {
    border-color: color-mix(in srgb, var(--culoca-orange) 45%, var(--border-color) 55%);
    background: color-mix(in srgb, var(--culoca-orange) 10%, var(--bg-primary) 90%);
  }
  .dashboard-column {
    border: 1px solid var(--border-color);
    border-radius: 16px;
    background: var(--bg-secondary);
    padding: 1rem;
  }
  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.8rem;
  }
  .panel-head h2 {
    margin: 0;
    font-size: 1.1rem;
  }
  .panel-head span {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }
  .search-row {
    display: flex;
    gap: 0.6rem;
    margin-bottom: 0.9rem;
  }
  .search-row input {
    flex: 1;
    min-height: 2.6rem;
    border-radius: 10px;
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-primary);
    padding: 0.55rem 0.75rem;
  }
  .search-row button {
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-primary);
    border-radius: 10px;
    padding: 0.52rem 0.8rem;
    cursor: pointer;
  }
  .search-row .ghost-btn {
    color: var(--text-secondary);
  }
  .ghost-btn {
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-secondary);
    border-radius: 10px;
    padding: 0.45rem 0.7rem;
    cursor: pointer;
  }
  .ghost-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .entry-list {
    display: grid;
    gap: 0.6rem;
  }
  .entry-card {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.7rem;
    border: 1px solid var(--border-color);
    border-radius: 12px;
    text-decoration: none;
    color: inherit;
    background: var(--bg-primary);
    padding: 0.55rem;
  }
  .entry-card--history {
    align-items: center;
    grid-template-columns: auto minmax(0, 1fr) auto;
  }
  .entry-card img,
  .entry-thumb-fallback {
    width: 56px;
    height: 56px;
    border-radius: 10px;
    object-fit: cover;
  }
  .entry-thumb-fallback {
    display: grid;
    place-items: center;
    color: var(--text-secondary);
    background: var(--bg-tertiary);
  }
  .entry-content {
    min-width: 0;
    display: grid;
    gap: 0.2rem;
    align-content: center;
  }
  .entry-content strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .entry-content a {
    color: inherit;
    text-decoration: none;
  }
  .entry-content a strong:hover {
    color: var(--culoca-orange);
  }
  .entry-content span {
    color: var(--text-secondary);
    font-size: 0.82rem;
  }
  .entry-card--large {
    align-items: start;
    grid-template-columns: auto minmax(0, 1fr);
  }
  .entry-card--large .entry-preview img,
  .entry-card--large .entry-thumb-fallback {
    width: 72px;
    height: 72px;
  }
  .entry-content--large {
    gap: 0.35rem;
  }
  .entry-content--large a {
    color: inherit;
    text-decoration: none;
  }
  .entry-content--large a strong:hover {
    color: var(--culoca-orange);
  }
  .entry-remove-btn {
    white-space: nowrap;
  }
  .entry-actions {
    display: flex;
    gap: 0.8rem;
    flex-wrap: wrap;
  }
  .entry-actions a {
    color: var(--text-secondary);
    font-size: 0.82rem;
    text-decoration: none;
  }
  .entry-actions a:hover {
    color: var(--culoca-orange);
  }
  .pagination {
    margin-top: 0.9rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .pagination button {
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-primary);
    border-radius: 10px;
    padding: 0.45rem 0.75rem;
    cursor: pointer;
  }
  .pagination button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .dashboard-empty,
  .dashboard-error {
    color: var(--text-secondary);
  }
  .dashboard-error {
    color: #ffb4b4;
  }
  @media (max-width: 980px) {
    .dashboard-page {
      padding: 1rem;
    }
    .dashboard-layout {
      grid-template-columns: 1fr;
    }
  }
</style>
