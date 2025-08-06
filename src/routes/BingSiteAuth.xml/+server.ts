import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const bingAuthContent = `<?xml version="1.0"?>
<users>
	<user>F60E300CEA641635C734AD28A72FA3BE</user>
</users>`;

	return new Response(bingAuthContent, {
		headers: {
			'Content-Type': 'application/xml',
			'Cache-Control': 'public, max-age=3600'
		}
	});
}; 