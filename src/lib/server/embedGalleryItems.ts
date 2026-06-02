import { supabase } from '$lib/supabaseClient';
import { getPublicItemHref, isVisibleInMainFeed } from '$lib/content/routing';
import { SITE_URL } from '$lib/seo/site';
import { getSeoImageUrl } from '$lib/utils/seoImageUrl';

const GALLERY_SELECT =
	'id, slug, title, description, lat, lon, path_512, path_2048, width, height, created_at, canonical_path, country_slug, state_slug, region_slug, district_slug, district_name, municipality_slug, municipality_name, type_id, group_root_item_id, show_in_main_feed, ends_at';

export type EmbedGalleryItem = {
	id: string;
	slug: string | null;
	title: string | null;
	description: string | null;
	canonical_path: string | null;
	url: string;
	/** Direct 512px image URL (no HTML/OG fetch required). */
	image_512: string | null;
	width: number;
	height: number;
	/** Human-readable place label (Gemeinde preferred) for embed headings. */
	place: string | null;
	municipality_slug: string | null;
	municipality_name: string | null;
	district_slug: string | null;
	district_name: string | null;
	country_slug: string | null;
};

function slugToPlaceLabel(slug: string): string {
	return slug
		.split('-')
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

function resolvePlaceLabel(row: Record<string, unknown>): string | null {
	const municipalityName =
		typeof row.municipality_name === 'string' ? row.municipality_name.trim() : '';
	if (municipalityName) return municipalityName;

	const municipalitySlug =
		typeof row.municipality_slug === 'string' ? row.municipality_slug.trim() : '';
	if (municipalitySlug) return slugToPlaceLabel(municipalitySlug);

	const districtName = typeof row.district_name === 'string' ? row.district_name.trim() : '';
	if (districtName) return districtName;

	const districtSlug = typeof row.district_slug === 'string' ? row.district_slug.trim() : '';
	if (districtSlug) return slugToPlaceLabel(districtSlug);

	return null;
}

function shuffle<T>(items: T[]): T[] {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

function locationKey(item: {
	municipality_slug?: string | null;
	district_slug?: string | null;
	country_slug?: string | null;
	id: string;
}): string {
	if (item.municipality_slug) return `m:${item.municipality_slug}`;
	if (item.district_slug) return `d:${item.district_slug}`;
	if (item.country_slug) return `c:${item.country_slug}`;
	return `i:${item.id}`;
}

function isPortraitItem(item: EmbedGalleryItem): boolean {
	return item.height > item.width;
}

/** Interleave portrait and landscape so embed grids show more vertical motifs. */
function interleavePortraitFirst(items: EmbedGalleryItem[]): EmbedGalleryItem[] {
	const portraits = items.filter(isPortraitItem);
	const others = items.filter((item) => !isPortraitItem(item));
	const mixed: EmbedGalleryItem[] = [];
	let pi = 0;
	let oi = 0;
	while (pi < portraits.length || oi < others.length) {
		if (pi < portraits.length) mixed.push(portraits[pi++]);
		if (oi < others.length) mixed.push(others[oi++]);
	}
	return mixed;
}

export function toEmbedGalleryItem(row: Record<string, unknown>): EmbedGalleryItem | null {
	if (!row?.id || !row?.path_512) return null;
	const href = getPublicItemHref({
		slug: (row.slug as string) ?? null,
		canonical_path: (row.canonical_path as string) ?? null,
		country_slug: (row.country_slug as string) ?? null,
		state_slug: (row.state_slug as string) ?? null,
		region_slug: (row.region_slug as string) ?? null,
		district_slug: (row.district_slug as string) ?? null,
		municipality_slug: (row.municipality_slug as string) ?? null
	});
	const path = href.startsWith('http') ? href : `${SITE_URL}${href.startsWith('/') ? href : `/${href}`}`;
	const slug = (row.slug as string) ?? null;
	const path512 = (row.path_512 as string) ?? null;
	const image512 = getSeoImageUrl(slug, path512, '512') || null;
	const width = typeof row.width === 'number' ? row.width : parseInt(String(row.width ?? 0), 10) || 0;
	const height = typeof row.height === 'number' ? row.height : parseInt(String(row.height ?? 0), 10) || 0;

	return {
		id: String(row.id),
		slug,
		title: (row.title as string) ?? null,
		description: (row.description as string) ?? null,
		canonical_path: href.startsWith('http') ? new URL(href).pathname : href,
		url: path,
		image_512: image512,
		width,
		height,
		place: resolvePlaceLabel(row),
		municipality_slug: (row.municipality_slug as string) ?? null,
		municipality_name: (row.municipality_name as string) ?? null,
		district_slug: (row.district_slug as string) ?? null,
		district_name: (row.district_name as string) ?? null,
		country_slug: (row.country_slug as string) ?? null
	};
}

async function fetchPublicGalleryPool(limit: number) {
	const { data: { user } } = await supabase.auth.getUser();
	const currentUserId = user?.id || null;

	let query = supabase
		.from('items')
		.select(GALLERY_SELECT)
		.eq('gallery', true)
		.eq('admin_hidden', false)
		.is('group_root_item_id', null)
		.not('path_512', 'is', null)
		.limit(limit);

	if (currentUserId) {
		query = query.or(`is_private.is.null,is_private.eq.false,profile_id.eq.${currentUserId}`);
	} else {
		query = query.or('is_private.is.null,is_private.eq.false');
	}

	const { data, error } = await query;
	if (error) {
		return { error, items: [] as EmbedGalleryItem[] };
	}

	const items = (data || [])
		.filter((row) => isVisibleInMainFeed(row))
		.map((row) => toEmbedGalleryItem(row))
		.filter((item): item is EmbedGalleryItem => !!item);

	return { error: null, items };
}

/**
 * Random gallery items with at most one pick per municipality (fallback: district, country).
 */
export async function fetchDiscoverEmbedItems(count: number): Promise<{
	error: unknown;
	items: EmbedGalleryItem[];
}> {
	const target = Math.min(100, Math.max(1, count));
	const poolSize = Math.min(1200, Math.max(target * 12, 400));
	const { error, items: pool } = await fetchPublicGalleryPool(poolSize);

	if (error) {
		return { error, items: [] };
	}

	if (!pool.length) {
		return { error: null, items: [] };
	}

	const shuffled = interleavePortraitFirst(shuffle(pool));
	const diverse: EmbedGalleryItem[] = [];
	const seenLocations = new Set<string>();
	const seenIds = new Set<string>();

	for (const item of shuffled) {
		if (diverse.length >= target) break;
		const loc = locationKey(item);
		if (seenLocations.has(loc)) continue;
		seenLocations.add(loc);
		seenIds.add(item.id);
		diverse.push(item);
	}

	if (diverse.length < target) {
		for (const item of shuffle(shuffled)) {
			if (diverse.length >= target) break;
			if (seenIds.has(item.id)) continue;
			seenIds.add(item.id);
			diverse.push(item);
		}
	}

	return { error: null, items: shuffle(diverse).slice(0, target) };
}

function applyMultiWordSearch<T>(query: T, search: string) {
	const words = search
		.trim()
		.split(/\s+/)
		.map((word) => word.trim())
		.filter(Boolean);

	let nextQuery: any = query;
	for (const word of words) {
		const escaped = word.replace(/%/g, '\\%').replace(/_/g, '\\_');
		nextQuery = nextQuery.or(
			`title.ilike.%${escaped}%,description.ilike.%${escaped}%,original_name.ilike.%${escaped}%,slug.ilike.%${escaped}%`
		);
	}
	return nextQuery;
}

export async function fetchSearchEmbedItems(
	search: string,
	count: number
): Promise<{ error: unknown; items: EmbedGalleryItem[] }> {
	const target = Math.min(100, Math.max(1, count));
	const trimmed = search.trim();
	if (!trimmed) {
		return fetchDiscoverEmbedItems(target);
	}

	const { data: { user } } = await supabase.auth.getUser();
	const currentUserId = user?.id || null;

	let query = supabase
		.from('items')
		.select(GALLERY_SELECT)
		.eq('gallery', true)
		.eq('admin_hidden', false)
		.is('group_root_item_id', null)
		.not('path_512', 'is', null)
		.order('created_at', { ascending: false })
		.limit(target);

	query = applyMultiWordSearch(query, trimmed);

	if (currentUserId) {
		query = query.or(`is_private.is.null,is_private.eq.false,profile_id.eq.${currentUserId}`);
	} else {
		query = query.or('is_private.is.null,is_private.eq.false');
	}

	const { data, error } = await query;
	if (error) {
		return { error, items: [] };
	}

	const items = (data || [])
		.filter((row) => isVisibleInMainFeed(row))
		.map((row) => toEmbedGalleryItem(row))
		.filter((item): item is EmbedGalleryItem => !!item);

	return { error: null, items };
}

export async function fetchItemEmbedBySlug(slug: string): Promise<{
	error: unknown;
	item: EmbedGalleryItem | null;
}> {
	const trimmed = slug.trim();
	if (!trimmed) {
		return { error: null, item: null };
	}

	const { data: { user } } = await supabase.auth.getUser();
	const currentUserId = user?.id || null;

	let query = supabase
		.from('items')
		.select(GALLERY_SELECT)
		.eq('gallery', true)
		.eq('admin_hidden', false)
		.is('group_root_item_id', null)
		.not('path_512', 'is', null)
		.eq('slug', trimmed)
		.limit(1);

	if (currentUserId) {
		query = query.or(`is_private.is.null,is_private.eq.false,profile_id.eq.${currentUserId}`);
	} else {
		query = query.or('is_private.is.null,is_private.eq.false');
	}

	const { data, error } = await query;
	if (error) {
		return { error, item: null };
	}

	const row = (data || [])[0];
	if (!row || !isVisibleInMainFeed(row)) {
		return { error: null, item: null };
	}

	return { error: null, item: toEmbedGalleryItem(row) };
}
