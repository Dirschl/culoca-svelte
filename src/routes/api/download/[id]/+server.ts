import { error, json, type RequestHandler } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import {
  buildDownloadFilename,
  canBypassImageProcessing,
  canRewriteMetadataWithoutSharp,
  fetchOriginalItemBuffer,
  normalizeDownloadExportOptions,
  renderDownloadExport,
  rewriteJpegMetadataWithoutSharp,
  type DownloadExportOptions
} from '$lib/server/downloadExport';

type DownloadItemRecord = {
  id: string;
  profile_id: string | null;
  user_id: string | null;
  short_id: string | null;
  width: number | null;
  height: number | null;
  original_url: string | null;
  path_2048: string | null;
  path_512: string | null;
  original_name: string | null;
  title: string | null;
  caption: string | null;
  description: string | null;
  keywords: string[] | null;
  exif_data: Record<string, unknown> | null;
  lat: number | null;
  lon: number | null;
  profile?: {
    full_name?: string | null;
    accountname?: string | null;
  } | null;
};

function createAuthedSupabase(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw error(401, 'Nicht angemeldet. Bitte zuerst einloggen.');
  }

  const supabaseUrl =
    process.env.PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    import.meta.env.PUBLIC_SUPABASE_URL ||
    import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.PUBLIC_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw error(500, 'Server-Konfigurationsfehler');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: authHeader
      }
    }
  });
}

async function getAuthenticatedUser(supabase: ReturnType<typeof createAuthedSupabase>) {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw error(401, 'Nicht angemeldet. Bitte zuerst einloggen.');
  }

  return user;
}

async function fetchDownloadSourceBuffer(
  item: Pick<DownloadItemRecord, 'id' | 'original_url' | 'path_2048' | 'path_512'>,
  options: DownloadExportOptions,
  mode: 'estimate' | 'download'
) {
  const strictOriginalSource = mode === 'download' && options.metadataMode === 'original' && options.format === 'jpg';

  try {
    return await fetchOriginalItemBuffer(item, {
      allowPublicFallback: !strictOriginalSource
    });
  } catch (sourceError) {
    if (!strictOriginalSource) {
      throw sourceError;
    }

    console.warn('Strict original download source unavailable, retrying with public variant fallback:', sourceError);
    return fetchOriginalItemBuffer(item, { allowPublicFallback: true });
  }
}

async function loadDownloadItem(supabase: ReturnType<typeof createAuthedSupabase>, itemId: string) {
  const { data: item, error: itemError } = await supabase
    .from('items')
    .select(
      `
        id,
        profile_id,
        user_id,
        short_id,
        width,
        height,
        original_url,
        path_2048,
        path_512,
        original_name,
        title,
        caption,
        description,
        keywords,
        exif_data,
        lat,
        lon,
        profile:profile_id (
          full_name,
          accountname
        )
      `
    )
    .eq('id', itemId)
    .maybeSingle<DownloadItemRecord>();

  if (itemError || !item) {
    throw error(404, 'Bild nicht gefunden');
  }

  return item;
}

async function assertDownloadRights(
  supabase: ReturnType<typeof createAuthedSupabase>,
  itemId: string,
  userId: string
) {
  const { data: unifiedRights, error: rightsError } = await supabase.rpc('get_unified_item_rights', {
    p_item_id: itemId,
    p_user_id: userId
  });

  if (rightsError) {
    throw error(500, 'Fehler beim Prüfen der Rechte');
  }

  const hasDownloadRights = unifiedRights?.download || unifiedRights?.download_original;
  if (!hasDownloadRights) {
    throw error(403, 'Kein Download-Zugriff auf diese Datei');
  }

  return unifiedRights;
}

async function logDownload(
  supabase: ReturnType<typeof createAuthedSupabase>,
  item: DownloadItemRecord,
  userId: string,
  downloadType: string
) {
  try {
    const downloadSource = userId === item.profile_id || userId === item.user_id ? 'owner' : 'rights';
    await supabase.rpc('log_item_download', {
      p_item_id: item.id,
      p_user_id: userId,
      p_download_type: downloadType,
      p_download_source: downloadSource
    });
  } catch (logError) {
    console.warn('Failed to log download:', logError);
  }
}

