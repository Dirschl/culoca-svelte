import { createClient } from '@supabase/supabase-js';
import {
  findMunicipalityPrefixCandidate,
  inferLocationTaxonomyFromOriginalName,
  parseOriginalFilenameLocation
} from '$lib/content/locationTaxonomy';
import { slugifySegment } from '$lib/content/routing';

type SupabaseLike = {
  from: (table: string) => any;
};

type LocationFieldPayload = {
  country_code?: string | null;
  country_name?: string | null;
  country_slug?: string | null;
  state_name?: string | null;
  state_slug?: string | null;
  region_name?: string | null;
  region_slug?: string | null;
  district_code?: string | null;
  district_name?: string | null;
  district_slug?: string | null;
  municipality_name?: string | null;
  municipality_slug?: string | null;
  locality_name?: string | null;
  motif_label?: string | null;
  location_source?: string | null;
  location_confidence?: number | null;
  location_needs_review?: boolean;
  taxonomy_slug_suffix?: string | null;
};

export type ModerationStatus = 'clear' | 'review' | 'flagged' | 'blocked';

export type ItemModerationPayload = {
  status: ModerationStatus;
  summary: string;
  provider: 'google';
  model: string;
  checked_at: string;
  categories: {
    adult_nudity: number;
    explicit_sexual_content: number;
    minors_or_young_looking_persons: number;
  };
  notes?: string | null;
};

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0))
  );
}

function compactText(values: Array<string | string[] | null | undefined>): string {
  return values
    .map((value) => (Array.isArray(value) ? value.filter(Boolean).join(', ') : value))
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join('\n');
}

export function buildEmbeddingInput(item: {
  title?: string | null;
  description?: string | null;
  caption?: string | null;
  motif_label?: string | null;
  keywords?: string[] | string | null;
  country_name?: string | null;
  state_name?: string | null;
  region_name?: string | null;
  district_name?: string | null;
  municipality_name?: string | null;
  locality_name?: string | null;
}) {
  return compactText([
    item.title,
    item.description,
    item.caption,
    item.motif_label,
    item.keywords,
    item.country_name,
    item.state_name,
    item.region_name,
    item.district_name,
    item.municipality_name,
    item.locality_name
  ]);
}

function getAdminSupabase() {
  const supabaseUrl =
    process.env.PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    import.meta.env.PUBLIC_SUPABASE_URL ||
    import.meta.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false }
  });
}

