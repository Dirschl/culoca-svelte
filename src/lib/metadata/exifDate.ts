/**
 * EXIF-Datumswerte kommen als String ("2012:03:04 10:11:12"), Zahl, Date oder leeres Objekt von exifr.
 */

function isEmptyObject(v: unknown): boolean {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && Object.keys(v as object).length === 0;
}

export function parseExifDateToDate(raw: unknown): Date | null {
  if (raw == null) return null;
  if (isEmptyObject(raw)) return null;
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw;
  }
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    if (typeof o.year === 'number' && typeof o.month === 'number' && typeof o.day === 'number') {
      const h = typeof o.hour === 'number' ? o.hour : 0;
      const mi = typeof o.minute === 'number' ? o.minute : 0;
      const s = typeof o.second === 'number' ? o.second : 0;
      const d = new Date(o.year, o.month - 1, o.day, h, mi, s);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  }
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const s = String(raw).trim();
  if (!s || s === '{}' || s.toLowerCase() === 'invalid date') return null;

  const exifMatch = s.match(/^(\d{4}):(\d{2}):(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (exifMatch) {
    const y = Number(exifMatch[1]);
    const mo = Number(exifMatch[2]);
    const d = Number(exifMatch[3]);
    const h = exifMatch[4] != null ? Number(exifMatch[4]) : 0;
    const mi = exifMatch[5] != null ? Number(exifMatch[5]) : 0;
    const se = exifMatch[6] != null ? Number(exifMatch[6]) : 0;
    const dt = new Date(y, mo - 1, d, h, mi, se);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function formatExifDateDe(raw: unknown): string | null {
  const d = parseExifDateToDate(raw);
  if (!d) return null;
  return d.toLocaleDateString('de-DE');
}

/** Erstes gültiges Aufnahmedatum (sichtbare „Aufgenommen“-Zeile). */
export function pickBestExifCaptureDateFormatted(
  exif: Record<string, unknown> | null | undefined
): string | null {
  if (!exif) return null;
  const keys = ['DateTimeOriginal', 'CreateDate', 'DateTime', 'ModifyDate', 'DateCreated'];
  for (const k of keys) {
    const formatted = formatExifDateDe(exif[k]);
    if (formatted) return formatted;
  }
  return null;
}
