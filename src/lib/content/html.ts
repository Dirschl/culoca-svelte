const ALLOWED_TAGS = new Set(['h2', 'h3', 'h4', 'h5', 'p', 'br', 'li', 'strong', 'a']);
const SELF_CLOSING_TAGS = new Set(['br']);
const HREF_PATTERN = /href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function normalizeHref(rawHref: string | null | undefined): string | null {
  if (!rawHref) return null;
  const href = decodeHtmlAttribute(rawHref.trim());
  if (!href) return null;

  if (
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('/') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:')
  ) {
    return href;
  }

  return null;
}

function sanitizeTag(tagSource: string): string {
  const isClosing = /^<\s*\//.test(tagSource);
  const tagNameMatch = tagSource.match(/^<\s*\/?\s*([a-z0-9]+)/i);
  const rawTagName = tagNameMatch?.[1]?.toLowerCase();

  if (!rawTagName || !ALLOWED_TAGS.has(rawTagName)) {
    return '';
  }

  if (isClosing) {
    return SELF_CLOSING_TAGS.has(rawTagName) ? '' : `</${rawTagName}>`;
  }

  if (rawTagName === 'a') {
    const hrefMatch = tagSource.match(HREF_PATTERN);
    const normalizedHref = normalizeHref(hrefMatch?.[2] || hrefMatch?.[3] || hrefMatch?.[4] || null);

    if (!normalizedHref) {
      return '';
    }

    const escapedHref = escapeHtml(normalizedHref);
    const isExternal = /^https?:\/\//.test(normalizedHref);
    return isExternal
      ? `<a href="${escapedHref}" target="_blank" rel="noopener noreferrer nofollow">`
      : `<a href="${escapedHref}">`;
  }

  if (SELF_CLOSING_TAGS.has(rawTagName)) {
    return `<${rawTagName}>`;
  }

  return `<${rawTagName}>`;
}

export function sanitizeContentHtml(input: string | null | undefined): string {
  if (!input) return '';

  const source = String(input);
  let result = '';
  let lastIndex = 0;
  const tagPattern = /<[^>]*>/g;

  for (const match of source.matchAll(tagPattern)) {
    const start = match.index ?? 0;
    result += escapeHtml(source.slice(lastIndex, start));
    result += sanitizeTag(match[0]);
    lastIndex = start + match[0].length;
  }

  result += escapeHtml(source.slice(lastIndex));
  return result.trim();
}
