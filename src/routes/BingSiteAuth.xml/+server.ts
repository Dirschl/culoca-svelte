import { readFileSync } from 'fs';
import { join } from 'path';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
    try {
        const bingAuthPath = join(process.cwd(), 'static', 'BingSiteAuth.xml');
        const bingAuthContent = readFileSync(bingAuthPath, 'utf-8');

        return new Response(bingAuthContent, {
            headers: {
                'Content-Type': 'application/xml',
                'Cache-Control': 'public, max-age=3600'
            }
        });
    } catch (error) {
        console.error('Error serving BingSiteAuth.xml:', error);
        return new Response('BingSiteAuth.xml not found', { status: 404 });
    }
}; 