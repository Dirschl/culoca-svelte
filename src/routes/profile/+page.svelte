<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { onDestroy, onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import SiteNav from '$lib/SiteNav.svelte';
	import { getPublicItemHref } from '$lib/content/routing';
	import { getSeoImageUrl } from '$lib/utils/seoImageUrl';
	import { sanitizeReturnTo } from '$lib/returnTo';
	import { browser } from '$app/environment';
	import SiteFooter from '$lib/SiteFooter.svelte';
	import ProfileDashboardNav from '$lib/profile/ProfileDashboardNav.svelte';
	import ProfileSectionAttribution from '$lib/profile/sections/ProfileSectionAttribution.svelte';
	import ProfileSectionPrivacy from '$lib/profile/sections/ProfileSectionPrivacy.svelte';
	import ProfileSectionGps from '$lib/profile/sections/ProfileSectionGps.svelte';
	import ProfileSectionContact from '$lib/profile/sections/ProfileSectionContact.svelte';
	import ProfileSectionSocial from '$lib/profile/sections/ProfileSectionSocial.svelte';
	import type { ProfileSection } from '$lib/profile/profileSection';
	import { isProfileSection } from '$lib/profile/profileSection';

	let user: any = null;
	let profile: any = null;
	let loading = true;
	let saving = false;
	let error = '';
	let success = '';
	let avatarFile: File | null = null;
	let avatarPreview: string | null = null;
	let message = '';
	let messageType: 'success' | 'error' = 'success';

	// Profile fields
	let name = '';
	let address = '';
	let phone = '';
	let website = '';
	let instagram = '';
	let facebook = '';
	let twitter = '';
	let visible = true;
	let show_phone = false;
	let show_address = false;
	let show_website = false;
	let show_social = false;
	let email = '';
	let show_email = false;
	let accountname = '';
	let accountnameChecking = false;
	let accountnameAvailable = true;
	let accountnameMessage = '';
	let accountnameTimeout: NodeJS.Timeout;
	let privacy_mode = 'public'; // 'public', 'private', 'all'

	// Attribution & Rechte (für Google Bilder / Meta / JSON-LD)
	let display_name_public = '';
	let legal_entity_name = '';
	let copyright_holder_name = '';
	let default_creator_name = '';
	let default_credit_text = '';
	let default_copyright_notice = '';
	let default_license_url = '';
	let default_author_meta = '';
	let organization_name = '';
	let use_exif_creator_override = false;
	let use_exif_credit_override = false;
	let use_exif_copyright_override = false;
	let photographer_label_mode = 'auto';
	let public_contact_name = '';

	// GPS Tracking Settings
	let homeLat = '';
	let homeLon = '';
	let gpsTrackingEnabled = false;
	let gpxExportEnabled = false;
	let lastDataShareEnabled = false;
	let gpsEmail = '';
	let showGpsSettings = false;

	let errorLogExists = false;
	let errorLogUrl = '';
	let userId = '';
	let errorLogFiles: string[] = [];
	let returnTo = '/';
	let interactionLoading = true;
	let conversations: any[] = [];
	let conversationLoading = true;
	let selectedConversationId = '';
	let conversationMessages: any[] = [];
	let messagesLoading = false;
	let messageDraft = '';
	let messageSendLoading = false;
	let messageStatus = '';

	// Notifications (für später/Dev-Features; auch wenn UI aktuell nicht genutzt wird)
	let notifications: any[] = [];
	let unreadNotifications = 0;
	let liveChannels: any[] = [];
	let activeMessageChannel: any = null;
	let messageListElement: HTMLDivElement | null = null;

	$: nameValid = name.length >= 2 && name.length <= 60;
	$: phoneValid = phone.length === 0 || /^\+?[0-9\- ]{7,20}$/.test(phone);
	$: websiteValid = website.length === 0 || website.startsWith('http');
	$: instagramValid = instagram.length === 0 || instagram.startsWith('https://');
	$: facebookValid = facebook.length === 0 || facebook.startsWith('https://');
	$: twitterValid = twitter.length === 0 || twitter.startsWith('https://');
	$: accountnameValid =
		accountname.length === 0 ||
		(accountname.length >= 3 && accountname.length <= 30 && /^[a-z0-9_-]+$/.test(accountname));

	// Reserved accountnames that can't be used
	const reservedAccountnames = [
		'admin',
		'api',
		'www',
		'mail',
		'support',
		'help',
		'info',
		'contact',
		'about',
		'privacy',
		'terms',
		'login',
		'logout',
		'signup',
		'register',
		'auth',
		'callback',
		'profile',
		'settings',
		'dashboard',
		'user',
		'users',
		'account',
		'accounts',
		'home',
		'index',
		'root',
		'blog',
		'news',
		'events',
		'upload',
		'uploads',
		'download',
		'downloads',
		'file',
		'files',
		'image',
		'images',
		'photo',
		'photos',
		'item',
		'items',
		'gallery',
		'map',
		'search',
		'explore',
		'discover',
		'trending',
		'popular',
		'debug',
		'test',
		'dev',
		'staging',
		'production',
		'app',
		'mobile',
		'web',
		'static',
		'assets',
		'css',
		'js',
		'img',
		'fonts',
		'icons',
		'favicon',
		'robots',
		'sitemap',
		'manifest',
		'bulk-upload',
		'simulation',
		'newsflash',
		'filter',
		'location'
	];

	$: isReservedAccountname = reservedAccountnames.includes(accountname.toLowerCase());

	let activeProfileSection: ProfileSection = 'basics';

	function profileSectionTitle(section: ProfileSection): string {
		switch (section) {
			case 'basics':
				return 'Profil & Konto';
			case 'attribution':
				return 'Attribution & Rechte';
			case 'privacy':
				return 'Privatsphäre';
			case 'gps':
				return 'GPS & Home Base';
			case 'contact':
				return 'Kontakt & Info';
			case 'social':
				return 'Social Media';
			case 'errorlog':
				return 'Fehlerprotokoll';
			default:
				return 'Profil';
		}
	}

	function setProfileSection(section: ProfileSection) {
		if (section === 'errorlog' && !errorLogExists) return;
		activeProfileSection = section;
		if (!browser) return;
		const u = new URL(window.location.href);
		u.searchParams.set('section', section);
		const q = u.searchParams.toString();
		void goto(`${u.pathname}?${q}`, { replaceState: true, noScroll: true, keepFocus: true });
	}

	$: if (browser && !loading) {
		const param = $page.url.searchParams.get('section');
		if (isProfileSection(param)) {
			if (param === 'errorlog' && !errorLogExists) {
				activeProfileSection = 'basics';
			} else {
				activeProfileSection = param;
			}
		}
	}

	onMount(async () => {
		returnTo = sanitizeReturnTo($page.url.searchParams.get('returnTo'), getReferrerFallback());
		const {
			data: { user: currentUser }
		} = await supabase.auth.getUser();
		if (!currentUser) {
			goto('/');
			return;
		}
		user = currentUser;
		await Promise.all([loadProfile()]);
		loading = false;
		userId = user.id;
		const { data, error } = await supabase.storage.from('errorlogs').list('');
		if (data) {
			errorLogFiles = data.map((f: any) => f.name);
			if (data.find((f: any) => f.name === `${user.id}.json`)) {
				errorLogExists = true;
				const { data: urlData } = await supabase.storage
					.from('errorlogs')
					.createSignedUrl(`${user.id}.json`, 60);
				if (urlData?.signedUrl) errorLogUrl = urlData.signedUrl;
			}
		}

		setupLiveChannels(currentUser.id);
	});

	onDestroy(() => {
		teardownLiveChannels();
		teardownMessageChannel();
	});

	async function loadProfile() {
		try {
			const { data, error } = await supabase
				.from('profiles')
				.select('*')
				.eq('id', user.id)
				.single();
			if (error && error.code !== 'PGRST116') throw error;
			if (data) {
				profile = data;
				name = data.full_name || '';
				address = data.address || '';
				phone = data.phone || '';
				website = data.website || '';
				instagram = data.instagram || '';
				facebook = data.facebook || '';
				twitter = data.twitter || '';
				email = data.email || '';
				accountname = data.accountname || '';
				privacy_mode = data.privacy_mode || 'public';
				show_address = data.show_address ?? false;
				show_phone = data.show_phone ?? false;
				show_website = data.show_website ?? false;
				show_social = data.show_social ?? false;
				show_email = data.show_email ?? false;

				// Attribution & Rechte
				display_name_public = data.display_name_public ?? '';
				legal_entity_name = data.legal_entity_name ?? '';
				copyright_holder_name = data.copyright_holder_name ?? '';
				default_creator_name = data.default_creator_name ?? '';
				default_credit_text = data.default_credit_text ?? '';
				default_copyright_notice = data.default_copyright_notice ?? '';
				default_license_url = data.default_license_url ?? '';
				default_author_meta = data.default_author_meta ?? '';
				organization_name = data.organization_name ?? '';
				use_exif_creator_override = data.use_exif_creator_override ?? false;
				use_exif_credit_override = data.use_exif_credit_override ?? false;
				use_exif_copyright_override = data.use_exif_copyright_override ?? false;
				photographer_label_mode = data.photographer_label_mode ?? 'auto';
				public_contact_name = data.public_contact_name ?? '';

				// Load GPS settings
				homeLat = data.home_lat ? data.home_lat.toString() : '';
				homeLon = data.home_lon ? data.home_lon.toString() : '';
				gpsTrackingEnabled = data.gps_tracking_enabled ?? false;
				gpxExportEnabled = data.gpx_export_enabled ?? false;
				lastDataShareEnabled = data.last_data_share_enabled ?? false;
				gpsEmail = data.gps_email || '';
			}
		} catch (error) {
			console.error('Error loading profile:', error);
		}
	}

	interactionLoading = false;

	function teardownLiveChannels() {
		for (const channel of liveChannels) {
			supabase.removeChannel(channel);
		}
		liveChannels = [];
	}

	function teardownMessageChannel() {
		if (activeMessageChannel) {
			supabase.removeChannel(activeMessageChannel);
			activeMessageChannel = null;
		}
	}

	function setupLiveChannels(currentUserId: string) {
		teardownLiveChannels();

		if (!currentUserId) return;

		const conversationsChannel = supabase
			.channel(`profile-conversations-${currentUserId}`)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'user_conversations',
					filter: `user_a_id=eq.${currentUserId}`
				},
				async () => {
					await loadConversations(selectedConversationId || null);
				}
			)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'user_conversations',
					filter: `user_b_id=eq.${currentUserId}`
				},
				async () => {
					await loadConversations(selectedConversationId || null);
				}
			)
			.subscribe();

		liveChannels = [conversationsChannel];
	}

	function setupMessageChannel(conversationId: string) {
		teardownMessageChannel();

		if (!conversationId) return;

		activeMessageChannel = supabase
			.channel(`profile-messages-${conversationId}`)
			.on(
				'postgres_changes',
				{
					event: 'INSERT',
					schema: 'public',
					table: 'user_messages',
					filter: `conversation_id=eq.${conversationId}`
				},
				async () => {
					await loadConversationMessages(conversationId);
					const activeConversation = conversations.find(
						(entry: any) => entry.id === conversationId
					);
					if (activeConversation) {
						await markConversationRead(activeConversation);
					}
				}
			)
			.subscribe();
	}

	function getAvatarUrl(profileEntry: any) {
		const avatarUrl = profileEntry?.avatar_url;
		if (!avatarUrl) return '';
		if (String(avatarUrl).startsWith('http')) return avatarUrl;
		return `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/avatars/${avatarUrl}`;
	}

	function buildParticipantKey(firstUserId: string, secondUserId: string) {
		return [firstUserId, secondUserId].sort().join(':');
	}

	function getOtherConversationUser(entry: any) {
		if (!entry || !user?.id) return null;
		return entry.user_a_id === user.id ? entry.user_b : entry.user_a;
	}

	function getOwnConversationReadAt(entry: any) {
		if (!entry || !user?.id) return null;
		return entry.user_a_id === user.id ? entry.user_a_last_read_at : entry.user_b_last_read_at;
	}

	function getConversationUnread(entry: any) {
		if (!entry || !user?.id || !entry.last_message_at) return false;
		if (entry.last_message_sender_id === user.id) return false;
		const ownReadAt = getOwnConversationReadAt(entry);
		return !ownReadAt || new Date(entry.last_message_at).getTime() > new Date(ownReadAt).getTime();
	}

	function getConversationHref(entry: any) {
		if (!entry?.id) return '/';
		return `/chat?conversation=${encodeURIComponent(entry.id)}`;
	}

	async function loadConversations(preferredConversationId: string | null = null) {
		if (!user?.id) return;

		conversationLoading = true;

		try {
			const { data, error } = await supabase
				.from('user_conversations')
				.select(
					`
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
        `
				)
				.or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
				.order('last_message_at', { ascending: false });

			if (error) throw error;

			conversations = (data || []).map((entry: any) => ({
				...entry,
				otherUser: entry.user_a_id === user.id ? entry.user_b : entry.user_a
			}));

			const nextConversationId =
				preferredConversationId ||
				selectedConversationId ||
				($page.url.searchParams.get('conversation') || '').trim() ||
				conversations[0]?.id ||
				'';

			if (nextConversationId) {
				const conversation = conversations.find((entry: any) => entry.id === nextConversationId);
				if (conversation) {
					await selectConversation(conversation, false);
				} else {
					selectedConversationId = '';
					conversationMessages = [];
					teardownMessageChannel();
				}
			} else {
				selectedConversationId = '';
				conversationMessages = [];
				teardownMessageChannel();
			}
		} catch (error) {
			console.error('Error loading conversations:', error);
			conversations = [];
			selectedConversationId = '';
			conversationMessages = [];
			teardownMessageChannel();
		} finally {
			conversationLoading = false;
		}
	}

	async function loadConversationMessages(conversationId: string) {
		if (!conversationId || !user?.id) {
			conversationMessages = [];
			return;
		}

		messagesLoading = true;

		try {
			const { data, error } = await supabase
				.from('user_messages')
				.select(
					`
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
        `
				)
				.eq('conversation_id', conversationId)
				.order('created_at', { ascending: true });

			if (error) throw error;

			conversationMessages = (data || []).map((entry: any) => ({
				...entry,
				item: entry.items || null
			}));
			await scrollMessagesToBottom();
		} catch (error) {
			console.error('Error loading conversation messages:', error);
			conversationMessages = [];
		} finally {
			messagesLoading = false;
		}
	}

	async function markConversationRead(conversation: any) {
		if (!conversation?.id || !user?.id) return;

		const updateColumn =
			conversation.user_a_id === user.id ? 'user_a_last_read_at' : 'user_b_last_read_at';
		const now = new Date().toISOString();

		try {
			const { error } = await supabase
				.from('user_conversations')
				.update({ [updateColumn]: now, updated_at: now })
				.eq('id', conversation.id);

			if (error) throw error;

			conversations = conversations.map((entry: any) =>
				entry.id === conversation.id
					? {
							...entry,
							[updateColumn]: now
						}
					: entry
			);
		} catch (error) {
			console.error('Error marking conversation as read:', error);
		}
	}

	async function selectConversation(conversation: any, shouldMarkRead = true) {
		if (!conversation?.id) return;

		selectedConversationId = conversation.id;
		messageStatus = '';
		setupMessageChannel(conversation.id);
		await loadConversationMessages(conversation.id);

		if (shouldMarkRead && getConversationUnread(conversation)) {
			await markConversationRead(conversation);
		}
	}

	async function ensureConversation(otherUserId: string, starterItemId: string | null = null) {
		if (!user?.id || !otherUserId || otherUserId === user.id) return null;

		const participantKey = buildParticipantKey(user.id, otherUserId);
		const now = new Date().toISOString();

		const existingConversation =
			conversations.find((entry: any) => entry.participant_key === participantKey) || null;

		if (existingConversation) {
			return existingConversation;
		}

		const userAId = [user.id, otherUserId].sort()[0];
		const userBId = [user.id, otherUserId].sort()[1];

		try {
			const { data, error } = await supabase
				.from('user_conversations')
				.insert({
					participant_key: participantKey,
					user_a_id: userAId,
					user_b_id: userBId,
					starter_item_id: starterItemId,
					created_by_user_id: user.id,
					last_message_at: now,
					user_a_last_read_at: userAId === user.id ? now : null,
					user_b_last_read_at: userBId === user.id ? now : null,
					updated_at: now
				})
				.select(
					`
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
        `
				)
				.single();

			if (error) throw error;

			const conversation = {
				...data,
				otherUser: data.user_a_id === user.id ? data.user_b : data.user_a
			};
			conversations = [conversation, ...conversations];
			return conversation;
		} catch (error: any) {
			if (error?.code === '23505') {
				await loadConversations();
				return conversations.find((entry: any) => entry.participant_key === participantKey) || null;
			}

			console.error('Error ensuring conversation:', error);
			return null;
		}
	}

	async function handleInitialConversationIntent() {
		if (!user?.id) return;

		const chatWith = ($page.url.searchParams.get('chatWith') || '').trim();
		const conversationId = ($page.url.searchParams.get('conversation') || '').trim();
		const itemId = ($page.url.searchParams.get('item') || '').trim() || null;

		if (chatWith && chatWith !== user.id) {
			const conversation = await ensureConversation(chatWith, itemId);
			if (conversation) {
				await selectConversation(conversation);
			}
			return;
		}

		if (conversationId) {
			const conversation = conversations.find((entry: any) => entry.id === conversationId);
			if (conversation) {
				await selectConversation(conversation);
			}
		}
	}

	async function sendMessage() {
		const body = messageDraft.trim();
		const conversation = conversations.find((entry: any) => entry.id === selectedConversationId);

		if (!user?.id || !conversation?.id) return;
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
					sender_user_id: user.id,
					item_id: conversation.starter_item_id || null,
					body
				})
				.select(
					`
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
        `
				)
				.single();

			if (error) throw error;

			const readColumn =
				conversation.user_a_id === user.id ? 'user_a_last_read_at' : 'user_b_last_read_at';
			const { error: updateError } = await supabase
				.from('user_conversations')
				.update({
					last_message_at: now,
					last_message_preview: body.slice(0, 180),
					last_message_sender_id: user.id,
					[readColumn]: now,
					updated_at: now
				})
				.eq('id', conversation.id);

			if (updateError) throw updateError;

			conversationMessages = [
				...conversationMessages,
				{
					...data,
					item: data.items || null
				}
			];
			messageDraft = '';
			await scrollMessagesToBottom();

			conversations = conversations
				.map((entry: any) =>
					entry.id === conversation.id
						? {
								...entry,
								last_message_at: now,
								last_message_preview: body.slice(0, 180),
								last_message_sender_id: user.id,
								[readColumn]: now
							}
						: entry
				)
				.sort(
					(left: any, right: any) =>
						new Date(right.last_message_at || 0).getTime() -
						new Date(left.last_message_at || 0).getTime()
				);

			const recipientUserId =
				conversation.user_a_id === user.id ? conversation.user_b_id : conversation.user_a_id;
			if (recipientUserId && recipientUserId !== user.id) {
				await supabase.from('user_notifications').insert({
					recipient_user_id: recipientUserId,
					actor_user_id: user.id,
					item_id: conversation.starter_item_id || null,
					event_type: 'chat_message',
					payload: {
						conversation_id: conversation.id,
						message_excerpt: body.slice(0, 180),
						starter_item_id: conversation.starter_item_id || null
					}
				});
			}

			if (conversation.starter_item_id) {
				await supabase.from('item_events').insert({
					item_id: conversation.starter_item_id,
					actor_user_id: user.id,
					owner_user_id: conversation.starter_item?.profile_id || null,
					event_type: 'chat_message',
					source: 'profile_chat',
					metadata: {
						conversation_id: conversation.id,
						message_id: data.id,
						message_excerpt: body.slice(0, 180),
						starter_item_id: conversation.starter_item_id
					}
				});
			}
		} catch (error) {
			console.error('Error sending message:', error);
			messageStatus = 'Nachricht konnte gerade nicht gesendet werden.';
		} finally {
			messageSendLoading = false;
		}
	}

	async function scrollMessagesToBottom() {
		await tick();
		if (messageListElement) {
			messageListElement.scrollTop = messageListElement.scrollHeight;
		}
	}

	async function handleMessageKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' || event.shiftKey) return;
		event.preventDefault();
		await sendMessage();
	}

	function getItemPreviewUrl(item: any) {
		return item?.slug && item?.path_512 ? getSeoImageUrl(item.slug, item.path_512, '512') : '';
	}

	function formatCommentDate(value: string | null | undefined) {
		if (!value) return '';
		return new Date(value).toLocaleString('de-DE', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getNotificationActor(entry: any) {
		return entry?.actor?.full_name || entry?.actor?.accountname || 'Jemand';
	}

	function getNotificationLabel(entry: any) {
		switch (entry?.event_type) {
			case 'download':
				return 'hat dein Bild heruntergeladen';
			case 'favorite_add':
				return 'hat dein Bild gemerkt';
			case 'like_add':
				return 'findet dein Bild gut';
			case 'comment_create':
				return 'hat kommentiert';
			case 'chat_message':
				return 'hat dir geschrieben';
			case 'follow_create':
				return 'folgt jetzt deinem Profil';
			default:
				return 'hat interagiert';
		}
	}

	function getNotificationHref(entry: any) {
		if (entry?.event_type === 'chat_message' && entry?.payload?.conversation_id) {
			return `/chat?conversation=${encodeURIComponent(entry.payload.conversation_id)}`;
		}

		if (entry?.event_type === 'follow_create' && entry?.actor?.accountname) {
			return `/${encodeURIComponent(entry.actor.accountname)}`;
		}

		return entry.item ? getPublicItemHref(entry.item) : '#';
	}

	function getNotificationPreview(entry: any) {
		if (entry?.event_type === 'chat_message' && entry?.payload?.message_excerpt) {
			return entry.payload.message_excerpt;
		}

		if (entry?.event_type === 'comment_create' && entry?.payload?.comment_excerpt) {
			return entry.payload.comment_excerpt;
		}

		if (entry?.event_type === 'follow_create') {
			return 'Neuer Follower';
		}

		return '';
	}

	async function markNotificationRead(notificationId: string) {
		if (!notificationId) return;

		try {
			const { error } = await supabase
				.from('user_notifications')
				.update({ read_at: new Date().toISOString() })
				.eq('id', notificationId)
				.is('read_at', null);

			if (error) throw error;

			notifications = notifications.map((entry: any) =>
				entry.id === notificationId
					? {
							...entry,
							read_at: entry.read_at || new Date().toISOString()
						}
					: entry
			);
			unreadNotifications = notifications.filter((entry: any) => !entry.read_at).length;
		} catch (error) {
			console.error('Error marking notification as read:', error);
		}
	}

	async function markAllNotificationsRead() {
		if (!user?.id || unreadNotifications === 0) return;

		try {
			const { error } = await supabase
				.from('user_notifications')
				.update({ read_at: new Date().toISOString() })
				.eq('recipient_user_id', user.id)
				.is('read_at', null);

			if (error) throw error;

			const now = new Date().toISOString();
			notifications = notifications.map((entry: any) => ({
				...entry,
				read_at: entry.read_at || now
			}));
			unreadNotifications = 0;
		} catch (error) {
			console.error('Error marking all notifications as read:', error);
		}
	}

	function handleAvatarChange(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			avatarFile = input.files[0];
			avatarPreview = URL.createObjectURL(avatarFile);
		}
	}

	async function uploadAvatar() {
		if (!avatarFile) return null;
		try {
			const fileExt = avatarFile.name.split('.').pop();
			const fileName = `${user.id}-${Date.now()}.${fileExt}`;
			const { error } = await supabase.storage.from('avatars').upload(fileName, avatarFile);
			if (error) throw error;
			return fileName;
		} catch (error) {
			console.error('Error uploading avatar:', error);
			throw error;
		}
	}

	function debouncedCheckAccountname() {
		if (accountnameTimeout) {
			clearTimeout(accountnameTimeout);
		}

		accountnameTimeout = setTimeout(() => {
			checkAccountnameAvailability();
		}, 500);
	}

	async function checkAccountnameAvailability() {
		if (!accountname || !accountnameValid || isReservedAccountname) {
			accountnameAvailable = false;
			accountnameMessage = '';
			return;
		}

		accountnameChecking = true;
		accountnameMessage = '';

		try {
			const { data, error } = await supabase
				.from('profiles')
				.select('id')
				.eq('accountname', accountname.toLowerCase())
				.neq('id', user.id);

			if (error) throw error;

			accountnameAvailable = data.length === 0;
			if (!accountnameAvailable) {
				accountnameMessage = 'Dieser Accountname ist bereits vergeben';
			} else {
				accountnameMessage = 'Accountname ist verfügbar';
			}
		} catch (error) {
			console.error('Error checking accountname:', error);
			accountnameAvailable = false;
			accountnameMessage = 'Fehler bei der Überprüfung';
		} finally {
			accountnameChecking = false;
		}
	}

	async function saveProfile() {
		saving = true;
		message = '';
		try {
			// Check accountname availability before saving if accountname is set
			if (accountname && (!accountnameAvailable || isReservedAccountname)) {
				showMessage('Bitte wähle einen gültigen und verfügbaren Accountname', 'error');
				saving = false;
				return;
			}

			let avatarPath = profile?.avatar_url;
			if (avatarFile) {
				avatarPath = await uploadAvatar();
			}

			// Check if privacy mode changed to sync items
			const oldPrivacyMode = profile?.privacy_mode;
			const privacyModeChanged = oldPrivacyMode !== privacy_mode;

			const profileData = {
				id: user.id,
				full_name: name,
				address,
				phone,
				website,
				instagram,
				facebook,
				twitter,
				accountname: accountname ? accountname.toLowerCase() : null,
				privacy_mode: privacy_mode,
				show_address: show_address,
				show_phone: show_phone,
				show_website: show_website,
				show_social: show_social,
				avatar_url: avatarPath,
				updated_at: new Date().toISOString(),
				email,
				show_email,
				home_lat: homeLat ? parseFloat(homeLat) : null,
				home_lon: homeLon ? parseFloat(homeLon) : null,
				gps_tracking_enabled: gpsTrackingEnabled,
				gpx_export_enabled: gpxExportEnabled,
				last_data_share_enabled: lastDataShareEnabled,
				gps_email: gpsEmail,

				// Attribution & Rechte
				display_name_public,
				legal_entity_name,
				copyright_holder_name,
				default_creator_name,
				default_credit_text,
				default_copyright_notice,
				default_license_url,
				default_author_meta,
				organization_name,
				use_exif_creator_override,
				use_exif_credit_override,
				use_exif_copyright_override,
				photographer_label_mode,
				public_contact_name
			};

			// Update profile
			const { error } = await supabase.from('profiles').upsert(profileData, { onConflict: 'id' });
			if (error) throw error;

			// Sync is_private field in items table if privacy mode changed
			if (privacyModeChanged) {
				console.log('Privacy mode changed, syncing items...');
				await syncItemsPrivacy();
			}

			profile = profileData;
			showMessage('Profil erfolgreich gespeichert!', 'success');
			if (avatarPreview) {
				URL.revokeObjectURL(avatarPreview);
				avatarPreview = null;
			}
			avatarFile = null;

			setTimeout(() => goto(returnTo), 500);
		} catch (error) {
			console.error('Error saving profile:', error);
			showMessage('Fehler beim Speichern des Profils', 'error');
		} finally {
			saving = false;
		}
	}

	async function syncItemsPrivacy() {
		try {
			// Update is_private field in all user's items based on privacy mode
			// Only 'private' mode makes items private, all other modes (public, closed, all) are public
			const isPrivate = privacy_mode === 'private';

			const { error } = await supabase
				.from('items')
				.update({ is_private: isPrivate })
				.eq('profile_id', user.id);

			if (error) throw error;

			console.log(
				`Updated is_private field to ${isPrivate} for all items of user ${user.id} (privacy_mode: ${privacy_mode})`
			);
		} catch (error) {
			console.error('Error syncing items privacy:', error);
			throw error;
		}
	}

	function showMessage(text: string, type: 'success' | 'error') {
		message = text;
		messageType = type;
		setTimeout(() => {
			message = '';
		}, 5000);
	}

	function getProfileAvatarUrl() {
		if (avatarPreview) return avatarPreview;
		if (profile?.avatar_url) {
			if (profile.avatar_url.startsWith('http')) {
				return profile.avatar_url;
			} else {
				return `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/avatars/${profile.avatar_url}`;
			}
		}
		return null;
	}

	async function downloadErrorLog() {
		if (errorLogUrl) {
			window.open(errorLogUrl, '_blank');
		}
	}

	async function deleteErrorLog() {
		if (!userId) return;
		await supabase.storage.from('errorlogs').remove([`${userId}.json`]);
		errorLogExists = false;
		errorLogUrl = '';
	}

	function getReferrerFallback() {
		if (typeof window === 'undefined' || !document.referrer) return '/';

		try {
			const referrerUrl = new URL(document.referrer);
			if (referrerUrl.origin !== window.location.origin) return '/';
			if (referrerUrl.pathname === $page.url.pathname) return '/';
			return sanitizeReturnTo(
				`${referrerUrl.pathname}${referrerUrl.search}${referrerUrl.hash}`,
				'/'
			);
		} catch {
			return '/';
		}
	}

	async function signOut() {
		await supabase.auth.signOut();
		goto('/');
	}
</script>

<svelte:head>
	<title>Mein Profil - Culoca</title>

	<!-- Strukturierte Daten (JSON-LD) für bessere SEO -->
	{@html `<script type="application/ld+json">
  ${JSON.stringify(
		{
			'@context': 'https://schema.org',
			'@type': 'WebPage',
			name: 'Mein Profil - Culoca',
			description:
				'Verwalte dein Culoca-Profil - Persönliche Informationen, Einstellungen und mehr',
			url: 'https://culoca.com/profile',
			inLanguage: 'de',
			publisher: {
				'@type': 'Organization',
				name: 'Culoca',
				url: 'https://culoca.com'
			}
		},
		null,
		2
	)}
  </script>`}
</svelte:head>

<SiteNav />

<main class="dashboard-page profile-dashboard-page">

	{#if loading}
		<div class="loading-container">
			<div class="spinner"></div>
			<span>Lade Profil...</span>
		</div>
	{:else}
		<section class="dashboard-page__hero profile-dashboard__hero">
			<div class="profile-dashboard__hero-row">
				<div>
					<h1 class="profile-dashboard__title">Mein Profil</h1>
					<p class="profile-dashboard__sub">Persönliche Daten, Attribution und Sichtbarkeit.</p>
				</div>
				<button type="button" class="signout-btn" on:click={signOut}>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
						<path
							d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"
						/>
					</svg>
					Abmelden
				</button>
			</div>
		</section>

		<section class="dashboard-layout">
			<aside class="dashboard-column dashboard-column--menu">
				<ProfileDashboardNav
					active={activeProfileSection}
					showErrorLog={errorLogExists}
					on:select={(e) => setProfileSection(e.detail)}
				/>
			</aside>
			<section class="dashboard-column dashboard-column--content">
				<div class="panel-head">
					<h2>{profileSectionTitle(activeProfileSection)}</h2>
					{#if activeProfileSection !== 'errorlog'}
						<span class="panel-head__hint">Änderungen unten mit „Profil speichern“ sichern.</span>
					{/if}
				</div>

				<div class="profile-content profile-dashboard__inner">
				<!-- Avatar-Sektion -->
				<div
					class="profile-section"
					class:profile-section--hidden={activeProfileSection !== 'basics'}
				>
				<div class="avatar-section">
					<div class="avatar-container">
						{#if getProfileAvatarUrl()}
							<img src={getProfileAvatarUrl()} alt="Profilbild" class="profile-avatar" />
						{:else}
							<div class="avatar-placeholder">
								<svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
									<circle cx="12" cy="8" r="4" />
									<path d="M2 20c0-4 8-6 10-6s10 2 10 6" />
								</svg>
							</div>
						{/if}
						<div class="avatar-actions">
							<label for="avatar-input" class="avatar-btn primary">
								<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
									<path
										d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"
									/>
								</svg>
								{getProfileAvatarUrl() ? 'Ändern' : 'Hochladen'}
							</label>
							{#if getProfileAvatarUrl()}
								<button
									type="button"
									class="avatar-btn secondary"
									on:click={() => {
										avatarFile = null;
										avatarPreview = null;
										profile.avatar_url = null;
									}}
								>
									Entfernen
								</button>
							{/if}
						</div>
						<input
							id="avatar-input"
							type="file"
							accept="image/*"
							on:change={handleAvatarChange}
							class="hidden"
						/>
					</div>
					<div class="user-info">
						<h2 class="user-name">{name || 'Unbekannter Benutzer'}</h2>
						<p class="user-email">{user.email}</p>
					</div>
				</div>
				</div>

				<!-- Profil-Formular -->
				<form
					class="profile-form"
					class:profile-section--hidden={activeProfileSection === 'errorlog'}
					on:submit|preventDefault={saveProfile}
				>
					<!-- Persönliche Informationen -->
					<div
						class="profile-section"
						class:profile-section--hidden={activeProfileSection !== 'basics'}
					>
					<div class="card">
						<h3 class="section-title">
							<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
								<path
									d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
								/>
							</svg>
							Persönliche Informationen
						</h3>
						<div class="form-group">
							<label for="fullName">Vollständiger Name</label>
							<input
								id="fullName"
								type="text"
								bind:value={name}
								placeholder="Dein vollständiger Name"
								class:valid={nameValid}
								class:invalid={name.length > 0 && !nameValid}
							/>
							{#if name.length > 0 && !nameValid}
								<span class="error-text">Name muss zwischen 2 und 60 Zeichen lang sein</span>
							{/if}
						</div>

						<div class="form-group">
							<label for="accountname">Accountname (für Permalinks)</label>
							<div class="accountname-input-group">
								<span class="url-prefix">culoca.com/</span>
								<input
									id="accountname"
									type="text"
									bind:value={accountname}
									placeholder="mein-accountname"
									class:valid={accountnameValid &&
										accountnameAvailable &&
										!isReservedAccountname &&
										accountname.length > 0}
									class:invalid={accountname.length > 0 &&
										(!accountnameValid || isReservedAccountname || !accountnameAvailable)}
									on:input={debouncedCheckAccountname}
									on:blur={checkAccountnameAvailability}
								/>
								{#if accountnameChecking}
									<div class="checking-spinner">
										<svg
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="currentColor"
											class="animate-spin"
										>
											<path
												d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z"
												opacity=".25"
											/>
											<path
												d="M12,4a8,8,0,0,1,7.89,6.7A1.53,1.53,0,0,0,21.38,12h0a1.5,1.5,0,0,0,1.48-1.75,11,11,0,0,0-21.72,0A1.5,1.5,0,0,0,2.62,12h0a1.53,1.53,0,0,0,1.49-1.3A8,8,0,0,1,12,4Z"
											/>
										</svg>
									</div>
								{/if}
							</div>
							{#if accountname.length > 0}
								{#if !accountnameValid}
									<span class="error-text"
										>3-30 Zeichen, nur Kleinbuchstaben, Zahlen, Bindestriche und Unterstriche</span
									>
								{:else if isReservedAccountname}
									<span class="error-text">Dieser Accountname ist reserviert</span>
								{:else if accountnameMessage}
									<span class="success-text" class:error-text={!accountnameAvailable}
										>{accountnameMessage}</span
									>
								{/if}
							{:else}
								<span class="help-text"
									>Optional: Erstelle einen personalisierten Link zu deinem Profil</span
								>
							{/if}
						</div>
					</div>
					</div>

					<!-- Attribution & Rechte -->
					<div
						class="profile-section"
						class:profile-section--hidden={activeProfileSection !== 'attribution'}
					>
						<ProfileSectionAttribution
							bind:display_name_public
							bind:default_creator_name
							bind:legal_entity_name
							bind:copyright_holder_name
							bind:organization_name
							bind:public_contact_name
							bind:default_credit_text
							bind:default_copyright_notice
							bind:default_author_meta
							bind:default_license_url
							bind:use_exif_creator_override
							bind:use_exif_credit_override
							bind:use_exif_copyright_override
						/>
					</div>

					<!-- Privatsphäre-Einstellungen -->
					<div
						class="profile-section"
						class:profile-section--hidden={activeProfileSection !== 'privacy'}
					>
						<ProfileSectionPrivacy bind:privacy_mode />
					</div>

					<!-- GPS-Tracking-Einstellungen -->
					<div
						class="profile-section"
						class:profile-section--hidden={activeProfileSection !== 'gps'}
					>
						<ProfileSectionGps
							bind:homeLat
							bind:homeLon
							bind:gpsEmail
							bind:gpsTrackingEnabled
							bind:gpxExportEnabled
							bind:lastDataShareEnabled
						/>
					</div>

					<!-- Kontakt & Info -->
					<div
						class="profile-section"
						class:profile-section--hidden={activeProfileSection !== 'contact'}
					>
						<ProfileSectionContact
							phoneValid={phoneValid}
							websiteValid={websiteValid}
							bind:address
							bind:show_address
							bind:phone
							bind:show_phone
							bind:email
							bind:show_email
							bind:website
							bind:show_website
						/>
					</div>

					<!-- Social Media -->
					<div
						class="profile-section"
						class:profile-section--hidden={activeProfileSection !== 'social'}
					>
						<ProfileSectionSocial
							facebookValid={facebookValid}
							instagramValid={instagramValid}
							twitterValid={twitterValid}
							bind:facebook
							bind:instagram
							bind:twitter
							bind:show_social
						/>
					</div>

					<!-- Actions -->
					<div
						class="profile-section profile-section--actions"
						class:profile-section--hidden={activeProfileSection === 'errorlog'}
					>
					<div class="actions">
						<button type="submit" class="save-btn" disabled={saving}>
							{#if saving}
								<div class="spinner-small"></div>
								Speichern...
							{:else}
								<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
									<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
								</svg>
								Profil speichern
							{/if}
						</button>
					</div>

					{#if message}
						<div
							class="message"
							class:success={messageType === 'success'}
							class:error={messageType === 'error'}
						>
							{message}
						</div>
					{/if}
					</div>
				</form>

				<!-- Error Log Sektion -->
				{#if errorLogExists}
					<div
						class="profile-section"
						class:profile-section--hidden={activeProfileSection !== 'errorlog'}
					>
					<div class="card errorlog-section">
						<h3 class="section-title">
							<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
								<path d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z" />
							</svg>
							Fehlerprotokoll
						</h3>
						<p class="errorlog-info">Es liegen abgelehnte Uploads vor.</p>
						<div class="errorlog-actions">
							<button class="btn-secondary" on:click={downloadErrorLog}>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
									<path
										d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"
									/>
								</svg>
								Fehlerlog herunterladen
							</button>
							<button class="btn-danger" on:click={deleteErrorLog}>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
									<path
										d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"
									/>
								</svg>
								Fehlerlog löschen
							</button>
						</div>
					</div>
					</div>
				{/if}
			</div>
			</section>
		</section>
	{/if}
</main>

<SiteFooter />

<style>
	.profile-dashboard-page {
		min-height: 100vh;
		background: var(--bg-primary);
		color: var(--text-primary);
		padding: 1.4rem 2rem 2.2rem;
		box-sizing: border-box;
	}

	.profile-dashboard__hero {
		margin-bottom: 0;
	}

	.profile-dashboard__hero-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.profile-dashboard__title {
		margin: 0;
		font-size: clamp(1.8rem, 3vw, 2.4rem);
		font-weight: 700;
		color: var(--text-primary);
	}

	.profile-dashboard__sub {
		margin: 0.45rem 0 0;
		color: var(--text-secondary);
		max-width: 42rem;
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
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.panel-head h2 {
		margin: 0;
		font-size: 1.1rem;
	}

	.panel-head__hint {
		color: var(--text-secondary);
		font-size: 0.88rem;
	}

	.profile-dashboard__inner {
		border: none;
		padding: 0;
		background: transparent;
	}

	.profile-section--hidden {
		display: none !important;
	}

	@media (max-width: 980px) {
		.profile-dashboard-page {
			padding: 1rem;
		}

		.dashboard-layout {
			grid-template-columns: 1fr;
		}

		.dashboard-column--menu {
			position: static;
		}
	}

	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 60vh;
		gap: 1rem;
		color: var(--text-secondary);
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--border-color);
		border-top: 3px solid var(--accent-color);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.signout-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.5rem;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 600;
		transition: all 0.2s ease;
		background: var(--error-color);
		color: white;
	}

	.signout-btn:hover {
		background: #dc2626;
		transform: translateY(-1px);
	}

	.profile-content {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.avatar-section {
		display: flex;
		align-items: center;
		gap: 2rem;
		padding: 2rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		box-shadow: 0 2px 8px var(--shadow);
	}

	.avatar-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.profile-avatar {
		width: 120px;
		height: 120px;
		border-radius: 50%;
		object-fit: cover;
		border: 4px solid var(--border-color);
		transition: all 0.2s ease;
	}

	.profile-avatar:hover {
		transform: scale(1.05);
	}

	.avatar-placeholder {
		width: 120px;
		height: 120px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-tertiary);
		border: 4px solid var(--border-color);
		color: var(--text-muted);
	}

	.avatar-actions {
		display: flex;
		gap: 0.5rem;
	}

	.avatar-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border: none;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.avatar-btn.primary {
		background: var(--accent-color);
		color: white;
	}

	.avatar-btn.primary:hover {
		background: var(--accent-hover);
		transform: translateY(-1px);
	}

	.avatar-btn.secondary {
		background: var(--error-color);
		color: white;
	}

	.avatar-btn.secondary:hover {
		background: #dc2626;
		transform: translateY(-1px);
	}

	.user-info {
		flex: 1;
	}

	.user-name {
		font-size: 1.5rem;
		font-weight: 600;
		margin: 0 0 0.5rem 0;
		color: var(--text-primary);
	}

	.user-email {
		margin: 0;
		color: var(--text-secondary);
	}

	.card {
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		padding: 2rem;
		box-shadow: 0 2px 8px var(--shadow);
	}

	.section-title {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0 0 1.5rem 0;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--border-color);
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	label {
		display: block;
		font-weight: 500;
		margin-bottom: 0.5rem;
		color: var(--text-primary);
	}

	input[type='text'] {
		width: 100%;
		padding: 0.75rem 1rem;
		border: 2px solid var(--border-color);
		border-radius: 8px;
		background: var(--bg-tertiary);
		color: var(--text-primary);
		font-size: 1rem;
		transition: all 0.2s ease;
		outline: none;
		box-sizing: border-box;
	}

	input:focus {
		border-color: var(--accent-color);
		box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
	}

	input.valid {
		border-color: var(--success-color);
	}

	input.invalid {
		border-color: var(--error-color);
	}

	.error-text {
		font-size: 0.875rem;
		color: var(--error-color);
		margin-top: 0.25rem;
	}

	.actions {
		display: flex;
		justify-content: center;
		gap: 1rem;
		margin-top: 2rem;
		flex-wrap: wrap;
	}

	.save-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem 2rem;
		border: none;
		border-radius: 12px;
		cursor: pointer;
		font-size: 1rem;
		font-weight: 600;
		transition: all 0.2s ease;
		min-width: 200px;
		justify-content: center;
	}

	.save-btn {
		background: var(--accent-color);
		color: white;
	}

	.save-btn:hover:not(:disabled) {
		background: var(--accent-hover);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px var(--shadow);
	}

	.save-btn:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.spinner-small {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top: 2px solid white;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	.message {
		margin-top: 1.5rem;
		padding: 1rem 1.5rem;
		border-radius: 8px;
		font-weight: 500;
		text-align: center;
	}

	.message.success {
		background: var(--success-color);
		color: white;
	}

	.message.error {
		background: var(--error-color);
		color: white;
	}

	.errorlog-section {
		border-color: var(--error-color);
	}

	.errorlog-info {
		margin: 0 0 1rem 0;
		color: var(--text-secondary);
	}

	.errorlog-actions {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.btn-secondary {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: var(--bg-tertiary);
		color: var(--text-primary);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-secondary:hover {
		background: var(--border-color);
		transform: translateY(-1px);
	}

	.btn-danger {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: var(--error-color);
		color: white;
		border: none;
		border-radius: 6px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-danger:hover {
		background: #dc2626;
		transform: translateY(-1px);
	}

	.hidden {
		display: none;
	}

	/* Accountname Styles */
	.accountname-input-group {
		display: flex;
		align-items: center;
		border: 1px solid var(--border-color);
		border-radius: 6px;
		overflow: hidden;
		background: var(--bg-primary);
		transition: all 0.2s ease;
		position: relative;
	}

	.accountname-input-group:focus-within {
		border-color: var(--accent-color);
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.url-prefix {
		padding: 0.75rem 1rem;
		background: var(--bg-tertiary);
		color: var(--text-secondary);
		font-weight: 500;
		border-right: 1px solid var(--border-color);
		white-space: nowrap;
		font-size: 0.875rem;
	}

	.accountname-input-group input {
		border: none;
		background: transparent;
		padding: 0.75rem 1rem;
		flex: 1;
		font-size: 1rem;
		color: var(--text-primary);
		outline: none;
	}

	.accountname-input-group input::placeholder {
		color: var(--text-tertiary);
	}

	.checking-spinner {
		position: absolute;
		right: 12px;
		display: flex;
		align-items: center;
		color: var(--accent-color);
	}

	.animate-spin {
		animation: spin 1s linear infinite;
	}

	.help-text {
		display: block;
		margin-top: 0.5rem;
		font-size: 0.875rem;
		color: var(--text-secondary);
		font-style: italic;
	}

	.success-text {
		display: block;
		margin-top: 0.5rem;
		font-size: 0.875rem;
		color: var(--success-color);
		font-weight: 500;
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		.avatar-section {
			flex-direction: column;
			text-align: center;
			gap: 1.5rem;
		}

		.profile-avatar,
		.avatar-placeholder {
			width: 100px;
			height: 100px;
		}

		.avatar-actions {
			justify-content: center;
		}

		.card {
			padding: 1.5rem;
		}

		.errorlog-actions {
			flex-direction: column;
		}

		.btn-secondary,
		.btn-danger {
			justify-content: center;
		}

		.actions {
			flex-direction: column;
			align-items: stretch;
		}

		.save-btn {
			width: 100%;
		}
	}

	@media (max-width: 480px) {
		.signout-btn {
			align-self: flex-end;
			margin-top: 0.5rem;
		}

		.card {
			padding: 1rem;
		}
	}
</style>
