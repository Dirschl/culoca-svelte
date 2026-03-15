import type { SupabaseClient } from '@supabase/supabase-js';

export type ReviewIssue =
  | 'missing_geo'
  | 'needs_review'
  | 'content_warning'
  | 'missing_title'
  | 'missing_description'
  | 'missing_keywords'
  | 'missing_path_2048'
  | 'missing_path_512';

export type ProfileReviewItem = {
  id: string;
  slug: string;
  profile_id: string | null;
  title: string | null;
  original_name: string | null;
  updated_at: string | null;
  type_id: number | null;
  country_slug: string | null;
  district_slug: string | null;
  municipality_slug: string | null;
  location_needs_review: boolean | null;
  description: string | null;
  keywords: string[] | null;
  path_64: string | null;
  path_2048: string | null;
  path_512: string | null;
  moderation_status: string | null;
  moderation_summary: string | null;
  issues: ReviewIssue[];
  primaryIssue: ReviewIssue;
  editHref: string;
};

type RawReviewRow = {
  id: string;
  slug: string;
  profile_id: string | null;
  title: string | null;
  original_name: string | null;
  updated_at: string | null;
  type_id: number | null;
  country_slug: string | null;
  district_slug: string | null;
  municipality_slug: string | null;
  location_needs_review: boolean | null;
  description: string | null;
  keywords: string[] | null;
  path_64: string | null;
  path_2048: string | null;
  path_512: string | null;
  page_settings?: Record<string, unknown> | null;
};

function getModerationStatus(row: RawReviewRow): string | null {
  const moderation = row.page_settings?.moderation;
  if (!moderation || typeof moderation !== 'object') return null;
  const status = (moderation as Record<string, unknown>).status;
  return typeof status === 'string' ? status : null;
}

function getModerationSummary(row: RawReviewRow): string | null {
  const moderation = row.page_settings?.moderation;
  if (!moderation || typeof moderation !== 'object') return null;
  const summary = (moderation as Record<string, unknown>).summary;
  return typeof summary === 'string' ? summary : null;
}

function buildIssues(row: RawReviewRow): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const moderationStatus = getModerationStatus(row);
  const hasCompleteGeo = !!(row.country_slug && row.district_slug && row.municipality_slug);

  if (!hasCompleteGeo) {
    issues.push('missing_geo');
  }
  if (row.location_needs_review && !hasCompleteGeo) {
    issues.push('needs_review');
  }
  if (moderationStatus === 'flagged' || moderationStatus === 'blocked' || moderationStatus === 'review') {
    issues.push('content_warning');
  }
  if (!row.title?.trim()) {
    issues.push('missing_title');
  }
  if (!row.description?.trim()) {
    issues.push('missing_description');
  }
  if (!row.keywords?.length) {
    issues.push('missing_keywords');
  }
  if (!row.path_2048) {
    issues.push('missing_path_2048');
  }
  if (!row.path_512) {
    issues.push('missing_path_512');
  }

  return issues;
}

function getFocusForIssue(issue: ReviewIssue): string {
  if (issue === 'missing_keywords') return 'keywords';
  if (issue === 'missing_title') return 'title';
  if (issue === 'missing_description') return 'description';
  if (issue === 'missing_geo') return 'filename';
  if (issue === 'needs_review') return 'filename';
  if (issue === 'content_warning') return 'title';
  return 'title';
}

export function getIssueLabel(issue: ReviewIssue): string {
  if (issue === 'missing_geo') return 'Geo-Daten fehlen';
  if (issue === 'needs_review') return 'Ortsdaten prüfen';
  if (issue === 'content_warning') return 'Inhalt prüfen';
  if (issue === 'missing_title') return 'Titel fehlt';
  if (issue === 'missing_description') return 'Beschreibung fehlt';
  if (issue === 'missing_keywords') return 'Keywords fehlen';
  if (issue === 'missing_path_2048') return '2048px-Version fehlt';
  return '512px-Version fehlt';
}

export function buildReviewItem(row: RawReviewRow): ProfileReviewItem | null {
  const issues = buildIssues(row);
  if (!issues.length || !row.slug) return null;

  const primaryIssue = issues[0];
  return {
    ...row,
    moderation_status: getModerationStatus(row),
    moderation_summary: getModerationSummary(row),
    issues,
    primaryIssue,
    editHref: `/item/${row.slug}?edit=1&focus=${encodeURIComponent(getFocusForIssue(primaryIssue))}`
  };
}

export async function fetchProfileReviewItems(
  supabase: SupabaseClient,
  profileId: string
): Promise<ProfileReviewItem[]> {
  return fetchReviewItems(supabase, profileId);
}

export async function fetchAllReviewItems(supabase: SupabaseClient): Promise<ProfileReviewItem[]> {
  return fetchReviewItems(supabase, null);
}

async function fetchReviewItems(
  supabase: SupabaseClient,
  profileId: string | null
): Promise<ProfileReviewItem[]> {
  const rows: RawReviewRow[] = [];
  let from = 0;
  const batchSize = 1000;

  while (true) {
    let query = supabase
      .from('items')
      .select(
        'id, slug, profile_id, title, original_name, updated_at, type_id, country_slug, district_slug, municipality_slug, location_needs_review, description, keywords, path_64, path_2048, path_512, page_settings'
      )
      .not('slug', 'is', null)
      .order('updated_at', { ascending: false })
      .range(from, from + batchSize - 1);

    if (profileId) {
      query = query.eq('profile_id', profileId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const batch = (data || []) as RawReviewRow[];
    rows.push(...batch);
    if (batch.length < batchSize) break;
    from += batchSize;
  }

  return rows
    .map((row) => buildReviewItem(row))
    .filter((row): row is ProfileReviewItem => !!row);
}
