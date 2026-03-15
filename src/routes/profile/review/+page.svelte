<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import SiteNav from '$lib/SiteNav.svelte';
  import SiteFooter from '$lib/SiteFooter.svelte';
  import { supabase } from '$lib/supabaseClient';
  import { fetchProfileReviewItems, getIssueLabel, type ProfileReviewItem } from '$lib/profile/review';

  let loading = true;
  let items: ProfileReviewItem[] = [];
  let errorMessage = '';

  function getThumbUrl(item: ProfileReviewItem) {
    if (item.path_64) {
      return `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-64/${item.path_64}`;
    }
    if (item.path_512) {
      return `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${item.path_512}`;
    }
    return null;
  }

  onMount(async () => {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      goto('/login');
      return;
    }

    try {
      items = await fetchProfileReviewItems(supabase, user.id);
    } catch (error) {
      console.error('Failed to load review items:', error);
      errorMessage = 'Die offenen Daten konnten nicht geladen werden.';
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head>
  <title>Daten prüfen - Culoca</title>
</svelte:head>

<div class="review-page">
  <SiteNav />

  <div class="review-shell">
    <div class="review-header">
      <div>
        <p class="eyebrow">Konto</p>
        <h1>Daten prüfen</h1>
        <p class="intro">
          Hier siehst du alle eigenen Inhalte, bei denen Ortsdaten, wichtige SEO-Angaben oder später auch problematische Inhalte geprüft werden müssen.
        </p>
      </div>
      <a class="upload-link" href="/foto/upload">Neues Foto hochladen</a>
    </div>

    {#if loading}
      <div class="review-state">Lade offene Daten...</div>
    {:else if errorMessage}
      <div class="review-state review-state--error">{errorMessage}</div>
    {:else if !items.length}
      <div class="review-state review-state--ok">Keine offenen Daten. Dein Bestand ist aktuell vollständig gepflegt.</div>
    {:else}
      <div class="review-summary">
        <strong>{items.length}</strong> Einträge brauchen noch Nacharbeit.
      </div>

      <div class="review-list">
        {#each items as item}
          <article class="review-item">
            <div class="review-item__thumb">
              {#if getThumbUrl(item)}
                <img src={getThumbUrl(item)} alt={item.title || item.original_name || item.slug} loading="lazy" />
              {:else}
                <div class="review-item__thumb-fallback">Kein Bild</div>
              {/if}
            </div>

            <div class="review-item__main">
              <h2>{item.title || item.original_name || item.slug}</h2>
              <p class="review-filename">{item.original_name || item.slug}</p>
              <p class="review-slug">/{item.slug}</p>
              {#if item.moderation_summary && item.moderation_status && item.moderation_status !== 'clear'}
                <p class="review-note">{item.moderation_summary}</p>
              {/if}
              <div class="issue-row">
                {#each item.issues as issue}
                  <span class="issue-chip">{getIssueLabel(issue)}</span>
                {/each}
              </div>
            </div>

            <div class="review-item__actions">
              <a class="review-edit" href={item.editHref}>Im Editmodus öffnen</a>
            </div>
          </article>
        {/each}
      </div>
    {/if}
  </div>

  <SiteFooter />
</div>

<style>
  .review-shell {
    width: 100%;
    padding: 2rem 1rem 4rem;
  }

  .review-header {
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .eyebrow {
    margin: 0 0 0.35rem;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--culoca-orange);
  }

  h1 {
    margin: 0;
    font-size: clamp(2rem, 4vw, 3rem);
  }

  .intro {
    margin: 0.5rem 0 0;
    color: var(--text-secondary);
    max-width: 68ch;
  }

  .upload-link,
  .review-edit {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem 1rem;
    border-radius: 999px;
    text-decoration: none;
    background: var(--culoca-orange);
    color: #fff;
    font-weight: 600;
  }

  .review-summary,
  .review-state {
    padding: 1rem 1.2rem;
    border-radius: 16px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    margin-bottom: 1rem;
  }

  .review-state--error {
    color: #b42318;
  }

  .review-state--ok {
    color: #0f766e;
  }

  .review-list {
    display: grid;
    gap: 0.85rem;
  }

  .review-item {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr) auto;
    align-items: start;
    gap: 1rem;
    padding: 1rem 1.1rem;
    border-radius: 18px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
  }

  .review-item__thumb {
    width: 64px;
    height: 64px;
    border-radius: 10px;
    overflow: hidden;
    background: var(--bg-tertiary);
  }

  .review-item__thumb img,
  .review-item__thumb-fallback {
    width: 100%;
    height: 100%;
  }

  .review-item__thumb img {
    display: block;
    object-fit: cover;
  }

  .review-item__thumb-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem;
    color: var(--text-muted);
    font-size: 0.7rem;
    text-align: center;
  }

  .review-item__main {
    min-width: 0;
  }

  .review-item__actions {
    display: flex;
    align-items: center;
  }

  .review-item h2 {
    margin: 0 0 0.25rem;
    font-size: 1.05rem;
  }

  .review-filename {
    margin: 0 0 0.3rem;
    color: var(--text-secondary);
    font-size: 0.92rem;
    word-break: break-word;
  }

  .review-slug {
    margin: 0 0 0.7rem;
    color: var(--text-muted);
    font-size: 0.9rem;
    word-break: break-word;
  }

  .review-note {
    margin: -0.2rem 0 0.7rem;
    color: var(--text-secondary);
    font-size: 0.92rem;
  }

  .issue-row {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .issue-chip {
    display: inline-flex;
    padding: 0.3rem 0.6rem;
    border-radius: 999px;
    background: rgba(238, 114, 33, 0.12);
    color: #b54708;
    font-size: 0.8rem;
    font-weight: 600;
  }

  @media (max-width: 720px) {
    .review-header {
      flex-direction: column;
      align-items: stretch;
    }

    .review-item {
      grid-template-columns: 64px minmax(0, 1fr);
    }

    .review-item__actions {
      grid-column: 1 / -1;
    }
  }
</style>
