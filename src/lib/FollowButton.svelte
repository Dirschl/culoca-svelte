<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';

  export let targetUserId = '';
  export let targetLabel = 'Profil';
  export let iconOnly = false;
  export let compact = false;

  let currentUserId = '';
  let loading = false;
  let checking = false;
  let isFollowing = false;

  function currentReturnTo() {
    if (!browser) return '/';
    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
  }

  async function refreshState() {
    if (!browser || !targetUserId) return;

    const {
      data: { user }
    } = await supabase.auth.getUser();

    currentUserId = user?.id || '';

    if (!currentUserId || currentUserId === targetUserId) {
      isFollowing = false;
      return;
    }

    checking = true;

    try {
      const { data, error } = await supabase
        .from('user_follows')
        .select('id')
        .eq('follower_user_id', currentUserId)
        .eq('followed_user_id', targetUserId)
        .maybeSingle();

      if (error) throw error;
      isFollowing = !!data;
    } catch (error) {
      console.error('Failed to load follow state:', error);
      isFollowing = false;
    } finally {
      checking = false;
    }
  }

  async function toggleFollow() {
    if (!targetUserId || loading) return;

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      await goto(`/login?returnTo=${encodeURIComponent(currentReturnTo())}`);
      return;
    }

    if (user.id === targetUserId) return;

    currentUserId = user.id;
    loading = true;

    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('user_follows')
          .delete()
          .eq('follower_user_id', user.id)
          .eq('followed_user_id', targetUserId);

        if (error) throw error;
        isFollowing = false;
      } else {
        const { error } = await supabase.from('user_follows').insert({
          follower_user_id: user.id,
          followed_user_id: targetUserId
        });

        if (error && error.code !== '23505') throw error;

        isFollowing = true;

        await supabase.from('user_notifications').insert({
          recipient_user_id: targetUserId,
          actor_user_id: user.id,
          event_type: 'follow_create',
          payload: {
            follower_user_id: user.id
          }
        });
      }
    } catch (error) {
      console.error('Failed to toggle follow state:', error);
      await refreshState();
    } finally {
      loading = false;
    }
  }

  $: isOwnProfile = !!currentUserId && currentUserId === targetUserId;
  $: buttonLabel = isFollowing ? 'Folgst du' : 'Folgen';
  $: buttonTitle = isFollowing ? `${targetLabel} nicht mehr folgen` : `${targetLabel} folgen`;

  onMount(async () => {
    await refreshState();
  });
</script>

{#if targetUserId && !isOwnProfile}
  <button
    type="button"
    class="follow-button"
    class:follow-button--compact={compact || iconOnly}
    class:follow-button--active={isFollowing}
    class:follow-button--icon={iconOnly}
    on:click={toggleFollow}
    disabled={loading || checking}
    aria-label={buttonTitle}
    title={buttonTitle}
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {#if isFollowing}
        <path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
      {:else}
        <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
      {/if}
    </svg>
    {#if !iconOnly}
      <span>{loading ? '...' : buttonLabel}</span>
    {/if}
  </button>
{/if}

<style>
  .follow-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--culoca-orange) 26%, var(--border-color) 74%);
    background: color-mix(in srgb, var(--culoca-orange) 10%, var(--bg-secondary) 90%);
    color: var(--text-primary);
    padding: 0.62rem 0.95rem;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease;
  }

  .follow-button:hover:not(:disabled) {
    transform: translateY(-1px);
    border-color: color-mix(in srgb, var(--culoca-orange) 45%, var(--border-color) 55%);
  }

  .follow-button:disabled {
    opacity: 0.65;
    cursor: default;
  }

  .follow-button--active {
    background: color-mix(in srgb, var(--culoca-orange) 18%, var(--bg-secondary) 82%);
  }

  .follow-button--compact {
    padding: 0.5rem 0.78rem;
    font-size: 0.92rem;
  }

  .follow-button--icon {
    width: 2.35rem;
    height: 2.35rem;
    padding: 0;
  }

  .follow-button svg {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }
</style>