function getLegacyDownloadTypeForRights(unifiedRights: { download?: boolean; download_original?: boolean } | null | undefined) {
  return unifiedRights?.download_original ? 'full_resolution' : 'preview';
}

function getLegacyDownloadTypeForExport(options: DownloadExportOptions) {
  return options.sizeMode === 'full' ? 'full_resolution' : 'preview';
}

function getLegacyFilename(item: DownloadItemRecord) {
  const originalName = item.original_name?.trim() || `image-${item.id}.jpg`;
  return originalName;
}

function getLegacyContentType(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.png')) return 'image/png';
  return 'image/jpeg';
}

function estimateOutputDimensions(item: DownloadItemRecord, options: DownloadExportOptions) {
  const baseWidth = item.width || 0;
  const baseHeight = item.height || 0;

  if (!baseWidth || !baseHeight) {
    return {
      width: options.width || null,
      height: options.height || null
    };
  }

  if (options.sizeMode !== 'custom') {
    return { width: baseWidth, height: baseHeight };
  }

  const requestedWidth = options.width || baseWidth;
  const requestedHeight = options.height || baseHeight;

  if (options.cropEnabled && options.crop) {
    return {
      width: requestedWidth,
      height: requestedHeight
    };
  }

  const ratio = Math.min(requestedWidth / baseWidth, requestedHeight / baseHeight);
  return {
    width: Math.max(1, Math.round(baseWidth * ratio)),
    height: Math.max(1, Math.round(baseHeight * ratio))
  };
}

function isSharpRuntimeError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err ?? '');
  return message.toLowerCase().includes('sharp');
}

function getUserFacingDownloadErrorMessage(err: unknown, mode: 'download' | 'estimate') {
  if (isSharpRuntimeError(err)) {
    return mode === 'estimate'
      ? 'Die Dateivorschau ist gerade nicht verfuegbar.'
      : 'Die gewaehlte Exportvariante ist gerade nicht verfuegbar. Bitte versuche JPG in voller Aufloesung oder Original-Metadaten.';
  }

  return err instanceof Error ? err.message : 'Download fehlgeschlagen';
}

export const GET: RequestHandler = async ({ params, request }) => {
  const itemId = params.id;
  if (!itemId) {
    throw error(400, 'Item-ID fehlt');
  }
  const supabase = createAuthedSupabase(request);
  const user = await getAuthenticatedUser(supabase);
  const item = await loadDownloadItem(supabase, itemId);
  const unifiedRights = await assertDownloadRights(supabase, itemId, user.id);

  try {
    const buffer = await fetchDownloadSourceBuffer(item, {
      sizeMode: 'full',
      format: 'jpg',
      metadataMode: 'original',
      filenameMode: 'original'
    }, 'download');
    const filename = getLegacyFilename(item);
    const contentType = getLegacyContentType(filename);

    await logDownload(
      supabase,
      item,
      user.id,
      getLegacyDownloadTypeForRights(unifiedRights)
    );

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'private, max-age=0, must-revalidate'
      }
    });
  } catch (err) {
    console.error('Download GET failed:', err);
    throw error(500, getUserFacingDownloadErrorMessage(err, 'download'));
  }
};

