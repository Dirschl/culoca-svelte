# Vector Similarity MVP

## Goal

Replace random "Aehnliche Motive" suggestions with semantic nearest-neighbor matches.

## MVP

- Store one vector per public root item.
- Start with `metadata_text` embeddings from title, description, caption, motif, keywords and geo labels.
- Query similar items via `pgvector`.
- Filter results by:
  - public visibility
  - same `type_id`
  - not the same root group
  - optionally same country/district for stronger local relevance

## SQL

Run:

```sql
database-migrations/item-similarity-vectors.sql
```

## Backfill

Dry run:

```bash
npm run similarity:backfill
```

Apply:

```bash
npm run similarity:backfill:apply
```

Optional:

```bash
node tools/backfill-item-similarity-vectors.mjs --apply --limit=200
node tools/backfill-item-similarity-vectors.mjs --apply --profile=<profile_id>
```

## Next upgrade path

- Replace `metadata_text` with real image embeddings.
- Add hybrid ranking: image vector + metadata vector + geo weighting.
- Precompute cached nearest neighbors if detail pages need faster response times.
