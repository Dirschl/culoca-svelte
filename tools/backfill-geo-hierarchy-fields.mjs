import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local or .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'public' }
});

const COUNTRY_METADATA = {
  D: { name: 'Deutschland', slug: 'de' },
  DE: { name: 'Deutschland', slug: 'de' },
  A: { name: 'Österreich', slug: 'at' },
  AT: { name: 'Österreich', slug: 'at' },
  CH: { name: 'Schweiz', slug: 'ch' }
};

const DISTRICT_METADATA = {
  'AÖ': { name: 'Landkreis Altötting', slug: 'altoetting', state_name: 'Bayern', state_slug: 'bayern', region_name: 'Oberbayern', region_slug: 'oberbayern' },
  'AÖ': { name: 'Landkreis Altötting', slug: 'altoetting', state_name: 'Bayern', state_slug: 'bayern', region_name: 'Oberbayern', region_slug: 'oberbayern' },
  PAN: { name: 'Landkreis Rottal-Inn', slug: 'rottal-inn', state_name: 'Bayern', state_slug: 'bayern', region_name: 'Niederbayern', region_slug: 'niederbayern' },
  FRG: { name: 'Landkreis Freyung-Grafenau', slug: 'freyung-grafenau', state_name: 'Bayern', state_slug: 'bayern', region_name: 'Niederbayern', region_slug: 'niederbayern' },
  PA: { name: 'Landkreis Passau', slug: 'passau', state_name: 'Bayern', state_slug: 'bayern', region_name: 'Niederbayern', region_slug: 'niederbayern' },
  MUE: { name: 'Landkreis Mühldorf am Inn', slug: 'muehldorf-am-inn', state_name: 'Bayern', state_slug: 'bayern', region_name: 'Oberbayern', region_slug: 'oberbayern' },
  MÜ: { name: 'Landkreis Mühldorf am Inn', slug: 'muehldorf-am-inn', state_name: 'Bayern', state_slug: 'bayern', region_name: 'Oberbayern', region_slug: 'oberbayern' },
  REG: { name: 'Landkreis Regen', slug: 'regen', state_name: 'Bayern', state_slug: 'bayern', region_name: 'Niederbayern', region_slug: 'niederbayern' },
  TS: { name: 'Landkreis Traunstein', slug: 'traunstein', state_name: 'Bayern', state_slug: 'bayern', region_name: 'Oberbayern', region_slug: 'oberbayern' },
  BGL: { name: 'Landkreis Berchtesgadener Land', slug: 'berchtesgadener-land', state_name: 'Bayern', state_slug: 'bayern', region_name: 'Oberbayern', region_slug: 'oberbayern' },
  ED: { name: 'Landkreis Erding', slug: 'erding', state_name: 'Bayern', state_slug: 'bayern', region_name: 'Oberbayern', region_slug: 'oberbayern' },
  DEG: { name: 'Landkreis Deggendorf', slug: 'deggendorf', state_name: 'Bayern', state_slug: 'bayern', region_name: 'Niederbayern', region_slug: 'niederbayern' },
  CHA: { name: 'Landkreis Cham', slug: 'cham', state_name: 'Bayern', state_slug: 'bayern', region_name: 'Oberpfalz', region_slug: 'oberpfalz' },
  PI: { name: 'Kreis Pinneberg', slug: 'pinneberg', state_name: 'Schleswig-Holstein', state_slug: 'schleswig-holstein', region_name: null, region_slug: null },
  RÜG: { name: 'Landkreis Vorpommern-Rügen', slug: 'vorpommern-ruegen', state_name: 'Mecklenburg-Vorpommern', state_slug: 'mecklenburg-vorpommern', region_name: null, region_slug: null },
  'RÜG': { name: 'Landkreis Vorpommern-Rügen', slug: 'vorpommern-ruegen', state_name: 'Mecklenburg-Vorpommern', state_slug: 'mecklenburg-vorpommern', region_name: null, region_slug: null },
  M: { name: 'München', slug: 'muenchen', state_name: 'Bayern', state_slug: 'bayern', region_name: 'Oberbayern', region_slug: 'oberbayern' },
  R: { name: 'Landkreis Regensburg', slug: 'regensburg', state_name: 'Bayern', state_slug: 'bayern', region_name: 'Oberpfalz', region_slug: 'oberpfalz' },
  BRAUNAU: { name: 'Bezirk Braunau am Inn', slug: 'braunau', state_name: 'Oberösterreich', state_slug: 'oberoesterreich', region_name: 'Innviertel', region_slug: 'innviertel' },
  BR: { name: 'Bezirk Braunau am Inn', slug: 'braunau', state_name: 'Oberösterreich', state_slug: 'oberoesterreich', region_name: 'Innviertel', region_slug: 'innviertel' },
  RI: { name: 'Bezirk Ried im Innkreis', slug: 'ried-im-innkreis', state_name: 'Oberösterreich', state_slug: 'oberoesterreich', region_name: 'Innviertel', region_slug: 'innviertel' },
  JO: { name: 'Bezirk St. Johann im Pongau', slug: 'st-johann-im-pongau', state_name: 'Salzburg', state_slug: 'salzburg', region_name: 'Pongau', region_slug: 'pongau' },
  KB: { name: 'Bezirk Kitzbühel', slug: 'kitzbuehel', state_name: 'Tirol', state_slug: 'tirol', region_name: 'Unterland', region_slug: 'unterland' },
  BERLIN: { name: 'Berlin', slug: 'berlin', state_name: 'Berlin', state_slug: 'berlin', region_name: 'Berlin', region_slug: 'berlin' },
  HAMBURG: { name: 'Hamburg', slug: 'hamburg', state_name: 'Hamburg', state_slug: 'hamburg', region_name: 'Hamburg', region_slug: 'hamburg' },
  BREMEN: { name: 'Bremen', slug: 'bremen', state_name: 'Bremen', state_slug: 'bremen', region_name: 'Bremen', region_slug: 'bremen' }
};

