import type { RequestHandler } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

export const GET: RequestHandler = async () => {
  try {
    console.log('[Sitemap] Generating dynamic sitemap...');

    // Base URL
    const baseUrl = 'https://culoca.com';

    // Static pages (nur öffentliche, wichtige Seiten - Login entfernt da nicht indexiert werden soll)
    const staticPages = [
      '',
      '/map-view',
      '/datenschutz',
      '/impressum'
    ];

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

    // Add static pages with lastmod (removed changefreq and priority as per Google guidelines)
    for (const page of staticPages) {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}${page}</loc>\n`;
      // Add lastmod for static pages (date only, no seconds to avoid micro-updates)
      const currentDate = new Date().toISOString().split('T')[0];
      xml += `    <lastmod>${currentDate}</lastmod>\n`;
      xml += '  </url>\n';
    }

    // Add item pages with optimized data (following Google's current guidelines)
    for (const item of allItems) {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}/item/${item.slug}</loc>\n`;
      
      // Add lastmod using created_at as fallback if updated_at is not available
      // Round to seconds (remove milliseconds) as per Google guidelines
      let lastmod = null;
      if (item.updated_at && item.updated_at !== null) {
        try {
          lastmod = new Date(item.updated_at).toISOString().split('.')[0] + 'Z';
        } catch (error) {
          console.log('[Sitemap] Invalid updated_at for item:', item.slug, item.updated_at);
        }
      } else if (item.created_at && item.created_at !== null) {
        try {
          lastmod = new Date(item.created_at).toISOString().split('.')[0] + 'Z';
        } catch (error) {
          console.log('[Sitemap] Invalid created_at for item:', item.slug, item.created_at);
        }
      }
      
      if (lastmod) {
        xml += `    <lastmod>${lastmod}</lastmod>\n`;
      }
      
      // Add minimal image data (Google's current recommendation)
      if (item.path_2048 || item.path_512) {
        xml += '    <image:image>\n';
        // Use 2048px if available, otherwise fallback to 512px
        const imagePath = item.path_2048 || item.path_512;
        const imageBucket = item.path_2048 ? 'images-2048' : 'images-512';
        xml += `      <image:loc>https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/${imageBucket}/${imagePath}</image:loc>\n`;
        // Removed image:title and image:caption as per Google's current guidelines
        xml += '    </image:image>\n';
      }
      
      xml += '  </url>\n';
    }

    xml += '</urlset>';

    console.log(`[Sitemap] Generated sitemap with ${staticPages.length} static pages and ${allItems.length} items`);

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    });

  } catch (error) {
    console.error('[Sitemap] Error generating sitemap:', error);
    return new Response('Internal server error', { status: 500 });
  }
}; 