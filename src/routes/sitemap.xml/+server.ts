import type { RequestHandler } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import {
  getStoredOrComputedCanonicalPath,
  isVisibleInMainFeed
} from '$lib/content/routing';
import { DEFAULT_CONTENT_TYPE_BY_ID } from '$lib/content/types';

export const GET: RequestHandler = async () => {
  try {
    console.log('[Sitemap] Generating dynamic sitemap...');

    // Base URL
    const baseUrl = 'https://culoca.com';

    // Static pages (nur öffentliche, wichtige Seiten - Login entfernt da nicht indexiert werden soll)
    // Mit priority und changefreq für bessere Indexierung
    const staticPages = [
      { url: '', priority: '1.0', changefreq: 'daily' },
      { url: '/foto', priority: '0.9', changefreq: 'daily' },
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
          .select('id, slug, title, description, path_2048, path_512, created_at, updated_at, type_id, group_root_item_id, group_slug, canonical_path, country_slug, district_slug, municipality_slug, show_in_main_feed, is_private, ends_at, profile_id')
          .not('slug', 'is', null)
          .not('path_512', 'is', null)
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
        .select('id, slug, type_id, group_slug, canonical_path, country_slug, district_slug, municipality_slug')
        .in('id', rootIds);

      for (const rootRow of rootRows || []) {
        rootMap.set(rootRow.id, rootRow);
      }
    }

    const sitemapItems = allItems.filter((item) => {
      const rootItem = item.group_root_item_id ? rootMap.get(item.group_root_item_id) ?? null : null;
      const type = item.type_id ? typeMap.get(item.type_id) ?? null : null;
      const canonicalPath = getStoredOrComputedCanonicalPath({ item, rootItem, type });
      return !!canonicalPath && isVisibleInMainFeed(item);
    });

    console.log(`[Sitemap] Found ${sitemapItems.length} public items`);

    // Generate XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

    // Add static pages with lastmod, priority und changefreq
    for (const page of staticPages) {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}${page.url}</loc>\n`;
      // Add lastmod for static pages (date only, no seconds to avoid micro-updates)
      const currentDate = new Date().toISOString().split('T')[0];
      xml += `    <lastmod>${currentDate}</lastmod>\n`;
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
        xml += `    <loc>${baseUrl}/${typeDef.slug}?seite=${p}</loc>\n`;
        const currentDate = new Date().toISOString().split('T')[0];
        xml += `    <lastmod>${currentDate}</lastmod>\n`;
        xml += '    <priority>0.6</priority>\n';
        xml += '    <changefreq>daily</changefreq>\n';
        xml += '  </url>\n';
      }
    }

    const itemCountsByProfile = new Map<string, number>();
    for (const item of sitemapItems) {
      if (!item.profile_id) continue;
      itemCountsByProfile.set(item.profile_id, (itemCountsByProfile.get(item.profile_id) || 0) + 1);
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
        xml += `    <loc>${baseUrl}/${profile.accountname}</loc>\n`;
        xml += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
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
      xml += `    <loc>${baseUrl}${canonicalPath}</loc>\n`;
      
      // Verwende tatsächliches Änderungsdatum für bessere Crawl-Effizienz
      const lastModDate = item.updated_at || item.created_at;
      const formattedDate = lastModDate ? new Date(lastModDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      xml += `    <lastmod>${formattedDate}</lastmod>\n`;
      
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
        const seoImageUrl = item.path_2048
          ? `${baseUrl}/images/${item.slug}-2048${fileExtension}`
          : `${baseUrl}/images/${item.slug}-512${fileExtension}`;
        xml += `      <image:loc>${seoImageUrl}</image:loc>\n`;
        
        xml += '    </image:image>\n';
      }
      
      xml += '  </url>\n';
    }

    // Entfernt: Keine "gone" Einträge mehr
    // Sitemap enthält nur korrekte Datenbank-Slugs

    xml += '</urlset>';

    console.log(`[Sitemap] Generated sitemap with ${staticPages.length} static pages and ${sitemapItems.length} items`);
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
