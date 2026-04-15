import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPublicItemHref } from '$lib/content/routing';

type HealthEntry = {
  url: string;
  status: number;
  isRedirect: boolean;
  error: string | null;
};

export const GET: RequestHandler = async () => {
  try {
    const { supabase } = await import('$lib/supabaseClient');
    
    // Fetch all public items for health check
    const { data: items, error } = await supabase
      .from('items')
      .select(
        'slug, path_2048, path_512, canonical_path, country_slug, state_slug, region_slug, district_slug, municipality_slug'
      )
      .not('slug', 'is', null)
      .eq('is_private', false);
    
    if (error) {
      return json({ error: 'Database error', details: error }, { status: 500 });
    }

    const healthResults: {
      staticPages: HealthEntry[];
      itemPages: HealthEntry[];
      imageUrls: HealthEntry[];
      summary: { total: number; errors: number; redirects: number; ok: number };
    } = {
      staticPages: [],
      itemPages: [],
      imageUrls: [],
      summary: {
        total: 0,
        errors: 0,
        redirects: 0,
        ok: 0
      }
    };

    // Check static pages
    const staticPages = [
      'https://culoca.com',
      'https://culoca.com/map-view',
      'https://culoca.com/datenschutz',
      'https://culoca.com/impressum'
    ];

    for (const url of staticPages) {
      try {
        const response = await fetch(url, { method: 'HEAD' });
        const status = response.status;
        const isRedirect = status >= 300 && status < 400;
        
        healthResults.staticPages.push({
          url,
          status,
          isRedirect,
          error: status >= 400 ? `HTTP ${status}` : null
        });

        if (status === 200) healthResults.summary.ok++;
        else if (isRedirect) healthResults.summary.redirects++;
        else healthResults.summary.errors++;
        
        healthResults.summary.total++;
      } catch (error: unknown) {
        healthResults.staticPages.push({
          url,
          status: 0,
          isRedirect: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        healthResults.summary.errors++;
        healthResults.summary.total++;
      }
    }

    // Check item pages (sample first 10)
    const sampleItems = items?.slice(0, 10) || [];
    for (const item of sampleItems) {
      const url = new URL(getPublicItemHref(item), 'https://culoca.com').href;
      try {
        const response = await fetch(url, { method: 'HEAD' });
        const status = response.status;
        const isRedirect = status >= 300 && status < 400;
        
        healthResults.itemPages.push({
          url,
          status,
          isRedirect,
          error: status >= 400 ? `HTTP ${status}` : null
        });

        if (status === 200) healthResults.summary.ok++;
        else if (isRedirect) healthResults.summary.redirects++;
        else healthResults.summary.errors++;
        
        healthResults.summary.total++;
      } catch (error: unknown) {
        healthResults.itemPages.push({
          url,
          status: 0,
          isRedirect: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        healthResults.summary.errors++;
        healthResults.summary.total++;
      }
    }

    // Check image URLs (sample first 10)
    for (const item of sampleItems) {
      const imagePath = item.path_2048 || item.path_512;
      const imageBucket = item.path_2048 ? 'images-2048' : 'images-512';
      const imageUrl = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/${imageBucket}/${imagePath}`;
      
      try {
        const response = await fetch(imageUrl, { method: 'HEAD' });
        const status = response.status;
        const isRedirect = status >= 300 && status < 400;
        
        healthResults.imageUrls.push({
          url: imageUrl,
          status,
          isRedirect,
          error: status >= 400 ? `HTTP ${status}` : null
        });

        if (status === 200) healthResults.summary.ok++;
        else if (isRedirect) healthResults.summary.redirects++;
        else healthResults.summary.errors++;
        
        healthResults.summary.total++;
      } catch (error: unknown) {
        healthResults.imageUrls.push({
          url: imageUrl,
          status: 0,
          isRedirect: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        healthResults.summary.errors++;
        healthResults.summary.total++;
      }
    }

    return json({
      success: true,
      message: 'Sitemap health check completed',
      results: healthResults,
      timestamp: new Date().toISOString()
    });

  } catch (error: unknown) {
    console.error('Error in sitemap health check:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
