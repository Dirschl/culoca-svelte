<svelte:head>
  <title>Admin – Moderation</title>
  <meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex" />
  <meta name="googlebot" content="noindex, nofollow" />
  <meta name="bingbot" content="noindex, nofollow" />
</svelte:head>

<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabaseClient';
  import { authFetch } from '$lib/authFetch';
  import { getIssueLabel, fetchAllReviewItems, type ProfileReviewItem } from '$lib/profile/review';
  import { getPublicItemHref } from '$lib/content/routing';

  let loading = true;
  let hasAdminPermission = false;
  let items: ProfileReviewItem[] = [];
  let errorMessage = '';
  let actionItemId: string | null = null;
  let currentUserId: string | null = null;

  function getThumbUrl(item: ProfileReviewItem) {
    if (item.path_64) {
      return `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-64/${item.path_64}`;
    }
    if (item.path_512) {
      return `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${item.path_512}`;
    }
    return null;
  }

  function isForeignItem(item: ProfileReviewItem) {
    return !!currentUserId && !!item.profile_id && item.profile_id !== currentUserId;
  }

  function issueBadges(item: ProfileReviewItem) {
    return item.issues.map((issue) => getIssueLabel(issue));
  }

  function getStatusLabel(status: string | null | undefined) {
    if (status === 'blocked') return 'Blockiert';
    if (status === 'flagged') return 'Auffällig';
    if (status === 'review') return 'Inhalt prüfen';
    return 'Daten prüfen';
  }

  function formatUpdatedAt(value: string | null) {
    if (!value) return '';
    try {
      return new Date(value).toLocaleString('de-DE');
    } catch {
      return value;
    }
  }

  async function loadReviewItems() {
    const allItems = await fetchAllReviewItems(supabase);
    items = currentUserId
      ? allItems.filter((item) => item.profile_id && item.profile_id !== currentUserId)
      : allItems;
  }

  async function approveItem(item: ProfileReviewItem) {
    actionItemId = item.id;
    errorMessage = '';

    try {
      const { data: row, error } = await supabase
        .from('items')
        .select('page_settings')
        .eq('id', item.id)
        .single();

      if (error) {
        throw error;
      }

      const nextPageSettings = {
        ...((row?.page_settings as Record<string, unknown> | null) || {}),
        moderation: {
          ...((((row?.page_settings as Record<string, unknown> | null)?.moderation as Record<string, unknown> | null) || {})),
          status: 'clear',
          reviewed_at: new Date().toISOString(),
          reviewed_by: currentUserId
        }
      };

      const response = await authFetch(`/api/item/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_settings: nextPageSettings })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Freigabe fehlgeschlagen');
      }

      await loadReviewItems();
    } catch (error) {
      console.error('Moderation approval failed:', error);
      errorMessage = error instanceof Error ? error.message : 'Freigabe fehlgeschlagen.';
    } finally {
      actionItemId = null;
    }
  }

  async function deleteItem(item: ProfileReviewItem) {
    if (!confirm(`Soll dieses Item wirklich gelöscht werden?\n\n${item.title || item.original_name || item.slug}`)) {
      return;
    }

    actionItemId = item.id;
    errorMessage = '';

    try {
      const response = await authFetch(`/api/item/${item.id}`, {
        method: 'DELETE'
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || payload?.message || 'Löschen fehlgeschlagen');
      }

      items = items.filter((entry) => entry.id !== item.id);
    } catch (error) {
      console.error('Moderation delete failed:', error);
      errorMessage = error instanceof Error ? error.message : 'Löschen fehlgeschlagen.';
    } finally {
      actionItemId = null;
    }
  }

  onMount(async () => {
    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        goto('/login');
        return;
      }

      currentUserId = user.id;

      const { data: hasPermission, error } = await supabase.rpc('has_permission', {
        user_id: user.id,
        permission_name: 'admin'
      });

      if (error || !hasPermission) {
        hasAdminPermission = false;
        errorMessage = 'Keine Admin-Berechtigung.';
        return;
      }

      hasAdminPermission = true;
      await loadReviewItems();
    } catch (error) {
      console.error('Failed to load moderation page:', error);
      errorMessage = 'Die Moderationsliste konnte nicht geladen werden.';
    } finally {
      loading = false;
    }
  });
</script>

{#if loading}
  <div class="state-card">Lade Moderationsliste...</div>
{:else if !hasAdminPermission}
  <div class="state-card state-card--error">{errorMessage || 'Zugriff verweigert.'}</div>
{:else}
  <div class="moderation-shell">
    <div class="moderation-header">
      <div>
        <p class="eyebrow">Admin</p>
        <h3 class="moderation-title">Moderation und Datenprüfung</h3>
        <p class="intro">
          Hier sehen Administratoren die offenen Fälle anderer Nutzer. Die eigenen Einträge bleiben unter `Daten prüfen`, damit beides sauber getrennt bleibt.
        </p>
      </div>
      <div class="summary-chip">{items.length} offene Fälle</div>
    </div>

      {#if errorMessage}
        <div class="state-card state-card--error">{errorMessage}</div>
      {/if}

      {#if !items.length}
        <div class="state-card state-card--ok">Keine offenen fremden Fälle.</div>
      {:else}
        <div class="moderation-list">
          {#each items as item}
            <article class:foreign-item={isForeignItem(item)} class="moderation-item">
              <a class="thumb-link" href={item.editHref} target="_blank" rel="noreferrer">
                {#if getThumbUrl(item)}
                  <img src={getThumbUrl(item)} alt={item.title || item.original_name || item.slug} loading="lazy" />
                {:else}
                  <div class="thumb-fallback">Kein Bild</div>
                {/if}
              </a>

              <div class="moderation-main">
                <div class="moderation-topline">
                  <span class={`status-chip status-chip--${item.moderation_status || 'review'}`}>{getStatusLabel(item.moderation_status)}</span>
                  {#if isForeignItem(item)}
                    <span class="owner-chip owner-chip--foreign">Fremder Inhalt</span>
                  {:else}
                    <span class="owner-chip">Eigener Inhalt</span>
                  {/if}
                  <span class="updated-at">{formatUpdatedAt(item.updated_at)}</span>
                </div>

                <h2>{item.title || item.original_name || item.slug}</h2>
                <p class="filename">{item.original_name || item.slug}</p>
                <p class="slugline">{getPublicItemHref(item)}</p>

                {#if item.moderation_summary && item.moderation_status && item.moderation_status !== 'clear'}
                  <p class="summary">{item.moderation_summary}</p>
                {/if}

                <div class="issue-list">
                  {#each issueBadges(item) as issueLabel}
                    <span class="issue-chip">{issueLabel}</span>
                  {/each}
                </div>
              </div>

              <div class="moderation-actions">
                <a class="secondary-btn" href={item.editHref} target="_blank" rel="noreferrer">
                  Im Item öffnen
                </a>
                {#if item.moderation_status && item.moderation_status !== 'clear'}
                  <button class="approve-btn" disabled={actionItemId === item.id} on:click={() => approveItem(item)}>
                    {actionItemId === item.id ? 'Arbeite...' : 'Freigeben'}
                  </button>
                {/if}
                <button class="delete-btn" disabled={actionItemId === item.id} on:click={() => deleteItem(item)}>
                  Löschen
                </button>
              </div>
            </article>
          {/each}
        </div>
      {/if}
  </div>
{/if}

<style>
  .moderation-shell {
    width: 100%;
  }

  .moderation-header {
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .eyebrow {
    margin: 0 0 0.35rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.78rem;
    color: var(--text-secondary);
  }

  .moderation-title {
    margin: 0;
    font-size: clamp(1.35rem, 2.5vw, 1.85rem);
    font-weight: 700;
    color: var(--text-primary);
  }

  .intro {
    margin: 0.5rem 0 0;
    max-width: 60ch;
    color: var(--text-secondary);
  }

  .summary-chip {
    padding: 0.75rem 1rem;
    border-radius: 999px;
    background: var(--bg-tertiary);
    font-weight: 600;
    white-space: nowrap;
  }

  .state-card {
    padding: 1rem 1.2rem;
    border-radius: 16px;
    background: var(--bg-secondary);
  }

  .state-card--error {
    background: color-mix(in srgb, var(--error-color, #b42318) 12%, var(--bg-secondary));
  }

  .state-card--ok {
    background: color-mix(in srgb, var(--success-color, #027a48) 12%, var(--bg-secondary));
  }

  .moderation-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .moderation-item {
    display: grid;
    grid-template-columns: 76px minmax(0, 1fr) auto;
    gap: 1rem;
    align-items: start;
    padding: 1rem;
    border-radius: 18px;
    background: var(--bg-secondary);
    border: 1px solid color-mix(in srgb, var(--border-color, #d0d7de) 70%, transparent);
  }

  .moderation-item.foreign-item {
    background: color-mix(in srgb, var(--bg-secondary) 80%, #c7ccd4);
  }

  .thumb-link,
  .thumb-link img,
  .thumb-fallback {
    width: 64px;
    height: 64px;
    border-radius: 10px;
    display: block;
  }

  .thumb-link img {
    object-fit: cover;
  }

  .thumb-fallback {
    display: grid;
    place-items: center;
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    font-size: 0.82rem;
  }

  .moderation-main {
    min-width: 0;
  }

  .moderation-topline {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    align-items: center;
    margin-bottom: 0.45rem;
  }

  .status-chip,
  .owner-chip,
  .updated-at,
  .issue-chip {
    display: inline-flex;
    align-items: center;
    padding: 0.26rem 0.55rem;
    border-radius: 999px;
    font-size: 0.8rem;
  }

  .status-chip--review {
    background: color-mix(in srgb, #f59e0b 18%, transparent);
  }

  .status-chip--flagged,
  .status-chip--blocked {
    background: color-mix(in srgb, #ef4444 18%, transparent);
  }

  .owner-chip {
    background: var(--bg-tertiary);
  }

  .owner-chip--foreign {
    background: color-mix(in srgb, #6b7280 18%, transparent);
  }

  .updated-at {
    color: var(--text-secondary);
    background: transparent;
    padding-inline: 0;
  }

  .moderation-item h2 {
    margin: 0;
    font-size: 1.05rem;
  }

  .filename,
  .slugline,
  .summary {
    margin: 0.35rem 0 0;
  }

  .filename,
  .slugline {
    color: var(--text-secondary);
    word-break: break-all;
  }

  .issue-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    margin-top: 0.8rem;
  }

  .issue-chip {
    background: color-mix(in srgb, var(--culoca-orange, #ee7221) 14%, transparent);
  }

  .moderation-actions {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    align-items: stretch;
    min-width: 9rem;
  }

  .secondary-btn,
  .approve-btn,
  .delete-btn {
    border: 0;
    border-radius: 10px;
    padding: 0.72rem 0.9rem;
    font: inherit;
    cursor: pointer;
    text-align: center;
    text-decoration: none;
  }

  .secondary-btn {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .approve-btn {
    background: var(--success-color, #12b76a);
    color: white;
  }

  .delete-btn {
    background: var(--error-color, #f04438);
    color: white;
  }

  .approve-btn:disabled,
  .delete-btn:disabled {
    opacity: 0.7;
    cursor: progress;
  }

  @media (max-width: 900px) {
    .moderation-header,
    .moderation-item {
      grid-template-columns: 1fr;
    }

    .moderation-actions {
      min-width: 0;
    }
  }
</style>
