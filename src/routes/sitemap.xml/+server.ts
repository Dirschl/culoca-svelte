import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from '@sveltejs/kit';

// Use environment variables with fallbacks for build process
const supabaseUrl = (typeof process !== 'undefined' && process.env?.PUBLIC_SUPABASE_URL) || 
                   (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
                   (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_SUPABASE_URL) ||
                   (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
                   'https://caskhmcbvtevdwsolvwk.supabase.co';

const supabaseServiceKey = (typeof process !== 'undefined' && process.env?.SUPABASE_SERVICE_ROLE_KEY) ||
                          (typeof import.meta !== 'undefined' && import.meta.env?.SUPABASE_SERVICE_ROLE_KEY);

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
  db: {
    schema: 'public'
  }
});

export const GET: RequestHandler = async () => {
  try {
    console.log('[Sitemap] Generating dynamic sitemap...');

    // Base URL
    const baseUrl = 'https://culoca.com';

    // Static pages (nur öffentliche, wichtige Seiten)
    const staticPages = [
      '',
      '/login',
      '/map-view',
      '/datenschutz',
      '/impressum'
    ];

    // Alle Items in Batches holen - jetzt mit title und description
    let allItems: any[] = [];
    let batchSize = 1000;
    let offset = 0;
    let fetched = 0;
    do {
      const { data, error } = await supabase
        .from('items')
        .select('slug, title, description, path_512, updated_at')
        .not('slug', 'is', null)
        .or('is_private.eq.false,is_private.is.null')
        .order('updated_at', { ascending: false })
        .range(offset, offset + batchSize - 1);
      if (error) {
        console.error('[Sitemap] Database error:', error);
        return new Response('Database error', { status: 500 });
      }
      fetched = data?.length || 0;
      if (fetched > 0) allItems.push(...data);
      offset += batchSize;
    } while (fetched === batchSize);

    console.log(`[Sitemap] Found ${allItems.length} public items`);

    // Generate XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

    // Add static pages
    for (const page of staticPages) {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}${page}</loc>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.7</priority>\n';
      xml += '  </url>\n';
    }

    // Add item pages with rich data
    for (const item of allItems) {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}/item/${item.slug}</loc>\n`;
      if (item.updated_at) {
        xml += `    <lastmod>${new Date(item.updated_at).toISOString()}</lastmod>\n`;
      }
      xml += '    <changefreq>monthly</changefreq>\n';
      xml += '    <priority>0.9</priority>\n';
      
      // Add image data for rich snippets
      if (item.path_512) {
        xml += '    <image:image>\n';
        xml += `      <image:loc>https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${item.path_512}</image:loc>\n`;
        if (item.title) {
          xml += `      <image:title>${item.title.replace(/[<>&'"]/g, '')}</image:title>\n`;
        }
        if (item.description) {
          xml += `      <image:caption>${item.description.replace(/[<>&'"]/g, '').substring(0, 200)}</image:caption>\n`;
        }
        xml += '    </image:image>\n';
      }
      
      xml += '  </url>\n';
    }

    // Add pagination pages for NewsFlash (SEO-friendly)
    const totalItems = allItems.length;
    const itemsPerPage = 50;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    for (let page = 1; page <= Math.min(totalPages, 10); page++) { // Limit to 10 pages for performance
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}/?page=${page}</loc>\n`;
      xml += '    <changefreq>daily</changefreq>\n';
      xml += '    <priority>0.5</priority>\n';
      xml += '  </url>\n';
    }

    xml += '</urlset>';

    console.log(`[Sitemap] Generated sitemap with ${staticPages.length} static pages, ${allItems.length} items, and ${Math.min(totalPages, 10)} pagination pages`);

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