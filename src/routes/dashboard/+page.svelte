<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import SiteNav from '$lib/SiteNav.svelte';
  import SiteFooter from '$lib/SiteFooter.svelte';
  import { supabase } from '$lib/supabaseClient';
  import { getPublicItemHref } from '$lib/content/routing';
  import { getSeoImageUrl } from '$lib/utils/seoImageUrl';
  import { fetchProfileReviewItems } from '$lib/profile/review';
  import { authFetch } from '$lib/authFetch';

  const PAGE_SIZE = 12;

  const DASHBOARD_SECTION_IDS = [
    'recent',
    'photos',
    'stock',
    'events',
    'favorites',
    'likes',
    'notifications',
    'interactions',
    'following',
    'followers',
    'shares',
    'review'
  ] as const;

  type DashboardSectionId = (typeof DASHBOARD_SECTION_IDS)[number];

  function isDashboardSectionId(v: string): v is DashboardSectionId {
    return (DASHBOARD_SECTION_IDS as readonly string[]).includes(v);
  }

  type DashboardSecondaryKey =
    | 'events'
    | 'favorites'
    | 'likes'
    | 'network'
    | 'shares'
    | 'notifications'
    | 'interactions'
    | 'review';

  const SECONDARY_KEY_ORDER: DashboardSecondaryKey[] = [
    'events',
    'favorites',
    'likes',
    'network',
    'shares',
    'notifications',
    'interactions',
    'review'
  ];

  let currentUserId = '';
  let loading = true;
  let restLoading = true;
  let loadingItems = false;
  let errorMessage = '';
  let recentItems: any[] = [];
  let allItems: any[] = [];
  let searchQuery = '';
  let activeQuery = '';
  let currentPage = 1;
  let totalItems = 0;
  let historyBusy = false;
  let activeSection: DashboardSectionId = 'recent';
  let unreadChats: any[] = [];
  let interactions: any[] = [];
  let reviewCount = 0;
  let favoriteItems: any[] = [];
  let likedItems: any[] = [];
  let eventItems: any[] = [];
  let followedProfiles: any[] = [];
  let followerProfiles: any[] = [];
  let sharedItemRights: any[] = [];
  let globalProfileRights: any[] = [];
  let networkBusy = false;
  let followingSearchQuery = '';
  let followingSearchResults: any[] = [];
  let followingSearchBusy = false;
  let contentSectionEl: HTMLElement | null = null;

  /** Entwurf pro Item-ID für Stock-URL / Asset-ID (Dashboard). */
  let stockEdits: Record<string, { url: string; assetId: string }> = {};
  let stockActionBusy: Record<string, 'save' | 'upload' | 'reset' | undefined> = {};
  let stockFlash: Record<string, string> = {};

  $: totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  $: canPrev = currentPage > 1;
  $: canNext = currentPage < totalPages;

  /** Hinweise im Menü: Fehler, Review, Upload-Probleme. */
  $: stockAttentionCount = allItems.filter(
    (it: any) =>
      (it.adobe_stock_error && String(it.adobe_stock_error).trim()) ||
      it.adobe_stock_status === 'pending_review' ||
      it.adobe_stock_status === 'error'
  ).length;

  function mergeStockItemIntoList(updated: any) {
    allItems = allItems.map((it: any) =>
      it.id === updated.id
        ? { ...it, ...updated, stats: it.stats, stock_settings: updated.stock_settings ?? it.stock_settings }
        : it
    );
    stockEdits = {
      ...stockEdits,
      [updated.id]: {
        url: updated.adobe_stock_url || '',
        assetId: updated.adobe_stock_asset_id || ''
      }
    };
  }

  function extractAdobeAssetIdFromUrl(url: string): string {
    const match = url.trim().match(/\/(\d+)(?:[/?#]|$)/);
    return match ? match[1] : '';
  }

  async function saveDashboardStock(item: any) {
    const d = stockEdits[item.id];
    if (!d) return;
    const normalizedUrl = d.url.trim();
    const inferredId = d.assetId.trim() || extractAdobeAssetIdFromUrl(normalizedUrl);
    const nextStatus = normalizedUrl
      ? item.adobe_stock_status === 'none'
        ? 'uploaded'
        : item.adobe_stock_status
      : 'none';
    stockActionBusy = { ...stockActionBusy, [item.id]: 'save' };
    stockFlash = { ...stockFlash, [item.id]: '' };
    try {
      const res = await authFetch(`/api/item/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adobe_stock_url: normalizedUrl || null,
          adobe_stock_asset_id: inferredId || null,
          adobe_stock_status: nextStatus
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        stockFlash = { ...stockFlash, [item.id]: data?.error || 'Speichern fehlgeschlagen' };
        return;
      }
      if (data?.item) mergeStockItemIntoList(data.item);
      stockFlash = { ...stockFlash, [item.id]: 'Gespeichert' };
      d.assetId = inferredId;
    } finally {
      const next = { ...stockActionBusy };
      delete next[item.id];
      stockActionBusy = next;
    }
  }

  async function uploadDashboardStock(item: any) {
    stockActionBusy = { ...stockActionBusy, [item.id]: 'upload' };
    stockFlash = { ...stockFlash, [item.id]: '' };
    try {
      const res = await authFetch(`/api/adobe-stock/upload/${item.id}`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        stockFlash = { ...stockFlash, [item.id]: data?.error || 'Upload fehlgeschlagen' };
        return;
      }
      if (data?.item) mergeStockItemIntoList(data.item);
      stockFlash = { ...stockFlash, [item.id]: data?.message || 'Upload gestartet' };
    } finally {
      const next = { ...stockActionBusy };
      delete next[item.id];
      stockActionBusy = next;
    }
  }

  async function resetDashboardStockAdobe(item: any) {
    stockActionBusy = { ...stockActionBusy, [item.id]: 'reset' };
    stockFlash = { ...stockFlash, [item.id]: '' };
    try {
      const res = await authFetch(`/api/item/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adobe_stock_status: 'none',
          adobe_stock_uploaded_at: null,
          adobe_stock_asset_id: null,
          adobe_stock_url: null,
          adobe_stock_error: null
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        stockFlash = { ...stockFlash, [item.id]: data?.error || 'Zurücksetzen fehlgeschlagen' };
        return;
      }
      if (data?.item) mergeStockItemIntoList(data.item);
      stockFlash = { ...stockFlash, [item.id]: 'Adobe-Eintrag zurückgesetzt' };
    } finally {
      const next = { ...stockActionBusy };
      delete next[item.id];
      stockActionBusy = next;
    }
  }

  $: {
    const next = { ...stockEdits };
    let changed = false;
    for (const item of allItems) {
      if (!next[item.id]) {
        next[item.id] = {
          url: item.adobe_stock_url || '',
          assetId: item.adobe_stock_asset_id || ''
        };
        changed = true;
      }
    }
    if (changed) stockEdits = next;
  }

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

  function formatDateTime(value: string | null | undefined): string {
    if (!value) return '';
    try {
      return new Date(value).toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  }

  function getItemThumb(item: any): string {
    return item?.slug && item?.path_512 ? getSeoImageUrl(item.slug, item.path_512, '512') : '';
  }

  function getChatActor(entry: any): string {
    return entry?.otherUser?.full_name || entry?.otherUser?.accountname || 'Chat';
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

  function getInteractionIconKind(entry: any): 'download' | 'favorite' | 'like' | 'comment' | 'chat' | 'default' {
    switch (entry?.event_type) {
      case 'download':
        return 'download';
      case 'favorite_add':
        return 'favorite';
      case 'like_add':
        return 'like';
      case 'comment_create':
      case 'comment_hide':
      case 'comment_restore':
        return 'comment';
      case 'chat_message':
        return 'chat';
      default:
        return 'default';
    }
  }

  function buildCountMap(rows: Array<{ item_id?: string | null }>): Record<string, number> {
    const result: Record<string, number> = {};
    for (const row of rows || []) {
      const key = row?.item_id;
      if (!key) continue;
      result[key] = (result[key] || 0) + 1;
    }
    return result;
  }

  function getRightsText(rightsObj: any): string {
    const rightsList = [];
    if (rightsObj?.download) rightsList.push('Download');
    if (rightsObj?.edit) rightsList.push('Bearbeiten');
    if (rightsObj?.delete) rightsList.push('Löschen');
    return rightsList.length > 0 ? rightsList.join(', ') : 'Keine Rechte';
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
    const ok = window.confirm('Möchtest du deinen gesamten Verlauf wirklich löschen?');
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
      errorMessage = error?.message || 'Verlauf konnte nicht gelöscht werden.';
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
        'id, slug, title, original_name, canonical_path, country_slug, district_slug, municipality_slug, path_512, created_at, updated_at, adobe_stock_status, adobe_stock_uploaded_at, adobe_stock_asset_id, adobe_stock_url, adobe_stock_error, stock_settings',
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

    const items = data || [];
    const itemIds = items.map((item: any) => item.id).filter(Boolean);

    if (itemIds.length > 0) {
      const [
        { data: viewRows, error: viewsError },
        { data: downloadRows, error: downloadsError },
        { data: likeRows, error: likesError },
        { data: favoriteRows, error: favoritesError }
      ] = await Promise.all([
        supabase.from('item_events').select('item_id').eq('event_type', 'item_view').in('item_id', itemIds),
        supabase.from('item_events').select('item_id').eq('event_type', 'download').in('item_id', itemIds),
        supabase.from('item_likes').select('item_id').in('item_id', itemIds),
        supabase.from('item_favorites').select('item_id').in('item_id', itemIds)
      ]);

      if (viewsError) throw viewsError;
      if (downloadsError) throw downloadsError;
      if (likesError) throw likesError;
      if (favoritesError) throw favoritesError;

      const viewsByItem = buildCountMap((viewRows as Array<{ item_id?: string | null }>) || []);
      const downloadsByItem = buildCountMap((downloadRows as Array<{ item_id?: string | null }>) || []);
      const likesByItem = buildCountMap((likeRows as Array<{ item_id?: string | null }>) || []);
      const favoritesByItem = buildCountMap((favoriteRows as Array<{ item_id?: string | null }>) || []);

      allItems = items.map((item: any) => ({
        ...item,
        stats: {
          views: viewsByItem[item.id] || 0,
          likes: likesByItem[item.id] || 0,
          favorites: favoritesByItem[item.id] || 0,
          downloads: downloadsByItem[item.id] || 0
        }
      }));
    } else {
      allItems = [];
    }

    totalItems = count || 0;
    currentPage = page;
    loadingItems = false;
  }

  async function loadEventItems() {
    const { data, error } = await supabase
      .from('items')
      .select(
        'id, slug, title, original_name, canonical_path, country_slug, district_slug, municipality_slug, path_512, created_at, updated_at, type_id'
      )
      .eq('profile_id', currentUserId)
      .eq('type_id', 2)
      .eq('admin_hidden', false)
      .is('group_root_item_id', null)
      .not('slug', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    eventItems = data || [];
  }

  async function loadFavoriteItems() {
    const { data, error } = await supabase
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
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    favoriteItems = (data || []).map((entry: any) => ({
      favoritedAt: entry.created_at,
      ...(entry.items || {})
    }));
  }

  async function loadLikedItems() {
    const { data, error } = await supabase
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
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    likedItems = (data || []).map((entry: any) => ({
      likedAt: entry.created_at,
      ...(entry.items || {})
    }));
  }

  async function loadNetworkProfiles() {
    const [{ data: followsOutData, error: followsOutError }, { data: followsInData, error: followsInError }] =
      await Promise.all([
        supabase
          .from('user_follows')
          .select('followed_user_id, created_at')
          .eq('follower_user_id', currentUserId)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('user_follows')
          .select('follower_user_id, created_at')
          .eq('followed_user_id', currentUserId)
          .order('created_at', { ascending: false })
          .limit(100)
      ]);

    if (followsOutError) throw followsOutError;
    if (followsInError) throw followsInError;

    const followedIds = [...new Set((followsOutData || []).map((entry: any) => entry.followed_user_id).filter(Boolean))];
    const followerIds = [...new Set((followsInData || []).map((entry: any) => entry.follower_user_id).filter(Boolean))];

    if (followedIds.length > 0) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, accountname, avatar_url, website')
        .in('id', followedIds);
      if (error) throw error;
      const byId = new Map((data || []).map((entry: any) => [entry.id, entry]));
      followedProfiles = followedIds.map((id) => byId.get(id)).filter(Boolean);
    } else {
      followedProfiles = [];
    }

    if (followerIds.length > 0) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, accountname, avatar_url, website')
        .in('id', followerIds);
      if (error) throw error;
      const byId = new Map((data || []).map((entry: any) => [entry.id, entry]));
      followerProfiles = followerIds.map((id) => byId.get(id)).filter(Boolean);
    } else {
      followerProfiles = [];
    }
  }

  async function unfollowProfile(targetUserId: string) {
    if (!targetUserId || networkBusy) return;
    if (!browser) return;
    const ok = window.confirm('Dieses Profil wirklich entfolgen?');
    if (!ok) return;
    networkBusy = true;
    try {
      const { error } = await supabase
        .from('user_follows')
        .delete()
        .eq('follower_user_id', currentUserId)
        .eq('followed_user_id', targetUserId);
      if (error) throw error;
      await loadNetworkProfiles();
    } catch (error: any) {
      errorMessage = error?.message || 'Profil konnte nicht entfolgt werden.';
    } finally {
      networkBusy = false;
    }
  }

  async function removeFollower(targetUserId: string) {
    if (!targetUserId || networkBusy) return;
    if (!browser) return;
    const ok = window.confirm('Diesen Follower wirklich aus deiner Liste entfernen?');
    if (!ok) return;
    networkBusy = true;
    try {
      const { error } = await supabase
        .from('user_follows')
        .delete()
        .eq('follower_user_id', targetUserId)
        .eq('followed_user_id', currentUserId);
      if (error) throw error;
      await loadNetworkProfiles();
    } catch (error: any) {
      errorMessage = error?.message || 'Follower konnte nicht entfernt werden.';
    } finally {
      networkBusy = false;
    }
  }

  async function searchProfilesToFollow() {
    const q = followingSearchQuery.trim();
    if (q.length < 2) {
      followingSearchResults = [];
      return;
    }

    followingSearchBusy = true;
    errorMessage = '';
    try {
      const escaped = q.replace(/[%]/g, '');
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, accountname, avatar_url, website')
        .or(`full_name.ilike.%${escaped}%,accountname.ilike.%${escaped}%,website.ilike.%${escaped}%`)
        .neq('id', currentUserId)
        .limit(8);
      if (error) throw error;

      const followedSet = new Set(followedProfiles.map((profile: any) => profile.id));
      followingSearchResults = (data || []).filter((profile: any) => !followedSet.has(profile.id));
    } catch (error: any) {
      errorMessage = error?.message || 'Profile konnten nicht gesucht werden.';
    } finally {
      followingSearchBusy = false;
    }
  }

  async function followProfile(targetUserId: string) {
    if (!targetUserId || networkBusy) return;
    networkBusy = true;
    errorMessage = '';
    try {
      const { data: existing, error: existingError } = await supabase
        .from('user_follows')
        .select('follower_user_id')
        .eq('follower_user_id', currentUserId)
        .eq('followed_user_id', targetUserId)
        .maybeSingle();
      if (existingError) throw existingError;

      if (!existing) {
        const { error } = await supabase.from('user_follows').insert({
          follower_user_id: currentUserId,
          followed_user_id: targetUserId
        });
        if (error) throw error;
      }

      await loadNetworkProfiles();
      await searchProfilesToFollow();
    } catch (error: any) {
      errorMessage = error?.message || 'Profil konnte nicht gefolgt werden.';
    } finally {
      networkBusy = false;
    }
  }

  async function loadSharedItemRights() {
    const { data, error } = await supabase
      .from('item_rights')
      .select(`
        id,
        target_user_id,
        rights,
        created_at,
        updated_at,
        items!inner(
          id,
          slug,
          title,
          original_name,
          canonical_path,
          country_slug,
          district_slug,
          municipality_slug,
          path_512,
          profile_id
        )
      `)
      .eq('items.profile_id', currentUserId)
      .order('updated_at', { ascending: false })
      .limit(200);

    if (error) throw error;

    const rows = data || [];
    const targetIds = [...new Set(rows.map((entry: any) => entry.target_user_id).filter(Boolean))];
    const targetsById = new Map<string, any>();

    if (targetIds.length > 0) {
      const { data: targets, error: targetError } = await supabase
        .from('profiles')
        .select('id, full_name, accountname, avatar_url')
        .in('id', targetIds);
      if (targetError) throw targetError;
      for (const profile of targets || []) {
        targetsById.set(profile.id, profile);
      }
    }

    sharedItemRights = rows.map((entry: any) => ({
      ...entry,
      item: entry.items || null,
      target: targetsById.get(entry.target_user_id) || null
    }));
  }

  async function loadGlobalProfileRights() {
    const { data, error } = await supabase
      .from('profile_rights')
      .select('id, target_user_id, rights, created_at, updated_at')
      .eq('profile_id', currentUserId)
      .order('updated_at', { ascending: false })
      .limit(200);

    if (error) throw error;

    const rows = data || [];
    const targetIds = [...new Set(rows.map((entry: any) => entry.target_user_id).filter(Boolean))];
    const targetsById = new Map<string, any>();

    if (targetIds.length > 0) {
      const { data: targets, error: targetError } = await supabase
        .from('profiles')
        .select('id, full_name, accountname, avatar_url')
        .in('id', targetIds);
      if (targetError) throw targetError;
      for (const profile of targets || []) {
        targetsById.set(profile.id, profile);
      }
    }

    globalProfileRights = rows.map((entry: any) => ({
      ...entry,
      target: targetsById.get(entry.target_user_id) || null
    }));
  }

  async function loadNotifications() {
    const { data, error } = await supabase
      .from('user_conversations')
      .select(`
        id,
        user_a_id,
        user_b_id,
        user_a_last_read_at,
        user_b_last_read_at,
        last_message_at,
        last_message_preview,
        last_message_sender_id,
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
        ),
        user_a:user_a_id(
          full_name,
          accountname,
          avatar_url
        ),
        user_b:user_b_id(
          full_name,
          accountname,
          avatar_url
        )
      `)
      .or(`user_a_id.eq.${currentUserId},user_b_id.eq.${currentUserId}`)
      .order('last_message_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    unreadChats = (data || [])
      .filter((entry: any) => {
        if (!entry?.last_message_at) return false;
        if (entry.last_message_sender_id === currentUserId) return false;
        const ownReadAt = entry.user_a_id === currentUserId ? entry.user_a_last_read_at : entry.user_b_last_read_at;
        return !ownReadAt || new Date(entry.last_message_at).getTime() > new Date(ownReadAt).getTime();
      })
      .map((entry: any) => ({
        ...entry,
        otherUser: entry.user_a_id === currentUserId ? entry.user_b : entry.user_a
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

  async function loadReviewCount() {
    const reviewItems = await fetchProfileReviewItems(supabase, currentUserId);
    reviewCount = reviewItems.length;
  }

  const secondaryTasks: Record<DashboardSecondaryKey, () => Promise<void>> = {
    events: loadEventItems,
    favorites: loadFavoriteItems,
    likes: loadLikedItems,
    network: loadNetworkProfiles,
    shares: async () => {
      await Promise.all([loadSharedItemRights(), loadGlobalProfileRights()]);
    },
    notifications: loadNotifications,
    interactions: loadInteractions,
    review: loadReviewCount
  };

  const sectionToSecondaryKeys: Record<DashboardSectionId, DashboardSecondaryKey[]> = {
    recent: [],
    photos: [],
    stock: [],
    events: ['events'],
    favorites: ['favorites'],
    likes: ['likes'],
    notifications: ['notifications'],
    interactions: ['interactions'],
    following: ['network'],
    followers: ['network'],
    shares: ['shares'],
    review: ['review']
  };

  let loadedSecondaryKeys = new Set<string>();
  const secondaryInflight = new Map<string, Promise<void>>();

  async function loadSecondaryKey(key: DashboardSecondaryKey) {
    if (loadedSecondaryKeys.has(key)) return;
    let p = secondaryInflight.get(key);
    if (!p) {
      p = (async () => {
        await secondaryTasks[key]();
        loadedSecondaryKeys.add(key);
      })();
      void p.finally(() => secondaryInflight.delete(key));
      secondaryInflight.set(key, p);
    }
    await p;
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

  function setActiveSection(section: DashboardSectionId) {
    activeSection = section;
    const keys = sectionToSecondaryKeys[section];
    if (browser && keys.length) {
      void Promise.all(keys.map((k) => loadSecondaryKey(k))).catch(() => {});
    }
    if (!browser) return;
    requestAnimationFrame(() => {
      contentSectionEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  async function initDashboard() {
    loading = true;
    restLoading = true;
    loadedSecondaryKeys = new Set();
    secondaryInflight.clear();
    errorMessage = '';
    try {
      const ok = await ensureAuthUser();
      if (!ok) {
        restLoading = false;
        return;
      }
      const sectionParam = new URL(window.location.href).searchParams.get('section');
      if (sectionParam && isDashboardSectionId(sectionParam)) {
        activeSection = sectionParam;
      }
      const priorityKeys = sectionToSecondaryKeys[activeSection];
      await Promise.all([
        loadRecentItems(),
        loadOwnItems(1, ''),
        ...priorityKeys.map((k) => loadSecondaryKey(k))
      ]);
      loading = false;
      await Promise.all(
        SECONDARY_KEY_ORDER.filter((k) => !loadedSecondaryKeys.has(k)).map((k) => loadSecondaryKey(k))
      );
    } catch (error: any) {
      errorMessage = error?.message || 'Dashboard konnte nicht geladen werden.';
    } finally {
      loading = false;
      loadingItems = false;
      restLoading = false;
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
            on:click={() => setActiveSection('recent')}
          >
            <span class="dashboard-menu__label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v6l4 2" />
              </svg>
              <span>Zuletzt angesehen</span>
            </span>
            <strong>{recentItems.length}</strong>
          </button>
          <button
            type="button"
            class="dashboard-menu__link"
            class:is-active={activeSection === 'photos'}
            on:click={() => setActiveSection('photos')}
          >
            <span class="dashboard-menu__label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm0 2v7l4.2-4.2a1 1 0 0 1 1.4 0L13 13l2.2-2.2a1 1 0 0 1 1.4 0L20 14V7H4zm4 3.5A1.5 1.5 0 1 0 8 7.5a1.5 1.5 0 0 0 0 3z"/>
              </svg>
              <span>Meine Fotos</span>
            </span>
            <strong>{totalItems}</strong>
          </button>
          <button
            type="button"
            class="dashboard-menu__link"
            class:is-active={activeSection === 'stock'}
            on:click={() => setActiveSection('stock')}
          >
            <span class="dashboard-menu__label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                <path d="M8 7h8M8 11h8M8 15h4" />
              </svg>
              <span>Stock</span>
            </span>
            <strong>{restLoading ? '…' : stockAttentionCount}</strong>
          </button>
          <button
            type="button"
            class="dashboard-menu__link"
            class:is-active={activeSection === 'events'}
            on:click={() => setActiveSection('events')}
          >
            <span class="dashboard-menu__label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M7 2h2v2h6V2h2v2h2a2 2 0 0 1 2 2v13a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2h2V2zm12 8H5v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9zM6 6a1 1 0 0 0-1 1v1h14V7a1 1 0 0 0-1-1H6zm2 6h3v3H8v-3z"/>
              </svg>
              <span>Meine Events</span>
            </span>
            <strong>{restLoading ? '…' : eventItems.length}</strong>
          </button>
          <button
            type="button"
            class="dashboard-menu__link"
            class:is-active={activeSection === 'favorites'}
            on:click={() => setActiveSection('favorites')}
          >
            <span class="dashboard-menu__label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
              <span>Gemerkte</span>
            </span>
            <strong>{restLoading ? '…' : favoriteItems.length}</strong>
          </button>
          <button
            type="button"
            class="dashboard-menu__link"
            class:is-active={activeSection === 'likes'}
            on:click={() => setActiveSection('likes')}
          >
            <span class="dashboard-menu__label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 20.5l-1.45-1.32C5.4 14.5 2 11.42 2 7.72 2 4.9 4.24 2.75 7.05 2.75c1.6 0 3.14.74 4.15 1.9 1.01-1.16 2.55-1.9 4.15-1.9C18.16 2.75 20.4 4.9 20.4 7.72c0 3.7-3.4 6.78-8.55 11.46L12 20.5z" />
              </svg>
              <span>Likes</span>
            </span>
            <strong>{restLoading ? '…' : likedItems.length}</strong>
          </button>
          <button
            type="button"
            class="dashboard-menu__link"
            class:is-active={activeSection === 'notifications'}
            on:click={() => setActiveSection('notifications')}
          >
            <span class="dashboard-menu__label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span>Chat ungelesen</span>
            </span>
            <strong>{restLoading ? '…' : unreadChats.length}</strong>
          </button>
          <button
            type="button"
            class="dashboard-menu__link"
            class:is-active={activeSection === 'interactions'}
            on:click={() => setActiveSection('interactions')}
          >
            <span class="dashboard-menu__label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M7 11a3 3 0 1 1 3-3 3 3 0 0 1-3 3zm10 0a3 3 0 1 1 3-3 3 3 0 0 1-3 3zM7 13c-3.3 0-6 1.6-6 3.6V19h12v-2.4C13 14.6 10.3 13 7 13zm10 0c-1 0-1.9.1-2.8.4 1.1.8 1.8 1.9 1.8 3.2V19h8v-2.4c0-2-2.7-3.6-6-3.6z"/>
              </svg>
              <span>Interaktionen</span>
            </span>
            <strong>{restLoading ? '…' : interactions.length}</strong>
          </button>
          <button
            type="button"
            class="dashboard-menu__link"
            class:is-active={activeSection === 'following'}
            on:click={() => setActiveSection('following')}
          >
            <span class="dashboard-menu__label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M15 12c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4zM6 10c1.7 0 3-1.3 3-3S7.7 4 6 4 3 5.3 3 7s1.3 3 3 3zm9 2c-2.7 0-8 1.3-8 4v3h16v-3c0-2.7-5.3-4-8-4zM6 12c-.5 0-1 .03-1.5.1C2.6 12.5 1 13.4 1 15v2h4v-1c0-1.5.8-2.9 2.2-4-.4 0-.8 0-1.2 0z"/>
              </svg>
              <span>Du folgst</span>
            </span>
            <strong>{restLoading ? '…' : followedProfiles.length}</strong>
          </button>
          <button
            type="button"
            class="dashboard-menu__link"
            class:is-active={activeSection === 'followers'}
            on:click={() => setActiveSection('followers')}
          >
            <span class="dashboard-menu__label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zM8 11c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zM8 13c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
              </svg>
              <span>Follower</span>
            </span>
            <strong>{restLoading ? '…' : followerProfiles.length}</strong>
          </button>
          <button
            type="button"
            class="dashboard-menu__link"
            class:is-active={activeSection === 'shares'}
            on:click={() => setActiveSection('shares')}
          >
            <span class="dashboard-menu__label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M8 12h8M12 8v8" />
              </svg>
              <span>Freigaben</span>
            </span>
            <strong>{restLoading ? '…' : `${globalProfileRights.length} +${sharedItemRights.length}`}</strong>
          </button>
          <button
            type="button"
            class="dashboard-menu__link"
            class:is-active={activeSection === 'review'}
            on:click={() => setActiveSection('review')}
          >
            <span class="dashboard-menu__label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2L1 21h22L12 2zm0 5 6.53 12H5.47L12 7zm-1 3v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
              </svg>
              <span>Datenprüfung</span>
            </span>
            <strong>{restLoading ? '…' : reviewCount}</strong>
          </button>
        </nav>
      </aside>

      <section class="dashboard-column dashboard-column--content" bind:this={contentSectionEl}>
        {#if activeSection === 'recent'}
          <div class="panel-head">
            <h2>Zuletzt angesehen</h2>
            {#if recentItems.length > 0}
              <button type="button" class="ghost-btn" on:click={clearEntireHistory} disabled={historyBusy}>
                Verlauf löschen
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
          <div class="entry-actions">
            <a href="/foto/upload">Upload</a>
            <a href="/profile/freigaben">Globale Freigaben</a>
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
                      <span>{item.stats?.views || 0} Aufrufe</span>
                      <span>{item.stats?.likes || 0} Likes</span>
                      <span>{item.stats?.favorites || 0} Gemerkte</span>
                      <a href={`/item/${encodeURIComponent(item.slug)}/download`}>
                        {item.stats?.downloads || 0} Downloads
                      </a>
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
        {:else if activeSection === 'stock'}
          <div class="panel-head panel-head--space">
            <h2>Stock</h2>
            <span>{totalItems} Einträge · {stockAttentionCount} mit Hinweis</span>
          </div>
          <p class="dashboard-stock-intro">
            Öffentlicher Stock-Link, FTP-Upload zu Adobe und Zurücksetzen nur des Adobe-Zweigs — zentral hier, nicht mehr auf der Item-Seite.
          </p>
          <div class="entry-actions">
            <a href="/foto/upload">Neues Foto hochladen</a>
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
            <div class="entry-list entry-list--large dashboard-stock-list">
              {#each allItems as item (item.id)}
                <article class="entry-card entry-card--large dashboard-stock-card">
                  <a class="entry-preview" href={getPublicItemHref(item)}>
                    {#if getItemThumb(item)}
                      <img src={getItemThumb(item)} alt={item.title || item.original_name || 'Item'} width="72" height="72" loading="lazy" />
                    {:else}
                      <div class="entry-thumb-fallback">?</div>
                    {/if}
                  </a>
                  <div class="entry-content entry-content--large dashboard-stock-card__body">
                    <a href={getPublicItemHref(item)}>
                      <strong>{item.title || item.original_name || 'Ohne Titel'}</strong>
                    </a>
                    <div class="dashboard-stock-meta">
                      <span>Status: <code>{item.adobe_stock_status || 'none'}</code></span>
                      {#if item.adobe_stock_uploaded_at}
                        <span>Upload: {formatDateTime(item.adobe_stock_uploaded_at)}</span>
                      {/if}
                    </div>
                    {#if item.adobe_stock_error}
                      <div class="dashboard-stock-error">{item.adobe_stock_error}</div>
                    {/if}
                    <label class="dashboard-stock-label">
                      <span>Öffentliche Stock-URL</span>
                      <input
                        type="url"
                        class="dashboard-stock-input"
                        bind:value={stockEdits[item.id].url}
                        placeholder="https://stock.adobe.com/…"
                      />
                    </label>
                    <label class="dashboard-stock-label">
                      <span>Asset-ID</span>
                      <input
                        type="text"
                        class="dashboard-stock-input"
                        bind:value={stockEdits[item.id].assetId}
                        placeholder="optional"
                      />
                    </label>
                    <div class="dashboard-stock-actions">
                      <button
                        type="button"
                        class="ghost-btn"
                        disabled={stockActionBusy[item.id] === 'save'}
                        on:click={() => saveDashboardStock(item)}
                      >
                        {stockActionBusy[item.id] === 'save' ? 'Speichert…' : 'Speichern'}
                      </button>
                      <button
                        type="button"
                        class="dashboard-stock-btn--primary"
                        disabled={stockActionBusy[item.id] === 'upload'}
                        on:click={() => uploadDashboardStock(item)}
                      >
                        {stockActionBusy[item.id] === 'upload' ? 'Upload…' : 'Original hochladen'}
                      </button>
                      <button
                        type="button"
                        class="ghost-btn danger"
                        disabled={stockActionBusy[item.id] === 'reset'}
                        on:click={() => resetDashboardStockAdobe(item)}
                      >
                        {stockActionBusy[item.id] === 'reset' ? '…' : 'Adobe zurücksetzen'}
                      </button>
                    </div>
                    {#if stockFlash[item.id]}
                      <p class="dashboard-stock-flash">{stockFlash[item.id]}</p>
                    {/if}
                    {#if item.adobe_stock_url}
                      <a
                        class="dashboard-stock-external"
                        href={item.adobe_stock_url}
                        target="_blank"
                        rel="noopener noreferrer">Link öffnen</a
                      >
                    {/if}
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
        {:else if activeSection === 'events'}
          <div class="panel-head panel-head--space">
            <h2>Meine Events</h2>
            <span>{eventItems.length} gesamt</span>
          </div>
          {#if eventItems.length === 0}
            <p class="dashboard-empty">Noch keine Events vorhanden.</p>
          {:else}
            <div class="entry-list">
              {#each eventItems as item (item.id)}
                <a class="entry-card entry-card--link" href={getPublicItemHref(item)}>
                  {#if getItemThumb(item)}
                    <img src={getItemThumb(item)} alt={item.title || item.original_name || 'Event'} width="56" height="56" loading="lazy" />
                  {:else}
                    <div class="entry-thumb-fallback">E</div>
                  {/if}
                  <span class="entry-content">
                    <strong>{item.title || item.original_name || 'Ohne Titel'}</strong>
                    <span>Event</span>
                    <span>{formatDateTime(item.updated_at || item.created_at)}</span>
                  </span>
                </a>
              {/each}
            </div>
          {/if}
        {:else if activeSection === 'favorites'}
          <div class="panel-head panel-head--space">
            <h2>Gemerkte</h2>
            <span>{favoriteItems.length} gesamt</span>
          </div>
          {#if favoriteItems.length === 0}
            <p class="dashboard-empty">Noch keine gemerkten Items vorhanden.</p>
          {:else}
            <div class="entry-list">
              {#each favoriteItems as item (item.id)}
                <a class="entry-card entry-card--link" href={getPublicItemHref(item)}>
                  {#if getItemThumb(item)}
                    <img src={getItemThumb(item)} alt={item.title || item.original_name || 'Item'} width="56" height="56" loading="lazy" />
                  {:else}
                    <div class="entry-thumb-fallback">?</div>
                  {/if}
                  <span class="entry-content">
                    <strong>{item.title || item.original_name || 'Ohne Titel'}</strong>
                    <span>Gemerkt</span>
                    <span>{formatDateTime(item.favoritedAt)}</span>
                  </span>
                </a>
              {/each}
            </div>
          {/if}
        {:else if activeSection === 'likes'}
          <div class="panel-head panel-head--space">
            <h2>Likes</h2>
            <span>{likedItems.length} gesamt</span>
          </div>
          {#if likedItems.length === 0}
            <p class="dashboard-empty">Noch keine Likes vorhanden.</p>
          {:else}
            <div class="entry-list">
              {#each likedItems as item (item.id)}
                <a class="entry-card entry-card--link" href={getPublicItemHref(item)}>
                  {#if getItemThumb(item)}
                    <img src={getItemThumb(item)} alt={item.title || item.original_name || 'Item'} width="56" height="56" loading="lazy" />
                  {:else}
                    <div class="entry-thumb-fallback">?</div>
                  {/if}
                  <span class="entry-content">
                    <strong>{item.title || item.original_name || 'Ohne Titel'}</strong>
                    <span>Gefällt mir</span>
                    <span>{formatDateTime(item.likedAt)}</span>
                  </span>
                </a>
              {/each}
            </div>
          {/if}
        {:else if activeSection === 'notifications'}
          <div class="panel-head panel-head--space">
            <h2>Chat ungelesen</h2>
            <span>{unreadChats.length} offen</span>
          </div>

          {#if unreadChats.length === 0}
            <p class="dashboard-empty">Keine ungelesenen Chat-Nachrichten vorhanden.</p>
          {:else}
            <div class="entry-list">
              {#each unreadChats as entry (entry.id)}
                <a class="entry-card entry-card--link" href={`/chat?conversation=${encodeURIComponent(entry.id)}`}>
                  {#if entry.starter_item && getItemThumb(entry.starter_item)}
                    <img src={getItemThumb(entry.starter_item)} alt={entry.starter_item.title || entry.starter_item.original_name || 'Item'} width="56" height="56" loading="lazy" />
                  {:else}
                    <div class="entry-thumb-fallback">{getChatActor(entry).slice(0, 1).toUpperCase()}</div>
                  {/if}
                  <span class="entry-content">
                    <strong>{getChatActor(entry)}</strong>
                    <span>Ungelesene Nachricht</span>
                    {#if entry.last_message_preview}
                      <span>{entry.last_message_preview}</span>
                    {/if}
                    <span>{formatDateTime(entry.last_message_at)}</span>
                  </span>
                </a>
              {/each}
            </div>
          {/if}
        {:else if activeSection === 'interactions'}
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
                    <span class="entry-interaction-line">
                      <span class="interaction-icon" aria-hidden="true">
                        {#if getInteractionIconKind(entry) === 'download'}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 6v7m0 0l-3-3m3 3l3-3M6 18h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                        {:else if getInteractionIconKind(entry) === 'favorite'}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                          </svg>
                        {:else if getInteractionIconKind(entry) === 'like'}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 20.5l-1.45-1.32C5.4 14.5 2 11.42 2 7.72 2 4.9 4.24 2.75 7.05 2.75c1.6 0 3.14.74 4.15 1.9 1.01-1.16 2.55-1.9 4.15-1.9C18.16 2.75 20.4 4.9 20.4 7.72c0 3.7-3.4 6.78-8.55 11.46L12 20.5z" />
                          </svg>
                        {:else if getInteractionIconKind(entry) === 'comment'}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                        {:else if getInteractionIconKind(entry) === 'chat'}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                        {:else}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="9" />
                          </svg>
                        {/if}
                      </span>
                      <span>{getInteractionLabel(entry)}</span>
                    </span>
                    {#if entry.item}
                      <span>{entry.item.title || entry.item.original_name || 'Ohne Titel'}</span>
                    {/if}
                    <span>{formatDateTime(entry.created_at)}</span>
                  </span>
                </a>
              {/each}
            </div>
          {/if}
        {:else if activeSection === 'following'}
          <div class="panel-head panel-head--space">
            <h2>Du folgst</h2>
            <span>{followedProfiles.length} gesamt</span>
          </div>
          <form class="search-row" on:submit|preventDefault={searchProfilesToFollow}>
            <input type="search" bind:value={followingSearchQuery} placeholder="Profil suchen (Name, @accountname, Organisation)" />
            <button type="submit" disabled={followingSearchBusy}>Suchen</button>
          </form>
          {#if followingSearchQuery.trim().length >= 2}
            {#if followingSearchBusy}
              <p class="dashboard-empty">Suche läuft...</p>
            {:else if followingSearchResults.length > 0}
              <div class="entry-list">
                {#each followingSearchResults as profile (profile.id)}
                  <article class="entry-card entry-card--history">
                    {#if profile.avatar_url}
                      <img src={profile.avatar_url.startsWith('http') ? profile.avatar_url : `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/avatars/${profile.avatar_url}`} alt={profile.full_name || profile.accountname || 'Profil'} width="56" height="56" loading="lazy" />
                    {:else}
                      <div class="entry-thumb-fallback">{(profile.full_name || profile.accountname || '?').slice(0, 1).toUpperCase()}</div>
                    {/if}
                    <span class="entry-content">
                      <strong>{profile.full_name || profile.accountname || 'Profil'}</strong>
                      {#if profile.accountname}
                        <a href={`/${encodeURIComponent(profile.accountname)}`}>@{profile.accountname}</a>
                      {/if}
                    </span>
                    <button type="button" class="ghost-btn entry-remove-btn" on:click={() => followProfile(profile.id)} disabled={networkBusy}>
                      Folgen
                    </button>
                  </article>
                {/each}
              </div>
            {:else}
              <p class="dashboard-empty">Keine passenden Profile gefunden.</p>
            {/if}
          {/if}
          {#if followedProfiles.length === 0}
            <p class="dashboard-empty">Du folgst aktuell noch keinem Profil.</p>
          {:else}
            <div class="entry-list">
              {#each followedProfiles as profile (profile.id)}
                <article class="entry-card entry-card--history">
                  {#if profile.avatar_url}
                    <img src={profile.avatar_url.startsWith('http') ? profile.avatar_url : `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/avatars/${profile.avatar_url}`} alt={profile.full_name || profile.accountname || 'Profil'} width="56" height="56" loading="lazy" />
                  {:else}
                    <div class="entry-thumb-fallback">{(profile.full_name || profile.accountname || '?').slice(0, 1).toUpperCase()}</div>
                  {/if}
                  <span class="entry-content">
                    <strong>{profile.full_name || profile.accountname || 'Profil'}</strong>
                    {#if profile.accountname}
                      <a href={`/${encodeURIComponent(profile.accountname)}`}>@{profile.accountname}</a>
                    {/if}
                  </span>
                  <button type="button" class="ghost-btn entry-remove-btn" on:click={() => unfollowProfile(profile.id)} disabled={networkBusy}>Entfolgen</button>
                </article>
              {/each}
            </div>
          {/if}
        {:else if activeSection === 'followers'}
          <div class="panel-head panel-head--space">
            <h2>Follower</h2>
            <span>{followerProfiles.length} gesamt</span>
          </div>
          {#if followerProfiles.length === 0}
            <p class="dashboard-empty">Noch keine Follower vorhanden.</p>
          {:else}
            <div class="entry-list">
              {#each followerProfiles as profile (profile.id)}
                <article class="entry-card entry-card--history">
                  {#if profile.avatar_url}
                    <img src={profile.avatar_url.startsWith('http') ? profile.avatar_url : `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/avatars/${profile.avatar_url}`} alt={profile.full_name || profile.accountname || 'Profil'} width="56" height="56" loading="lazy" />
                  {:else}
                    <div class="entry-thumb-fallback">{(profile.full_name || profile.accountname || '?').slice(0, 1).toUpperCase()}</div>
                  {/if}
                  <span class="entry-content">
                    <strong>{profile.full_name || profile.accountname || 'Profil'}</strong>
                    {#if profile.accountname}
                      <a href={`/${encodeURIComponent(profile.accountname)}`}>@{profile.accountname}</a>
                    {/if}
                  </span>
                  <button type="button" class="ghost-btn entry-remove-btn" on:click={() => removeFollower(profile.id)} disabled={networkBusy}>Entfernen</button>
                </article>
              {/each}
            </div>
          {/if}
        {:else if activeSection === 'shares'}
          <div class="panel-head panel-head--space">
            <h2>Freigaben</h2>
            <span>{globalProfileRights.length} globale · {sharedItemRights.length} Einzelfreigaben</span>
          </div>
          <div class="entry-actions">
            <a href="/profile/freigaben">Globale Freigaben verwalten</a>
          </div>
          <section class="dashboard-global-shares">
            <div class="dashboard-global-shares__count">{globalProfileRights.length}</div>
            <div class="dashboard-global-shares__body">
              <strong>Globale Freigaben</strong>
              {#if globalProfileRights.length === 0}
                <p>Keine globalen Freigaben vergeben.</p>
              {:else}
                <p>
                  Berechtigte:
                  {globalProfileRights
                    .map((entry) => entry.target?.full_name || entry.target?.accountname || 'Unbekannt')
                    .join(', ')}
                </p>
              {/if}
            </div>
          </section>
          {#if sharedItemRights.length === 0}
            <p class="dashboard-empty">Noch keine Einzelfreigaben vorhanden.</p>
          {:else}
            <div class="entry-list">
              {#each sharedItemRights as entry (entry.id)}
                <article class="entry-card entry-card--history">
                  <a class="entry-preview" href={entry.item ? getPublicItemHref(entry.item) : '/dashboard'}>
                    {#if entry.item && getItemThumb(entry.item)}
                      <img src={getItemThumb(entry.item)} alt={entry.item.title || entry.item.original_name || 'Item'} width="56" height="56" loading="lazy" />
                    {:else}
                      <div class="entry-thumb-fallback">?</div>
                    {/if}
                  </a>
                  <span class="entry-content">
                    <a href={entry.item ? getPublicItemHref(entry.item) : '/dashboard'}>
                      <strong>{entry.item?.title || entry.item?.original_name || 'Ohne Titel'}</strong>
                    </a>
                    <span>
                      Für {entry.target?.full_name || entry.target?.accountname || 'Unbekannt'} · {getRightsText(entry.rights)}
                    </span>
                    <span>Aktualisiert: {formatDateTime(entry.updated_at || entry.created_at)}</span>
                  </span>
                </article>
              {/each}
            </div>
          {/if}
        {:else if activeSection === 'review'}
          <div class="panel-head panel-head--space">
            <h2>Datenprüfung</h2>
            <span>{reviewCount} offen</span>
          </div>
          {#if reviewCount > 0}
            <p class="dashboard-empty">
              <strong>{reviewCount}</strong> Einträge brauchen noch fehlende Daten oder Ortsprüfung.
            </p>
            <div class="entry-actions">
              <a href="/profile/review">Offene Einträge anzeigen</a>
              <a href="/foto/upload">Neues Foto hochladen</a>
            </div>
          {:else}
            <p class="dashboard-empty">Keine offenen Daten. Dein Bestand ist aktuell sauber gepflegt.</p>
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
  .dashboard-menu__label {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
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
  .entry-card--history .entry-preview {
    flex-shrink: 0;
  }
  .entry-card--history .entry-content > a:first-of-type {
    display: block;
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    color: inherit;
    text-decoration: none;
  }
  .entry-card--history .entry-content > a:first-of-type strong {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .entry-card--history .entry-content > a:first-of-type strong:hover {
    color: var(--culoca-orange);
  }
  .entry-card--history .entry-content > span {
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
    min-width: 0;
    gap: 0.35rem;
  }
  .entry-content--large > a:first-of-type {
    display: block;
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    color: inherit;
    text-decoration: none;
  }
  .entry-content--large > a:first-of-type strong {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .entry-content--large > a:first-of-type strong:hover {
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
  .entry-interaction-line {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }
  .interaction-icon {
    width: 1.15rem;
    height: 1.15rem;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    background: color-mix(in srgb, var(--text-primary) 26%, transparent);
    flex-shrink: 0;
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

  .dashboard-global-shares {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.85rem;
    align-items: center;
    margin: 0.75rem 0 1rem;
    padding: 0.85rem 1rem;
    border-radius: 12px;
    border: 1px solid var(--border-color);
    background: color-mix(in srgb, var(--bg-secondary) 82%, transparent);
  }

  .dashboard-global-shares__count {
    font-size: 1.75rem;
    font-weight: 800;
    line-height: 1;
    color: var(--culoca-orange);
    min-width: 2.2rem;
    text-align: center;
  }

  .dashboard-global-shares__body p {
    margin: 0.2rem 0 0;
    color: var(--text-secondary);
    font-size: 0.92rem;
  }
  .dashboard-error {
    color: #ffb4b4;
  }

  .dashboard-stock-intro {
    margin: 0 0 0.75rem;
    color: var(--text-secondary);
    font-size: 0.92rem;
    line-height: 1.45;
  }
  .dashboard-stock-card__body {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    align-items: stretch;
  }
  .dashboard-stock-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    font-size: 0.88rem;
    color: var(--text-secondary);
  }
  .dashboard-stock-meta code {
    font-size: 0.85rem;
  }
  .dashboard-stock-error {
    font-size: 0.88rem;
    color: #d64545;
  }
  .dashboard-stock-label {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.82rem;
    color: var(--text-secondary);
  }
  .dashboard-stock-input {
    width: 100%;
    padding: 0.45rem 0.55rem;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font: inherit;
  }
  .dashboard-stock-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    margin-top: 0.2rem;
  }
  .dashboard-stock-btn--primary {
    border: 1px solid var(--culoca-orange, #ee7221);
    background: var(--culoca-orange, #ee7221);
    color: #fff;
    border-radius: 10px;
    padding: 0.45rem 0.75rem;
    cursor: pointer;
    font: inherit;
  }
  .dashboard-stock-btn--primary:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .ghost-btn.danger {
    color: #c73e3e;
    border-color: color-mix(in srgb, #c73e3e 35%, var(--border-color));
  }
  .dashboard-stock-flash {
    margin: 0;
    font-size: 0.86rem;
    color: var(--text-secondary);
  }
  .dashboard-stock-external {
    font-size: 0.88rem;
    color: var(--accent-color);
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
