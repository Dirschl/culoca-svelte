import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from './$types';
import {
	buildAdobeDualWrite,
	enrichItemWithResolvedAdobeStock,
	getAdobeStockStateFromItem
} from '$lib/stock/itemStockSettings';
import {
  buildDownloadFilename,
  canRewriteMetadataWithoutSharp,
  renderDownloadExport,
  rewriteJpegMetadataWithoutSharp,
  type DownloadExportOptions
} from '$lib/server/downloadExport';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import SftpClient from 'ssh2-sftp-client';
import { createClient as createWebdavClient } from 'webdav';
import { extractPhotoMetadataFields } from '$lib/metadata/photoMetadata';

function normalizeSftpHost(rawHost: string): string {
  const host = rawHost.trim();
  return host.replace(/^sftp:\/\//i, '').replace(/\/+$/, '');
}

function normalizeRemoteDir(rawDir: string | null | undefined): string {
  return (rawDir || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
}

export const POST: RequestHandler = async ({ params, request }) => {
  try {
    let uploadOptions: { metadataMode: 'culoca' | 'original'; filenameMode: 'original' | 'web' } = {
      metadataMode: 'culoca',
      filenameMode: 'original'
    };
    try {
      const body = (await request.json()) as Record<string, unknown>;
      uploadOptions = {
        metadataMode: body?.metadataMode === 'original' ? 'original' : 'culoca',
        filenameMode: body?.filenameMode === 'web' ? 'web' : 'original'
      };
    } catch {
      // Optional body; fallback defaults are intentional.
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return json({ error: 'Nicht angemeldet' }, { status: 401 });
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return json({ error: 'Missing Supabase environment variables' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return json({ error: 'Nicht angemeldet' }, { status: 401 });
    }

    const itemId = params.itemId;
    if (!itemId) {
      return json({ error: 'Fehlende Item-ID' }, { status: 400 });
    }

    const { data: item, error: itemError } = await supabase
      .from('items')
      .select(
        'id, profile_id, short_id, title, caption, description, keywords, exif_data, lat, lon, original_url, original_name, adobe_stock_url, stock_settings, adobe_stock_status, adobe_stock_uploaded_at, adobe_stock_asset_id, adobe_stock_error'
      )
      .eq('id', itemId)
      .single();

    if (itemError || !item) {
      return json({ error: 'Item nicht gefunden' }, { status: 404 });
    }
    if (item.profile_id !== user.id) {
      return json({ error: 'Keine Berechtigung für dieses Item' }, { status: 403 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('adobe_stock_sftp_enabled, adobe_stock_profile_url, adobe_stock_sftp_host, adobe_stock_sftp_username, adobe_stock_sftp_password, adobe_stock_sftp_remote_dir, display_name_public, legal_entity_name, copyright_holder_name, default_creator_name, default_credit_text, default_copyright_notice, default_license_url, default_author_meta, organization_name, use_exif_creator_override, use_exif_credit_override, use_exif_copyright_override, photographer_label_mode, public_contact_name, full_name, accountname')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return json({ error: 'Profil konnte nicht geladen werden' }, { status: 500 });
    }
    if (!profile.adobe_stock_sftp_enabled) {
      return json({ error: 'SFTP Upload Stock Adobe ist in den Einstellungen deaktiviert' }, { status: 400 });
    }
    if (!item.original_url) {
      return json({ error: 'Originaldatei für dieses Item nicht verfügbar' }, { status: 400 });
    }

    const sftpHostRaw = profile.adobe_stock_sftp_host || 'sftp.contributor.adobestock.com';
    const sftpHost = normalizeSftpHost(sftpHostRaw);
    const sftpUser = profile.adobe_stock_sftp_username;
    const sftpPassword = profile.adobe_stock_sftp_password;
    const configuredRemoteDir = normalizeRemoteDir(profile.adobe_stock_sftp_remote_dir);

    if (!sftpUser || !sftpPassword) {
      return json({ error: 'Adobe SFTP Zugangsdaten fehlen im Benutzerprofil' }, { status: 400 });
    }

    let fileBuffer: Buffer | null = null;
    let lastDownloadError = '';
    const webdavUrl = process.env.HETZNER_WEBDAV_URL;
    const webdavUser = process.env.HETZNER_WEBDAV_USER;
    const webdavPassword = process.env.HETZNER_WEBDAV_PASSWORD;

    // Primary: direct fetch (works for public originals URLs)
    try {
      const fileResponse = await fetch(item.original_url);
      if (fileResponse.ok) {
        fileBuffer = Buffer.from(await fileResponse.arrayBuffer());
      } else {
        lastDownloadError = `HTTP ${fileResponse.status}`;
      }
    } catch (e: any) {
      lastDownloadError = e?.message || 'direct fetch failed';
    }

    // Retry with Basic Auth for protected Storagebox URLs
    if (!fileBuffer && webdavUser && webdavPassword) {
      try {
        const auth = Buffer.from(`${webdavUser}:${webdavPassword}`).toString('base64');
        const authResponse = await fetch(item.original_url, {
          headers: {
            Authorization: `Basic ${auth}`
          }
        });
        if (authResponse.ok) {
          fileBuffer = Buffer.from(await authResponse.arrayBuffer());
        } else {
          lastDownloadError = `${lastDownloadError}; auth-fetch HTTP ${authResponse.status}`;
        }
      } catch (e: any) {
        lastDownloadError = `${lastDownloadError}; auth-fetch ${e?.message || 'failed'}`;
      }
    }

    // Fallback: load from protected Hetzner WebDAV if direct URL is unauthorized
    if (!fileBuffer) {
      try {
        if (!webdavUrl || !webdavUser || !webdavPassword) {
          throw new Error('Hetzner WebDAV credentials missing');
        }

        const parsed = new URL(item.original_url);
        const pathFromUrl = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
        const candidatePaths = [
          `items/${item.id}.jpg`,
          pathFromUrl,
          `items/${(item.original_name || `${item.id}.jpg`).replace(/[^\w.\-]+/g, '_')}`
        ].filter(Boolean);

        const webdav = createWebdavClient(webdavUrl, {
          username: webdavUser,
          password: webdavPassword
        });
        let webdavError = '';
        for (const webdavPath of candidatePaths) {
          try {
            const webdavData = await webdav.getFileContents(webdavPath, { format: 'binary' });
            fileBuffer = Buffer.isBuffer(webdavData) ? webdavData : Buffer.from(webdavData as ArrayBuffer);
            break;
          } catch (e: any) {
            webdavError = `${webdavError} [${webdavPath}: ${e?.message || 'failed'}]`;
          }
        }
        if (!fileBuffer) {
          throw new Error(`no matching WebDAV path${webdavError}`);
        }
      } catch (e: any) {
        lastDownloadError = `${lastDownloadError}; webdav: ${e?.message || 'unknown error'}`;
      }
    }

    if (!fileBuffer) {
      return json({
        error: 'Originaldatei konnte nicht geladen werden (401)',
        details: lastDownloadError
      }, { status: 502 });
    }
    const sourceItemForExport = {
      ...(item as Record<string, unknown>),
      profile: profile || null
    } as Record<string, unknown>;

    let uploadBuffer = fileBuffer;
    let finalUploadFilename = (item.original_name || `${item.id}.jpg`).replace(/[^\w.\-]+/g, '_');
    if (uploadOptions.metadataMode === 'culoca') {
      const culocaExportOptions: DownloadExportOptions = {
        sizeMode: 'full',
        format: 'jpg',
        metadataMode: 'culoca',
        filenameMode: uploadOptions.filenameMode
      };
      if (canRewriteMetadataWithoutSharp(fileBuffer, culocaExportOptions)) {
        const rewritten = await rewriteJpegMetadataWithoutSharp(fileBuffer, sourceItemForExport as any, culocaExportOptions);
        uploadBuffer = rewritten.buffer;
        finalUploadFilename = rewritten.filename;
      } else {
        const rendered = await renderDownloadExport(fileBuffer, sourceItemForExport as any, culocaExportOptions);
        uploadBuffer = rendered.buffer;
        finalUploadFilename = rendered.filename;
      }
    } else if (uploadOptions.filenameMode === 'web') {
      finalUploadFilename = buildDownloadFilename(sourceItemForExport as any, {
        sizeMode: 'full',
        format: 'jpg',
        metadataMode: 'original',
        filenameMode: 'web'
      });
    }

    const safeName = finalUploadFilename.replace(/[^\w.\-]+/g, '_');
    const localTempPath = path.join(os.tmpdir(), `adobe-${item.id}-${Date.now()}-${safeName}`);
    await fs.writeFile(localTempPath, uploadBuffer);

    try {
      const sftp = new SftpClient();
      try {
        await sftp.connect({
          host: sftpHost,
          port: 22,
          username: sftpUser,
          password: sftpPassword,
          readyTimeout: 30000
        });

        const resolvedRemoteDir = configuredRemoteDir;

        if (resolvedRemoteDir) {
          await sftp.mkdir(resolvedRemoteDir, true).catch(() => {});
        }
        const remotePath = resolvedRemoteDir ? `${resolvedRemoteDir}/${safeName}` : safeName;
        await sftp.put(localTempPath, remotePath);

        const uploadedExists = await sftp.exists(remotePath);
        if (!uploadedExists) {
          throw new Error(`Upload konnte nicht bestaetigt werden (remote missing): ${remotePath}`);
        }

        const fallbackUrl = item.adobe_stock_url || profile.adobe_stock_profile_url || null;
        const cur = getAdobeStockStateFromItem(item as Record<string, unknown>);
        const next = {
          ...cur,
          status: 'uploaded' as const,
          uploadedAt: new Date().toISOString(),
          publicUrl: fallbackUrl,
          error: null
        };
        const dual = buildAdobeDualWrite((item as { stock_settings?: unknown }).stock_settings, next);
        const { data: updatedItem, error: updateError } = await supabase
          .from('items')
          .update(dual)
          .eq('id', item.id)
          .select(
            'id, adobe_stock_status, adobe_stock_uploaded_at, adobe_stock_url, adobe_stock_asset_id, adobe_stock_error, stock_settings'
          )
          .single();

        if (updateError) {
          return json({ error: 'Upload erfolgreich, aber Item-Status konnte nicht aktualisiert werden', details: updateError.message }, { status: 500 });
        }

        return json({
          success: true,
          message: `Original erfolgreich zu Adobe Stock SFTP hochgeladen (${remotePath})`,
          remotePath,
          upload: {
            metadataMode: uploadOptions.metadataMode,
            filenameMode: uploadOptions.filenameMode,
            filename: safeName,
            metadataPreview: {
              culoca: {
                title: item.title || null,
                description: item.description || item.caption || null,
                keywords: Array.isArray(item.keywords) ? item.keywords.join(', ') : null
              },
              original: {
                title: extractPhotoMetadataFields((item.exif_data || {}) as Record<string, unknown>).title,
                description: extractPhotoMetadataFields((item.exif_data || {}) as Record<string, unknown>).description,
                keywords: extractPhotoMetadataFields((item.exif_data || {}) as Record<string, unknown>).keywords
              }
            }
          },
          item: enrichItemWithResolvedAdobeStock(updatedItem as Record<string, unknown>)
        });
      } finally {
        await sftp.end().catch(() => {});
      }
    } catch (uploadError: any) {
      const curErr = getAdobeStockStateFromItem(item as Record<string, unknown>);
      const dualErr = buildAdobeDualWrite((item as { stock_settings?: unknown }).stock_settings, {
        ...curErr,
        status: 'error',
        error: uploadError?.message || 'Unbekannter SFTP-Fehler'
      });
      await supabase.from('items').update(dualErr).eq('id', item.id);

      return json({
        error: 'SFTP-Upload fehlgeschlagen',
        details: uploadError?.message || 'Unbekannter Fehler'
      }, { status: 502 });
    } finally {
      await fs.unlink(localTempPath).catch(() => {});
    }
  } catch (error: any) {
    return json({ error: 'Server-Fehler', details: error?.message || String(error) }, { status: 500 });
  }
};
