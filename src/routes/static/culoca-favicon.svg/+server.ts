import { readFileSync } from 'fs';
import { join } from 'path';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  try {
    // Try multiple possible paths
    const possiblePaths = [
      join(process.cwd(), 'static', 'culoca-favicon.svg'),
      join(process.cwd(), '..', 'static', 'culoca-favicon.svg'),
      join(process.cwd(), 'src', '..', 'static', 'culoca-favicon.svg')
    ];
    
    let faviconContent = null;
    let usedPath = null;
    
    for (const path of possiblePaths) {
      try {
        faviconContent = readFileSync(path, 'utf-8');
        usedPath = path;
        break;
      } catch (err) {
        console.log(`Path not found: ${path}`);
      }
    }
    
    if (!faviconContent) {
      console.error('Favicon not found in any of the expected paths');
      return new Response('Favicon not found', { status: 404 });
    }
    
    console.log(`Serving favicon from: ${usedPath}`);
    
    return new Response(faviconContent, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (error) {
    console.error('Error serving favicon:', error);
    return new Response('Favicon not found', { status: 404 });
  }
}; 