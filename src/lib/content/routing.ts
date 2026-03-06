import {
  DEFAULT_CONTENT_TYPE_BY_ID,
  DEFAULT_CONTENT_TYPE_BY_SLUG,
  type ContentTypeDefinition
} from '$lib/content/types';

export type ContentItemLike = {
  id: string;
  slug: string | null;
  type_id: number | null;
  group_root_item_id?: string | null;
  group_slug?: string | null;
  canonical_path?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  is_private?: boolean | null;
  show_in_main_feed?: boolean | null;
};

export function normalizePath(path: string): string {
  if (!path) return '/';
  const value = path.startsWith('/') ? path : `/${path}`;
  return value !== '/' && value.endsWith('/') ? value.slice(0, -1) : value;
}

export function getTypeForItem(
  item: Pick<ContentItemLike, 'type_id'>,
  explicitType?: Partial<ContentTypeDefinition> | null
): Partial<ContentTypeDefinition> | null {
  if (explicitType?.slug) return explicitType;
  if (!item.type_id) return null;
  return DEFAULT_CONTENT_TYPE_BY_ID.get(item.type_id) ?? null;
}

export function getTypeBySlug(typeSlug: string): Partial<ContentTypeDefinition> | null {
  return DEFAULT_CONTENT_TYPE_BY_SLUG.get(typeSlug) ?? null;
}

export function computeCanonicalPath(args: {
  item: ContentItemLike;
  rootItem?: ContentItemLike | null;
  type?: Partial<ContentTypeDefinition> | null;
}): string | null {
  const { item, rootItem } = args;
  const resolvedType = args.type ?? getTypeForItem(item);
  const typeSlug = resolvedType?.slug;

  if (!item.slug || !typeSlug) {
    return item.slug ? `/item/${item.slug}` : null;
  }

  const groupRoot = rootItem ?? null;
  const isRootItem = !item.group_root_item_id || groupRoot?.id === item.id;
  const visibleGroupSlug = isRootItem
    ? item.group_slug || null
    : groupRoot?.group_slug || null;

  if (isRootItem && visibleGroupSlug) {
    return `/${typeSlug}/${visibleGroupSlug}`;
  }

  if (!isRootItem && visibleGroupSlug) {
    return `/${typeSlug}/${visibleGroupSlug}/${item.slug}`;
  }

  // Unnamed child variants intentionally collapse to the same clean pattern as standalone items.
  return `/${typeSlug}/${item.slug}`;
}

export function getStoredOrComputedCanonicalPath(args: {
  item: ContentItemLike;
  rootItem?: ContentItemLike | null;
  type?: Partial<ContentTypeDefinition> | null;
}): string | null {
  const computed = computeCanonicalPath(args);
  return normalizePath(args.item.canonical_path || computed || '');
}

export function isEventExpired(item: Pick<ContentItemLike, 'type_id' | 'ends_at'>): boolean {
  const type = getTypeForItem(item);
  if (type?.slug !== 'event' || !item.ends_at) return false;
  return new Date(item.ends_at).getTime() < Date.now();
}

export function isPubliclyVisibleItem(item: ContentItemLike): boolean {
  if (item.is_private) return false;
  if (isEventExpired(item)) return false;
  return true;
}

export function isVisibleInMainFeed(item: ContentItemLike): boolean {
  return isPubliclyVisibleItem(item) && item.show_in_main_feed !== false;
}
