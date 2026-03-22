<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { afterNavigate, goto } from '$app/navigation';
  import type { PageData } from './$types';
  import SiteNav from '$lib/SiteNav.svelte';
  import SiteFooter from '$lib/SiteFooter.svelte';
  import FollowButton from '$lib/FollowButton.svelte';
  import { getSeoImageUrl } from '$lib/utils/seoImageUrl';
  import { isAuthenticated } from '$lib/sessionStore';
  import { readRememberedLocation, type RememberedLocation } from '$lib/locationPreferences';
  import { getPublicItemHref } from '$lib/content/routing';
  import { authFetch } from '$lib/authFetch';
  import { supabase } from '$lib/supabaseClient';
  import { buildBreadcrumbJsonLd, DEFAULT_OG_IMAGE, trimText } from '$lib/seo/site';
  import HomeTypeSectionsFeed from '$lib/HomeTypeSectionsFeed.svelte';
  import HomeDashboardDiscover from '$lib/HomeDashboardDiscover.svelte';
  import { getStoredGpsPositionForHub } from '$lib/storedGpsReadout';
  import {
    readDashboardHeroVisit,
    saveDashboardHeroVisitFromItem,
    clearDashboardHeroVisit
  } from '$lib/dashboardHeroVisit';

  export let data: PageData;
  type DashboardView = 'all' | 'inbox' | 'creator' | 'network';

  let savedLocation: RememberedLocation | null = null;

  /** Wie /foto: gleiche Koordinaten-Quellen, nicht nur readRememberedLocation (gpsAllowed) */
  $: discoverDistanceCoords =
    browser
      ? getStoredGpsPositionForHub() ??
        (savedLocation ? { lat: savedLocation.lat, lon: savedLocation.lon } : null)
      : null;
  let currentUserFullName = '';
  let currentUserId = '';
  let currentUserAccountname = '';
  let dashboardLoading = false;
  let dashboardLoadedForUser = '';
  let dashboardConversations: any[] = [];
  let dashboardNotifications: any[] = [];
  let dashboardFollowedProfiles: any[] = [];
  let dashboardFollowerProfiles: any[] = [];
  /** Netzwerk-Panel: gefolgte Profile vs. Follower-Liste */
  let dashboardNetworkListMode: 'following' | 'followers' = 'following';
  let dashboardFollowedItems: any[] = [];
  let dashboardLatestDownloads: any[] = [];
  let dashboardRecentItems: any[] = [];
  let dashboardFavoriteItems: any[] = [];
  let dashboardLikedItems: any[] = [];
  let dashboardPriorityFeed: any[] = [];
  let dashboardUnreadCount = 0;
  let dashboardChannels: any[] = [];
  let activeDashboardView: DashboardView = 'all';
  let dashboardUserSearchQuery = '';
  let dashboardUserSearchResults: any[] = [];
  let dashboardUserSearchLoading = false;
  let dashboardUserSearchMessage = '';
  let dashboardUserSearchTimeout: ReturnType<typeof setTimeout> | null = null;

  type DashboardHeroBackdrop = {
    href: string;
    imageUrl: string;
    title: string | null;
    source: 'visit' | 'upload';
  };
  let dashboardHeroBackdrop: DashboardHeroBackdrop | null = null;

  function truncate(text: string | null | undefined, max: number): string {
    if (!text) return '';
    return text.length > max ? text.slice(0, max).trimEnd() + '...' : text;
  }

  function normalizeUserSearchQuery(value: string): string {
    return value.trim().replace(/^@+/, '');
  }

  function buildLocationPreviewUrl(location: RememberedLocation | null): string {
    if (!location) return '';

    const delta = 0.018;
    const left = location.lon - delta;
    const right = location.lon + delta;
    const top = location.lat + delta;
    const bottom = location.lat - delta;

    return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${location.lat}%2C${location.lon}`;
  }

  $: locationPreviewUrl = buildLocationPreviewUrl(savedLocation);
  $: publicProfileHref = currentUserAccountname ? `/${encodeURIComponent(currentUserAccountname)}` : '/profile';
  $: filteredDashboardPriorityFeed = dashboardPriorityFeed.filter((entry: any) => {
    if (activeDashboardView === 'all') return true;
    if (activeDashboardView === 'inbox') return entry.category === 'inbox';
    if (activeDashboardView === 'creator') return entry.category === 'creator';
    if (activeDashboardView === 'network') return entry.category === 'network';
    return true;
  });
  /** Kachel „Jetzt wichtig“: nur die ersten Einträge, Rest über Tabs/unten. */
  $: displayedPriorityFeed = filteredDashboardPriorityFeed.slice(0, 8);
  $: dashboardTabCounts = {
    all: dashboardPriorityFeed.length,
    inbox: dashboardPriorityFeed.filter((entry: any) => entry.category === 'inbox').length,
    creator: dashboardPriorityFeed.filter((entry: any) => entry.category === 'creator').length,
    network: dashboardPriorityFeed.filter((entry: any) => entry.category === 'network').length
  };

  $: dashboardNetworkProfiles =
    dashboardNetworkListMode === 'following' ? dashboardFollowedProfiles : dashboardFollowerProfiles;

  async function loadCurrentUserFullName() {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      currentUserFullName = '';
      currentUserId = '';
      currentUserAccountname = '';
      return;
    }

    currentUserId = user.id;

    const profileName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.user_metadata?.display_name;

    if (profileName) {
      currentUserFullName = profileName;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, accountname')
      .eq('id', user.id)
      .single();

    currentUserAccountname = profile?.accountname || '';
    currentUserFullName = currentUserFullName || profile?.full_name || profile?.accountname || '';

    await loadDashboardHeroBackdrop();
  }

  /**
   * Hero-Hintergrund: zuletzt besuchtes Item (localStorage) mit frischen Pfaden aus DB,
   * sonst zuletzt hochgeladenes eigenes Item mit Bild.
   */
  async function loadDashboardHeroBackdrop() {
    dashboardHeroBackdrop = null;
    if (!browser || !currentUserId) return;

    try {
      const stored = readDashboardHeroVisit();
      const visitAllowed =
        stored?.slug &&
        (!stored.viewerUserId || stored.viewerUserId === currentUserId);

      if (visitAllowed && stored) {
        const { data: fresh, error: freshErr } = await supabase
          .from('items')
          .select(
            'slug, path_2048, path_512, canonical_path, title, country_slug, district_slug, municipality_slug, updated_at'
          )
          .eq('slug', stored.slug)
          .maybeSingle();

        if (!freshErr && fresh?.slug && (fresh.path_2048 || fresh.path_512)) {
          saveDashboardHeroVisitFromItem(fresh, { viewerUserId: currentUserId });
          const path = fresh.path_2048 || fresh.path_512;
          const size: '2048' | '512' = fresh.path_2048 ? '2048' : '512';
          const imageUrl = getSeoImageUrl(fresh.slug, path, size);
          const href = getPublicItemHref(fresh);
          if (imageUrl) {
            dashboardHeroBackdrop = {
              href,
              imageUrl,
              title: fresh.title ?? null,
              source: 'visit'
            };
            return;
          }
        }

        // Fallback: Snapshot aus dem Besuch (z. B. RLS / offline), Eintrag ggf. veraltet
        if (stored.path_2048 || stored.path_512) {
          const path = stored.path_2048 || stored.path_512;
          const size: '2048' | '512' = stored.path_2048 ? '2048' : '512';
          const imageUrl = getSeoImageUrl(stored.slug, path, size);
          const href = stored.href || getPublicItemHref(stored);
          if (imageUrl) {
            dashboardHeroBackdrop = {
              href,
              imageUrl,
              title: stored.title ?? null,
              source: 'visit'
            };
            return;
          }
        }

        if (!freshErr && fresh === null) {
          clearDashboardHeroVisit();
        }
      }

      const { data: rows, error } = await supabase
        .from('items')
        .select(
          'slug, path_2048, path_512, canonical_path, title, country_slug, district_slug, municipality_slug'
        )
        .eq('profile_id', currentUserId)
        .not('slug', 'is', null)
        .order('created_at', { ascending: false })
        .limit(40);

      if (error || !rows?.length) return;

      const row = rows.find((r) => r.path_2048 || r.path_512);
      if (!row?.slug) return;

      const path = row.path_2048 || row.path_512;
      const size: '2048' | '512' = row.path_2048 ? '2048' : '512';
      const imageUrl = getSeoImageUrl(row.slug, path, size);
      if (!imageUrl) return;

      const href = getPublicItemHref(row);
      dashboardHeroBackdrop = { href, imageUrl, title: row.title ?? null, source: 'upload' };
    } catch (e) {
      console.warn('[home] dashboard hero backdrop failed', e);
    }
  }

  function getAvatarUrl(profileEntry: any) {
    const avatarUrl = profileEntry?.avatar_url;
    if (!avatarUrl) return '';
    if (String(avatarUrl).startsWith('http')) return avatarUrl;
    return `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/avatars/${avatarUrl}`;
  }

  function getItemPreviewUrl(item: any) {
    return item?.slug && item?.path_512 ? getSeoImageUrl(item.slug, item.path_512, '512') : '';
  }

  /** Kompakt für Dashboard-Zeilen: Datum und Uhrzeit getrennt (weniger Breite neben dem Titel). */
  function formatMetaDateLines(value: string | number | Date | null | undefined): {
    date: string;
    time: string;
    iso: string;
  } {
    if (value === null || value === undefined || value === '') {
      return { date: '', time: '', iso: '' };
    }
    try {
      const d = value instanceof Date ? value : new Date(value);
      if (!Number.isFinite(d.getTime())) return { date: '', time: '', iso: '' };
      return {
        date: new Intl.DateTimeFormat('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: '2-digit'
        }).format(d),
        time: new Intl.DateTimeFormat('de-DE', {
          hour: '2-digit',
          minute: '2-digit'
        }).format(d),
        iso: d.toISOString()
      };
    } catch {
      return { date: '', time: '', iso: '' };
    }
  }

  function toTimestamp(value: string | null | undefined): number {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  function getConversationUnread(entry: any) {
    if (!entry || !currentUserId || !entry.last_message_at) return false;
    if (entry.last_message_sender_id === currentUserId) return false;
    const ownReadAt = entry.user_a_id === currentUserId ? entry.user_a_last_read_at : entry.user_b_last_read_at;
    return !ownReadAt || new Date(entry.last_message_at).getTime() > new Date(ownReadAt).getTime();
  }

  function getNotificationHref(entry: any) {
    if (entry?.event_type === 'chat_message' && entry?.payload?.conversation_id) {
      return `/chat?conversation=${encodeURIComponent(entry.payload.conversation_id)}`;
    }

    if (entry?.event_type === 'follow_create' && entry?.actor?.accountname) {
      return `/${encodeURIComponent(entry.actor.accountname)}`;
    }

    return entry?.item ? getPublicItemHref(entry.item) : '/profile';
  }

  function getNotificationLabel(entry: any) {
    switch (entry?.event_type) {
      case 'download':
        return 'Download';
      case 'favorite_add':
        return 'Gemerkt';
      case 'like_add':
        return 'Like';
      case 'comment_create':
        return 'Kommentar';
      case 'chat_message':
        return 'Nachricht';
      case 'follow_create':
        return 'Neuer Follower';
      default:
        return 'Aktivitaet';
    }
  }

  function getNotificationPreview(entry: any) {
    if (entry?.event_type === 'chat_message' && entry?.payload?.message_excerpt) {
      return entry.payload.message_excerpt;
    }

    if (entry?.event_type === 'comment_create' && entry?.payload?.comment_excerpt) {
      return entry.payload.comment_excerpt;
    }

    if (entry?.event_type === 'follow_create') {
      return 'folgt jetzt deinem Profil';
    }

    return entry?.item?.title || entry?.item?.original_name || '';
  }

  function buildPriorityFeed(args: {
    conversations: any[];
    notifications: any[];
    followedItems: any[];
    followedProfiles: any[];
    latestDownloads: any[];
  }) {
    const feed = [
      ...args.conversations.map((entry: any) => ({
        id: `conversation-${entry.id}`,
        type: 'conversation',
        category: 'inbox',
        score: getConversationUnread(entry) ? 120 : 80,
        timestamp: toTimestamp(entry.last_message_at),
        title: entry.otherUser?.full_name || entry.otherUser?.accountname || 'Unbekannt',
        subtitle: entry.starter_item?.title || entry.starter_item?.original_name || 'Gespräch',
        preview: truncate(entry.last_message_preview, 120) || 'Neue Nachricht ansehen',
        href: `/chat?conversation=${encodeURIComponent(entry.id)}`,
        thumbUrl: entry.starter_item ? getItemPreviewUrl(entry.starter_item) : '',
        fallback: (entry.otherUser?.full_name || entry.otherUser?.accountname || '?').slice(0, 1).toUpperCase()
      })),
      ...args.notifications.map((entry: any) => ({
        id: `notification-${entry.id}`,
        type: 'notification',
        category: entry.event_type === 'follow_create' ? 'network' : 'inbox',
        score: entry.read_at ? 55 : entry.event_type === 'follow_create' ? 95 : 90,
        timestamp: toTimestamp(entry.created_at),
        title: entry.actor?.full_name || entry.actor?.accountname || 'Jemand',
        subtitle: getNotificationLabel(entry),
        preview: truncate(getNotificationPreview(entry), 120) || 'Aktivität öffnen',
        href: getNotificationHref(entry),
        thumbUrl: entry.item ? getItemPreviewUrl(entry.item) : getAvatarUrl(entry.actor),
        fallback: (entry.actor?.full_name || entry.actor?.accountname || '?').slice(0, 1).toUpperCase()
      })),
      ...args.latestDownloads.map((entry: any) => ({
        id: `download-${entry.id}`,
        type: 'download',
        category: 'creator',
        score: 100,
        timestamp: toTimestamp(entry.created_at),
        title: entry.actor?.full_name || entry.actor?.accountname || 'Jemand',
        subtitle: 'Download',
        preview: truncate(entry.item?.title || entry.item?.original_name || 'Jemand hat einen deiner Inhalte heruntergeladen', 120),
        href: entry.item ? getPublicItemHref(entry.item) : '/profile',
        thumbUrl: entry.item ? getItemPreviewUrl(entry.item) : getAvatarUrl(entry.actor),
        fallback: (entry.actor?.full_name || entry.actor?.accountname || '?').slice(0, 1).toUpperCase()
      })),
      ...args.followedItems.map((entry: any) => ({
        id: `followed-item-${entry.id}`,
        type: 'followed_item',
        category: 'network',
        score: 60,
        timestamp: toTimestamp(entry.created_at),
        title: entry.title || entry.original_name || 'Neuer Inhalt',
        subtitle: entry.profile?.full_name || entry.profile?.accountname || 'Profil',
        preview: 'Neuen öffentlichen Eintrag öffnen',
        href: getPublicItemHref(entry),
        thumbUrl: getItemPreviewUrl(entry),
        fallback: (entry.profile?.full_name || entry.profile?.accountname || '?').slice(0, 1).toUpperCase()
      })),
      ...args.followedProfiles.map((entry: any) => ({
        id: `followed-profile-${entry.id}`,
        type: 'followed_profile',
        category: 'network',
        score: 45,
        timestamp: 0,
        title: entry.full_name || entry.accountname || 'Profil',
        subtitle: 'Direktnachricht',
        preview: 'Schnell wieder in den Chat einsteigen',
        href: `/chat?chatWith=${encodeURIComponent(entry.id)}`,
        thumbUrl: getAvatarUrl(entry),
        fallback: (entry.full_name || entry.accountname || '?').slice(0, 1).toUpperCase()
      }))
    ];

    return feed
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return right.timestamp - left.timestamp;
      })
      .slice(0, 6);
  }

  async function loadDashboardData() {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    if (!user) {
      dashboardConversations = [];
      dashboardNotifications = [];
      dashboardFollowedProfiles = [];
      dashboardFollowerProfiles = [];
      dashboardFollowedItems = [];
      dashboardLatestDownloads = [];
      dashboardRecentItems = [];
      dashboardFavoriteItems = [];
      dashboardLikedItems = [];
      dashboardUnreadCount = 0;
      dashboardPriorityFeed = [];
      dashboardLoadedForUser = '';
      return;
    }

    currentUserId = user.id;
    dashboardLoading = true;

    try {
      const [
        { data: conversationData, error: conversationError },
        { data: notificationData, error: notificationError },
        { data: latestDownloadData, error: latestDownloadError },
        { data: recentItemData, error: recentItemError },
        { data: favoriteItemData, error: favoriteItemError },
        { data: likedItemData, error: likedItemError },
        { data: followsOutData, error: followsOutError },
        { data: followsInData, error: followsInError }
      ] =
        await Promise.all([
          supabase
            .from('user_conversations')
            .select(`
              id,
              user_a_id,
              user_b_id,
              last_message_at,
              last_message_preview,
              last_message_sender_id,
              user_a_last_read_at,
              user_b_last_read_at,
              user_a:user_a_id(
                id,
                full_name,
                accountname,
                avatar_url
              ),
              user_b:user_b_id(
                id,
                full_name,
                accountname,
                avatar_url
              ),
              starter_item:starter_item_id(
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
            .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
            .not('last_message_sender_id', 'is', null)
            .order('last_message_at', { ascending: false })
            .limit(5),
          supabase
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
            .eq('recipient_user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('item_events')
            .select(`
              id,
              event_type,
              created_at,
              actor_user_id,
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
            .eq('owner_user_id', user.id)
            .eq('event_type', 'download')
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
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
            .eq('actor_user_id', user.id)
            .eq('event_type', 'item_view')
            .order('created_at', { ascending: false })
            .limit(24),
          supabase
            .from('item_favorites')
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
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(24),
          supabase
            .from('item_likes')
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
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(24),
          supabase
            .from('user_follows')
            .select('followed_user_id, created_at')
            .eq('follower_user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(24),
          supabase
            .from('user_follows')
            .select('follower_user_id, created_at')
            .eq('followed_user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(24)
        ]);

      if (conversationError) throw conversationError;
      if (notificationError) throw notificationError;
      if (latestDownloadError) throw latestDownloadError;
      if (recentItemError) throw recentItemError;
      if (favoriteItemError) throw favoriteItemError;
      if (likedItemError) throw likedItemError;
      if (followsOutError) throw followsOutError;
      if (followsInError) throw followsInError;

      dashboardConversations = (conversationData || []).map((entry: any) => ({
        ...entry,
        otherUser: entry.user_a_id === user.id ? entry.user_b : entry.user_a
      }));
      dashboardNotifications = (notificationData || []).map((entry: any) => ({
        ...entry,
        item: entry.items || null,
        actor: entry.profiles || null
      }));
      dashboardLatestDownloads = (latestDownloadData || []).map((entry: any) => ({
        ...entry,
        item: entry.items || null,
        actor: entry.profiles || null
      }));
      const seenRecentItems = new Set<string>();
      dashboardRecentItems = (recentItemData || [])
        .filter((entry: any) => {
          const itemId = entry?.item_id;
          if (!itemId || seenRecentItems.has(itemId)) return false;
          seenRecentItems.add(itemId);
          return true;
        })
        .map((entry: any) => ({
          viewedAt: entry.created_at,
          ...(entry.items || {})
        }))
        .slice(0, 5);
      dashboardFavoriteItems = (favoriteItemData || []).map((entry: any) => ({
        favoritedAt: entry.created_at,
        ...(entry.items || {})
      })).slice(0, 12);
      dashboardLikedItems = (likedItemData || []).map((entry: any) => ({
        likedAt: entry.created_at,
        ...(entry.items || {})
      })).slice(0, 12);
      dashboardUnreadCount = dashboardNotifications.filter((entry: any) => !entry.read_at).length;

      const followedIds = [
        ...new Set((followsOutData || []).map((entry: any) => entry.followed_user_id).filter(Boolean))
      ];
      const followerIds = [
        ...new Set((followsInData || []).map((entry: any) => entry.follower_user_id).filter(Boolean))
      ];

      if (followedIds.length > 0) {
        const [{ data: profilesData, error: profilesError }, { data: itemsData, error: itemsError }] =
          await Promise.all([
            supabase
              .from('profiles')
              .select('id, full_name, accountname, avatar_url, website')
              .in('id', followedIds),
            supabase
              .from('items')
              .select(
                'id, profile_id, slug, title, original_name, canonical_path, country_slug, district_slug, municipality_slug, path_512, created_at'
              )
              .in('profile_id', followedIds)
              .eq('admin_hidden', false)
              .is('group_root_item_id', null)
              .not('slug', 'is', null)
              .or('is_private.eq.false,is_private.is.null')
              .order('created_at', { ascending: false })
              .limit(12)
          ]);

        if (profilesError) throw profilesError;
        if (itemsError) throw itemsError;

        const profilesById = new Map((profilesData || []).map((entry: any) => [entry.id, entry]));
        dashboardFollowedProfiles = followedIds.map((id) => profilesById.get(id)).filter(Boolean);
        dashboardFollowedItems = (itemsData || [])
          .map((entry: any) => ({
            ...entry,
            profile: profilesById.get(entry.profile_id) || null
          }))
          .slice(0, 5);
      } else {
        dashboardFollowedProfiles = [];
        dashboardFollowedItems = [];
      }

      if (followerIds.length > 0) {
        const { data: followerProfilesData, error: followerProfilesError } = await supabase
          .from('profiles')
          .select('id, full_name, accountname, avatar_url, website')
          .in('id', followerIds);

        if (followerProfilesError) throw followerProfilesError;

        const fpById = new Map((followerProfilesData || []).map((entry: any) => [entry.id, entry]));
        dashboardFollowerProfiles = followerIds.map((id) => fpById.get(id)).filter(Boolean);
      } else {
        dashboardFollowerProfiles = [];
      }

      dashboardPriorityFeed = buildPriorityFeed({
        conversations: dashboardConversations,
        notifications: dashboardNotifications,
        followedItems: dashboardFollowedItems,
        followedProfiles: dashboardFollowedProfiles.slice(0, 5),
        latestDownloads: dashboardLatestDownloads
      });

      dashboardLoadedForUser = user.id;
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      dashboardConversations = [];
      dashboardNotifications = [];
      dashboardFollowedProfiles = [];
      dashboardFollowerProfiles = [];
      dashboardFollowedItems = [];
      dashboardLatestDownloads = [];
      dashboardRecentItems = [];
      dashboardFavoriteItems = [];
      dashboardLikedItems = [];
      dashboardPriorityFeed = [];
      dashboardUnreadCount = 0;
    } finally {
      dashboardLoading = false;
    }
  }

  function teardownDashboardChannels() {
    for (const channel of dashboardChannels) {
      supabase.removeChannel(channel);
    }
    dashboardChannels = [];

  }

  function setupDashboardChannels(userId: string) {
    teardownDashboardChannels();

    if (!userId) return;

    const notificationsChannel = supabase
      .channel(`home-notifications-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_notifications', filter: `recipient_user_id=eq.${userId}` },
        async () => {
          await loadDashboardData();
        }
      )
      .subscribe();

    const conversationsChannel = supabase
      .channel(`home-conversations-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_conversations', filter: `user_a_id=eq.${userId}` },
        async () => {
          await loadDashboardData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_conversations', filter: `user_b_id=eq.${userId}` },
        async () => {
          await loadDashboardData();
        }
      )
      .subscribe();
    const followsChannel = supabase
      .channel(`home-follows-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_follows', filter: `follower_user_id=eq.${userId}` },
        async () => {
          await loadDashboardData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_follows', filter: `followed_user_id=eq.${userId}` },
        async () => {
          await loadDashboardData();
        }
      )
      .subscribe();

    const favoritesChannel = supabase
      .channel(`home-favorites-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'item_favorites', filter: `user_id=eq.${userId}` },
        async () => {
          await loadDashboardData();
        }
      )
      .subscribe();

    const likesChannel = supabase
      .channel(`home-likes-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'item_likes', filter: `user_id=eq.${userId}` },
        async () => {
          await loadDashboardData();
        }
      )
      .subscribe();

    dashboardChannels = [
      notificationsChannel,
      conversationsChannel,
      followsChannel,
      favoritesChannel,
      likesChannel
    ];
  }

  function showDashboardPanel(panel: 'inbox' | 'creator' | 'network') {
    return activeDashboardView === 'all' || activeDashboardView === panel;
  }

  function showDashboardUserSearch() {
    return activeDashboardView === 'all' || activeDashboardView === 'network';
  }

  async function searchDashboardUsers() {
    const query = normalizeUserSearchQuery(dashboardUserSearchQuery);

    if (!$isAuthenticated || !currentUserId || query.length < 2) {
      dashboardUserSearchResults = [];
      dashboardUserSearchMessage = query.length === 1 ? 'Bitte mindestens 2 Zeichen eingeben.' : '';
      return;
    }

    dashboardUserSearchLoading = true;
    dashboardUserSearchMessage = '';

    try {
      const response = await authFetch(`/api/search-users?q=${encodeURIComponent(query)}`);

      if (!response.ok) {
        dashboardUserSearchResults = [];
        dashboardUserSearchMessage = 'Die Suche ist gerade nicht verfügbar.';
        return;
      }

      const payload = await response.json();
      dashboardUserSearchResults = payload.users || [];
      dashboardUserSearchMessage = dashboardUserSearchResults.length === 0 ? 'Keine passenden Profile gefunden.' : '';
    } catch (error) {
      console.error('Dashboard user search failed:', error);
      dashboardUserSearchResults = [];
      dashboardUserSearchMessage = 'Die Suche ist gerade nicht verfügbar.';
    } finally {
      dashboardUserSearchLoading = false;
    }
  }

  function handleDashboardUserSearchInput() {
    if (dashboardUserSearchTimeout) {
      clearTimeout(dashboardUserSearchTimeout);
    }

    dashboardUserSearchTimeout = setTimeout(() => {
      searchDashboardUsers();
    }, 250);
  }

  function clearDashboardUserSearch() {
    dashboardUserSearchQuery = '';
    dashboardUserSearchResults = [];
    dashboardUserSearchMessage = '';
    dashboardUserSearchLoading = false;
    if (dashboardUserSearchTimeout) {
      clearTimeout(dashboardUserSearchTimeout);
      dashboardUserSearchTimeout = null;
    }
  }

  $: if ($isAuthenticated && !currentUserFullName) {
    loadCurrentUserFullName();
  }
  $: if ($isAuthenticated && currentUserId && dashboardLoadedForUser !== currentUserId && !dashboardLoading) {
    loadDashboardData();
    setupDashboardChannels(currentUserId);
  }
  $: if (!$isAuthenticated) {
    teardownDashboardChannels();
    dashboardConversations = [];
    dashboardNotifications = [];
    dashboardFollowedProfiles = [];
    dashboardFollowerProfiles = [];
    dashboardFollowedItems = [];
    dashboardLatestDownloads = [];
    dashboardRecentItems = [];
    dashboardFavoriteItems = [];
    dashboardLikedItems = [];
    dashboardPriorityFeed = [];
    dashboardUnreadCount = 0;
    dashboardLoadedForUser = '';
    dashboardHeroBackdrop = null;
    clearDashboardUserSearch();
  }
  $: homeJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: 'Culoca',
        url: 'https://culoca.com',
        description: 'GPS-basierte Plattform zum Entdecken und Teilen von Fotos, Events, Firmen und mehr.',
        potentialAction: {
          '@type': 'SearchAction',
          target: 'https://culoca.com/foto?suche={search_term_string}',
          'query-input': 'required name=search_term_string'
        }
      },
      buildBreadcrumbJsonLd([{ name: 'Culoca', path: '/' }])
    ]
  };

  afterNavigate(() => {
    if (browser) savedLocation = readRememberedLocation();
  });

  onMount(() => {
    savedLocation = readRememberedLocation();
    if (browser) {
      const p = get(page).url.searchParams;
      if (p.get('chatWith') || p.get('conversation')) {
        const qs = p.toString();
        void goto(qs ? `/chat?${qs}` : '/chat', { replaceState: true });
        return;
      }
    }
    if ($isAuthenticated) {
      loadCurrentUserFullName();
      loadDashboardData();
    }
  });

  onDestroy(() => {
    teardownDashboardChannels();
    if (dashboardUserSearchTimeout) {
      clearTimeout(dashboardUserSearchTimeout);
    }
  });
