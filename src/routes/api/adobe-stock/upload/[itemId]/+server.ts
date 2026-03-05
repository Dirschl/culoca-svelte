import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from './$types';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

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
      .select('adobe_stock_sftp_enabled, adobe_stock_profile_url')
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

    const sftpHostRaw = process.env.ADOBE_STOCK_SFTP_HOST || 'sftp.contributor.adobestock.com';
    const sftpHost = normalizeSftpHost(sftpHostRaw);
    const sftpUser = process.env.ADOBE_STOCK_SFTP_USERNAME;
    const sftpPassword = process.env.ADOBE_STOCK_SFTP_PASSWORD;
    const sftpRemoteDir = (process.env.ADOBE_STOCK_SFTP_REMOTE_DIR || '').replace(/^\/+/, '').replace(/\/+$/, '');

    if (!sftpUser || !sftpPassword) {
      return json({ error: 'Adobe SFTP Zugangsdaten fehlen im Server-Environment' }, { status: 500 });
    }

    const fileResponse = await fetch(item.original_url);
    if (!fileResponse.ok) {
      return json({ error: `Originaldatei konnte nicht geladen werden (${fileResponse.status})` }, { status: 502 });
    }

    const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());
    const safeName = (item.original_name || `${item.id}.jpg`).replace(/[^\w.\-]+/g, '_');
    const localTempPath = path.join(os.tmpdir(), `adobe-${item.id}-${Date.now()}-${safeName}`);
    await fs.writeFile(localTempPath, fileBuffer);

    const remotePath = sftpRemoteDir ? `${sftpRemoteDir}/${safeName}` : safeName;
    const remoteUrl = `sftp://${sftpHost}/${remotePath}`;

    try {
      await execFileAsync('curl', [
        '--fail',
        '--silent',
        '--show-error',
        '--user',
        `${sftpUser}:${sftpPassword}`,
        '--upload-file',
        localTempPath,
        remoteUrl
      ]);

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
      await fs.unlink(localTempPath).catch(() => {});
    }
  } catch (error: any) {
    return json({ error: 'Server-Fehler', details: error?.message || String(error) }, { status: 500 });
  }
};
