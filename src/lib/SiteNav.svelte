<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { hasAdminPermission, isAuthenticated, customerBranding, currentUserId } from '$lib/sessionStore';
  import { supabase } from '$lib/supabaseClient';
  import { currentPathWithSearch, sanitizeReturnTo } from '$lib/returnTo';
  import { fetchAllReviewItems, fetchProfileReviewItems } from '$lib/profile/review';

  let mobileOpen = false;
  let openDropdown: string | null = null;
  let reviewCount = 0;
  let adminReviewCount = 0;
  let inboxCount = 0;
  let inboxMessageCount = 0;
  let inboxActivityCount = 0;
  let followerAlertCount = 0;
  let lastInboxRefreshKey = '';
  let liveInboxChannels: any[] = [];
  let liveInboxChannelKey = '';
  let chatDrawerOpen = false;
  let chatDrawerSrc = '/chat?embed=1';

  const navLinks = [
    { href: '/galerie', label: 'Galerie' },
    { href: '/foto', label: 'Fotos' },
    { href: '/event', label: 'Events' },
    { href: '/firma', label: 'Firmen' },
    { href: '/web', label: 'Info' },
    { href: '/seo', label: 'SEO' },
  ];

  /** Konto-Untermenü: vier Bereiche (+ Abmelden), Admin verweist auf die Admin-Oberfläche. */
  const accountMenuLinks: { href: string; label: string; adminOnly?: boolean }[] = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/profile', label: 'Profil' },
    { href: '/settings', label: 'Einstellungen' },
    { href: '/admin/roles', label: 'Admin', adminOnly: true },
  ];

  function isAdminRouteActive(): boolean {
    return currentPath.startsWith('/admin');
  }

  $: currentPath = $page.url?.pathname || '/';
  $: isChatRoute = isActive('/chat');
  $: userIdentityLabel = $customerBranding?.accountName || $customerBranding?.fullName || '';
  $: userMenuLabel = $isAuthenticated ? 'Konto' : 'Login';
  $: userEntryHref = $isAuthenticated ? getUserLinkHref('/dashboard') : '/login';
  $: userMenuActive =
    isActive('/login') ||
    isActive('/dashboard') ||
    isActive('/chat') ||
    isActive('/settings') ||
    isActive('/standort') ||
    isActive('/profile') ||
    isActive('/profile/freigaben') ||
    ($hasAdminPermission && isAdminRouteActive());
  $: inheritedReturnTo = sanitizeReturnTo($page.url.searchParams.get('returnTo'), currentPathWithSearch($page.url));
  $: {
    const nextInboxKey = `${$isAuthenticated ? 'auth' : 'anon'}:${$currentUserId || 'none'}:${currentPath}`;
    if (nextInboxKey !== lastInboxRefreshKey) {
      lastInboxRefreshKey = nextInboxKey;
      void refreshInboxCount();
    }
  }

  async function refreshReviewCount() {
    if (!$isAuthenticated) {
      reviewCount = 0;
      adminReviewCount = 0;
      return;
    }

    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      reviewCount = 0;
      adminReviewCount = 0;
      return;
    }

    try {
      const ownReviewItems = await fetchProfileReviewItems(supabase, data.user.id);
      reviewCount = ownReviewItems.length;

      if ($hasAdminPermission) {
        const allReviewItems = await fetchAllReviewItems(supabase);
        adminReviewCount = allReviewItems.filter((item) => item.profile_id && item.profile_id !== data.user.id).length;
      } else {
        adminReviewCount = 0;
      }
    } catch (error) {
      console.error('Failed to load review count:', error);
      reviewCount = 0;
      adminReviewCount = 0;
    }
  }

  async function refreshInboxCount() {
    if (!$isAuthenticated || !$currentUserId) {
      inboxCount = 0;
      inboxMessageCount = 0;
      inboxActivityCount = 0;
      followerAlertCount = 0;
      return;
    }

    try {
      const [
        { data: notificationData, error: notificationError },
        { data: conversations, error: conversationError }
      ] = await Promise.all([
        supabase
          .from('user_notifications')
          .select('id, event_type')
          .eq('recipient_user_id', $currentUserId)
          .is('read_at', null),
        supabase
          .from('user_conversations')
          .select('id, user_a_id, user_b_id, user_a_last_read_at, user_b_last_read_at, last_message_at, last_message_sender_id')
          .or(`user_a_id.eq.${$currentUserId},user_b_id.eq.${$currentUserId}`)
      ]);

      if (notificationError) throw notificationError;
      if (conversationError) throw conversationError;

      const unreadConversations = (conversations || []).filter((entry: any) => {
        if (!entry?.last_message_at || entry?.last_message_sender_id === $currentUserId) return false;
        const ownReadAt = entry.user_a_id === $currentUserId ? entry.user_a_last_read_at : entry.user_b_last_read_at;
        return !ownReadAt || new Date(entry.last_message_at).getTime() > new Date(ownReadAt).getTime();
      }).length;

      const unreadNotifications = notificationData || [];
      followerAlertCount = unreadNotifications.filter((entry: any) => entry.event_type === 'follow_create').length;
      inboxActivityCount = unreadNotifications.filter((entry: any) => entry.event_type !== 'follow_create').length;
      inboxMessageCount = unreadConversations;
      inboxCount = inboxActivityCount + inboxMessageCount + followerAlertCount;
    } catch (error) {
      console.error('Failed to load inbox count:', error);
      inboxCount = 0;
      inboxMessageCount = 0;
      inboxActivityCount = 0;
      followerAlertCount = 0;
    }
  }

  function teardownLiveInboxChannels() {
    for (const channel of liveInboxChannels) {
      supabase.removeChannel(channel);
    }
    liveInboxChannels = [];
  }

  function setupLiveInboxChannels() {
    teardownLiveInboxChannels();

    if (!$isAuthenticated || !$currentUserId) return;

    const notificationsChannel = supabase
      .channel(`nav-notifications-${$currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_notifications',
          filter: `recipient_user_id=eq.${$currentUserId}`
        },
        () => {
          void refreshInboxCount();
        }
      )
      .subscribe();

    const conversationsChannel = supabase
      .channel(`nav-conversations-${$currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_conversations',
          filter: `user_a_id=eq.${$currentUserId}`
        },
        () => {
          void refreshInboxCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_conversations',
          filter: `user_b_id=eq.${$currentUserId}`
        },
        () => {
          void refreshInboxCount();
        }
      )
      .subscribe();

    liveInboxChannels = [notificationsChannel, conversationsChannel];
  }

  function getUserLinkHref(href: string): string {
    if (!href) return '/';
    const separator = href.includes('?') ? '&' : '?';
    return `${href}${separator}returnTo=${encodeURIComponent(inheritedReturnTo || '/')}`;
  }

  function isActive(href: string): boolean {
    if (!href || !currentPath) return false;
    if (href === '/') return currentPath === '/';
    return currentPath === href || currentPath.startsWith(href + '/');
  }

  function toggleDropdown(id: string) {
    openDropdown = openDropdown === id ? null : id;
  }

  function closeMobile() {
    mobileOpen = false;
    openDropdown = null;
  }

  function closeDropdowns() {
    openDropdown = null;
  }

  function buildChatDrawerSrc(options?: { chatWith?: string; conversation?: string; item?: string }) {
    const params = new URLSearchParams();
    params.set('embed', '1');

    if (options?.chatWith) params.set('chatWith', options.chatWith);
    if (options?.conversation) params.set('conversation', options.conversation);
    if (options?.item) params.set('item', options.item);

    return `/chat?${params.toString()}`;
  }

  function openChatDrawer(options?: { chatWith?: string; conversation?: string; item?: string }) {
    if (!$isAuthenticated) {
      goto('/login');
      return;
    }

    if (isChatRoute) {
      const params = new URLSearchParams();
      if (options?.chatWith) params.set('chatWith', options.chatWith);
      if (options?.conversation) params.set('conversation', options.conversation);
      if (options?.item) params.set('item', options.item);
      const nextHref = params.toString() ? `/chat?${params.toString()}` : '/chat';
      goto(nextHref);
      return;
    }

    chatDrawerSrc = buildChatDrawerSrc(options);
    chatDrawerOpen = true;
    mobileOpen = false;
    openDropdown = null;
  }

  function toggleChatDrawer(options?: { chatWith?: string; conversation?: string; item?: string }) {
    if (chatDrawerOpen && !isChatRoute) {
      closeChatDrawer();
      return;
    }
    openChatDrawer(options);
  }

  function closeChatDrawer() {
    chatDrawerOpen = false;
  }

  function handleChatLauncherClick() {
    openChatDrawer();
  }

  async function handleLogout() {
    closeDropdowns();
    closeMobile();
    await supabase.auth.signOut();
    goto('/');
  }

  function getReviewTargetHref() {
    return getUserLinkHref('/profile/review');
  }

  function handleReviewBadgeClick(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    closeDropdowns();
    closeMobile();
    goto(getReviewTargetHref());
  }

  onMount(() => {
    refreshReviewCount();
    refreshInboxCount();
    setupLiveInboxChannels();
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement)?.closest('.dropdown')) {
        closeDropdowns();
      }
    };
    document.addEventListener('click', handler);
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && chatDrawerOpen) {
        closeChatDrawer();
      }
    };
    const handleOpenChat = (event: Event) => {
      const customEvent = event as CustomEvent<{ chatWith?: string; conversation?: string; item?: string }>;
      openChatDrawer(customEvent.detail || undefined);
    };
    const handleToggleChat = (event: Event) => {
      const customEvent = event as CustomEvent<{ chatWith?: string; conversation?: string; item?: string }>;
      toggleChatDrawer(customEvent.detail || undefined);
    };
    document.addEventListener('keydown', handleKeydown);
    window.addEventListener('culoca:open-chat', handleOpenChat as EventListener);
    window.addEventListener('culoca:toggle-chat', handleToggleChat as EventListener);
    return () => {
      document.removeEventListener('click', handler);
      document.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('culoca:open-chat', handleOpenChat as EventListener);
      window.removeEventListener('culoca:toggle-chat', handleToggleChat as EventListener);
      teardownLiveInboxChannels();
    };
  });

  $: {
    const nextLiveInboxChannelKey = `${$isAuthenticated ? 'auth' : 'anon'}:${$currentUserId || 'none'}`;
    if (nextLiveInboxChannelKey !== liveInboxChannelKey) {
      liveInboxChannelKey = nextLiveInboxChannelKey;
      setupLiveInboxChannels();
    }
  }

  $: if (isChatRoute && chatDrawerOpen) {
    chatDrawerOpen = false;
  }