export const POST: RequestHandler = async ({ params, request }) => {
  let requestMode: 'estimate' | 'download' = 'download';

  try {
    const itemId = params.id;
    if (!itemId) {
      return json({ error: 'Item-ID fehlt' }, { status: 400 });
    }

    const supabase = createAuthedSupabase(request);
    const user = await getAuthenticatedUser(supabase);
    const item = await loadDownloadItem(supabase, itemId);
    const unifiedRights = await assertDownloadRights(supabase, itemId, user.id);

    const body = await request.json().catch(() => ({}));
    const mode = body?.mode === 'estimate' ? 'estimate' : 'download';
    requestMode = mode;
    const options = normalizeDownloadExportOptions(body?.options as DownloadExportOptions);
    const originalBuffer = await fetchDownloadSourceBuffer(item, options, mode);

    if (canBypassImageProcessing(options)) {
      const filename = buildDownloadFilename(item, options);

      if (mode === 'estimate') {
        return json({
          ok: true,
          sizeBytes: originalBuffer.byteLength,
          width: item.width,
          height: item.height,
          filename,
          contentType: 'image/jpeg'
        });
      }

      await logDownload(
        supabase,
        item,
        user.id,
        getLegacyDownloadTypeForExport(options)
      );

      return new Response(originalBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
          'Cache-Control': 'private, max-age=0, must-revalidate'
        }
      });
    }

    if (mode === 'estimate') {
      try {
        const rendered = await renderDownloadExport(originalBuffer, item, options);
        return json({
          ok: true,
          sizeBytes: rendered.info.size,
          width: rendered.outputWidth,
          height: rendered.outputHeight,
          filename: buildDownloadFilename(item, options),
          contentType: rendered.contentType
        });
      } catch (estimateError) {
        console.warn('Download estimate failed, returning degraded fallback estimate:', estimateError);
        const fallbackDimensions = estimateOutputDimensions(item, options);
        return json({
          ok: true,
          sizeBytes: originalBuffer.byteLength,
          width: fallbackDimensions.width,
          height: fallbackDimensions.height,
          filename: buildDownloadFilename(item, options),
          contentType: options.format === 'webp' ? 'image/webp' : 'image/jpeg',
          degradedEstimate: true
        });
      }
    }

    try {
      const rendered = await renderDownloadExport(originalBuffer, item, options);
      await logDownload(
        supabase,
        item,
        user.id,
        getLegacyDownloadTypeForExport(options)
      );

      return new Response(rendered.buffer, {
        status: 200,
        headers: {
          'Content-Type': rendered.contentType,
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(rendered.filename)}`,
          'Cache-Control': 'private, max-age=0, must-revalidate'
        }
      });
    } catch (renderError) {
      if (!isSharpRuntimeError(renderError)) {
        throw renderError;
      }

      if (canRewriteMetadataWithoutSharp(originalBuffer, options)) {
        console.warn('Download render failed due to sharp runtime issue, retrying with exiftool metadata rewrite:', renderError);
        try {
          const rewritten = await rewriteJpegMetadataWithoutSharp(originalBuffer, item, options);

          await logDownload(
            supabase,
            item,
            user.id,
            getLegacyDownloadTypeForExport(options)
          );

          return new Response(rewritten.buffer, {
            status: 200,
            headers: {
              'Content-Type': rewritten.contentType,
              'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(rewritten.filename)}`,
              'Cache-Control': 'private, max-age=0, must-revalidate',
              'X-Culoca-Download-Fallback': 'exiftool-rewrite'
            }
          });
        } catch (rewriteError) {
          console.warn('Exiftool metadata rewrite failed, falling back to original JPG payload:', rewriteError);
        }
      }

      if (options.sizeMode !== 'full' || options.format !== 'jpg') {
        throw renderError;
      }

      console.warn('Download render failed due to sharp runtime issue, falling back to original JPG payload:', renderError);
      const filename = buildDownloadFilename(item, options);

      await logDownload(
        supabase,
        item,
        user.id,
        getLegacyDownloadTypeForExport(options)
      );

      return new Response(originalBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
          'Cache-Control': 'private, max-age=0, must-revalidate',
          'X-Culoca-Download-Fallback': 'sharp-runtime'
        }
      });
    }
  } catch (err) {
    console.error('Download POST failed:', err);
    const status =
      err && typeof err === 'object' && 'status' in err && typeof (err as { status?: unknown }).status === 'number'
        ? ((err as { status: number }).status as number)
        : 500;
    const message = getUserFacingDownloadErrorMessage(err, requestMode);
    return json({ error: message }, { status });
  }
};
