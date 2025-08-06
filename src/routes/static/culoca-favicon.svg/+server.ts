import { readFileSync } from 'fs';
import { join } from 'path';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  try {
    const faviconPath = join(process.cwd(), 'static', 'culoca-favicon.svg');
    const faviconContent = readFileSync(faviconPath, 'utf-8');
    
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