/**
 * Item-Detailseite: öffentliches SSR-/Hydration-Payload
 * ---------------------------------------------------------------------------
 * - Keine internen URLs/Fehlertexte/Adobe-Debug im Client-DTO
 * - Profil nur mit expliziter Whitelist (keine SFTP-/Secret-Spalten aus select('*'))
 *
 * Google Bilder / SEO (Bild-URLs, nicht HTML):
 * - Indexierbar: /images/{slug}-2048.* (primäres Hauptbild)
 * - noimageindex (nur Token): /images/{slug}-512.*, /images/similar/…, ?context=similar, /images/embed/… (+ hooks)
 *
 * HTML-Links (<a href>) bleiben überall follow/crawlbar; nur Bild-Responses tragen noimageindex.
 */

/** Nur Felder, die die Item-Seite öffentlich anzeigen darf — niemals select('*'). */
export const ITEM_PAGE_PROFILE_SELECT = [
  'id',
  'full_name',
  'accountname',
  'avatar_url',
  'bio',
  'show_bio',
  'address',
  'show_address',
  'phone',
  'show_phone',
  'email',
  'show_email',
  'website',
  'show_website',
  'instagram',
  'facebook',
  'twitter',
  'show_social',
  'privacy_mode'
].join(', ');

const ITEM_KEYS_STRIP = new Set([
  'original_url',
  'error_message',
  'adobe_stock_error'
]);

import { fixTextEncodingIfNeeded } from '$lib/utils/utf8Mojibake';

export function fixUtf8MojibakeIfNeeded(input: string | null | undefined): string | null | undefined {
  return fixTextEncodingIfNeeded(input);
}

export function scrubPublicProfileRow(row: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!row) return null;
  return fixStringsDeep(row) as Record<string, unknown>;
}

function fixStringsDeep(value: unknown): unknown {
  if (typeof value === 'string') {
    return fixTextEncodingIfNeeded(value) ?? value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => fixStringsDeep(v));
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      out[k] = fixStringsDeep(v);
    }
    return out;
  }
  return value;
}

export function sanitizeItemForItemPageClient<T extends Record<string, unknown>>(item: T): T {
  const clone = { ...item } as Record<string, unknown>;
  for (const k of ITEM_KEYS_STRIP) {
    delete clone[k];
  }
  return fixStringsDeep(clone) as T;
}
