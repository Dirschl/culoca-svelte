import { readFileSync } from 'fs';
import { join } from 'path';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  try {
    const iconPath = join(process.cwd(), 'static', 'culoca-icon.png');
    const iconContent = readFileSync(iconPath);
    
    return new Response(iconContent, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (error) {
    console.error('Error serving icon:', error);
    return new Response('Icon not found', { status: 404 });
  }
}; 