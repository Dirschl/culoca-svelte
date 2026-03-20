type KeywordContext = {
  countryName?: string | null;
  stateName?: string | null;
  regionName?: string | null;
  districtName?: string | null;
  municipalityName?: string | null;
  localityName?: string | null;
};

export const KEYWORDS_MIN = 5;
export const KEYWORDS_MAX = 30;

function normalizeKeywordToken(value: string): string {
  return value
    .normalize('NFC')
    .trim()
    .toLocaleLowerCase('de-DE')
    .replace(/[.,/#!$%^&*;:{}=_`~()]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function splitCompositeGeoValues(value: string | null | undefined): string[] {
  const source = (value || '').trim();
  if (!source) return [];
  return source
    .split(/[,/|-]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parseKeywords(value: string | string[] | null | undefined): string[] {
  const source = Array.isArray(value) ? value : (value || '').split(',');
  return source
    .map((entry) => entry.normalize('NFC').trim())
    .filter(Boolean);
}

export function sanitizeKeywords(
  value: string | string[] | null | undefined,
  context: KeywordContext = {}
): string[] {
  const parsedKeywords = parseKeywords(value);
  const normalizedKeywords = parsedKeywords.map((keyword) => ({
    original: keyword,
    normalized: normalizeKeywordToken(keyword)
  }));

  const geoTerms = new Set(
    [
      context.countryName,
      context.stateName,
      context.regionName,
      context.districtName,
      context.municipalityName
    ]
      .flatMap((entry) => splitCompositeGeoValues(entry))
      .map((entry) => normalizeKeywordToken(entry))
      .filter(Boolean)
  );

  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const { original, normalized } of normalizedKeywords) {
    if (!normalized) continue;
    if (/^[a-zäöüß]{1,3}$/iu.test(normalized)) continue;
    if (
      normalizedKeywords.some(
        (candidate) =>
          candidate.normalized !== normalized &&
          candidate.normalized.length > normalized.length + 2 &&
          /^[a-zäöüß]+$/iu.test(normalized) &&
          /^[a-zäöüß]+$/iu.test(candidate.normalized) &&
          candidate.normalized.startsWith(normalized)
      )
    ) {
      continue;
    }
    if (geoTerms.has(normalized)) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    cleaned.push(original);
  }

  const locality = context.localityName?.normalize('NFC').trim();
  if (locality) {
    const normalizedLocality = normalizeKeywordToken(locality);
    if (normalizedLocality && !seen.has(normalizedLocality)) {
      cleaned.push(locality);
      seen.add(normalizedLocality);
    }
  }

  return cleaned.slice(0, KEYWORDS_MAX);
}

export function sanitizeKeywordsText(
  value: string | string[] | null | undefined,
  context: KeywordContext = {}
): string {
  return sanitizeKeywords(value, context).join(', ');
}