</script>

<nav class="site-nav" aria-label="Hauptnavigation">
  <div class="nav-inner">
    <a href="/" class="nav-logo" aria-label="Culoca Startseite">
      <svg class="logo-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 473.74 100.88" aria-hidden="true">
        <defs><style>.sn1{fill:var(--text-primary,#fff)}.sn2{fill:#ee7221}</style></defs>
        <path class="sn1" d="m0,41.35c0-6.3,1.12-11.99,3.35-17.07,2.24-5.08,5.27-9.43,9.1-13.06,3.83-3.62,8.31-6.4,13.42-8.33,5.11-1.93,10.54-2.89,16.29-2.89,4.55,0,8.61.43,12.16,1.3s6.61,1.85,9.17,2.95c2.95,1.26,5.51,2.64,7.67,4.14l-12.58,21.86c-1.28-.95-2.68-1.85-4.19-2.72-1.36-.63-2.98-1.24-4.85-1.83-1.88-.59-4.01-.89-6.41-.89s-4.75.43-6.83,1.3c-2.08.87-3.89,2.05-5.45,3.55-1.56,1.5-2.78,3.25-3.65,5.26-.88,2.01-1.32,4.16-1.32,6.44s.46,4.43,1.38,6.44c.92,2.01,2.18,3.76,3.77,5.26,1.6,1.5,3.48,2.68,5.63,3.55,2.16.87,4.51,1.3,7.07,1.3s4.83-.31,6.83-.95c2-.63,3.67-1.34,5.03-2.13,1.6-.87,3-1.89,4.2-3.07l12.58,21.86c-2.15,1.73-4.71,3.27-7.67,4.61-2.56,1.1-5.63,2.13-9.23,3.07-3.59.94-7.71,1.42-12.34,1.42-6.23,0-11.98-1-17.25-3.01-5.27-2.01-9.82-4.82-13.66-8.45-3.83-3.62-6.83-7.97-8.98-13.06-2.16-5.08-3.24-10.69-3.24-16.84Z"/>
        <path class="sn1" d="m114.95,82.71c-5.03,0-9.58-.63-13.66-1.89-4.07-1.26-7.55-3.15-10.42-5.67-2.88-2.52-5.09-5.71-6.65-9.57s-2.34-8.39-2.34-13.59V1.89h25.52v49.04c0,2.76.58,4.87,1.74,6.32,1.16,1.46,3.09,2.19,5.81,2.19s4.65-.73,5.81-2.19c1.16-1.46,1.74-3.56,1.74-6.32V1.89h25.64v50.1c0,5.2-.78,9.73-2.34,13.59s-3.79,7.05-6.71,9.57c-2.92,2.52-6.41,4.41-10.48,5.67-4.07,1.26-8.63,1.89-13.66,1.89Z"/>
        <path class="sn1" d="m165.07,1.89h26.6v58.13h22.04v20.68h-48.64V1.89Z"/>
        <path class="sn2" d="m221.15,41.35c0-5.67,1.1-11.03,3.29-16.07,2.19-5.04,5.19-9.43,8.98-13.17,3.79-3.74,8.25-6.69,13.36-8.86,5.11-2.17,10.54-3.25,16.29-3.25s11.18,1.08,16.29,3.25c5.11,2.17,9.56,5.12,13.36,8.86,3.79,3.74,6.79,8.13,8.98,13.17,2.19,5.04,3.29,10.4,3.29,16.07s-1.1,11.03-3.29,16.07c-2.2,5.04-5.19,9.43-8.98,13.17-3.8,3.74-8.25,6.7-13.36,8.86-5.11,2.17-9.49,21.42-15.25,21.42s-12.23-19.25-17.34-21.42c-5.11-2.17-9.56-5.12-13.36-8.86-3.79-3.74-6.79-8.13-8.98-13.17-2.2-5.04-3.29-10.4-3.29-16.07Zm25.16,0c0,2.29.44,4.43,1.32,6.44.88,2.01,2.07,3.76,3.59,5.26,1.52,1.5,3.29,2.68,5.33,3.55,2.04.87,4.21,1.3,6.53,1.3s4.49-.43,6.53-1.3c2.04-.87,3.81-2.05,5.33-3.55,1.52-1.5,2.71-3.25,3.59-5.26.88-2.01,1.32-4.15,1.32-6.44s-.44-4.43-1.32-6.44c-.88-2.01-2.08-3.76-3.59-5.26-1.52-1.5-3.29-2.68-5.33-3.55-2.03-.87-4.21-1.3-6.53-1.3s-4.49.43-6.53,1.3c-2.04.87-3.81,2.05-5.33,3.55-1.52,1.5-2.72,3.25-3.59,5.26-.88,2.01-1.32,4.16-1.32,6.44Z"/>
        <path class="sn1" d="m315.86,41.35c0-6.3,1.12-11.99,3.36-17.07,2.23-5.08,5.27-9.43,9.1-13.06,3.83-3.62,8.31-6.4,13.42-8.33,5.11-1.93,10.54-2.89,16.29-2.89,4.55,0,8.61.43,12.16,1.3s6.61,1.85,9.17,2.95c2.95,1.26,5.51,2.64,7.67,4.14l-12.58,21.86c-1.28-.95-2.68-1.85-4.19-2.72-1.36-.63-2.98-1.24-4.85-1.83-1.88-.59-4.01-.89-6.41-.89s-4.75.43-6.83,1.3c-2.08.87-3.89,2.05-5.45,3.55-1.56,1.5-2.78,3.25-3.65,5.26-.88,2.01-1.32,4.16-1.32,6.44s.46,4.43,1.38,6.44c.92,2.01,2.18,3.76,3.77,5.26,1.6,1.5,3.48,2.68,5.63,3.55,2.16.87,4.51,1.3,7.07,1.3s4.83-.31,6.83-.95c2-.63,3.67-1.34,5.03-2.13,1.6-.87,3-1.89,4.2-3.07l12.58,21.86c-2.15,1.73-4.71,3.27-7.67,4.61-2.56,1.1-5.63,2.13-9.23,3.07-3.59.94-7.71,1.42-12.34,1.42-6.23,0-11.98-1-17.25-3.01-5.27-2.01-9.82-4.82-13.66-8.45-3.83-3.62-6.83-7.97-8.98-13.06-2.16-5.08-3.24-10.69-3.24-16.84Z"/>
        <path class="sn1" d="m424.26,1.89h19.17l30.31,78.81h-25.16l-2.64-7.09h-24.2l-2.64,7.09h-25.16L424.26,1.89Zm14.97,54.35l-5.39-13.83-5.39,13.83h10.78Z"/>
      </svg>
    </a>

    <div class="nav-links" class:open={mobileOpen}>
      {#each navLinks as link}
        <a href={link.href} class="nav-link" class:active={isActive(link.href)} on:click={closeMobile}>{link.label}</a>
      {/each}

      <!-- User menu (desktop) -->
      <div class="dropdown desktop-only">
        <a
          href={userEntryHref}
          class="nav-link user-toggle"
          class:active={userMenuActive}
          on:click={closeDropdowns}
        >
          <svg class="user-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          {userMenuLabel}
          {#if $isAuthenticated && reviewCount > 0}
            <button
              type="button"
              class="review-badge review-badge--button"
              aria-label={`${reviewCount} offene Daten`}
              title={$hasAdminPermission ? 'Zur Moderationsliste' : 'Zur Review-Liste'}
              on:click={handleReviewBadgeClick}
            >
              {reviewCount}
            </button>
          {/if}
          {#if $isAuthenticated && inboxCount > 0}
            <span
              class="inbox-badge"
              aria-label={`${inboxCount} ungelesene Benachrichtigungen oder Nachrichten`}
              title={`${inboxCount} ungelesene Benachrichtigungen oder Nachrichten`}
            >
              {inboxCount}
            </span>
          {/if}
        </a>
        {#if $isAuthenticated}
          <button
            type="button"
            class="nav-link dropdown-toggle user-toggle user-toggle--menu"
            aria-label="Benutzermenü öffnen"
            class:active={openDropdown === 'user'}
            on:click|stopPropagation={() => toggleDropdown('user')}
          >
            <svg class="dd-arrow" class:dd-open={openDropdown === 'user'} width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>
          </button>
        {/if}
        {#if $isAuthenticated && openDropdown === 'user'}
          <div class="dropdown-menu dropdown-menu--user">
            {#if inboxCount > 0}
              <div class="dropdown-status-row">
                {#if inboxMessageCount > 0}
                  <span class="mini-status-chip">Nachrichten {inboxMessageCount}</span>
                {/if}
                {#if inboxActivityCount > 0}
                  <span class="mini-status-chip">Aktivität {inboxActivityCount}</span>
                {/if}
                {#if followerAlertCount > 0}
                  <span class="mini-status-chip mini-status-chip--accent">Follower {followerAlertCount}</span>
                {/if}
              </div>
            {/if}
            {#if userIdentityLabel}
              <span class="dropdown-label dropdown-label--identity">{userIdentityLabel}</span>
            {/if}
            {#each accountMenuLinks.filter((l) => !l.adminOnly || $hasAdminPermission) as link}
              <a
                href={link.adminOnly ? link.href : getUserLinkHref(link.href)}
                class="dropdown-item"
                class:active={link.adminOnly ? isAdminRouteActive() : isActive(link.href)}
                on:click={closeDropdowns}
              >
                {link.label}
                {#if link.href === '/profile' && followerAlertCount > 0}
                  <span class="mini-status-chip mini-status-chip--inline mini-status-chip--accent">+{followerAlertCount} Follower</span>
                {/if}
                {#if link.adminOnly && adminReviewCount > 0}
                  <span class="review-badge review-badge--inline">{adminReviewCount}</span>
                {/if}
              </a>
            {/each}
            <div class="dropdown-divider"></div>
            <button class="dropdown-item dropdown-item--logout" on:click={handleLogout}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>
              Abmelden
            </button>
          </div>
        {/if}
      </div>

      <!-- User menu (mobile): section header + indented branch (Admin nested) -->
      <div class="mobile-only nav-group">
        {#if $isAuthenticated}
          <span class="nav-group-label">{userMenuLabel}</span>
          {#if userIdentityLabel}
            <span class="nav-group-sublabel">{userIdentityLabel}</span>
          {/if}
          <div class="nav-group__branch">
            {#each accountMenuLinks.filter((l) => !l.adminOnly || $hasAdminPermission) as link}
              <a
                href={link.adminOnly ? link.href : getUserLinkHref(link.href)}
                class="nav-link nav-link--sub"
                class:active={link.adminOnly ? isAdminRouteActive() : isActive(link.href)}
                on:click={closeMobile}
              >
                {link.label}
                {#if link.href === '/profile' && followerAlertCount > 0}
                  <span class="mini-status-chip mini-status-chip--inline mini-status-chip--accent">+{followerAlertCount} Follower</span>
                {/if}
                {#if link.adminOnly && adminReviewCount > 0}
                  <span class="review-badge review-badge--inline">{adminReviewCount}</span>
                {/if}
              </a>
            {/each}
            <button class="nav-link nav-link--sub nav-link--logout" on:click={handleLogout}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>
              Abmelden
            </button>
          </div>
        {:else}
          <div class="nav-group__branch">
            <a href="/login" class="nav-link nav-link--sub" class:active={isActive('/login')} on:click={closeMobile}>
              <svg class="user-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Login
            </a>
          </div>
        {/if}
      </div>
    </div>

    <button
      class="nav-burger"
      aria-label={mobileOpen ? 'Menü schließen' : 'Menü öffnen'}
      aria-expanded={mobileOpen}
      on:click={() => mobileOpen = !mobileOpen}
    >
      <span class="burger-line" class:open={mobileOpen}></span>
      <span class="burger-line" class:open={mobileOpen}></span>
      <span class="burger-line" class:open={mobileOpen}></span>
    </button>
  </div>

  {#if mobileOpen}
    <button class="nav-backdrop" on:click={closeMobile} aria-hidden="true" tabindex="-1"></button>
  {/if}
</nav>

{#if chatDrawerOpen}
  <button
    type="button"
    class="chat-drawer-backdrop"
    aria-label="Chat schließen"
    on:click={closeChatDrawer}
  ></button>
  <aside class="chat-drawer" aria-label="Chatfenster">
    <header class="chat-drawer__header">
      <div>
        <strong>Chat</strong>
        <span>Nachrichten beantworten</span>
      </div>
      <div class="chat-drawer__actions">
        <a class="chat-drawer__link" href="/chat">Vollbild</a>
        <button type="button" class="chat-drawer__close" aria-label="Chat schließen" on:click={closeChatDrawer}>
          ×
        </button>
      </div>
    </header>
    <iframe class="chat-drawer__frame" src={chatDrawerSrc} title="Culoca Chat"></iframe>
  </aside>
{/if}



<style>
  .site-nav {
    position: sticky;
    top: 0;
    z-index: 200;
    background: color-mix(in srgb, var(--bg-primary) 88%, transparent);
    backdrop-filter: blur(16px) saturate(1.4);
    -webkit-backdrop-filter: blur(16px) saturate(1.4);
    border-bottom: 1px solid var(--border-color);
  }

  .nav-inner {
    padding: 0 2rem;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
  }

  .chat-launcher {
    position: fixed;
    right: 1.25rem;
    bottom: 1.25rem;
    z-index: 240;
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.85rem 1rem;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--culoca-orange) 24%, var(--border-color));
    background: color-mix(in srgb, var(--bg-primary) 82%, transparent);
    backdrop-filter: blur(18px) saturate(1.25);
    -webkit-backdrop-filter: blur(18px) saturate(1.25);
    color: var(--text-primary);
    box-shadow: 0 18px 38px rgba(15, 23, 42, 0.18);
    cursor: pointer;
  }

  .chat-launcher:hover {
    border-color: color-mix(in srgb, var(--culoca-orange) 48%, var(--border-color));
    color: var(--culoca-orange);
  }

  .chat-launcher svg {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .chat-launcher__badge {
    min-width: 1.5rem;
    height: 1.5rem;
    padding: 0 0.35rem;
    border-radius: 999px;
    background: var(--culoca-orange);
    color: #fff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.78rem;
    font-weight: 700;
  }

  .chat-drawer-backdrop {
    position: fixed;
    inset: 0;
    z-index: 245;
    border: 0;
    background: rgba(15, 23, 42, 0.32);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  .chat-drawer {
    position: fixed;
    top: 0;
    right: 0;
    z-index: 250;
    width: min(960px, 100vw);
    height: 100dvh;
    display: grid;
    grid-template-rows: auto 1fr;
    background: var(--bg-primary);
    border-left: 1px solid var(--border-color);
    box-shadow: -18px 0 48px rgba(15, 23, 42, 0.24);
  }

  .chat-drawer__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 0.95rem 1rem;
    border-bottom: 1px solid var(--border-color);
    background: color-mix(in srgb, var(--bg-primary) 90%, transparent);
  }

  .chat-drawer__header strong,
  .chat-drawer__header span {
    display: block;
  }

  .chat-drawer__header span {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .chat-drawer__actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .chat-drawer__link,
  .chat-drawer__close {
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
    color: var(--text-primary);
    border-radius: 999px;
    padding: 0.55rem 0.9rem;
    font: inherit;
    text-decoration: none;
    cursor: pointer;
  }

  .chat-drawer__link:hover,
  .chat-drawer__close:hover {
    border-color: color-mix(in srgb, var(--culoca-orange) 40%, var(--border-color));
    color: var(--culoca-orange);
  }

  .chat-drawer__close {
    min-width: 2.5rem;
    font-size: 1.15rem;
    line-height: 1;
  }

  .chat-drawer__frame {
    width: 100%;
    height: 100%;
    border: 0;
    background: var(--bg-primary);
  }

  /* Logo */
  .nav-logo {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    text-decoration: none;
  }
  .logo-svg { height: 34px; width: auto; }

  /* Links */
  .nav-links {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .nav-link {
    position: relative;
    padding: 0.5rem 0.85rem;
    font-size: 1rem;
    font-weight: 500;
    letter-spacing: 0.01em;
    color: var(--text-secondary);
    text-decoration: none;
    border-radius: 8px;
    transition: color 0.15s, background 0.15s;
    border: none;
    background: none;
    cursor: pointer;
    font-family: inherit;
  }
  .nav-link:hover { color: var(--text-primary); background: var(--bg-tertiary); }
  .nav-link.active { color: var(--culoca-orange); }
  .nav-link.active::after {
    content: '';
    position: absolute;
    bottom: 2px; left: 0.85rem; right: 0.85rem;
    height: 2px; border-radius: 1px;
    background: var(--culoca-orange);
  }

  /* Dropdown */
  .dropdown { position: relative; }
  .dropdown-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }
  .dd-arrow { transition: transform 0.2s; flex-shrink: 0; }
  .dd-open { transform: rotate(180deg); }

  .dropdown-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    min-width: 170px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    box-shadow: 0 6px 24px rgba(0,0,0,0.14);
    z-index: 300;
    overflow: hidden;
  }
  .dropdown-item {
    display: block;
    padding: 0.6rem 1rem;
    font-size: 0.95rem;
    color: var(--text-secondary);
    text-decoration: none;
    transition: background 0.12s, color 0.12s;
  }
  .dropdown-item:hover { background: var(--bg-tertiary); color: var(--text-primary); }
  .dropdown-item.active { color: var(--culoca-orange); }

  .dropdown-menu--user { min-width: 190px; right: 0; left: auto; }

  .dropdown-status-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    padding: 0.75rem 1rem 0.35rem;
  }

  .dropdown-divider {
    height: 1px;
    margin: 0.35rem 0;
    background: var(--border-color);
  }

  .dropdown-label {
    display: block;
    padding: 0.4rem 1rem 0.15rem;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }

  .dropdown-label--identity {
    text-transform: none;
    letter-spacing: normal;
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--text-secondary);
    padding-top: 0.15rem;
    padding-bottom: 0.35rem;
  }

  .dropdown-item--logout {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    border: none;
    background: none;
    font-family: inherit;
    cursor: pointer;
    color: var(--text-secondary);
  }
  .dropdown-item--logout:hover { color: #e74c3c; background: var(--bg-tertiary); }

  .user-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .user-toggle--menu {
    margin-left: 0.15rem;
    padding-left: 0.55rem;
    padding-right: 0.55rem;
  }
  .user-icon { flex-shrink: 0; opacity: 0.7; }
  .review-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.35rem;
    height: 1.35rem;
    padding: 0 0.35rem;
    border-radius: 999px;
    background: #c1121f;
    color: #fff;
    font-size: 0.72rem;
    font-weight: 700;
    line-height: 1;
  }
  .review-badge--button {
    border: none;
    cursor: pointer;
    font-family: inherit;
  }
  .review-badge--inline {
    margin-left: auto;
  }
  .inbox-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.35rem;
    height: 1.35rem;
    padding: 0 0.35rem;
    border-radius: 999px;
    background: var(--accent-color);
    color: #fff;
    font-size: 0.72rem;
    font-weight: 700;
    line-height: 1;
  }
  .inbox-badge--inline {
    margin-left: auto;
  }

  .mini-status-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 1.5rem;
    padding: 0.15rem 0.55rem;
    border-radius: 999px;
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    font-size: 0.72rem;
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
  }

  .mini-status-chip--accent {
    background: color-mix(in srgb, var(--accent-color) 18%, var(--bg-tertiary) 82%);
    color: var(--text-primary);
  }

  .mini-status-chip--inline {
    margin-left: 0.45rem;
  }

  /* Mobile helpers */
  .mobile-only { display: none; }
  .nav-group-label {
    display: block;
    padding: 0.6rem 1rem 0.2rem;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }

  .nav-group-sublabel {
    display: block;
    padding: 0 1rem 0.35rem;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }
  /* Sub-indent only used inside mobile .nav-group__branch (desktop: block hidden) */
  .nav-link--sub { padding-left: 1.5rem; }

  /* Hamburger */
  .nav-burger {
    display: none;
    flex-direction: column;
    justify-content: center;
    gap: 5px;
    width: 36px; height: 36px; padding: 6px;
    background: none; border: none; cursor: pointer;
    border-radius: 8px;
    transition: background 0.15s;
  }
  .nav-burger:hover { background: var(--bg-tertiary); }
  .burger-line {
    display: block; width: 100%; height: 2px;
    background: var(--text-primary); border-radius: 1px;
    transition: transform 0.25s, opacity 0.25s;
    transform-origin: center;
  }
  .burger-line.open:nth-child(1) { transform: translateY(7px) rotate(45deg); }
  .burger-line.open:nth-child(2) { opacity: 0; }
  .burger-line.open:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

  .nav-backdrop {
    display: none;
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.4);
    border: none; cursor: default; z-index: -1;
  }

  /* Mobile */
  @media (max-width: 720px) {
    .nav-inner { padding: 0 1.25rem; height: 54px; }
    .nav-burger { display: flex; }
    .desktop-only { display: none !important; }
    .mobile-only { display: block; }

    .nav-links {
      position: fixed;
      top: 54px; right: 0;
      width: 280px;
      max-height: calc(100dvh - 54px);
      flex-direction: column;
      align-items: stretch;
      gap: 0; padding: 0.75rem;
      background: var(--bg-primary);
      border-left: 1px solid var(--border-color);
      border-bottom: 1px solid var(--border-color);
      border-radius: 0 0 0 16px;
      box-shadow: -4px 8px 32px rgba(0,0,0,0.18);
      transform: translateX(100%);
      opacity: 0; pointer-events: none;
      transition: transform 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s;
      overflow-y: auto;
    }
    .nav-links.open { transform: translateX(0); opacity: 1; pointer-events: auto; }
    .nav-link { padding: 0.75rem 1rem; font-size: 1rem; border-radius: 10px; }
    .nav-link.active::after { display: none; }
    .nav-link.active { background: var(--bg-tertiary); }

    .nav-group {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      margin-top: 0.35rem;
      padding-top: 0.45rem;
      border-top: 1px solid var(--border-color);
    }
    .nav-group__branch {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-left: 0.15rem;
      padding: 0.2rem 0 0.15rem 0.65rem;
      border-left: 3px solid color-mix(in srgb, var(--culoca-orange) 40%, var(--border-color) 60%);
      border-radius: 0 10px 10px 0;
    }
    .nav-group .nav-group-label {
      padding-left: 0.25rem;
      padding-right: 0.75rem;
    }
    .nav-group .nav-link--sub {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.35rem;
      min-width: 0;
      padding: 0.65rem 0.75rem 0.65rem 0.45rem;
      font-size: 0.93rem;
      text-align: left;
    }
    .nav-group .nav-link--sub.active {
      color: var(--culoca-orange);
    }

    .nav-link--logout {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      border: none;
      background: none;
      font-family: inherit;
      cursor: pointer;
      color: var(--text-secondary);
      width: 100%;
      text-align: left;
    }
    .nav-link--logout:hover { color: #e74c3c; }
    .nav-backdrop { display: block; }
  }
</style>
