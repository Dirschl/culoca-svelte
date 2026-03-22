<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onDestroy, onMount, tick } from 'svelte';
  import SiteNav from '$lib/SiteNav.svelte';
  import SiteFooter from '$lib/SiteFooter.svelte';
  import { authFetch } from '$lib/authFetch';
  import { sessionStore } from '$lib/sessionStore';
  import { unifiedRightsStore } from '$lib/unifiedRightsStore';
  import { getSeoImageUrl } from '$lib/utils/seoImageUrl';
  import { extractPhotoMetadataFields } from '$lib/metadata/photoMetadata';

  export let data: any;

  type AspectRatioPreset =
    | 'original'
    | 'free'
    | '1:1'
    | '2:1'
    | '3:2'
    | '2:3'
    | '5:4'
    | '4:5'
    | '16:9'
    | '9:16'
    | 'open_graph';

  type ExportSettings = {
    sizeMode: 'full' | 'custom';
    width: number;
    height: number;
    aspectRatio: AspectRatioPreset;
    cropEnabled: boolean;
    format: 'jpg' | 'webp';
    quality: number | null;
    metadataMode: 'original' | 'culoca' | 'none';
    filenameMode: 'original' | 'web';
    remember: boolean;
  };

  type CropRect = { x: number; y: number; width: number; height: number };
  type PreviewMetrics = { left: number; top: number; width: number; height: number };
  type DragState =
    | {
        type: 'move' | 'resize-se' | 'resize-sw' | 'resize-ne' | 'resize-nw';
        startX: number;
        startY: number;
        startRect: CropRect;
      }
    | null;
  type MetadataPreview = {
    title: string | null;
    caption: string | null;
    description: string | null;
    keywords: string | null;
    creator: string | null;
    copyright: string | null;
    gps: string | null;
  };

  const SETTINGS_KEY = 'culoca-download-settings-v1';
  const DEFAULT_SETTINGS: ExportSettings = {
    sizeMode: 'full',
    width: Math.max(512, data?.image?.width || 2048),
    height: Math.max(512, data?.image?.height || 1365),
    aspectRatio: 'original',
    cropEnabled: false,
    format: 'jpg',
    quality: null,
    metadataMode: 'original',
    filenameMode: 'original',
    remember: true
  };

  let image = data?.image ?? null;
  let settings: ExportSettings = { ...DEFAULT_SETTINGS };
  let cropRect: CropRect = { x: 0.1, y: 0.1, width: 0.8, height: 0.8 };
  let currentUser: { id: string } | null = null;
  let isCreator = false;
  let canDownload = false;
  let estimateLabel = 'Dateigröße auf Anfrage berechnen';
  let estimatedFilename = '';
  let estimateError = '';
  let isEstimating = false;
  let estimateEnabled = false;
  let isDownloading = false;
  let previewImageUrl = '';
  let dragState: DragState = null;
  let previewBox: HTMLDivElement | null = null;
  let activeRatioInput: 'width' | 'height' = 'width';
  let estimateTimer: ReturnType<typeof setTimeout> | null = null;
  let estimateKey = '';
  let previewMetrics: PreviewMetrics = { left: 0, top: 0, width: 1, height: 1 };
  let handleWindowResize: (() => void) | null = null;
  let previewResizeObserver: ResizeObserver | null = null;
  let metadataPreviewKey = '';
  let metadataPreview: MetadataPreview = {
    title: null,
    caption: null,
    description: null,
    keywords: null,
    creator: null,
    copyright: null,
    gps: null
  };
  let storagePreviewLabel = '';
  let storagePreviewFilename = '';

  const aspectRatioMap: Record<Exclude<AspectRatioPreset, 'free' | 'original'>, number> = {
    '1:1': 1,
    '2:1': 2 / 1,
    '3:2': 3 / 2,
    '2:3': 2 / 3,
    '5:4': 5 / 4,
    '4:5': 4 / 5,
    '16:9': 16 / 9,
    '9:16': 9 / 16,
    open_graph: 1200 / 630
  };

  $: currentUser = $sessionStore.isAuthenticated && $sessionStore.userId ? { id: $sessionStore.userId } : null;
  $: isCreator = !!currentUser && (currentUser.id === image?.profile_id || currentUser.id === image?.user_id);
  $: canDownload = !!(isCreator || $unifiedRightsStore.rights?.download || $unifiedRightsStore.rights?.download_original);
  $: previewImageUrl =
    image?.slug && (image?.path_2048 || image?.path_512)
      ? getSeoImageUrl(image.slug, image.path_2048 || image.path_512, image?.path_2048 ? '2048' : '512')
      : '';
  $: previewMetrics = computePreviewMetrics();

  $: if (browser && image?.id && currentUser?.id) {
    unifiedRightsStore.loadRights(image.id);
  }

  $: if (settings.format === 'webp') {
    settings.metadataMode = 'none';
  }

  $: estimateKey = JSON.stringify({
    userId: currentUser?.id || null,
    canDownload,
    sizeMode: settings.sizeMode,
    width: settings.width,
    height: settings.height,
    aspectRatio: settings.aspectRatio,
    cropEnabled: settings.cropEnabled,
    cropRect,
    format: settings.format,
    quality: settings.quality,
    metadataMode: settings.metadataMode,
    filenameMode: settings.filenameMode
  });

  $: if (browser && image?.id && estimateKey && estimateEnabled) {
    queueEstimate();
  }

  $: metadataPreviewKey = JSON.stringify({
    format: settings.format,
    metadataMode: settings.metadataMode,
    title: image?.title || null,
    caption: image?.caption || null,
    description: image?.description || null,
    keywords: Array.isArray(image?.keywords) ? image.keywords.join(', ') : image?.keywords || null,
    creator: image?.profile?.full_name || image?.profile?.accountname || null,
    copyright: image?.exif_data?.Copyright || null,
    gpsLat: image?.lat || null,
    gpsLon: image?.lon || null
  });

  $: if (metadataPreviewKey) {
    metadataPreview = getCurrentMetadataPreview();
  }

  $: {
    const format = settings.format;
    const filenameMode = settings.filenameMode;
    const formatLabel = format === 'webp' ? 'WebP' : 'JPG';
    const nameLabel = filenameMode === 'original' ? 'Originaldateiname' : 'Culoca-Dateiname';
    const extension = format === 'webp' ? 'webp' : 'jpg';
    const originalName = image?.original_name?.trim();

    storagePreviewLabel = `${formatLabel} · ${nameLabel}`;

    if (filenameMode === 'original') {
      if (!originalName) {
        storagePreviewFilename = `bild.${extension}`;
      } else {
        const lastDotIndex = originalName.lastIndexOf('.');
        const baseWithoutExt = lastDotIndex > 0 ? originalName.slice(0, lastDotIndex) : originalName;
        storagePreviewFilename = `${baseWithoutExt || 'bild'}.${extension}`;
      }
    } else {
      const seed = image?.title || image?.caption || image?.original_name || 'bild';
      const slug = slugifyFilenamePart(seed);
      const shortId = slugifyFilenamePart(image?.short_id || image?.id?.slice(0, 10) || 'datei');
      storagePreviewFilename = `${slug}-culoca-${shortId}.${extension}`;
    }
  }

  function getAspectRatioValue() {
    if (settings.aspectRatio === 'free') return null;
    if (settings.aspectRatio === 'original') {
      const width = image?.width || DEFAULT_SETTINGS.width;
      const height = image?.height || DEFAULT_SETTINGS.height;
      return width / height;
    }
    return aspectRatioMap[settings.aspectRatio];
  }

  function centeredCropRect(ratio: number | null): CropRect {
    if (!ratio) {
      return { x: 0.1, y: 0.1, width: 0.8, height: 0.8 };
    }

    const imageRatio = (image?.width || 1) / (image?.height || 1);
    let width = 1;
    let height = 1;

    if (ratio >= imageRatio) {
      height = width * (imageRatio / ratio);
    } else {
      width = height * (ratio / imageRatio);
    }

    return {
      x: (1 - width) / 2,
      y: (1 - height) / 2,
      width,
      height
    };
  }

  function computePreviewMetrics(): PreviewMetrics {
    if (!previewBox) {
      return { left: 0, top: 0, width: 1, height: 1 };
    }

    const boxWidth = previewBox.clientWidth || 1;
    const boxHeight = previewBox.clientHeight || 1;
    const imageWidth = image?.width || boxWidth;
    const imageHeight = image?.height || boxHeight;
    const imageRatio = imageWidth / imageHeight;
    const boxRatio = boxWidth / boxHeight;

    if (imageRatio > boxRatio) {
      const width = boxWidth;
      const height = width / imageRatio;
      return {
        left: 0,
        top: (boxHeight - height) / 2,
        width,
        height
      };
    }

    const height = boxHeight;
    const width = height * imageRatio;
    return {
      left: (boxWidth - width) / 2,
      top: 0,
      width,
      height
    };
  }

  function updatePreviewMetrics() {
    previewMetrics = computePreviewMetrics();
  }

  function clampRect(rect: CropRect): CropRect {
    const minSize = 0.08;
    const width = Math.min(1, Math.max(minSize, rect.width));
    const height = Math.min(1, Math.max(minSize, rect.height));
    const x = Math.max(0, Math.min(1 - width, rect.x));
    const y = Math.max(0, Math.min(1 - height, rect.y));
    return { x, y, width, height };
  }

  function getCropStyle(rect: CropRect) {
    return [
      `left:${previewMetrics.left + rect.x * previewMetrics.width}px`,
      `top:${previewMetrics.top + rect.y * previewMetrics.height}px`,
      `width:${rect.width * previewMetrics.width}px`,
      `height:${rect.height * previewMetrics.height}px`
    ].join(';');
  }

  function syncDimensions(from: 'width' | 'height') {
    activeRatioInput = from;
    const ratio = getAspectRatioValue();
    if (!ratio || settings.aspectRatio === 'free') return;

    if (from === 'width') {
      settings.height = Math.max(32, Math.round(settings.width / ratio));
    } else {
      settings.width = Math.max(32, Math.round(settings.height * ratio));
    }
  }

  function handleAspectRatioChange() {
    if (settings.aspectRatio === 'free') {
      return;
    }

    const ratio = getAspectRatioValue();
    if (settings.aspectRatio === 'open_graph') {
      settings.width = 1200;
      settings.height = 630;
      settings.cropEnabled = true;
      if (ratio) {
        cropRect = centeredCropRect(ratio);
      }
      return;
    }

    const sourceWidth = image?.width || DEFAULT_SETTINGS.width;
    const sourceHeight = image?.height || DEFAULT_SETTINGS.height;
    const sourceRatio = sourceWidth / sourceHeight;

    if (!ratio) {
      settings.width = sourceWidth;
      settings.height = sourceHeight;
    } else if (ratio >= sourceRatio) {
      settings.width = sourceWidth;
      settings.height = Math.max(32, Math.round(sourceWidth / ratio));
    } else {
      settings.width = Math.max(32, Math.round(sourceHeight * ratio));
      settings.height = sourceHeight;
    }

    if (settings.aspectRatio !== 'original') {
      settings.cropEnabled = true;
    }

    if (settings.cropEnabled) {
      cropRect = centeredCropRect(ratio);
    }
  }

  async function handleCropToggle() {
    if (settings.cropEnabled) {
      cropRect = centeredCropRect(getAspectRatioValue());
      await tick();
      updatePreviewMetrics();
    }
  }

  function formatBytes(bytes: number) {
    if (!Number.isFinite(bytes) || bytes <= 0) return 'unbekannt';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function firstText(...values: Array<unknown>) {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) return fixEncoding(value.trim());
    }
    return null;
  }

  function fixEncoding(value: string | null | undefined) {
    if (!value) return null;
    try {
      if (/[ÃÂâ€žâ€œâ€“â€”]/.test(value)) {
        return decodeURIComponent(escape(value));
      }
    } catch {
      return value;
    }
    return value;
  }

  function slugifyFilenamePart(value: string | null | undefined) {
    const normalized = (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');

    return normalized || 'bild';
  }

  function findNestedMetadataText(source: unknown, matchers: Array<(key: string) => boolean>): string | null {
    const seen = new WeakSet<object>();

    function visit(value: unknown): string | null {
      if (!value || typeof value !== 'object') return null;
      if (seen.has(value as object)) return null;
      seen.add(value as object);

      if (Array.isArray(value)) {
        for (const entry of value) {
          if (typeof entry === 'string' && entry.trim()) return firstText(entry);
          const nested = visit(entry);
          if (nested) return nested;
        }
        return null;
      }

      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        const normalizedKey = key.toLowerCase();
        if (matchers.some((matcher) => matcher(normalizedKey))) {
          if (typeof entry === 'string' && entry.trim()) return firstText(entry);
          if (Array.isArray(entry)) {
            const joined = entry.filter((item) => typeof item === 'string' && item.trim()).join(', ');
            if (joined) return firstText(joined);
          }
        }

        const nested = visit(entry);
        if (nested) return nested;
      }

      return null;
    }

    return visit(source);
  }

  function getOriginalTitle(exif: Record<string, any>, iptc: Record<string, any>) {
    return firstText(
      exif['XMP:Title'],
      exif['XMP-dc:Title'],
      exif.title,
      exif.Title,
      exif['IPTC:ObjectName'],
      iptc.ObjectName,
      exif['IPTC:Headline'],
      iptc.Headline,
      findNestedMetadataText(exif, [
        (key) => key === 'title',
        (key) => key.endsWith(':title'),
        (key) => key === 'objectname',
        (key) => key.endsWith(':objectname')
      ])
    );
  }

  function getOriginalCaption(exif: Record<string, any>, iptc: Record<string, any>) {
    return firstText(
      exif['XMP:Headline'],
      exif['XMP-photoshop:Headline'],
      exif.caption,
      exif.Caption,
      exif['IPTC:Headline'],
      iptc.Headline,
      exif['IPTC:CaptionAbstract'],
      iptc.CaptionAbstract,
      findNestedMetadataText(exif, [
        (key) => key === 'headline',
        (key) => key.endsWith(':headline'),
        (key) => key === 'caption',
        (key) => key.endsWith(':caption'),
        (key) => key === 'captionabstract',
        (key) => key.endsWith(':captionabstract')
      ])
    );
  }

  function getOriginalDescription(exif: Record<string, any>, iptc: Record<string, any>) {
    return firstText(
      exif['XMP:Description'],
      exif['XMP-dc:Description'],
      exif.description,
      exif.Description,
      exif['IPTC:Description'],
      iptc.Description,
      exif['IPTC:CaptionAbstract'],
      iptc.CaptionAbstract,
      exif.ImageDescription,
      findNestedMetadataText(exif, [
        (key) => key === 'description',
        (key) => key.endsWith(':description'),
        (key) => key === 'captionabstract',
        (key) => key.endsWith(':captionabstract'),
        (key) => key === 'imagedescription',
        (key) => key.endsWith(':imagedescription')
      ])
    );
  }

  function getOriginalMetadataPreview(): MetadataPreview {
    const exif = (image?.exif_data || {}) as Record<string, any>;
    const extracted = extractPhotoMetadataFields(exif);
    const lat =
      typeof extracted.gps.lat === 'number'
        ? extracted.gps.lat
          : typeof image?.lat === 'number'
            ? image.lat
            : null;
    const lon =
      typeof extracted.gps.lon === 'number'
        ? extracted.gps.lon
          : typeof image?.lon === 'number'
            ? image.lon
            : null;

    return {
      title: extracted.title,
      caption: extracted.caption,
      description: extracted.description,
      keywords: extracted.keywords,
      creator: firstText(extracted.creator, image?.profile?.full_name, image?.profile?.accountname),
      copyright: firstText(extracted.copyright),
      gps:
        typeof lat === 'number' && typeof lon === 'number'
          ? `${lat.toFixed(6)}, ${lon.toFixed(6)}`
          : null
    };
  }

  function getCulocaMetadataPreview(): MetadataPreview {
    const original = getOriginalMetadataPreview();
    const creator = firstText(image?.profile?.full_name, image?.profile?.accountname, original.creator, 'Unbekannt');
    const copyright = original.copyright ? `${original.copyright} | culoca.com` : `${creator} | culoca.com`;

    return {
      title: firstText(image?.title),
      caption: firstText(image?.caption, original.caption),
      description: firstText(image?.description, image?.caption, original.description),
      keywords: firstText(Array.isArray(image?.keywords) ? image.keywords.join(', ') : image?.keywords),
      creator,
      copyright,
      gps:
        typeof image?.lat === 'number' && typeof image?.lon === 'number'
          ? `${image.lat.toFixed(6)}, ${image.lon.toFixed(6)}`
          : original.gps
    };
  }

  function getNoneMetadataPreview(): MetadataPreview {
    return {
      title: null,
      caption: null,
      description: null,
      keywords: null,
      creator: null,
      copyright: null,
      gps: null
    };
  }

  function getCurrentMetadataPreview(): MetadataPreview {
    if (settings.format !== 'jpg' || settings.metadataMode === 'none') {
      return getNoneMetadataPreview();
    }

    if (settings.metadataMode === 'culoca') {
      return getCulocaMetadataPreview();
    }

    return getOriginalMetadataPreview();
  }

  function buildRequestOptions() {
    return {
      sizeMode: settings.sizeMode,
      width: settings.sizeMode === 'custom' ? settings.width : null,
      height: settings.sizeMode === 'custom' ? settings.height : null,
      cropEnabled: settings.sizeMode === 'custom' ? settings.cropEnabled : false,
      crop: settings.sizeMode === 'custom' && settings.cropEnabled ? cropRect : null,
      format: settings.format,
      compression: settings.quality == null ? null : Math.max(1, Math.min(99, 100 - settings.quality)),
      metadataMode: settings.format === 'jpg' ? settings.metadataMode : 'none',
      filenameMode: settings.filenameMode
    };
  }

  async function fetchEstimate() {
    if (!browser || !image?.id || !currentUser) {
      estimateLabel = 'Dateigrößenvorschau nach Login verfügbar';
      estimateError = '';
      return;
    }

    if (!canDownload && !$unifiedRightsStore.loading) {
      estimateLabel = 'Keine Download-Rechte';
      estimateError = '';
      return;
    }

    isEstimating = true;
    estimateError = '';

    try {
      const response = await authFetch(`/api/download/${image.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mode: 'estimate',
          options: buildRequestOptions()
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(
          payload?.message ||
            payload?.error ||
            (response.status === 403 ? 'Keine Download-Rechte' : 'Vorschau fehlgeschlagen')
        );
      }

      const result = await response.json();
      estimateLabel = `${formatBytes(result.sizeBytes)} · ${result.width} × ${result.height}`;
      estimatedFilename = result.filename || '';
    } catch (err) {
      estimateLabel = 'Dateigröße nicht verfügbar';
      estimatedFilename = '';
      estimateError = err instanceof Error ? err.message : 'Vorschau fehlgeschlagen';
    } finally {
      isEstimating = false;
    }
  }

  function queueEstimate() {
    if (!browser) return;
    if (estimateTimer) clearTimeout(estimateTimer);
    estimateTimer = setTimeout(() => {
      fetchEstimate();
    }, 350);
  }

  function requestEstimate() {
    estimateEnabled = true;
    estimateLabel = 'Dateigröße wird berechnet...';
    queueEstimate();
  }

  function readRememberedSettings() {
    if (!browser) return;
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as Partial<ExportSettings>;
      settings = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        width: Math.max(32, Number(parsed.width || DEFAULT_SETTINGS.width)),
        height: Math.max(32, Number(parsed.height || DEFAULT_SETTINGS.height)),
        quality:
          parsed.quality == null
            ? null
            : Math.max(25, Math.min(85, Number(parsed.quality))),
        remember: true
      };
    } catch {
      localStorage.removeItem(SETTINGS_KEY);
    }
  }

  function persistRememberedSettings() {
    if (!browser) return;
    if (!settings.remember) {
      localStorage.removeItem(SETTINGS_KEY);
      return;
    }

    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        ...settings,
        metadataMode: settings.format === 'jpg' ? settings.metadataMode : 'none'
      })
    );
  }

  function pointerToNormalized(event: PointerEvent) {
    if (!previewBox) return { x: 0, y: 0 };
    const bounds = previewBox.getBoundingClientRect();
    const safeWidth = Math.max(previewMetrics.width, 1);
    const safeHeight = Math.max(previewMetrics.height, 1);
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left - previewMetrics.left) / safeWidth)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top - previewMetrics.top) / safeHeight))
    };
  }

  function startCropDrag(type: NonNullable<DragState>['type'], event: PointerEvent) {
    if (!settings.cropEnabled) return;
    event.preventDefault();
    const position = pointerToNormalized(event);
    dragState = {
      type,
      startX: position.x,
      startY: position.y,
      startRect: { ...cropRect }
    };
  }

  function handlePointerMove(event: PointerEvent) {
    if (!dragState) return;
    const position = pointerToNormalized(event);
    const dx = position.x - dragState.startX;
    const dy = position.y - dragState.startY;
    const ratio = getAspectRatioValue();

    if (dragState.type === 'move') {
      cropRect = clampRect({
        ...dragState.startRect,
        x: dragState.startRect.x + dx,
        y: dragState.startRect.y + dy
      });
      return;
    }

    if (!ratio || settings.aspectRatio === 'free') {
      let left = dragState.startRect.x;
      let top = dragState.startRect.y;
      let right = dragState.startRect.x + dragState.startRect.width;
      let bottom = dragState.startRect.y + dragState.startRect.height;

      if (dragState.type.includes('w')) left += dx;
      if (dragState.type.includes('e')) right += dx;
      if (dragState.type.includes('n')) top += dy;
      if (dragState.type.includes('s')) bottom += dy;

      cropRect = clampRect({
        x: left,
        y: top,
        width: right - left,
        height: bottom - top
      });
      return;
    }

    const imageRatio = (image?.width || 1) / (image?.height || 1);
    const signX = dragState.type.includes('w') ? -1 : 1;
    const signY = dragState.type.includes('n') ? -1 : 1;
    const widthFromX = dragState.startRect.width + dx * signX;
    const heightFromY = dragState.startRect.height + dy * signY;
    const widthFromHeight = heightFromY * (ratio / imageRatio);
    const dominantWidth = Math.abs(dx) >= Math.abs(dy) ? widthFromX : widthFromHeight;
    const anchorRight = dragState.startRect.x + dragState.startRect.width;
    const anchorBottom = dragState.startRect.y + dragState.startRect.height;
    const maxWidthByHeight = ratio / imageRatio;

    let maxWidth = 1;
    if (dragState.type === 'resize-se') {
      maxWidth = Math.min(1 - dragState.startRect.x, (1 - dragState.startRect.y) * maxWidthByHeight);
    } else if (dragState.type === 'resize-sw') {
      maxWidth = Math.min(anchorRight, (1 - dragState.startRect.y) * maxWidthByHeight);
    } else if (dragState.type === 'resize-ne') {
      maxWidth = Math.min(1 - dragState.startRect.x, anchorBottom * maxWidthByHeight);
    } else {
      maxWidth = Math.min(anchorRight, anchorBottom * maxWidthByHeight);
    }

    const nextWidth = Math.max(0.08, Math.min(maxWidth, dominantWidth));
    const nextHeight = Math.max(0.08, nextWidth * (imageRatio / ratio));

    let nextRect: CropRect;
    if (dragState.type === 'resize-se') {
      nextRect = { ...dragState.startRect, width: nextWidth, height: nextHeight };
    } else if (dragState.type === 'resize-sw') {
      nextRect = {
        x: anchorRight - nextWidth,
        y: dragState.startRect.y,
        width: nextWidth,
        height: nextHeight
      };
    } else if (dragState.type === 'resize-ne') {
      nextRect = {
        x: dragState.startRect.x,
        y: anchorBottom - nextHeight,
        width: nextWidth,
        height: nextHeight
      };
    } else {
      nextRect = {
        x: anchorRight - nextWidth,
        y: anchorBottom - nextHeight,
        width: nextWidth,
        height: nextHeight
      };
    }

    cropRect = clampRect(nextRect);
  }

  function handlePointerUp() {
    dragState = null;
  }

  async function startDownload() {
    if (!image?.id || !currentUser) {
      alert('Bitte zuerst einloggen.');
      return;
    }

    if (!canDownload) {
      alert('Kein Download-Zugriff auf diese Datei.');
      return;
    }

    isDownloading = true;

    try {
      const response = await authFetch(`/api/download/${image.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mode: 'download',
          options: buildRequestOptions()
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message =
          payload?.message ||
          payload?.error ||
          (response.status === 401
            ? 'Bitte zuerst einloggen.'
            : response.status === 403
              ? 'Kein Zugriff auf diese Datei.'
              : 'Download fehlgeschlagen.');
        throw new Error(message);
      }

      const disposition = response.headers.get('content-disposition') || '';
      const filenameMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      const filename = filenameMatch ? decodeURIComponent(filenameMatch[1]) : 'download.jpg';
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Download fehlgeschlagen.');
    } finally {
      isDownloading = false;
    }
  }

  function goBack() {
    const returnTo = $page.url.searchParams.get('returnTo');
    goto(returnTo || (image?.slug ? `/item/${image.slug}` : '/'));
  }

  function handleCompressionToggle(event: Event) {
    const checked = (event.currentTarget as HTMLInputElement).checked;
    settings.quality = checked ? null : 75;
  }

  function touchSettings() {
    settings = { ...settings };
  }

  function setFormat(format: ExportSettings['format']) {
    settings = { ...settings, format };
  }

  function setFilenameMode(filenameMode: ExportSettings['filenameMode']) {
    settings = { ...settings, filenameMode };
  }

  function getPreviewFilename() {
    const extension = settings.format === 'webp' ? 'webp' : 'jpg';
    const originalName = image?.original_name?.trim();

    if (settings.filenameMode === 'original') {
      if (!originalName) return `bild.${extension}`;
      const baseWithoutExt = originalName.replace(/\.[a-z0-9]+$/i, '') || 'bild';
      return `${baseWithoutExt}.${extension}`;
    }

    const seed = image?.title || image?.caption || image?.original_name || 'bild';
    const slug = slugifyFilenamePart(seed);
    const shortId = slugifyFilenamePart(image?.short_id || image?.id?.slice(0, 10) || 'datei');
    return `${slug}-culoca-${shortId}.${extension}`;
  }

  function getStorageModeLabel() {
    const formatLabel = settings.format === 'webp' ? 'WebP' : 'JPG';
    const nameLabel = settings.filenameMode === 'original' ? 'Originaldateiname' : 'Culoca-Dateiname';
    return `${formatLabel} · ${nameLabel}`;
  }

  function getPreviewAspectRatio() {
    if (settings.sizeMode === 'custom') {
      if (settings.cropEnabled) {
        const ratio = getAspectRatioValue();
        if (ratio) return ratio;
      }

      if (settings.width > 0 && settings.height > 0) {
        return settings.width / settings.height;
      }
    }

    return (image?.width || 4) / (image?.height || 3);
  }

  onMount(() => {
    readRememberedSettings();
    cropRect = centeredCropRect(getAspectRatioValue());
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    handleWindowResize = () => {
      updatePreviewMetrics();
    };
    window.addEventListener('resize', handleWindowResize);
    previewResizeObserver = new ResizeObserver(() => {
      updatePreviewMetrics();
    });
    if (previewBox) {
      previewResizeObserver.observe(previewBox);
    }
    tick().then(() => {
      updatePreviewMetrics();
    });
  });

  onDestroy(() => {
    unifiedRightsStore.reset();
    if (browser) {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      if (handleWindowResize) window.removeEventListener('resize', handleWindowResize);
    }
    previewResizeObserver?.disconnect();
    if (estimateTimer) clearTimeout(estimateTimer);
  });

  $: persistRememberedSettings();
</script>

<svelte:head>
  <title>{image?.title || image?.original_name || 'Download'} | Culoca</title>
</svelte:head>

<SiteNav />

<main class="download-page">
  <div class="download-shell">
    <div class="download-header">
      <button class="back-link" type="button" on:click={goBack}>Zurück zum Item</button>
      <h1>Download</h1>
      <p>Volle Auflösung und Originaldateiname sind vorausgewählt. Bei Bedarf passen wir Größe, Format, Zuschnitt und Metadaten vor dem Export an.</p>
    </div>

    <div class="download-grid">
      <section class="preview-card">
        <div class="preview-media" bind:this={previewBox} style={`aspect-ratio:${getPreviewAspectRatio()};`}>
          {#if previewImageUrl}
            <img
              src={previewImageUrl}
              alt={image?.title || image?.original_name || 'Bild'}
              draggable="false"
              on:load={updatePreviewMetrics}
            />
          {/if}

          {#if settings.sizeMode === 'custom' && settings.cropEnabled}
            <div
              class="crop-rect"
              style={getCropStyle(cropRect)}
              on:pointerdown={(event) => startCropDrag('move', event)}
            >
              <span class="crop-label">Zuschnitt</span>
              <button type="button" class="crop-handle nw" on:pointerdown|stopPropagation={(event) => startCropDrag('resize-nw', event)} aria-label="Zuschnitt oben links anpassen"></button>
              <button type="button" class="crop-handle ne" on:pointerdown|stopPropagation={(event) => startCropDrag('resize-ne', event)} aria-label="Zuschnitt oben rechts anpassen"></button>
              <button type="button" class="crop-handle sw" on:pointerdown|stopPropagation={(event) => startCropDrag('resize-sw', event)} aria-label="Zuschnitt unten links anpassen"></button>
              <button type="button" class="crop-handle se" on:pointerdown|stopPropagation={(event) => startCropDrag('resize-se', event)} aria-label="Zuschnitt unten rechts anpassen"></button>
            </div>
          {/if}
        </div>

        <div class="preview-meta">
          <strong>{image?.title || image?.original_name || 'Bild'}</strong>
          <span>{estimateLabel}</span>
          {#if !estimateEnabled}
            <button class="estimate-button" type="button" on:click={requestEstimate}>
              Dateigröße berechnen
            </button>
          {/if}
          {#if isEstimating}
            <span>Vorschau wird aktualisiert...</span>
          {/if}
          {#if estimateError}
            <span class="error-text">{estimateError}</span>
          {/if}
        </div>
      </section>

      <section class="settings-card">
        <div class="group">
          <h2>Bildgröße</h2>
          <div class="radio-row">
            <label><input type="radio" bind:group={settings.sizeMode} value="full" /> Volle Auflösung</label>
            <label><input type="radio" bind:group={settings.sizeMode} value="custom" /> Eigene Auflösung</label>
          </div>

          {#if settings.sizeMode === 'custom'}
            <div class="dimension-grid">
              <label>
                Breite
                <input type="number" min="32" step="1" bind:value={settings.width} on:input={() => syncDimensions('width')} />
              </label>
              <label>
                Höhe
                <input type="number" min="32" step="1" bind:value={settings.height} on:input={() => syncDimensions('height')} />
              </label>
            </div>

            <label class="field">
              Seitenverhältnis
              <select bind:value={settings.aspectRatio} on:change={handleAspectRatioChange}>
                <option value="original">Original</option>
                <option value="free">Frei</option>
                <option value="1:1">1:1</option>
                <option value="2:1">2:1</option>
                <option value="3:2">3:2</option>
                <option value="2:3">2:3</option>
                <option value="5:4">5:4</option>
                <option value="4:5">4:5</option>
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
                <option value="open_graph">OpenGraph 1200px × 630px</option>
              </select>
            </label>

            <label class="checkbox">
              <input type="checkbox" bind:checked={settings.cropEnabled} on:change={handleCropToggle} />
              Zuschnitt aktivieren
            </label>
          {/if}
        </div>

        <div class="group">
          <h2>Datenformat</h2>
          <div class="radio-row">
            <label><input type="radio" checked={settings.format === 'jpg'} on:change={() => setFormat('jpg')} /> JPG</label>
            <label><input type="radio" checked={settings.format === 'webp'} on:change={() => setFormat('webp')} /> WebP</label>
          </div>
        </div>

        <div class="group">
          <h2>Qualität</h2>
            <label class="checkbox">
              <input
                type="checkbox"
                checked={settings.quality === null}
                on:change={handleCompressionToggle}
              />
              Maximale Qualität
            </label>

          {#if settings.quality !== null}
            <label class="field">
              Qualität: {settings.quality}%
              <input type="range" min="25" max="85" step="1" bind:value={settings.quality} />
            </label>
          {/if}
        </div>

        {#if settings.format === 'jpg'}
          <div class="group">
            <h2>Metadaten</h2>
            <div class="radio-stack">
              <label><input type="radio" bind:group={settings.metadataMode} value="original" /> Original EXIF / ICMP / GPS</label>
              <label><input type="radio" bind:group={settings.metadataMode} value="culoca" /> Culoca EXIF / ICMP / GPS</label>
              <label><input type="radio" bind:group={settings.metadataMode} value="none" /> Ohne EXIF / ICMP / GPS</label>
            </div>
          </div>
        {/if}

        <div class="group">
          <h2>Speicherformat</h2>
          <div class="radio-stack">
            <label><input type="radio" checked={settings.filenameMode === 'original'} on:change={() => setFilenameMode('original')} /> Originaldateiname</label>
            <label><input type="radio" checked={settings.filenameMode === 'web'} on:change={() => setFilenameMode('web')} /> Webtaugliche Dateibenennung + culoca-{image?.short_id || image?.id?.slice(0, 10)}</label>
          </div>
        </div>

        <label class="checkbox remember-box">
          <input type="checkbox" bind:checked={settings.remember} />
          Einstellungen merken
        </label>

        <div class="actions">
          <button class="secondary-btn" type="button" on:click={goBack}>Abbrechen</button>
          <button class="primary-btn" type="button" on:click={startDownload} disabled={isDownloading || (!!currentUser && !canDownload && !$unifiedRightsStore.loading)}>
            {#if !currentUser}
              Einloggen zum Download
            {:else if isDownloading}
              Download läuft...
            {:else}
              Download starten
            {/if}
          </button>
        </div>
      </section>
    </div>

    <section class="metadata-section">
      <div class="storage-preview-card">
        <h2>Speicherformat</h2>
        <div class="storage-preview-mode">{storagePreviewLabel}</div>
        <div class="storage-preview-filename">{storagePreviewFilename}</div>
      </div>

      <h2>Metadaten Vorschau</h2>
      <div class="metadata-preview-card">
        {#if settings.format !== 'jpg'}
          <div class="metadata-line">
            <span class="metadata-label">Metadaten</span>
            <span class="metadata-value">Bei WebP werden aktuell keine EXIF-, IPTC- oder GPS-Daten eingebettet.</span>
          </div>
        {:else}
          <div class="metadata-line">
            <span class="metadata-label">Titel</span>
            <span class="metadata-value">{metadataPreview.title || 'Leer'}</span>
          </div>
          <div class="metadata-line">
            <span class="metadata-label">Caption</span>
            <span class="metadata-value">{metadataPreview.caption || 'Leer'}</span>
          </div>
          <div class="metadata-line">
            <span class="metadata-label">Beschreibung</span>
            <span class="metadata-value">{metadataPreview.description || 'Leer'}</span>
          </div>
          <div class="metadata-line">
            <span class="metadata-label">Keywords</span>
            <span class="metadata-value">{metadataPreview.keywords || 'Leer'}</span>
          </div>
          <div class="metadata-line">
            <span class="metadata-label">Ersteller</span>
            <span class="metadata-value">{metadataPreview.creator || 'Leer'}</span>
          </div>
          <div class="metadata-line">
            <span class="metadata-label">Copyright</span>
            <span class="metadata-value">{metadataPreview.copyright || 'Leer'}</span>
          </div>
          <div class="metadata-line">
            <span class="metadata-label">GPS</span>
            <span class="metadata-value">{metadataPreview.gps || 'Leer'}</span>
          </div>
        {/if}
      </div>

      {#if settings.format === 'jpg'}
        {#if settings.metadataMode === 'original'}
          <p class="metadata-note">Original behaelt die eingebetteten EXIF-, IPTC- und GPS-Daten des Originals unveraendert bei.</p>
        {:else if settings.metadataMode === 'culoca'}
          <p class="metadata-note">Culoca ueberschreibt nur redaktionelle Felder wie Titel, Beschreibung, Ersteller und Copyright, technische Kameradaten bleiben erhalten.</p>
        {:else}
          <p class="metadata-note">Ohne EXIF / IPTC / GPS entfernt alle eingebetteten Metadaten aus der Exportdatei.</p>
        {/if}
      {/if}
    </section>
  </div>
</main>

<SiteFooter />

<style>
  .download-page {
    --download-bg-top: rgba(255, 249, 243, 0.9);
    --download-bg-bottom: rgba(247, 243, 238, 1);
    --download-accent-glow: rgba(238, 114, 33, 0.16);
    --download-text: var(--text-primary, #221b16);
    --download-text-soft: var(--text-secondary, #5f5349);
    --download-border: rgba(116, 97, 79, 0.18);
    --download-border-soft: rgba(116, 97, 79, 0.14);
    --download-surface: rgba(255, 255, 255, 0.82);
    --download-surface-soft: rgba(255, 255, 255, 0.72);
    --download-input: rgba(255, 255, 255, 0.94);
    --download-preview-top: rgba(237, 232, 227, 1);
    --download-preview-bottom: rgba(222, 214, 207, 1);
    --download-shadow: 0 28px 80px rgba(65, 39, 17, 0.08);
    --download-secondary-btn: rgba(255, 255, 255, 0.9);
    --download-error: #a2331a;
    min-height: 100vh;
    background:
      radial-gradient(circle at top left, var(--download-accent-glow), transparent 34%),
      linear-gradient(180deg, var(--download-bg-top), var(--download-bg-bottom));
    color: var(--download-text);
  }

  :global(html[data-theme='dark']) .download-page,
  :global(body[data-theme='dark']) .download-page {
    --download-bg-top: rgba(24, 24, 27, 0.96);
    --download-bg-bottom: rgba(10, 10, 12, 1);
    --download-accent-glow: rgba(238, 114, 33, 0.22);
    --download-text: #f4eee8;
    --download-text-soft: #c7b8ab;
    --download-border: rgba(255, 255, 255, 0.14);
    --download-border-soft: rgba(255, 255, 255, 0.1);
    --download-surface: rgba(30, 24, 20, 0.86);
    --download-surface-soft: rgba(42, 34, 29, 0.8);
    --download-input: rgba(27, 22, 19, 0.95);
    --download-preview-top: rgba(40, 34, 31, 1);
    --download-preview-bottom: rgba(24, 20, 18, 1);
    --download-shadow: 0 28px 80px rgba(0, 0, 0, 0.35);
    --download-secondary-btn: rgba(35, 29, 25, 0.94);
    --download-error: #ff8e72;
  }

  .download-shell {
    width: min(1180px, calc(100% - 2rem));
    margin: 0 auto;
    padding: 7rem 0 4rem;
  }

  .download-header {
    max-width: 760px;
    margin-bottom: 2rem;
  }

  .download-header h1 {
    margin: 0.5rem 0 0.75rem;
    font-size: clamp(2.1rem, 4vw, 3.6rem);
    line-height: 0.98;
  }

  .download-header p {
    margin: 0;
    color: var(--download-text-soft);
    font-size: 1.03rem;
    line-height: 1.6;
  }

  .back-link {
    border: 0;
    background: transparent;
    padding: 0;
    color: #b85d19;
    font: inherit;
    cursor: pointer;
  }

  .download-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
    gap: 1.5rem;
    align-items: start;
  }

  .preview-card,
  .settings-card {
    border-radius: 24px;
    border: 1px solid var(--download-border);
    background: var(--download-surface);
    backdrop-filter: blur(14px);
    box-shadow: var(--download-shadow);
  }

  .preview-card {
    padding: 1rem;
  }

  .preview-media {
    position: relative;
    overflow: hidden;
    border-radius: 0;
    background: linear-gradient(180deg, var(--download-preview-top), var(--download-preview-bottom));
    aspect-ratio: 4 / 3;
    user-select: none;
  }

  .preview-media img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }

  .crop-rect {
    position: absolute;
    border: 2px solid #ee7221;
    box-shadow: 0 0 0 9999px rgba(34, 27, 22, 0.38);
    cursor: move;
    touch-action: none;
  }

  .crop-label {
    position: absolute;
    top: 0.45rem;
    left: 0.55rem;
    padding: 0.18rem 0.45rem;
    border-radius: 999px;
    background: rgba(238, 114, 33, 0.92);
    color: #fff;
    font-size: 0.78rem;
    font-weight: 700;
    pointer-events: none;
  }

  .crop-handle {
    position: absolute;
    width: 14px;
    height: 14px;
    border: 0;
    border-radius: 999px;
    background: #fff;
    box-shadow: 0 0 0 2px #ee7221;
    padding: 0;
    cursor: nwse-resize;
  }

  .crop-handle.nw { top: -7px; left: -7px; }
  .crop-handle.ne { top: -7px; right: -7px; cursor: nesw-resize; }
  .crop-handle.sw { bottom: -7px; left: -7px; cursor: nesw-resize; }
  .crop-handle.se { right: -7px; bottom: -7px; }

  .preview-meta {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 1rem 0.25rem 0.15rem;
  }

  .estimate-button {
    align-self: flex-start;
    margin-top: 0.25rem;
    border: 1px solid var(--border-color, #d6d3d1);
    background: var(--bg-secondary, #f6f3ef);
    color: var(--text-primary, #2c241d);
    border-radius: 999px;
    padding: 0.45rem 0.9rem;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .estimate-button:hover {
    background: var(--bg-tertiary, #ebe5de);
  }

  .preview-meta strong {
    font-size: 1.02rem;
  }

  .preview-meta span {
    color: var(--download-text-soft);
  }

  .settings-card {
    padding: 1.2rem;
  }

  .group + .group {
    margin-top: 1.25rem;
    padding-top: 1.1rem;
    border-top: 1px solid var(--download-border-soft);
  }

  .group h2 {
    margin: 0 0 0.8rem;
    font-size: 1rem;
  }

  .metadata-section {
    margin-top: 1.5rem;
    border-radius: 24px;
    border: 1px solid var(--download-border);
    background: var(--download-surface);
    backdrop-filter: blur(14px);
    box-shadow: var(--download-shadow);
    padding: 1.2rem;
  }

  .metadata-section h2 {
    margin: 0 0 0.9rem;
    font-size: 1rem;
  }

  .storage-preview-card {
    border-radius: 14px;
    border: 1px solid var(--download-border);
    background: var(--download-surface-soft);
    padding: 0.9rem;
    margin-bottom: 1rem;
  }

  .storage-preview-card h2 {
    margin: 0 0 0.35rem;
  }

  .storage-preview-mode {
    color: var(--download-text-soft);
    font-size: 0.9rem;
    margin-bottom: 0.45rem;
  }

  .storage-preview-filename {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
    line-height: 1.5;
    word-break: break-word;
  }

  .radio-row,
  .radio-stack,
  .dimension-grid,
  .actions {
    display: grid;
    gap: 0.75rem;
  }

  .radio-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dimension-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin-bottom: 0.75rem;
  }

  .field,
  .checkbox,
  .radio-row label,
  .radio-stack label {
    display: flex;
    gap: 0.45rem;
    font-size: 0.95rem;
  }

  .field {
    flex-direction: column;
  }

  .radio-row label,
  .radio-stack label,
  .checkbox {
    flex-direction: row;
    align-items: flex-start;
  }

  .checkbox {
    align-items: center;
  }

  input[type='number'],
  select,
  input[type='range'] {
    width: 100%;
  }

  input[type='number'],
  select {
    border-radius: 12px;
    border: 1px solid var(--download-border);
    background: var(--download-input);
    padding: 0.75rem 0.9rem;
    font: inherit;
    color: inherit;
  }

  input[type='range'] {
    accent-color: #ee7221;
  }

  .remember-box {
    margin-top: 1.4rem;
    padding-top: 1rem;
    border-top: 1px solid var(--download-border-soft);
  }

  .metadata-preview-card {
    display: grid;
    gap: 0.6rem;
    border-radius: 14px;
    border: 1px solid var(--download-border);
    background: var(--download-surface-soft);
    padding: 0.9rem;
  }

  .metadata-line {
    display: grid;
    grid-template-columns: 112px minmax(0, 1fr);
    gap: 0.75rem;
    align-items: start;
  }

  .metadata-label {
    color: var(--download-text-soft);
    font-size: 0.84rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .metadata-value {
    word-break: break-word;
    line-height: 1.45;
  }

  .metadata-note {
    margin: 0.8rem 0 0;
    color: var(--download-text-soft);
    font-size: 0.92rem;
    line-height: 1.5;
  }

  .actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin-top: 1.35rem;
  }

  .primary-btn,
  .secondary-btn {
    border-radius: 14px;
    border: 1px solid transparent;
    padding: 0.9rem 1rem;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
  }

  .primary-btn {
    background: linear-gradient(135deg, #ee7221, #c95510);
    color: #fff;
    box-shadow: 0 12px 30px rgba(201, 85, 16, 0.26);
  }

  .secondary-btn {
    background: var(--download-secondary-btn);
    border-color: var(--download-border);
    color: inherit;
  }

  .primary-btn:hover,
  .secondary-btn:hover {
    transform: translateY(-1px);
  }

  .primary-btn:disabled,
  .secondary-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .error-text {
    color: var(--download-error) !important;
  }

  @media (max-width: 900px) {
    .download-grid {
      grid-template-columns: 1fr;
    }

    .download-shell {
      width: min(100% - 1rem, 1180px);
      padding-top: 6rem;
    }
  }

  @media (max-width: 640px) {
    .radio-row,
    .dimension-grid,
    .actions {
      grid-template-columns: 1fr;
    }

    .settings-card,
    .preview-card {
      padding: 1rem;
      border-radius: 18px;
    }

    .metadata-line {
      grid-template-columns: 1fr;
      gap: 0.25rem;
    }
  }
</style>
