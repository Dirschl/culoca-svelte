<script lang="ts">
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { onDestroy, onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { isAuthenticated } from '$lib/sessionStore';
  import { isDetailPath } from '$lib/returnTo';

  const EXCLUDED_PREFIXES = ['/galerie', '/item', '/upload', '/map-view', '/map-view-share', '/simulation'];
  let showScrollToTop = false;
  let isFullscreen = false;
  let unreadChatCount = 0;
  let currentUserId = '';
  let chatChannel: any = null;
  let lastAuthState = false;

  $: pathname = $page.url.pathname;
  $: routeId = $page.route?.id || '';
  $: hideFabs =
    routeId === '/item/[slug]' ||
    routeId === '/[country=countrySlug]/[district]/[municipality]/[slug]' ||
    routeId === '/[country=countrySlug]/[district]/[municipality]/[slug]/download' ||
    isDetailPath(pathname) ||
    pathname.startsWith('/item/') ||
    EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  $: hideChatFab = pathname.startsWith('/chat');
  $: showFabs = !hideFabs;

  function updateScrollState() {
    if (!browser) return;
    showScrollToTop = window.scrollY > 120;
  }

  function updateFullscreenState() {
    if (!browser) return;
    isFullscreen = !!document.fullscreenElement;
  }

  function toggleFullscreen() {
    if (!browser) return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      return;
    }
    document.exitFullscreen?.().catch(() => {});
  }

  function scrollToTop() {
    if (!browser) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toggleChatDrawer() {
    if (!browser) return;
    window.dispatchEvent(new CustomEvent('culoca:toggle-chat'));
  }

  async function loadUnreadChatCount() {
    if (!currentUserId) {
      unreadChatCount = 0;
      return;
    }

    const { data, error } = await supabase
      .from('user_conversations')
      .select(
        'id, user_a_id, user_b_id, user_a_last_read_at, user_b_last_read_at, last_message_at, last_message_sender_id'
      )
      .or(`user_a_id.eq.${currentUserId},user_b_id.eq.${currentUserId}`)
      .not('last_message_sender_id', 'is', null);

    if (error || !data) {
      unreadChatCount = 0;
      return;
    }

    unreadChatCount = data.filter((entry: any) => {
      if (!entry?.last_message_at) return false;
      if (entry.last_message_sender_id === currentUserId) return false;
      const ownReadAt =
        entry.user_a_id === currentUserId ? entry.user_a_last_read_at : entry.user_b_last_read_at;
      return !ownReadAt || new Date(entry.last_message_at).getTime() > new Date(ownReadAt).getTime();
    }).length;
  }

  function teardownChatChannel() {
    if (chatChannel) {
      supabase.removeChannel(chatChannel);
      chatChannel = null;
    }
  }

  function setupChatChannel() {
    teardownChatChannel();
    if (!currentUserId) return;

    chatChannel = supabase
      .channel(`global-fab-chat-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_conversations', filter: `user_a_id=eq.${currentUserId}` },
        async () => loadUnreadChatCount()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_conversations', filter: `user_b_id=eq.${currentUserId}` },
        async () => loadUnreadChatCount()
      )
      .subscribe();
  }

  async function updateUserAndChatState(isAuth: boolean) {
    if (!isAuth) {
      currentUserId = '';
      unreadChatCount = 0;
      teardownChatChannel();
      return;
    }

    const { data } = await supabase.auth.getUser();
    currentUserId = data.user?.id || '';
    await loadUnreadChatCount();
    setupChatChannel();
  }

  onMount(async () => {
    if (!browser) return;
    updateScrollState();
    updateFullscreenState();

    window.addEventListener('scroll', updateScrollState, { passive: true });
    document.addEventListener('fullscreenchange', updateFullscreenState);
    await updateUserAndChatState($isAuthenticated);
  });

  $: if (browser) {
    const authState = $isAuthenticated;
    if (authState !== lastAuthState) {
      lastAuthState = authState;
      void updateUserAndChatState(authState);
    }
  }

  onDestroy(() => {
    if (!browser) return;
    window.removeEventListener('scroll', updateScrollState);
    document.removeEventListener('fullscreenchange', updateFullscreenState);
    teardownChatChannel();
  });
</script>

{#if showFabs}
  <div class="global-fabs">
    {#if !hideChatFab}
      <button
        type="button"
        class="global-fab global-fab--chat"
        aria-label="Chat öffnen"
        title="Chat öffnen"
        on:click={toggleChatDrawer}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {#if unreadChatCount > 0}
          <span class="global-fab__badge">{unreadChatCount > 99 ? '99+' : unreadChatCount}</span>
        {/if}
      </button>
    {/if}

    {#if showScrollToTop}
      <button
        type="button"
        class="global-fab"
        aria-label="Nach oben scrollen"
        title="Nach oben scrollen"
        on:click={scrollToTop}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="m18 15-6-6-6 6" />
        </svg>
      </button>
    {:else}
      <button
        type="button"
        class="global-fab"
        aria-label={isFullscreen ? 'Vollbild verlassen' : 'Vollbild aktivieren'}
        title={isFullscreen ? 'Vollbild verlassen' : 'Vollbild aktivieren'}
        on:click={toggleFullscreen}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
        </svg>
      </button>
    {/if}
  </div>
{/if}

<style>
  .global-fabs {
    position: fixed;
    right: 2rem;
    bottom: 2rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    z-index: 1001;
  }

  .global-fab {
    position: relative;
    width: 4rem;
    height: 4rem;
    border: none;
    border-radius: 999px;
    background: transparent;
    color: #fff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 12px var(--shadow);
    backdrop-filter: blur(10px);
    pointer-events: auto;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .global-fab svg {
    width: 40px;
    height: 40px;
  }

  .global-fab:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    transform: scale(1.1);
    box-shadow: 0 6px 20px var(--shadow);
  }

  .global-fab:active {
    transform: scale(0.95);
  }

  .global-fab--chat {
    background: transparent;
    color: #fff;
  }

  .global-fab--chat:hover {
    color: #fff;
  }

  .global-fab__badge {
    position: absolute;
    top: -0.28rem;
    right: -0.2rem;
    min-width: 1.2rem;
    height: 1.2rem;
    padding: 0 0.3rem;
    border-radius: 999px;
    background: #dc2626;
    border: 2px solid #fff;
    color: #fff;
    font-size: 0.68rem;
    font-weight: 700;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  @media (max-width: 768px) {
    .global-fabs {
      right: 1rem;
      bottom: 1rem;
      gap: 0.7rem;
    }

    .global-fab {
      width: 3.5rem;
      height: 3.5rem;
    }

    .global-fab svg {
      width: 36px;
      height: 36px;
    }
  }
</style>
