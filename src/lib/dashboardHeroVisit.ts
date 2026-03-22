import { browser } from '$app/environment';
import { getPublicItemHref } from '$lib/content/routing';

const STORAGE_KEY = 'culoca-dashboard-hero-visit';
const MAX_AGE_MS = 45 * 24 * 60 * 60 * 1000; // 45 Tage

/** Vermeidet ständiges localStorage-Schreiben bei Svelte-Reaktivität */
let lastSavedSignature = '';

export type DashboardHeroVisitPayload = {
  slug: string;
  href: string;
  path_2048: string | null;
  path_512: string | null;
  title: string | null;
  canonical_path?: string | null;
  country_slug?: string | null;
  district_slug?: string | null;
  municipality_slug?: string | null;
  savedAt: number;
  itemUpdatedAt?: string | null;
  /** Nur dieses Dashboard nutzt den Eintrag (wechselnder Login am selben Gerät) */
  viewerUserId?: string | null;
};

type ItemLikeForHero = {
  slug: string | null | undefined;
  path_2048?: string | null;
  path_512?: string | null;
  title?: string | null;
  canonical_path?: string | null;
  country_slug?: string | null;
  district_slug?: string | null;
  municipality_slug?: string | null;
  updated_at?: string | null;
};

export function saveDashboardHeroVisitFromItem(
  item: ItemLikeForHero,
  options?: { viewerUserId?: string | null }
): void {
  if (!browser || !item?.slug) return;
  const path = item.path_2048 || item.path_512;
  if (!path) return;

  const viewerUserId = options?.viewerUserId ?? null;
  const sig = `${viewerUserId ?? ''}|${item.slug}|${item.path_2048 ?? ''}|${item.path_512 ?? ''}|${item.updated_at ?? ''}`;
  if (sig === lastSavedSignature) return;

  const href = getPublicItemHref(item);
  const payload: DashboardHeroVisitPayload = {
    slug: item.slug,
    href,
    path_2048: item.path_2048 ?? null,
    path_512: item.path_512 ?? null,
    title: item.title ?? null,
    canonical_path: item.canonical_path ?? null,
    country_slug: item.country_slug ?? null,
    district_slug: item.district_slug ?? null,
    municipality_slug: item.municipality_slug ?? null,
    savedAt: Date.now(),
    itemUpdatedAt: item.updated_at ?? null,
    viewerUserId
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    lastSavedSignature = sig;
  } catch (e) {
    console.warn('[dashboardHeroVisit] save failed', e);
  }
}

export function readDashboardHeroVisit(): DashboardHeroVisitPayload | null {
  if (!browser) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DashboardHeroVisitPayload>;
    if (!parsed.slug || typeof parsed.savedAt !== 'number') return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (!parsed.path_2048 && !parsed.path_512) return null;
    if (!parsed.href) {
      parsed.href = getPublicItemHref(parsed as ItemLikeForHero);
    }
    return parsed as DashboardHeroVisitPayload;
  } catch {
    return null;
  }
}

export function clearDashboardHeroVisit(): void {
  if (!browser) return;
  lastSavedSignature = '';
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
