import type { RequestHandler } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

export const GET: RequestHandler = async () => {
  try {
    console.log('[Sitemap] Generating dynamic sitemap...');

    // Base URL
    const baseUrl = 'https://culoca.com';

    // Static pages (nur öffentliche, wichtige Seiten - Login entfernt da nicht indexiert werden soll)
    // Mit priority und changefreq für bessere Indexierung
    const staticPages = [
      { url: '', priority: '1.0', changefreq: 'daily' },  // Startseite - höchste Priorität
      { url: '/map-view', priority: '0.8', changefreq: 'daily' },
      { url: '/bulk-upload', priority: '0.7', changefreq: 'weekly' },
      { url: '/search', priority: '0.8', changefreq: 'daily' },
      { url: '/web', priority: '0.6', changefreq: 'monthly' },
      { url: '/datenschutz', priority: '0.3', changefreq: 'yearly' },
      { url: '/impressum', priority: '0.3', changefreq: 'yearly' }
    ];

    // Entfernt: Keine Slug-Mappings mehr
    // Sitemap enthält nur korrekte Datenbank-Slugs

    // Fetch all items in batches to bypass limits
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
          .select('slug, title, description, path_2048, path_512, created_at, updated_at')
          .not('slug', 'is', null)
          .eq('is_private', false) // Only public items
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

    console.log(`[Sitemap] Found ${allItems.length} public items`);

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

    // Add item pages with optimized data (following Google's current guidelines)
    for (const item of allItems) {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}/item/${item.slug}</loc>\n`;
      
      // Verwende tatsächliches Änderungsdatum für bessere Crawl-Effizienz
      const lastModDate = item.updated_at || item.created_at;
      const formattedDate = lastModDate ? new Date(lastModDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      xml += `    <lastmod>${formattedDate}</lastmod>\n`;
      
      // Add enhanced image data for better SEO
      // Use SEO-friendly URL with slug-based filename: /images/{slug}.jpg
      if (item.path_2048 || item.path_512) {
        xml += '    <image:image>\n';
        
        // Determine file extension from path_2048 or path_512
        // Extract extension from the actual file path (e.g., "abc123.jpg" -> ".jpg")
        const imagePath = item.path_2048 || item.path_512;
        const extensionMatch = imagePath.match(/\.(jpg|jpeg|webp|png)$/i);
        const fileExtension = extensionMatch ? extensionMatch[0].toLowerCase() : '.jpg';
        
        // Use SEO-friendly URL with slug-based filename
        // This gives Google a meaningful filename instead of UUID-based filenames
        // Note: <image:title> and <image:caption> are deprecated by Google
        // Focus on <image:loc> - the actual URL is what matters for indexing
        const seoImageUrl = `${baseUrl}/images/${item.slug}${fileExtension}`;
        xml += `      <image:loc>${seoImageUrl}</image:loc>\n`;
        
        xml += '    </image:image>\n';
      }
      
      xml += '  </url>\n';
    }

    // Entfernt: Keine "gone" Einträge mehr
    // Sitemap enthält nur korrekte Datenbank-Slugs

    xml += '</urlset>';

    console.log(`[Sitemap] Generated sitemap with ${staticPages.length} static pages and ${allItems.length} items`);
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