function slugify(value) {
  return String(value || '')
    .replace(/Ä/g, 'Ae')
    .replace(/Ö/g, 'Oe')
    .replace(/Ü/g, 'Ue')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function normalizeUnicode(value) {
  return String(value || '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

function stripDistrictDecorators(value) {
  return normalizeUnicode(value)
    .replace(/\b(Landkreis|Kreis|Bezirk|Region)\b/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findDistrictMetadata(row) {
  const candidates = [
    String(row.district_code || '').toUpperCase(),
    normalizeUnicode(row.district_name || ''),
    String(row.district_slug || '')
  ].filter(Boolean);

  for (const candidate of candidates) {
    const exact = DISTRICT_METADATA[candidate];
    if (exact) return exact;
  }

  const comparable = new Set(
    candidates
      .map((value) => slugify(stripDistrictDecorators(value)))
      .filter(Boolean)
  );

  if (!comparable.size) return null;

  return (
    Object.values(DISTRICT_METADATA).find((entry) => {
      const byName = slugify(stripDistrictDecorators(entry.name));
      const bySlug = slugify(entry.slug);
      return comparable.has(byName) || comparable.has(bySlug);
    }) || null
  );
}

function deriveUpdate(row) {
  const districtMeta = findDistrictMetadata(row);
  const countryCode = String(row.country_code || '').toUpperCase();
  const countryMeta =
    COUNTRY_METADATA[countryCode] ||
    Object.values(COUNTRY_METADATA).find((entry) => entry.slug === row.country_slug) ||
    null;

  if (!countryMeta && !districtMeta) return null;

  const next = {
    country_name: row.country_name || countryMeta?.name || null,
    country_slug: row.country_slug || countryMeta?.slug || null,
    state_name: row.state_name || districtMeta?.state_name || null,
    state_slug: row.state_slug || districtMeta?.state_slug || null,
    region_name: row.region_name || districtMeta?.region_name || null,
    region_slug: row.region_slug || districtMeta?.region_slug || null,
    district_name: row.district_name || districtMeta?.name || null,
    district_slug: districtMeta?.slug || row.district_slug || null,
    taxonomy_slug_suffix:
      [row.country_slug || countryMeta?.slug, districtMeta?.slug || row.district_slug, row.municipality_slug]
        .filter(Boolean)
        .join('-') || null,
    location_needs_review:
      row.country_slug && (row.district_slug || districtMeta?.slug) && row.municipality_slug
        ? false
        : row.location_needs_review
  };

  const changed = Object.entries(next).some(([key, value]) => (row[key] ?? null) !== (value ?? null));
  return changed ? next : null;
}

function parseArgs(argv) {
  return {
    apply: argv.includes('--apply'),
    limit: Number(argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 0) || null
  };
}

async function loadItems(limit) {
  const batchSize = 1000;
  let from = 0;
  const rows = [];

  while (true) {
    const { data, error } = await supabase
      .from('items')
      .select(
        'id, country_code, country_name, country_slug, state_name, state_slug, region_name, region_slug, district_code, district_name, district_slug, municipality_name, municipality_slug, taxonomy_slug_suffix, location_needs_review'
      )
      .not('district_slug', 'is', null)
      .not('municipality_slug', 'is', null)
      .or('state_slug.is.null,region_slug.is.null,district_slug.eq.braunau-am-inn')
      .order('created_at', { ascending: false })
      .range(from, from + batchSize - 1);

    if (error) throw error;

    const batch = data || [];
    rows.push(...batch);

    if (limit && rows.length >= limit) return rows.slice(0, limit);
    if (batch.length < batchSize) return rows;
    from += batchSize;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const items = await loadItems(args.limit);
  let changed = 0;

  console.log(`Mode: ${args.apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Candidates: ${items.length}`);

  for (const row of items) {
    const update = deriveUpdate(row);
    if (!update) continue;

    changed += 1;
    if (args.apply) {
      const { error } = await supabase.from('items').update(update).eq('id', row.id);
      if (error) throw error;
    }

    console.log(`${args.apply ? 'UPDATED' : 'WOULD UPDATE'} ${row.id}`);
  }

  console.log(`Changed: ${changed}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
