<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount, tick } from 'svelte';
  import * as exifr from 'exifr';
  import { AIImageAnalyzer } from '$lib/aiImageAnalyzer';
  import LocationPickerCard from '$lib/LocationPickerCard.svelte';
  import SiteNav from '$lib/SiteNav.svelte';
  import SiteFooter from '$lib/SiteFooter.svelte';
  import { supabase } from '$lib/supabaseClient';
  import { authFetch } from '$lib/authFetch';
  import { ITEM_TYPES, getAvailableTypes, getTypeDescription } from '$lib/constants/itemTypes';
  import {
    getDistrictFilenameToken,
    inferLocationTaxonomyFromOriginalName,
    normalizeAdminDisplayLabel,
    parseOriginalFilenameLocation
  } from '$lib/content/locationTaxonomy';
  import {
    reverseGeocodeCoordinates,
    searchLocationHierarchy,
    type ReverseGeocodeFields,
    type SearchGeocodeResult
  } from '$lib/content/geocoding';
  import {
    DESCRIPTIVE_KEYWORDS_MIN,
    KEYWORDS_MAX,
    KEYWORDS_MIN,
    countDescriptiveKeywords,
    sanitizeKeywords,
    sanitizeKeywordsText
  } from '$lib/content/keywords';
  import { extractPhotoMetadataFields } from '$lib/metadata/photoMetadata';

  type UploadItem = {
    id: string;
    file: File;
    preview: string;
    originalFileName: string;
    title: string;
    caption: string;
    description: string;
    keywords: string;
    typeId: number;
    groupSlug: string;
    content: string;
    externalUrl: string;
    videoUrl: string;
    countryCode: string;
    countryName: string;
    stateName: string;
    regionName: string;
    districtCode: string;
    districtName: string;
    municipalityName: string;
    localityName: string;
    localitySuggested: boolean;
    localityConfirmed: boolean;
    motifName: string;
    useStructuredFilename: boolean;
    capturedAt: string | null;
    lat: number | null;
    lon: number | null;
    errors: string[];
    isValid: boolean;
    isUploading: boolean;
    uploadProgress: number;
    isGeneratingAi: boolean;
    aiError: string;
    showAdvancedFields: boolean;
    placeSearchQuery: string;
    selectedPlaceLabel: string;
    placeSearchResults: SearchGeocodeResult[];
    placeSearchLoading: boolean;
    placeSearchError: string;
    placeSearchTimeout: ReturnType<typeof setTimeout> | null;
    geoNeedsRefresh: boolean;
  };

  const TITLE_MIN_LENGTH = 40;
  const TITLE_MAX_LENGTH = 60;
  const DESCRIPTION_MIN_LENGTH = 100;
  const DESCRIPTION_MAX_LENGTH = 160;
  let fileInput: HTMLInputElement;
  let files: UploadItem[] = [];
  let loading = true;
  let isUploading = false;
  let dragOver = false;
  let message = '';
  let messageType: 'success' | 'error' | 'info' = 'info';
  let browserLat: number | null = null;
  let browserLon: number | null = null;
  let isGettingLocation = false;
  let currentUserId: string | null = null;
  let currentProfileLabel = '';
  let newUploadAnchorId: string | null = null;
  const aiImageAnalyzer = new AIImageAnalyzer();

  $: validCount = files.filter((item) => item.isValid).length;
  $: invalidCount = files.length - validCount;
  $: filesWithAdvancedContent = files.filter(
    (item) => item.groupSlug.trim() || item.content.trim() || item.externalUrl.trim() || item.videoUrl.trim()
  ).length;

  function showMessage(text: string, type: 'success' | 'error' | 'info' = 'info') {
    message = text;
    messageType = type;
  }

  function getKeywordCount(text: string): number {
    return text
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean).length;
  }

  function normalizeFieldValue(value: string): string {
    return value.normalize('NFC').replace(/\s+/g, ' ').trim();
  }

  function hasFieldValue(value: string | null | undefined): boolean {
    return !!normalizeFieldValue(value || '');
  }

  function isFiniteCoordinate(value: number | null | undefined): boolean {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function hasCoordinatePair(item: UploadItem): boolean {
    return isFiniteCoordinate(item.lat) && isFiniteCoordinate(item.lon);
  }

  function coordinatesDiffer(
    currentLat: number | null,
    currentLon: number | null,
    nextLat: number | null,
    nextLon: number | null
  ): boolean {
    if (!isFiniteCoordinate(currentLat) || !isFiniteCoordinate(currentLon)) {
      return isFiniteCoordinate(nextLat) || isFiniteCoordinate(nextLon);
    }
    if (!isFiniteCoordinate(nextLat) || !isFiniteCoordinate(nextLon)) {
      return true;
    }
    return Math.abs(currentLat - nextLat) > 0.000001 || Math.abs(currentLon - nextLon) > 0.000001;
  }

  function shouldHighlightOptionalLocality(item: UploadItem): boolean {
    return hasFieldValue(item.localityName) && !localityNeedsConfirmation(item);
  }

  function splitFilename(fileName: string): { stem: string; ext: string } {
    const match = fileName.match(/^(.*?)(\.[a-z0-9]{2,5})$/i);
    if (!match) return { stem: fileName, ext: '' };
    return { stem: match[1], ext: match[2] };
  }

  function extractTechnicalSuffix(fileName: string): string {
    const { stem } = splitFilename(fileName);
    const lastSegment = stem.split('_').pop()?.trim() || '';
    if (!lastSegment) return '';
    if (/^[A-Z0-9-]{3,}$/u.test(lastSegment)) {
      return `_${lastSegment}`;
    }
    return '';
  }

  function normalizeNameTokens(value: string): string[] {
    return normalizeFieldValue(value)
      .toLowerCase()
      .replace(/[()]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }

  function stripAuthorFromMotif(motif: string, author: string): string {
    const normalizedMotif = normalizeFieldValue(motif);
    const authorTokens = normalizeNameTokens(author);
    if (!normalizedMotif || authorTokens.length < 2) return normalizedMotif;

    const motifTokens = normalizeNameTokens(normalizedMotif);
    const authorTokenSet = new Set(authorTokens);
    const sharedCount = motifTokens.filter((token) => authorTokenSet.has(token)).length;

    if (sharedCount < authorTokens.length) {
      return normalizedMotif;
    }

    const authorPattern = authorTokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s,_-]+');
    const reversedPattern = [...authorTokens].reverse().map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s,_-]+');

    return normalizedMotif
      .replace(new RegExp(`\\b${authorPattern}\\b`, 'iu'), ' ')
      .replace(new RegExp(`\\b${reversedPattern}\\b`, 'iu'), ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function formatCapturedDate(value: string | null): string | null {
    if (!value) return null;

    if (/^\d{4}:\d{2}:\d{2}/.test(value)) {
      const [datePart] = value.split(/\s+/);
      const [year, month, day] = datePart.split(':');
      if (year && month && day) {
        return `${day}.${month}.${year}`;
      }
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(parsed);
  }

  function getRecommendedOriginalFilename(item: UploadItem): string | null {
    const countryCode = normalizeFieldValue(item.countryCode || '').toUpperCase();
    const districtToken = normalizeFieldValue(item.districtCode || getDistrictFilenameToken(item.districtName) || '');
    const municipalityName = normalizeFieldValue(item.municipalityName);
    const localityName = normalizeFieldValue(item.localityName);
    const authorLabel = normalizeFieldValue(currentProfileLabel);
    const motifName = stripAuthorFromMotif(normalizeFieldValue(item.motifName), authorLabel);

    if (!countryCode || !districtToken || !municipalityName || !motifName) {
      return null;
    }

    const technicalSuffix = extractTechnicalSuffix(item.originalFileName);
    const { ext } = splitFilename(item.originalFileName);
    const detailLabel = [localityName, motifName].filter(Boolean).join(' ');
    const photographerSegment = authorLabel ? ` (${authorLabel})` : '';
    const technicalSegment = technicalSuffix || '';

    return `${countryCode}_${districtToken}_${municipalityName}_${detailLabel}${photographerSegment}${technicalSegment}${ext}`;
  }

  function getUploadOriginalFilename(item: UploadItem): string {
    return item.useStructuredFilename ? getRecommendedOriginalFilename(item) || item.originalFileName : item.originalFileName;
  }

  function getOriginalFilenameLabel(item: UploadItem): string {
    const formattedDate = formatCapturedDate(item.capturedAt);
    if (!formattedDate) return item.originalFileName;
    return `${item.originalFileName} vom ${formattedDate}`;
  }

  function getAiUserTitle(item: UploadItem): string {
    const existingTitle = normalizeFieldValue(item.title);
    if (existingTitle) return existingTitle;

    const locationLabel = normalizeFieldValue(
      [item.localityName, item.municipalityName].filter(Boolean).join(', ')
    );
    const motifLabel = normalizeFieldValue(item.motifName);
    const parts = [motifLabel, locationLabel].filter(Boolean);

    return parts.join(' in ') || item.originalFileName;
  }

  function hasUsableKeywordSet(item: UploadItem): boolean {
    const keywordCount = sanitizeKeywords(item.keywords, {
      countryName: item.countryName,
      stateName: item.stateName,
      regionName: item.regionName,
      districtName: item.districtName,
      municipalityName: item.municipalityName,
      localityName: item.localityName
    }).length;
    const descriptiveKeywordCount = countDescriptiveKeywords(item.keywords, {
      countryName: item.countryName,
      stateName: item.stateName,
      regionName: item.regionName,
      districtName: item.districtName,
      municipalityName: item.municipalityName,
      localityName: item.localityName
    });
    return (
      keywordCount >= KEYWORDS_MIN &&
      keywordCount <= KEYWORDS_MAX &&
      descriptiveKeywordCount >= DESCRIPTIVE_KEYWORDS_MIN
    );
  }

  function hasMissingAiMetadata(item: UploadItem): boolean {
    return !item.title.trim() || !item.caption.trim() || !item.description.trim() || !hasUsableKeywordSet(item);
  }

  function localityNeedsConfirmation(item: UploadItem): boolean {
    return !!(normalizeFieldValue(item.localityName) && item.localitySuggested && !item.localityConfirmed);
  }

  function setSuggestedLocality(item: UploadItem, localityName: string | null | undefined) {
    const normalizedLocality = normalizeFieldValue(localityName || '');
    item.localityName = normalizedLocality;
    item.localitySuggested = !!normalizedLocality;
    item.localityConfirmed = !normalizedLocality;
  }

  function confirmLocality(item: UploadItem) {
    item.localityName = normalizeFieldValue(item.localityName);
    item.localityConfirmed = true;
    item.localitySuggested = !!item.localityName;
    validateItem(item);
    files = [...files];
  }

  function clearLocality(item: UploadItem) {
    item.localityName = '';
    item.localitySuggested = false;
    item.localityConfirmed = true;
    validateItem(item);
    files = [...files];
  }

  function handleLocalityInput(item: UploadItem) {
    item.localityName = normalizeFieldValue(item.localityName);
    item.localityConfirmed = true;
    item.localitySuggested = false;
    validateItem(item);
    files = [...files];
  }

  function setPlaceDisplay(item: UploadItem, label: string | null | undefined) {
    const normalizedLabel = normalizeFieldValue(label || '');
    if (!normalizedLabel) return;
    item.placeSearchQuery = normalizedLabel;
    item.selectedPlaceLabel = normalizedLabel;
  }

  function applyReverseGeocodeToItem(
    item: UploadItem,
    geocoded: SearchGeocodeResult | ReverseGeocodeFields,
    options: { overwriteExisting?: boolean } = {}
  ) {
    const overwriteExisting = options.overwriteExisting ?? false;

    item.countryCode =
      geocoded.countryName === 'Österreich'
        ? 'A'
        : geocoded.countryName === 'Schweiz'
          ? 'CH'
          : 'D';

    if (overwriteExisting || !normalizeFieldValue(item.countryName)) {
      item.countryName = geocoded.countryName || item.countryName;
    }
    if (overwriteExisting || !normalizeFieldValue(item.stateName)) {
      item.stateName = geocoded.stateName || item.stateName;
    }
    if (overwriteExisting || !normalizeFieldValue(item.regionName)) {
      item.regionName = geocoded.districtName || item.regionName;
    }
    if (overwriteExisting || !normalizeFieldValue(item.districtName)) {
      item.districtName = geocoded.districtName || item.districtName;
    }
    if (overwriteExisting || !normalizeFieldValue(item.municipalityName)) {
      item.municipalityName = geocoded.municipalityName || item.municipalityName;
    }

    if (overwriteExisting) {
      setSuggestedLocality(item, geocoded.localityName);
    } else if (!normalizeFieldValue(item.localityName)) {
      setSuggestedLocality(item, geocoded.localityName);
    }

    setPlaceDisplay(item, geocoded.displayName);
    item.geoNeedsRefresh = false;
  }

  function validateItem(item: UploadItem): boolean {
    const errors: string[] = [];

    item.keywords = sanitizeKeywordsText(item.keywords, {
      countryName: item.countryName,
      stateName: item.stateName,
      regionName: item.regionName,
      districtName: item.districtName,
      municipalityName: item.municipalityName,
      localityName: item.localityName
    });

    if (!item.title.trim()) {
      errors.push('Titel ist erforderlich');
    } else if (item.title.length < TITLE_MIN_LENGTH || item.title.length > TITLE_MAX_LENGTH) {
      errors.push(`Titel muss zwischen ${TITLE_MIN_LENGTH} und ${TITLE_MAX_LENGTH} Zeichen lang sein`);
    }

    if (!item.description.trim()) {
      errors.push('Beschreibung ist erforderlich');
    } else if (
      item.description.length < DESCRIPTION_MIN_LENGTH ||
      item.description.length > DESCRIPTION_MAX_LENGTH
    ) {
      errors.push(
        `Beschreibung muss zwischen ${DESCRIPTION_MIN_LENGTH} und ${DESCRIPTION_MAX_LENGTH} Zeichen lang sein`
      );
    }

    const keywordCount = sanitizeKeywords(item.keywords, {
      countryName: item.countryName,
      stateName: item.stateName,
      regionName: item.regionName,
      districtName: item.districtName,
      municipalityName: item.municipalityName,
      localityName: item.localityName
    }).length;
    const descriptiveKeywordCount = countDescriptiveKeywords(item.keywords, {
      countryName: item.countryName,
      stateName: item.stateName,
      regionName: item.regionName,
      districtName: item.districtName,
      municipalityName: item.municipalityName,
      localityName: item.localityName
    });
    if (!item.keywords.trim()) {
      errors.push('Keywords sind erforderlich');
    } else if (keywordCount < KEYWORDS_MIN || keywordCount > KEYWORDS_MAX) {
      errors.push(`Keywords müssen zwischen ${KEYWORDS_MIN} und ${KEYWORDS_MAX} liegen`);
    } else if (descriptiveKeywordCount < DESCRIPTIVE_KEYWORDS_MIN) {
      errors.push(`Mindestens ${DESCRIPTIVE_KEYWORDS_MIN} Keywords müssen sichtbare Bildinhalte statt nur Ortsdaten beschreiben`);
    }

    if (item.lat == null || item.lon == null) {
      errors.push('GPS-Koordinaten fehlen');
    }

    if (localityNeedsConfirmation(item)) {
      errors.push('Ortsteil / Stadtteil / Viertel bitte prüfen, bestätigen oder leer lassen');
    }

    if (item.useStructuredFilename) {
      if (!normalizeFieldValue(item.districtName)) {
        errors.push('Für das empfohlene Dateimuster fehlt der Landkreis / Bezirk');
      }

      if (!normalizeFieldValue(item.municipalityName)) {
        errors.push('Für das empfohlene Dateimuster fehlt Gemeinde / Stadt');
      }

      if (!normalizeFieldValue(item.motifName)) {
        errors.push('Für das empfohlene Dateimuster fehlt das Motiv');
      }
    }

    item.errors = errors;
    item.isValid = errors.length === 0;
    return item.isValid;
  }

  function validateAll() {
    files = files.map((item) => {
      validateItem(item);
      return item;
    });
  }

  function fixEncoding(str: string | null): string | null {
    if (!str) return str;

    try {
      if (str.includes('Ã')) {
        const latin1Bytes = new Uint8Array(str.length);
        for (let i = 0; i < str.length; i += 1) {
          latin1Bytes[i] = str.charCodeAt(i);
        }
        return new TextDecoder('utf-8').decode(latin1Bytes);
      }
    } catch {
      return str;
    }

    return str;
  }

  async function ensureAuth() {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session?.user) {
      goto('/login');
      return null;
    }

    currentUserId = session.user.id;
    return session;
  }

  async function getBrowserLocation() {
    if (!navigator.geolocation) {
      showMessage('Geolocation wird von diesem Browser nicht unterstützt.', 'error');
      return;
    }

    isGettingLocation = true;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        browserLat = position.coords.latitude;
        browserLon = position.coords.longitude;
        isGettingLocation = false;
        showMessage('Standort erfolgreich geladen.', 'success');
      },
      () => {
        isGettingLocation = false;
        showMessage('Standort konnte nicht geladen werden.', 'error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  function useCurrentLocation(item: UploadItem) {
    if (browserLat == null || browserLon == null) return;
    const changed = coordinatesDiffer(item.lat, item.lon, browserLat, browserLon);
    item.lat = browserLat;
    item.lon = browserLon;
    item.placeSearchQuery = '';
    item.selectedPlaceLabel = '';
    item.placeSearchResults = [];
    item.placeSearchError = '';
    item.geoNeedsRefresh = changed || item.geoNeedsRefresh;
    validateItem(item);
    files = [...files];
  }

  async function autofillGeoFromCoordinates(item: UploadItem) {
    if (item.lat == null || item.lon == null) {
      showMessage('Für die Ortsdaten-Ermittlung fehlen GPS-Koordinaten.', 'error');
      return;
    }

    try {
      const geocoded = await reverseGeocodeCoordinates(item.lat, item.lon);
      if (!geocoded) {
        showMessage('Ortsdaten konnten aus den GPS-Koordinaten nicht ermittelt werden.', 'error');
        return;
      }

      applyReverseGeocodeToItem(item, geocoded, { overwriteExisting: true });

      validateItem(item);
      files = [...files];
      showMessage('Ortsdaten aus GPS übernommen.', 'success');
    } catch (error) {
      console.error('Failed to autofill geo data from coordinates:', error);
      showMessage('Ortsdaten konnten aus GPS gerade nicht geladen werden.', 'error');
    }
  }

  function applySearchResultToItem(item: UploadItem, result: SearchGeocodeResult) {
    item.lat = result.lat;
    item.lon = result.lon;
    applyReverseGeocodeToItem(item, result, { overwriteExisting: true });
    item.placeSearchResults = [];
    item.placeSearchError = '';
    validateItem(item);
    files = [...files];
  }

  async function runPlaceSearch(item: UploadItem) {
    const query = item.placeSearchQuery.trim();
    if (query.length < 3) {
      item.placeSearchResults = [];
      item.placeSearchError = '';
      item.placeSearchLoading = false;
      files = [...files];
      return;
    }

    item.placeSearchLoading = true;
    item.placeSearchError = '';
    files = [...files];

    try {
      const results = await searchLocationHierarchy(query);
      item.placeSearchResults = results;
      item.placeSearchError = results.length ? '' : 'Kein passender Ort oder keine Landmarke gefunden.';
    } catch (error) {
      console.error('Failed to search places for upload item:', error);
      item.placeSearchResults = [];
      item.placeSearchError = 'Ortssuche ist gerade nicht verfügbar.';
    } finally {
      item.placeSearchLoading = false;
      files = [...files];
    }
  }

  function handlePlaceSearchInput(item: UploadItem) {
    item.placeSearchError = '';
    if (item.placeSearchTimeout) clearTimeout(item.placeSearchTimeout);
  }

  function handlePlaceSearchKeydown(event: KeyboardEvent, item: UploadItem) {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (item.placeSearchTimeout) {
        clearTimeout(item.placeSearchTimeout);
        item.placeSearchTimeout = null;
      }
      void runPlaceSearch(item);
      return;
    }

    if (event.key === 'Escape') {
      if (item.placeSearchTimeout) {
        clearTimeout(item.placeSearchTimeout);
        item.placeSearchTimeout = null;
      }
      item.placeSearchResults = [];
      item.placeSearchError = '';
      item.placeSearchLoading = false;
      files = [...files];
    }
  }

  function selectPlaceSearchResult(item: UploadItem, result: SearchGeocodeResult) {
    if (item.placeSearchTimeout) {
      clearTimeout(item.placeSearchTimeout);
      item.placeSearchTimeout = null;
    }
    applySearchResultToItem(item, result);
  }

  function applyCurrentLocationToAll() {
    if (browserLat == null || browserLon == null) return;
    files = files.map((item) => {
      item.lat = browserLat;
      item.lon = browserLon;
      validateItem(item);
      return item;
    });
  }

  async function autofillGeoForAll() {
    const itemsWithCoordinates = files.filter((item) => item.lat != null && item.lon != null);
    if (!itemsWithCoordinates.length) {
      showMessage('Es sind noch keine GPS-Koordinaten für die Ortsdaten-Ermittlung vorhanden.', 'error');
      return;
    }

    for (const item of itemsWithCoordinates) {
      await autofillGeoFromCoordinates(item);
    }
  }

  async function scrollToNewUploadAnchor() {
    await tick();

    if (!newUploadAnchorId) return;

    const anchor = document.getElementById(newUploadAnchorId);
    anchor?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function processFiles(fileList: File[], options: { scrollToNewItems?: boolean } = {}) {
    const newItems: UploadItem[] = [];

    for (const file of fileList) {
      if (!file.type.startsWith('image/')) continue;

      const item: UploadItem = {
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        originalFileName: file.name,
        title: '',
        caption: '',
        description: '',
        keywords: '',
        typeId: ITEM_TYPES.PHOTO,
        groupSlug: '',
        content: '',
        externalUrl: '',
        videoUrl: '',
        countryCode: 'D',
        countryName: 'Deutschland',
        stateName: '',
        regionName: '',
        districtCode: '',
        districtName: '',
        municipalityName: '',
        localityName: '',
        localitySuggested: false,
        localityConfirmed: true,
        motifName: '',
        useStructuredFilename: false,
        capturedAt: null,
        lat: browserLat,
        lon: browserLon,
        errors: [],
        isValid: false,
        isUploading: false,
        uploadProgress: 0,
        isGeneratingAi: false,
        aiError: '',
        showAdvancedFields: false,
        placeSearchQuery: '',
        selectedPlaceLabel: '',
        placeSearchResults: [],
        placeSearchLoading: false,
        placeSearchError: '',
        placeSearchTimeout: null,
        geoNeedsRefresh: false
      };

      try {
        const exifData = await exifr.parse(file, { iptc: true });
        const extracted = extractPhotoMetadataFields(exifData || {});
        const createdAt =
          exifData?.DateTimeOriginal ||
          exifData?.CreateDate ||
          exifData?.DateCreated ||
          exifData?.ModifyDate ||
          null;

        item.title = extracted.title?.trim() || '';
        item.caption = extracted.caption?.trim() || '';
        item.description = extracted.description?.trim() || '';
        item.keywords = extracted.keywords?.trim() || '';
        if (createdAt instanceof Date && !Number.isNaN(createdAt.getTime())) {
          item.capturedAt = createdAt.toISOString();
        } else if (typeof createdAt === 'string' && createdAt.trim()) {
          item.capturedAt = createdAt.trim();
        }
        if (typeof exifData?.latitude === 'number' && typeof exifData?.longitude === 'number') {
          item.lat = exifData.latitude;
          item.lon = exifData.longitude;
        }
      } catch {
        // Keep defaults if EXIF parsing fails.
      }

      const inferredFilename = inferLocationTaxonomyFromOriginalName(file.name);
      if (inferredFilename) {
        item.countryCode = inferredFilename.countryCode;
        item.countryName = inferredFilename.countryName || item.countryName;
        item.stateName = inferredFilename.stateName || item.stateName;
        item.regionName = inferredFilename.regionName || item.regionName;
        item.districtCode = inferredFilename.districtCode || '';
        item.districtName =
          normalizeAdminDisplayLabel(inferredFilename.districtName || inferredFilename.districtCode) ||
          inferredFilename.districtCode;
        item.municipalityName =
          normalizeAdminDisplayLabel(inferredFilename.municipalityName) || inferredFilename.municipalityName;
        item.motifName = inferredFilename.motifLabel;
      } else {
        const parsedFilename = parseOriginalFilenameLocation(file.name);
        if (parsedFilename) {
          item.countryCode = parsedFilename.countryCode;
          item.districtCode = parsedFilename.districtCode || '';
          item.districtName = normalizeAdminDisplayLabel(parsedFilename.districtCode) || parsedFilename.districtCode;
          item.municipalityName =
            normalizeAdminDisplayLabel(parsedFilename.municipalityName) || parsedFilename.municipalityName;
          item.motifName = parsedFilename.motifLabel;
        }
      }

      if (item.lat != null && item.lon != null) {
        try {
          const geocoded = await reverseGeocodeCoordinates(item.lat, item.lon);
          if (geocoded) {
            applyReverseGeocodeToItem(item, geocoded);
          }
        } catch (error) {
          console.error('Failed to prefill upload geo data from existing GPS:', error);
        }
      }

      validateItem(item);
      newItems.push(item);
    }

    files = [...files, ...newItems];

    if (options.scrollToNewItems && newItems.length > 0) {
      newUploadAnchorId = `new-upload-anchor-${newItems[0].id}`;
      await scrollToNewUploadAnchor();
    }
  }

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const selected = Array.from(input.files || []);
    if (selected.length) {
      processFiles(selected);
    }
    input.value = '';
  }

  function removeItem(id: string) {
    const found = files.find((item) => item.id === id);
    if (found) {
      URL.revokeObjectURL(found.preview);
    }
    files = files.filter((item) => item.id !== id);
  }

  function applyMapSelection(item: UploadItem, event: CustomEvent<{ lat: number; lon: number; label: string | null }>) {
    const changed = coordinatesDiffer(item.lat, item.lon, event.detail.lat, event.detail.lon);
    item.lat = event.detail.lat;
    item.lon = event.detail.lon;
    if (event.detail.label?.trim()) {
      const nextLabel = event.detail.label.trim();
      item.placeSearchQuery = nextLabel;
      item.selectedPlaceLabel = nextLabel;
    }
    if (changed) {
      item.geoNeedsRefresh = true;
    }
    validateItem(item);
    files = [...files];
  }

  function handleCoordinateInput(item: UploadItem) {
    item.geoNeedsRefresh = hasCoordinatePair(item);
    validateItem(item);
    files = [...files];
  }

  async function autofillMetadataWithAi(item: UploadItem) {
    if (item.isGeneratingAi) return;

    if (!hasMissingAiMetadata(item)) {
      showMessage('Titel, Caption, Beschreibung und Keywords sind bereits vorhanden.', 'info');
      return;
    }

    item.isGeneratingAi = true;
    item.aiError = '';
    files = [...files];

    try {
      const imageBase64 = await aiImageAnalyzer.resizeImageForAI(item.file);
      const result = await aiImageAnalyzer.analyzeImage({
        imageBase64,
        userTitle: getAiUserTitle(item),
        originalTitle: item.originalFileName,
        countryName: normalizeFieldValue(item.countryName),
        stateName: normalizeFieldValue(item.stateName),
        regionName: normalizeFieldValue(item.regionName),
        motifName: normalizeFieldValue(item.motifName),
        districtName: normalizeFieldValue(item.districtName),
        municipalityName: normalizeFieldValue(item.municipalityName),
        localityName: normalizeFieldValue(item.localityName),
        existingKeywords: sanitizeKeywordsText(item.keywords, {
          countryName: item.countryName,
          stateName: item.stateName,
          regionName: item.regionName,
          districtName: item.districtName,
          municipalityName: item.municipalityName,
          localityName: item.localityName
        }),
        capturedAt: item.capturedAt
      });

      if (!result.success) {
        throw new Error(result.error || 'KI-Autofill konnte nicht erstellt werden.');
      }

      if (!item.title.trim()) item.title = result.title.trim();
      if (!item.caption.trim()) item.caption = result.caption.trim();
      if (!item.description.trim()) item.description = result.description.trim();
      if (!hasUsableKeywordSet(item)) item.keywords = result.keywords.trim();

      validateItem(item);
      files = [...files];
      showMessage('Fehlende Textfelder wurden mit KI ergänzt.', 'success');
    } catch (error) {
      item.aiError = error instanceof Error ? error.message : 'KI-Autofill fehlgeschlagen.';
      files = [...files];
      showMessage(item.aiError, 'error');
    } finally {
      item.isGeneratingAi = false;
      files = [...files];
    }
  }

  async function uploadOriginalToSupabase(file: File, id: string) {
    const path = `${id}.jpg`;
    const { error } = await supabase.storage.from('originals').upload(path, file, {
      contentType: file.type,
      upsert: false
    });

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    return path;
  }

  async function uploadItem(item: UploadItem, accessToken: string) {
    if (item.isUploading) return false;

    item.isUploading = true;

    try {
      const id = crypto.randomUUID();
      const originalPath = await uploadOriginalToSupabase(item.file, id);
      const formData = new FormData();
      formData.append('filename', `${id}.jpg`);
      formData.append('original_path', originalPath);
      formData.append('original_filename', getUploadOriginalFilename(item));
      formData.append('title', item.title);
      if (item.caption.trim()) formData.append('caption', item.caption.trim());
      formData.append('description', item.description);
      formData.append('keywords', item.keywords);
      formData.append('type_id', String(item.typeId));
      if (item.groupSlug.trim()) formData.append('group_slug', item.groupSlug.trim());
      if (item.content.trim()) formData.append('content', item.content.trim());
      if (item.externalUrl.trim()) formData.append('external_url', item.externalUrl.trim());
      if (item.videoUrl.trim()) formData.append('video_url', item.videoUrl.trim());
      if (item.lat != null) formData.append('lat', String(item.lat));
      if (item.lon != null) formData.append('lon', String(item.lon));
      if (item.countryName.trim()) formData.append('country_name', item.countryName.trim());
      if (item.stateName.trim()) formData.append('state_name', item.stateName.trim());
      if (item.regionName.trim()) formData.append('region_name', item.regionName.trim());
      if (item.districtName.trim()) formData.append('district_name', item.districtName.trim());
      if (item.municipalityName.trim()) formData.append('municipality_name', item.municipalityName.trim());
      if (item.localityName.trim()) formData.append('locality_name', item.localityName.trim());

      const response = await authFetch('/api/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        body: formData
      });

      const result = await response.json();
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || 'Upload fehlgeschlagen');
      }

      item.uploadProgress = 100;
      return true;
    } catch (error) {
      item.errors = [
        ...(item.errors || []),
        error instanceof Error ? error.message : 'Upload fehlgeschlagen'
      ];
      item.isValid = false;
      return false;
    } finally {
      item.isUploading = false;
    }
  }

  async function uploadAll() {
    validateAll();

    const readyItems = files.filter((item) => item.isValid);
    if (!readyItems.length) {
      showMessage('Keine gültigen Uploads vorhanden.', 'error');
      return;
    }

    const session = await ensureAuth();
    if (!session?.access_token) return;

    isUploading = true;
    let successCount = 0;

    for (const item of readyItems) {
      const success = await uploadItem(item, session.access_token);
      if (success) successCount += 1;
    }

    isUploading = false;
    files = files.filter((item) => item.uploadProgress !== 100);
    showMessage(`${successCount} Bild(er) erfolgreich hochgeladen.`, 'success');
  }

  async function uploadAllForReview() {
    if (!files.length) {
      showMessage('Keine Dateien für den Upload vorhanden.', 'error');
      return;
    }

    validateAll();

    const session = await ensureAuth();
    if (!session?.access_token) return;

    isUploading = true;
    let successCount = 0;
    let reviewCount = 0;

    for (const item of files) {
      if (!item.isValid) {
        reviewCount += 1;
      }

      const success = await uploadItem(item, session.access_token);
      if (success) successCount += 1;
    }

    isUploading = false;
    files = files.filter((item) => item.uploadProgress !== 100);

    if (reviewCount > 0) {
      showMessage(
        `${successCount} Bild(er) hochgeladen. ${reviewCount} Eintrag(e) brauchen noch Nacharbeit und erscheinen rot im Konto unter Daten prüfen.`,
        'info'
      );
      return;
    }

    showMessage(`${successCount} Bild(er) erfolgreich hochgeladen.`, 'success');
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    dragOver = false;
    const dropped = Array.from(event.dataTransfer?.files || []);
    if (dropped.length) {
      void processFiles(dropped, { scrollToNewItems: true });
    }
  }

  function desktopStickyPreview(node: HTMLElement) {
    const stickyInner = node.querySelector<HTMLElement>('.preview-wrap__sticky');
    const card = node.closest<HTMLElement>('.upload-card');
    if (!stickyInner || !card) {
      return { destroy() {} };
    }

    const desktopBreakpoint = 860;
    const stickyTop = 120;
    const bottomGap = 16;

    function resetStyles() {
      stickyInner.style.position = '';
      stickyInner.style.top = '';
      stickyInner.style.left = '';
      stickyInner.style.width = '';
      stickyInner.style.bottom = '';
    }

    function updateSticky() {
      if (window.innerWidth <= desktopBreakpoint) {
        resetStyles();
        return;
      }

      const cardRect = card.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      const stickyHeight = stickyInner.offsetHeight;
      const maxStickyTop = cardRect.bottom - stickyHeight - bottomGap;

      if (cardRect.top > stickyTop) {
        stickyInner.style.position = 'sticky';
        stickyInner.style.top = `${stickyTop}px`;
        stickyInner.style.left = '';
        stickyInner.style.width = '';
        stickyInner.style.bottom = '';
        return;
      }

      if (maxStickyTop <= stickyTop) {
        stickyInner.style.position = 'absolute';
        stickyInner.style.top = 'auto';
        stickyInner.style.left = '1rem';
        stickyInner.style.width = 'calc(100% - 2rem)';
        stickyInner.style.bottom = `${bottomGap}px`;
        return;
      }

      stickyInner.style.position = 'fixed';
      stickyInner.style.top = `${stickyTop}px`;
      stickyInner.style.left = `${nodeRect.left + 16}px`;
      stickyInner.style.width = `${Math.max(node.clientWidth - 32, 0)}px`;
      stickyInner.style.bottom = '';
    }

    const onScrollOrResize = () => {
      window.requestAnimationFrame(updateSticky);
    };

    const resizeObserver = new ResizeObserver(onScrollOrResize);
    resizeObserver.observe(node);
    resizeObserver.observe(stickyInner);
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    onScrollOrResize();

    return {
      update: onScrollOrResize,
      destroy() {
        resizeObserver.disconnect();
        window.removeEventListener('scroll', onScrollOrResize);
        window.removeEventListener('resize', onScrollOrResize);
        resetStyles();
      }
    };
  }

  onMount(async () => {
    const session = await ensureAuth();
    if (!session) return;
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', session.user.id)
      .single();
    currentProfileLabel = (profile?.full_name || '').trim();
    loading = false;
    getBrowserLocation();
  });
