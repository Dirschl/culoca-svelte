import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import sharp from 'sharp';

export const GET: RequestHandler = async ({ url }) => {
  try {
    // Get test parameters from URL
    const lat = url.searchParams.get('lat') || '52.5200';
    const lon = url.searchParams.get('lon') || '13.4050';
    const zoom = url.searchParams.get('zoom') || '16';
    const mapType = url.searchParams.get('map_type') || 'standard';
    
    console.log('Generating test screenshot for:', { lat, lon, zoom, mapType });
    
    // Generate test screenshot
    const screenshot = await generateTestScreenshot(lat, lon, zoom, mapType);
    
    if (screenshot) {
      return new Response(screenshot, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'no-cache'
        }
      });
    } else {
      return json({ error: 'Failed to generate screenshot' }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error in test-screenshot:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};

async function generateTestScreenshot(lat: string, lon: string, zoom: string, mapType: string) {
  try {
    // Create a map preview using Sharp
    const width = 1200;
    const height = 630;
    
    // Create a map-like background with coordinates
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f8f9fa"/>
        <rect x="0" y="0" width="100%" height="100%" fill="url(#mapGradient)"/>
        
        <!-- Map grid pattern -->
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e0e0e0" stroke-width="1"/>
          </pattern>
          <linearGradient id="mapGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#f0f0f0;stop-opacity:1" />
          </linearGradient>
        </defs>
        
        <rect width="100%" height="100%" fill="url(#grid)"/>
        
        <!-- Center marker -->
        <circle cx="50%" cy="50%" r="8" fill="#ee7221" stroke="#ffffff" stroke-width="3"/>
        <circle cx="50%" cy="50%" r="3" fill="#ffffff"/>
        
        <!-- Coordinates text -->
        <text x="50%" y="85%" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#333" font-weight="bold">
          ${lat}, ${lon}
        </text>
        <text x="50%" y="95%" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#666">
          Zoom: ${zoom} | ${mapType === 'satellite' ? 'Satellit' : 'Standard'}
        </text>
        
        <!-- CULOCA branding -->
        <text x="20" y="30" font-family="Arial, sans-serif" font-size="16" fill="#ee7221" font-weight="bold">
          CULOCA
        </text>
        
        <!-- Test indicator -->
        <text x="20" y="50" font-family="Arial, sans-serif" font-size="12" fill="#999">
          TEST SCREENSHOT
        </text>
      </svg>
    `;
    
    const buffer = await sharp(Buffer.from(svg))
      .resize(width, height)
      .jpeg({ quality: 75 })
      .toBuffer();
    
    return buffer;
    
  } catch (error) {
    console.error('Error generating test screenshot:', error);
    return null;
  }
} 