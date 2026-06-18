import { error, type RequestHandler } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';
import { listBuyerLicenses } from '$lib/server/licensePurchases';
import { fetchOriginalItemBuffer } from '$lib/server/downloadExport';

const MAX_BULK_ITEMS = 50;

function createAuthedSupabase(request: Request) {
	const authHeader = request.headers.get('authorization');
	if (!authHeader?.startsWith('Bearer ')) {
		throw error(401, 'Nicht angemeldet');
	}

	const supabaseUrl =
		process.env.PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
	const supabaseAnonKey =
		process.env.PUBLIC_SUPABASE_ANON_KEY ||
		process.env.VITE_SUPABASE_ANON_KEY ||
		import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

	if (!supabaseUrl || !supabaseAnonKey) {
		throw error(500, 'Server-Konfigurationsfehler');
	}

	return createClient(supabaseUrl, supabaseAnonKey, {
		auth: { persistSession: false },
		global: { headers: { Authorization: authHeader } }
	});
}

function safeZipName(original: string | null | undefined, itemId: string, index: number) {
	const base = (original || `culoca-${itemId.slice(0, 8)}.jpg`).replace(/[/\\?%*:|"<>]/g, '_');
	if (index === 0) return base;
	const dot = base.lastIndexOf('.');
	if (dot > 0) {
		return `${base.slice(0, dot)}-${index + 1}${base.slice(dot)}`;
	}
	return `${base}-${index + 1}`;
}

export const POST: RequestHandler = async ({ request }) => {
	const supabase = createAuthedSupabase(request);
	const {
		data: { user },
		error: userError
	} = await supabase.auth.getUser();
	if (userError || !user) {
		throw error(401, 'Nicht angemeldet');
	}

	let body: { itemIds?: string[] } = {};
	try {
		body = (await request.json()) as { itemIds?: string[] };
	} catch {
		body = {};
	}

	const licenses = await listBuyerLicenses(user.id);
	const licensedIds = new Set(licenses.map((row) => row.item_id));
	const requested =
		Array.isArray(body.itemIds) && body.itemIds.length
			? body.itemIds.filter((id) => typeof id === 'string' && licensedIds.has(id))
			: licenses.map((row) => row.item_id);

	const uniqueIds = [...new Set(requested)];
	if (!uniqueIds.length) {
		throw error(400, 'Keine lizenzierten Bilder zum Download');
	}
	if (uniqueIds.length > MAX_BULK_ITEMS) {
		throw error(
			400,
			`Maximal ${MAX_BULK_ITEMS} Bilder pro ZIP. Bitte in kleineren Mengen herunterladen.`
		);
	}

	const { data: items, error: itemsError } = await supabase
		.from('items')
		.select('id, original_url, path_2048, path_512, original_name')
		.in('id', uniqueIds);

	if (itemsError) {
		throw error(500, 'Bilder konnten nicht geladen werden');
	}

	const itemById = new Map((items || []).map((item) => [item.id as string, item]));
	const zip = new JSZip();
	const usedNames = new Map<string, number>();

	for (const itemId of uniqueIds) {
		const item = itemById.get(itemId);
		if (!item) continue;

		const buffer = await fetchOriginalItemBuffer(item, { allowPublicFallback: true });
		const baseName = safeZipName(item.original_name, itemId, 0);
		const count = usedNames.get(baseName) ?? 0;
		usedNames.set(baseName, count + 1);
		const fileName = safeZipName(item.original_name, itemId, count);
		zip.file(fileName, buffer);
	}

	if (!Object.keys(zip.files).length) {
		throw error(404, 'Keine Dateien für den ZIP-Export gefunden');
	}

	const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
	const stamp = new Date().toISOString().slice(0, 10);

	return new Response(zipBuffer, {
		headers: {
			'Content-Type': 'application/zip',
			'Content-Disposition': `attachment; filename="culoca-lizenzen-${stamp}.zip"`,
			'Cache-Control': 'no-store'
		}
	});
};
