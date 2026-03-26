/** Geteilt von /event-Hub und Startseiten-Kacheln */

export type HubEventPlaceItem = {
  locality_name?: string | null;
  municipality_name?: string | null;
  district_name?: string | null;
  country_name?: string | null;
  municipality_slug?: string | null;
  district_slug?: string | null;
  country_slug?: string | null;
};

export function slugToTitleCaseHub(slug: string): string {
  return String(slug)
    .split(/[-_]/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function formatHubEventPlace(item: HubEventPlaceItem): string {
  const named = [item.locality_name, item.municipality_name, item.district_name, item.country_name]
    .map((x) => (x && String(x).trim()) || '')
    .filter(Boolean);
  const uniqNames: string[] = [];
  for (const p of named) {
    if (!uniqNames.includes(p)) uniqNames.push(p);
  }
  if (uniqNames.length) return uniqNames.join(', ');
  const slugParts = [item.municipality_slug, item.district_slug, item.country_slug]
    .filter((s): s is string => !!s && String(s).trim().length > 0)
    .map((s) => slugToTitleCaseHub(String(s)));
  const uniqSlugs: string[] = [];
  for (const p of slugParts) {
    if (!uniqSlugs.includes(p)) uniqSlugs.push(p);
  }
  return uniqSlugs.length ? uniqSlugs.join(', ') : '';
}

/** Kachel: großes „von – bis“ (ein Tag mit Uhrzeit vs. mehrtägig). */
export function formatEventHubRange(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined
): string {
  if (!startsAt && !endsAt) return '';
  const fmtDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('de-DE', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }).format(new Date(iso));
    } catch {
      return '';
    }
  };
  const fmtTime = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
    } catch {
      return '';
    }
  };
  if (startsAt && endsAt) {
    const s = new Date(startsAt);
    const e = new Date(endsAt);
    const sameDay =
      s.getFullYear() === e.getFullYear() &&
      s.getMonth() === e.getMonth() &&
      s.getDate() === e.getDate();
    if (sameDay) {
      const d = fmtDate(startsAt);
      const t1 = fmtTime(startsAt);
      const t2 = fmtTime(endsAt);
      if (t1 && t2) return `${d} · ${t1} – ${t2}`;
      return d || fmtDate(endsAt);
    }
    return `${fmtDate(startsAt)} – ${fmtDate(endsAt)}`;
  }
  if (startsAt) return fmtDate(startsAt);
  return fmtDate(endsAt!);
}