async function createSingleEmbedding(input: string): Promise<{ model: string; values: number[] } | null> {
  const openAiApiKey = process.env.OPENAI_API_KEY;
  const googleApiKey =
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (openAiApiKey) {
    const model = process.env.OPENAI_SIMILARITY_MODEL || 'text-embedding-3-small';
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAiApiKey}`
      },
      body: JSON.stringify({
        model,
        input
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI embedding failed: ${response.status} ${await response.text()}`);
    }

    const json = await response.json();
    return {
      model,
      values: json.data?.[0]?.embedding || []
    };
  }

  if (googleApiKey) {
    const model = process.env.GOOGLE_SIMILARITY_MODEL || 'gemini-embedding-001';
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': googleApiKey
        },
        body: JSON.stringify({
          model: `models/${model}`,
          content: {
            parts: [{ text: input }]
          },
          taskType: 'SEMANTIC_SIMILARITY',
          outputDimensionality: 1536
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Google embedding failed: ${response.status} ${await response.text()}`);
    }

    const json = await response.json();
    return {
      model,
      values: json.embedding?.values || []
    };
  }

  return null;
}

function clampProbability(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function extractJsonObject(rawText: string): Record<string, unknown> | null {
  const trimmed = rawText.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/i);
  const source = fencedMatch?.[1]?.trim() || trimmed;
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(source.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function deriveModerationStatus(categories: ItemModerationPayload['categories']): ModerationStatus {
  if (categories.minors_or_young_looking_persons >= 0.2 || categories.explicit_sexual_content >= 0.75) {
    return 'blocked';
  }

  if (categories.adult_nudity >= 0.72 || categories.explicit_sexual_content >= 0.55) {
    return 'flagged';
  }

  if (categories.adult_nudity >= 0.35 || categories.explicit_sexual_content >= 0.25) {
    return 'review';
  }

  return 'clear';
}

export async function analyzeImageModeration(
  imageBuffer: Buffer,
  mimeType = 'image/jpeg'
): Promise<ItemModerationPayload | null> {
  const googleApiKey =
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!googleApiKey || !imageBuffer?.length) {
    return null;
  }

  const model = process.env.GOOGLE_MODERATION_MODEL || 'gemini-2.5-flash-lite-preview-09-2025';
  const prompt = [
    'Bewerte dieses Bild fuer eine familienfreundliche Foto-Plattform.',
    'Es geht nur um problematische sexuelle Inhalte, Nacktheit und jugendgefährdende Motive.',
    'Antworte ausschliesslich als JSON-Objekt mit diesen Feldern:',
    '{',
    '  "adult_nudity": Zahl von 0 bis 1,',
    '  "explicit_sexual_content": Zahl von 0 bis 1,',
    '  "minors_or_young_looking_persons": Zahl von 0 bis 1,',
    '  "summary": "kurze deutsche Einschaetzung",',
    '  "notes": "kurze deutsche Begruendung oder leer"',
    '}',
    'Bewerte konservativ. Landschaft, Architektur, Tiere, Natur, normale Portraits und Badekleidung ohne sexualisierte Darstellung sollen niedrig eingestuft werden.'
  ].join('\n');

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': googleApiKey
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBuffer.toString('base64')
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 300,
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Google moderation failed: ${response.status} ${await response.text()}`);
  }

  const json = await response.json();
  const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof rawText !== 'string' || !rawText.trim()) {
    return null;
  }

  const parsed = extractJsonObject(rawText);
  if (!parsed) {
    return null;
  }

  const categories = {
    adult_nudity: clampProbability(parsed.adult_nudity),
    explicit_sexual_content: clampProbability(parsed.explicit_sexual_content),
    minors_or_young_looking_persons: clampProbability(parsed.minors_or_young_looking_persons)
  };

  return {
    status: deriveModerationStatus(categories),
    summary:
      typeof parsed.summary === 'string' && parsed.summary.trim()
        ? parsed.summary.trim()
        : 'Automatische Inhaltsprüfung abgeschlossen.',
    provider: 'google',
    model,
    checked_at: new Date().toISOString(),
    categories,
    notes: typeof parsed.notes === 'string' && parsed.notes.trim() ? parsed.notes.trim() : null
  };
}

