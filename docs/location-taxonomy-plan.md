# Location Taxonomy Plan

## Why

The existing SEO hub structure needs a reliable and repeatable geographic taxonomy.
Real production data already supports this:

- sample size checked: `1000` items with `original_name`
- parseable with `Land_Landkreis_Gemeinde_...`: `983`
- ratio overall in sample: `98.3%`
- ratio for Johann Dirschl profile sample: `99.4%`

That is strong enough to make `original_name` the primary import signal for structured location data.

## Target model

Each item should have structured location fields in addition to free text and GPS:

- `country_code`
- `country_name`
- `country_slug`
- `district_code`
- `district_name`
- `district_slug`
- `municipality_name`
- `municipality_slug`
- `locality_name`
- `motif_label`
- `location_source`
- `location_confidence`
- `location_needs_review`
- `taxonomy_slug_suffix`

## Inference order

1. Parse `original_name`
2. Validate against GPS
3. Fill gaps from reverse geocoding
4. Mark uncertain rows as `location_needs_review = true`
5. Allow manual correction in admin/editor UI

## Rules

### Filename is primary

For trusted uploader profiles, `original_name` is the canonical import signal because it is:

- consistent
- editorially controlled
- already aligned with desired SEO wording

### GPS is validation plus fallback

GPS should:

- confirm district and municipality
- fill missing rows
- detect parser mismatches

GPS should not become the only truth source because reverse geocoding often returns unstable labels.

### Controlled taxonomy

Districts and municipalities should not stay as arbitrary strings forever.
They should resolve to controlled nodes in `geo_taxonomy_nodes`.

This gives:

- stable hub URLs
- typo-proof admin/editor suggestions
- reliable breadcrumbs
- canonical region pages

## Public URL strategy

Current slugs can remain valid and continue to resolve.
Future public geography paths should be built from:

1. `country_slug`
2. `district_slug`
3. `municipality_slug`

Example:

- current filename: `D_AÖ_Reischach_Petzlberg Kastanie (Dirschl Johann)_DSCF0871.jpg`
- parsed:
  - country: `D`
  - district code: `AÖ`
  - district name: `Landkreis Altötting`
  - municipality: `Reischach`
  - motif: `Petzlberg Kastanie`
- public geography path:
  - `/de/altoetting/reischach`
- future detail path:
  - `/de/altoetting/reischach/petzlberg-kastanie`

The written district name is the source of truth.
District codes remain optional import hints only.

## Rollout

1. Add new columns and taxonomy table
2. Parse existing `original_name` values into staging fields
3. Resolve district code mappings such as `AÖ -> Landkreis Altötting`, `PAN -> Landkreis Rottal-Inn`
4. Validate with GPS
5. Mark uncertain rows for review
6. Update SEO hub loaders to use structured fields
7. Introduce slug generation based on structured values
8. Add editor validation so future items stay clean

## Recommended safety model

Use confidence classes:

- `>= 0.95`: safe auto-apply
- `0.80 - 0.949`: auto-apply with review flag off for trusted profiles
- `< 0.80`: keep as suggestion and mark for review

## Immediate next implementation

- parser utility: `src/lib/content/locationTaxonomy.ts`
- schema draft: `database-migrations/item-location-taxonomy.sql`
- migration script:
  - load items
  - parse `original_name`
  - compare with GPS-derived place data
  - write structured fields
