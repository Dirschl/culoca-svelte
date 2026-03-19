import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { createClient as createWebdavClient } from 'webdav';
import { resizeJPG, getImageQualitySettings } from '$lib/image';
import {
  analyzeImageModeration,
  refreshSimilarityVectorForItem,
  resolveLocationFieldsFromOriginalName
} from '$lib/server/itemProcessing';

type ItemRow = {
  id: string;
  slug: string | null;
  profile_id: string | null;
  original_url: string | null;
  original_name: string | null;
  path_64: string | null;
  path_512: string | null;
  path_2048: string | null;
  width: number | null;
  height: number | null;
  type_id: number | null;
  group_root_item_id: string | null;
  country_slug: string | null;
  district_slug: string | null;
  municipality_slug: string | null;
  title: string | null;
  description: string | null;
  caption: string | null;
  motif_label: string | null;
  keywords: string[] | string | null;
  country_name: string | null;
  state_name: string | null;
  region_name: string | null;
  district_name: string | null;
  municipality_name: string | null;
  locality_name: string | null;
  page_settings: Record<string, unknown> | null;
};

function createAuthClient(token: string) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase auth configuration');
  }

  return createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });
}

function createServerClient() {
  const supabaseUrl =
    process.env.PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    import.meta.env.PUBLIC_SUPABASE_URL ||
    import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase server configuration');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });
}

async function requireUser(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: json({ error: 'Nicht angemeldet' }, { status: 401 }) };
  }

  const token = authHeader.slice(7);
  const authClient = createAuthClient(token);
  const {
    data: { user },
    error
  } = await authClient.auth.getUser();

  if (error || !user) {
    return { error: json({ error: 'Nicht angemeldet' }, { status: 401 }) };
  }

  return { user };
}

async function canEditItem(serverClient: ReturnType<typeof createServerClient>, itemId: string, userId: string) {
  const { data, error } = await serverClient.rpc('get_unified_item_rights', {
    p_item_id: itemId,
    p_user_id: userId
  });

  if (error) {
    throw new Error(error.message);
  }

  return !!data?.edit;
}

async function loadItem(serverClient: ReturnType<typeof createServerClient>, itemId: string) {
  const { data, error } = await serverClient
    .from('items')
    .select(
      'id, slug, profile_id, original_url, original_name, path_64, path_512, path_2048, width, height, type_id, group_root_item_id, country_slug, district_slug, municipality_slug, title, description, caption, motif_label, keywords, country_name, state_name, region_name, district_name, municipality_name, locality_name, page_settings'
    )
    .eq('id', itemId)
    .maybeSingle<ItemRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

function deriveOriginalPath(item: ItemRow) {
  if (item.original_url) {
    const url = new URL(item.original_url);
    return url.pathname.replace(/^\/+/, '');
  }
  return `items/${item.id}.jpg`;
}

function toBuffer(data: unknown) {
  if (Buffer.isBuffer(data)) {
    return data;
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(data));
  }

  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }

  if (typeof data === 'string') {
    return Buffer.from(data);
  }

  return Buffer.from(data as ArrayLike<number>);
}