</script>

<svelte:head>
  <title>Foto Upload - Culoca</title>
</svelte:head>

<div class="upload-page">
  <SiteNav />

  <div class="upload-shell">
    <div class="page-header">
      <div class="hero-copy">
        <p class="eyebrow">Foto Upload</p>
        <h1>Fotos sauber anlegen, bevor sie live gehen</h1>
        <p class="intro">
          Diese neue Upload-Strecke ist für kuratierte Foto-Inhalte gedacht. Sie übernimmt EXIF- und GPS-Daten,
          erklärt die wichtigen SEO-Felder früh und hilft dir, Bilder schon vor dem Speichern vollständig
          aufzubereiten.
        </p>

        <div class="hero-notes">
          <div class="hero-note">
            <strong>Wofür diese Seite gedacht ist</strong>
            <span>Einzelne oder sorgfältig ausgewählte Fotos mit sauberem Titel, Beschreibung, Keywords und Standort.</span>
          </div>
          <div class="hero-note">
            <strong>Wofür der Batch-Uploader bleibt</strong>
            <span>Viele Bilder schnell hochladen und den bisherigen Referenz-Workflow weiter verfügbar halten.</span>
          </div>
        </div>
      </div>

      <div class="hero-panel">
        <div class="hero-panel__inner">
          <p class="hero-panel__label">Upload-Start</p>
          <div class="hero-actions">
            <button class="primary-btn" on:click={() => fileInput?.click()}>Dateien auswählen</button>
            <label class="secondary-link camera-link">
              Foto aufnehmen
              <input type="file" accept="image/*" capture="environment" on:change={handleFileSelect} hidden />
            </label>
            <a href="/bulk-upload" class="secondary-link">Zum Batch-Uploader</a>
          </div>
          <div class="hero-steps">
            <div><span>1</span>Dateien ziehen oder auswählen</div>
            <div><span>2</span>Texte, Keywords und GPS prüfen</div>
            <div><span>3</span>Nur gültige Fotos gesammelt speichern</div>
          </div>
        </div>
      </div>
    </div>

    {#if message}
      <div class="message message--{messageType}">{message}</div>
    {/if}

    {#if loading}
      <div class="state-card">Lade Upload-Kontext...</div>
    {:else}
      <section class="info-grid">
        <article class="info-card">
          <p class="info-card__eyebrow">Vor dem Upload</p>
          <h2>Was für gute Foto-Seiten wichtig ist</h2>
          <ul>
            <li>Ein sprechender Titel mit Motiv und Ort statt interner Kurzform.</li>
            <li>Eine eigenständige Beschreibung, die nicht nur das Offensichtliche wiederholt.</li>
            <li>Genug Keywords, damit Motiv, Thema und Region später sauber verlinkt werden.</li>
            <li>Präzise GPS-Daten, damit Ortsseiten, Taxonomie und Hubs stimmen.</li>
          </ul>
        </article>

        <article class="info-card info-card--warm">
          <p class="info-card__eyebrow">Erweiterte Inhalte</p>
          <h2>Mehr als nur ein Bild</h2>
          <p>
            Weblink, Video-Link, Group-Slug und längerer Content können direkt beim Upload gepflegt werden. So
            sparst du dir spätere Nacharbeit im Detail-Editmodus.
          </p>
        </article>

        <article class="info-card info-card--accent">
          <p class="info-card__eyebrow">Empfohlener Ablauf</p>
          <h2>Zwei Wege, je nach Datenqualität</h2>
          <ul>
            <li>Wenn Bilder schon alle IPTC-/GPS-Daten tragen: gern weiter im Batch-Uploader.</li>
            <li>Wenn Angaben fehlen: hier hochladen und den Rest anschließend über die rote Konto-Meldung strukturiert abarbeiten.</li>
            <li>Das Dateimuster bleibt optional, ist aber die schnellste Empfehlung für Bulk-Uploads und bessere Nachmigration.</li>
          </ul>
        </article>
      </section>

      <section
        class="dropzone"
        class:dropzone--active={dragOver}
        role="button"
        tabindex="0"
        on:dragover|preventDefault={() => (dragOver = true)}
        on:dragleave={() => (dragOver = false)}
        on:drop={onDrop}
        on:keydown|self={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            fileInput?.click();
          }
        }}
        on:click|self={() => {
          fileInput?.click();
        }}
      >
        <input bind:this={fileInput} type="file" accept="image/*" multiple hidden on:change={handleFileSelect} />
        <div class="dropzone-icon" aria-hidden="true">
          <svg viewBox="0 0 64 64" role="presentation" focusable="false">
            <path
              d="M32 12 20 24h8v14h8V24h8L32 12Zm-18 30h36a6 6 0 0 1 6 6v2a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2a6 6 0 0 1 6-6Z"
              fill="currentColor"
            />
          </svg>
        </div>
        <strong>Dateien hier ablegen</strong>
        <span>oder klicken, um Bilder manuell auszuwählen</span>
        <small>Vorhandene EXIF-, IPTC- und GPS-Daten werden automatisch übernommen.</small>
      </section>

      <section class="location-bar">
        <div class="location-copy">
          <strong>Aktueller Browser-Standort</strong>
          <p>
            {#if browserLat != null && browserLon != null}
              {browserLat.toFixed(6)}, {browserLon.toFixed(6)}
            {:else}
              Noch kein Browser-Standort geladen. Ohne Koordinaten bleiben Fotos später häufig in der Review-Liste hängen.
            {/if}
          </p>
        </div>
        <div class="location-actions">
          <button class="secondary-btn" disabled={isGettingLocation} on:click={getBrowserLocation}>
            {isGettingLocation ? 'Standort wird geladen...' : 'Standort neu laden'}
          </button>
          <button class="secondary-btn" disabled={browserLat == null || browserLon == null} on:click={applyCurrentLocationToAll}>
            Standort auf alle anwenden
          </button>
          <button class="secondary-btn" disabled={!files.some((item) => item.lat != null && item.lon != null)} on:click={autofillGeoForAll}>
            Ortsdaten für alle aus GPS ermitteln
          </button>
        </div>
      </section>

      {#if files.length > 0}
        <section class="stats-grid">
          <article class="stat-card">
            <span class="stat-card__label">In Bearbeitung</span>
            <strong>{files.length}</strong>
            <p>Dateien sind aktuell im neuen Foto-Flow offen.</p>
          </article>
          <article class="stat-card stat-card--ok">
            <span class="stat-card__label">Upload-bereit</span>
            <strong>{validCount}</strong>
            <p>Diese Fotos erfüllen momentan alle Pflichtangaben.</p>
          </article>
          <article class="stat-card stat-card--warn">
            <span class="stat-card__label">Noch offen</span>
            <strong>{invalidCount}</strong>
            <p>Hier fehlen noch Texte, Keywords oder Standortdaten.</p>
          </article>
          <article class="stat-card">
            <span class="stat-card__label">Mit Zusatzinhalt</span>
            <strong>{filesWithAdvancedContent}</strong>
            <p>Diese Fotos nutzen bereits Link, Video, Group-Slug oder Content.</p>
          </article>
        </section>

        <div class="toolbar">
          <div class="toolbar-meta">
            <strong>{files.length}</strong> Datei(en) in Bearbeitung
            <span>Du kannst nur vollständige Fotos hochladen oder bewusst auch offene Fälle in die Review-Strecke schicken.</span>
          </div>
            <div class="toolbar-actions">
              <button class="primary-btn" disabled={isUploading} on:click={uploadAll}>
                {isUploading ? 'Upload läuft...' : 'Nur vollständige Bilder hochladen'}
              </button>
            <button class="secondary-btn" disabled={isUploading} on:click={uploadAllForReview}>
              {isUploading ? 'Upload läuft...' : 'Auch offene Bilder hochladen'}
            </button>
          </div>
        </div>

        <div class="card-grid">
          {#each files as item (item.id)}
            <article
              id={newUploadAnchorId === `new-upload-anchor-${item.id}` ? newUploadAnchorId : undefined}
              class="upload-card"
              class:upload-card--invalid={!item.isValid}
              tabindex={newUploadAnchorId === `new-upload-anchor-${item.id}` ? -1 : undefined}
            >
              <div class="preview-wrap" use:desktopStickyPreview>
                <div class="preview-wrap__sticky">
                  <img src={item.preview} alt={item.originalFileName} />
                </div>
              </div>

              <div class="card-body">
                <div class="card-head">
                  <div>
                    <h2>{item.originalFileName}</h2>
                    <p class="type-hint">{getTypeDescription(item.typeId)}</p>
                  </div>
                  <button class="remove-btn" on:click={() => removeItem(item.id)}>Entfernen</button>
                </div>

                <label class="field">
                  <span>Typ</span>
                  <select bind:value={item.typeId}>
                    {#each getAvailableTypes() as type}
                      <option value={type.id}>{type.label}</option>
                    {/each}
                  </select>
                </label>

                <div class="place-search-box">
                  <div class="place-search-row">
                    <label class="field" class:form-field--valid={hasCoordinatePair(item)} class:form-field--invalid={!hasCoordinatePair(item)}>
                      <span>Ort oder Landmarke suchen</span>
                      <input
                        bind:value={item.placeSearchQuery}
                        placeholder="z. B. Brandenburger Tor, Wurmannsquick oder Friesing"
                        on:input={() => handlePlaceSearchInput(item)}
                        on:keydown={(event) => handlePlaceSearchKeydown(event, item)}
                      />
                      <small>`Enter` startet die Suche. Treffer übernehmen Koordinaten sowie Land, Landkreis, Gemeinde / Stadt und optional Ortsteil / Stadtteil / Viertel.</small>
                      {#if item.lat != null && item.lon != null}
                        <small>GPS-Daten erkannt: {item.lat.toFixed(6)}, {item.lon.toFixed(6)}. Karte und Ortsfelder wurden vorausgefüllt.</small>
                      {/if}
                    </label>
                    <button
                      class="secondary-btn place-search-row__button"
                      type="button"
                      disabled={browserLat == null || browserLon == null}
                      on:click={() => useCurrentLocation(item)}
                    >
                      Aktuelle Position
                    </button>
                  </div>
                  {#if item.placeSearchLoading}
                    <div class="place-search-status">Suche läuft...</div>
                  {:else if item.placeSearchError}
                    <div class="place-search-status place-search-status--error">{item.placeSearchError}</div>
                  {/if}
                  {#if item.placeSearchResults.length > 0}
                    <div class="place-search-results">
                      {#each item.placeSearchResults as result}
                        <button type="button" class="place-search-result" on:click={() => selectPlaceSearchResult(item, result)}>
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

                <LocationPickerCard
                  initialLat={item.lat}
                  initialLon={item.lon}
                  initialLabel={item.selectedPlaceLabel}
                  liveUpdate={true}
                  showSearchTools={false}
                  showSelectionFooter={false}
                  showSaveButton={false}
                  on:save={(event) => applyMapSelection(item, event)}
                />

                <div class="geo-grid">
                  <label class="field" class:form-field--valid={isFiniteCoordinate(item.lat)} class:form-field--invalid={!isFiniteCoordinate(item.lat)}>
                    <span>Breitengrad</span>
                    <input type="number" step="any" bind:value={item.lat} on:input={() => handleCoordinateInput(item)} />
                  </label>
                  <label class="field" class:form-field--valid={isFiniteCoordinate(item.lon)} class:form-field--invalid={!isFiniteCoordinate(item.lon)}>
                    <span>Längengrad</span>
                    <input type="number" step="any" bind:value={item.lon} on:input={() => handleCoordinateInput(item)} />
                  </label>
                </div>

                <div class="inline-actions">
                  <button
                    class="secondary-btn"
                    class:attention-pulse-glow={item.geoNeedsRefresh}
                    disabled={item.lat == null || item.lon == null}
                    on:click={() => autofillGeoFromCoordinates(item)}
                  >
                    Ortsdaten aus GPS-Position ermitteln
                  </button>
                </div>

                <div class="structured-box">
                  <div class="structured-box__intro">
                    <strong>Ortsdaten und Motiv</strong>
                    <p>
                      Diese Angaben steuern Dateimuster, Orts-Taxonomie und die spätere KI-Unterstützung für Titel, Caption, Beschreibung und Keywords.
                    </p>
                  </div>

                  <div class="structured-grid">
                    <label class="field" class:form-field--valid={hasFieldValue(item.countryCode)} class:form-field--invalid={!hasFieldValue(item.countryCode)}>
                      <span>Land</span>
                      <select bind:value={item.countryCode} on:change={() => validateItem(item)}>
                        <option value="D">Deutschland (D)</option>
                        <option value="A">Österreich (A)</option>
                        <option value="CH">Schweiz (CH)</option>
                      </select>
                    </label>

                    <label class="field" class:form-field--valid={hasFieldValue(item.districtName)} class:form-field--invalid={!hasFieldValue(item.districtName)}>
                      <span>Landkreis / Bezirk</span>
                      <input
                        bind:value={item.districtName}
                        on:input={() => validateItem(item)}
                      />
                    </label>

                    <label class="field" class:form-field--valid={hasFieldValue(item.municipalityName)} class:form-field--invalid={!hasFieldValue(item.municipalityName)}>
                      <span>Gemeinde / Stadt</span>
                      <input
                        bind:value={item.municipalityName}
                        on:input={() => validateItem(item)}
                      />
                    </label>

                    <label
                      class="field"
                      class:form-field--valid={shouldHighlightOptionalLocality(item)}
                      class:form-field--invalid={localityNeedsConfirmation(item)}
                    >
                      <span>Ortsteil / Stadtteil / Viertel</span>
                      <input
                        bind:value={item.localityName}
                        on:input={() => handleLocalityInput(item)}
                      />
                      {#if localityNeedsConfirmation(item)}
                        <small class="locality-review-note">
                          Automatisch erkannt. Bitte kurz prüfen und bestätigen oder leer lassen, wenn es keinen passenden Ortsteil gibt.
                        </small>
                      {:else if item.localityName}
                        <small>Optional. Wenn gesetzt, sollte der Ortsteil genau stimmen.</small>
                      {:else}
                        <small>Optional. In vielen Städten oder Gemeinden gibt es keinen Ortsteil.</small>
                      {/if}
                    </label>

                    {#if localityNeedsConfirmation(item)}
                      <div class="locality-review-actions">
                        <button class="secondary-btn" type="button" on:click={() => confirmLocality(item)}>
                          Ortsteil bestätigen
                        </button>
                        <button class="secondary-btn" type="button" on:click={() => clearLocality(item)}>
                          Kein Ortsteil
                        </button>
                      </div>
                    {/if}

                    <label class="field structured-grid__motif" class:form-field--valid={hasFieldValue(item.motifName)} class:form-field--invalid={!hasFieldValue(item.motifName)}>
                      <span>Motiv</span>
                      <input
                        bind:value={item.motifName}
                        placeholder="Herrenhaus"
                        on:input={() => validateItem(item)}
                      />
                    </label>
                  </div>

                  <div class="filename-preview">
                    <span class="filename-preview__label">{getOriginalFilenameLabel(item)}</span>
                    <span class="filename-preview__label">Empfohlener Originaldateiname</span>
                    <code>{getRecommendedOriginalFilename(item) || 'Landkreis, Gemeinde / Stadt und Motiv eintragen, um die Vorlage zu sehen.'}</code>
                  </div>

                  <label class="filename-toggle">
                    <input type="checkbox" bind:checked={item.useStructuredFilename} on:change={() => validateItem(item)} />
                    <span>Diesen empfohlenen Originaldateinamen beim Upload verwenden</span>
                  </label>

                  <small class="structured-box__hint">
                    Das Muster ist eine Empfehlung. Wenn du es aktivierst, werden Ortsdaten und Vektoranalyse direkt auf dieser Grundlage nachgezogen.
                  </small>
                </div>

                <div class="ai-box">
                  <div class="ai-box__intro">
                    <strong>KI für fehlende Texte</strong>
                    <p>
                      Wenn EXIF oder IPTC noch nichts liefern, ergänzt Culoca aus Bild, Ort und Motiv automatisch Titel, Caption, Beschreibung und Keywords.
                    </p>
                  </div>
                  <button class="secondary-btn" type="button" disabled={item.isGeneratingAi} on:click={() => autofillMetadataWithAi(item)}>
                    {item.isGeneratingAi ? 'KI analysiert Bild...' : 'Fehlende Felder mit KI ausfüllen'}
                  </button>
                  {#if item.aiError}
                    <small class="place-search-status place-search-status--error">{item.aiError}</small>
                  {/if}
                </div>

                <label class="field" class:form-field--valid={item.title.length >= TITLE_MIN_LENGTH && item.title.length <= TITLE_MAX_LENGTH} class:form-field--invalid={!item.title.trim() || item.title.length < TITLE_MIN_LENGTH || item.title.length > TITLE_MAX_LENGTH}>
                  <span>Titel</span>
                  <input bind:value={item.title} maxlength={TITLE_MAX_LENGTH} on:input={() => validateItem(item)} />
                  <small>{item.title.length}/{TITLE_MAX_LENGTH} Zeichen, Zielbereich {TITLE_MIN_LENGTH}-{TITLE_MAX_LENGTH}</small>
                </label>

                <label class="field">
                  <span>Caption</span>
                  <textarea bind:value={item.caption} rows="3" maxlength="300" />
                  <small>Optionaler Bilduntertitel oder ergänzender Kurztext.</small>
                </label>

                <label class="field" class:form-field--valid={item.description.length >= DESCRIPTION_MIN_LENGTH && item.description.length <= DESCRIPTION_MAX_LENGTH} class:form-field--invalid={!item.description.trim() || item.description.length < DESCRIPTION_MIN_LENGTH || item.description.length > DESCRIPTION_MAX_LENGTH}>
                  <span>Beschreibung</span>
                  <textarea bind:value={item.description} rows="4" maxlength={DESCRIPTION_MAX_LENGTH} on:input={() => validateItem(item)} />
                  <small>{item.description.length}/{DESCRIPTION_MAX_LENGTH} Zeichen, Zielbereich {DESCRIPTION_MIN_LENGTH}-{DESCRIPTION_MAX_LENGTH}</small>
                </label>

                <label class="field" class:form-field--valid={hasUsableKeywordSet(item)} class:form-field--invalid={!item.keywords.trim() || !hasUsableKeywordSet(item)}>
                  <span>Keywords</span>
                  <textarea bind:value={item.keywords} rows="3" on:input={() => validateItem(item)} />
                  <small>{sanitizeKeywords(item.keywords, {
                    countryName: item.countryName,
                    stateName: item.stateName,
                    regionName: item.regionName,
                    districtName: item.districtName,
                    municipalityName: item.municipalityName,
                    localityName: item.localityName
                  }).length} Keywords, Zielbereich {KEYWORDS_MIN}-{KEYWORDS_MAX}. Davon mindestens {DESCRIPTIVE_KEYWORDS_MIN} visuelle Begriffe.</small>
                </label>

                <button class="secondary-btn advanced-toggle-btn" type="button" on:click={() => (item.showAdvancedFields = !item.showAdvancedFields)}>
                  {item.showAdvancedFields ? 'Erweiterte Felder schließen' : 'Erweiterte Felder'}
                </button>

                {#if item.showAdvancedFields}
                  <div class="advanced-box">
                  <div class="advanced-box__intro">
                    <strong>Erweiterte Inhaltsfelder</strong>
                    <p>Nutze diese Felder für Serien, weiterführende Links, Videos oder kuratierten Langtext.</p>
                  </div>

                    <label class="field">
                      <span>Group Slug</span>
                      <input bind:value={item.groupSlug} placeholder="optional, z. B. winterserie" />
                    </label>

                    <label class="field">
                      <span>Weblink</span>
                      <input bind:value={item.externalUrl} type="url" placeholder="https://..." />
                    </label>

                    <label class="field">
                      <span>Video-Link</span>
                      <input bind:value={item.videoUrl} type="url" placeholder="https://youtube.com/... oder Vimeo" />
                    </label>

                    <label class="field">
                      <span>Content / HTML</span>
                      <textarea bind:value={item.content} rows="5" placeholder="Optionaler Langtext oder HTML für die Detailseite" />
                    </label>
                  </div>
                {/if}

                {#if item.errors.length > 0}
                  <div class="review-callout">
                    <strong>Dieses Foto ist noch nicht vollständig.</strong>
                    <span>Du kannst es trotzdem hochladen. Es erscheint dann im Konto unter Daten prüfen.</span>
                  </div>
                  <ul class="error-list">
                    {#each item.errors as entry}
                      <li>{entry}</li>
                    {/each}
                  </ul>
                {/if}
              </div>
            </article>
          {/each}
        </div>
      {:else}
        <div class="state-card state-card--empty">
          <strong>Noch keine Dateien ausgewählt</strong>
          <p>Zieh Bilder in die Upload-Fläche oder starte oben mit dem Dateidialog. Danach prüfst du jedes Foto direkt auf Vollständigkeit.</p>
        </div>
      {/if}
    {/if}
  </div>
  <SiteFooter />
</div>

<style>
  .upload-page {
    background-color: var(--bg-primary);
  }

  .upload-shell {
    margin: 0 auto;
    padding: 2rem 1rem 4rem;
  }

  .page-header {
    display: grid;
    grid-template-columns: minmax(0, 1.55fr) minmax(320px, 0.95fr);
    gap: 1.25rem;
    align-items: stretch;
    margin-bottom: 1.25rem;
  }

  .eyebrow {
    margin: 0 0 0.35rem;
    color: var(--culoca-orange);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.8rem;
    font-weight: 700;
  }

  h1 {
    margin: 0;
    font-size: clamp(2rem, 4vw, 3.2rem);
    line-height: 1.02;
  }

  .hero-copy,
  .hero-panel__inner,
  .info-card,
  .stat-card,
  .location-bar,
  .state-card,
  .upload-card,
  .message,
  .toolbar {
    border: 1px solid var(--border-color);
    border-radius: 24px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 95%, white 5%), var(--bg-secondary));
  }

  .hero-copy {
    padding: 1.75rem;
    position: relative;
    overflow: hidden;
  }

  .hero-copy::after {
    content: '';
    position: absolute;
    right: -70px;
    bottom: -90px;
    width: 240px;
    height: 240px;
    border-radius: 999px;
    background: radial-gradient(circle, rgba(238, 114, 33, 0.2), transparent 68%);
    pointer-events: none;
  }

  .intro,
  .location-bar p,
  .type-hint,
  .info-card p,
  .stat-card p,
  .hero-note span,
  .toolbar-meta span,
  .advanced-box__intro p,
  .field small {
    color: var(--text-secondary);
  }

  .intro {
    max-width: 64ch;
    margin: 0.8rem 0 0;
  }

  .hero-notes,
  .info-grid,
  .stats-grid {
    display: grid;
    gap: 0.9rem;
  }

  .hero-notes {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin-top: 1.2rem;
  }

  .hero-note {
    display: grid;
    gap: 0.35rem;
    padding: 0.95rem 1rem;
    border-radius: 18px;
    background: color-mix(in srgb, var(--bg-primary) 84%, transparent);
    border: 1px solid color-mix(in srgb, var(--border-color) 70%, transparent);
  }

  .hero-panel__inner {
    height: 100%;
    padding: 1.35rem;
    display: grid;
    gap: 1rem;
    background:
      linear-gradient(135deg, rgba(238, 114, 33, 0.16), rgba(238, 114, 33, 0.03)),
      var(--bg-secondary);
  }

  .hero-panel__label,
  .info-card__eyebrow,
  .stat-card__label {
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.76rem;
    color: var(--culoca-orange);
    font-weight: 700;
  }

  .hero-actions {
    display: grid;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .hero-steps {
    display: grid;
    gap: 0.75rem;
  }

  .hero-steps div {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--text-secondary);
  }

  .hero-steps span {
    width: 1.8rem;
    height: 1.8rem;
    border-radius: 999px;
    display: inline-grid;
    place-items: center;
    background: rgba(238, 114, 33, 0.15);
    color: var(--culoca-orange);
    font-weight: 700;
  }

  .info-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin-bottom: 1rem;
  }

  .info-card {
    padding: 1.25rem 1.3rem;
  }

  .info-card h2,
  .stat-card strong {
    margin: 0.15rem 0 0.45rem;
  }

  .info-card ul {
    margin: 0.8rem 0 0;
    padding-left: 1.15rem;
    color: var(--text-secondary);
  }

  .info-card--warm {
    background:
      linear-gradient(135deg, rgba(238, 114, 33, 0.1), transparent 60%),
      var(--bg-secondary);
  }

  .info-card--accent {
    background:
      linear-gradient(135deg, rgba(180, 28, 58, 0.08), transparent 60%),
      var(--bg-secondary);
  }

  .primary-btn,
  .secondary-btn,
  .secondary-link,
  .remove-btn {
    border-radius: 999px;
    padding: 0.8rem 1rem;
    font-weight: 600;
    text-decoration: none;
    border: 1px solid var(--border-color);
    cursor: pointer;
    transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
  }

  .primary-btn:hover,
  .secondary-btn:hover,
  .secondary-link:hover,
  .remove-btn:hover {
    transform: translateY(-1px);
  }

  .primary-btn {
    background: var(--culoca-orange);
    color: #fff;
    border-color: var(--culoca-orange);
  }

  .secondary-btn,
  .secondary-link,
  .remove-btn {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .secondary-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .camera-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .dropzone {
    display: grid;
    place-items: center;
    gap: 0.45rem;
    text-align: center;
    min-height: 190px;
    margin-bottom: 1rem;
    padding: 1.4rem;
    border: 1px dashed var(--border-color);
    border-radius: 24px;
    background:
      linear-gradient(135deg, rgba(238, 114, 33, 0.06), transparent 48%),
      var(--bg-secondary);
    cursor: pointer;
  }

  .dropzone-icon {
    display: grid;
    place-items: center;
    width: 4.75rem;
    height: 4.75rem;
    border-radius: 1.5rem;
    margin-bottom: 0.2rem;
    background: linear-gradient(180deg, rgba(18, 24, 38, 0.72), rgba(18, 24, 38, 0.48));
    box-shadow: 0 18px 34px rgba(15, 23, 42, 0.18);
    color: #fff;
  }

  .dropzone-icon svg {
    width: 2.5rem;
    height: 2.5rem;
    display: block;
  }

  .dropzone--active {
    border-color: var(--culoca-orange);
  }

  .dropzone small {
    color: var(--text-muted);
  }

  .location-bar,
  .toolbar,
  .message {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: end;
    padding: 1rem 1.1rem;
    margin-bottom: 1rem;
  }

  .location-copy {
    max-width: 60ch;
  }

  .stats-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    margin-bottom: 1rem;
  }

  .stat-card {
    padding: 1rem 1.1rem;
  }

  .stat-card strong {
    display: block;
    font-size: clamp(1.7rem, 3vw, 2.3rem);
    line-height: 1;
  }

  .stat-card--ok {
    border-color: rgba(15, 118, 110, 0.35);
  }

  .stat-card--warn {
    border-color: rgba(181, 71, 8, 0.35);
  }

  .message--success {
    border-color: #0f766e;
  }

  .message--error {
    border-color: #b42318;
  }

  .toolbar-meta {
    display: grid;
    gap: 0.2rem;
  }

  .toolbar-actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .toolbar-meta strong {
    font-size: 1.05rem;
  }

  .card-grid {
    display: grid;
    gap: 1rem;
  }

  .upload-card {
    display: flex;
    align-items: stretch;
    overflow: visible;
    flex-wrap: wrap;
  }

  .upload-card--invalid {
    border-color: #f59e0b;
  }

  .preview-wrap {
    display: block;
    position: relative;
    flex: 0 0 min(42%, 540px);
    width: min(42%, 540px);
    align-self: stretch;
    min-height: clamp(420px, calc(100vh - 2rem), 920px);
    background: var(--bg-tertiary);
    padding: 1rem;
    border-right: 1px solid color-mix(in srgb, var(--border-color) 75%, transparent);
    border-top-left-radius: 24px;
    border-bottom-left-radius: 24px;
  }

  .preview-wrap__sticky {
    position: -webkit-sticky;
    position: sticky;
    top: 120px;
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: flex-start;
  }

  .preview-wrap img {
    width: 100%;
    max-width: min(100%, 760px);
    max-height: calc(100vh - 4rem);
    height: auto;
    object-fit: contain;
    display: block;
    margin: 0 auto;
    border-radius: 18px;
    background: color-mix(in srgb, var(--bg-primary) 88%, transparent);
    box-shadow: 0 18px 36px rgba(0, 0, 0, 0.12);
  }

  .card-body {
    flex: 1 1 0;
    min-width: 0;
    padding: 1.1rem;
    display: grid;
    gap: 0.95rem;
    align-content: start;
  }

  .card-head {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: start;
  }

  .card-head h2 {
    margin: 0;
    font-size: 1rem;
    line-height: 1.35;
  }

  .field {
    display: grid;
    gap: 0.35rem;
  }

  .field span {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .field input,
  .field select,
  .field textarea {
    width: 100%;
    border-radius: 12px;
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-primary);
    padding: 0.8rem 0.9rem;
    font: inherit;
  }

  .field small {
    font-size: 0.8rem;
  }

  .geo-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }

  .location-actions,
  .inline-actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .advanced-toggle-btn {
    justify-self: start;
  }

  .advanced-box {
    display: grid;
    gap: 0.8rem;
    padding: 1rem;
    border-radius: 16px;
    background: var(--bg-tertiary);
  }

  .structured-box {
    display: grid;
    gap: 0.85rem;
    padding: 1rem;
    border-radius: 16px;
    background: color-mix(in srgb, var(--bg-tertiary) 88%, var(--culoca-orange) 12%);
    border: 1px solid color-mix(in srgb, var(--border-color) 82%, var(--culoca-orange) 18%);
  }

  .structured-box__intro,
  .filename-toggle {
    display: grid;
    gap: 0.2rem;
  }

  .place-search-box {
    display: grid;
    gap: 0.55rem;
  }

  .place-search-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.75rem;
    align-items: end;
  }

  .place-search-row__button {
    white-space: nowrap;
  }

  .place-search-status {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .place-search-status--error {
    color: #991b1b;
  }

  .place-search-results {
    display: grid;
    gap: 0.5rem;
  }

  .place-search-result {
    display: grid;
    gap: 0.2rem;
    text-align: left;
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-primary);
    border-radius: 12px;
    padding: 0.8rem 0.9rem;
    cursor: pointer;
  }

  .structured-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
    align-items: start;
  }

  .structured-grid__motif {
    grid-column: 1 / -1;
  }

  .locality-review-note {
    color: #9a3412;
    font-weight: 600;
  }

  .locality-review-actions {
    grid-column: 1 / -1;
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .filename-preview {
    display: grid;
    gap: 0.35rem;
    padding: 0.85rem 0.95rem;
    border-radius: 14px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
  }

  .filename-preview__label {
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-secondary);
  }

  .filename-preview code {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace;
    color: var(--text-primary);
  }

  .filename-toggle {
    grid-template-columns: auto 1fr;
    align-items: start;
    column-gap: 0.75rem;
    font-size: 0.95rem;
  }

  .filename-toggle input {
    margin-top: 0.18rem;
  }

  .structured-box__hint {
    color: var(--text-secondary);
  }

  .ai-box {
    display: grid;
    gap: 0.75rem;
    padding: 1rem;
    border-radius: 16px;
    background: color-mix(in srgb, var(--bg-tertiary) 92%, #0f766e 8%);
    border: 1px solid color-mix(in srgb, var(--border-color) 84%, #0f766e 16%);
  }

  .ai-box__intro {
    display: grid;
    gap: 0.2rem;
  }

  .advanced-box__intro {
    display: grid;
    gap: 0.2rem;
  }

  .error-list {
    margin: 0;
    padding-left: 1.1rem;
    color: #b54708;
  }

  .review-callout {
    display: grid;
    gap: 0.2rem;
    padding: 0.85rem 0.95rem;
    border-radius: 14px;
    border: 1px solid rgba(181, 71, 8, 0.35);
    background: rgba(245, 158, 11, 0.08);
    color: #9a3412;
  }

  .state-card {
    padding: 1.35rem 1.4rem;
  }

  .state-card--empty {
    display: grid;
    gap: 0.4rem;
  }

  @media (max-width: 860px) {
    .page-header,
    .info-grid,
    .stats-grid,
    .hero-notes,
    .location-bar,
    .toolbar,
    .toolbar-actions,
    .card-head,
    .upload-card {
      grid-template-columns: 1fr;
      flex-direction: column;
      align-items: stretch;
    }

    .upload-card {
      display: grid;
      grid-template-columns: 1fr;
      align-items: stretch;
    }

    .preview-wrap {
      position: relative;
      flex: none;
      width: auto;
      max-height: none;
      min-height: auto;
      border-right: 0;
      border-bottom: 1px solid color-mix(in srgb, var(--border-color) 75%, transparent);
      border-top-left-radius: 24px;
      border-top-right-radius: 24px;
      border-bottom-left-radius: 0;
    }

    .preview-wrap__sticky {
      position: static;
      top: auto;
    }

    .preview-wrap img {
      max-height: 320px;
    }

    .geo-grid {
      grid-template-columns: 1fr;
    }

    .structured-grid {
      grid-template-columns: 1fr;
    }

    .place-search-row {
      grid-template-columns: 1fr;
    }

    .locality-review-actions {
      flex-direction: column;
    }
  }
</style>
