<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import SiteNav from '$lib/SiteNav.svelte';
  import SiteFooter from '$lib/SiteFooter.svelte';
  import { getSeoImageUrl } from '$lib/utils/seoImageUrl';
  import { darkMode } from '$lib/darkMode';
  import { filterStore, getEffectiveGpsPosition } from '$lib/filterStore';
  import { goto } from '$app/navigation';
  import { sessionStore, sessionReady } from '$lib/sessionStore';
  import type { PageData } from './$types';
  import { authFetch } from '$lib/authFetch';
  import { browser } from '$app/environment';
  import { supabase } from '$lib/supabaseClient';
  import { buildGeoHubPath, getStoredOrComputedCanonicalPath, slugifySegment } from '$lib/content/routing';
  import { sanitizeContentHtml } from '$lib/content/html';
  import { isDetailPath, LAST_LOCAL_ROUTE_KEY, sanitizeReturnTo } from '$lib/returnTo';
  import { DEFAULT_CONTENT_TYPES } from '$lib/content/types';
  import {
    DEFAULT_EVENT_SETTINGS,
    buildEventPageSettings,
    formatEventSchedule,
    getEventSettings,
    isEventType,
    isUpcomingOrCurrentEvent,
    type EventSettings
  } from '$lib/events';
  import { buildKeywordHubPath } from '$lib/seo/hubs';
  import { buildBreadcrumbJsonLd, buildGeoPlaceGraph, trimText } from '$lib/seo/site';
  import { getAdministrativeHierarchy, normalizeAdminDisplayLabel } from '$lib/content/locationTaxonomy';
  import { reverseGeocodeCoordinates, searchLocationHierarchy, type SearchGeocodeResult } from '$lib/content/geocoding';
  import { KEYWORDS_MAX, sanitizeKeywords } from '$lib/content/keywords';
  import { env as publicEnv } from '$env/dynamic/public';

  /** Wenn PUBLIC_ADOBE_AFFILIATE_REDIRECT_BASE gesetzt ist (z. B. Partnerize), wird der Adobe-Link darüber geleitet. */
  function getAdobeAffiliateUrl(directUrl: string | null | undefined): string | null {
    if (!directUrl?.trim()) return null;
    const base = (publicEnv as Record<string, string>)?.PUBLIC_ADOBE_AFFILIATE_REDIRECT_BASE;
    if (!base?.trim()) return directUrl;
    const trimmed = base.replace(/\/+$/, '');
    return `${trimmed}/${encodeURIComponent(directUrl.trim())}`;
  }

  // Client-seitige Umleitung für bekannte Fälle (nur für User, nicht für Bots)
  if (browser) {
    const currentSlug = $page.params.slug;
    console.log('🔍 [Client] Checking slug for redirect:', currentSlug);
    
    // Prüfe, ob es sich um einen Bot handelt
    const userAgent = navigator.userAgent.toLowerCase();
    console.log('[Item Detail] User-Agent:', navigator.userAgent);
    console.log('[Item Detail] User-Agent (lowercase):', userAgent);
    
    const isBot = userAgent.includes('bot') || 
                  userAgent.includes('crawler') || 
                  userAgent.includes('spider') || 
                  userAgent.includes('scraper') ||
                  userAgent.includes('googlebot') ||
                  userAgent.includes('bingbot') ||
                  userAgent.includes('slurp') ||
                  userAgent.includes('duckduckbot');
    
    console.log('[Item Detail] Bot detection result:', isBot);
    
    // Entfernt: Keine client-seitigen Slug-Übersetzungen mehr
    // Alle Slugs werden direkt verwendet, keine Umleitungen
  }

  // Detail-Komponenten
  import ImageDisplay from '$lib/detail/ImageDisplay.svelte';
  import ImageControlsSection from '$lib/detail/ImageControlsSection.svelte';
  import ImageMetaSection from '$lib/detail/ImageMetaSection.svelte';
  import FileDetails from '$lib/detail/FileDetails.svelte';
  import KeywordsSection from '$lib/detail/KeywordsSection.svelte';
  import CreatorCard from '$lib/detail/CreatorCard.svelte';
  import NearbyGallery from '$lib/detail/NearbyGallery.svelte';
  import ImageMapSection from '$lib/detail/ImageMapSection.svelte';
  import RadiusControl from '$lib/detail/RadiusControl.svelte';
  import MapPickerOverlay from '$lib/detail/MapPickerOverlay.svelte';
