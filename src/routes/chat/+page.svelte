<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import SiteNav from '$lib/SiteNav.svelte';
  import SiteFooter from '$lib/SiteFooter.svelte';
  import FollowButton from '$lib/FollowButton.svelte';
  import { authFetch } from '$lib/authFetch';
  import { getPublicItemHref } from '$lib/content/routing';
  import { getSeoImageUrl } from '$lib/utils/seoImageUrl';
  import { supabase } from '$lib/supabaseClient';
  import { isAuthenticated } from '$lib/sessionStore';

  let currentUserId = '';
  let currentUserFullName = '';
  let chatLoading = false;
  let chatLoadedForUser = '';
  let conversations: any[] = [];
  let selectedConversationId = '';
  let conversationMessages: any[] = [];
  let messagesLoading = false;
  let messageDraft = '';
  let messageSendLoading = false;
  let messageStatus = '';
  let messageListElement: HTMLDivElement | null = null;
  let composeTextarea: HTMLTextAreaElement | null = null;
  let liveChannels: any[] = [];
  let activeMessageChannel: any = null;
  let handledConversationIntentKey = '';
  let requestedItem: any = null;
  let userSearchQuery = '';
  let userSearchResults: any[] = [];
  let userSearchLoading = false;
  let userSearchMessage = '';
  let userSearchTimeout: ReturnType<typeof setTimeout> | null = null;

  $: isEmbedded = $page.url.searchParams.get('embed') === '1';
  $: activeConversation = conversations.find((entry: any) => entry.id === selectedConversationId) || null;
  $: visibleChatItem = requestedItem || activeConversation?.starter_item || null;

  function normalizeUserSearchQuery(value: string): string {
    return value.trim().replace(/^@+/, '');
  }

  function buildParticipantKey(firstUserId: string, secondUserId: string) {
    return [firstUserId, secondUserId].sort().join(':');
  }

  function formatDateTime(value: string | null | undefined): string {
    if (!value) return '';
    try {
      return new Intl.DateTimeFormat('de-DE', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(value));
    } catch {
      return '';
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

  function getConversationUnread(entry: any) {
    if (!entry || !currentUserId || !entry.last_message_at) return false;
    if (entry.last_message_sender_id === currentUserId) return false;
    const ownReadAt = entry.user_a_id === currentUserId ? entry.user_a_last_read_at : entry.user_b_last_read_at;
    return !ownReadAt || new Date(entry.last_message_at).getTime() > new Date(ownReadAt).getTime();
  }

  async function loadCurrentUser() {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    if (!user) {
      currentUserId = '';
      currentUserFullName = '';
      return;
    }

    currentUserId = user.id;
    currentUserFullName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.user_metadata?.display_name ||
      '';

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, accountname')
      .eq('id', user.id)
      .single();

    currentUserFullName = currentUserFullName || profile?.full_name || profile?.accountname || '';
  }

  async function loadChatData() {
    if (!currentUserId) {
      conversations = [];
      chatLoadedForUser = '';
      return;
    }

    chatLoading = true;

    try {
      const { data, error } = await supabase
        .from('user_conversations')
        .select(`
          id,
          participant_key,
          user_a_id,
          user_b_id,
          starter_item_id,
          last_message_at,
          last_message_preview,
          last_message_sender_id,
          user_a_last_read_at,
          user_b_last_read_at,
          created_at,
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
            profile_id,
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
        .or(`user_a_id.eq.${currentUserId},user_b_id.eq.${currentUserId}`)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      conversations = (data || []).map((entry: any) => ({
        ...entry,
        otherUser: entry.user_a_id === currentUserId ? entry.user_b : entry.user_a
      }));
      chatLoadedForUser = currentUserId;
    } catch (error) {
      console.error('Failed to load chat data:', error);
      conversations = [];
    } finally {
      chatLoading = false;
    }
  }

  async function loadRequestedItem(itemId: string | null) {
    if (!itemId) {
      requestedItem = null;
      return;
    }

    try {
      const { data, error } = await supabase
        .from('items')
        .select(`
          id,
          profile_id,
          slug,
          title,
          original_name,
          canonical_path,
          country_slug,
          district_slug,
          municipality_slug,
          path_512
        `)
        .eq('id', itemId)
        .maybeSingle();

      if (error) throw error;
      requestedItem = data || null;
    } catch (error) {
      console.error('Failed to load requested chat item:', error);
      requestedItem = null;
    }
  }

  function teardownChannels() {
    for (const channel of liveChannels) {
      supabase.removeChannel(channel);
    }
    liveChannels = [];

    if (activeMessageChannel) {
      supabase.removeChannel(activeMessageChannel);
      activeMessageChannel = null;
    }
  }

  function setupLiveChannels() {
    teardownChannels();

    if (!currentUserId) return;

    const conversationsChannel = supabase
      .channel(`chat-conversations-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_conversations', filter: `user_a_id=eq.${currentUserId}` },
        async () => {
          await loadChatData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_conversations', filter: `user_b_id=eq.${currentUserId}` },
        async () => {
          await loadChatData();
        }
      )
      .subscribe();

    liveChannels = [conversationsChannel];
  }

  async function loadConversationMessages(conversationId: string) {
    if (!currentUserId || !conversationId) return;

    messagesLoading = true;

    try {
      const { data, error } = await supabase
        .from('user_messages')
        .select(`
          id,
          sender_user_id,
          item_id,
          body,
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
          )
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      conversationMessages = (data || []).map((entry: any) => ({
        ...entry,
        item: entry.items || null
      }));
      await scrollMessagesToBottom();
    } catch (error) {
      console.error('Failed to load conversation messages:', error);
      conversationMessages = [];
    } finally {
      messagesLoading = false;
    }
  }

  async function markConversationRead(conversation: any) {
    if (!currentUserId || !conversation?.id) return;

    const readColumn = conversation.user_a_id === currentUserId ? 'user_a_last_read_at' : 'user_b_last_read_at';
    const now = new Date().toISOString();

    try {
      const { error } = await supabase
        .from('user_conversations')
        .update({ [readColumn]: now, updated_at: now })
        .eq('id', conversation.id);

      if (error) throw error;

      conversations = conversations.map((entry: any) =>
        entry.id === conversation.id ? { ...entry, [readColumn]: now } : entry
      );
    } catch (error) {
      console.error('Failed to mark conversation as read:', error);
    }
  }

  function setupActiveMessageChannel(conversationId: string) {
    if (activeMessageChannel) {
      supabase.removeChannel(activeMessageChannel);
      activeMessageChannel = null;
    }

    if (!conversationId) return;

    activeMessageChannel = supabase
      .channel(`chat-messages-${conversationId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_messages', filter: `conversation_id=eq.${conversationId}` },
        async () => {
          await loadConversationMessages(conversationId);
          await loadChatData();
        }
      )
      .subscribe();
  }

  async function selectConversation(conversation: any, updateUrl = true) {
    if (!conversation?.id) return;

    selectedConversationId = conversation.id;
    messageStatus = '';
    setupActiveMessageChannel(conversation.id);
    await loadConversationMessages(conversation.id);
    await markConversationRead(conversation);

    if (updateUrl) {
      await goto(`/chat?conversation=${encodeURIComponent(conversation.id)}`, {
        replaceState: true,
        noScroll: true,
        keepFocus: true
      });
    }
  }

  async function ensureConversation(targetUserId: string, itemId: string | null = null) {
    if (!currentUserId || !targetUserId || targetUserId === currentUserId) return null;

    const participantKey = buildParticipantKey(currentUserId, targetUserId);
    const existingConversation = conversations.find((entry: any) => entry.participant_key === participantKey);
    if (existingConversation) return existingConversation;

    try {
      const now = new Date().toISOString();
      const sortedUsers = [currentUserId, targetUserId].sort();
      const { data, error } = await supabase
        .from('user_conversations')
        .insert({
          participant_key: participantKey,
          user_a_id: sortedUsers[0],
          user_b_id: sortedUsers[1],
          starter_item_id: itemId,
          created_by_user_id: currentUserId,
          last_message_at: now,
          user_a_last_read_at: sortedUsers[0] === currentUserId ? now : null,
          user_b_last_read_at: sortedUsers[1] === currentUserId ? now : null,
          updated_at: now
        })
        .select(`
          id,
          participant_key,
          user_a_id,
          user_b_id,
          starter_item_id,
          last_message_at,
          last_message_preview,
          last_message_sender_id,
          user_a_last_read_at,
          user_b_last_read_at,
          created_at,
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
            profile_id,
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
        .single();

      if (error) throw error;

      const conversation = {
        ...data,
        otherUser: data.user_a_id === currentUserId ? data.user_b : data.user_a
      };
      conversations = [conversation, ...conversations];
      return conversation;
    } catch (error: any) {
      if (error?.code === '23505') {
        await loadChatData();
        return conversations.find((entry: any) => entry.participant_key === participantKey) || null;
      }

      console.error('Failed to ensure conversation:', error);
      return null;
    }
  }

  async function handleInitialConversationIntent() {
    if (!currentUserId) return;

    const chatWith = ($page.url.searchParams.get('chatWith') || '').trim();
    const conversationId = ($page.url.searchParams.get('conversation') || '').trim();
    const itemId = ($page.url.searchParams.get('item') || '').trim() || null;
    // Kein conversations.length: sonst mehrfache Läufe nach loadChatData / neue Conversation
    const intentKey = `${currentUserId}:${chatWith}:${conversationId}:${itemId}`;

    if (intentKey === handledConversationIntentKey) return;
    handledConversationIntentKey = intentKey;
    await loadRequestedItem(itemId);

    if (chatWith && chatWith !== currentUserId) {
      const conversation = await ensureConversation(chatWith, itemId);
      if (conversation) {
        await selectConversation(conversation, false);
        await tick();
        requestAnimationFrame(() => {
          composeTextarea?.focus();
        });
      }
      return;
    }

    if (conversationId) {
      const conversation = conversations.find((entry: any) => entry.id === conversationId);
      if (conversation) {
        await selectConversation(conversation, false);
      }
      return;
    }

    if (conversations.length > 0 && !selectedConversationId) {
      await selectConversation(conversations[0], false);
    }
  }

  async function scrollMessagesToBottom() {
    await tick();
    if (messageListElement) {
      messageListElement.scrollTop = messageListElement.scrollHeight;
    }
  }

  async function sendMessage() {
    const body = messageDraft.trim();
    const conversation = conversations.find((entry: any) => entry.id === selectedConversationId);
    const messageItemId = requestedItem?.id || conversation?.starter_item_id || null;

    if (!currentUserId || !conversation?.id) return;
    if (!body) {
      messageStatus = 'Bitte zuerst eine Nachricht eingeben.';
      return;
    }

    messageSendLoading = true;
    messageStatus = '';

    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('user_messages')
        .insert({
          conversation_id: conversation.id,
          sender_user_id: currentUserId,
          item_id: messageItemId,
          body
        })
        .select(`
          id,
          sender_user_id,
          item_id,
          body,
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
          )
        `)
        .single();

      if (error) throw error;

      const readColumn = conversation.user_a_id === currentUserId ? 'user_a_last_read_at' : 'user_b_last_read_at';
      const { error: updateError } = await supabase
        .from('user_conversations')
        .update({
          last_message_at: now,
          last_message_preview: body.slice(0, 180),
          last_message_sender_id: currentUserId,
          [readColumn]: now,
          updated_at: now
        })
        .eq('id', conversation.id);

      if (updateError) throw updateError;

      conversationMessages = [...conversationMessages, { ...data, item: data.items || null }];
      messageDraft = '';
      await scrollMessagesToBottom();

      const recipientUserId = conversation.user_a_id === currentUserId ? conversation.user_b_id : conversation.user_a_id;
      if (recipientUserId && recipientUserId !== currentUserId) {
        await supabase.from('user_notifications').insert({
          recipient_user_id: recipientUserId,
          actor_user_id: currentUserId,
          item_id: messageItemId,
          event_type: 'chat_message',
          payload: {
            conversation_id: conversation.id,
            message_excerpt: body.slice(0, 180),
            starter_item_id: messageItemId
          }
        });
      }

      if (messageItemId) {
        await supabase.from('item_events').insert({
          item_id: messageItemId,
          actor_user_id: currentUserId,
          owner_user_id: requestedItem?.profile_id || conversation.starter_item?.profile_id || null,
          event_type: 'chat_message',
          source: 'chat_page',
          metadata: {
            conversation_id: conversation.id,
            message_id: data.id,
            message_excerpt: body.slice(0, 180),
            starter_item_id: messageItemId
          }
        });
      }

      await loadChatData();
    } catch (error) {
      console.error('Error sending message:', error);
      messageStatus = 'Nachricht konnte gerade nicht gesendet werden.';
    } finally {
      messageSendLoading = false;
    }
  }

  async function handleMessageKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    await sendMessage();
  }

  async function searchUsers() {
    const query = normalizeUserSearchQuery(userSearchQuery);

    if (!$isAuthenticated || !currentUserId || query.length < 2) {
      userSearchResults = [];
      userSearchMessage = query.length === 1 ? 'Bitte mindestens 2 Zeichen eingeben.' : '';
      return;
    }

    userSearchLoading = true;
    userSearchMessage = '';

    try {
      const response = await authFetch(`/api/search-users?q=${encodeURIComponent(query)}`);

      if (!response.ok) {
        userSearchResults = [];
        userSearchMessage = 'Die Suche ist gerade nicht verfügbar.';
        return;
      }

      const payload = await response.json();
      userSearchResults = payload.users || [];
      userSearchMessage = userSearchResults.length === 0 ? 'Keine passenden Profile gefunden.' : '';
    } catch (error) {
      console.error('Chat user search failed:', error);
      userSearchResults = [];
      userSearchMessage = 'Die Suche ist gerade nicht verfügbar.';
    } finally {
      userSearchLoading = false;
    }
  }

  function handleUserSearchInput() {
    if (userSearchTimeout) {
      clearTimeout(userSearchTimeout);
    }

    userSearchTimeout = setTimeout(() => {
      searchUsers();
    }, 250);
  }

  function clearUserSearch() {
    userSearchQuery = '';
    userSearchResults = [];
    userSearchMessage = '';
    userSearchLoading = false;
    if (userSearchTimeout) {
      clearTimeout(userSearchTimeout);
      userSearchTimeout = null;
    }
  }

  onMount(async () => {
    await loadCurrentUser();
    if (currentUserId) {
      await loadChatData();
      setupLiveChannels();
      await handleInitialConversationIntent();
    }
  });

  onDestroy(() => {
    teardownChannels();
    if (userSearchTimeout) {
      clearTimeout(userSearchTimeout);
    }
  });

  $: if (currentUserId && chatLoadedForUser === currentUserId && conversations) {
    void handleInitialConversationIntent();
  }

  $: if (!$isAuthenticated) {
    teardownChannels();
    conversations = [];
    selectedConversationId = '';
    conversationMessages = [];
    requestedItem = null;
    messageDraft = '';
    messageStatus = '';
    handledConversationIntentKey = '';
    clearUserSearch();
  }
</script>

<svelte:head>
  <title>Chat | Culoca</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="page" class:is-embedded={isEmbedded}>
  {#if !isEmbedded}
    <SiteNav />
  {/if}

  <main class="chat-page">
    {#if $isAuthenticated}
      <section class="chat-shell">
        <header class="chat-shell__header">
          <div>
            <p class="chat-shell__eyebrow">Inbox</p>
            <h1>Chat</h1>
            <p class="chat-shell__copy">
              {#if currentUserFullName}
                {currentUserFullName}, hier laufen alle Gespräche zentral zusammen.
              {:else}
                Alle Gespräche laufen hier zentral zusammen.
              {/if}
            </p>
          </div>
        </header>

        <div class="chat-workspace">
          <aside class="chat-sidebar">
            <section class="chat-search">
              <div class="chat-section-head">
                <div>
                  <span class="chat-kicker">Neu</span>
                  <h2>Gespräch starten</h2>
                </div>
              </div>

              <div class="chat-search__bar">
                <input
                  class="chat-search__input"
                  type="search"
                  bind:value={userSearchQuery}
                  on:input={handleUserSearchInput}
                  placeholder="Namen oder @accountname suchen"
                  autocomplete="off"
                  spellcheck="false"
                />
                {#if userSearchQuery}
                  <button type="button" class="chat-search__clear" on:click={clearUserSearch}>
                    Zurücksetzen
                  </button>
                {/if}
              </div>

              {#if userSearchLoading}
                <p class="chat-empty">Profile werden gesucht...</p>
              {:else if userSearchResults.length > 0}
                <div class="chat-search-results">
                  {#each userSearchResults as profile (profile.id)}
                    <div class="chat-search-entry">
                      <div class="chat-search-entry__profile">
                        {#if getAvatarUrl(profile)}
                          <img
                            class="chat-search-entry__avatar"
                            src={getAvatarUrl(profile)}
                            alt={profile.full_name || profile.accountname || 'Profil'}
                            width="48"
                            height="48"
                            loading="lazy"
                          />
                        {:else}
                          <div class="chat-search-entry__avatar chat-search-entry__avatar--fallback">
                            {(profile.full_name || profile.accountname || '?').slice(0, 1).toUpperCase()}
                          </div>
                        {/if}
                        <div>
                          <strong>{profile.full_name || profile.accountname || 'Profil'}</strong>
                          {#if profile.accountname}
                            <span>@{profile.accountname}</span>
                          {/if}
                        </div>
                      </div>
                      <div class="chat-search-entry__actions">
                        <a class="chat-inline-action chat-inline-action--primary" href={`/chat?chatWith=${encodeURIComponent(profile.id)}`}>
                          Chat
                        </a>
                        {#if profile.accountname}
                          <a class="chat-inline-action" href={`/${encodeURIComponent(profile.accountname)}`}>
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
              {:else if userSearchMessage}
                <p class="chat-empty">{userSearchMessage}</p>
              {/if}
            </section>

            <section class="chat-conversations">
              <div class="chat-section-head">
                <div>
                  <span class="chat-kicker">Inbox</span>
                  <h2>Gespräche</h2>
                </div>
              </div>

              <div class="conversation-list">
                {#if chatLoading && conversations.length === 0}
                  <p class="chat-empty">Gespräche werden geladen...</p>
                {:else if conversations.length > 0}
                  {#each conversations as entry (entry.id)}
                    <button
                      type="button"
                      class="conversation-card"
                      class:is-active={entry.id === selectedConversationId}
                      class:is-unread={getConversationUnread(entry)}
                      on:click={() => selectConversation(entry)}
                    >
                      <div class="conversation-card__header">
                        <div class="conversation-card__user">
                          {#if getAvatarUrl(entry.otherUser)}
                            <img
                              src={getAvatarUrl(entry.otherUser)}
                              alt={entry.otherUser?.full_name || entry.otherUser?.accountname || 'Profil'}
                            />
                          {:else}
                            <span class="conversation-card__avatar-fallback">
                              {(entry.otherUser?.full_name || entry.otherUser?.accountname || '?').slice(0, 1).toUpperCase()}
                            </span>
                          {/if}
                          <strong>{entry.otherUser?.full_name || entry.otherUser?.accountname || 'Unbekannt'}</strong>
                        </div>
                        <time>{formatDateTime(entry.last_message_at || entry.created_at)}</time>
                      </div>
                      {#if entry.starter_item}
                        <span class="conversation-card__item">
                          Bezug: {entry.starter_item.title || entry.starter_item.original_name || 'Item'}
                        </span>
                      {/if}
                      <span class="conversation-card__preview">
                        {entry.last_message_preview || 'Noch keine Nachricht gesendet.'}
                      </span>
                    </button>
                  {/each}
                {:else}
                  <p class="chat-empty">Noch keine Gespräche vorhanden.</p>
                {/if}
              </div>
            </section>
          </aside>

          <section class="chat-thread">
            {#if activeConversation}
              <div class="chat-thread__header">
                <div class="chat-thread__person">
                  <strong>{activeConversation.otherUser?.full_name || activeConversation.otherUser?.accountname || 'Unbekannt'}</strong>
                  <span>Direktnachrichten mit sichtbarem Item-Bezug</span>
                </div>

                {#if visibleChatItem}
                  <a class="chat-item-card" href={getPublicItemHref(visibleChatItem)}>
                    {#if getItemPreviewUrl(visibleChatItem)}
                      <img
                        src={getItemPreviewUrl(visibleChatItem)}
                        alt={visibleChatItem.title || visibleChatItem.original_name || 'Item'}
                        width="88"
                        height="88"
                        loading="lazy"
                      />
                    {/if}
                    <div class="chat-item-card__body">
                      <span class="chat-item-card__eyebrow">Anfrage zu diesem Item</span>
                      <strong>{visibleChatItem.title || visibleChatItem.original_name || 'Item'}</strong>
                      <span>Item öffnen</span>
                    </div>
                  </a>
                {/if}
              </div>

              {#if messagesLoading}
                <p class="chat-empty">Nachrichten werden geladen...</p>
              {:else if conversationMessages.length > 0}
                <div class="message-list" bind:this={messageListElement}>
                  {#each conversationMessages as entry}
                    <div class="message-bubble" class:is-own={entry.sender_user_id === currentUserId}>
                      <p>{entry.body}</p>
                      {#if entry.item}
                        <a class="message-bubble__item" href={getPublicItemHref(entry.item)}>
                          {entry.item.title || entry.item.original_name || 'Item'}
                        </a>
                      {/if}
                      <time>{formatDateTime(entry.created_at)}</time>
                    </div>
                  {/each}
                </div>
              {:else}
                <p class="chat-empty">Noch keine Nachrichten in diesem Gespräch.</p>
              {/if}

              <div class="chat-compose">
                <textarea
                  bind:this={composeTextarea}
                  bind:value={messageDraft}
                  rows="4"
                  placeholder="Nachricht schreiben..."
                  on:keydown={handleMessageKeydown}
                />
                <div class="chat-compose__actions">
                  {#if messageStatus}
                    <span class="chat-empty">{messageStatus}</span>
                  {/if}
                  <button type="button" class="chat-inline-action chat-inline-action--primary" on:click={sendMessage} disabled={messageSendLoading}>
                    {messageSendLoading ? 'Senden...' : 'Nachricht senden'}
                  </button>
                </div>
              </div>
            {:else}
              <div class="chat-placeholder">
                <h2>Kein Gespräch ausgewählt</h2>
                <p>Wähle links ein bestehendes Gespräch oder starte über die Suche einen neuen Chat.</p>
              </div>
            {/if}
          </section>
        </div>
      </section>
    {:else}
      <section class="chat-login-prompt">
        <h1>Chat</h1>
        <p>Bitte logge dich ein, um Nachrichten zu senden und zu empfangen.</p>
        <button
          type="button"
          class="chat-inline-action chat-inline-action--primary"
          on:click={() => goto(`/login?returnTo=${encodeURIComponent(`${$page.url.pathname}${$page.url.search}`)}`)}
        >
          Zum Login
        </button>
      </section>
    {/if}
  </main>

  {#if !isEmbedded}
    <SiteFooter />
  {/if}
</div>

<style>
  .chat-page {
    width: min(1440px, calc(100% - 2rem));
    margin: 0 auto;
    padding: 1.5rem 0 2.5rem;
  }

  .page.is-embedded .chat-page {
    width: 100%;
    max-width: none;
    padding: 0;
  }

  .page.is-embedded .chat-shell {
    gap: 0;
  }

  .page.is-embedded .chat-shell__header {
    display: none;
  }

  .page.is-embedded .chat-workspace {
    gap: 0;
    grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
  }

  .page.is-embedded .chat-search,
  .page.is-embedded .chat-conversations,
  .page.is-embedded .chat-thread {
    border-radius: 0;
    border-width: 0;
  }

  .page.is-embedded .chat-sidebar {
    gap: 0;
    border-right: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .page.is-embedded .chat-thread {
    min-height: 100dvh;
  }

  .chat-shell {
    display: grid;
    gap: 1.25rem;
  }

  .chat-shell__header,
  .chat-login-prompt,
  .chat-search,
  .chat-conversations,
  .chat-thread {
    border: 1px solid var(--border-color);
    border-radius: 22px;
    background: var(--bg-secondary);
  }

  .chat-shell__header,
  .chat-login-prompt {
    padding: 1.35rem 1.5rem;
  }

  .chat-shell__eyebrow,
  .chat-kicker,
  .chat-item-card__eyebrow {
    margin: 0 0 0.35rem;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--culoca-orange);
  }

  .chat-shell__header h1,
  .chat-login-prompt h1,
  .chat-section-head h2,
  .chat-placeholder h2 {
    margin: 0;
    font-size: clamp(1.5rem, 2vw, 2.2rem);
  }

  .chat-shell__copy,
  .chat-login-prompt p,
  .chat-placeholder p {
    margin: 0.45rem 0 0;
    color: var(--text-secondary);
  }

  .chat-workspace {
    display: grid;
    grid-template-columns: minmax(320px, 390px) minmax(0, 1fr);
    gap: 1rem;
    align-items: start;
  }

  .chat-sidebar {
    display: grid;
    gap: 1rem;
  }

  .chat-search,
  .chat-conversations,
  .chat-thread {
    padding: 1rem;
  }

  .chat-section-head {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    align-items: center;
    margin-bottom: 0.85rem;
  }

  .chat-search__bar {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    margin-bottom: 0.85rem;
  }

  .chat-search__input,
  .chat-compose textarea {
    width: 100%;
    padding: 0.9rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 16px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font: inherit;
    box-sizing: border-box;
  }

  .chat-search__input:focus,
  .chat-compose textarea:focus {
    outline: none;
    border-color: color-mix(in srgb, var(--culoca-orange) 46%, var(--border-color) 54%);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--culoca-orange) 14%, transparent 86%);
  }

  .chat-search__clear,
  .chat-inline-action {
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-primary);
    border-radius: 999px;
    padding: 0.7rem 1rem;
    font: inherit;
    cursor: pointer;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
  }

  .chat-search__clear:hover,
  .chat-inline-action:hover {
    border-color: color-mix(in srgb, var(--culoca-orange) 38%, var(--border-color) 62%);
  }

  .chat-inline-action--primary {
    background: var(--culoca-orange);
    border-color: var(--culoca-orange);
    color: #fff;
  }

  .chat-empty {
    margin: 0;
    color: var(--text-secondary);
  }

  .chat-search-results {
    display: grid;
    gap: 0.75rem;
  }

  .chat-search-entry {
    display: grid;
    gap: 0.85rem;
    padding: 0.85rem;
    border-radius: 16px;
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
  }

  .chat-search-entry__profile {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .chat-search-entry__profile div {
    display: grid;
    gap: 0.2rem;
  }

  .chat-search-entry__profile span {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .chat-search-entry__avatar {
    width: 48px;
    height: 48px;
    border-radius: 999px;
    object-fit: cover;
    flex-shrink: 0;
  }

  .chat-search-entry__avatar--fallback {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--culoca-orange) 14%, var(--bg-secondary) 86%);
    color: var(--text-primary);
    font-weight: 700;
  }

  .chat-search-entry__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
  }

  .conversation-list {
    display: grid;
    gap: 0.75rem;
    align-content: start;
  }

  .conversation-card {
    display: grid;
    gap: 0.4rem;
    width: 100%;
    text-align: left;
    padding: 0.9rem 1rem;
    border-radius: 16px;
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: inherit;
    cursor: pointer;
  }

  .conversation-card:hover,
  .conversation-card.is-active {
    border-color: color-mix(in srgb, var(--culoca-orange) 46%, var(--border-color) 54%);
  }

  .conversation-card.is-unread {
    box-shadow: inset 3px 0 0 var(--culoca-orange);
  }

  .conversation-card__header {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    align-items: center;
  }

  .conversation-card__user {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }

  .conversation-card__user img,
  .conversation-card__avatar-fallback {
    width: 40px;
    height: 40px;
    border-radius: 999px;
    flex-shrink: 0;
  }

  .conversation-card__user img {
    object-fit: cover;
  }

  .conversation-card__avatar-fallback {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--culoca-orange) 14%, var(--bg-secondary) 86%);
    color: var(--text-primary);
    font-weight: 700;
  }

  .conversation-card__user strong,
  .conversation-card__preview,
  .conversation-card__item {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .conversation-card__item,
  .conversation-card__preview,
  .conversation-card time {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .chat-thread {
    display: grid;
    gap: 1rem;
    min-width: 0;
    min-height: 70vh;
    align-content: start;
  }

  .chat-thread__header {
    display: grid;
    gap: 1rem;
  }

  .chat-thread__person {
    display: grid;
    gap: 0.2rem;
  }

  .chat-thread__person span {
    color: var(--text-secondary);
    font-size: 0.95rem;
  }

  .chat-item-card {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.9rem;
    text-decoration: none;
    color: inherit;
    border: 1px solid var(--border-color);
    border-radius: 18px;
    padding: 0.8rem;
    background: var(--bg-primary);
  }

  .chat-item-card:hover {
    border-color: color-mix(in srgb, var(--culoca-orange) 46%, var(--border-color) 54%);
  }

  .chat-item-card img {
    width: 88px;
    height: 88px;
    border-radius: 14px;
    object-fit: cover;
  }

  .chat-item-card__body {
    display: grid;
    gap: 0.25rem;
    min-width: 0;
    align-content: center;
  }

  .chat-item-card__body strong,
  .chat-item-card__body span {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chat-item-card__body > span:last-child {
    color: var(--text-secondary);
    font-size: 0.92rem;
  }

  .message-list {
    display: grid;
    gap: 0.75rem;
    max-height: min(60vh, 720px);
    overflow-y: auto;
    padding-right: 0.25rem;
  }

  .message-bubble {
    display: grid;
    gap: 0.35rem;
    padding: 0.9rem 1rem;
    border-radius: 16px 16px 16px 6px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    max-width: min(100%, 44rem);
  }

  .message-bubble.is-own {
    margin-left: auto;
    border-radius: 16px 16px 6px 16px;
    background: color-mix(in srgb, var(--culoca-orange) 12%, var(--bg-primary) 88%);
    border-color: color-mix(in srgb, var(--culoca-orange) 28%, var(--border-color) 72%);
  }

  .message-bubble p {
    margin: 0;
    white-space: pre-wrap;
    line-height: 1.5;
  }

  .message-bubble__item,
  .message-bubble time {
    color: var(--text-secondary);
    font-size: 0.85rem;
  }

  .chat-compose {
    display: grid;
    gap: 0.75rem;
    margin-top: auto;
  }

  .chat-compose textarea {
    resize: vertical;
    min-height: 7rem;
  }

  .chat-compose__actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .chat-placeholder {
    display: grid;
    align-content: center;
    justify-items: start;
    min-height: 50vh;
  }

  .chat-login-prompt {
    width: min(560px, 100%);
    margin: 3rem auto;
    display: grid;
    gap: 1rem;
    justify-items: start;
  }

  @media (max-width: 980px) {
    .chat-workspace {
      grid-template-columns: 1fr;
    }

    .page.is-embedded .chat-workspace {
      grid-template-columns: 1fr;
    }

    .chat-thread {
      min-height: auto;
    }
  }

  @media (max-width: 640px) {
    .chat-page {
      width: min(100%, calc(100% - 1rem));
      padding-top: 1rem;
    }

    .chat-shell__header,
    .chat-search,
    .chat-conversations,
    .chat-thread,
    .chat-login-prompt {
      padding: 0.9rem;
      border-radius: 18px;
    }

    .chat-search__bar,
    .chat-compose__actions,
    .chat-search-entry__actions {
      flex-direction: column;
      align-items: stretch;
    }

    .chat-item-card {
      grid-template-columns: 1fr;
    }

    .chat-item-card img {
      width: 100%;
      height: auto;
      aspect-ratio: 1 / 1;
    }

    .conversation-card__header {
      align-items: start;
    }
  }
</style>
