import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const targetUrl = url.searchParams.get('url');
  
  if (!targetUrl) {
    return json({ error: 'URL parameter is required' }, { status: 400 });
  }

  try {
    // Fetch the page content
    const response = await fetch(targetUrl);
    
    if (!response.ok) {
      return json({ 
        error: `HTTP ${response.status}: ${response.statusText}` 
      }, { status: response.status });
    }
    
    const html = await response.text();
    
    // Extract ALL JSON-LD script tags (global match)
    const jsonLdMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
    
    if (!jsonLdMatches || jsonLdMatches.length === 0) {
      return json({ error: 'No JSON-LD data found' }, { status: 404 });
    }
    
    const jsonLdData = [];
    const errors = [];
    
    // Process each JSON-LD script tag
    for (let i = 0; i < jsonLdMatches.length; i++) {
      const match = jsonLdMatches[i];
      const jsonLdString = match.replace(/<script type="application\/ld\+json">/, '').replace(/<\/script>/, '').trim();
      
      try {
        const jsonObj = JSON.parse(jsonLdString);
        
        // Determine the type of JSON-LD
        const type = jsonObj['@type'] || 'Unknown';
        const name = jsonObj.name || jsonObj.title || 'Unnamed';
        
        jsonLdData.push({
          index: i + 1,
          type: type,
          name: name,
          data: jsonObj,
          formatted: JSON.stringify(jsonObj, null, 2)
        });
      } catch (parseError) {
        errors.push({
          index: i + 1,
          error: 'Invalid JSON-LD data',
          content: jsonLdString.substring(0, 100) + '...'
        });
      }
    }
    
    return json({ 
      success: true, 
      totalFound: jsonLdMatches.length,
      validCount: jsonLdData.length,
      errorCount: errors.length,
      jsonLdData: jsonLdData,
      errors: errors
    });
    
  } catch (error: any) {
    return json({ 
      error: error.message || 'Failed to fetch URL' 
    }, { status: 500 });
  }
}; 