async function loadOriginalBuffer(item: ItemRow) {
  const errors: string[] = [];

  if (item.original_url) {
    try {
      const response = await fetch(item.original_url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      errors.push(`Direkter Abruf der original_url fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (process.env.HETZNER_WEBDAV_URL && process.env.HETZNER_WEBDAV_USER && process.env.HETZNER_WEBDAV_PASSWORD) {
    try {
      const webdav = createWebdavClient(process.env.HETZNER_WEBDAV_URL, {
        username: process.env.HETZNER_WEBDAV_USER,
        password: process.env.HETZNER_WEBDAV_PASSWORD
      });

      const downloadedOriginal = await webdav.getFileContents(deriveOriginalPath(item), { format: 'binary' });
      return toBuffer(downloadedOriginal);
    } catch (error) {
      errors.push(`WebDAV-Abruf des Originals fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    errors.push('Hetzner-WebDAV ist nicht konfiguriert.');
  }

  throw new Error(errors.join(' '));
}

function hasCompleteGeoFields(source: { country_slug?: string | null; district_slug?: string | null; municipality_slug?: string | null }) {
  return !!(source.country_slug && source.district_slug && source.municipality_slug);
}

function isFormDataRequest(request: Request) {
  return request.headers.get('content-type')?.includes('multipart/form-data') ?? false;
}

async function uploadOriginalToHetzner(itemId: string, originalBuffer: Buffer) {
  if (!process.env.HETZNER_WEBDAV_URL || !process.env.HETZNER_WEBDAV_USER || !process.env.HETZNER_WEBDAV_PASSWORD) {
    throw new Error('Hetzner-WebDAV ist nicht konfiguriert.');
  }

  const webdav = createWebdavClient(process.env.HETZNER_WEBDAV_URL, {
    username: process.env.HETZNER_WEBDAV_USER,
    password: process.env.HETZNER_WEBDAV_PASSWORD
  });

  try {
    await webdav.createDirectory('items');
  } catch {
    // directory may already exist
  }

  const hetznerPath = `items/${itemId}.jpg`;
  await webdav.putFileContents(hetznerPath, originalBuffer, { overwrite: true });

  return `${process.env.HETZNER_WEBDAV_PUBLIC_URL || process.env.HETZNER_WEBDAV_URL}/items/${itemId}.jpg`;
}

export async function POST({ params, request }: any) {
  const auth = await requireUser(request);
  if ('error' in auth) return auth.error;

  const { id } = params;
  if (!id) {
    return json({ error: 'Fehlende Item-ID' }, { status: 400 });
  }

  try {
    const serverClient = createServerClient();
    const item = await loadItem(serverClient, id);

    if (!item) {
      return json({ error: 'Item nicht gefunden' }, { status: 404 });
    }

    if (!(await canEditItem(serverClient, item.id, auth.user.id))) {
      return json({ error: 'Keine Berechtigung für dieses Item' }, { status: 403 });
    }

    let originalBuffer: Buffer;
    let uploadedMimeType = 'image/jpeg';
    let replacementOriginalName = item.original_name;
    let replacementOriginalUrl = item.original_url;
    let nextPageSettings: Record<string, unknown> = {
      ...((item.page_settings && typeof item.page_settings === 'object' && !Array.isArray(item.page_settings))
        ? item.page_settings
        : {})
    };
    const replacingOriginal = isFormDataRequest(request);

    if (replacingOriginal) {
      const formData = await request.formData();
      const file = formData.get('file');

      if (!(file instanceof File)) {
        return json({ error: 'Keine Bilddatei erhalten.' }, { status: 400 });
      }

      if (!file.type.startsWith('image/')) {
        return json({ error: 'Bitte eine gültige Bilddatei auswählen.' }, { status: 400 });
      }

      originalBuffer = Buffer.from(await file.arrayBuffer());
      uploadedMimeType = file.type || 'image/jpeg';
      replacementOriginalName = file.name || item.original_name;
      replacementOriginalUrl = await uploadOriginalToHetzner(item.id, originalBuffer);
    } else {
      originalBuffer = await loadOriginalBuffer(item);
    }

    const qualitySettings = getImageQualitySettings();
    const sizes = await resizeJPG(originalBuffer);
    const format2048Key = `${qualitySettings.format2048}2048`;
    const format512Key = `${qualitySettings.format512}512`;
    const format64Key = `${qualitySettings.format64}64`;
    const extension2048 = qualitySettings.format2048 === 'webp' ? '.webp' : '.jpg';
    const extension512 = qualitySettings.format512 === 'webp' ? '.webp' : '.jpg';
    const extension64 = qualitySettings.format64 === 'webp' ? '.webp' : '.jpg';
    const path2048 = `${item.id}${extension2048}`;
    const path512 = `${item.id}${extension512}`;
    const path64 = `${item.id}${extension64}`;

    const { error: upload2048Error } = await serverClient.storage.from('images-2048').upload(path2048, sizes[format2048Key], {
      upsert: true,
      contentType: qualitySettings.format2048 === 'webp' ? 'image/webp' : 'image/jpeg'
    });
    if (upload2048Error) throw new Error(upload2048Error.message);

    const { error: upload512Error } = await serverClient.storage.from('images-512').upload(path512, sizes[format512Key], {
      upsert: true,
      contentType: qualitySettings.format512 === 'webp' ? 'image/webp' : 'image/jpeg'
    });
    if (upload512Error) throw new Error(upload512Error.message);

    const { error: upload64Error } = await serverClient.storage.from('images-64').upload(path64, sizes[format64Key], {
      upsert: true,
      contentType: qualitySettings.format64 === 'webp' ? 'image/webp' : 'image/jpeg'
    });
    if (upload64Error) throw new Error(upload64Error.message);

    const sharp = (await import('sharp')).default;
    const imageMeta = await sharp(originalBuffer).rotate().metadata();

    const updatePayload: Record<string, unknown> = {
      path_2048: path2048,
      path_512: path512,
      path_64: path64,
      width: imageMeta.width || item.width,
      height: imageMeta.height || item.height
    };

    if (replacingOriginal) {
      updatePayload.original_name = replacementOriginalName;
      updatePayload.original_url = replacementOriginalUrl;

      try {
        const moderation = await analyzeImageModeration(originalBuffer, uploadedMimeType);
        if (moderation) {
          nextPageSettings = {
            ...nextPageSettings,
            moderation
          };
          updatePayload.page_settings = nextPageSettings;
        }
      } catch (moderationError) {
        console.warn('Moderation check after original replacement failed:', moderationError);
      }

      const locationFields = await resolveLocationFieldsFromOriginalName(serverClient, replacementOriginalName);
      if (locationFields) {
        Object.assign(updatePayload, locationFields);
      } else {
        updatePayload.location_needs_review = !hasCompleteGeoFields({
          country_slug: item.country_slug,
          district_slug: item.district_slug,
          municipality_slug: item.municipality_slug
        });
      }
    }

    const mergedGeo = {
      country_slug:
        typeof updatePayload.country_slug === 'string' ? (updatePayload.country_slug as string) : item.country_slug,
      district_slug:
        typeof updatePayload.district_slug === 'string' ? (updatePayload.district_slug as string) : item.district_slug,
      municipality_slug:
        typeof updatePayload.municipality_slug === 'string'
          ? (updatePayload.municipality_slug as string)
          : item.municipality_slug
    };

    if (hasCompleteGeoFields(mergedGeo)) {
      updatePayload.location_needs_review = false;
    }

    const { data: updatedItem, error: updateError } = await serverClient
      .from('items')
      .update(updatePayload)
      .eq('id', item.id)
      .select(
        'id, slug, original_name, original_url, path_2048, path_512, path_64, width, height, type_id, profile_id, group_root_item_id, country_slug, district_slug, municipality_slug, title, description, caption, motif_label, keywords, country_name, state_name, region_name, district_name, municipality_name, locality_name, page_settings, location_needs_review, location_source, location_confidence, taxonomy_slug_suffix'
      )
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    if (replacingOriginal) {
      try {
        await refreshSimilarityVectorForItem(updatedItem as any);
      } catch (vectorError) {
        console.warn('Similarity vector refresh after original replacement failed:', vectorError);
      }
    }

    return json({
      success: true,
      item: updatedItem
    });
  } catch (error) {
    console.error('Variant rerender failed:', error);
    return json(
      {
        error: error instanceof Error ? error.message : 'Varianten konnten nicht neu gerendert werden.'
      },
      { status: 500 }
    );
  }
}
