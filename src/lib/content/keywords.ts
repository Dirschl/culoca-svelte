type KeywordContext = {
  countryName?: string | null;
  stateName?: string | null;
  regionName?: string | null;
  districtName?: string | null;
  municipalityName?: string | null;
  localityName?: string | null;
};

export const KEYWORDS_MIN = 10;
export const KEYWORDS_MAX = 50;
export const DESCRIPTIVE_KEYWORDS_MIN = 6;

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

function appendUniqueKeyword(target: string[], value: string | null | undefined) {
  const trimmed = value?.normalize('NFC').trim();
  if (!trimmed) return;

  const normalized = normalizeKeywordToken(trimmed);
  if (!normalized) return;
  if (target.some((entry) => normalizeKeywordToken(entry) === normalized)) return;
  target.push(trimmed);
}

function getGeoKeywordTerms(context: KeywordContext): string[] {
  return [
    context.countryName,
    context.stateName,
    context.regionName,
    context.districtName,
    context.municipalityName,
    context.localityName
  ]
    .flatMap((entry) => splitCompositeGeoValues(entry))
    .filter(Boolean);
}

function getDescriptiveKeywords(
  value: string | string[] | null | undefined,
  context: KeywordContext = {}
): string[] {
  const parsedKeywords = parseKeywords(value);
  const normalizedKeywords = parsedKeywords.map((keyword) => ({
    original: keyword,
    normalized: normalizeKeywordToken(keyword)
  }));

  const geoTerms = new Set(
    getGeoKeywordTerms(context)
      .map((entry) => normalizeKeywordToken(entry))
      .filter(Boolean)
  );

  const seen = new Set<string>();
  const fallbackCleaned: string[] = [];
  const cleaned: string[] = [];

  for (const { original, normalized } of normalizedKeywords) {
    if (!normalized) continue;
    if (/^[a-zäöüß]{1,3}$/iu.test(normalized)) continue;
    if (geoTerms.has(normalized)) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    fallbackCleaned.push(original);
  }

  for (const keyword of fallbackCleaned) {
    const normalized = normalizeKeywordToken(keyword);
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
    cleaned.push(keyword);
  }

  return cleaned.length > 0 ? cleaned : fallbackCleaned;
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
  const descriptiveKeywords = getDescriptiveKeywords(value, context);
  const result = [...descriptiveKeywords];

  if (descriptiveKeywords.length > 0) {
    const geoKeywords: string[] = [];
    getGeoKeywordTerms(context).forEach((entry) => appendUniqueKeyword(geoKeywords, entry));
    geoKeywords.slice(0, Math.max(0, KEYWORDS_MAX - descriptiveKeywords.length)).forEach((entry) => appendUniqueKeyword(result, entry));
  }

  return result.slice(0, KEYWORDS_MAX);
}

export function countDescriptiveKeywords(
  value: string | string[] | null | undefined,
  context: KeywordContext = {}
): number {
  return getDescriptiveKeywords(value, context).length;
}

export function sanitizeKeywordsText(
  value: string | string[] | null | undefined,
  context: KeywordContext = {}
): string {
  return sanitizeKeywords(value, context).join(', ');
}