</script>

<svelte:head>
  <title>Culoca: Fotos, Orte, Themen und lokale Inhalte</title>
  <meta name="description" content={trimText('Culoca verbindet Fotos, Orte, Themen und lokale Inhalte in indexierbaren Hubs. Entdecke Bilder, Events, Firmen und Detailseiten mit klarer interner Verlinkung.')} />
  <meta name="keywords" content="GPS, Fotos, Events, Firmen, Galerie, lokale Suche, Culoca, Standort, Entdecken" />
  <link rel="canonical" href="https://culoca.com/" />
  <meta name="robots" content="index, follow" />

  <meta property="og:locale" content="de_DE" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Culoca: Fotos, Orte, Themen und lokale Inhalte" />
  <meta property="og:description" content="Indexierbare Hubs für Fotos, Orte, Schlagworte, Events und Fotografen auf Culoca." />
  <meta property="og:url" content="https://culoca.com/" />
  <meta property="og:site_name" content="Culoca" />
  <meta property="og:image" content={DEFAULT_OG_IMAGE} />
  <meta name="twitter:card" content="summary_large_image" />

  {@html `<script type="application/ld+json">${JSON.stringify(homeJsonLd)}</script>`}
</svelte:head>

<div class="page">
  <SiteNav />

  <main>
    {#if $isAuthenticated}
      <section
        class="hero dashboard-hero"
        class:dashboard-hero--has-backdrop={!!dashboardHeroBackdrop}
      >
        {#if dashboardHeroBackdrop}
          <a
            href={dashboardHeroBackdrop.href}
            class="dashboard-hero-bg"
            data-sveltekit-preload-data="hover"
            aria-label={dashboardHeroBackdrop.source === 'visit'
              ? dashboardHeroBackdrop.title
                ? `Zuletzt angesehen: ${dashboardHeroBackdrop.title}`
                : 'Zum zuletzt angesehenen Inhalt'
              : dashboardHeroBackdrop.title
                ? `Zuletzt hochgeladen: ${dashboardHeroBackdrop.title}`
                : 'Zum zuletzt hochgeladenen Inhalt'}
          >
            <img
              src={dashboardHeroBackdrop.imageUrl}
              alt=""
              width="2048"
              height="1152"
              decoding="async"
              fetchpriority="high"
            />
          </a>
          <div class="dashboard-hero-scrim" aria-hidden="true"></div>
        {/if}
        <div class="hero-inner dashboard-hero-inner">
          <div class="hero-layout hero-layout--dashboard">
            <div class="hero-copy">
              <p class="hero-greeting-line">Hallo,</p>
              {#if currentUserFullName}
                <h1 class="hero-dashboard-name">{currentUserFullName}</h1>
              {/if}
              <p class="hero-dashboard-lede">Dein Culoca Dashboard zeigt dir einen schnellen Überblick.</p>
              <div class="hero-dash-actions">
                <a href="/chat" class="btn-secondary">Nachrichten</a>
                <a href="/galerie" class="btn-primary">Galerie</a>
                <a href={publicProfileHref} class="btn-secondary">Öffentliches Profil</a>
              </div>
              <div class="dashboard-tabs" role="tablist" aria-label="Dashboard-Fokus">
                <button type="button" class="dashboard-tab" class:is-active={activeDashboardView === 'all'} on:click={() => (activeDashboardView = 'all')}>
                  <span>Alle</span>
                  <strong>{dashboardTabCounts.all}</strong>
                </button>
                <button type="button" class="dashboard-tab" class:is-active={activeDashboardView === 'inbox'} on:click={() => (activeDashboardView = 'inbox')}>
                  <span>Inbox</span>
                  <strong>{dashboardTabCounts.inbox}</strong>
                </button>
                <button type="button" class="dashboard-tab" class:is-active={activeDashboardView === 'creator'} on:click={() => (activeDashboardView = 'creator')}>
                  <span>Creator</span>
                  <strong>{dashboardTabCounts.creator}</strong>
                </button>
                <button type="button" class="dashboard-tab" class:is-active={activeDashboardView === 'network'} on:click={() => (activeDashboardView = 'network')}>
                  <span>Netzwerk</span>
                  <strong>{dashboardTabCounts.network}</strong>
                </button>
              </div>
            </div>
            <aside class="hero-side surface-responsive surface-responsive--panel">
              <section class="hero-side-section">
                <span class="hero-side-kicker">Standort</span>
                <h2>
                  {savedLocation?.source === 'gps'
                    ? 'Live-Standort aktiv'
                    : savedLocation
                      ? 'Location manuell gesetzt'
                      : 'Standort freigeben'}
                </h2>
                <p>
                  {#if savedLocation?.source === 'gps'}
                    Culoca nutzt deinen aktuellen Live-Standort und kann Inhalte, Distanzen und Sortierung laufend an deine Position anpassen.
                  {:else if savedLocation}
                    Bei einem manuell gesetzten Location Punkt, wird der Standort nicht verändert. Die mobile Galerie kann daher nicht verwendet werden.
                  {:else}
                    Ohne Standort kann nur nach Aktualität, aber nicht nach Entfernungen oder Locations gefiltert werden. Mit Standort Festlegung oder Live Standort wird Culoca interaktiv und zeigt dir zuerst Inhalte in der gewünschten Umgebung an.
                  {/if}
                </p>
                {#if savedLocation}
                  <div class="hero-location-status">
                    <strong>{savedLocation.label || 'Standort gespeichert'}</strong>
                    <p class="hero-coords">{savedLocation.lat.toFixed(5)}, {savedLocation.lon.toFixed(5)}</p>
                    <div class="hero-location-map">
                      <iframe
                        src={locationPreviewUrl}
                        title="Kartenausschnitt des aktuell verwendeten Standorts"
                        loading="lazy"
                        referrerpolicy="no-referrer-when-downgrade"
                      ></iframe>
                    </div>
                  </div>
                {/if}
                <div class="hero-side-actions">
                  <a href="/standort?returnTo=%2F" class="btn-primary hero-wide-btn" class:btn-attention={!savedLocation}>
                    {savedLocation ? 'Standortfreigabe ändern' : 'Standort jetzt festlegen'}
                  </a>
                </div>
              </section>
            </aside>
          </div>
        </div>
      </section>

      <section class="dashboard">
        <div class="dashboard-page-layout">
          <div class="dashboard-page-layout__main">
            <div class="dashboard-inner">
          <div class="dashboard-top-stack">
            {#if showDashboardUserSearch()}
              <section class="dashboard-search" id="profile-finden">
                <div class="dashboard-panel__head">
                  <div>
                    <span class="dashboard-kicker">Netzwerk</span>
                    <h2>Profile finden</h2>
                  </div>
                  <a href="/chat">Zum Chat</a>
                </div>

                <div class="dashboard-search__bar">
                  <input
                    class="dashboard-search__input"
                    type="search"
                    bind:value={dashboardUserSearchQuery}
                    on:input={handleDashboardUserSearchInput}
                    placeholder="Name, @accountname oder Organisation suchen"
                    autocomplete="off"
                    spellcheck="false"
                  />
                  {#if dashboardUserSearchQuery}
                    <button type="button" class="dashboard-search__clear" on:click={clearDashboardUserSearch}>
                      Zurücksetzen
                    </button>
                  {/if}
                </div>

                {#if dashboardUserSearchLoading}
                  <p class="dashboard-empty">Profile werden gesucht...</p>
                {:else if dashboardUserSearchResults.length > 0}
                  <div class="dashboard-list">
                    {#each dashboardUserSearchResults as profile (profile.id)}
                      <div class="dashboard-entry dashboard-entry--static dashboard-entry--search">
                        {#if getAvatarUrl(profile)}
                          <img
                            class="dashboard-entry__thumb"
                            src={getAvatarUrl(profile)}
                            alt={profile.full_name || profile.accountname || 'Profil'}
                            width="64"
                            height="64"
                            loading="lazy"
                          />
                        {:else}
                          <div class="dashboard-entry__thumb dashboard-entry__thumb--fallback">
                            {(profile.full_name || profile.accountname || '?').slice(0, 1).toUpperCase()}
                          </div>
                        {/if}

                        <div class="dashboard-entry__body">
                          <div class="dashboard-entry__meta">
                            <strong>{profile.full_name || profile.accountname || 'Profil'}</strong>
                            {#if profile.accountname}
                              <span class="dashboard-entry__handle">@{profile.accountname}</span>
                            {/if}
                          </div>
                          <span class="dashboard-entry__context">Profil finden, folgen oder direkt schreiben</span>
                          <p>{profile.email || 'Öffentliches Profil und Direktnachrichten sind von hier aus erreichbar.'}</p>
                        </div>

                        <div class="dashboard-entry__actions">
                          <a class="dashboard-inline-action" href={`/chat?chatWith=${encodeURIComponent(profile.id)}`}>
                            Chat
                          </a>
                          {#if profile.accountname}
                            <a class="dashboard-inline-action" href={`/${encodeURIComponent(profile.accountname)}`}>
                              Profil
                            </a>
                          {/if}
                          <FollowButton
                            targetUserId={profile.id}
                            targetLabel={profile.full_name || profile.accountname || 'Profil'}
                            compact={true}
                          />
                        </div>
                      </div>
                    {/each}
                  </div>
                {:else if dashboardUserSearchMessage}
                  <p class="dashboard-empty">{dashboardUserSearchMessage}</p>
                {:else}
                  <p class="dashboard-empty">Suche nach Name, `@accountname` oder Organisation, um Chats zu starten oder Profile zu folgen.</p>
                {/if}
              </section>
            {/if}

            <section class="dashboard-priority">
              <div class="dashboard-panel__head">
                <div>
                  <span class="dashboard-kicker">Jetzt wichtig</span>
                  <h2>Priorisierte Übersicht</h2>
                </div>
                <a href="/chat">Zum Chat</a>
              </div>

              {#if dashboardLoading && filteredDashboardPriorityFeed.length === 0}
                <p class="dashboard-empty">Prioritäten werden geladen...</p>
              {:else if displayedPriorityFeed.length > 0}
                <div class="dashboard-priority-list">
                  {#each displayedPriorityFeed as entry (entry.id)}
                    <a class="dashboard-entry dashboard-entry--link" href={entry.href}>
                      {#if entry.thumbUrl}
                        <img
                          class="dashboard-entry__thumb"
                          src={entry.thumbUrl}
                          alt={entry.title}
                          width="64"
                          height="64"
                          loading="lazy"
                        />
                      {:else}
                        <div class="dashboard-entry__thumb dashboard-entry__thumb--fallback">
                          {entry.fallback}
                        </div>
                      {/if}

                      <div class="dashboard-entry__body">
                        <div class="dashboard-entry__meta">
                          <strong>{entry.title}</strong>
                          {#if entry.timestamp > 0}
                            {@const meta = formatMetaDateLines(entry.timestamp)}
                            {#if meta.date || meta.time}
                              <time class="dashboard-entry__datetime" datetime={meta.iso}>
                                {#if meta.date}<span class="dashboard-entry__date-line">{meta.date}</span>{/if}
                                {#if meta.time}<span class="dashboard-entry__time-line">{meta.time}</span>{/if}
                              </time>
                            {/if}
                          {/if}
                        </div>
                        <span class="dashboard-entry__context">{entry.subtitle}</span>
                        <p>{entry.preview}</p>
                      </div>
                    </a>
                  {/each}
                </div>
                {#if filteredDashboardPriorityFeed.length > 8}
                  <p class="dashboard-priority-more">
                    +{filteredDashboardPriorityFeed.length - 8} weitere in den Bereichen unten oder über die Tabs.
                  </p>
                {/if}
              {:else}
                <p class="dashboard-empty">Für diesen Fokus liegen aktuell noch keine priorisierten Einträge vor.</p>
              {/if}
            </section>
          </div>

          <div class="dashboard-grid">
            {#if showDashboardPanel('inbox')}
            <section class="dashboard-panel">
              <div class="dashboard-panel__head">
                <div>
                  <span class="dashboard-kicker">Aktivität</span>
                  <h2>Neue Reaktionen</h2>
                </div>
                <a href="/chat">{dashboardUnreadCount > 0 ? `${dashboardUnreadCount} neu` : 'Zum Chat'}</a>
              </div>

              {#if dashboardLoading && dashboardNotifications.length === 0}
                <p class="dashboard-empty">Aktivitäten werden geladen...</p>
              {:else if dashboardNotifications.length > 0}
                <div class="dashboard-list">
                  {#each dashboardNotifications as entry (entry.id)}
                    <a class="dashboard-entry dashboard-entry--link" href={getNotificationHref(entry)}>
                      {#if entry.item && getItemPreviewUrl(entry.item)}
                        <img
                          class="dashboard-entry__thumb"
                          src={getItemPreviewUrl(entry.item)}
                          alt={entry.item.title || entry.item.original_name || 'Item'}
                          width="64"
                          height="64"
                          loading="lazy"
                        />
                      {:else if getAvatarUrl(entry.actor)}
                        <img
                          class="dashboard-entry__thumb"
                          src={getAvatarUrl(entry.actor)}
                          alt={entry.actor?.full_name || entry.actor?.accountname || 'Profil'}
                          width="64"
                          height="64"
                          loading="lazy"
                        />
                      {:else}
                        <div class="dashboard-entry__thumb dashboard-entry__thumb--fallback">
                          {(entry.actor?.full_name || entry.actor?.accountname || '?').slice(0, 1).toUpperCase()}
                        </div>
                      {/if}

                      <div class="dashboard-entry__body">
                        <div class="dashboard-entry__meta">
                          <strong>{entry.actor?.full_name || entry.actor?.accountname || 'Jemand'}</strong>
                          {#if entry.created_at}
                            {@const meta = formatMetaDateLines(entry.created_at)}
                            {#if meta.date || meta.time}
                              <time class="dashboard-entry__datetime" datetime={meta.iso}>
                                {#if meta.date}<span class="dashboard-entry__date-line">{meta.date}</span>{/if}
                                {#if meta.time}<span class="dashboard-entry__time-line">{meta.time}</span>{/if}
                              </time>
                            {/if}
                          {/if}
                        </div>
                        <span class="dashboard-entry__context">{getNotificationLabel(entry)}</span>
                        <p>{truncate(getNotificationPreview(entry), 120)}</p>
                      </div>
                    </a>
                  {/each}
                </div>
              {:else}
                <p class="dashboard-empty">Noch keine neuen Reaktionen vorhanden.</p>
              {/if}
            </section>
            {/if}

            {#if showDashboardPanel('creator')}
            <section class="dashboard-panel">
              <div class="dashboard-panel__head">
                <div>
                  <span class="dashboard-kicker">Creator</span>
                  <h2>Letzte Downloads</h2>
                </div>
                <a href="/profile">Mehr</a>
              </div>

              {#if dashboardLoading && dashboardLatestDownloads.length === 0}
                <p class="dashboard-empty">Downloads werden geladen...</p>
              {:else if dashboardLatestDownloads.length > 0}
                <div class="dashboard-list">
                  {#each dashboardLatestDownloads as entry (entry.id)}
                    <a class="dashboard-entry dashboard-entry--link" href={entry.item ? getPublicItemHref(entry.item) : '/profile'}>
                      {#if entry.item && getItemPreviewUrl(entry.item)}
                        <img
                          class="dashboard-entry__thumb"
                          src={getItemPreviewUrl(entry.item)}
                          alt={entry.item.title || entry.item.original_name || 'Item'}
                          width="64"
                          height="64"
                          loading="lazy"
                        />
                      {:else if getAvatarUrl(entry.actor)}
                        <img
                          class="dashboard-entry__thumb"
                          src={getAvatarUrl(entry.actor)}
                          alt={entry.actor?.full_name || entry.actor?.accountname || 'Profil'}
                          width="64"
                          height="64"
                          loading="lazy"
                        />
                      {:else}
                        <div class="dashboard-entry__thumb dashboard-entry__thumb--fallback">
                          {(entry.actor?.full_name || entry.actor?.accountname || '?').slice(0, 1).toUpperCase()}
                        </div>
                      {/if}

                      <div class="dashboard-entry__body">
                        <div class="dashboard-entry__meta">
                          <strong>{entry.actor?.full_name || entry.actor?.accountname || 'Jemand'}</strong>
                          {#if entry.created_at}
                            {@const meta = formatMetaDateLines(entry.created_at)}
                            {#if meta.date || meta.time}
                              <time class="dashboard-entry__datetime" datetime={meta.iso}>
                                {#if meta.date}<span class="dashboard-entry__date-line">{meta.date}</span>{/if}
                                {#if meta.time}<span class="dashboard-entry__time-line">{meta.time}</span>{/if}
                              </time>
                            {/if}
                          {/if}
                        </div>
                        <span class="dashboard-entry__context">Download</span>
                        <p>{truncate(entry.item?.title || entry.item?.original_name || 'Einer deiner Inhalte wurde heruntergeladen', 120)}</p>
                      </div>
                    </a>
                  {/each}
                </div>
              {:else}
                <p class="dashboard-empty">Sobald jemand etwas von dir herunterlädt, erscheint es hier.</p>
              {/if}
            </section>

            <section class="dashboard-panel">
              <div class="dashboard-panel__head">
                <div class="dashboard-panel__head-title">
                  <svg
                    class="dashboard-panel__head-icon dashboard-panel__head-icon--clock"
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="9" fill="none" />
                    <path d="M12 12.5V8" />
                    <path d="M12 12.5l4 2.3" />
                    <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
                  </svg>
                  <div>
                    <span class="dashboard-kicker">Verlauf</span>
                    <h2>Zuletzt angesehen</h2>
                  </div>
                </div>
                <a href="/galerie">Galerie</a>
              </div>

              {#if dashboardLoading && dashboardRecentItems.length === 0}
                <p class="dashboard-empty">Zuletzt angesehene Einträge werden geladen...</p>
              {:else if dashboardRecentItems.length > 0}
                <div class="dashboard-list">
                  {#each dashboardRecentItems as item (item.id)}
                    <a class="dashboard-entry dashboard-entry--link" href={getPublicItemHref(item)}>
                      {#if getItemPreviewUrl(item)}
                        <img
                          class="dashboard-entry__thumb"
                          src={getItemPreviewUrl(item)}
                          alt={item.title || item.original_name || 'Item'}
                          width="64"
                          height="64"
                          loading="lazy"
                        />
                      {:else}
                        <div class="dashboard-entry__thumb dashboard-entry__thumb--fallback">
                          {(item.title || item.original_name || '?').slice(0, 1).toUpperCase()}
                        </div>
                      {/if}

                      <div class="dashboard-entry__body">
                        <div class="dashboard-entry__meta">
                          <strong>{item.title || item.original_name || 'Ohne Titel'}</strong>
                          {#if item.viewedAt}
                            {@const meta = formatMetaDateLines(item.viewedAt)}
                            {#if meta.date || meta.time}
                              <time class="dashboard-entry__datetime" datetime={meta.iso}>
                                {#if meta.date}<span class="dashboard-entry__date-line">{meta.date}</span>{/if}
                                {#if meta.time}<span class="dashboard-entry__time-line">{meta.time}</span>{/if}
                              </time>
                            {/if}
                          {/if}
                        </div>
                        <span class="dashboard-entry__context">Zuletzt angesehen</span>
                        <p>Eintrag erneut öffnen.</p>
                      </div>
                    </a>
                  {/each}
                </div>
              {:else}
                <p class="dashboard-empty">Inhalte, die du zuletzt angesehen hast, erscheinen hier.</p>
              {/if}
            </section>

            <section class="dashboard-panel">
              <div class="dashboard-panel__head">
                <div class="dashboard-panel__head-title">
                  <svg
                    class="dashboard-panel__head-icon"
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </svg>
                  <div>
                    <span class="dashboard-kicker">Gemerkt</span>
                    <h2>Merkliste</h2>
                  </div>
                </div>
                <a href="/galerie">Stöbern</a>
              </div>

              {#if dashboardLoading && dashboardFavoriteItems.length === 0}
                <p class="dashboard-empty">Merkliste wird geladen...</p>
              {:else if dashboardFavoriteItems.length > 0}
                <div class="dashboard-list">
                  {#each dashboardFavoriteItems as item (item.id)}
                    <a class="dashboard-entry dashboard-entry--link" href={getPublicItemHref(item)}>
                      {#if getItemPreviewUrl(item)}
                        <img
                          class="dashboard-entry__thumb"
                          src={getItemPreviewUrl(item)}
                          alt={item.title || item.original_name || 'Item'}
                          width="64"
                          height="64"
                          loading="lazy"
                        />
                      {:else}
                        <div class="dashboard-entry__thumb dashboard-entry__thumb--fallback">
                          {(item.title || item.original_name || '?').slice(0, 1).toUpperCase()}
                        </div>
                      {/if}

                      <div class="dashboard-entry__body">
                        <div class="dashboard-entry__meta">
                          <strong>{item.title || item.original_name || 'Ohne Titel'}</strong>
                          {#if item.favoritedAt}
                            {@const meta = formatMetaDateLines(item.favoritedAt)}
                            {#if meta.date || meta.time}
                              <time class="dashboard-entry__datetime" datetime={meta.iso}>
                                {#if meta.date}<span class="dashboard-entry__date-line">{meta.date}</span>{/if}
                                {#if meta.time}<span class="dashboard-entry__time-line">{meta.time}</span>{/if}
                              </time>
                            {/if}
                          {/if}
                        </div>
                        <span class="dashboard-entry__context">Gemerkt</span>
                        <p>Eintrag aus deiner Merkliste öffnen.</p>
                      </div>
                    </a>
                  {/each}
                </div>
              {:else}
                <p class="dashboard-empty">Noch keine gemerkten Einträge. Auf Item-Seiten mit „Merken“ vormerken.</p>
              {/if}
            </section>

            <section class="dashboard-panel">
              <div class="dashboard-panel__head">
                <div class="dashboard-panel__head-title">
                  <!-- Herz wie auf der Item-Seite (ImageControlsSection, Like aktiv) -->
                  <svg
                    class="dashboard-panel__head-icon dashboard-panel__head-icon--heart"
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    stroke="currentColor"
                    stroke-width="2.2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 20.5l-1.45-1.32C5.4 14.5 2 11.42 2 7.72 2 4.9 4.24 2.75 7.05 2.75c1.6 0 3.14.74 4.15 1.9 1.01-1.16 2.55-1.9 4.15-1.9C18.16 2.75 20.4 4.9 20.4 7.72c0 3.7-3.4 6.78-8.55 11.46L12 20.5z"
                    />
                  </svg>
                  <div>
                    <span class="dashboard-kicker">Likes</span>
                    <h2>Gefällt mir</h2>
                  </div>
                </div>
                <a href="/galerie">Stöbern</a>
              </div>

              {#if dashboardLoading && dashboardLikedItems.length === 0}
                <p class="dashboard-empty">Likes werden geladen...</p>
              {:else if dashboardLikedItems.length > 0}
                <div class="dashboard-list">
                  {#each dashboardLikedItems as item (item.id)}
                    <a class="dashboard-entry dashboard-entry--link" href={getPublicItemHref(item)}>
                      {#if getItemPreviewUrl(item)}
                        <img
                          class="dashboard-entry__thumb"
                          src={getItemPreviewUrl(item)}
                          alt={item.title || item.original_name || 'Item'}
                          width="64"
                          height="64"
                          loading="lazy"
                        />
                      {:else}
                        <div class="dashboard-entry__thumb dashboard-entry__thumb--fallback">
                          {(item.title || item.original_name || '?').slice(0, 1).toUpperCase()}
                        </div>
                      {/if}

                      <div class="dashboard-entry__body">
                        <div class="dashboard-entry__meta">
                          <strong>{item.title || item.original_name || 'Ohne Titel'}</strong>
                          {#if item.likedAt}
                            {@const meta = formatMetaDateLines(item.likedAt)}
                            {#if meta.date || meta.time}
                              <time class="dashboard-entry__datetime" datetime={meta.iso}>
                                {#if meta.date}<span class="dashboard-entry__date-line">{meta.date}</span>{/if}
                                {#if meta.time}<span class="dashboard-entry__time-line">{meta.time}</span>{/if}
                              </time>
                            {/if}
                          {/if}
                        </div>
                        <span class="dashboard-entry__context">Gefällt mir</span>
                        <p>Eintrag erneut öffnen.</p>
                      </div>
                    </a>
                  {/each}
                </div>
              {:else}
                <p class="dashboard-empty">Noch keine Likes. Auf Item-Seiten mit „Gefällt mir“ markieren.</p>
              {/if}
            </section>
            {/if}

            {#if showDashboardPanel('network')}
            <section class="dashboard-panel">
              <div class="dashboard-panel__head">
                <div class="dashboard-panel__head-title dashboard-panel__head-title--network">
                  <svg
                    class="dashboard-panel__head-icon"
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zM8 11c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zM8 13c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
                    />
                  </svg>
                  <div class="dashboard-panel__head-network-copy">
                    <span class="dashboard-kicker">Netzwerk</span>
                    <div class="dashboard-network-tabs" role="tablist" aria-label="Netzwerk">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={dashboardNetworkListMode === 'following'}
                        class="dashboard-network-tab"
                        class:is-active={dashboardNetworkListMode === 'following'}
                        on:click={() => (dashboardNetworkListMode = 'following')}
                      >
                        Du folgst <span class="dashboard-network-tab__count">({dashboardFollowedProfiles.length})</span>
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={dashboardNetworkListMode === 'followers'}
                        class="dashboard-network-tab"
                        class:is-active={dashboardNetworkListMode === 'followers'}
                        on:click={() => (dashboardNetworkListMode = 'followers')}
                      >
                        Follower <span class="dashboard-network-tab__count">({dashboardFollowerProfiles.length})</span>
                      </button>
                    </div>
                  </div>
                </div>
                <a href="/#profile-finden">Profile finden</a>
              </div>

              {#if dashboardLoading && dashboardNetworkProfiles.length === 0}
                <p class="dashboard-empty">Netzwerk wird geladen...</p>
              {:else if dashboardNetworkProfiles.length > 0}
                <div class="dashboard-list">
                  {#each dashboardNetworkProfiles as profile (profile.id)}
                    <a class="dashboard-entry dashboard-entry--link" href={`/chat?chatWith=${encodeURIComponent(profile.id)}`}>
                      {#if getAvatarUrl(profile)}
                        <img
                          class="dashboard-entry__thumb"
                          src={getAvatarUrl(profile)}
                          alt={profile.full_name || profile.accountname || 'Profil'}
                          width="64"
                          height="64"
                          loading="lazy"
                        />
                      {:else}
                        <div class="dashboard-entry__thumb dashboard-entry__thumb--fallback">
                          {(profile.full_name || profile.accountname || '?').slice(0, 1).toUpperCase()}
                        </div>
                      {/if}

                      <div class="dashboard-entry__body">
                        <div class="dashboard-entry__meta">
                          <strong>{profile.full_name || profile.accountname || 'Profil'}</strong>
                          <span class="dashboard-entry__handle">@{profile.accountname || 'profil'}</span>
                        </div>
                        <span class="dashboard-entry__context">Direktnachricht</span>
                        <p>Chat mit diesem Profil öffnen.</p>
                      </div>
                    </a>
                  {/each}
                </div>
              {:else}
                <p class="dashboard-empty">
                  {dashboardNetworkListMode === 'following'
                    ? 'Du folgst aktuell noch keinem Profil.'
                    : 'Noch keine Follower.'}
                </p>
              {/if}
            </section>

            <section class="dashboard-panel">
              <div class="dashboard-panel__head">
                <div>
                  <span class="dashboard-kicker">Feed</span>
                  <h2>Neu von Gefolgten</h2>
                </div>
                <a href="/galerie">Galerie</a>
              </div>

              {#if dashboardLoading && dashboardFollowedItems.length === 0}
                <p class="dashboard-empty">Neue Inhalte werden geladen...</p>
              {:else if dashboardFollowedItems.length > 0}
                <div class="dashboard-list">
                  {#each dashboardFollowedItems as item (item.id)}
                    <a class="dashboard-entry dashboard-entry--link" href={getPublicItemHref(item)}>
                      {#if getItemPreviewUrl(item)}
                        <img
                          class="dashboard-entry__thumb"
                          src={getItemPreviewUrl(item)}
                          alt={item.title || item.original_name || 'Item'}
                          width="64"
                          height="64"
                          loading="lazy"
                        />
                      {:else}
                        <div class="dashboard-entry__thumb dashboard-entry__thumb--fallback">
                          {(item.profile?.full_name || item.profile?.accountname || '?').slice(0, 1).toUpperCase()}
                        </div>
                      {/if}

                      <div class="dashboard-entry__body">
                        <div class="dashboard-entry__meta">
                          <strong>{item.title || item.original_name || 'Neuer Inhalt'}</strong>
                          {#if item.created_at}
                            {@const meta = formatMetaDateLines(item.created_at)}
                            {#if meta.date || meta.time}
                              <time class="dashboard-entry__datetime" datetime={meta.iso}>
                                {#if meta.date}<span class="dashboard-entry__date-line">{meta.date}</span>{/if}
                                {#if meta.time}<span class="dashboard-entry__time-line">{meta.time}</span>{/if}
                              </time>
                            {/if}
                          {/if}
                        </div>
                        <span class="dashboard-entry__context">
                          {item.profile?.full_name || item.profile?.accountname || 'Profil'}
                        </span>
                        <p>Öffentlichen Eintrag öffnen.</p>
                      </div>
                    </a>
                  {/each}
                </div>
              {:else}
                <p class="dashboard-empty">Neue öffentliche Inhalte deiner gefolgten Profile erscheinen hier.</p>
              {/if}
            </section>
            {/if}
          </div>

          <section class="dashboard-shortcuts">
            <a class="dashboard-shortcut" href="/chat">
              <strong>Chat</strong>
              <span>Direktnachrichten und Gespräche – zentral unter /chat.</span>
            </a>
            <a class="dashboard-shortcut" href="/galerie">
              <strong>Eigene Galerie</strong>
              <span>Deine Inhalte direkt in der Galerie öffnen.</span>
            </a>
            <a class="dashboard-shortcut" href={publicProfileHref}>
              <strong>Teilbarer Permalink</strong>
              <span>Öffentliche Galerie unter deinem Accountnamen prüfen.</span>
            </a>
          </section>
            </div>
          </div>

          {#if data.dashboardDiscover}
            <aside class="dashboard-page-layout__aside" aria-label="Aktuelle Termine, Fotos und Firmen">
              <HomeDashboardDiscover
                upcomingEvents={data.dashboardDiscover.upcomingEvents}
                latestPhotos={data.dashboardDiscover.latestPhotos}
                latestFirms={data.dashboardDiscover.latestFirms}
                referenceCoords={discoverDistanceCoords}
              />
            </aside>
          {/if}
        </div>
      </section>
    {:else}
      <section class="hero">
        <div class="hero-inner">
          <div class="hero-layout">
            <div class="hero-copy">
              <h1>
                <span class="hero-line">Entdecke deine Umgebung</span>
                <span class="hero-line hero-accent">durch GPS-Inhalte</span>
              </h1>
              <p class="hero-sub">
                Fotos, Events, Firmen und mehr - georeferenziert und aus deiner Umgebung.
                {#if data.totalItems > 0}
                  <span class="hero-count">Aktuell {data.totalItems.toLocaleString('de-DE')} Einträge.</span>
                {/if}
              </p>
              <p class="hero-seo-copy">
                Die Startseite ist der kuratierte Einstieg in die wichtigsten Content-Hubs von Culoca:
                Typseiten, Schlagwortseiten, Ortsbezug und Detailseiten sind sauber miteinander verknüpft.
              </p>
              <div class="hero-actions">
                <a href="/galerie" class={savedLocation?.source === 'gps' ? 'btn-secondary' : 'btn-primary'}>Galerie</a>
                {#if savedLocation?.source === 'gps'}
                  <a href="/galerie?mobile=true" class="btn-primary">Mobile Galerie</a>
                {/if}
                <a href="/map-view" class="btn-secondary">Kartenansicht</a>
              </div>
              <div class="hero-login-callout">
                <p>Mehr Funktionen, jetzt kostenfrei anmelden</p>
                <a href="/login?returnTo=%2F" class="btn-secondary btn-attention">Login</a>
              </div>
            </div>

            <aside class="hero-side surface-responsive surface-responsive--panel">
              <section class="hero-side-section">
                <span class="hero-side-kicker">Standort</span>
                <h2>{savedLocation?.source === 'gps' ? 'Live-Standort aktiv' : savedLocation ? 'Location manuell gesetzt' : 'Standort freigeben'}</h2>
                <p>
                  {#if savedLocation?.source === 'gps'}
                    Culoca nutzt deinen aktuellen Live-Standort und kann Inhalte, Distanzen und Sortierung laufend an deine Position anpassen.
                  {:else if savedLocation}
                    Bei einem manuell gesetzten Location Punkt, wird der Standort nicht verändert. Die mobile Galerie kann daher nicht verwendet werden.
                  {:else}
                    Ohne Standort kann nur nach Aktualität, aber nicht nach Entfernungen oder Locations gefiltert werden. Mit Standort Festlegung oder Live Standort wird Culoca interaktiv und zeigt dir zuerst Inhalte in der gewünschten Umgebung an.
                  {/if}
                </p>

                {#if savedLocation}
                  <div class="hero-location-status">
                    <strong>{savedLocation.label || 'Standort gespeichert'}</strong>
                    <div class="hero-location-map">
                      <iframe
                        src={locationPreviewUrl}
                        title="Kartenausschnitt des aktuell verwendeten Standorts"
                        loading="lazy"
                        referrerpolicy="no-referrer-when-downgrade"
                      ></iframe>
                    </div>
                  </div>
                {/if}

                <div class="hero-side-actions">
                  <a href="/standort?returnTo=%2F" class="btn-primary hero-wide-btn" class:btn-attention={!savedLocation}>
                    {savedLocation ? 'Standortfreigabe ändern' : 'Standort jetzt festlegen'}
                  </a>
                </div>
              </section>
            </aside>
          </div>
        </div>
      </section>

      <HomeTypeSectionsFeed sections={data.sections} />
    {/if}
  </main>

  <SiteFooter />
</div>

<style>
  .page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  main {
    flex: 1;
  }

  .dashboard {
    padding: 2rem 1rem 3rem;
  }

  .dashboard-page-layout {
    width: 100%;
    max-width: 1680px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
    gap: 1.25rem 1.75rem;
    align-items: start;
  }

  .dashboard-page-layout__main {
    min-width: 0;
  }

  .dashboard-page-layout__aside {
    min-width: 0;
    padding-top: 0.15rem;
  }

  .dashboard-top-stack {
    display: grid;
    gap: 1rem;
    align-items: start;
  }

  .dashboard-hero .hero-dash-actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-top: 1rem;
  }

  .dashboard-hero .dashboard-tabs {
    margin-top: 1.1rem;
  }

  /* Dashboard-Hero: letztes eigenes Upload-Bild, Vignette links-oben, volle Breite / zentriert / cover */
  .dashboard-hero {
    position: relative;
    overflow: hidden;
  }

  .dashboard-hero-bg {
    position: absolute;
    inset: 0;
    z-index: 0;
    text-decoration: none;
    color: inherit;
  }

  .dashboard-hero-bg:focus-visible {
    outline: 3px solid var(--culoca-orange, #ee7221);
    outline-offset: 2px;
    z-index: 3;
  }

  .dashboard-hero-bg img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center center;
    display: block;
    max-width: none;
  }

  .dashboard-hero-scrim {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    background: linear-gradient(
      128deg,
      rgba(6, 8, 14, 0.94) 0%,
      rgba(6, 8, 14, 0.62) 32%,
      rgba(6, 8, 14, 0.28) 58%,
      rgba(6, 8, 14, 0.12) 82%,
      rgba(6, 8, 14, 0.04) 100%
    );
  }

  .dashboard-hero-inner {
    position: relative;
    z-index: 2;
  }

  /* Klicks erreichen den Hintergrund-Link; interaktive Bereiche bleiben bedienbar */
  .dashboard-hero--has-backdrop .dashboard-hero-inner {
    pointer-events: none;
  }

  .dashboard-hero--has-backdrop .hero-dash-actions,
  .dashboard-hero--has-backdrop .hero-dash-actions a,
  .dashboard-hero--has-backdrop .dashboard-tabs,
  .dashboard-hero--has-backdrop .dashboard-tabs button,
  .dashboard-hero--has-backdrop .hero-side {
    pointer-events: auto;
  }

  .dashboard-hero--has-backdrop {
    min-height: min(48vh, 480px);
    background: var(--bg-primary);
  }

  .hero-greeting-line {
    margin: 0 0 0.35rem;
    font-size: 1.2rem;
    font-weight: 500;
    line-height: 1.35;
    color: var(--text-secondary);
  }

  .dashboard-hero--has-backdrop .hero-greeting-line {
    color: rgba(255, 255, 255, 0.92);
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
  }

  .hero-dashboard-name {
    margin: 0 0 0.65rem;
    font-size: clamp(1.85rem, 4.5vw, 2.85rem);
    font-weight: 800;
    line-height: 1.12;
    letter-spacing: -0.028em;
    color: var(--text-primary);
  }

  .dashboard-hero--has-backdrop .hero-dashboard-name {
    color: #fff;
    text-shadow: 0 2px 14px rgba(0, 0, 0, 0.35);
  }

  .hero-dashboard-lede {
    margin: 0 0 1.35rem;
    font-size: 1.05rem;
    line-height: 1.55;
    max-width: 36ch;
    color: var(--text-secondary);
  }

  .dashboard-hero--has-backdrop .hero-dashboard-lede {
    color: rgba(255, 255, 255, 0.9);
    text-shadow: 0 1px 6px rgba(0, 0, 0, 0.35);
  }

  .hero-coords {
    margin: 0.25rem 0 0;
    font-size: 0.82rem;
    font-family: ui-monospace, monospace;
    color: var(--text-secondary);
    word-break: break-all;
  }

  .dashboard-inner {
    width: 100%;
    display: grid;
    gap: 1.25rem;
  }

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .dashboard-header h1 {
    margin: 0;
    font-size: clamp(2rem, 4vw, 2.8rem);
    line-height: 1.05;
  }

  .dashboard-copy {
    margin: 0.35rem 0 0;
    color: var(--text-secondary);
    max-width: 54ch;
  }

  .dashboard-actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .dashboard-tabs {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .dashboard-tab {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.7rem 0.95rem;
    border-radius: 999px;
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font: inherit;
    cursor: pointer;
    transition: border-color 0.15s ease, transform 0.15s ease, color 0.15s ease;
  }

  .dashboard-tab:hover {
    transform: translateY(-1px);
    border-color: color-mix(in srgb, var(--culoca-orange) 30%, var(--border-color) 70%);
    color: var(--text-primary);
  }

  .dashboard-tab strong {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.5rem;
    height: 1.5rem;
    padding: 0 0.35rem;
    border-radius: 999px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.78rem;
  }

  .dashboard-tab.is-active {
    border-color: color-mix(in srgb, var(--culoca-orange) 45%, var(--border-color) 55%);
    background: color-mix(in srgb, var(--culoca-orange) 12%, var(--bg-secondary) 88%);
    color: var(--text-primary);
  }

  /* Einheitliches Innenpadding, damit Kicker/Titel aller Gruppen bündig starten */
  .dashboard-search {
    display: grid;
    gap: 1rem;
    align-content: start;
    padding: 1rem;
    border-radius: 22px;
    border: 1px solid color-mix(in srgb, var(--culoca-orange) 16%, var(--border-color) 84%);
    background:
      radial-gradient(circle at top right, rgba(238, 114, 33, 0.1), transparent 34%),
      color-mix(in srgb, var(--bg-secondary) 92%, white 8%);
  }

  .dashboard-search__bar {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .dashboard-search__input {
    flex: 1 1 420px;
    min-width: 240px;
    border-radius: 16px;
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-primary);
    padding: 0.9rem 1rem;
    font: inherit;
  }

  .dashboard-search__input:focus {
    outline: none;
    border-color: color-mix(in srgb, var(--culoca-orange) 48%, var(--border-color) 52%);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--culoca-orange) 14%, transparent 86%);
  }

  .dashboard-search__clear {
    border: 1px solid var(--border-color);
    border-radius: 999px;
    background: var(--bg-primary);
    color: var(--text-secondary);
    font: inherit;
    padding: 0.72rem 0.95rem;
    cursor: pointer;
  }

  .dashboard-search__clear:hover {
    color: var(--text-primary);
    border-color: color-mix(in srgb, var(--culoca-orange) 38%, var(--border-color) 62%);
  }

  .dashboard-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
    align-items: start;
  }

  .dashboard-priority {
    display: grid;
    gap: 1rem;
    align-content: start;
    padding: 1rem;
    border-radius: 22px;
    background:
      radial-gradient(circle at top right, rgba(238, 114, 33, 0.14), transparent 34%),
      color-mix(in srgb, var(--bg-secondary) 90%, white 10%);
    border: 1px solid color-mix(in srgb, var(--culoca-orange) 18%, var(--border-color) 82%);
  }

  .dashboard-priority-list {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
    align-items: start;
  }

  .dashboard-priority-more {
    margin: 0;
    font-size: 0.82rem;
    line-height: 1.4;
    color: var(--text-secondary);
  }

  .dashboard-panel {
    display: grid;
    gap: 1rem;
    align-content: start;
    padding: 1rem;
    border-radius: 20px;
    background: color-mix(in srgb, var(--bg-secondary) 88%, white 12%);
    border: 1px solid color-mix(in srgb, var(--culoca-orange) 10%, var(--border-color) 90%);
  }

  .dashboard-panel__head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }

  .dashboard-panel__head > div:first-child {
    min-width: 0;
  }

  .dashboard-panel__head-title {
    display: flex;
    align-items: flex-start;
    gap: 0.65rem;
    min-width: 0;
  }

  .dashboard-panel__head-icon {
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    margin-top: 0.12rem;
    color: var(--culoca-orange);
  }

  .dashboard-panel__head-title--network {
    align-items: flex-start;
  }

  .dashboard-panel__head-network-copy {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 0;
  }

  .dashboard-network-tabs {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem 1.15rem;
  }

  .dashboard-network-tab {
    margin: 0;
    padding: 0 0 0.15rem;
    border: none;
    border-bottom: 2px solid transparent;
    background: none;
    font: inherit;
    font-size: 1.05rem;
    font-weight: 600;
    line-height: 1.3;
    cursor: pointer;
    color: var(--text-secondary);
  }

  .dashboard-network-tab__count {
    font-weight: 600;
  }

  .dashboard-network-tab:hover,
  .dashboard-network-tab:hover .dashboard-network-tab__count {
    color: var(--culoca-orange);
  }

  .dashboard-network-tab.is-active,
  .dashboard-network-tab.is-active .dashboard-network-tab__count {
    color: var(--culoca-orange);
    border-bottom-color: var(--culoca-orange);
  }

  .dashboard-panel__head h2 {
    margin: 0.15rem 0 0;
    font-size: 1.15rem;
  }

  .dashboard-panel__head a {
    color: var(--culoca-orange);
    text-decoration: none;
    white-space: nowrap;
  }

  .dashboard-kicker {
    display: inline-block;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-size: 0.72rem;
    color: var(--text-secondary);
  }

  .dashboard-list {
    display: grid;
    gap: 0.75rem;
  }

  .dashboard-entry {
    width: 100%;
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 0.85rem;
    align-items: center;
    border-radius: 16px;
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    padding: 0.75rem;
    color: inherit;
    text-align: left;
    text-decoration: none;
  }

  .dashboard-entry--static {
    cursor: default;
  }

  .dashboard-entry--search {
    grid-template-columns: 64px minmax(0, 1fr) auto;
  }

  .dashboard-entry__thumb {
    width: 64px;
    height: 64px;
    border-radius: 14px;
    object-fit: cover;
    background: var(--bg-tertiary);
  }

  .dashboard-entry__thumb--fallback {
    display: grid;
    place-items: center;
    font-weight: 700;
    color: var(--culoca-orange);
  }

  .dashboard-entry__body {
    min-width: 0;
    display: grid;
    gap: 0.18rem;
  }

  .dashboard-entry__meta {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.5rem 0.75rem;
    min-width: 0;
  }

  .dashboard-entry__meta strong {
    flex: 1 1 0%;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Datum + Uhrzeit gestapelt: schmale rechte Spalte, Titel darf Ellipsis nutzen */
  .dashboard-entry__datetime {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.08rem;
    line-height: 1.15;
    font-size: 0.8rem;
    color: var(--text-secondary);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .dashboard-entry__date-line,
  .dashboard-entry__time-line {
    display: block;
  }

  /* @accountname neben dem Namen */
  .dashboard-entry__handle {
    flex: 0 1 auto;
    max-width: 40%;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-secondary);
    font-size: 0.85rem;
    text-align: right;
  }

  .dashboard-entry__body p,
  .dashboard-entry__context {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dashboard-entry__context {
    color: var(--text-secondary);
    font-size: 0.85rem;
  }

  .dashboard-entry__body p {
    margin: 0;
  }

  .dashboard-entry__actions {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: center;
  }

  .dashboard-inline-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.62rem 0.92rem;
    border-radius: 999px;
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-primary);
    text-decoration: none;
    font-weight: 600;
  }

  .dashboard-inline-action:hover {
    border-color: color-mix(in srgb, var(--culoca-orange) 38%, var(--border-color) 62%);
  }

  .dashboard-empty {
    margin: 0;
    color: var(--text-secondary);
  }

  .dashboard-shortcuts {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
  }

  .dashboard-shortcut {
    display: grid;
    gap: 0.35rem;
    padding: 1rem;
    border-radius: 18px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 88%, white 12%), var(--bg-secondary));
    border: 1px solid var(--border-color);
    color: inherit;
    text-decoration: none;
  }

  .dashboard-shortcut span {
    color: var(--text-secondary);
  }

  /* ---- Hero ---- */
  .hero {
    position: relative;
    overflow: hidden;
    background:
      radial-gradient(ellipse 70% 60% at 80% 40%, rgba(238, 114, 33, 0.07) 0%, transparent 100%),
      var(--bg-primary);
  }
  .hero-inner {
    padding: 3rem 2rem 3rem;
  }
  .hero-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.75fr);
    gap: 1.5rem;
    align-items: stretch;
  }
  .hero-copy {
    min-width: 0;
  }
  .hero h1 {
    font-size: clamp(2.2rem, 5vw, 3.5rem);
    font-weight: 800;
    line-height: 1.15;
    letter-spacing: -0.025em;
    margin: 0 0 1.25rem;
  }
  .hero-greeting {
    margin: 0 0 0.6rem;
    font-size: 1.4rem;
    font-weight: 500;
    line-height: 1.4;
    color: #ffffff;
  }
  .hero-line {
    display: block;
  }
  .hero-accent {
    background: linear-gradient(135deg, var(--culoca-orange) 0%, #f5a623 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .hero-sub {
    max-width: 520px;
    font-size: 1.1rem;
    line-height: 1.6;
    color: var(--text-secondary);
    margin: 0 0 2rem;
  }
  .hero-count {
    white-space: nowrap;
    color: var(--text-muted);
  }
  .hero-actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-top: 1rem;
  }
  .hero-login-callout {
    display: grid;
    justify-items: start;
    gap: 1rem;
    margin-top: 1.5rem;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
  }
  .hero-login-callout p {
    margin: 0;
    font-size: 0.92rem;
    line-height: 1.45;
    color: var(--text-muted);
    white-space: nowrap;
  }
  .hero-side {
    display: grid;
    gap: 1rem;
    align-self: stretch;
  }
  .hero-side-section {
    display: grid;
    gap: 0.75rem;
  }
  .hero-side-kicker {
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--culoca-orange);
  }
  .hero-side h2 {
    margin: 0;
    font-size: 1.35rem;
    line-height: 1.2;
    color: var(--text-primary);
  }
  .hero-side p {
    margin: 0;
    color: var(--text-secondary);
    line-height: 1.6;
  }
  .hero-side-actions {
    display: grid;
    gap: 0.75rem;
  }
  .hero-wide-btn {
    width: 100%;
    justify-content: center;
  }
  .hero-location-status {
    display: grid;
    gap: 0.65rem;
    padding: 0;
    border-radius: 0;
    background: transparent;
    border: 0;
    color: var(--text-secondary);
  }
  .hero-location-map {
    min-height: 184px;
    overflow: hidden;
    border-radius: 12px;
    border: 1px solid color-mix(in srgb, var(--border-color) 80%, white 20%);
    background: var(--bg-secondary);
  }
  .hero-location-map iframe {
    display: block;
    width: 100%;
    height: 184px;
    border: 0;
  }

  .btn-primary,
  .btn-secondary {
    display: inline-flex;
    align-items: center;
    padding: 0.7rem 1.5rem;
    font-size: 0.95rem;
    font-weight: 600;
    border-radius: 10px;
    text-decoration: none;
    transition: transform 0.15s, box-shadow 0.15s, background 0.15s;
  }
  .btn-primary {
    background: var(--culoca-orange);
    color: #fff;
    box-shadow: 0 2px 12px rgba(238, 114, 33, 0.3);
  }
  .btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 20px rgba(238, 114, 33, 0.4);
  }
  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  .btn-secondary:hover {
    background: var(--border-color);
    transform: translateY(-1px);
  }
  .btn-attention {
    animation: heroPulse 2.4s ease-in-out infinite;
    box-shadow:
      0 0 0 0 rgba(238, 114, 33, 0.4),
      0 0 28px rgba(238, 114, 33, 0.2);
  }
  @keyframes heroPulse {
    0% {
      transform: translateY(0);
      box-shadow:
        0 0 0 0 rgba(238, 114, 33, 0.45),
        0 0 18px rgba(238, 114, 33, 0.16);
    }
    50% {
      transform: translateY(-1px);
      box-shadow:
        0 0 0 10px rgba(238, 114, 33, 0),
        0 0 34px rgba(238, 114, 33, 0.28);
    }
    100% {
      transform: translateY(0);
      box-shadow:
        0 0 0 0 rgba(238, 114, 33, 0),
        0 0 18px rgba(238, 114, 33, 0.16);
    }
  }

  /* ---- Responsive ---- */
  @media (max-width: 960px) {
    .dashboard-grid,
    .dashboard-shortcuts {
      grid-template-columns: 1fr;
    }

    .dashboard-entry--search {
      grid-template-columns: 64px minmax(0, 1fr);
    }

    .dashboard-entry__actions {
      grid-column: 1 / -1;
      justify-content: flex-start;
    }

    .hero-layout {
      grid-template-columns: 1fr;
    }
    .hero-location-map {
      min-height: 170px;
    }
    .hero-location-map iframe {
      height: 170px;
    }

    .dashboard-page-layout {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 680px) {
    .dashboard {
      padding: 1.5rem 1rem 2.5rem;
    }

    .hero-inner {
      padding: 3.5rem 1.25rem 2.5rem;
    }
  }
  @media (max-width: 420px) {
    .dashboard-entry {
      grid-template-columns: 56px minmax(0, 1fr);
      gap: 0.7rem;
    }

    .dashboard-entry__thumb {
      width: 56px;
      height: 56px;
    }

    .hero h1 {
      font-size: 1.8rem;
    }
    .hero-sub {
      font-size: 1rem;
    }
  }
</style>
