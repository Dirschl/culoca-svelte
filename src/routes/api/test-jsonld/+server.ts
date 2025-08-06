import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const targetUrl = url.searchParams.get('url');
  
  if (!targetUrl) {
    return json({ error: 'URL parameter is required' }, { status: 400 });
  }

  // Remove URL validation - allow any URL for testing
  // if (!targetUrl.includes('culoca.com/item/')) {
  //   return json({ error: 'Invalid Culoca URL format' }, { status: 400 });
  // }

  try {
    // Fetch the page content
    const response = await fetch(targetUrl);
    
    if (!response.ok) {
      return json({ 
        error: `HTTP ${response.status}: ${response.statusText}` 
      }, { status: response.status });
    }
    
    const html = await response.text();
    
    // Extract JSON-LD script tag
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    
    if (!jsonLdMatch) {
      return json({ error: 'No JSON-LD data found' }, { status: 404 });
    }
    
    const jsonLdString = jsonLdMatch[1].trim();
    
    // Validate and parse JSON
    try {
      const jsonObj = JSON.parse(jsonLdString);
      return json({ 
        success: true, 
        data: jsonObj,
        formatted: JSON.stringify(jsonObj, null, 2)
      });
    } catch (parseError) {
      return json({ error: 'Invalid JSON-LD data' }, { status: 400 });
    }
    
  } catch (error: any) {
    return json({ 
      error: error.message || 'Failed to fetch URL' 
    }, { status: 500 });
  }
}; 