import type { RequestHandler } from '@sveltejs/kit';
import {
  getStoredOrComputedCanonicalPath,
  isVisibleInMainFeed
} from '$lib/content/routing';
import { DEFAULT_CONTENT_TYPE_BY_ID } from '$lib/content/types';
import { createSupabaseServerClient } from '$lib/server/supabaseServer';

const BASE_URL = 'https://culoca.com';
const BATCH_SIZE = 1000;

function xmlEscape(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sitemapDate(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
}

export const GET: RequestHandler = async () => {
  try {
    const supabase = createSupabaseServerClient();
    const { data: typeRows, error: typeError } = await supabase.from('types').select('*');
    if (typeError) throw typeError;

    const typeMap = new Map<number, any>();
    for (const typeRow of typeRows || []) typeMap.set(typeRow.id, typeRow);
    for (const [id, typeDef] of DEFAULT_CONTENT_TYPE_BY_ID.entries()) {
      if (!typeMap.has(id)) typeMap.set(id, typeDef);
    }

    let allItems: any[] = [];
    for (let offset = 0; ; offset += BATCH_SIZE) {
      const { data, error } = await supabase
        .from('items')
        .select('id, slug, path_2048, path_512, created_at, updated_at, type_id, group_root_item_id, group_slug, canonical_path, country_slug, state_slug, region_slug, district_slug, municipality_slug, show_in_main_feed, is_private, ends_at')
        .not('slug', 'is', null)
        .or('path_2048.not.is.null,path_512.not.is.null')
        .or('is_private.eq.false,is_private.is.null')
        .order('updated_at', { ascending: false })
        .order('id', { ascending: true })
        .range(offset, offset + BATCH_SIZE - 1);

      if (error) throw error;
      const batch = data || [];
      allItems = allItems.concat(batch);
      if (batch.length < BATCH_SIZE) break;
    }

    const rootIds = Array.from(
      new Set(allItems.map((item) => item.group_root_item_id).filter(Boolean))
    );
    const rootMap = new Map<string, any>();
    if (rootIds.length > 0) {
      const { data: rootRows, error: rootError } = await supabase
        .from('items')
        .select('id, slug, type_id, group_slug, canonical_path, country_slug, state_slug, region_slug, district_slug, municipality_slug')
        .in('id', rootIds);
      if (rootError) throw rootError;
      for (const rootRow of rootRows || []) rootMap.set(rootRow.id, rootRow);
    }

    const seenCanonicalPaths = new Set<string>();
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

    for (const item of allItems) {
      const rootItem = item.group_root_item_id ? rootMap.get(item.group_root_item_id) ?? null : null;
      const type = item.type_id ? typeMap.get(item.type_id) ?? null : null;
      const canonicalPath = getStoredOrComputedCanonicalPath({ item, rootItem, type });
      if (!canonicalPath || !isVisibleInMainFeed(item) || seenCanonicalPaths.has(canonicalPath)) continue;
      seenCanonicalPaths.add(canonicalPath);

      const imagePath = item.path_2048 || item.path_512;
      const extensionMatch = imagePath.match(/\.(jpg|jpeg|webp|png)$/i);
      const fileExtension = extensionMatch ? extensionMatch[0].toLowerCase() : '.jpg';
      const imageUrl = `${BASE_URL}/images/${item.slug}-2048${fileExtension}`;
      const lastModified = sitemapDate(item.updated_at || item.created_at);

      xml += '  <url>\n';
      xml += `    <loc>${xmlEscape(`${BASE_URL}${canonicalPath}`)}</loc>\n`;
      if (lastModified) xml += `    <lastmod>${lastModified}</lastmod>\n`;
      xml += '    <image:image>\n';
      xml += `      <image:loc>${xmlEscape(imageUrl)}</image:loc>\n`;
      xml += '    </image:image>\n';
      xml += '  </url>\n';
    }

    xml += '</urlset>';

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (error) {
    console.error('[Image Sitemap] Error generating sitemap:', error);
    return new Response('Internal server error', { status: 500 });
  }
};
