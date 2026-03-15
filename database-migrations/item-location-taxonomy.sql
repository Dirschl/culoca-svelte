-- Location taxonomy foundation for SEO hub pages, canonical paths and stable item slugs.
-- Apply manually after reviewing existing data and rollout order.

alter table if exists items
  add column if not exists country_code text,
  add column if not exists country_name text,
  add column if not exists country_slug text,
  add column if not exists state_name text,
  add column if not exists state_slug text,
  add column if not exists region_name text,
  add column if not exists region_slug text,
  add column if not exists district_code text,
  add column if not exists district_name text,
  add column if not exists district_slug text,
  add column if not exists municipality_name text,
  add column if not exists municipality_slug text,
  add column if not exists locality_name text,
  add column if not exists motif_label text,
  add column if not exists location_source text,
  add column if not exists location_confidence numeric(4,3),
  add column if not exists location_needs_review boolean default false,
  add column if not exists taxonomy_slug_suffix text;

create index if not exists idx_items_country_code on items(country_code);
create index if not exists idx_items_country_slug on items(country_slug);
create index if not exists idx_items_state_name on items(state_name);
create index if not exists idx_items_state_slug on items(state_slug);
create index if not exists idx_items_region_name on items(region_name);
create index if not exists idx_items_region_slug on items(region_slug);
create index if not exists idx_items_district_code on items(district_code);
create index if not exists idx_items_district_name on items(district_name);
create index if not exists idx_items_district_slug on items(district_slug);
create index if not exists idx_items_municipality_name on items(municipality_name);
create index if not exists idx_items_municipality_slug on items(municipality_slug);
create index if not exists idx_items_locality_name on items(locality_name);
create index if not exists idx_items_location_needs_review on items(location_needs_review);

comment on column items.country_code is 'ISO-like source code from original_name or reverse geocoding, e.g. D.';
comment on column items.country_slug is 'Public country path segment used in canonical URLs, e.g. de, at, ch.';
comment on column items.state_name is 'Canonical first-level admin area, e.g. Bayern or Oberösterreich.';
comment on column items.state_slug is 'Normalized public/admin slug for the first-level admin area, e.g. bayern.';
comment on column items.region_name is 'Optional second-level admin or historical region, e.g. Niederbayern or Innviertel.';
comment on column items.region_slug is 'Normalized slug for region_name, e.g. niederbayern.';
comment on column items.district_code is 'Optional short district code from filename taxonomy or import hints, e.g. AÖ, PAN, FRG.';
comment on column items.district_name is 'Canonical written district label, preferred over district_code, e.g. Landkreis Altötting.';
comment on column items.district_slug is 'Public district path segment used in canonical URLs, e.g. altoetting.';
comment on column items.municipality_name is 'Validated municipality/city label used for hub pages.';
comment on column items.municipality_slug is 'Public municipality path segment used in canonical URLs, e.g. reischach.';
comment on column items.locality_name is 'Optional finer-grained place or hamlet label, e.g. Petzlberg.';
comment on column items.motif_label is 'Human-readable motif label derived from original_name or curated manually.';
comment on column items.location_source is 'Source of inferred location values: original_name, gps_reverse_geocode, manual.';
comment on column items.location_confidence is 'Confidence score between 0 and 1 for automated location inference.';
comment on column items.location_needs_review is 'True if parser/geocoder result is uncertain and requires manual review.';

create table if not exists geo_taxonomy_nodes (
  id uuid primary key default gen_random_uuid(),
  country_code text,
  country_name text,
  country_slug text,
  state_name text,
  state_slug text,
  region_name text,
  region_slug text,
  district_code text,
  district_name text not null,
  district_slug text,
  municipality_name text,
  municipality_slug text,
  locality_name text,
  slug text not null,
  normalized_label text not null,
  parent_id uuid references geo_taxonomy_nodes(id) on delete cascade,
  level text not null check (level in ('country', 'district', 'municipality', 'locality')),
  lat double precision,
  lon double precision,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_geo_taxonomy_nodes_unique_path
  on geo_taxonomy_nodes(level, normalized_label, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index if not exists idx_geo_taxonomy_nodes_slug on geo_taxonomy_nodes(slug);
create index if not exists idx_geo_taxonomy_nodes_parent on geo_taxonomy_nodes(parent_id);
