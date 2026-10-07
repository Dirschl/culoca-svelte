import type { RequestHandler } from '@sveltejs/kit';
import {
  getStoredOrComputedCanonicalPath,
  isVisibleInMainFeed
} from '$lib/content/routing';
import { DEFAULT_CONTENT_TYPE_BY_ID } from '$lib/content/types';
import { buildGeoHierarchy } from '$lib/geo/hierarchy';
import { createSupabaseServerClient } from '$lib/server/supabaseServer';
import { isItemShopIndexable, loadProfileLicensingMap } from '$lib/server/sitemapLicensing';

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
    console.log('[Sitemap] Generating dynamic sitemap...');

    const supabase = createSupabaseServerClient();

    // Base URL
    const baseUrl = 'https://culoca.com';

    // Static pages (nur öffentliche, wichtige Seiten - Login entfernt da nicht indexiert werden soll)
    // Mit priority und changefreq für bessere Indexierung
    const staticPages = [
      { url: '', priority: '1.0', changefreq: 'daily' },
      { url: '/foto', priority: '0.88', changefreq: 'daily' },
      { url: '/region', priority: '0.85', changefreq: 'daily' },
      { url: '/event', priority: '0.9', changefreq: 'daily' },
      { url: '/firma', priority: '0.9', changefreq: 'daily' },
      { url: '/video', priority: '0.8', changefreq: 'daily' },
      { url: '/musik', priority: '0.8', changefreq: 'daily' },
      { url: '/ki-bild', priority: '0.8', changefreq: 'daily' },
      { url: '/text', priority: '0.8', changefreq: 'daily' },
      { url: '/link', priority: '0.8', changefreq: 'daily' },
      { url: '/galerie', priority: '0.7', changefreq: 'daily' },
      { url: '/map-view', priority: '0.7', changefreq: 'daily' },
      { url: '/web', priority: '0.5', changefreq: 'monthly' },
      { url: '/web/license', priority: '0.55', changefreq: 'monthly' },
      { url: '/web/widerruf', priority: '0.45', changefreq: 'monthly' },
      { url: '/web/impressum', priority: '0.3', changefreq: 'yearly' },
      { url: '/web/datenschutz', priority: '0.3', changefreq: 'yearly' }
    ];

    // Entfernt: Keine Slug-Mappings mehr
    // Sitemap enthält nur korrekte Datenbank-Slugs

    const { data: typeRows } = await supabase.from('types').select('*');
    const typeMap = new Map<number, any>();
    for (const typeRow of typeRows || []) {
      typeMap.set(typeRow.id, typeRow);
    }
    for (const [id, typeDef] of DEFAULT_CONTENT_TYPE_BY_ID.entries()) {
      if (!typeMap.has(id)) {
        typeMap.set(id, typeDef);
      }
    }

    // Fetch all public items in batches to bypass limits
    let allItems: any[] = [];
    
    try {
      console.log('[Sitemap] Attempting to fetch all items from database...');
      
      // Fetch items in batches of 1000
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        console.log(`[Sitemap] Fetching batch starting at offset ${offset}...`);
        
        const { data, error } = await supabase
          .from('items')
          .select('id, slug, title, description, path_2048, path_512, created_at, updated_at, type_id, group_root_item_id, group_slug, canonical_path, country_slug, country_name, state_slug, state_name, region_slug, region_name, district_slug, district_name, municipality_slug, municipality_name, show_in_main_feed, is_private, ends_at, profile_id, stock_settings')
          .not('slug', 'is', null)
          // Auch Motive aufnehmen, bei denen nur die grosse Variante vorhanden ist.
          .or('path_2048.not.is.null,path_512.not.is.null')
          // Public items include false and null (legacy rows)
          .or('is_private.eq.false,is_private.is.null')
          .order('updated_at', { ascending: false })
          .range(offset, offset + batchSize - 1);
        
        if (error) {
          console.error('[Sitemap] Database error:', error);
          break;
        }
        
        const batch = data || [];
        allItems = allItems.concat(batch);
        console.log(`[Sitemap] Fetched batch of ${batch.length} items, total: ${allItems.length}`);
        
        // If we got less than batchSize, we've reached the end
        if (batch.length < batchSize) {
          hasMore = false;
        } else {
          offset += batchSize;
        }
      }
      
      console.log(`[Sitemap] Total items fetched: ${allItems.length}`);
      
      // Debug: Log first few items to see what we got
      if (allItems.length > 0) {
        console.log('[Sitemap] Sample items:', allItems.slice(0, 3));
        console.log('[Sitemap] Sample timestamps:', allItems.slice(0, 3).map(item => ({
          slug: item.slug,
          created_at: item.created_at,
          updated_at: item.updated_at
        })));
      }
    } catch (error) {
      console.error('[Sitemap] Critical database error:', error);
      // Continue with empty items array
    }

    const rootIds = Array.from(
      new Set(
        allItems
          .map((item) => item.group_root_item_id)
          .filter(Boolean)
      )
    );
    const rootMap = new Map<string, any>();
    if (rootIds.length > 0) {
      const { data: rootRows } = await supabase
        .from('items')
        .select('id, slug, type_id, group_slug, canonical_path, country_slug, country_name, state_slug, state_name, region_slug, region_name, district_slug, district_name, municipality_slug, municipality_name')
        .in('id', rootIds);

      for (const rootRow of rootRows || []) {
        rootMap.set(rootRow.id, rootRow);
      }
    }

    const seenCanonicalPaths = new Set<string>();
    const sitemapItems = allItems.filter((item) => {
      const rootItem = item.group_root_item_id ? rootMap.get(item.group_root_item_id) ?? null : null;
      const type = item.type_id ? typeMap.get(item.type_id) ?? null : null;
      const canonicalPath = getStoredOrComputedCanonicalPath({ item, rootItem, type });
      if (!canonicalPath || !isVisibleInMainFeed(item) || seenCanonicalPaths.has(canonicalPath)) {
        return false;
      }
      seenCanonicalPaths.add(canonicalPath);
      return true;
    });

    console.log(`[Sitemap] Found ${sitemapItems.length} public items`);

    const profileLicensingMap = await loadProfileLicensingMap(
      supabase,
      sitemapItems.map((item) => item.profile_id).filter(Boolean)
    );
    let licenseDownloadUrlCount = 0;
    const contentDates = sitemapItems
      .map((item) => sitemapDate(item.updated_at || item.created_at))
      .filter((value): value is string => !!value)
      .sort();
    const latestContentDate = contentDates[contentDates.length - 1] ?? null;
    const latestDateByType = new Map<number, string>();
    for (const item of sitemapItems) {
      const date = sitemapDate(item.updated_at || item.created_at);
      if (!date || !item.type_id) continue;
      const previous = latestDateByType.get(item.type_id);
      if (!previous || date > previous) latestDateByType.set(item.type_id, date);
    }

    // Generate XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

    // Add static pages with lastmod, priority und changefreq
    for (const page of staticPages) {
      xml += '  <url>\n';
      xml += `    <loc>${xmlEscape(`${baseUrl}${page.url}`)}</loc>\n`;
      // Nur echte Inhaltsuebersichten mit dem letzten Inhaltsdatum markieren.
      // Fuer statische Rechts-/Infoseiten waere ein taeglich erfundenes lastmod irrefuehrend.
      const typeDefinition = Array.from(DEFAULT_CONTENT_TYPE_BY_ID.values()).find(
        (typeDef) => page.url === `/${typeDef.slug}`
      );
      const pageLastModified = typeDefinition?.id
        ? latestDateByType.get(typeDefinition.id) ?? null
        : ['', '/region', '/galerie', '/map-view'].includes(page.url)
          ? latestContentDate
          : null;
      if (pageLastModified) xml += `    <lastmod>${pageLastModified}</lastmod>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += '  </url>\n';
    }

    // Add only shallow pagination pages. Deeper pages stay crawlable via links but do not consume sitemap budget.
    for (const [, typeDef] of DEFAULT_CONTENT_TYPE_BY_ID.entries()) {
      const typeItems = sitemapItems.filter(item => item.type_id === typeDef.id);
      const typePages = Math.max(1, Math.ceil(typeItems.length / 24));
      for (let p = 2; p <= Math.min(typePages, 2); p++) {
        xml += '  <url>\n';
        xml += `    <loc>${xmlEscape(`${baseUrl}/${typeDef.slug}?seite=${p}`)}</loc>\n`;
        const typeLastModified = latestDateByType.get(typeDef.id);
        if (typeLastModified) xml += `    <lastmod>${typeLastModified}</lastmod>\n`;
        xml += '    <priority>0.6</priority>\n';
        xml += '    <changefreq>daily</changefreq>\n';
        xml += '  </url>\n';
      }
    }

    const itemCountsByProfile = new Map<string, number>();
    const latestDateByProfile = new Map<string, string>();
    for (const item of sitemapItems) {
      if (!item.profile_id) continue;
      itemCountsByProfile.set(item.profile_id, (itemCountsByProfile.get(item.profile_id) || 0) + 1);
      const date = sitemapDate(item.updated_at || item.created_at);
      const previous = latestDateByProfile.get(item.profile_id);
      if (date && (!previous || date > previous)) latestDateByProfile.set(item.profile_id, date);
    }

    const latestDateByGeoHub = new Map<string, string>();
    for (const item of sitemapItems) {
      const rootItem = item.group_root_item_id ? rootMap.get(item.group_root_item_id) ?? null : null;
      const geoSource = rootItem || item;
      const levels = buildGeoHierarchy({
        countrySlug: geoSource.country_slug,
        countryName: geoSource.country_name,
        stateSlug: geoSource.state_slug,
        stateName: geoSource.state_name,
        regionSlug: geoSource.region_slug,
        regionName: geoSource.region_name,
        districtSlug: geoSource.district_slug,
        districtName: geoSource.district_name,
        municipalitySlug: geoSource.municipality_slug,
        municipalityName: geoSource.municipality_name
      });
      const itemDate = sitemapDate(item.updated_at || item.created_at);
      for (const level of levels) {
        const previous = latestDateByGeoHub.get(level.path);
        if (itemDate && (!previous || itemDate > previous)) {
          latestDateByGeoHub.set(level.path, itemDate);
        } else if (!latestDateByGeoHub.has(level.path)) {
          latestDateByGeoHub.set(level.path, '');
        }
      }
    }

    for (const path of Array.from(latestDateByGeoHub.keys()).sort()) {
      xml += '  <url>\n';
      xml += `    <loc>${xmlEscape(`${baseUrl}${path}`)}</loc>\n`;
      const hubLastModified = latestDateByGeoHub.get(path);
      if (hubLastModified) xml += `    <lastmod>${hubLastModified}</lastmod>\n`;
      xml += '    <priority>0.7</priority>\n';
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '  </url>\n';
    }

    const publicProfileIds = Array.from(itemCountsByProfile.keys());
    if (publicProfileIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, accountname')
        .in('id', publicProfileIds)
        .not('accountname', 'is', null);

      for (const profile of profiles || []) {
        if (!profile.accountname) continue;
        xml += '  <url>\n';
        xml += `    <loc>${xmlEscape(`${baseUrl}/${profile.accountname}`)}</loc>\n`;
        const profileLastModified = latestDateByProfile.get(profile.id);
        if (profileLastModified) xml += `    <lastmod>${profileLastModified}</lastmod>\n`;
        xml += '    <priority>0.7</priority>\n';
        xml += '    <changefreq>weekly</changefreq>\n';
        xml += '  </url>\n';
      }
    }

    // Add item pages with optimized data (following Google's current guidelines)
    for (const item of sitemapItems) {
      const rootItem = item.group_root_item_id ? rootMap.get(item.group_root_item_id) ?? null : null;
      const type = item.type_id ? typeMap.get(item.type_id) ?? null : null;
      const canonicalPath = getStoredOrComputedCanonicalPath({ item, rootItem, type });
      if (!canonicalPath) continue;

      xml += '  <url>\n';
      xml += `    <loc>${xmlEscape(`${baseUrl}${canonicalPath}`)}</loc>\n`;
      
      // Verwende tatsächliches Änderungsdatum für bessere Crawl-Effizienz
      const lastModDate = item.updated_at || item.created_at;
      const formattedDate = sitemapDate(lastModDate);
      if (formattedDate) xml += `    <lastmod>${formattedDate}</lastmod>\n`;
      xml += `    <priority>0.95</priority>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      
      // Add enhanced image data for better SEO
      // Use SEO-friendly URL with size suffix: /images/{slug}-2048.jpg (no query parameters)
      if (item.path_2048 || item.path_512) {
        xml += '    <image:image>\n';
        
        // Determine file extension from path_2048 or path_512
        // Extract extension from the actual file path (e.g., "abc123.jpg" -> ".jpg")
        const imagePath = item.path_2048 || item.path_512;
        const extensionMatch = imagePath.match(/\.(jpg|jpeg|webp|png)$/i);
        const fileExtension = extensionMatch ? extensionMatch[0].toLowerCase() : '.jpg';
        
        // Use SEO-friendly URL with size suffix (2048px version preferred)
        // This gives Google a meaningful filename instead of UUID-based filenames
        // Note: <image:title> and <image:caption> are deprecated by Google
        // Focus on <image:loc> - the actual URL is what matters for indexing
        const seoImageUrl = `${baseUrl}/images/${item.slug}-2048${fileExtension}`;
        xml += `      <image:loc>${xmlEscape(seoImageUrl)}</image:loc>\n`;
        
        xml += '    </image:image>\n';
      }
      
      xml += '  </url>\n';

      if (isItemShopIndexable(item, profileLicensingMap)) {
        licenseDownloadUrlCount += 1;
        xml += '  <url>\n';
        xml += `    <loc>${xmlEscape(`${baseUrl}${canonicalPath}/download`)}</loc>\n`;
        if (formattedDate) xml += `    <lastmod>${formattedDate}</lastmod>\n`;
        xml += '    <priority>0.9</priority>\n';
        xml += '    <changefreq>weekly</changefreq>\n';
        xml += '  </url>\n';
      }
    }

    // Entfernt: Keine "gone" Einträge mehr
    // Sitemap enthält nur korrekte Datenbank-Slugs

    xml += '</urlset>';

    console.log(`[Sitemap] Generated sitemap with ${staticPages.length} static pages, ${sitemapItems.length} items and ${licenseDownloadUrlCount} license/download URLs`);
    console.log(`[Sitemap] Items use their actual updated_at/created_at dates for better crawl efficiency`);

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour for better performance
      }
    });

  } catch (error) {
    console.error('[Sitemap] Error generating sitemap:', error);
    return new Response('Internal server error', { status: 500 });
  }
}; 
