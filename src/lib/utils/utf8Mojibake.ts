/**
 * UTF-8-Mojibake (z. B. „AltÃ¶tting“): Bytes fälschlich als Latin-1 gelesen.
 * Nur anwenden, wenn typische Muster vorkommen.
 */
export function fixUtf8MojibakeIfNeeded(input: string | null | undefined): string | null | undefined {
  if (input == null || typeof input !== 'string' || input.length === 0) return input;
  if (!/(Ã.|Â.)/.test(input) && !/Ã¼|Ã¶|Ã¤|ÃŸ/i.test(input)) return input;
  try {
    const bytes = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) {
      bytes[i] = input.charCodeAt(i) & 0xff;
    }
    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    if (decoded && decoded.length > 0 && !/(Ã.|Â.)/.test(decoded)) {
      return decoded;
    }
  } catch {
    /* ignore */
  }
  return input;
}

/**
 * Häufige deutsche Orts-/Metadaten-Fehlkodierungen (z. B. „Alt√∂tting“, „M¸hldorf“).
 */
export function fixGermanLocaleMojibake(input: string): string {
  let s = input;
  s = s.replace(/√∂/g, 'ö');
  s = s.replace(/√º/g, 'ü');
  s = s.replace(/√§/g, 'ä');
  s = s.replace(/√Ñ/g, 'Ä');
  s = s.replace(/√ñ/g, 'Ö');
  s = s.replace(/√Ü/g, 'Ü');
  s = s.replace(/√ü/g, 'ß');
  s = s.replace(/â€ž/g, '„');
  s = s.replace(/â€œ/g, '“');
  s = s.replace(/â€™/g, '’');
  s = s.replace(/â€“/g, '–');
  s = s.replace(/â€”/g, '—');
  s = s.replace(/([A-Za-zÄÖÜäöü])¸([a-zäöüß])/g, '$1ü$2');
  s = s.replace(/([A-Za-zÄÖÜäöü])¸(?=\s|$|[,.])/g, '$1ü');
  return s;
}

/** Mojibake + typische DE-Korrekturen (für Texte aus DB/EXIF/Related). */
export function fixTextEncodingIfNeeded(input: string | null | undefined): string | null | undefined {
  if (input == null || typeof input !== 'string') return input;
  const step1 = fixUtf8MojibakeIfNeeded(input) ?? input;
  return fixGermanLocaleMojibake(step1);
}

export function fixDeepUtf8InObject<T>(value: T): T {
  if (typeof value === 'string') {
    return (fixTextEncodingIfNeeded(value) ?? value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => fixDeepUtf8InObject(v)) as T;
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      out[k] = fixDeepUtf8InObject(v);
    }
    return out as T;
  }
  return value;
}
