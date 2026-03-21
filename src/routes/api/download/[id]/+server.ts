import { error, json, type RequestHandler } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import {
  buildDownloadFilename,
  fetchOriginalItemBuffer,
  normalizeDownloadExportOptions,
  renderDownloadExport,
  type DownloadExportOptions
} from '$lib/server/downloadExport';

type DownloadItemRecord = {
  id: string;
  profile_id: string | null;
  user_id: string | null;
  short_id: string | null;
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

async function loadDownloadItem(supabase: ReturnType<typeof createAuthedSupabase>, itemId: string) {
  const { data: item, error: itemError } = await supabase
    .from('items')
    .select(
      `
        id,
        profile_id,
        user_id,
        short_id,
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
    const buffer = await fetchOriginalItemBuffer(item, { allowPublicFallback: false });
    const filename = getLegacyFilename(item);
    const contentType = getLegacyContentType(filename);

    await logDownload(
      supabase,
      item,
      user.id,
      unifiedRights?.download_original ? 'full_resolution' : 'preview'
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
    throw error(500, err instanceof Error ? err.message : 'Download fehlgeschlagen');
  }
};

export const POST: RequestHandler = async ({ params, request }) => {
  try {
    const itemId = params.id;
    if (!itemId) {
      return json({ error: 'Item-ID fehlt' }, { status: 400 });
    }

    const supabase = createAuthedSupabase(request);
    const user = await getAuthenticatedUser(supabase);
    const item = await loadDownloadItem(supabase, itemId);
    await assertDownloadRights(supabase, itemId, user.id);

    const body = await request.json().catch(() => ({}));
    const mode = body?.mode === 'estimate' ? 'estimate' : 'download';
    const options = normalizeDownloadExportOptions(body?.options as DownloadExportOptions);
    const originalBuffer = await fetchOriginalItemBuffer(item, {
      allowPublicFallback: !(mode === 'download' && options.metadataMode === 'original' && options.format === 'jpg')
    });

    if (mode === 'estimate') {
      const rendered = await renderDownloadExport(originalBuffer, item, options);
      return json({
        ok: true,
        sizeBytes: rendered.info.size,
        width: rendered.outputWidth,
        height: rendered.outputHeight,
        filename: buildDownloadFilename(item, options),
        contentType: rendered.contentType
      });
    }

    const rendered = await renderDownloadExport(originalBuffer, item, options);
    await logDownload(
      supabase,
      item,
      user.id,
      options.sizeMode === 'full' ? 'full_resolution_custom' : 'custom_export'
    );

    return new Response(rendered.buffer, {
      status: 200,
      headers: {
        'Content-Type': rendered.contentType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(rendered.filename)}`,
        'Cache-Control': 'private, max-age=0, must-revalidate'
      }
    });
  } catch (err) {
    console.error('Download POST failed:', err);
    const status =
      err && typeof err === 'object' && 'status' in err && typeof (err as { status?: unknown }).status === 'number'
        ? ((err as { status: number }).status as number)
        : 500;
    const message = err instanceof Error ? err.message : 'Download fehlgeschlagen';
    return json({ error: message }, { status });
  }
};
