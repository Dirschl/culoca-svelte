import { createClient } from '@supabase/supabase-js';
import { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import type { RequestHandler } from '@sveltejs/kit';

const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

export const GET: RequestHandler = async () => {
  try {
    console.log('[Sitemap] Generating dynamic sitemap...');

    // Base URL
    const baseUrl = 'https://culoca.com';

    // Static pages
    const staticPages = [
      '',
      '/login',
      '/profile',
      '/settings',
      '/upload',
      '/bulk-upload',
      '/map-view',
      '/simulation',
      '/admin',
      '/datenschutz',
      '/impressum'
    ];

    // Get all public items from database
    const { data: items, error } = await supabase
      .from('items')
      .select('slug, updated_at')
      .not('slug', 'is', null)
      .or('is_private.eq.false,is_private.is.null')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[Sitemap] Database error:', error);
      return new Response('Database error', { status: 500 });
    }

    console.log(`[Sitemap] Found ${items?.length || 0} public items`);

    // Generate XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Add static pages
    for (const page of staticPages) {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}${page}</loc>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.8</priority>\n';
      xml += '  </url>\n';
    }

    // Add item pages
    if (items) {
      for (const item of items) {
        xml += '  <url>\n';
        xml += `    <loc>${baseUrl}/item/${item.slug}</loc>\n`;
        if (item.updated_at) {
          xml += `    <lastmod>${new Date(item.updated_at).toISOString()}</lastmod>\n`;
        }
        xml += '    <changefreq>monthly</changefreq>\n';
        xml += '    <priority>0.6</priority>\n';
        xml += '  </url>\n';
      }
    }

    // Add pagination pages for NewsFlash (SEO-friendly)
    const totalItems = items?.length || 0;
    const itemsPerPage = 50;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    for (let page = 1; page <= Math.min(totalPages, 10); page++) { // Limit to 10 pages for performance
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}/?page=${page}</loc>\n`;
      xml += '    <changefreq>daily</changefreq>\n';
      xml += '    <priority>0.7</priority>\n';
      xml += '  </url>\n';
    }

    xml += '</urlset>';

    console.log(`[Sitemap] Generated sitemap with ${staticPages.length} static pages, ${items?.length || 0} items, and ${Math.min(totalPages, 10)} pagination pages`);

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