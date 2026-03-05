import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from './$types';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createClient as createWebdavClient } from 'webdav';

const execFileAsync = promisify(execFile);

function normalizeSftpHost(rawHost: string): string {
  const host = rawHost.trim();
  return host.replace(/^sftp:\/\//i, '').replace(/\/+$/, '');
}

export const POST: RequestHandler = async ({ params, request }) => {
  try {
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
      .select('id, profile_id, original_url, original_name, adobe_stock_url')
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
      .select('adobe_stock_sftp_enabled, adobe_stock_profile_url, adobe_stock_sftp_host, adobe_stock_sftp_username, adobe_stock_sftp_password, adobe_stock_sftp_remote_dir')
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
    const sftpRemoteDir = (profile.adobe_stock_sftp_remote_dir || '').replace(/^\/+/, '').replace(/\/+$/, '');

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
    const safeName = (item.original_name || `${item.id}.jpg`).replace(/[^\w.\-]+/g, '_');
    const localTempPath = path.join(os.tmpdir(), `adobe-${item.id}-${Date.now()}-${safeName}`);
    await fs.writeFile(localTempPath, fileBuffer);

    const remotePath = sftpRemoteDir ? `${sftpRemoteDir}/${safeName}` : safeName;

    let batchPath = '';
    let expectPath = '';
    try {
      // Use system sftp + expect to support password auth in serverless environments
      // where curl lacks SFTP protocol support.
      batchPath = path.join(os.tmpdir(), `adobe-sftp-${item.id}-${Date.now()}.batch`);
      expectPath = path.join(os.tmpdir(), `adobe-sftp-${item.id}-${Date.now()}.exp`);
      const quotedLocal = localTempPath.replace(/"/g, '\\"');
      const quotedRemote = remotePath.replace(/"/g, '\\"');
      await fs.writeFile(batchPath, `put "${quotedLocal}" "${quotedRemote}"\nbye\n`, 'utf8');

      const expectScript = [
        'set timeout 90',
        'set host $env(SFTP_HOST)',
        'set user $env(SFTP_USER)',
        'set pass $env(SFTP_PASS)',
        'set batch $env(SFTP_BATCH)',
        'spawn sftp -oStrictHostKeyChecking=no -oUserKnownHostsFile=/dev/null -b $batch "$user@$host"',
        'expect {',
        '  -re "(?i)password:" { send -- "$pass\\r" }',
        '  timeout { puts "SFTP password prompt timeout"; exit 20 }',
        '}',
        'expect eof',
        'catch wait result',
        'set exit_status [lindex $result 3]',
        'exit $exit_status'
      ].join('\n');
      await fs.writeFile(expectPath, expectScript, 'utf8');

      await execFileAsync('expect', [expectPath], {
        env: {
          ...process.env,
          SFTP_HOST: sftpHost,
          SFTP_USER: sftpUser,
          SFTP_PASS: sftpPassword,
          SFTP_BATCH: batchPath
        },
        timeout: 120000
      });

      const fallbackUrl = item.adobe_stock_url || profile.adobe_stock_profile_url || null;
      const { data: updatedItem, error: updateError } = await supabase
        .from('items')
        .update({
          adobe_stock_status: 'uploaded',
          adobe_stock_uploaded_at: new Date().toISOString(),
          adobe_stock_error: null,
          adobe_stock_url: fallbackUrl
        })
        .eq('id', item.id)
        .select('id, adobe_stock_status, adobe_stock_uploaded_at, adobe_stock_url, adobe_stock_asset_id, adobe_stock_error')
        .single();

      if (updateError) {
        return json({ error: 'Upload erfolgreich, aber Item-Status konnte nicht aktualisiert werden', details: updateError.message }, { status: 500 });
      }

      return json({
        success: true,
        message: 'Original erfolgreich zu Adobe Stock SFTP hochgeladen',
        item: updatedItem
      });
    } catch (uploadError: any) {
      await supabase
        .from('items')
        .update({
          adobe_stock_status: 'error',
          adobe_stock_error: uploadError?.message || 'Unbekannter SFTP-Fehler'
        })
        .eq('id', item.id);

      return json({
        error: 'SFTP-Upload fehlgeschlagen',
        details: uploadError?.message || 'Unbekannter Fehler'
      }, { status: 502 });
    } finally {
      if (batchPath) await fs.unlink(batchPath).catch(() => {});
      if (expectPath) await fs.unlink(expectPath).catch(() => {});
      await fs.unlink(localTempPath).catch(() => {});
    }
  } catch (error: any) {
    return json({ error: 'Server-Fehler', details: error?.message || String(error) }, { status: 500 });
  }
};