import ItemRightsManager from '$lib/ItemRightsManager.svelte';
import { unifiedRightsStore } from '$lib/unifiedRightsStore';
let showMapPicker = false;
let showRightsManager = false;
  import { useJustifiedLayout } from '$lib/galleryStore';
  import FloatingActionButtons from '$lib/FloatingActionButtons.svelte';

  // Scroll to top state
  let showScrollToTop = false;

  // Helper function for formatting time
  function formatTimeCreated(value: any): string {
    if (!value) return '';
    if (typeof value === 'string') {
      // Format: "150629" -> "15:06:29"
      if (value.length === 6 && /^\d{6}$/.test(value)) {
        return `${value.slice(0, 2)}:${value.slice(2, 4)}:${value.slice(4, 6)}`;
      }
      return value;
    }
    return String(value);
  }

  function relatedThumbUrl(item: { slug: string; path_512?: string | null }) {
    const baseUrl = item.path_512 ? getSeoImageUrl(item.slug, item.path_512, '512') : '';
    return baseUrl ? `${baseUrl}?context=similar` : '';
  }

  export let data: any;
  let image = data?.image ?? null;
  let error = data?.error ?? '';
  let nearby: any[] = []; // Will be loaded client-side
  let seoLinks = data?.seoLinks ?? { newer: null, older: null };
  let canonicalPath = data?.canonicalPath ?? (image?.slug ? `/item/${image.slug}` : '');
  let contentType = data?.type ?? null;
  let availableTypes: Array<{ id: number; name?: string; slug?: string }> = data?.availableTypes ?? [];
  let rootItem = data?.rootItem ?? image;
  let contextItem = data?.contextItem ?? image;
  let groupItems = data?.groupItems ?? [];
  let activeGroupItemId = data?.activeGroupItemId ?? image?.id ?? null;
  let canonicalUrl = '';
  let loading = !image;
  let profile = null;
  let metaTags = data?.metaTags ?? null;
  let seoHubs = data?.seoHubs ?? { typePath: null, typeLabel: null, keywordLinks: [], photographerPath: null, photographerLabel: null, placePath: null, placeLabel: null };
  let relatedContent = data?.relatedContent ?? { sameType: [], sameCreator: [], sameKeyword: [], samePlace: [] };
  let nearbyFallbackRecommendations: Array<{ title: string; href: string; description: string }> = [];
  let showImageCaptions = true; // Default to true
  let editMode = false;
  let adobeStockUrlEdit = '';
  let adobeStockAssetIdEdit = '';
  let adobeUploadLoading = false;
  let adobeSaveLoading = false;
  let adobeMessage = '';
  let lastAdobeItemId = '';
  let imageBackHref = sanitizeReturnTo($page.url.searchParams.get('returnTo'), '/');
  let autoEditAppliedFor = '';
  let similarMotifPage = 1;
  const SIMILAR_MOTIFS_PAGE_SIZE = 20;
  const TYPE_ICONS: Record<string, string> = {
    foto: '📷',
    event: '📅',
    firma: '🏢',
    link: '🔗',
    text: '📝',
    video: '🎬',
    musik: '🎵',
    'ki-bild': '✨'
  };

  // SEO/Meta: Slug statt ID verwenden - reaktiv auf URL-Parameter
  let itemSlug: string = '';
  $: itemSlug = $page.params.slug || image?.slug || '';
  $: if (data?.image?.id && data.image.id !== image?.id) {
    image = data.image;
    error = data?.error ?? '';
    seoLinks = data?.seoLinks ?? { newer: null, older: null };
    canonicalPath = data?.canonicalPath ?? (data.image?.slug ? `/item/${data.image.slug}` : canonicalPath);
    loading = false;
  }
  $: canonicalPath = data?.canonicalPath ?? canonicalPath;
  $: contentType = data?.type ?? contentType;
  $: availableTypes = data?.availableTypes ?? availableTypes;
  $: seoHubs = data?.seoHubs ?? seoHubs;
  $: relatedContent = data?.relatedContent ?? relatedContent;
  $: if (image?.id) {
    similarMotifPage = 1;
  }
  $: nearbyFallbackRecommendations = [
    ...(seoHubs?.placePath && seoHubs?.placeLabel ? [{ title: `Mehr Inhalte aus ${seoHubs.placeLabel}`, href: seoHubs.placePath, description: 'Ortsbezogener Hub mit weiteren Details und Motiven.' }] : []),
    ...(seoHubs?.photographerPath && seoHubs?.photographerLabel ? [{ title: `Mehr von ${seoHubs.photographerLabel}`, href: seoHubs.photographerPath, description: 'Alle öffentlichen Inhalte dieses Fotografen.' }] : []),
    ...(seoHubs?.typePath && seoHubs?.typeLabel ? [{ title: `${seoHubs.typeLabel} entdecken`, href: seoHubs.typePath, description: 'Zur kuratierten Übersicht dieses Seitentyps.' }] : [])
  ];
  $: geoAdminHierarchy = getAdministrativeHierarchy({
    countryCode: image?.country_code,
    countrySlug: image?.country_slug,
    countryName: image?.country_name,
    districtCode: image?.district_code,
    districtSlug: image?.district_slug,
    districtName: image?.district_name
  });
  $: geoCountryLabel =
    normalizeAdminDisplayLabel(
      geoAdminHierarchy.countryName || image?.country_name || image?.country_slug?.toUpperCase() || image?.country_code
    ) || 'Land';
  $: geoStateLabel = normalizeAdminDisplayLabel(image?.state_name || geoAdminHierarchy.stateName || null);
  $: geoRegionLabel = normalizeAdminDisplayLabel(image?.region_name || geoAdminHierarchy.regionName || null);
  $: geoDistrictLabel =
    normalizeAdminDisplayLabel(image?.district_name || image?.district_slug || image?.district_code) || 'Landkreis';
  $: geoMunicipalityLabel =
    normalizeAdminDisplayLabel(image?.municipality_name || image?.municipality_slug) || 'Gemeinde';
  $: geoNeedsAttention = !!(
    image?.location_needs_review ||
    !image?.country_slug ||
    !image?.district_slug ||
    !image?.municipality_slug
  );
  $: showGeoState = !!geoStateLabel;
  $: showGeoRegion =
    !!geoRegionLabel &&
    normalizeGeoComparisonValue(geoRegionLabel) !== normalizeGeoComparisonValue(geoStateLabel) &&
    normalizeGeoComparisonValue(geoRegionLabel) !== normalizeGeoComparisonValue(geoDistrictLabel);
  $: geoCountryPath = image?.country_slug ? `/${image.country_slug}` : null;
  $: geoDistrictPath =
    image?.country_slug && image?.district_slug
      ? buildGeoHubPath({
          countrySlug: image.country_slug,
          districtSlug: image.district_slug
        })
      : null;
  $: geoMunicipalityPath =
    image?.country_slug && image?.district_slug && image?.municipality_slug
      ? buildGeoHubPath({
          countrySlug: image.country_slug,
          districtSlug: image.district_slug,
          municipalitySlug: image.municipality_slug
        })
      : null;
  $: geoBreadcrumbLinks = [
    { name: 'Culoca', path: '/' },
    ...(geoCountryPath ? [{ name: geoCountryLabel, path: geoCountryPath }] : []),
    ...(geoDistrictPath ? [{ name: geoDistrictLabel, path: geoDistrictPath }] : []),
    ...(geoMunicipalityPath ? [{ name: geoMunicipalityLabel, path: geoMunicipalityPath }] : []),
    { name: image?.title || image?.original_name || itemSlug, path: canonicalPath || `/item/${itemSlug}` }
  ];
  $: geoDisplayBreadcrumbs = dedupeGeoCrumbs([
    { name: 'Culoca', path: '/' },
    ...(geoCountryPath ? [{ name: geoCountryLabel, path: geoCountryPath }] : []),
    ...(showGeoState ? [{ name: geoStateLabel!, path: null }] : []),
    ...(showGeoRegion ? [{ name: geoRegionLabel!, path: null }] : []),
    ...(geoDistrictPath ? [{ name: geoDistrictLabel, path: geoDistrictPath }] : []),
    ...(geoMunicipalityPath ? [{ name: geoMunicipalityLabel, path: geoMunicipalityPath }] : [])
  ]);
  $: itemBreadcrumbJsonLd = buildBreadcrumbJsonLd(geoBreadcrumbLinks);
  $: geoPlaceGraph = buildGeoPlaceGraph({
    currentPath: canonicalPath || `/item/${itemSlug}`,
    currentName:
      normalizeAdminDisplayLabel(image?.locality_name) ||
      normalizeAdminDisplayLabel(image?.municipality_name) ||
      normalizeAdminDisplayLabel(image?.district_name) ||
      normalizeAdminDisplayLabel(image?.country_name) ||
      normalizeUtf8(image?.title || itemSlug || 'Ort'),
    countryName: geoCountryLabel,
    countryPath: geoCountryPath,
    stateName: geoStateLabel,
    regionName: showGeoRegion ? geoRegionLabel : null,
    districtName: geoDistrictLabel,
    districtPath: geoDistrictPath,
    municipalityName: image?.municipality_slug ? geoMunicipalityLabel : null,
    municipalityPath: geoMunicipalityPath,
    localityName: normalizeAdminDisplayLabel(image?.locality_name || null),
    latitude: image?.lat ?? null,
    longitude: image?.lon ?? null
  });
  $: similarMotifItems = relatedContent?.sameKeyword || [];
  $: similarMotifTotalPages = Math.max(1, Math.ceil(similarMotifItems.length / SIMILAR_MOTIFS_PAGE_SIZE));
  $: if (similarMotifPage > similarMotifTotalPages) {
    similarMotifPage = similarMotifTotalPages;
  }
  $: visibleSimilarMotifItems = similarMotifItems.slice(
    (similarMotifPage - 1) * SIMILAR_MOTIFS_PAGE_SIZE,
    similarMotifPage * SIMILAR_MOTIFS_PAGE_SIZE
  );
  $: rootItem = data?.rootItem ?? image;
  $: contextItem = data?.contextItem ?? image;
  $: groupItems = data?.groupItems ?? [];
  $: activeGroupItemId = data?.activeGroupItemId ?? image?.id ?? null;
  $: canonicalUrl = canonicalPath ? `https://culoca.com${canonicalPath}` : (image?.slug ? `https://culoca.com/item/${image.slug}/` : 'https://culoca.com');
  $: effectiveContentHtml = sanitizeContentHtml(contextItem?.content || image?.content || '');
  $: hasVisibleGroupItems = Array.isArray(groupItems) && groupItems.length > 1;
  $: hasDateRange = !!(contentType?.show_date_range && (contextItem?.starts_at || contextItem?.ends_at));
  $: isEventItem = isEventType(image);
  $: eventSettings = getEventSettings(image?.page_settings);
  $: eventScheduleText = formatEventSchedule(contextItem || image || {}, eventSettings);
  $: hasEventDetails = isEventItem && !!(eventScheduleText || eventSettings.location_name || eventSettings.booking_url || eventSettings.is_free || eventSettings.price_text);
  $: highlightCalendar = isEventItem && isUpcomingOrCurrentEvent(image);
  // A configured video URL should always render, even if the current type default disables embeds.
  $: hasVideoEmbed = !!image?.video_url;
  $: shouldShowMainImage = contentType?.show_image !== false;
  $: nearbyGalleryOverride = getPageSettingBoolean(image?.page_settings, 'show_nearby_gallery');
  $: shouldShowNearbyGallery = !!(image?.lat && image?.lon);
  $: shouldShowMap = !!(contentType?.show_map && image?.lat && image?.lon);
  $: shouldShowContentHtml = !!(contentType?.show_content_html && effectiveContentHtml);
  $: currentVariantRootId = image?.group_root_item_id ? rootItem?.id || image.group_root_item_id : image?.id || null;
  $: hasVariantStrip = Array.isArray(groupItems) && groupItems.length > 1;
  $: variantStripItems = hasVariantStrip
    ? [...groupItems].sort((a, b) => {
        if (a.id === rootItem?.id) return -1;
        if (b.id === rootItem?.id) return 1;
        return 0;
      })
    : [];
  $: if (browser && image?.id && canEditItem) {
    const shouldAutoEdit = $page.url.searchParams.get('edit') === '1';
    const focusTarget = $page.url.searchParams.get('focus') || '';
    const autoEditKey = `${image.id}:${shouldAutoEdit ? '1' : '0'}:${focusTarget}`;

    if (shouldAutoEdit && autoEditAppliedFor !== autoEditKey) {
      autoEditAppliedFor = autoEditKey;
      editMode = true;

      setTimeout(() => {
        if (focusTarget === 'title') startEditTitle();
        else if (focusTarget === 'description') startEditDescription();
        else if (focusTarget === 'caption') startEditCaption();
        else if (focusTarget === 'keywords') startEditKeywords();
        else if (focusTarget === 'filename') startEditFilename();
        else if (focusTarget === 'slug') startEditSlug();
      }, 150);
    }
  }

  function getPageSettingBoolean(
    settings: Record<string, unknown> | null | undefined,
    key: string
  ): boolean | null {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return null;
    const value = settings[key];
    return typeof value === 'boolean' ? value : null;
  }

  function normalizeGeoComparisonValue(value: string | null | undefined): string {
    return (value || '').trim().toLocaleLowerCase('de-DE');
  }

  function dedupeGeoCrumbs<T extends { name: string; path: string | null }>(crumbs: T[]): T[] {
    const deduped: T[] = [];

    for (const crumb of crumbs) {
      const last = deduped[deduped.length - 1];
      if (last && normalizeGeoComparisonValue(last.name) === normalizeGeoComparisonValue(crumb.name)) {
        if (!last.path && crumb.path) {
          deduped[deduped.length - 1] = crumb;
        }
        continue;
      }
      deduped.push(crumb);
    }

    return deduped;
  }

  function getNearbyGalleryMode(settings: Record<string, unknown> | null | undefined) {
    const value = getPageSettingBoolean(settings, 'show_nearby_gallery');
    if (value === true) return 'enabled';
    if (value === false) return 'disabled';
    return 'default';
  }

  function buildPageSettings(
    currentSettings: Record<string, unknown> | null | undefined,
    nearbyGalleryMode: string,
    nextEventSettings: EventSettings,
    includeEventSettings: boolean
  ) {
    const nextSettings = buildEventPageSettings(currentSettings, nextEventSettings, includeEventSettings);

    if (nearbyGalleryMode === 'enabled') {
      nextSettings.show_nearby_gallery = true;
    } else if (nearbyGalleryMode === 'disabled') {
      nextSettings.show_nearby_gallery = false;
    } else {
      delete nextSettings.show_nearby_gallery;
    }

    return nextSettings;
  }

  function formatDateRange(start: string | null | undefined, end: string | null | undefined): string {
    if (!start && !end) return '';
    const format = (value: string) =>
      new Date(value).toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

    if (start && end) return `${format(start)} - ${format(end)}`;
    if (start) return `Start: ${format(start)}`;
    return `Ende: ${format(end as string)}`;
  }

  $: calendarUrl =
    image?.id ? `/api/events/${image.id}/ics` : null;

  function getEmbedUrl(videoUrl: string | null | undefined): string {
    if (!videoUrl) return '';

    try {
      const parsed = new URL(videoUrl);
      if (parsed.hostname.includes('youtube.com')) {
        const id = parsed.searchParams.get('v');
        return id ? `https://www.youtube.com/embed/${id}` : videoUrl;
      }
      if (parsed.hostname === 'youtu.be') {
        const id = parsed.pathname.replace('/', '');
        return id ? `https://www.youtube.com/embed/${id}` : videoUrl;
      }
      if (parsed.hostname.includes('vimeo.com')) {
        const id = parsed.pathname.split('/').filter(Boolean).pop();
        return id ? `https://player.vimeo.com/video/${id}` : videoUrl;
      }
      return videoUrl;
    } catch {
      return videoUrl || '';
    }
  }

  // Dynamisches Favicon aktualisieren
  $: if (image && browser) {
    updateFavicon();
  }

  // Load nearby items client-side to prevent Google from "stealing" nearby titles/descriptions
  $: if (image && browser && image.slug) {
    loadNearbyItems();
  }

  $: if (image?.id && image.id !== lastAdobeItemId) {
    lastAdobeItemId = image.id;
    adobeStockUrlEdit = image.adobe_stock_url || '';
    adobeStockAssetIdEdit = image.adobe_stock_asset_id || '';
    adobeMessage = '';
  }

  function isValidImageBackTarget(candidate: string | null | undefined): boolean {
    if (!candidate) return false;
    if (!candidate.startsWith('/')) return false;

    const sanitized = sanitizeReturnTo(candidate, '/');
    try {
      const url = new URL(sanitized, 'https://culoca.com');
      if (isDetailPath(url.pathname)) return false;
      if (url.pathname === $page.url.pathname && url.search === $page.url.search) return false;
      return true;
    } catch {
      return false;
    }
  }

  $: {
    const explicitReturnTo = sanitizeReturnTo($page.url.searchParams.get('returnTo'), '/');
    if (isValidImageBackTarget(explicitReturnTo)) {
      imageBackHref = explicitReturnTo;
    }
  }

  function getStoredLocalRoute(): string {
    if (!browser) return '/';

    const storedRoute = sanitizeReturnTo(sessionStorage.getItem(LAST_LOCAL_ROUTE_KEY), '/');
    return isValidImageBackTarget(storedRoute) ? storedRoute : '/';
  }

  function getLocalReferrerFallback(): string {
    if (!browser || !document.referrer) return '/';

    try {
      const referrerUrl = new URL(document.referrer);
      if (referrerUrl.origin !== window.location.origin) return '/';
      if (referrerUrl.pathname === $page.url.pathname && referrerUrl.search === $page.url.search) return '/';

      const localReferrer = sanitizeReturnTo(
        `${referrerUrl.pathname}${referrerUrl.search}${referrerUrl.hash}`,
        '/'
      );
      return isValidImageBackTarget(localReferrer) ? localReferrer : '/';
    } catch {
      return '/';
    }
  }

  async function loadNearbyItems() {
    try {
      const response = await fetch(`/api/nearby/${image.slug}`);
      if (response.ok) {
        const data = await response.json();
        nearby = data.nearby || [];
      }
    } catch (error) {
      console.error('Failed to load nearby items:', error);
    }
  }

  // SEO-optimized meta tags to prevent Google from "stealing" nearby image titles/descriptions
  // REMOVED: Dynamic meta tag updates to prevent conflicts with static meta tags in svelte:head

  function updateFavicon() {
    if (!image) return;
    
    // Entferne alte Favicon-Links
    const oldFavicons = document.querySelectorAll('link[rel="icon"]');
    oldFavicons.forEach(link => link.remove());
    
    // Erstelle neuen Favicon-Link mit Cache-Buster
    const faviconLink = document.createElement('link');
    faviconLink.rel = 'icon';
    faviconLink.type = 'image/jpeg';
    
    let faviconUrl = '';
    if (image.path_64) {
      faviconUrl = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-64/${image.path_64}`;
    } else if (image.path_512) {
      faviconUrl = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${image.path_512}`;
    }
    
    if (faviconUrl) {
      // Füge Cache-Buster hinzu
      const timestamp = Date.now();
      faviconLink.href = `${faviconUrl}?t=${timestamp}`;
      document.head.appendChild(faviconLink);
    }
  }

  // Slider-Fortschritt aktualisieren
  function updateSliderProgress(slider: HTMLInputElement) {
    const min = +slider.min || 0;
    const max = +slider.max || 100;
    const val = +slider.value;
    const pct = ((val - min) * 100 / (max - min)) + '%';
    slider.style.setProperty('--pct', pct);
  }

  // Slider-Event-Handler
  function handleSliderInput(event: Event) {
    const slider = event.target as HTMLInputElement;
    updateSliderProgress(slider);
  }

  // Für CreatorCard
  let currentUser: any = null;
  $: currentUser = $sessionStore.isAuthenticated && $sessionStore.userId
    ? { id: $sessionStore.userId }
    : null;
  $: isCreator = !!currentUser && (currentUser.id === image?.profile_id || currentUser.id === '0ceb2320-0553-463b-971a-a0eef5ecdf09');
  $: canEditItem = !!(isCreator || $unifiedRightsStore.rights?.edit);
  
  // Admin-Berechtigung prüfen
  $: isAdmin = $sessionStore.permissions?.admin || false;
  
  // Prüfen ob ausgeblendete Items vom aktuellen Benutzer stammen
  $: hasOwnHiddenItems = false;
  
  // Debug: Log creator status
  $: if (image && currentUser) {
    console.log('[DetailPage] Creator Debug:', {
      currentUserId: currentUser.id,
      imageProfileId: image.profile_id,
      isCreator: isCreator,
      isAuthenticated: $sessionStore.isAuthenticated,
      sessionUserId: $sessionStore.userId
    });
  }

  // Load unified rights when image is available
  $: if (image && browser && image.id) {
    unifiedRightsStore.loadRights(image.id);
  }

  // Cleanup rights store when component is destroyed
  onMount(() => {
    // Load showImageCaptions from localStorage
    if (browser && typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('showImageCaptions');
      if (stored !== null) {
        showImageCaptions = stored === 'true';
      }
    }
    
    // Listen for localStorage changes
    const onStorageChange = (e: StorageEvent) => {
      if (e.key === 'showImageCaptions' && e.newValue !== null) {
        showImageCaptions = e.newValue === 'true';
        console.log('[Item][Storage] showImageCaptions changed to:', showImageCaptions);
      }
    };
    window.addEventListener('storage', onStorageChange);
    
    return () => {
      unifiedRightsStore.reset();
      window.removeEventListener('storage', onStorageChange);
    };
  });

  // Generate SEO-friendly image URLs for srcset (no query parameters)
  let imageSource = '';
  let imageSrcset = '';
  let imageSizes = '';
  let imageWidth2048 = 2048;
  let imageHeight2048 = 1365;
  $: if (image) {
    const imagePath = image.path_2048 || image.path_512;
    if (!imagePath || !image.slug) {
      imageSource = '';
      imageSrcset = '';
      imageSizes = '';
      imageWidth2048 = 2048;
      imageHeight2048 = 1365;
    } else {
      // Extract extension from the actual file path (e.g., "abc123.jpg" -> ".jpg")
      const extensionMatch = imagePath.match(/\.(jpg|jpeg|webp|png)$/i);
      const fileExtension = extensionMatch ? extensionMatch[0].toLowerCase() : '.jpg';
      const baseUrl = 'https://culoca.com/images';
      
      // Calculate dimensions for 2048px version (proportional scaling)
      const originalWidth = image.width || 2048;
      const originalHeight = image.height || 1365;
      const maxDimension2048 = 2048;
      const scale2048 = originalWidth > maxDimension2048 || originalHeight > maxDimension2048
        ? Math.min(maxDimension2048 / originalWidth, maxDimension2048 / originalHeight)
        : 1;
      imageWidth2048 = Math.max(1, Math.min(Math.round(originalWidth * scale2048), maxDimension2048));
      imageHeight2048 = Math.max(1, Math.min(Math.round(originalHeight * scale2048), maxDimension2048));
      
      // Generate srcset with available sizes (512px and 2048px) using size suffixes
      // Use 512px for smaller screens, 2048px for larger screens
      const srcsetParts: string[] = [];
      if (image.path_512) {
        // For 512px images, we use them for screens up to 1024px wide
        const sizedUrl512 = appendVersionParam(`${baseUrl}/${image.slug}-512${fileExtension}`, image);
        if (sizedUrl512) {
          srcsetParts.push(`${sizedUrl512} 512w`);
        }
      }
      if (image.path_2048) {
        // For 2048px images, we use them for screens 1024px and wider
        const sizedUrl2048 = appendVersionParam(`${baseUrl}/${image.slug}-2048${fileExtension}`, image);
        if (sizedUrl2048) {
          srcsetParts.push(`${sizedUrl2048} 2048w`);
        }
      }
      
      // Fallback: if no srcset, use main image source (2048px version)
      imageSource = image.path_2048
        ? (appendVersionParam(`${baseUrl}/${image.slug}-2048${fileExtension}`, image) || '')
        : (image.path_512 ? (appendVersionParam(`${baseUrl}/${image.slug}-512${fileExtension}`, image) || '') : '');
      imageSrcset = srcsetParts.join(', ');
      // sizes: use 512px for mobile (up to 900px), 2048px for desktop
      imageSizes = '(max-width: 900px) 512px, 2048px';
    }
  }

  // Beispiel: Handler für Location-Filter
  function setLocationFilter() {
    if (!image?.lat || !image?.lon) return;
    filterStore.setLocationFilter({
      lat: image.lat,
      lon: image.lon,
      name: image.title || 'Standort',
      fromItem: true
    });
    goto('/');
  }
  
  // Funktion zum Zurücksetzen auf aktuelle GPS-Koordinaten
  function clearLocationFilter() {
    filterStore.clearLocationFilter();
    console.log('[Item Detail] Location filter cleared, returning to current GPS coordinates');
  }

  // Radius initial setzen - URL-Parameter haben Vorrang
  let radius = 1000;
  let radiusInitialized = false;
  
  // Item view logging
  let viewLogged = false;
  let isFavorited = false;
  let favoriteLoading = false;
  let favoriteStatus = '';
  let lastFavoriteKey = '';
  let isLiked = false;
  let likeLoading = false;
  let likeStatus = '';
  let lastLikeKey = '';
  let comments: any[] = [];
  let commentsLoading = false;
  let commentDraft = '';
  let commentLoading = false;
  let commentStatus = '';
  let lastCommentItemId = '';
  let interactionInsightsLoading = false;
  let interactionInsightsLoaded = false;
  let lastInsightsKey = '';
  let interactionCounts = {
    views: 0,
    downloads: 0,
    favorites: 0,
    likes: 0,
    comments: 0
  };
  let recentInteractions: any[] = [];
  
  // Function to initialize GPS if not available
  async function initializeGpsIfNeeded() {
    if (!browser) return;
    
    // Check if we have GPS position
    const effectiveGps = getEffectiveGpsPosition();
    if (effectiveGps) {
      console.log('[Item Detail] GPS position available:', effectiveGps);
      return;
    }
    
    // Try to get GPS position from browser
    console.log('[Item Detail] No GPS position available, requesting from browser...');
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        });
      });
      
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      console.log('[Item Detail] Got GPS position from browser:', { lat, lon });
      
      // Update filterStore with GPS position
      filterStore.updateGpsStatus(true, { lat, lon });
      
    } catch (error) {
      console.warn('[Item Detail] Failed to get GPS position:', error);
    }
  }
  
  // Initialize filterStore from URL parameters (includes radius)
  onMount(async () => {
    if (browser) {
      const urlParams = new URLSearchParams(window.location.search);
      filterStore.initFromUrl(urlParams);
      
      // Check if radius parameter is in URL - it has priority over localStorage
      const radiusParam = urlParams.get('r');
      if (radiusParam) {
        const radiusValue = parseInt(radiusParam);
        if (!isNaN(radiusValue) && radiusValue > 0) {
          radius = radiusValue;
          console.log(`[Item Detail] Radius from URL parameter: ${radius}m`);
        }
      } else {
        // Fallback to localStorage if no URL parameter
        const storedRadius = Number(localStorage.getItem('radius'));
        if (!isNaN(storedRadius) && storedRadius > 0) {
          radius = storedRadius;
          console.log(`[Item Detail] Radius from localStorage: ${radius}m`);
        }
      }
      
      // Initialize GPS if needed, then log item view
      await initializeGpsIfNeeded();
      
      // Log item view when page loads
      if (image?.id && !viewLogged) {
        logItemView();
      }

      if (image?.id) {
        await loadFavoriteState();
        await loadComments();
      }

      // Initialize slider progress
      const slider = document.querySelector('#radius') as HTMLInputElement;
      if (slider) {
        const min = +slider.min || 0, max = +slider.max || 100, val = +slider.value;
        const pct = ((val - min) * 100 / (max - min)) + '%';
        slider.style.setProperty('--pct', pct);
      }
    }
  });
  
  // Function to log item view
  async function logItemView() {
    if (!image?.id || viewLogged) return;
    
    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      const visitorId = session?.user?.id || null;
      
      // Get current GPS coordinates using the effective GPS position function
      const effectiveGps = getEffectiveGpsPosition();
      const visitorLat = effectiveGps?.lat || null;
      const visitorLon = effectiveGps?.lon || null;
      
      // Debug: Log all available location information
      console.log('[Item Detail] Debug location info:', {
        effectiveGps,
        filterStoreLocation: $filterStore.locationFilter,
        lastGpsPosition: $filterStore.lastGpsPosition,
        gpsAvailable: $filterStore.gpsAvailable,
        visitorLat,
        visitorLon,
        imageLat: image?.lat,
        imageLon: image?.lon
      });
      
      // Additional debug: Check localStorage
      const storedFilters = localStorage.getItem('culoca-filters');
      console.log('[Item Detail] Stored filters from localStorage:', storedFilters);
      if (storedFilters) {
        try {
          const parsed = JSON.parse(storedFilters);
          console.log('[Item Detail] Parsed stored filters:', parsed);
        } catch (e: unknown) {
          console.log('[Item Detail] Failed to parse stored filters:', e);
        }
      }
      
      console.log('[Item Detail] Logging view with visitor ID:', visitorId, 'GPS:', visitorLat, visitorLon);
      
      const response = await fetch('/api/log-item-view', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId: image.id,
          visitorId: visitorId,
          visitorLat: visitorLat,
          visitorLon: visitorLon,
          referer: document.referrer,
          userAgent: navigator.userAgent
        })
      });
      
      if (response.ok) {
        viewLogged = true;
        const responseData = await response.json();
        console.log(`[Item Detail] View logged for item: ${image.id} with visitor ID: ${visitorId}, distance: ${visitorLat && visitorLon ? 'calculated' : 'unknown'}`);
        console.log('[Item Detail] API response:', responseData);
      } else {
        const errorData = await response.json();
        console.error('[Item Detail] Failed to log item view:', errorData);
      }
    } catch (error) {
      console.error('[Item Detail] Error logging item view:', error);
    }
  }

  $: if (image?.id && image.id !== lastCommentItemId) {
    lastCommentItemId = image.id;
    comments = [];
    commentDraft = '';
    commentStatus = '';
    if (browser) {
      void loadComments();
    }
  }

  $: {
    const nextInsightsKey = `${currentUser?.id || 'anon'}:${image?.id || 'no-item'}:${isCreator ? 'creator' : 'viewer'}`;
    if (nextInsightsKey !== lastInsightsKey) {
      lastInsightsKey = nextInsightsKey;
      interactionInsightsLoaded = false;
      interactionCounts = {
        views: 0,
        downloads: 0,
        favorites: 0,
        likes: 0,
        comments: 0
      };
      recentInteractions = [];

      if (browser && image?.id && isCreator && currentUser?.id) {
        void loadInteractionInsights();
      }
    }
  }

  $: {
    const nextFavoriteKey = `${currentUser?.id || 'anon'}:${image?.id || 'no-item'}`;
    if (nextFavoriteKey !== lastFavoriteKey) {
      lastFavoriteKey = nextFavoriteKey;
      favoriteStatus = '';
      if (!currentUser?.id || !image?.id) {
        isFavorited = false;
      } else if (browser) {
        void loadFavoriteState();
      }
    }
  }

  $: {
    const nextLikeKey = `${currentUser?.id || 'anon'}:${image?.id || 'no-item'}`;
    if (nextLikeKey !== lastLikeKey) {
      lastLikeKey = nextLikeKey;
      likeStatus = '';
      if (!currentUser?.id || !image?.id) {
        isLiked = false;
      } else if (browser) {
        void loadLikeState();
      }
    }
  }

  async function loadFavoriteState() {
    if (!browser || !image?.id || !currentUser?.id) {
      isFavorited = false;
      return;
    }

    try {
      const { data, error } = await supabase
        .from('item_favorites')
        .select('item_id')
        .eq('user_id', currentUser.id)
        .eq('item_id', image.id)
        .maybeSingle();

      if (error) throw error;
      isFavorited = !!data;
    } catch (error) {
      console.error('Failed to load favorite state:', error);
      isFavorited = false;
    }
  }

  async function loadLikeState() {
    if (!browser || !image?.id || !currentUser?.id) {
      isLiked = false;
      return;
    }

    try {
      const { data, error } = await supabase
        .from('item_likes')
        .select('item_id')
        .eq('user_id', currentUser.id)
        .eq('item_id', image.id)
        .maybeSingle();

      if (error) throw error;
      isLiked = !!data;
    } catch (error) {
      console.error('Failed to load like state:', error);
      isLiked = false;
    }
  }

  async function logFavoriteEvent(eventType: 'favorite_add' | 'favorite_remove') {
    if (!currentUser?.id || !image?.id) return;

    try {
      await supabase.from('item_events').insert({
        item_id: image.id,
        actor_user_id: currentUser.id,
        owner_user_id: image.profile_id || image.user_id || null,
        event_type: eventType,
        source: 'item_detail',
        metadata: {
          canonical_path: canonicalPath || image.canonical_path || null
        }
      });
    } catch (error) {
      console.warn('Failed to log favorite event:', error);
    }
  }

  async function logLikeEvent(eventType: 'like_add' | 'like_remove') {
    if (!currentUser?.id || !image?.id) return;

    try {
      await supabase.from('item_events').insert({
        item_id: image.id,
        actor_user_id: currentUser.id,
        owner_user_id: image.profile_id || image.user_id || null,
        event_type: eventType,
        source: 'item_detail',
        metadata: {
          canonical_path: canonicalPath || image.canonical_path || null
        }
      });
    } catch (error) {
      console.warn('Failed to log like event:', error);
    }
  }

  async function logCommentEvent(eventType: 'comment_create' | 'comment_delete', commentId: string) {
    if (!currentUser?.id || !image?.id) return;

    try {
      await supabase.from('item_events').insert({
        item_id: image.id,
        actor_user_id: currentUser.id,
        owner_user_id: image.profile_id || image.user_id || null,
        event_type: eventType,
        source: 'item_detail',
        metadata: {
          comment_id: commentId,
          canonical_path: canonicalPath || image.canonical_path || null
        }
      });
    } catch (error) {
      console.warn('Failed to log comment event:', error);
    }
  }

  async function loadComments() {
    if (!image?.id) {
      comments = [];
      return;
    }

    commentsLoading = true;

    try {
      const { data, error } = await supabase
        .from('item_comments')
        .select(`
          id,
          body,
          status,
          created_at,
          user_id,
          profiles!inner(
            full_name,
            accountname,
            avatar_url
          )
        `)
        .eq('item_id', image.id)
        .eq('status', 'visible')
        .order('created_at', { ascending: false });

      if (error) throw error;
      comments = data || [];
    } catch (error) {
      console.error('Failed to load comments:', error);
      comments = [];
    } finally {
      commentsLoading = false;
    }
  }

  async function loadInteractionInsights() {
    if (!browser || !image?.id || !currentUser?.id || !isCreator) {
      return;
    }

    interactionInsightsLoading = true;

    try {
      const [
        { count: viewsCount, error: viewsError },
        { count: downloadsCount, error: downloadsError },
        { count: favoritesCount, error: favoritesError },
        { count: likesCount, error: likesError },
        { count: commentsCount, error: commentsError },
        { data: recentData, error: recentError }
      ] = await Promise.all([
        supabase
          .from('item_events')
          .select('id', { count: 'exact', head: true })
          .eq('item_id', image.id)
          .eq('event_type', 'item_view'),
        supabase
          .from('item_events')
          .select('id', { count: 'exact', head: true })
          .eq('item_id', image.id)
          .eq('event_type', 'download'),
        supabase
          .from('item_favorites')
          .select('item_id', { count: 'exact', head: true })
          .eq('item_id', image.id),
        supabase
          .from('item_likes')
          .select('item_id', { count: 'exact', head: true })
          .eq('item_id', image.id),
        supabase
          .from('item_comments')
          .select('id', { count: 'exact', head: true })
          .eq('item_id', image.id)
          .eq('status', 'visible'),
        supabase
          .from('item_events')
          .select(`
            id,
            event_type,
            source,
            created_at,
            actor_user_id,
            metadata,
            profiles:actor_user_id (
              full_name,
              accountname
            )
          `)
          .eq('item_id', image.id)
          .in('event_type', ['download', 'favorite_add', 'like_add', 'comment_create'])
          .order('created_at', { ascending: false })
          .limit(8)
      ]);

      if (viewsError) throw viewsError;
      if (downloadsError) throw downloadsError;
      if (favoritesError) throw favoritesError;
      if (likesError) throw likesError;
      if (commentsError) throw commentsError;
      if (recentError) throw recentError;

      interactionCounts = {
        views: viewsCount || 0,
        downloads: downloadsCount || 0,
        favorites: favoritesCount || 0,
        likes: likesCount || 0,
        comments: commentsCount || 0
      };
      recentInteractions = recentData || [];
      interactionInsightsLoaded = true;
    } catch (error) {
      console.error('Failed to load interaction insights:', error);
    } finally {
      interactionInsightsLoading = false;
    }
  }

  function getInteractionActorLabel(entry: any) {
    return entry?.profiles?.full_name || entry?.profiles?.accountname || (entry?.actor_user_id ? 'Nutzer' : 'Anonym');
  }

  function getInteractionEventLabel(entry: any) {
    switch (entry?.event_type) {
      case 'download':
        return 'Download';
      case 'favorite_add':
        return 'Gemerkte Datei';
      case 'like_add':
        return 'Gefällt mir';
      case 'comment_create':
        return 'Kommentar';
      default:
        return entry?.event_type || 'Interaktion';
    }
  }

  function getCommentAuthor(comment: any) {
    return comment?.profiles?.full_name || comment?.profiles?.accountname || 'Unbekannt';
  }

  function getCommentAvatarUrl(comment: any) {
    const avatarUrl = comment?.profiles?.avatar_url;
    if (!avatarUrl) return '';
    if (String(avatarUrl).startsWith('http')) return avatarUrl;
    return `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/avatars/${avatarUrl}`;
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

  async function submitComment() {
    const body = commentDraft.trim();

    if (!image?.id) return;

    if (!currentUser?.id) {
      const returnTo = browser ? `${window.location.pathname}${window.location.search}` : canonicalPath || '/';
      await goto(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }

    if (!body) {
      commentStatus = 'Bitte zuerst einen Kommentar eingeben.';
      return;
    }

    commentLoading = true;
    commentStatus = '';

    try {
      const { data, error } = await supabase
        .from('item_comments')
        .insert({
          item_id: image.id,
          user_id: currentUser.id,
          body,
          status: 'visible'
        })
        .select(`
          id,
          body,
          status,
          created_at,
          user_id,
          profiles!inner(
            full_name,
            accountname,
            avatar_url
          )
        `)
        .single();

      if (error) throw error;

      comments = [data, ...comments];
      commentDraft = '';
      commentStatus = 'Kommentar gespeichert.';
      await logCommentEvent('comment_create', data.id);
    } catch (error) {
      console.error('Failed to save comment:', error);
      commentStatus = 'Kommentar konnte nicht gespeichert werden.';
    } finally {
      commentLoading = false;
    }
  }

  async function deleteComment(commentId: string) {
    if (!currentUser?.id || !commentId) return;

    try {
      const { error } = await supabase
        .from('item_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', currentUser.id);

      if (error) throw error;

      comments = comments.filter((comment) => comment.id !== commentId);
      commentStatus = 'Kommentar gelöscht.';
      await logCommentEvent('comment_delete', commentId);
    } catch (error) {
      console.error('Failed to delete comment:', error);
      commentStatus = 'Kommentar konnte nicht gelöscht werden.';
    }
  }

  async function toggleFavorite() {
    if (!image?.id) return;

    if (!currentUser?.id) {
      const returnTo = browser ? `${window.location.pathname}${window.location.search}` : canonicalPath || '/';
      await goto(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }

    favoriteLoading = true;
    favoriteStatus = '';

    try {
      if (isFavorited) {
        const { error } = await supabase
          .from('item_favorites')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('item_id', image.id);

        if (error) throw error;
        isFavorited = false;
        favoriteStatus = 'Aus Merkliste entfernt.';
        await logFavoriteEvent('favorite_remove');
      } else {
        const { error } = await supabase
          .from('item_favorites')
          .upsert(
            {
              user_id: currentUser.id,
              item_id: image.id,
              created_at: new Date().toISOString()
            },
            { onConflict: 'user_id,item_id' }
          );

        if (error) throw error;
        isFavorited = true;
        favoriteStatus = 'Zur Merkliste hinzugefügt.';
        await logFavoriteEvent('favorite_add');
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      favoriteStatus = 'Merken ist gerade nicht verfügbar.';
    } finally {
      favoriteLoading = false;
    }
  }

  async function toggleLike() {
    if (!image?.id) return;

    if (!currentUser?.id) {
      const returnTo = browser ? `${window.location.pathname}${window.location.search}` : canonicalPath || '/';
      await goto(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }

    likeLoading = true;
    likeStatus = '';

    try {
      if (isLiked) {
        const { error } = await supabase
          .from('item_likes')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('item_id', image.id);

        if (error) throw error;
        isLiked = false;
        likeStatus = 'Like entfernt.';
        await logLikeEvent('like_remove');
      } else {
        const { error } = await supabase
          .from('item_likes')
          .upsert(
            {
              user_id: currentUser.id,
              item_id: image.id,
              created_at: new Date().toISOString()
            },
            { onConflict: 'user_id,item_id' }
          );

        if (error) throw error;
        isLiked = true;
        likeStatus = 'Gefällt mir gespeichert.';
        await logLikeEvent('like_add');
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
      likeStatus = 'Gefällt mir ist gerade nicht verfügbar.';
    } finally {
      likeLoading = false;
    }
  }
  
  // Reactive statement to ensure radius is properly set
  $: if (radiusInitialized && browser) {
    console.log(`[Item Detail] Current radius value: ${radius}m`);
  }
  
  // Ensure radius never exceeds 2000m
  $: if (radius > 2000) {
    radius = 2000;
    console.log('[Item Detail] Radius limited to 2000m');
  }
  
  // Handle radius input with limit
  function handleRadiusInput() {
    if (radius > 2000) {
      radius = 2000;
    }
    // Update URL parameter
    if (browser) {
      const url = new URL(window.location.href);
      url.searchParams.set('r', radius.toString());
      window.history.replaceState({}, '', url.toString());
    }
  }
  
  // Handle radius change with limit
  function handleRadiusChange() {
    if (radius > 2000) {
      radius = 2000;
    }
    // Save to localStorage
    if (browser) {
      localStorage.setItem('radius', radius.toString());
    }
    // Update URL parameter
    if (browser) {
      const url = new URL(window.location.href);
      url.searchParams.set('r', radius.toString());
      window.history.replaceState({}, '', url.toString());
    }
  }
  
  // Copy current link to clipboard
  async function copyCurrentLink() {
    if (!browser) return;
    
    try {
      // Get current URL with all parameters
      const currentUrl = window.location.href;
      
      // Copy to clipboard
      await navigator.clipboard.writeText(currentUrl);
      
      // Show success feedback
      console.log('✅ Link copied to clipboard:', currentUrl);
      
      // Optional: Show a brief success message
      // You could add a toast notification here
      
    } catch (error) {
      console.error('❌ Failed to copy link:', error);
      
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea');
        textArea.value = window.location.href;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        console.log('✅ Link copied using fallback method');
      } catch (fallbackError) {
        console.error('❌ Fallback copy also failed:', fallbackError);
      }
    }
  }
  function onRadiusInput(e: Event) {
    const target = e.currentTarget as HTMLInputElement;
    radius = +target.value;
    // Ensure radius never exceeds 2000m
    if (radius > 2000) {
      radius = 2000;
    }
    
    // Update slider progress
    const slider = target;
    const min = +slider.min || 0, max = +slider.max || 100, val = +slider.value;
    const pct = ((val - min) * 100 / (max - min)) + '%';
    slider.style.setProperty('--pct', pct);
  }
  function onRadiusChange(e: Event) {
    const target = e.currentTarget as HTMLInputElement;
    radius = +target.value;
    // Ensure radius never exceeds 2000m
    if (radius > 2000) {
      radius = 2000;
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('radius', String(radius));
      // Update URL with radius parameter
      filterStore.updateRadius(radius);
    }
  }
  $: filteredNearby = nearby.filter(item => item.distance <= radius && item.id !== image?.id);
  $: hiddenItems = [];
  $: visibleNearby = filteredNearby;
  
  // Automatisch showHiddenItems zurücksetzen wenn keine ausgeblendeten Items mehr vorhanden sind
  $: if (showHiddenItems && hiddenItems.length === 0) {
    showHiddenItems = false;
  }
  
  // SEO-optimiert: Indikatoren für Limits
  $: isAtItemLimit = filteredNearby.length >= 300;
  $: showLimitIndicator = isAtItemLimit;

  let editingTitle = false;
  let titleEditValue = '';
  let editingCaption = false;
  let captionEditValue = '';
  let editingDescription = false;
  let descriptionEditValue = '';
  let editingKeywords = false;
  let keywordsEditValue = '';
  let editingFilename = false;
  let filenameEditValue = '';
  let editingSlug = false;
  let slugEditValue = '';
  let editingGeoFields = false;
  let countryNameEditValue = '';
  let districtNameEditValue = '';
  let municipalityNameEditValue = '';
  let localityNameEditValue = '';
  let geoSearchQuery = '';
  let geoSearchResults: SearchGeocodeResult[] = [];
  let geoSearchLoading = false;
  let geoSearchError = '';
  let geoSearchTimeout: ReturnType<typeof setTimeout> | null = null;
  let managementForm = {
    type_id: 1,
    group_slug: '',
    group_root_item_id: null as string | null,
    show_in_main_feed: true,
    nearby_gallery_mode: 'default',
    sort_order: '',
    content: '',
    starts_at: '',
    ends_at: '',
    external_url: '',
    video_url: '',
    event_display_mode: DEFAULT_EVENT_SETTINGS.display_mode as 'single_day' | 'multi_day',
    event_all_day: DEFAULT_EVENT_SETTINGS.all_day,
    event_location_name: '',
    event_booking_url: '',
    event_is_free: false,
    event_price_text: ''
  };
  let selectedRootItem: any = null;
  let rootSearchQuery = '';
  let rootSearchResults: any[] = [];
  let rootSearchLoading = false;
  let groupSlugSuggestions: string[] = [];
  let groupSlugSuggestionsLoading = false;
  let showGroupSlugInfo = false;
  let managementSavePending = false;
  let managementSaveMessage = '';
  let lastManagementImageId = '';
  let latestRootSearchToken = 0;
  let latestGroupSlugToken = 0;

  let showFullExif = false;
  let showHiddenItems = false;
  function toggleHiddenItems() {
    showHiddenItems = false;
  }
  function setUserFilter() {
    if (!image?.profile_id) return;
    const username = image.profile?.full_name || image.profile?.accountname || image.profile_id || 'Profil';
    const accountName = image.profile?.accountname || image.profile?.full_name || image.profile_id || 'Profil';
    filterStore.setUserFilter({
      userId: image.profile_id,
      username,
      avatarUrl: image.profile?.avatar_url || '',
      accountName
    });
    goto('/');
  }
  function formatFileSize(bytes: number | null | undefined) {
    if (!bytes) return '';
    const kb = bytes / 1024;
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) {
      return mb.toFixed(1).replace('.', ',') + ' MB';
    } else {
      return kb.toFixed(0) + ' KB';
    }
  }
  function formatExposureTime(value: string | number | null | undefined) {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') {
      return value.includes('/') ? value + ' s' : value + ' s';
    }
    if (typeof value === 'number') {
      if (value >= 1) return value + ' s';
      const denom = Math.round(1 / value);
      return `1/${denom} s`;
    }
    return String(value);
  }
  function handleKey(e: KeyboardEvent, fn: () => void) {
    if (e.key === 'Enter' || e.key === ' ') {
      fn();
    }
  }

  async function saveOpenEditors() {
    if (editingTitle) await saveTitle();
    if (editingDescription) await saveDescription();
    if (editingCaption) await saveCaption();
    if (editingKeywords) await saveKeywords();
    if (editingFilename) await saveFilename();
    if (editingSlug) await saveSlug();
    if (editingGeoFields) await saveGeoFields();
  }

  function toDateTimeLocal(value: string | null | undefined) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - offset * 60_000);
    return localDate.toISOString().slice(0, 16);
  }

  function toNullableIso(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function toNullableString(value: string) {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  function syncManagementFormFromImage() {
    if (!image) return;
    const nextEventSettings = getEventSettings(image.page_settings);

    managementForm = {
      type_id: image.type_id || contentType?.id || 1,
      group_slug: image.group_slug || '',
      group_root_item_id: image.group_root_item_id || null,
      show_in_main_feed: image.show_in_main_feed ?? true,
      nearby_gallery_mode: getNearbyGalleryMode(image.page_settings),
      sort_order: image.sort_order === null || image.sort_order === undefined ? '' : String(image.sort_order),
      content: image.content || '',
      starts_at: toDateTimeLocal(image.starts_at),
      ends_at: toDateTimeLocal(image.ends_at),
      external_url: image.external_url || '',
      video_url: image.video_url || '',
      event_display_mode: nextEventSettings.display_mode,
      event_all_day: nextEventSettings.all_day,
      event_location_name: nextEventSettings.location_name,
      event_booking_url: nextEventSettings.booking_url,
      event_is_free: nextEventSettings.is_free,
      event_price_text: nextEventSettings.price_text
    };

    if (image.group_root_item_id && rootItem && rootItem.id !== image.id) {
      selectedRootItem = {
        id: rootItem.id,
        title: rootItem.title,
        slug: rootItem.slug,
        group_slug: rootItem.group_slug,
        canonical_path: rootItem.canonical_path
      };
      rootSearchQuery = rootItem.title || rootItem.slug || rootItem.id;
    } else {
      selectedRootItem = null;
      rootSearchQuery = '';
    }

    rootSearchResults = [];
    groupSlugSuggestions = [];
    managementSaveMessage = '';
  }

  function startEditGeoFields() {
    if (currentUser && image && canEditItem && editMode) {
      editingGeoFields = true;
      countryNameEditValue = image.country_name || image.country_slug || image.country_code || '';
      districtNameEditValue = image.district_name || image.district_slug || image.district_code || '';
      municipalityNameEditValue = image.municipality_name || image.municipality_slug || '';
      localityNameEditValue = image.locality_name || '';
      geoSearchQuery = '';
      geoSearchResults = [];
      geoSearchLoading = false;
      geoSearchError = '';
    }
  }

  function cancelEditGeoFields() {
    editingGeoFields = false;
    countryNameEditValue = image?.country_name || image?.country_slug || image?.country_code || '';
    districtNameEditValue = image?.district_name || image?.district_slug || image?.district_code || '';
    municipalityNameEditValue = image?.municipality_name || image?.municipality_slug || '';
    localityNameEditValue = image?.locality_name || '';
    geoSearchQuery = '';
    geoSearchResults = [];
    geoSearchLoading = false;
    geoSearchError = '';
  }

  async function persistGeoFields(countryName: string, districtName: string, municipalityName: string, localityName: string) {
    try {
      const res = await authFetch(`/api/item/${image.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country_name: countryName.trim(),
          district_name: districtName.trim(),
          municipality_name: municipalityName.trim(),
          locality_name: localityName.trim() || null
        })
      });
      if (!res.ok) return;
      const result = await res.json();
      if (result?.item) {
        image = { ...image, ...result.item };
      }
      editingGeoFields = false;

      if (browser) {
        const targetPath =
          getStoredOrComputedCanonicalPath({
            item: image,
            rootItem: image?.group_root_item_id ? selectedRootItem || rootItem : { ...rootItem, ...image },
            type: contentType
          }) || canonicalPath || window.location.pathname;

        await goto(`${targetPath}${window.location.search}`, {
          invalidateAll: true,
          replaceState: true,
          noScroll: true
        });
      }
    } catch (err) {
      console.error('Failed to save geo fields:', err);
    }
  }

  async function saveGeoFields() {
    if (!editingGeoFields || !currentUser || !image || !(isCreator || $unifiedRightsStore.rights?.edit)) return;
    await persistGeoFields(countryNameEditValue, districtNameEditValue, municipalityNameEditValue, localityNameEditValue);
    editingGeoFields = false;
  }

  async function autofillGeoFieldsFromCoordinates() {
    if (!image?.lat || !image?.lon || !currentUser || !canEditItem || !editMode) return;

    try {
      const geocoded = await reverseGeocodeCoordinates(Number(image.lat), Number(image.lon));
      if (!geocoded) return;

      editingGeoFields = true;
      countryNameEditValue = geocoded.countryName || countryNameEditValue || image.country_name || '';
      districtNameEditValue = geocoded.districtName || districtNameEditValue || image.district_name || '';
      municipalityNameEditValue = geocoded.municipalityName || municipalityNameEditValue || image.municipality_name || '';
      localityNameEditValue = geocoded.localityName || localityNameEditValue || image.locality_name || '';
      await persistGeoFields(countryNameEditValue, districtNameEditValue, municipalityNameEditValue, localityNameEditValue);
    } catch (err) {
      console.error('Failed to autofill geo fields from coordinates:', err);
    }
  }

  async function runGeoSearch() {
    const query = geoSearchQuery.trim();
    if (query.length < 3) {
      geoSearchResults = [];
      geoSearchError = '';
      geoSearchLoading = false;
      return;
    }

    geoSearchLoading = true;
    geoSearchError = '';

    try {
      const results = await searchLocationHierarchy(query);
      geoSearchResults = results;
      geoSearchError = results.length ? '' : 'Kein passender Ort oder keine Landmarke gefunden.';
    } catch (err) {
      console.error('Failed to search geo hierarchy:', err);
      geoSearchResults = [];
      geoSearchError = 'Ortssuche ist gerade nicht verfügbar.';
    } finally {
      geoSearchLoading = false;
    }
  }

  function handleGeoSearchInput() {
    geoSearchError = '';
    if (geoSearchTimeout) clearTimeout(geoSearchTimeout);
    geoSearchTimeout = setTimeout(() => {
      void runGeoSearch();
    }, 300);
  }

  function selectGeoSearchResult(result: SearchGeocodeResult) {
    if (geoSearchTimeout) {
      clearTimeout(geoSearchTimeout);
      geoSearchTimeout = null;
    }
    countryNameEditValue = result.countryName || countryNameEditValue;
    districtNameEditValue = result.districtName || districtNameEditValue;
    municipalityNameEditValue = result.municipalityName || municipalityNameEditValue;
    localityNameEditValue = result.localityName || localityNameEditValue;
    geoSearchQuery = result.displayName || '';
    geoSearchResults = [];
    geoSearchError = '';
  }

  $: if (image?.id && image.id !== lastManagementImageId) {
    lastManagementImageId = image.id;
    syncManagementFormFromImage();
  }

  async function loadRootCandidates(query: string) {
    if (!browser || !image || !(isCreator || $unifiedRightsStore.rights?.edit)) return;

    const searchToken = ++latestRootSearchToken;
    rootSearchLoading = true;

    try {
      const sanitized = query.trim().replace(/[,%]/g, ' ');
      let request = supabase
        .from('items')
        .select('id, title, slug, group_slug, canonical_path, created_at')
        .is('group_root_item_id', null)
        .neq('id', image.id)
        .order('created_at', { ascending: false })
        .limit(8);

      if (sanitized) {
        request = request.or(`title.ilike.%${sanitized}%,slug.ilike.%${sanitized}%,group_slug.ilike.%${sanitized}%`);
      }

      const { data: candidates, error: searchError } = await request;
      if (searchToken !== latestRootSearchToken) return;

      if (searchError) {
        console.error('Failed to load root candidates:', searchError);
        rootSearchResults = [];
        return;
      }

      rootSearchResults = candidates || [];
    } finally {
      if (searchToken === latestRootSearchToken) {
        rootSearchLoading = false;
      }
    }
  }

  async function loadGroupSlugSuggestions(query: string) {
    if (!browser || !image || !canEditItem) return;

    const searchToken = ++latestGroupSlugToken;
    groupSlugSuggestionsLoading = true;

    try {
      const sanitized = query.trim().replace(/[,%]/g, ' ');
      let request = supabase
        .from('items')
        .select('group_slug')
        .not('group_slug', 'is', null)
        .neq('id', image.id)
        .order('group_slug')
        .limit(10);

      if (sanitized) {
        request = request.ilike('group_slug', `%${sanitized}%`);
      }

      const { data, error: suggestionError } = await request;
      if (searchToken !== latestGroupSlugToken) return;

      if (suggestionError) {
        console.error('Failed to load group slug suggestions:', suggestionError);
        groupSlugSuggestions = [];
        return;
      }

      groupSlugSuggestions = Array.from(
        new Set(
          (data || [])
            .map((item) => item.group_slug?.trim())
            .filter((value): value is string => !!value)
        )
      );
    } finally {
      if (searchToken === latestGroupSlugToken) {
        groupSlugSuggestionsLoading = false;
      }
    }
  }

  function handleGroupSlugInput(value: string) {
    managementForm.group_slug = slugifySegment(value);

    if (!managementForm.group_slug.trim()) {
      groupSlugSuggestions = [];
      return;
    }

    loadGroupSlugSuggestions(managementForm.group_slug);
  }

  function handleGroupSlugInputEvent(event: Event) {
    const target = event.currentTarget as HTMLInputElement;
    handleGroupSlugInput(target.value);
  }

  function applyGroupSlugSuggestion(value: string) {
    managementForm.group_slug = slugifySegment(value);
    groupSlugSuggestions = [];
  }

  function clearGroupSlug() {
    managementForm.group_slug = '';
    groupSlugSuggestions = [];
  }

  function toggleGroupSlugInfo() {
    showGroupSlugInfo = !showGroupSlugInfo;
  }

  function handleRootSearchInput(value: string) {
    rootSearchQuery = value;
    if (!value.trim()) {
      rootSearchResults = [];
      return;
    }
    loadRootCandidates(value);
  }

  function handleRootSearchFocus() {
    if (!rootSearchResults.length) {
      loadRootCandidates(rootSearchQuery);
    }
  }

  function selectRootCandidate(candidate: any) {
    selectedRootItem = candidate;
    managementForm.group_root_item_id = candidate.id;
    rootSearchQuery = candidate.title || candidate.slug || candidate.id;
    rootSearchResults = [];
  }

  function clearRootCandidate() {
    selectedRootItem = null;
    managementForm.group_root_item_id = null;
    rootSearchQuery = '';
    rootSearchResults = [];
  }

  async function saveManagementFields(options: { navigate?: boolean } = {}) {
    const navigate = options.navigate ?? true;
    if (!image || !canEditItem || managementSavePending) return false;

    managementSavePending = true;
    managementSaveMessage = '';

    const payload = {
      type_id: Number(managementForm.type_id) || image.type_id || 1,
      group_slug: toNullableString(slugifySegment(managementForm.group_slug)),
      sort_order: managementForm.sort_order.trim() === '' ? null : Number(managementForm.sort_order),
      content: toNullableString(managementForm.content),
      starts_at: toNullableIso(managementForm.starts_at),
      ends_at: toNullableIso(managementForm.ends_at),
      external_url: toNullableString(managementForm.external_url),
      video_url: toNullableString(managementForm.video_url),
      page_settings: buildPageSettings(
        image.page_settings,
        managementForm.nearby_gallery_mode,
        {
          display_mode: managementForm.event_display_mode,
          all_day: managementForm.event_all_day,
          location_name: managementForm.event_location_name,
          booking_url: managementForm.event_booking_url,
          is_free: managementForm.event_is_free,
          price_text: managementForm.event_price_text
        },
        Number(managementForm.type_id) === 2
      )
    };

    try {
      const res = await authFetch(`/api/item/${image.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorText = await res.text();
        managementSaveMessage = errorText || 'Speichern fehlgeschlagen';
        return false;
      }

      const result = await res.json();
      image = { ...image, ...result.item };
      const nextRootItem =
        (result.item?.group_root_item_id ? selectedRootItem || rootItem : { ...rootItem, ...result.item, group_slug: result.item?.group_slug ?? null }) ||
        rootItem;
      const nextType =
        availableTypes.find((type) => type.id === result.item?.type_id) || contentType;
      const resolvedCanonicalPath =
        getStoredOrComputedCanonicalPath({
          item: result.item,
          rootItem: nextRootItem,
          type: nextType
        }) || canonicalPath;

      canonicalPath = resolvedCanonicalPath;
      contentType = availableTypes.find((type) => type.id === result.item?.type_id) || contentType;
      managementSaveMessage = 'Gespeichert';
      syncManagementFormFromImage();

      if (browser && navigate) {
        const targetPath = resolvedCanonicalPath || window.location.pathname;
        const targetUrl = `${targetPath}${window.location.search}`;
        await goto(targetUrl, { invalidateAll: true, replaceState: true, noScroll: true });
      }
      return true;
    } catch (err) {
      console.error('Failed to save management fields:', err);
      managementSaveMessage = 'Speichern fehlgeschlagen';
      return false;
    } finally {
      managementSavePending = false;
    }
  }

  async function toggleEditMode() {
    if (!canEditItem) return;

    if (!editMode) {
      editMode = true;
      managementSaveMessage = '';
      return;
    }

    await saveOpenEditors();
    const managementSaved = await saveManagementFields({ navigate: false });
    if (!managementSaved) return;

    editMode = false;

    if (browser) {
      const targetPath =
        getStoredOrComputedCanonicalPath({
          item: image,
          rootItem: image?.group_root_item_id ? selectedRootItem || rootItem : { ...rootItem, ...image },
          type: contentType
        }) ||
        canonicalPath ||
        window.location.pathname;
      await goto(`${targetPath}${window.location.search}`, {
        invalidateAll: true,
        replaceState: true,
        noScroll: true
      });
    }
  }

  // User-Initialisierung (wie im Backup)
  // --- Title ---
  function startEditTitle() {
    if (currentUser && image && canEditItem) {
      editingTitle = true;
      titleEditValue = image.title || '';
      setTimeout(() => {
        const input = document.getElementById('title-edit-input') as HTMLInputElement;
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
          input.click();
        }
      }, 100);
    }
  }
  async function saveTitle() {
    if (!editingTitle || !currentUser || !image || !(isCreator || $unifiedRightsStore.rights?.edit)) return;
    const newTitle = titleEditValue.trim();
    if (newTitle.length > 60) return;
    try {
      const res = await authFetch(`/api/item/${image.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle })
      });
      if (!res.ok) return;
      image.title = newTitle;
      editingTitle = false;
    } catch (err) { console.error('Failed to save title:', err); }
  }
  function cancelEditTitle() { editingTitle = false; titleEditValue = image.title || ''; }
  function handleTitleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') { event.preventDefault(); saveTitle(); }
    else if (event.key === 'Escape') { event.preventDefault(); cancelEditTitle(); }
  }
  // --- Description ---
  function startEditDescription() {
    if (currentUser && image && canEditItem) {
      editingDescription = true;
      descriptionEditValue = image.description || '';
      setTimeout(() => {
        const input = document.getElementById('description-edit-input') as HTMLTextAreaElement;
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
          input.click();
        }
      }, 100);
    }
  }
  async function saveDescription() {
    if (!editingDescription || !currentUser || !image || !(isCreator || $unifiedRightsStore.rights?.edit)) return;
    const newDescription = descriptionEditValue.trim();
    if (newDescription.length > 160) return;
    try {
      const res = await authFetch(`/api/item/${image.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: newDescription })
      });
      if (!res.ok) return;
      image.description = newDescription;
      editingDescription = false;
    } catch (err) { console.error('Failed to save description:', err); }
  }
  function cancelEditDescription() { editingDescription = false; descriptionEditValue = image.description || ''; }
  function handleDescriptionKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') { event.preventDefault(); saveDescription(); }
    else if (event.key === 'Escape') { event.preventDefault(); cancelEditDescription(); }
  }
  // --- Caption ---
  function startEditCaption() {
    if (currentUser && image && canEditItem) {
      editingCaption = true;
      captionEditValue = image.caption || '';
      setTimeout(() => {
        const input = document.getElementById('caption-edit-input') as HTMLTextAreaElement;
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
          input.click();
        }
      }, 100);
    }
  }
  async function saveCaption() {
    if (!editingCaption || !currentUser || !image || !(isCreator || $unifiedRightsStore.rights?.edit)) return;
    const newCaption = captionEditValue.trim();
    if (newCaption.length > 300) return;
    try {
      const res = await authFetch(`/api/item/${image.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption: newCaption })
      });
      if (!res.ok) return;
      image.caption = newCaption;
      editingCaption = false;
    } catch (err) { console.error('Failed to save caption:', err); }
  }
  function cancelEditCaption() { editingCaption = false; captionEditValue = image.caption || ''; }
  function handleCaptionKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) { 
      event.preventDefault(); 
      saveCaption(); 
    }
    else if (event.key === 'Escape') { 
      event.preventDefault(); 
      cancelEditCaption(); 
    }
  }
  // --- Keywords ---
  function startEditKeywords() {
    if (currentUser && image && canEditItem && editMode) {
      editingKeywords = true;
      keywordsEditValue = (image.keywords || []).join(', ');
      setTimeout(() => {
        const input = document.getElementById('keywords-edit-input') as HTMLInputElement;
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
          input.click();
        }
      }, 100);
    }
  }
  async function saveKeywords() {
    if (!editingKeywords || !currentUser || !image || !(isCreator || $unifiedRightsStore.rights?.edit)) return;
    const newKeywords = keywordsEditValue.trim();
    const keywordsArray = sanitizeKeywords(newKeywords, {
      countryName: image.country_name,
      stateName: image.state_name,
      regionName: image.region_name,
      districtName: image.district_name,
      municipalityName: image.municipality_name,
      localityName: image.locality_name
    });
    
    try {
      const res = await authFetch(`/api/item/${image.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: keywordsArray })
      });
      if (!res.ok) return;
      image.keywords = keywordsArray;
      keywordsEditValue = keywordsArray.join(', ');
      editingKeywords = false;
    } catch (err) { console.error('Failed to save keywords:', err); }
  }
  function cancelEditKeywords() { editingKeywords = false; keywordsEditValue = (image.keywords || []).join(', '); }
  function handleKeywordsKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') { event.preventDefault(); saveKeywords(); }
    else if (event.key === 'Escape') { event.preventDefault(); cancelEditKeywords(); }
  }
  // --- Filename ---
  function startEditFilename() {
    if (currentUser && image && canEditItem) {
      editingFilename = true;
      filenameEditValue = image.original_name || '';
      setTimeout(() => {
        const input = document.getElementById('filename-edit-input') as HTMLInputElement;
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
          input.click();
        }
      }, 100);
    }
  }
  async function saveFilename() {
    if (!editingFilename || !currentUser || !image || !(isCreator || $unifiedRightsStore.rights?.edit)) return;
    const newFilename = filenameEditValue.trim();
    if (newFilename.length > 255) return;
    try {
      const res = await authFetch(`/api/item/${image.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ original_name: newFilename })
      });
      if (!res.ok) return;
      const result = await res.json();
      if (result?.item) {
        image = { ...image, ...result.item };
      } else {
        image.original_name = newFilename;
      }
      editingFilename = false;
    } catch (err) { console.error('Failed to save filename:', err); }
  }
  function cancelEditFilename() { editingFilename = false; filenameEditValue = image.original_name || ''; }
  function handleFilenameKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') { event.preventDefault(); saveFilename(); }
    else if (event.key === 'Escape') { event.preventDefault(); cancelEditFilename(); }
  }
  // --- Slug ---
  function startEditSlug() {
    if (currentUser && image && canEditItem) {
      editingSlug = true;
      slugEditValue = image.slug || '';
      setTimeout(() => {
        const input = document.getElementById('slug-edit-input') as HTMLInputElement;
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
          input.click();
        }
      }, 100);
    }
  }
  async function saveSlug() {
    if (!editingSlug || !currentUser || !image || !(isCreator || $unifiedRightsStore.rights?.edit)) return;
    const newSlug = slugEditValue.trim();
    if (newSlug.length > 255) return;
    try {
      const res = await authFetch(`/api/item/${image.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: newSlug })
      });
      if (!res.ok) return;
      image.slug = newSlug;
      editingSlug = false;
    } catch (err) { console.error('Failed to save slug:', err); }
  }
  function cancelEditSlug() { editingSlug = false; slugEditValue = image.slug || ''; }
  function handleSlugKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') { event.preventDefault(); saveSlug(); }
    else if (event.key === 'Escape') { event.preventDefault(); cancelEditSlug(); }
  }

  function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number): string {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const meters = Math.round(R * c);
    return meters >= 1000 ? (meters / 1000).toFixed(1).replace('.', ',') + 'km' : meters + 'm';
  }
  async function refreshVariantContext() {
    await loadNearbyItems();

    if (browser) {
      await goto(`${window.location.pathname}${window.location.search}`, {
        invalidateAll: true,
        replaceState: true,
        noScroll: true
      });
    }
  }

  async function openVariantItem(targetPath: string) {
    if (!browser) return;
    await goto(targetPath, {
      invalidateAll: true,
      replaceState: false,
      noScroll: true
    });
  }

  async function updateVariantAssignment(itemId: string, payload: Record<string, unknown>) {
    const response = await authFetch(`/api/item/${itemId}/variant`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.status === 409) {
      const errorData = await response.json().catch(() => null);
      if (errorData?.code === 'requires_reparent_confirmation') {
        const confirmed = browser ? window.confirm(errorData.error) : false;
        if (!confirmed) return;

        await updateVariantAssignment(itemId, {
          ...payload,
          confirmReparent: true
        });
        return;
      }

      throw new Error(errorData?.error || 'Variante konnte nicht zugewiesen werden');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || 'Variante konnte nicht gespeichert werden');
    }

    await refreshVariantContext();
  }

  async function handleNearbyGalleryToggle(itemId: string, nextAssignedState: boolean) {
    if (!currentVariantRootId) return;

    try {
      if (nextAssignedState) {
        await updateVariantAssignment(itemId, {
          action: 'assign',
          targetRootId: currentVariantRootId
        });
      } else {
        await updateVariantAssignment(itemId, {
          action: 'detach'
        });
      }
    } catch (error) {
      console.error('Failed to update variant assignment:', error);
      if (browser) {
        window.alert(error instanceof Error ? error.message : 'Variante konnte nicht gespeichert werden');
      }
    }
  }

  function getNearbyGalleryStatus(itemId: string) {
    const item = nearby.find(i => i.id === itemId);
    return item ? item.group_root_item_id === currentVariantRootId : false;
  }
  function formatRadius(meters: number) {
    return meters >= 1000
      ? (meters / 1000).toFixed(1).replace('.', ',') + ' km'
      : meters + ' m';
  }

  // Dateigrößen für 64px, 512px, 2048px
  let fileSizes: { size64: number | null; size512: number | null; size2048: number | null } = { size64: null, size512: null, size2048: null };
  let rerenderingVariants = false;
  let replacingOriginal = false;

  function normalizeKeywords(value: string[] | string | null | undefined): string[] {
    if (!value) return [];
    const source = Array.isArray(value) ? value : value.split(',');
    return source
      .map((keyword: string) => keyword.trim())
      .filter((keyword: string) => keyword.length > 0)
      .slice(0, 15)
      .map((keyword: string) => keyword.normalize('NFC'));
  }

  function normalizeUtf8(str: string | null | undefined): string {
    return str ? str.normalize('NFC') : '';
  }

  function buildPublicStorageUrl(bucket: string, path: string | null | undefined) {
    if (!path) return null;
    return `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/${bucket}/${path}`;
  }

  function imageVersionToken(source: { updated_at?: string | null; created_at?: string | null } | null | undefined) {
    const rawValue = source?.updated_at || source?.created_at;
    if (!rawValue) return null;

    const timestamp = new Date(rawValue).getTime();
    return Number.isFinite(timestamp) ? String(timestamp) : null;
  }

  function appendVersionParam(
    url: string | null,
    source: { updated_at?: string | null; created_at?: string | null } | null | undefined
  ) {
    if (!url) return null;

    const version = imageVersionToken(source);
    if (!version) return url;

    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${version}`;
  }

  function buildSeoSizedImageUrl(size: '512' | '2048') {
    if (!image?.slug) return null;

    const imagePath = size === '2048' ? image.path_2048 || image.path_512 : image.path_512;
    if (!imagePath) return null;

    const extensionMatch = imagePath.match(/\.(jpg|jpeg|webp|png)$/i);
    const fileExtension = extensionMatch ? extensionMatch[0].toLowerCase() : '.jpg';

    return appendVersionParam(`https://culoca.com/images/${image.slug}-${size}${fileExtension}`, image);
  }

  async function fetchRemoteFileSize(url: string | null) {
    if (!url) return null;

    try {
      const headResponse = await fetch(url, { method: 'HEAD' });
      const contentLength = headResponse.headers.get('content-length');
      if (headResponse.ok && contentLength) {
        const parsed = Number(contentLength);
        if (!Number.isNaN(parsed) && parsed > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback to GET below when HEAD is unavailable.
    }

    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const blob = await response.blob();
      return blob.size;
    } catch {
      return null;
    }
  }

  async function fetchFileSizes() {
    if (!image || !browser) return;

    const [size64, size512, size2048] = await Promise.all([
      fetchRemoteFileSize(buildPublicStorageUrl('images-64', image.path_64)),
      fetchRemoteFileSize(buildSeoSizedImageUrl('512') || buildPublicStorageUrl('images-512', image.path_512)),
      fetchRemoteFileSize(buildSeoSizedImageUrl('2048') || buildPublicStorageUrl('images-2048', image.path_2048))
    ]);

    fileSizes = { size64, size512, size2048 };
  }

  $: if (image && browser) {
    fileSizes = { size64: null, size512: null, size2048: null };
    setTimeout(fetchFileSizes, 1000);
  }

  async function rerenderImageVariants() {
    if (!browser || !image?.id || !currentUser || !(isCreator || $unifiedRightsStore.rights?.edit) || !editMode) return;
    if (rerenderingVariants) return;

    rerenderingVariants = true;
    try {
      const res = await authFetch(`/api/item/${image.id}/rerender`, {
        method: 'POST'
      });

      const result = await res.json().catch(() => null);
      if (!res.ok || !result?.success) {
        throw new Error(result?.error || 'Varianten konnten nicht neu gerendert werden.');
      }

      if (result.item) {
        image = { ...image, ...result.item };
      }

      fileSizes = { size64: null, size512: null, size2048: null };
      setTimeout(fetchFileSizes, 1200);
    } catch (err) {
      console.error('Failed to rerender variants:', err);
      alert(err instanceof Error ? err.message : 'Varianten konnten nicht neu gerendert werden.');
    } finally {
      rerenderingVariants = false;
    }
  }

  async function replaceOriginalImage(file: File) {
    if (!browser || !image?.id || !currentUser || !(isCreator || $unifiedRightsStore.rights?.edit) || !editMode) return;
    if (replacingOriginal) return;

    replacingOriginal = true;
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await authFetch(`/api/item/${image.id}/rerender`, {
        method: 'POST',
        body: formData
      });

      const result = await res.json().catch(() => null);
      if (!res.ok || !result?.success) {
        throw new Error(result?.error || 'Original konnte nicht ersetzt werden.');
      }

      if (result.item) {
        image = { ...image, ...result.item };
      }

      fileSizes = { size64: null, size512: null, size2048: null };
      setTimeout(fetchFileSizes, 1200);
    } catch (err) {
      console.error('Failed to replace original image:', err);
      alert(err instanceof Error ? err.message : 'Original konnte nicht ersetzt werden.');
    } finally {
      replacingOriginal = false;
    }
  }

  // Scroll event listener for scroll-to-top button
  onMount(() => {
    if (browser) {
      const handleScroll = () => {
        showScrollToTop = window.scrollY > 100;
      };
      
      window.addEventListener('scroll', handleScroll);
      handleScroll(); // Initial check
      
      return () => {
        window.removeEventListener('scroll', handleScroll);
      };
    }
  });

  // Layout für NearbyGallery (aus LocalStorage, fallback justified)
  let galleryLayout: 'justified' | 'grid' = 'justified';
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('galleryLayout');
    if (stored === 'grid' || stored === 'justified') {
      galleryLayout = stored;
    }
  }
  $: galleryLayout = $useJustifiedLayout ? 'justified' : 'grid';

  async function deleteImage() {
    if (!image || !currentUser || image.profile_id !== currentUser.id) return;
    if (!confirm('Willst du dieses Bild wirklich löschen?')) return;
    try {
      const res = await authFetch(`/api/item/${image.id}`, { method: 'DELETE' });
      if (res.ok) {
        goto('/');
      } else {
        const payload = await res.json().catch(() => null);
        alert(payload?.error || 'Löschen fehlgeschlagen.');
      }
    } catch (err) {
      alert('Fehler beim Löschen.');
    }
  }

  async function downloadOriginal(_imageId: string, _originalName: string) {
    const slug = image?.slug || itemSlug;
    if (!slug) return;
    const returnTo = browser ? `${window.location.pathname}${window.location.search}` : canonicalPath || `/item/${slug}`;
    await goto(`/item/${slug}/download?returnTo=${encodeURIComponent(returnTo)}`);
  }

  function toggleGallery() {
    if (!image?.group_root_item_id) return;
    handleNearbyGalleryToggle(image.id, false);
  }

  function extractAdobeAssetId(url: string): string {
    const match = url.match(/\/(\d+)(?:[/?#]|$)/);
    return match ? match[1] : '';
  }

  async function saveAdobeStockData() {
    if (!image || !isCreator) return;
    try {
      adobeSaveLoading = true;
      const normalizedUrl = adobeStockUrlEdit.trim();
      const inferredId = adobeStockAssetIdEdit.trim() || extractAdobeAssetId(normalizedUrl);
      const nextStatus = normalizedUrl ? (image.adobe_stock_status === 'none' ? 'uploaded' : image.adobe_stock_status) : 'none';

      const res = await authFetch(`/api/item/${image.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adobe_stock_url: normalizedUrl || null,
          adobe_stock_asset_id: inferredId || null,
          adobe_stock_status: nextStatus
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        adobeMessage = data?.error || 'Adobe-Link konnte nicht gespeichert werden';
        return;
      }

      const data = await res.json();
      if (data?.item) {
        image = { ...image, ...data.item };
      } else {
        image = {
          ...image,
          adobe_stock_url: normalizedUrl || null,
          adobe_stock_asset_id: inferredId || null,
          adobe_stock_status: nextStatus
        };
      }
      adobeStockAssetIdEdit = inferredId;
      adobeMessage = 'Adobe-Daten gespeichert';
    } catch (e) {
      adobeMessage = 'Adobe-Daten konnten nicht gespeichert werden';
    } finally {
      adobeSaveLoading = false;
    }
  }

  async function uploadToAdobeStock() {
    if (!image || !isCreator) return;
    try {
      adobeUploadLoading = true;
      adobeMessage = '';

      const res = await authFetch(`/api/adobe-stock/upload/${image.id}`, {
        method: 'POST'
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        adobeMessage = data?.error || 'Upload zu Adobe fehlgeschlagen';
        return;
      }

      if (data?.item) {
        image = { ...image, ...data.item };
        adobeStockUrlEdit = data.item.adobe_stock_url || adobeStockUrlEdit;
        adobeStockAssetIdEdit = data.item.adobe_stock_asset_id || adobeStockAssetIdEdit;
      }
      adobeMessage = data?.message || 'Upload zu Adobe gestartet';
    } catch (e) {
      adobeMessage = 'Upload zu Adobe fehlgeschlagen';
    } finally {
      adobeUploadLoading = false;
    }
  }

  onMount(() => {
    const explicitReturnTo = sanitizeReturnTo($page.url.searchParams.get('returnTo'), '/');
    if (isValidImageBackTarget(explicitReturnTo)) {
      imageBackHref = explicitReturnTo;
      return;
    }

    imageBackHref = getStoredLocalRoute();

    const localReferrer = getLocalReferrerFallback();
    if (localReferrer !== '/') {
      imageBackHref = localReferrer;
    }
  });
</script>

<svelte:head>
  <title>{image?.title || `Item ${itemSlug} - culoca.com`}</title>
  <meta name="description" content={trimText(image?.description || image?.caption || 'culoca.com - see you local, Deine Webseite für regionalen Content. Entdecke deine Umgebung immer wieder neu.')}>
  
  <link rel="canonical" href={canonicalUrl}>
  {#if seoLinks?.newer?.canonicalPath}
    <link rel="prev" href={`https://culoca.com${seoLinks.newer.canonicalPath}`}>
  {/if}
  {#if seoLinks?.older?.canonicalPath}
    <link rel="next" href={`https://culoca.com${seoLinks.older.canonicalPath}`}>
  {/if}
  
  <!-- Robots -->
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
  <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
  <meta name="bingbot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
  
  <!-- Open Graph -->
  <meta property="og:type" content="article">
  <meta property="og:locale" content="de_DE">
  <meta property="og:title" content={image?.title || `Item ${itemSlug} - culoca.com`}>
  <meta property="og:description" content={image?.description || image?.caption || 'culoca.com - see you local, Deine Webseite für regionalen Content. Entdecke deine Umgebung immer wieder neu.'}>
  <meta property="og:url" content={canonicalUrl}> 
  <!-- Open Graph Image: Use SEO-friendly URL with size suffix (no query parameters) -->
  {#if image}
    {@const imagePathForExtension = image.path_2048 || image.path_512}
    {@const extensionMatch = imagePathForExtension ? imagePathForExtension.match(/\.(jpg|jpeg|webp|png)$/i) : null}
    {@const fileExtension = extensionMatch ? extensionMatch[0].toLowerCase() : '.jpg'}
    {@const ogImageUrl = image.path_2048
      ? `https://culoca.com/images/${image.slug}-2048${fileExtension}`
      : (image.path_512 ? `https://culoca.com/images/${image.slug}-512${fileExtension}` : '')}
    <!-- Calculate dimensions for 2048px version (proportional scaling) -->
    {@const originalWidth = image.width || 2048}
    {@const originalHeight = image.height || 1365}
    {@const maxDimension2048 = 2048}
    {@const scale2048 = originalWidth > maxDimension2048 || originalHeight > maxDimension2048
      ? Math.min(maxDimension2048 / originalWidth, maxDimension2048 / originalHeight)
      : 1}
    {@const width2048 = Math.max(1, Math.min(Math.round(originalWidth * scale2048), maxDimension2048))}
    {@const height2048 = Math.max(1, Math.min(Math.round(originalHeight * scale2048), maxDimension2048))}
    <meta property="og:image" content={ogImageUrl}>
    <meta property="og:image:width" content={width2048.toString()}>
    <meta property="og:image:height" content={height2048.toString()}>
    <meta property="og:image:alt" content={image.title || image.description || `Item ${itemSlug}`}>
  {:else}
    <meta property="og:image" content={`https://culoca.com/api/og-image/${itemSlug}`}>
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content={`Item ${itemSlug}`}>
  {/if}
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content={image?.title || `Item ${itemSlug} - culoca.com`}>
  <meta name="twitter:description" content={image?.description || image?.caption || 'culoca.com - see you local, Deine Webseite für regionalen Content. Entdecke deine Umgebung immer wieder neu.'}>
  {#if image}
    {@const imagePathForExtension = image.path_2048 || image.path_512}
    {@const extensionMatch = imagePathForExtension ? imagePathForExtension.match(/\.(jpg|jpeg|webp|png)$/i) : null}
    {@const fileExtension = extensionMatch ? extensionMatch[0].toLowerCase() : '.jpg'}
    {@const twitterImageUrl = image.path_2048
      ? `https://culoca.com/images/${image.slug}-2048${fileExtension}`
      : (image.path_512 ? `https://culoca.com/images/${image.slug}-512${fileExtension}` : '')}
    <meta name="twitter:image" content={twitterImageUrl}>
  {:else}
    <meta name="twitter:image" content={`https://culoca.com/api/og-image/${itemSlug}`}>
  {/if}
  <meta name="twitter:image:alt" content={image?.title || `Item ${itemSlug}`}>
  
  <meta name="author" content={image?.full_name || 'culoca.com'}>
  
  <!-- Dynamisches Favicon für bessere SEO -->
  <link rel="icon" type="image/png" href={`/api/favicon/${itemSlug}`} sizes="32x32 48x48 96x96 192x192 512x512"> 
  <link rel="apple-touch-icon" href={`/api/favicon/${itemSlug}`} sizes="180x180">
  
  <!-- Strukturierte Daten (JSON-LD) für bessere SEO - Optimiert nach Google-Richtlinien -->
  {#if image}
    {@const itemName = image.title || image.original_name || `Bild ${image.id}`}
    {@const itemUrl = canonicalUrl}
    {@const hasPath2048 = !!image.path_2048}
    {@const hasPath512 = !!image.path_512}
    {@const imagePathForExtension = image.path_2048 || image.path_512}
    {@const extensionMatch = imagePathForExtension ? imagePathForExtension.match(/\.(jpg|jpeg|webp|png)$/i) : null}
    {@const fileExtension = extensionMatch ? extensionMatch[0].toLowerCase() : '.jpg'}
    
    <!-- Generate SEO-friendly URLs with size suffixes (no query parameters) -->
    <!-- contentUrl: Always use 2048px version if available, otherwise 512px -->
    {@const imageUrl2048 = hasPath2048
      ? `https://culoca.com/images/${image.slug}-2048${fileExtension}`
      : (hasPath512 ? `https://culoca.com/images/${image.slug}-512${fileExtension}` : '')}
    <!-- thumbnailUrl: Always use 512px version if available, otherwise 2048px (fallback) -->
    {@const imageUrl512 = hasPath512
      ? `https://culoca.com/images/${image.slug}-512${fileExtension}`
      : (hasPath2048 ? `https://culoca.com/images/${image.slug}-2048${fileExtension}` : '')}
    
    <!-- Calculate dimensions for 2048px and 512px versions (proportional scaling) -->
    <!-- Note: image.width and image.height are original dimensions after EXIF orientation -->
    {@const originalWidth = image.width || 2048}
    {@const originalHeight = image.height || 1365}
    
    <!-- For 2048px: scale down if original is larger than 2048px on any side, otherwise use original -->
    <!-- This matches the resize logic: fit: 'inside', withoutEnlargement: true -->
    {@const maxDimension2048 = 2048}
    {@const scale2048 = originalWidth > maxDimension2048 || originalHeight > maxDimension2048
      ? Math.min(maxDimension2048 / originalWidth, maxDimension2048 / originalHeight)
      : 1}
    {@const width2048 = Math.max(1, Math.min(Math.round(originalWidth * scale2048), maxDimension2048))}
    {@const height2048 = Math.max(1, Math.min(Math.round(originalHeight * scale2048), maxDimension2048))}
    
    <!-- For 512px thumbnail: scale down proportionally (always scale for thumbnail) -->
    {@const maxDimension512 = 512}
    {@const scale512 = Math.min(maxDimension512 / originalWidth, maxDimension512 / originalHeight)}
    {@const width512 = Math.max(1, Math.round(originalWidth * scale512))}
    {@const height512 = Math.max(1, Math.round(originalHeight * scale512))}
    
    {@const uploadDate = image.created_at ? new Date(image.created_at).toISOString() : null}
    {@const dateModified = image.updated_at ? new Date(image.updated_at).toISOString() : 
      (image.created_at ? new Date(image.created_at).toISOString() : null)}
    
    <!-- Process keywords: limit to 8-15 precise keywords, convert to array -->
    {@const keywordsArray = normalizeKeywords(image.keywords)}
    
    {@const rawCaption = image.exif_data?.Caption || image.title || itemName}
    {@const exifCaption = image.exif_data?.Caption ? decodeURIComponent(escape(rawCaption)) : (image.title || itemName)}
    {@const caption = image.caption || exifCaption || image.description || ''}
    {@const sha256 = image.sha256 || undefined}
    {@const creatorName = image.full_name || 'Culoca User'}
    {@const createdYear = image.created_at ? new Date(image.created_at).getFullYear() : new Date().getFullYear()}
    {@const creditText = `Foto: ${creatorName}`}
    {@const copyrightNotice = `© ${createdYear} ${creatorName} | culoca.com. Alle Rechte vorbehalten.`}
    
    <!-- UTF-8 Normalization: Ensure NFC (not NFD) to prevent encoding issues like "SchoÃßbach" -->
    {@const normalizedItemName = normalizeUtf8(itemName)}
    {@const normalizedCaption = normalizeUtf8(caption)}
    {@const normalizedDescription = normalizeUtf8(image.description || caption || '')}
    {@const normalizedCreatorName = normalizeUtf8(creatorName)}
    {@const normalizedCreditText = normalizeUtf8(creditText)}
    {@const normalizedCopyrightNotice = normalizeUtf8(copyrightNotice)}
    {@const normalizedContentLocationName = normalizeUtf8(geoPlaceGraph.currentPlaceName)}
    
    {@html `<script type="application/ld+json">
    ${JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        itemBreadcrumbJsonLd,
        ...geoPlaceGraph.nodes,
        {
          "@type": "ImageObject",
          "@id": imageUrl2048,
          "url": imageUrl2048,
          "contentUrl": imageUrl2048,
          "thumbnailUrl": imageUrl512,
          "name": normalizedItemName,
          "caption": normalizedCaption,
          "description": normalizedDescription,
          "inLanguage": "de",
          "width": width2048,
          "height": height2048,
          "encodingFormat": fileExtension === '.webp' ? 'image/webp' : fileExtension === '.png' ? 'image/png' : 'image/jpeg',
          "license": "https://culoca.com/web/license",
          "creditText": normalizedCreditText,
          "copyrightNotice": normalizedCopyrightNotice,
          "acquireLicensePage": "https://culoca.com/web/license",
          "creator": {
            "@type": "Person",
            "name": normalizedCreatorName
          },
          "copyrightHolder": {
            "@type": "Person",
            "name": normalizedCreatorName
          },
          "contentLocation": {
            "@id": geoPlaceGraph.currentPlaceId,
            "@type": "Place",
            "name": normalizedContentLocationName
          },
          ...(uploadDate && { "datePublished": uploadDate }),
          ...(dateModified && { "dateModified": dateModified }),
          ...(uploadDate && { "uploadDate": uploadDate }),
          ...(keywordsArray.length > 0 && { "keywords": keywordsArray }),
          ...(sha256 ? { "sha256": sha256 } : {}),
          "representativeOfPage": true
        },
        {
          "@type": "WebPage",
          "@id": itemUrl,
          "url": itemUrl,
          "name": normalizedItemName,
          "about": {
            "@id": geoPlaceGraph.currentPlaceId
          },
          "primaryImageOfPage": {
            "@id": imageUrl2048
          }
        }
      ]
    }, null, 2)}
    </script>`}
  {/if}
</svelte:head>

<div class="page">
  <SiteNav />
  {#key itemSlug}
    {#if loading}
      <div class="loading">
        <div class="spinner"></div>
        <span>Lade Bild...</span>
      </div>
    {:else if error}
      <div class="error">❌ Fehler: {error}</div>
    {:else if image}
    <div class="passepartout-container">
      {#if shouldShowMainImage}
        <figure>
          <a href={imageBackHref} class="image-link">
            <img
              src={imageSource}
              srcset={imageSrcset || undefined}
              sizes={imageSizes || undefined}
              alt={image.title && image.description 
                ? `${image.title} - ${image.description}` 
                : image.title || image.description || image.caption || `Bild von ${image.original_name || 'unbekannt'}`}
              class="main-image"
              width={imageWidth2048}
              height={imageHeight2048}
              loading="eager"
              decoding="async"
              fetchpriority="high"
            />
          </a>
        </figure>
        {#if hasVariantStrip}
          <div class="variant-strip" data-nosnippet>
            {#each variantStripItems as groupItem}
              <a
                class:active={groupItem.id === activeGroupItemId}
                class="variant-strip-item"
                href={groupItem.canonicalPath || `/item/${groupItem.slug}`}
                title={groupItem.title || 'Variante'}
                on:click|preventDefault={() => openVariantItem(groupItem.canonicalPath || `/item/${groupItem.slug}`)}
              >
                {#if groupItem.path_64}
                  <img
                    class:square={!$useJustifiedLayout}
                    src={`https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-64/${groupItem.path_64}`}
                    alt={groupItem.title || 'Variante'}
                    loading="lazy"
                  />
                {/if}
              </a>
            {/each}
          </div>
        {/if}
      {/if}
      <div class="passepartout-info">
        {#if canEditItem && editMode}
          <div class="title-type-select">
            <label for="title-type-select">Typ</label>
            <select id="title-type-select" bind:value={managementForm.type_id}>
              {#each availableTypes as type}
                {#if type.id}
                  <option value={type.id}>{type.name}</option>
                {/if}
              {/each}
            </select>
          </div>
          {#if Number(managementForm.type_id) === 2}
            <div class="title-event-details-card">
              <div class="title-event-details-header">Termin Details</div>
              <div class="title-event-details-grid">
                <label class="title-event-field">
                  <span>Von</span>
                  <div class="datetime-input-wrap">
                    <input type="datetime-local" bind:value={managementForm.starts_at} />
                    <span class="datetime-input-icon" aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7 2h2v2h6V2h2v2h2a2 2 0 0 1 2 2v13a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2h2V2zm12 8H5v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9zM6 6a1 1 0 0 0-1 1v1h14V7a1 1 0 0 0-1-1H6zm2 6h3v3H8v-3z"/>
                      </svg>
                    </span>
                  </div>
                </label>

                <label class="title-event-field">
                  <span>Bis</span>
                  <div class="datetime-input-wrap">
                    <input type="datetime-local" bind:value={managementForm.ends_at} />
                    <span class="datetime-input-icon" aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7 2h2v2h6V2h2v2h2a2 2 0 0 1 2 2v13a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2h2V2zm12 8H5v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9zM6 6a1 1 0 0 0-1 1v1h14V7a1 1 0 0 0-1-1H6zm2 6h3v3H8v-3z"/>
                      </svg>
                    </span>
                  </div>
                </label>

                <label class="title-event-field">
                  <span>Terminart</span>
                  <select bind:value={managementForm.event_display_mode}>
                    <option value="single_day">Einzeltag</option>
                    <option value="multi_day">Mehrere Tage</option>
                  </select>
                </label>

                <label class="title-event-field title-event-checkbox">
                  <span>Ganztägig</span>
                  <input type="checkbox" bind:checked={managementForm.event_all_day} />
                </label>

                <label class="title-event-field title-event-field-full">
                  <span>Ort</span>
                  <input type="text" bind:value={managementForm.event_location_name} placeholder="z.B. Stadthalle Burghausen" />
                </label>

                <label class="title-event-field title-event-field-full">
                  <span>Buchungslink</span>
                  <input type="url" bind:value={managementForm.event_booking_url} placeholder="https://..." autocomplete="off" autocorrect="off" autocapitalize="none" inputmode="url" />
                </label>

                <label class="title-event-field title-event-checkbox">
                  <span>Kostenfrei</span>
                  <input type="checkbox" bind:checked={managementForm.event_is_free} />
                </label>

                <label class="title-event-field">
                  <span>Preistext</span>
                  <input type="text" bind:value={managementForm.event_price_text} placeholder="z.B. 12 EUR" />
                </label>
              </div>
            </div>
          {/if}
          <div class="title-group-slug-field">
            <div class="title-group-slug-header">
              <label for="title-group-slug">Group Slug</label>
              <button
                type="button"
                class="info-icon-btn"
                aria-label="Info zum Gruppen-Slug"
                aria-expanded={showGroupSlugInfo}
                on:click={toggleGroupSlugInfo}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 16v-4"/>
                  <path d="M12 8h.01"/>
                </svg>
              </button>
            </div>
            {#if showGroupSlugInfo}
              <div class="group-slug-info-box">
                Vergeben sie einen eindeutigen Gruppen Slug, falls Unterelemente hinzugefügt werden sollen. Sie erhalten dann eine eigene Landingpage für z.B. Musikalben, Bildergalerien etc...
              </div>
            {/if}
            <div class="title-group-slug-input-row">
              <input
                id="title-group-slug"
                type="text"
                bind:value={managementForm.group_slug}
                placeholder="optional, eindeutig"
                autocomplete="off"
                autocorrect="off"
                autocapitalize="none"
                inputmode="text"
                on:input={handleGroupSlugInputEvent}
              />
              {#if managementForm.group_slug}
                <button
                  type="button"
                  class="clear-group-slug-btn"
                  on:click={clearGroupSlug}
                  aria-label="Group Slug leeren"
                  title="Group Slug leeren"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              {/if}
            </div>
            {#if groupSlugSuggestionsLoading}
              <div class="group-slug-hint">Suche vorhandene Gruppen-Slugs...</div>
            {:else if groupSlugSuggestions.length > 0}
              <div class="group-slug-suggestions">
                {#each groupSlugSuggestions as slug}
                  <button type="button" class="group-slug-suggestion" on:click={() => applyGroupSlugSuggestion(slug)}>
                    {slug}
                  </button>
                {/each}
              </div>
            {:else}
              <div class="group-slug-hint">Leer lassen, wenn kein sichtbarer Gruppenpfad gebraucht wird.</div>
            {/if}
          </div>
        {/if}
        {#if rootItem?.id !== image?.id && rootItem?.title && !hasVariantStrip}
          <p class="group-context-line">
            Teil von <a href={data?.rootCanonicalPath || canonicalPath}>{rootItem.title}</a>
          </p>
        {/if}
        <h1 class="title" class:editable={canEditItem} class:editing={editingTitle}>
          {#if editingTitle}
            <div class="title-edit-container">
              <input
                id="title-edit-input"
                type="text"
                bind:value={titleEditValue}
                maxlength="60"
                on:keydown={handleTitleKeydown}
                on:blur={saveTitle}
                class="title-edit-input"
                class:valid={titleEditValue.length >= 40}
                placeholder="Titel eingeben..."
                autocomplete="off"
                autocorrect="off"
                autocapitalize="sentences"
                inputmode="text"
              />
              <span class="char-count" class:valid={titleEditValue.length >= 40}>
                {titleEditValue.length}/60
              </span>
            </div>
          {:else}
            <button type="button" class="title-text" on:click={startEditTitle}>
              {image.title || image.original_name || `Bild ${image.id?.substring(0, 8)}...`}
            </button>
          {/if}
        </h1>
        {#if canEditItem}
          <p class="caption" class:editable={canEditItem} class:editing={editingCaption}>
            {#if editingCaption}
              <div class="caption-edit-container">
                <textarea
                  id="caption-edit-input"
                  bind:value={captionEditValue}
                  maxlength="300"
                  on:keydown={handleCaptionKeydown}
                  on:blur={saveCaption}
                  class="caption-edit-input"
                  class:valid={captionEditValue.length >= 80 && captionEditValue.length <= 120}
                  placeholder="Emotionale Beschreibung eingeben (80-120 Zeichen ideal)..."
                  rows="2"
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="sentences"
                  inputmode="text"
                ></textarea>
                <span class="char-count" class:valid={captionEditValue.length >= 80 && captionEditValue.length <= 120}>
                  {captionEditValue.length}/300
                </span>
              </div>
            {:else}
              <button type="button" class="caption-text" on:click={startEditCaption}>
                {#if image.caption}
                  <em>{@html image.caption.replace(/\\n/g, '<br>').replace(/\n/g, '<br>')}</em>
                {:else}
                  <em class="placeholder">Klicke hier um eine emotionale Beschreibung hinzuzufügen</em>
                {/if}
              </button>
            {/if}
          </p>
        {:else if image.caption}
          <p class="caption">
            <span class="caption-text">
              <em>{image.caption}</em>
            </span>
          </p>
        {/if}
        <p class="description" class:editable={canEditItem} class:editing={editingDescription}>
          {#if editingDescription}
            <div class="description-edit-container">
              <textarea
                id="description-edit-input"
                bind:value={descriptionEditValue}
                maxlength="160"
                on:keydown={handleDescriptionKeydown}
                on:blur={saveDescription}
                class="description-edit-input"
                class:valid={descriptionEditValue.length >= 140}
                placeholder="Beschreibung eingeben..."
                rows="3"
                autocomplete="off"
                autocorrect="off"
                autocapitalize="sentences"
                inputmode="text"
              ></textarea>
              <span class="char-count" class:valid={descriptionEditValue.length >= 140}>
                {descriptionEditValue.length}/160
              </span>
            </div>
          {:else}
            <button type="button" class="description-text" on:click={startEditDescription}>
                {#if image.description}
                  {image.description}
                {:else}
                  <span class="placeholder">Keine Beschreibung verfügbar</span>
                {/if}
              </button>
            {/if}
        {#if hasEventDetails && !(canEditItem && editMode)}
          <div class="event-detail-list">
            {#if eventScheduleText}
              <h2>{eventScheduleText}</h2>
            {/if}
            {#if eventSettings.location_name}
              <h2>{eventSettings.location_name}</h2>
            {/if}
            {#if eventSettings.is_free || eventSettings.price_text}
              <h2>{eventSettings.is_free ? 'Kostenfrei' : eventSettings.price_text}</h2>
            {/if}
            {#if eventSettings.booking_url}
              <a class="event-inline-link" href={eventSettings.booking_url} target="_blank" rel="noopener noreferrer">
                {eventSettings.booking_url}
              </a>
            {/if}
          </div>
        {/if}

      </div>
    </div>
    {#if image?.adobe_stock_url && !(canEditItem && editMode)}
      <p class="adobe-stock-cta">
        <a href={getAdobeAffiliateUrl(image.adobe_stock_url) || image.adobe_stock_url} target="_blank" rel="noopener noreferrer sponsored">Bei Adobe Stock ansehen</a>
      </p>
    {/if}
    {#if hasDateRange && !isEventItem}
      <section class="content-panel">
        <h2>Zeitraum</h2>
        <p>{formatDateRange(contextItem?.starts_at, contextItem?.ends_at)}</p>
      </section>
    {/if}
    <ImageControlsSection
      {image}
      isCreator={isCreator}
      editMode={canEditItem && editMode}
      canFavorite={!!image?.id}
      canLike={!!image?.id}
      {isFavorited}
      {favoriteLoading}
      {isLiked}
      {likeLoading}
      bind:externalUrl={managementForm.external_url}
      bind:videoUrl={managementForm.video_url}
      bind:contentHtml={managementForm.content}
      bind:nearbyGalleryMode={managementForm.nearby_gallery_mode}
      showGalleryToggle={!!image?.group_root_item_id}
      showCalendarDownload={isEventItem && !!image?.starts_at}
      {highlightCalendar}
      {calendarUrl}
      onSetLocationFilter={setLocationFilter}
      onCopyLink={copyCurrentLink}
      onDeleteImage={deleteImage}
      onDownloadOriginal={downloadOriginal}
      onToggleFavorite={toggleFavorite}
      onToggleLike={toggleLike}
      onToggleGallery={toggleGallery}
    />
    {#if favoriteStatus}
      <p class="favorite-status">{favoriteStatus}</p>
    {/if}
    {#if likeStatus}
      <p class="favorite-status">{likeStatus}</p>
    {/if}
    {#if hasVideoEmbed && !(canEditItem && editMode)}
      <section class="content-panel">
        <h2>Video</h2>
        <div class="video-embed">
          <iframe
            src={getEmbedUrl(image.video_url)}
            title={image.title || 'Video'}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen
          ></iframe>
        </div>
      </section>
    {/if}
    {#if shouldShowContentHtml && !(canEditItem && editMode)}
      <section class="content-panel content-html">
        <div class="rich-content">
          {@html effectiveContentHtml}
        </div>
      </section>
    {/if}
    {#if isCreator}
      <section class="content-panel insights-panel">
        <h2>Interaktionen</h2>
        {#if interactionInsightsLoading && !interactionInsightsLoaded}
          <p class="comment-empty">Interaktionen werden geladen...</p>
        {:else}
          <div class="insight-grid">
            <div class="insight-card">
              <strong>{interactionCounts.views}</strong>
              <span>Aufrufe</span>
            </div>
            <div class="insight-card">
              <strong>{interactionCounts.downloads}</strong>
              <span>Downloads</span>
            </div>
            <div class="insight-card">
              <strong>{interactionCounts.favorites}</strong>
              <span>Gemerkt</span>
            </div>
            <div class="insight-card">
              <strong>{interactionCounts.likes}</strong>
              <span>Likes</span>
            </div>
            <div class="insight-card">
              <strong>{interactionCounts.comments}</strong>
              <span>Kommentare</span>
            </div>
          </div>

          {#if recentInteractions.length > 0}
            <div class="insight-feed">
              <h3>Letzte Interaktionen</h3>
              {#each recentInteractions as entry}
                <div class="insight-feed-item">
                  <strong>{getInteractionActorLabel(entry)}</strong>
                  <span>{getInteractionEventLabel(entry)}</span>
                  <time>{formatCommentDate(entry.created_at)}</time>
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      </section>
    {/if}
    <section class="content-panel comments-panel">
      <h2>Kommentare</h2>
      <div class="comment-form">
        <textarea
          bind:value={commentDraft}
          rows="3"
          maxlength="1000"
          placeholder={currentUser ? 'Kommentar schreiben...' : 'Zum Kommentieren bitte einloggen.'}
          disabled={commentLoading}
        ></textarea>
        <div class="comment-form-footer">
          <span>{commentDraft.trim().length}/1000</span>
          <button type="button" class="comment-submit-btn" on:click={submitComment} disabled={commentLoading}>
            {commentLoading ? 'Speichert...' : 'Kommentieren'}
          </button>
        </div>
      </div>

      {#if commentStatus}
        <p class="comment-status">{commentStatus}</p>
      {/if}

      {#if commentsLoading}
        <p class="comment-empty">Kommentare werden geladen...</p>
      {:else if comments.length > 0}
        <div class="comment-list">
          {#each comments as comment}
            <article class="comment-item">
              <div class="comment-avatar">
                {#if getCommentAvatarUrl(comment)}
                  <img src={getCommentAvatarUrl(comment)} alt={getCommentAuthor(comment)} loading="lazy" />
                {:else}
                  <span>{getCommentAuthor(comment).slice(0, 1)}</span>
                {/if}
              </div>
              <div class="comment-body">
                <div class="comment-meta">
                  <strong>{getCommentAuthor(comment)}</strong>
                  <span>{formatCommentDate(comment.created_at)}</span>
                </div>
                <p>{comment.body}</p>
              </div>
              {#if currentUser?.id === comment.user_id}
                <button type="button" class="comment-delete-btn" on:click={() => deleteComment(comment.id)}>
                  Löschen
                </button>
              {/if}
            </article>
          {/each}
        </div>
      {:else}
        <p class="comment-empty">Noch keine Kommentare vorhanden.</p>
      {/if}
    </section>
    {#if shouldShowNearbyGallery}
      <div class="radius-control">
        <div class="radius-value" class:limit-reached={isAtItemLimit}>
          {formatRadius(radius)}
          {#if filteredNearby.length > 0}
            <span class="nearby-count">• {filteredNearby.length} Items</span>
            {#if isAtItemLimit}
              <span class="limit-indicator">(max. 300)</span>
            {/if}
          {/if}
        </div>
        <input id="radius" type="range" min="50" max="2000" step="50" value={radius} on:input={onRadiusInput} on:change={onRadiusChange} class:limit-reached={isAtItemLimit}>
      </div>
    {/if}
    {#if shouldShowNearbyGallery}
      <section class="nearby" data-nosnippet>
        <NearbyGallery
          nearby={visibleNearby}
          isCreator={!!currentUser}
          showImageCaptions={showImageCaptions}
          userLat={image?.lat}
          userLon={image?.lon}
          getDistanceFromLatLonInMeters={getDistanceFromLatLonInMeters}
          onGalleryToggle={handleNearbyGalleryToggle}
          getGalleryStatus={getNearbyGalleryStatus}
          layout={galleryLayout}
          fallbackRecommendations={nearbyFallbackRecommendations}
        />
      </section>
    {/if}
    
    <!-- SEO-optimiert: Serverseitig gerenderte Links für Google -->
    {#if nearby && nearby.length > 0}
      <div class="seo-nearby-links" style="display: none;">
        <h3>Bilder in der Nähe</h3>
        <ul>
          {#each nearby.slice(0, 300) as item}
            <li>
              <a href={item.canonicalPath || `/item/${item.slug}`} 
                 title="{item.caption || item.description}">
                {item.title} ({Math.round(item.distance)}m)
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
    <div class="meta-section single-exif">
      <!-- Column 1: Keywords -->
      <div class="keywords-column">
        <button type="button" class="keywords-title" class:editable={canEditItem && editMode} class:editing={editingKeywords} on:click={startEditKeywords}>
          Keywords
        </button>
        {#if editingKeywords}
          <div class="keywords-edit-container">
            <textarea
              id="keywords-edit-input"
              bind:value={keywordsEditValue}
              maxlength="800"
              on:keydown={handleKeywordsKeydown}
              on:blur={saveKeywords}
              class="keywords-edit-input"
              rows="8"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="sentences"
              placeholder="Keywords durch Kommas getrennt eingeben..."
            ></textarea>
            <span class="char-count" class:limit-reached={keywordsEditValue.split(',').filter(k => k.trim().length > 0).length >= KEYWORDS_MAX}>{keywordsEditValue.split(',').filter(k => k.trim().length > 0).length}/{KEYWORDS_MAX}</span>
          </div>
        {:else}
          {#if image.keywords && image.keywords.length}
            <div class="keywords">
              {#each image.keywords as kw}
                <a href={buildKeywordHubPath(kw)} class="chip keyword-link">{kw}</a>
              {/each}
            </div>
          {:else}
            <div class="keywords-placeholder">
              {isCreator ? 'Klicke auf "Keywords" um welche hinzuzufügen' : 'Keine Keywords verfügbar'}
            </div>
          {/if}
        {/if}
        <div class="geo-navigation-inline">
          <div class="geo-navigation-head">
            <h2>Geo-Navigation</h2>
            {#if canEditItem && editMode}
              {#if editingGeoFields}
                <div class="geo-edit-actions">
                  {#if image?.lat && image?.lon}
                    <button type="button" class="geo-edit-btn" on:click={autofillGeoFieldsFromCoordinates}>Ortsdaten aus GPS ermitteln</button>
                  {/if}
                  <button type="button" class="geo-edit-btn geo-edit-btn--primary" on:click={saveGeoFields}>Speichern</button>
                  <button type="button" class="geo-edit-btn" on:click={cancelEditGeoFields}>Abbrechen</button>
                </div>
              {:else}
                <button type="button" class="geo-edit-btn" class:geo-edit-btn--warn={geoNeedsAttention} on:click={startEditGeoFields}>
                  {geoNeedsAttention ? 'Ortsdaten prüfen' : 'Ortsdaten bearbeiten'}
                </button>
              {/if}
            {/if}
          </div>

          <nav class="geo-breadcrumbs" aria-label="Geo-Breadcrumb">
            {#each geoDisplayBreadcrumbs as crumb, index}
              {#if crumb.path}
                <a href={crumb.path} aria-current={index === geoDisplayBreadcrumbs.length - 1 ? 'page' : undefined}>{crumb.name}</a>
              {:else}
                <span class="geo-crumb-static">{crumb.name}</span>
              {/if}
              {#if index < geoDisplayBreadcrumbs.length - 1}
                <span>/</span>
              {/if}
            {/each}
          </nav>

          <div class="geo-field-grid">
            {#if editingGeoFields}
              <div class="geo-search-box">
                <span class="geo-label">Ort oder Landmarke suchen</span>
                <input
                  bind:value={geoSearchQuery}
                  class="geo-input"
                  placeholder="z. B. Brandenburger Tor, Wurmannsquick oder Friesing"
                  on:input={handleGeoSearchInput}
                />
                {#if geoSearchLoading}
                  <div class="geo-search-status">Suche läuft...</div>
                {:else if geoSearchError}
                  <div class="geo-search-status geo-search-status--error">{geoSearchError}</div>
                {/if}
                {#if geoSearchResults.length > 0}
                  <div class="geo-search-results">
                    {#each geoSearchResults as result}
                      <button type="button" class="geo-search-result" on:click={() => selectGeoSearchResult(result)}>
                        <strong>{result.displayName}</strong>
                        <span>
                          {[
                            result.countryName,
                            result.stateName,
                            result.districtName,
                            result.municipalityName,
                            result.localityName
                          ].filter(Boolean).join(' / ')}
                        </span>
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
            <div class="geo-field">
              <span class="geo-label">Land</span>
              {#if editingGeoFields}
                <input bind:value={countryNameEditValue} class="geo-input" placeholder="Deutschland" />
              {:else}
                <span class="geo-value">{geoCountryLabel}</span>
              {/if}
            </div>
            {#if showGeoState || editingGeoFields}
              <div class="geo-field">
                <span class="geo-label">Bundesland</span>
                <span class="geo-value">{geoStateLabel || 'Noch nicht zugewiesen'}</span>
              </div>
            {/if}
            {#if showGeoRegion || editingGeoFields}
              <div class="geo-field">
                <span class="geo-label">Bezirk / Region</span>
                <span class="geo-value">{geoRegionLabel || 'Noch nicht zugewiesen'}</span>
              </div>
            {/if}
            <div class="geo-field">
              <span class="geo-label">Landkreis / Region</span>
              {#if editingGeoFields}
                <input bind:value={districtNameEditValue} class="geo-input" placeholder="Landkreis Altötting" />
              {:else}
                <span class="geo-value">{geoDistrictLabel}</span>
              {/if}
            </div>
            <div class="geo-field">
              <span class="geo-label">Gemeinde</span>
              {#if editingGeoFields}
                <input bind:value={municipalityNameEditValue} class="geo-input" placeholder="Reischach" />
              {:else}
                <span class="geo-value">{geoMunicipalityLabel}</span>
              {/if}
            </div>
          </div>
        </div>
        <FileDetails
          {image}
          isCreator={canEditItem}
          canEditQuickFields={canEditItem}
          {editMode}
          {editingFilename}
          bind:filenameEditValue
          {startEditFilename}
          {saveFilename}
          {handleFilenameKeydown}
          {editingSlug}
          bind:slugEditValue
          {startEditSlug}
          {saveSlug}
          {handleSlugKeydown}
          {fileSizes}
          {formatFileSize}
          {browser}
          {rerenderingVariants}
          rerenderVariants={rerenderImageVariants}
          {replacingOriginal}
          replaceOriginalFile={replaceOriginalImage}
        />

        {#if isCreator}
          <div class="adobe-stock-card">
            <h3>Adobe Stock</h3>
            <div class="meta-line">Status: {image?.adobe_stock_status || 'none'}</div>
            {#if image?.adobe_stock_uploaded_at}
              <div class="meta-line">Upload: {new Date(image.adobe_stock_uploaded_at).toLocaleString('de-DE')}</div>
            {/if}
            {#if image?.adobe_stock_error}
              <div class="meta-line adobe-error">{image.adobe_stock_error}</div>
            {/if}

            <input
              type="url"
              class="adobe-input"
              bind:value={adobeStockUrlEdit}
              placeholder="Adobe Stock Link (manuell oder später automatisch)"
            />
            <input
              type="text"
              class="adobe-input"
              bind:value={adobeStockAssetIdEdit}
              placeholder="Adobe Asset ID (optional)"
            />
            <div class="adobe-actions">
              <button class="adobe-btn" on:click={saveAdobeStockData} disabled={adobeSaveLoading}>
                {adobeSaveLoading ? 'Speichert...' : 'Adobe-Link speichern'}
              </button>
              <button class="adobe-btn primary" on:click={uploadToAdobeStock} disabled={adobeUploadLoading}>
                {adobeUploadLoading ? 'Lädt hoch...' : 'Original zu Adobe hochladen'}
              </button>
            </div>
            {#if adobeMessage}
              <div class="meta-line">{adobeMessage}</div>
            {/if}
            {#if image?.adobe_stock_url}
              <a class="adobe-link" href={getAdobeAffiliateUrl(image.adobe_stock_url) || image.adobe_stock_url} target="_blank" rel="noopener noreferrer sponsored">Adobe Link öffnen</a>
            {/if}
          </div>
        {/if}
      </div>
      <!-- Column 2: All EXIF/Meta -->
      <div class="meta-column">
        <button type="button" class="exif-toggle" on:click={() => showFullExif = true}>Aufnahmedaten</button>
        <!-- Immer die Basisdaten anzeigen -->
        {#if true}
          <!-- Essential EXIF data -->
          {#if image.width && image.height}
            <div class="meta-line">Auflösung: {image.width}×{image.height} px</div>
          {/if}
          {#if image.exif_data && image.exif_data.FileSize}
            <div class="meta-line">Dateigröße: {formatFileSize(image.exif_data.FileSize)}</div>
          {/if}
          {#if image.exif_data && image.exif_data.Make}
            <div class="meta-line">Kamera: {image.exif_data.Make} {image.exif_data.Model || ''}</div>
          {/if}
          {#if image.exif_data && image.exif_data.LensModel}
            <div class="meta-line">Objektiv: {image.exif_data.LensModel}</div>
          {/if}
          {#if image.exif_data && image.exif_data.FocalLength}
            <div class="meta-line">Brennweite: {image.exif_data.FocalLength} mm{#if image.exif_data.FocalLengthIn35mmFormat && image.exif_data.FocalLengthIn35mmFormat !== image.exif_data.FocalLength} (35mm: {image.exif_data.FocalLengthIn35mmFormat} mm){/if}</div>
          {/if}
          {#if image.exif_data && image.exif_data.ISO}
            <div class="meta-line">ISO: {image.exif_data.ISO}</div>
          {/if}
          {#if image.exif_data && image.exif_data.FNumber}
            <div class="meta-line">Blende: ƒ/{image.exif_data.FNumber}</div>
          {/if}
          {#if image.exif_data && image.exif_data.ExposureTime}
            <div class="meta-line">Verschlusszeit: {formatExposureTime(image.exif_data.ExposureTime)}</div>
          {/if}
          {#if image.exif_data && image.exif_data.CreateDate}
            <div class="meta-line">Aufgenommen: {new Date(image.exif_data.CreateDate).toLocaleDateString('de-DE')}</div>
          {/if}
          {#if image.lat && image.lon}
            <div class="meta-line">GPS: {image.lat.toFixed(5)}, {image.lon.toFixed(5)}</div>
          {/if}
          {#if image.exif_data && image.exif_data.Artist}
            <div class="meta-line">Fotograf: {image.exif_data.Artist}</div>
          {/if}
          {#if image.exif_data && image.exif_data.Copyright}
            <div class="meta-line">Copyright: {image.exif_data.Copyright}</div>
          {/if}
          {#if image.created_at}
            <div class="meta-line">Veröffentlicht am: {new Date(image.created_at).toLocaleDateString('de-DE')}</div>
          {/if}
          <!-- Wenn showFullExif aktiviert wurde, zeige zusätzliche Felder -->
          {#if showFullExif && image.exif_data}
            {#if image.exif_data.Orientation}
              <div class="meta-line">Ausrichtung: {image.exif_data.Orientation}</div>
            {/if}
            {#if image.exif_data.Flash}
              <div class="meta-line">Blitz: {image.exif_data.Flash}</div>
            {/if}
            {#if image.exif_data.Software}
              <div class="meta-line">Software: {image.exif_data.Software}</div>
            {/if}
            {#if image.exif_data.TimeCreated}
              <div class="meta-line">Aufnahmezeit: {formatTimeCreated(image.exif_data.TimeCreated)}</div>
            {/if}
          {/if}
        {/if}
      </div>
      <!-- Column 3: Creator Card (if available) -->
      <div class="column-card">
        <h2>Ersteller</h2>
        {#if image.profile}
          <div class="creator-header">
            {#if image.profile.avatar_url}
              <button type="button" class="avatar-button clickable-avatar" on:click={setUserFilter} title={`Nur Bilder von ${image.profile.full_name} anzeigen`}>
                <img
                  src={image.profile.avatar_url.startsWith('http') ? image.profile.avatar_url : `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/avatars/${image.profile.avatar_url}`}
                  alt="Avatar"
                  class="avatar"
                />
              </button>
            {:else}
              <button type="button" class="avatar-placeholder clickable-avatar" on:click={setUserFilter} title={`Nur Bilder von ${image.profile.full_name} anzeigen`}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
              </button>
            {/if}
          </div>
          <div class="creator-details">
            <button type="button" class="creator-name clickable-name" on:click={setUserFilter} title={`Nur Bilder von ${image.profile.full_name} anzeigen`}>
              {image.profile.full_name}
            </button>
            <div class="creator-address">
              {#if image.profile.show_address && image.profile.address}
                <div>{@html image.profile.address.replace(/\n/g, '<br>')}</div>
              {/if}
            </div>
            <div class="creator-contact">
              {#if image.profile.show_phone && image.profile.phone}
                <div>
                  <svg class="contact-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                  </svg>
                  <a href={`tel:${image.profile.phone}`}>{image.profile.phone}</a>
                </div>
              {/if}
              {#if image.profile.show_email && image.profile.email}
                <div>
                  <svg class="contact-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                  </svg>
                  <a href={`mailto:${image.profile.email}`}>{image.profile.email}</a>
                </div>
              {/if}
              {#if image.profile.show_website && image.profile.website}
                <div>
                  <svg class="contact-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                  </svg>
                  <a href={image.profile.website} target="_blank" rel="noopener noreferrer">{image.profile.website}</a>
                </div>
              {/if}
            </div>
            <div class="creator-socials">
              {#if image.profile.show_social && image.profile.instagram}
                <a href={image.profile.instagram} target="_blank" rel="noopener noreferrer" class="social-link">
                  <svg class="social-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </a>
              {/if}
              {#if image.profile.show_social && image.profile.facebook}
                <a href={image.profile.facebook} target="_blank" rel="noopener noreferrer" class="social-link">
                  <svg class="social-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>
              {/if}
              {#if image.profile.show_social && image.profile.twitter}
                <a href={image.profile.twitter} target="_blank" rel="noopener noreferrer" class="social-link">
                  <svg class="social-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                </a>
              {/if}
            </div>
            {#if image.profile.show_bio && image.profile.bio}
              <div class="creator-bio">
                <div>{@html image.profile.bio.replace(/\n/g, '<br>')}</div>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
            <ImageMapSection {image} nearby={filteredNearby} isCreator={isCreator} hasEditRights={$unifiedRightsStore.rights?.edit} on:openMapPicker={() => { showMapPicker = true; }} />
    <MapPickerOverlay
      visible={showMapPicker}
      lat={image?.lat}
      lon={image?.lon}
      image={image}
      onCancel={() => { showMapPicker = false; }}
      onSave={async (lat, lon) => {
        showMapPicker = false;
        if (image && image.id && (isCreator || $unifiedRightsStore.rights?.edit)) {
          try {
            const res = await authFetch(`/api/item/${image.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lat, lon })
            });
            if (res.ok) {
              image.lat = lat;
              image.lon = lon;
            } else {
              console.error('Failed to save coordinates');
            }
          } catch (err) {
            console.error('Error saving coordinates:', err);
          }
        }
      }}
    />
    {#if similarMotifItems.length}
      <section class="similar-motifs-panel" data-nosnippet>
        <div class="similar-motifs-head">
          <div>
            <h2>Ähnliche Motive aus Vektoranalyse</h2>
            <p>
              {similarMotifItems.length.toLocaleString('de-DE')} thematisch passende Fotos, semantisch
              gruppiert statt zufällig über Keywords.
            </p>
          </div>
        </div>

        <div class="similar-motifs-grid">
          {#each visibleSimilarMotifItems as item (item.id)}
            <article class="similar-item-card">
              <a href={item.canonicalPath} class="similar-item-link">
                {#if item.path_512}
                  <div class="similar-item-thumb" style={`--thumb-preview:url('${relatedThumbUrl(item)}')`}>
                    <img
                      src={relatedThumbUrl(item)}
                      alt={item.title || 'Aehnliches Motiv'}
                      width="320"
                      height="213"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                {/if}
                <div class="similar-item-body">
                  <h3>{item.title}</h3>
                  <p>{trimText(item.description || item.caption || 'Aehnliches Motiv auf Culoca.', 100)}</p>
                </div>
              </a>
            </article>
          {/each}
        </div>

        {#if similarMotifTotalPages > 1}
          <nav class="pagination similar-pagination" aria-label="Pagination ähnliche Motive">
            <button
              type="button"
              class="pg-link"
              on:click={() => (similarMotifPage = Math.max(1, similarMotifPage - 1))}
              disabled={similarMotifPage === 1}
            >
              Zurück
            </button>

            {#each Array.from({ length: similarMotifTotalPages }, (_, i) => i + 1) as p}
              {#if p === 1 || p === similarMotifTotalPages || (p >= similarMotifPage - 2 && p <= similarMotifPage + 2)}
                <button
                  type="button"
                  class="pg-link"
                  class:pg-active={p === similarMotifPage}
                  aria-current={p === similarMotifPage ? 'page' : undefined}
                  on:click={() => (similarMotifPage = p)}
                >
                  {p}
                </button>
              {:else if p === similarMotifPage - 3 || p === similarMotifPage + 3}
                <span class="pg-dots" aria-hidden="true">...</span>
              {/if}
            {/each}

            <button
              type="button"
              class="pg-link"
              on:click={() => (similarMotifPage = Math.min(similarMotifTotalPages, similarMotifPage + 1))}
              disabled={similarMotifPage === similarMotifTotalPages}
            >
              Weiter
            </button>
          </nav>
        {/if}
      </section>
    {/if}

    <!-- Item Rights Manager Overlay -->
    {#if showRightsManager && image}
      <div class="rights-overlay">
        <div class="rights-modal">
          <div class="rights-header">
            <h2>Rechte verwalten</h2>
            <button 
              class="close-btn" 
              on:click={() => { showRightsManager = false; }}
              aria-label="Schließen"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="rights-content">
            <ItemRightsManager 
              itemId={image.id} 
              itemTitle={image.title || image.original_name || 'Unbekanntes Item'} 
            />
          </div>
        </div>
      </div>
    {/if}
  {:else}
    <div class="error">❌ Bild nicht gefunden</div>
  {/if}

  {#if canEditItem}
    <button
      class="fab-button edit-toggle"
      class:active={editMode}
      on:click={toggleEditMode}
      title={editMode ? 'Aenderungen speichern' : 'Editmodus aktivieren'}
      aria-label={editMode ? 'Aenderungen speichern' : 'Editmodus aktivieren'}
    >
      {#if editMode}
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 3h11l3 3v15H5z"/>
          <path d="M9 3v6h6"/>
          <path d="M9 14h6"/>
        </svg>
      {:else}
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
        </svg>
      {/if}
    </button>
  {/if}
  
  <!-- Zur Galerie zurückkehren FAB -->
  <button 
    class="gallery-back-fab"
    on:click={() => goto('/')}
    title="Zur Galerie zurückkehren"
    aria-label="Zur Galerie zurückkehren"
  >
    <!-- Gallery Grid Icon for back to gallery -->
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="6" height="6"/>
      <rect x="15" y="3" width="6" height="6"/>
      <rect x="3" y="15" width="6" height="6"/>
      <rect x="15" y="15" width="6" height="6"/>
    </svg>
  </button>

  <!-- Rechte verwalten FAB - nur für Ersteller sichtbar -->
  {#if isCreator}
    <button 
      class="fab-button rights-manager"
      on:click={() => showRightsManager = true}
      title="Rechte verwalten"
      aria-label="Rechte verwalten"
    >
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
        <path d="M12 11v4"/>
        <path d="M12 19h.01"/>
      </svg>
    </button>
  {/if}


  <!-- Scroll to Top / Fullscreen FAB - ersetzt sich gegenseitig -->
  {#if showScrollToTop}
    <button
      class="fab-button scroll-to-top"
      on:click={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      title="Nach oben scrollen"
      aria-label="Nach oben scrollen"
    >
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 15l-6-6-6 6"/>
      </svg>
    </button>
  {:else}
    <button
      class="fab-button fullscreen"
      on:click={() => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen();
        } else {
          document.exitFullscreen();
        }
      }}
      title="Vollbildmodus"
      aria-label="Vollbildmodus"
    >
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
      </svg>
    </button>
    {/if}
  {/key}
  <SiteFooter />
</div>

<style>
  .title-text:hover,
  .description-text:hover {
    color: var(--culoca-orange, #ee7221);
    cursor: pointer;
    transition: color 0.2s;
  }
  .passepartout-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    width: 100%;
    padding: 12px 12px 12px 12px;
    margin: 0 auto;
    background: var(--passepartout-bg);
    overflow: hidden;
  }
  .passepartout-info {
    margin-top: 1.5rem;
    text-align: center;
    width: 100%;
    padding: 0.7rem 0.5rem 0.5rem 0.5rem;
    background: transparent;
  }
  .main-image {
    display: block;
    width: auto;
    max-height: 800px;
    max-width: 100%;
    object-fit: contain;
    border: 1px solid #ffffff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    background: transparent;
  }
  .variant-strip {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    margin-top: 0.9rem;
  }
  .variant-strip-item {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    min-height: 32px;
    max-width: 96px;
    padding: 0.2rem;
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
    text-decoration: none;
  }
  .variant-strip-item.active {
    border-color: var(--culoca-orange, #ee7221);
    box-shadow: 0 0 0 1px var(--culoca-orange, #ee7221);
  }
  .variant-strip-item img {
    display: block;
    height: 32px;
    width: auto;
    max-width: 100%;
    object-fit: contain;
  }
  .variant-strip-item img.square {
    width: 32px;
    object-fit: cover;
  }
  .title {
    font-size: 1.8rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 1rem 0;
    line-height: 1.3;
    background: transparent;
  }

  .description {
    font-size: 1rem;
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0 0 0.5rem 0;
    background: transparent;
  }

  .title.editable {
    cursor: pointer;
    transition: color 0.2s;
    background: transparent;
  }
  .title.editable:hover {
    color: #ee731f;
    background: transparent;
  }
  .title-text {
    cursor: pointer;
    transition: color 0.2s;
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    margin: -0.25rem -0.5rem;
    border: none;
    background: transparent;
    font: inherit;
    color: inherit;
  }
  .title.editable:hover .title-text {
    color: var(--culoca-orange);
  }
  .title.editing .title-text {
    display: none;
  }
  .title-edit-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    justify-content: center;
    background: transparent;
  }
  .title-edit-input {
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 1.5rem;
    font-weight: bold;
    padding: 0.5rem;
    text-align: center;
    width: 100%;
    transition: border-color 0.2s, background-color 0.3s ease, color 0.3s ease;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    font-size: 16px;
  }
  .title-edit-input:focus {
    outline: none;
    border-color: var(--accent-color);
    background: var(--bg-tertiary);
  }
  .title-edit-input.valid {
    border-color: var(--success-color);
    background: var(--bg-secondary);
  }
  .char-count {
    font-size: 0.8rem;
    color: var(--text-muted);
    min-width: 60px;
    text-align: right;
    background: transparent;
    transition: color 0.3s ease;
  }
  .char-count.valid {
    color: var(--success-color);
    background: transparent;
  }
  .description.editable {
    cursor: pointer;
    transition: color 0.2s;
    background: transparent;
  }
  .description.editable:hover {
    color: #ee731f;
    background: transparent;
  }
  .description-text {
    cursor: pointer;
    transition: color 0.2s;
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    margin: -0.25rem -0.5rem;
    border: none;
    background: transparent;
    font: inherit;
    color: inherit;
    text-align: inherit;
  }
  .description.editable:hover .description-text {
    color: var(--culoca-orange);
  }
  .description.editing .description-text {
    display: none;
  }
  .description-edit-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 1rem 0 2rem 0;
    background: transparent;
  }
  .description-edit-input {
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 1rem;
    padding: 0.5rem;
    width: 100%;
    min-height: 100px;
    resize: vertical;
    transition: border-color 0.2s, background-color 0.3s ease, color 0.3s ease;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    font-size: 16px;
  }
  .description-edit-input:focus {
    outline: none;
    border-color: var(--accent-color);
    background: var(--bg-tertiary);
  }
  .description-edit-input.valid {
    border-color: var(--success-color);
    background: var(--bg-secondary);
  }
  .radius-control {
    margin: 1.2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: transparent;
  }
  .radius-value {
    color: var(--text-secondary);
    font-weight: 500;
    font-size: 1rem;
    margin-bottom: 0.1rem;
    text-align: center;
    background: transparent;
  }
  .radius-value.limit-reached {
    color: var(--culoca-orange);
  }
  .limit-indicator {
    font-size: 0.75rem;
    font-weight: 400;
    color: var(--culoca-orange);
    margin-left: 0.3rem;
    opacity: 0.8;
  }
  .nearby-count {
    font-size: 0.85rem;
    font-weight: 400;
    color: var(--text-muted);
    margin-left: 0.3rem;
  }
  /* Range-Slider mit gefüllter Spur */
  .radius-control input[type="range"] {
    width: 100%;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    margin: 20px 0 10px 0;
    background: transparent;
    --thumb: 32px;      /* Thumb-Größe */
    --track: 8px;       /* Track-Höhe */
    --pct: 0%;          /* wird per JS gesetzt */
    --tw-ring-color: #0066cc; /* Standard Blauton */
  }

  /* Orange bei max. 300 Items */
  .radius-control input[type="range"].limit-reached {
    --tw-ring-color: var(--culoca-orange);
  }

  /* ===== WebKit (Chrome/Safari/Edge) ===== */
  .radius-control input[type="range"]::-webkit-slider-runnable-track {
    height: var(--track);
    border-radius: 999px;
    background:
      linear-gradient(to right,
        var(--tw-ring-color) 0%,
        var(--tw-ring-color) var(--pct),
        #e5e7eb var(--pct),
        #e5e7eb 100%);
  }
  .radius-control input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: var(--thumb);
    height: var(--thumb);
    border-radius: 50%;
    background: var(--tw-ring-color);
    border: 0px solid var(--bg-primary);
    cursor: pointer;
    /* Track mittig unter dem Thumb ausrichten */
    margin-top: calc((var(--track) - var(--thumb)) / 2);
    transition: transform .1s ease;
  }

  /* ===== Firefox ===== */
  .radius-control input[type="range"]::-moz-range-track {
    height: var(--track);
    background: #e5e7eb;
    border-radius: 999px;
  }
  .radius-control input[type="range"]::-moz-range-progress {
    height: var(--track);
    background: var(--tw-ring-color);
    border-radius: 999px;
  }
  .radius-control input[type="range"]::-moz-range-thumb {
    width: var(--thumb);
    height: var(--thumb);
    border-radius: 50%;
    background: var(--tw-ring-color);
    border: 2px solid var(--bg-primary);
    cursor: pointer;
    transition: transform .1s ease;
  }

  /* (optional) kleine Interaktions-Details */
  .radius-control input[type="range"]:hover::-webkit-slider-thumb,
  .radius-control input[type="range"]:hover::-moz-range-thumb { 
    transform: scale(.98); 
  }
  .meta-section.single-exif {
    display: grid;
    grid-template-columns: 2.5fr 1fr 1fr;
    gap: 2rem;
    margin: 2rem 0 1.5rem 0;
    background: transparent;
    border-radius: 0;
    padding: 1rem;
    align-items: flex-start;
    overflow: hidden;
  }
  .geo-navigation-inline {
    display: grid;
    gap: 0.9rem;
    margin-top: 0.25rem;
    margin-bottom: 1.15rem;
  }
  .geo-navigation-head {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: center;
  }
  .geo-breadcrumbs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    font-size: 0.95rem;
    color: var(--text-secondary);
  }
  .geo-breadcrumbs a {
    color: inherit;
    text-decoration: none;
    font-weight: 600;
  }
  .geo-crumb-static {
    color: inherit;
    font-weight: 600;
  }
  .geo-breadcrumbs a:hover {
    color: var(--culoca-orange);
  }
  .geo-field-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.85rem;
  }
  .geo-search-box {
    grid-column: 1 / -1;
    display: grid;
    gap: 0.45rem;
  }
  .geo-field {
    display: grid;
    gap: 0.3rem;
  }
  .geo-label {
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-secondary);
  }
  .geo-value {
    font-size: 1rem;
    color: var(--text-primary);
    word-break: break-word;
  }
  .geo-input {
    width: 100%;
    padding: 0.45rem 0.65rem;
    border-radius: 6px;
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-primary);
    font: inherit;
  }
  .geo-search-status {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }
  .geo-search-status--error {
    color: #991b1b;
  }
  .geo-search-results {
    display: grid;
    gap: 0.45rem;
  }
  .geo-search-result {
    display: grid;
    gap: 0.2rem;
    text-align: left;
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-primary);
    border-radius: 10px;
    padding: 0.7rem 0.8rem;
    cursor: pointer;
    font: inherit;
  }
  .geo-edit-actions {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
  }
  .geo-edit-btn {
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-primary);
    border-radius: 999px;
    padding: 0.55rem 0.95rem;
    font: inherit;
    cursor: pointer;
  }
  .geo-edit-btn--primary {
    background: var(--culoca-orange);
    color: #fff;
    border-color: var(--culoca-orange);
  }
  .geo-edit-btn--warn {
    background: color-mix(in srgb, #b91c1c 14%, var(--bg-primary));
    color: #991b1b;
    border-color: color-mix(in srgb, #b91c1c 55%, transparent);
  }
  .meta-column, .column-card, .keywords-column {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    background: transparent;
  }
  .meta-column h2, .column-card h2, .keywords-column h2 {
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 1rem 0;
    padding: 0;
  }
  .exif-toggle {
    cursor: pointer;
    transition: color 0.2s ease;
    border: none;
    background: transparent;
    font: inherit;
    text-align: left;
    padding: 0;
  }
  .exif-toggle:hover {
    color: var(--culoca-orange);
  }
  .filename {
    color: var(--text-secondary);
    font-size: 0.9rem;
    font-family: 'Courier New', monospace;
    word-break: break-all;
  }
  .meta-line {
    color: var(--text-secondary);
    font-size: 0.85em;
    padding: 0.05em 0;
    word-break: break-word;
    background: transparent;
  }
  .column-card {
    background: transparent;
    box-shadow: none;
    padding: 0;
    border-radius: 0;
  }
  .avatar {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    object-fit: cover;
    margin-bottom: 0.5rem;
    background: transparent;
  }
  .creator-header {
    display: flex;
    justify-content: flex-start;
    margin-bottom: 1rem;
  }
  .avatar-button {
    border: none;
    background: transparent;
    padding: 0;
    display: inline-flex;
  }
  .clickable-avatar, .avatar-placeholder {
    cursor: pointer;
    transition: all 0.2s ease;
    border: 2px solid transparent;
  }
  .clickable-avatar:hover, .avatar-placeholder:hover {
    border-color: var(--culoca-orange);
    transform: scale(1.05);
  }
  .avatar-placeholder {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--bg-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
  }
  .creator-name {
    cursor: pointer;
    transition: color 0.2s ease;
    border: none;
    background: transparent;
    padding: 0;
    font: inherit;
    color: inherit;
    text-align: left;
  }
  .creator-name:hover {
    color: var(--culoca-orange);
  }
  .creator-details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: transparent;
  }
  .creator-address {
    margin-bottom: 0.5rem;
    color: var(--text-secondary);
    font-size: 0.95em;
    line-height: 1.3;
    background: transparent;
  }
  .creator-contact {
    margin-bottom: 0.5rem;
    color: var(--text-secondary);
    font-size: 0.95em;
    line-height: 1.3;
    background: transparent;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  .creator-contact > div {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .contact-icon {
    width: 16px;
    height: 16px;
    color: var(--text-secondary);
    flex-shrink: 0;
  }
  .creator-contact a {
    color: var(--text-secondary);
    text-decoration: none;
  }
  .creator-contact a:hover {
    color: var(--culoca-orange);
    text-decoration: underline;
  }
  .creator-bio {
    margin-top: 0.5rem;
    color: var(--text-secondary);
    font-size: 0.9em;
    line-height: 1.4;
    background: transparent;
  }
  .creator-socials {
    margin-top: 0.5rem;
    display: flex;
    gap: 0.5rem;
    align-items: center;
    background: transparent;
  }
  .social-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    color: var(--text-secondary);
    text-decoration: none;
    border-radius: 4px;
    transition: all 0.2s ease;
    background: transparent;
  }
  .social-icon {
    width: 20px;
    height: 20px;
    color: var(--text-secondary);
  }
  .social-link:hover {
    background: var(--bg-tertiary);
    transform: scale(1.1);
  }
  .social-link:hover .social-icon {
    color: var(--culoca-orange);
  }
  .keywords {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0 0 2rem;
    background: transparent;
  }
  .chip {
    background: var(--bg-tertiary);
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
    font-size: 0.8rem;
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
    transition: color 0.2s, box-shadow 0.2s, transform 0.2s;
  }
  .keyword-link {
    text-decoration: none;
    color: inherit;
    transition: all 0.2s ease;
    display: inline-block;
  }
  .keyword-link:hover {
    color: var(--culoca-orange);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px var(--shadow);
  }
  .keywords-title {
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 1rem 0;
    padding: 0;
    border: none;
    background: transparent;
    text-align: left;
  }
  .keywords-title.editable {
    cursor: pointer;
    transition: color 0.2s;
    background: transparent;
  }
  .caption {
    font-style: italic;
    color: var(--text-secondary);
    font-size: 1rem;
    line-height: 1.4;
    margin: 0.5rem 0;
    background: transparent;
  }
  .caption.editable {
    cursor: pointer;
    transition: color 0.2s;
  }
  .caption.editable:hover {
    color: var(--culoca-orange);
  }
  .caption-text {
    display: block;
    width: 100%;
    background: transparent;
    border: none;
    padding: 0;
    font: inherit;
    color: inherit;
    text-align: center;
  }
  .caption-edit-container {
    position: relative;
    width: 100%;
  }
  .caption-edit-input {
    width: 100%;
    padding: 0.5rem;
    border: 2px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: inherit;
    font-size: 1rem;
    line-height: 1.4;
    resize: vertical;
    min-height: 60px;
    transition: border-color 0.2s;
  }
  .caption-edit-input:focus {
    outline: none;
    border-color: var(--culoca-orange);
  }
  .caption-edit-input.valid {
    border-color: var(--success-color);
  }
  .keywords-title.editable:hover {
    color: var(--culoca-orange);
    background: transparent;
  }
  .keywords-title.editing {
    color: var(--accent-color);
  }
  .keywords-edit-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 1rem 0;
    background: transparent;
  }
  .keywords-edit-input {
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-primary);
    font-size: 1rem;
    padding: 0.5rem;
    width: 100%;
    min-height: 200px;
    resize: vertical;
    transition: border-color 0.2s, background-color 0.3s ease, color 0.3s ease;
    font-family: inherit;
    line-height: 1.4;
  }
  .keywords-edit-input:focus {
    outline: none;
    border-color: var(--accent-color);
    background: var(--bg-tertiary);
  }
  .char-count {
    font-size: 0.8rem;
    color: var(--text-secondary);
    text-align: right;
    font-weight: 500;
  }
  .char-count.valid {
    color: var(--success-color);
  }
  .char-count {
    font-size: 0.8rem;
    color: var(--text-muted);
    min-width: 40px;
    text-align: right;
    background: transparent;
    transition: color 0.3s ease;
  }
  @media (max-width: 900px) {
    .meta-section.single-exif {
      grid-template-columns: 1fr;
      padding: 1rem 0.5rem;
      gap: 1.5rem;
    }
    .geo-navigation-inline {
      justify-items: center;
      text-align: center;
    }
    .geo-breadcrumbs {
      justify-content: center;
    }
    .geo-field-grid {
      grid-template-columns: 1fr;
      width: 100%;
    }
    .geo-field {
      justify-items: center;
      text-align: center;
    }
    .keywords-column, .meta-column, .column-card {
      text-align: center;
    }
    .keywords {
      justify-content: center;
    }
    .avatar {
      margin: 0 auto 0.5rem auto;
    }
    .creator-contact {
      justify-content: center;
      align-items: center;
    }
    .creator-contact > div {
      justify-content: center;
    }
    .creator-socials {
      justify-content: center;
    }
  }
  @media (max-width: 1200px) {
    .meta-section.single-exif {
      grid-template-columns: 1fr;
      gap: 2rem;
    }
    .geo-navigation-head {
      align-items: flex-start;
      flex-direction: column;
    }
    .keywords-column, .meta-column, .column-card {
      text-align: center;
    }
    .keywords {
      justify-content: center;
    }
    .avatar {
      margin: 0 auto 0.5rem auto;
    }
    .creator-contact {
      justify-content: center;
      align-items: center;
    }
    .creator-contact > div {
      justify-content: center;
    }
    .creator-socials {
      justify-content: center;
    }
  }

  /* Zur Galerie zurückkehren FAB */
  .gallery-back-fab {
    position: fixed;
    bottom: 7rem; /* Über dem Vollbild-FAB */
    right: 2rem;
    width: 4rem;
    height: 4rem;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px var(--shadow);
    backdrop-filter: blur(10px);
    background: transparent;
    overflow: hidden;
    pointer-events: auto;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
    z-index: 1001;
  }
  
  .gallery-back-fab:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 20px var(--shadow);
    background: rgba(255, 255, 255, 0.1);
  }
  
  .gallery-back-fab:active {
    transform: scale(0.95);
  }
  
  /* Mobile responsive */
  @media (max-width: 768px) {
    .gallery-back-fab {
      bottom: 6rem;
      right: 1rem;
      width: 3.5rem;
      height: 3.5rem;
    }
    
    .gallery-back-fab svg {
      width: 36px;
      height: 36px;
    }
  }

  /* FAB Styles für Detailseite */
  .fab-button {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    width: 4rem;
    height: 4rem;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px var(--shadow);
    backdrop-filter: blur(10px);
    background: transparent;
    overflow: hidden;
    pointer-events: auto;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
    z-index: 1001;
  }
  
  .fab-button:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 20px var(--shadow);
    background: rgba(255, 255, 255, 0.1);
  }
  
  .fab-button:active {
    transform: scale(0.95);
  }
  
  .fab-button.scroll-to-top,
  .fab-button.fullscreen {
    bottom: 2rem; /* Gleiche Position für beide FABs */
  }
  
  /* Mobile responsive für FABs */
  @media (max-width: 768px) {
    .fab-button {
      bottom: 1rem;
      right: 1rem;
      width: 3.5rem;
      height: 3.5rem;
    }
    
    .fab-button.scroll-to-top,
    .fab-button.fullscreen {
      bottom: 1rem; /* Gleiche Position für beide FABs */
    }
    
    .fab-button svg {
      width: 36px;
      height: 36px;
    }
  }
  .radius-control input[type="range"].limit-reached {
    accent-color: var(--culoca-orange);
  }

  /* Rights Manager Overlay Styles */
  .rights-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(5px);
  }

  .rights-modal {
    background: var(--bg-primary);
    border-radius: 12px;
    max-width: 90vw;
    max-height: 90vh;
    width: 800px;
    overflow: hidden;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  }

  .rights-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .rights-header h2 {
    margin: 0;
    color: var(--text-primary);
    font-size: 1.5rem;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .rights-content {
    padding: 0;
    max-height: calc(90vh - 80px);
    overflow-y: auto;
  }

  /* FAB Position für Rights Manager */
  .fab-button.rights-manager {
    bottom: 12rem; /* Über dem Gallery Back FAB */
  }

  .fab-button.edit-toggle {
    bottom: 17rem;
  }

  .fab-button.edit-toggle.active {
    background: rgba(46, 125, 50, 0.28);
  }

  @media (max-width: 768px) {
    .rights-modal {
      width: 95vw;
      max-height: 95vh;
    }

    .rights-content {
      max-height: calc(95vh - 80px);
    }

    .fab-button.rights-manager {
      bottom: 10rem;
    }

    .fab-button.edit-toggle {
      bottom: 14rem;
    }
  }

  .adobe-stock-card {
    margin-top: 1rem;
    padding: 0.9rem;
    border: 1px solid var(--border-color);
    border-radius: 10px;
    background: var(--bg-secondary);
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .adobe-stock-card h3 {
    margin: 0 0 0.25rem 0;
    font-size: 1rem;
  }

  .adobe-input {
    width: 100%;
    padding: 0.55rem 0.65rem;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .adobe-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .adobe-btn {
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-primary);
    border-radius: 8px;
    padding: 0.5rem 0.75rem;
    cursor: pointer;
  }

  .adobe-btn.primary {
    background: #ee7221;
    color: #fff;
    border-color: #ee7221;
  }

  .adobe-link {
    font-size: 0.9rem;
    color: var(--accent-color);
    text-decoration: underline;
  }

  .adobe-stock-cta {
    margin: 0.75rem 0 0;
    padding: 0;
  }
  .adobe-stock-cta a {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--culoca-orange, #ee7221);
    text-decoration: none;
  }
  .adobe-stock-cta a:hover {
    text-decoration: underline;
  }

  .adobe-error {
    color: #d64545;
  }

  .title-type-select {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    margin-bottom: 0.9rem;
  }

  .title-type-select label {
    font-size: 0.78rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-secondary);
  }

  .title-type-select select {
    min-width: 180px;
    padding: 0.55rem 0.75rem;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font: inherit;
  }

  .title-event-details-card {
    --calendar-indicator-filter: none;
    --datetime-color-scheme: light;
    width: min(100%, 520px);
    margin: 0 auto 1rem;
    padding: 0.95rem;
    border: 1px solid var(--border-color);
    border-radius: 14px;
    background: var(--bg-secondary);
  }

  :global(body[data-theme='dark']) .title-event-details-card {
    --calendar-indicator-filter: invert(1) brightness(1.35) contrast(1.1);
    --datetime-color-scheme: dark;
  }

  .title-event-details-header {
    margin-bottom: 0.75rem;
    font-size: 0.78rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-secondary);
    text-align: center;
  }

  .title-event-details-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }

  .title-event-field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .title-event-field span {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .title-event-field input,
  .title-event-field select {
    width: 100%;
    padding: 0.55rem 0.75rem;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-primary);
    font: inherit;
  }

  .datetime-input-wrap {
    position: relative;
  }

  .datetime-input-wrap input[type='datetime-local'] {
    padding-right: 2.7rem;
  }

  .title-event-field input[type='datetime-local'] {
    color-scheme: var(--datetime-color-scheme) !important;
  }

  .title-event-field input[type='datetime-local']::-webkit-calendar-picker-indicator {
    position: absolute;
    right: 0.55rem;
    width: 1.7rem;
    height: 1.7rem;
    cursor: pointer;
    opacity: 0;
    filter: var(--calendar-indicator-filter);
  }

  :global(body[data-theme='dark']) .title-event-field input[type='datetime-local']::-webkit-calendar-picker-indicator {
    opacity: 1;
  }

  .datetime-input-icon {
    position: absolute;
    right: 0.8rem;
    top: 50%;
    transform: translateY(-50%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    pointer-events: none;
  }

  :global(body[data-theme='dark']) .datetime-input-icon {
    color: #f8fafc;
  }

  .title-event-checkbox input {
    width: 1rem;
    height: 1rem;
    padding: 0;
    margin-top: 0.25rem;
  }

  .title-event-field-full {
    grid-column: 1 / -1;
  }

  @media (max-width: 768px) {
    .title-event-details-grid {
      grid-template-columns: 1fr;
    }
  }

  .title-group-slug-field {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    align-items: center;
    margin: 0 auto 1rem;
    max-width: 440px;
  }

  .title-group-slug-header {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .title-group-slug-header label {
    font-size: 0.78rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-secondary);
  }

  .info-icon-btn,
  .clear-group-slug-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0;
  }

  .info-icon-btn:hover,
  .clear-group-slug-btn:hover {
    color: var(--text-primary);
    border-color: var(--accent-color);
  }

  .title-group-slug-input-row {
    display: flex;
    gap: 0.5rem;
    width: 100%;
    align-items: center;
  }

  .title-group-slug-input-row input {
    flex: 1;
    min-width: 0;
    padding: 0.55rem 0.75rem;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font: inherit;
  }

  .group-slug-info-box {
    width: 100%;
    padding: 0.75rem 0.9rem;
    border-radius: 10px;
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font-size: 0.9rem;
    line-height: 1.45;
    text-align: left;
  }

  .group-slug-hint {
    font-size: 0.85rem;
    color: var(--text-secondary);
    text-align: center;
  }

  .group-slug-suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    justify-content: center;
  }

  .group-slug-suggestion {
    border: 1px solid var(--border-color);
    border-radius: 999px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    padding: 0.35rem 0.7rem;
    font: inherit;
    cursor: pointer;
  }

  .group-slug-suggestion:hover {
    border-color: var(--accent-color);
    color: var(--accent-color);
  }

  .group-context-line {
    margin: 0 0 0.75rem 0;
    font-size: 0.95rem;
    color: var(--text-secondary);
  }

  .group-context-line a {
    color: var(--accent-color);
  }

  .content-panel {
    max-width: 1400px;
    margin: 1rem auto;
    padding: 1rem 1.1rem;
    border: 1px solid var(--border-color);
    border-radius: 14px;
    background: var(--bg-secondary);
  }

  .content-panel h2 {
    margin: 0 0 0.75rem 0;
  }

  .favorite-status {
    max-width: 1400px;
    margin: 0.65rem auto 0;
    color: var(--text-secondary);
    font-size: 0.95rem;
    text-align: center;
  }

  .event-detail-list {
    display: grid;
    gap: 0.95rem;
    text-align: center;
    margin-top: 1.1rem;
  }

  .event-detail-list h2 {
    margin: 0;
    font-size: 1.28rem;
    line-height: 1.35;
    color: var(--text-primary);
  }

  .event-inline-link {
    color: var(--culoca-orange);
    text-decoration: underline;
    text-underline-offset: 0.15em;
    font-size: 0.98rem;
    word-break: break-word;
  }

  .content-html {
    padding-top: 1.2rem;
  }

  .rich-content {
    color: var(--text-primary);
    font-size: 1rem;
    line-height: 1.75;
  }

  .comments-panel {
    display: grid;
    gap: 1rem;
  }

  .insights-panel {
    display: grid;
    gap: 1rem;
  }

  .insight-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 0.75rem;
  }

  .insight-card {
    display: grid;
    gap: 0.3rem;
    padding: 0.9rem;
    border-radius: 12px;
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    text-align: center;
  }

  .insight-card strong {
    font-size: 1.45rem;
    line-height: 1;
  }

  .insight-card span {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .insight-feed {
    display: grid;
    gap: 0.65rem;
  }

  .insight-feed h3 {
    margin: 0;
    font-size: 1rem;
  }

  .insight-feed-item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 0.75rem;
    align-items: center;
    padding: 0.8rem 0.9rem;
    border-radius: 12px;
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
  }

  .insight-feed-item span,
  .insight-feed-item time {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .comment-form {
    display: grid;
    gap: 0.7rem;
  }

  .comment-form textarea {
    width: 100%;
    min-height: 5.5rem;
    border-radius: 12px;
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-primary);
    padding: 0.85rem 0.95rem;
    font: inherit;
    resize: vertical;
    box-sizing: border-box;
  }

  .comment-form-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .comment-submit-btn,
  .comment-delete-btn {
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-primary);
    border-radius: 999px;
    padding: 0.55rem 0.95rem;
    font: inherit;
    cursor: pointer;
  }

  .comment-submit-btn:hover,
  .comment-delete-btn:hover {
    border-color: var(--accent-color);
    color: var(--accent-color);
  }

  .comment-list {
    display: grid;
    gap: 0.9rem;
  }

  .comment-item {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.9rem;
    align-items: flex-start;
    padding: 0.9rem;
    border-radius: 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
  }

  .comment-avatar {
    width: 2.4rem;
    height: 2.4rem;
    border-radius: 999px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    font-weight: 700;
  }

  .comment-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .comment-body {
    min-width: 0;
    display: grid;
    gap: 0.35rem;
  }

  .comment-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 0.8rem;
    align-items: baseline;
  }

  .comment-meta span {
    color: var(--text-secondary);
    font-size: 0.88rem;
  }

  .comment-body p,
  .comment-status,
  .comment-empty {
    margin: 0;
  }

  .comment-body p {
    white-space: pre-wrap;
    line-height: 1.6;
  }

  .comment-status,
  .comment-empty {
    color: var(--text-secondary);
  }

  .rich-content :global(h2),
  .rich-content :global(h3),
  .rich-content :global(h4),
  .rich-content :global(h5) {
    margin: 1.5rem 0 0.55rem;
    line-height: 1.25;
    color: var(--text-primary);
  }

  .rich-content :global(h2) {
    font-size: 1.45rem;
  }

  .rich-content :global(h3) {
    font-size: 1.28rem;
  }

  .rich-content :global(h4) {
    font-size: 1.14rem;
  }

  .rich-content :global(h5) {
    font-size: 1.02rem;
    letter-spacing: 0.01em;
  }

  .rich-content :global(p),
  .rich-content :global(ul),
  .rich-content :global(ol) {
    margin: 0 0 1rem 0;
    list-style-position: outside;
  }

  .rich-content :global(ul),
  .rich-content :global(ol) {
    padding-left: 1.35rem;
  }

  .rich-content :global(ul) {
    list-style-type: disc;
  }

  .rich-content :global(ol) {
    list-style-type: decimal;
  }

  .rich-content :global(li) {
    margin: 0.35rem 0;
    padding-left: 0.1rem;
    display: list-item;
  }

  .rich-content :global(a) {
    color: var(--culoca-orange);
    font-size: 1.06rem;
    font-weight: 600;
    text-underline-offset: 0.14em;
  }

  .rich-content :global(strong) {
    font-weight: 700;
  }

  .rich-content :global(*:first-child) {
    margin-top: 0;
  }

  .rich-content :global(*:last-child) {
    margin-bottom: 0;
  }

  .video-embed {
    position: relative;
    overflow: hidden;
    width: 100%;
    padding-top: 56.25%;
    border-radius: 12px;
  }

  .video-embed iframe {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
  }

  .similar-motifs-panel {
    width: 100%;
    padding: 1.25rem 1rem 1rem;
    background: var(--bg-primary);
  }

  .similar-motifs-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .similar-motifs-head h2 {
    margin: 0;
  }

  .similar-motifs-head p {
    margin: 0.45rem 0 0;
    color: var(--text-secondary);
    max-width: 72ch;
  }

  .similar-motifs-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
  }

  .similar-item-card {
    overflow: hidden;
    background: transparent;
    border: 0;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .similar-item-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.1);
  }

  .similar-item-link {
    display: flex;
    flex-direction: column;
    text-decoration: none;
    color: inherit;
    height: 100%;
  }

  .similar-item-thumb {
    position: relative;
    aspect-ratio: 3 / 2;
    overflow: hidden;
    background: var(--bg-tertiary);
  }

  .similar-item-thumb::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: var(--thumb-preview);
    background-size: cover;
    background-position: center;
    transform: scale(1.08);
    filter: blur(14px) saturate(0.9);
    opacity: 0.5;
  }

  .similar-item-thumb img {
    position: relative;
    z-index: 1;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    transition: transform 0.3s;
  }

  .similar-item-card:hover .similar-item-thumb img {
    transform: scale(1.04);
  }

  .similar-item-body {
    padding: 0.75rem 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
    background: var(--passepartout-bg);
  }

  .similar-item-body h3 {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
    line-height: 1.35;
    color: var(--text-primary);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .similar-item-body p {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.8rem;
    line-height: 1.45;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .similar-pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.35rem;
    margin-top: 2.5rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .pg-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 36px;
    height: 36px;
    padding: 0 0.6rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    text-decoration: none;
    transition: background 0.15s, color 0.15s, border-color 0.15s, opacity 0.15s;
  }

  .similar-pagination button.pg-link {
    font-family: inherit;
    cursor: pointer;
  }

  .pg-link:hover:not(:disabled) {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border-color: var(--text-muted);
  }

  .pg-link:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .pg-active {
    background: var(--culoca-orange);
    color: #fff;
    border-color: var(--culoca-orange);
    pointer-events: none;
  }

  .pg-dots {
    padding: 0 0.25rem;
    color: var(--text-muted);
  }

  @media (max-width: 960px) {
    .similar-motifs-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (max-width: 720px) {
    .similar-motifs-panel {
      padding: 0 1rem;
    }

    .similar-motifs-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 520px) {
    .similar-motifs-grid {
      grid-template-columns: 1fr;
    }
  }
</style> 