export async function resolveLocationFieldsFromOriginalName(
  supabase: SupabaseLike,
  originalName: string | null | undefined
): Promise<LocationFieldPayload | null> {
  const parsed = parseOriginalFilenameLocation(originalName);
  if (!parsed) return null;

  let inference = inferLocationTaxonomyFromOriginalName(originalName);
  if (!inference) return null;

  if (inference.countrySlug && inference.districtSlug && inference.districtName) {
    const { data: municipalityRows } = await supabase
      .from('items')
      .select('municipality_name')
      .eq('country_slug', inference.countrySlug)
      .eq('district_slug', inference.districtSlug)
      .eq('location_needs_review', false)
      .not('municipality_name', 'is', null)
      .limit(500);

    const municipalityCandidates = uniqueStrings((municipalityRows || []).map((row: any) => row.municipality_name));
    const municipalityMatch = findMunicipalityPrefixCandidate(inference.municipalityName, municipalityCandidates);

    if (municipalityMatch && municipalityMatch !== inference.municipalityName) {
      inference = {
        ...inference,
        municipalityName: municipalityMatch,
        municipalitySlug: slugifySegment(municipalityMatch),
        confidence: Math.min(1, inference.confidence + 0.08)
      };
    }
  }

  if (inference.countrySlug && !inference.districtName) {
    const { data: municipalityRows } = await supabase
      .from('items')
      .select('country_code, country_name, country_slug, state_name, state_slug, region_name, region_slug, district_code, district_name, district_slug, municipality_name')
      .eq('country_slug', inference.countrySlug)
      .eq('location_needs_review', false)
      .not('municipality_name', 'is', null)
      .limit(1500);

    const municipalityCandidates = uniqueStrings((municipalityRows || []).map((row: any) => row.municipality_name));
    const municipalityMatch = findMunicipalityPrefixCandidate(parsed.districtCode, municipalityCandidates);
    const municipalityRow = (municipalityRows || []).find((row: any) => row.municipality_name === municipalityMatch);

    if (municipalityMatch && municipalityRow) {
      const localityCandidate =
        parsed.municipalityName && slugifySegment(parsed.municipalityName) !== slugifySegment(municipalityMatch)
          ? parsed.municipalityName
          : null;

      inference = {
        ...inference,
        countryCode: municipalityRow.country_code || inference.countryCode,
        countryName: municipalityRow.country_name || inference.countryName,
        countrySlug: municipalityRow.country_slug || inference.countrySlug,
        stateName: municipalityRow.state_name || inference.stateName,
        stateSlug: municipalityRow.state_slug || inference.stateSlug,
        regionName: municipalityRow.region_name || inference.regionName,
        regionSlug: municipalityRow.region_slug || inference.regionSlug,
        districtCode: municipalityRow.district_code || inference.districtCode,
        districtName: municipalityRow.district_name || inference.districtName,
        districtPublicName: municipalityRow.district_name || inference.districtPublicName,
        districtSlug: municipalityRow.district_slug || inference.districtSlug,
        municipalityName: municipalityMatch,
        municipalitySlug: slugifySegment(municipalityMatch),
        confidence: Math.min(0.96, inference.confidence + 0.16),
        localityName: localityCandidate
      };
    }
  }

  const resolvedInference = inference;

  return {
    country_code: resolvedInference.countryCode,
    country_name: resolvedInference.countryName,
    country_slug: resolvedInference.countrySlug,
    state_name: resolvedInference.stateName,
    state_slug: resolvedInference.stateSlug,
    region_name: resolvedInference.regionName,
    region_slug: resolvedInference.regionSlug,
    district_code: resolvedInference.districtCode,
    district_name: resolvedInference.districtName,
    district_slug: resolvedInference.districtSlug,
    municipality_name: resolvedInference.municipalityName,
    municipality_slug: resolvedInference.municipalitySlug,
    locality_name: resolvedInference.localityName || null,
    motif_label: resolvedInference.motifLabel,
    location_source: resolvedInference.source,
    location_confidence: resolvedInference.confidence,
    location_needs_review: !resolvedInference.countryName || !resolvedInference.districtName,
    taxonomy_slug_suffix: [resolvedInference.countrySlug, resolvedInference.districtSlug, resolvedInference.municipalitySlug]
      .filter(Boolean)
      .join('-')
  };
}

export async function refreshSimilarityVectorForItem(item: {
  id: string;
  slug?: string | null;
  type_id?: number | null;
  profile_id?: string | null;
  group_root_item_id?: string | null;
  country_slug?: string | null;
  district_slug?: string | null;
  municipality_slug?: string | null;
  title?: string | null;
  description?: string | null;
  caption?: string | null;
  motif_label?: string | null;
  keywords?: string[] | string | null;
  country_name?: string | null;
  state_name?: string | null;
  region_name?: string | null;
  district_name?: string | null;
  municipality_name?: string | null;
  locality_name?: string | null;
}) {
  if (!item?.id || !item.slug) return;

  const embeddingInput = buildEmbeddingInput(item);
  if (!embeddingInput) return;

  const adminSupabase = getAdminSupabase();
  if (!adminSupabase) return;

  const embedding = await createSingleEmbedding(embeddingInput);
  if (!embedding || !embedding.values?.length) return;

  const { error } = await adminSupabase.from('item_similarity_vectors').upsert(
    {
      item_id: item.id,
      root_item_id: item.group_root_item_id || item.id,
      type_id: item.type_id || null,
      profile_id: item.profile_id || null,
      country_slug: item.country_slug || null,
      district_slug: item.district_slug || null,
      municipality_slug: item.municipality_slug || null,
      embedding_model: embedding.model,
      embedding_version: 'v1',
      embedding_source: 'metadata_text',
      embedding_input: embeddingInput,
      embedding: embedding.values,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'item_id' }
  );

  if (error) {
    throw error;
  }
}
