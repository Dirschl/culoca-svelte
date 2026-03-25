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
