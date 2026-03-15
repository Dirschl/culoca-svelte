# Geo Routing Plan

## Goal

Introduce a public geo-first URL model while keeping all current routes stable during rollout.

Primary public hierarchy:

- `/{countrySlug}`
- `/{countrySlug}/{districtSlug}`
- `/{countrySlug}/{districtSlug}/{municipalitySlug}`
- `/{countrySlug}/{districtSlug}/{municipalitySlug}/{itemSlug}`

Examples:

- `/de`
- `/de/altoetting`
- `/de/altoetting/reischach`
- `/de/altoetting/reischach/petzlberg-kastanie`

## Why geo first

This is the most logical structure for Culoca because:

- the place is stronger than the content type for hub SEO
- it is ready for multiple countries
- it supports future language/country segmentation cleanly
- district codes remain internal and do not leak into URLs

## Type hubs stay separate

Existing type hubs remain valid:

- `/foto`
- `/event`
- `/firma`

They should continue to exist as thematic discovery hubs.
They do not need to sit in front of geo paths.

## Fallback principle

The current item fallback must stay in place during rollout.

Rules:

1. If an item has `country_slug`, `district_slug`, `municipality_slug`, use geo-first canonical candidates.
2. If it does not, keep the current canonical fallback.
3. Existing routes like `/item/[slug]` and `/{type}/{slug}` must still resolve.
4. Old paths can later 301 to the geo canonical once confidence is high enough.

## Recommended rollout

### Phase 1

- Fill taxonomy fields in `items`
- keep existing public routing unchanged
- start generating geo-aware canonical candidates in helpers only

### Phase 2

- introduce geo hub routes:
  - country
  - district
  - municipality
- switch current `/ort/*` logic to the new taxonomy-backed geo hubs

### Phase 3

- make item detail pages geo-canonical when geo hierarchy is complete
- keep `/item/[slug]` as fallback resolver and redirector

### Phase 4

- optionally add geo-filtered type pages such as `/de/altoetting/reischach/foto`
- only if they bring real editorial/SEO value

## Canonical rules

- Geo-complete item:
  - canonical candidate: `/{countrySlug}/{districtSlug}/{municipalitySlug}/{itemSlug}`
- Geo-incomplete item:
  - canonical remains current fallback route
- Old item URLs:
  - resolve and redirect to the current canonical when safe

## Route priorities

To avoid conflicts:

1. explicit static routes first
2. geo hub routes next
3. item fallback routes remain available
4. type routes continue separately

## Current implementation status

- helper support added in `src/lib/content/routing.ts`
- geo hub path helpers added in `src/lib/seo/hubs.ts`
- full route rollout still pending
