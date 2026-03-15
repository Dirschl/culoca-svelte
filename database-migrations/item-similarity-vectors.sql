-- Vector foundation for semantically similar photos and motif recommendations.
-- Apply manually after verifying pgvector availability in Supabase.

create extension if not exists vector;

create table if not exists item_similarity_vectors (
  item_id uuid primary key references items(id) on delete cascade,
  root_item_id uuid not null references items(id) on delete cascade,
  type_id bigint,
  profile_id uuid,
  country_slug text,
  district_slug text,
  municipality_slug text,
  embedding_model text not null,
  embedding_version text,
  embedding_source text not null default 'metadata_text'
    check (embedding_source in ('metadata_text', 'image_embedding', 'hybrid')),
  embedding_input text,
  embedding vector(1536) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_item_similarity_vectors_root_item_id
  on item_similarity_vectors(root_item_id);

create index if not exists idx_item_similarity_vectors_type_id
  on item_similarity_vectors(type_id);

create index if not exists idx_item_similarity_vectors_country_slug
  on item_similarity_vectors(country_slug);

create index if not exists idx_item_similarity_vectors_district_slug
  on item_similarity_vectors(district_slug);

create index if not exists idx_item_similarity_vectors_embedding_hnsw
  on item_similarity_vectors using hnsw (embedding vector_cosine_ops);

comment on table item_similarity_vectors is 'Semantic vector index for similar-item lookups.';
comment on column item_similarity_vectors.embedding_source is 'Current MVP starts with metadata_text and can later be upgraded to image_embedding or hybrid.';
comment on column item_similarity_vectors.embedding_input is 'Normalized source text used to produce the current embedding.';

create or replace function match_similar_items(
  source_item_id uuid,
  match_count integer default 8,
  filter_type_id bigint default null,
  exclude_root uuid default null,
  filter_country text default null,
  filter_district text default null
)
returns table (
  item_id uuid,
  similarity real
)
language sql
stable
as $$
  with source as (
    select embedding
    from item_similarity_vectors
    where item_similarity_vectors.item_id = source_item_id
    limit 1
  )
  select
    target.item_id,
    (1 - (target.embedding <=> source.embedding))::real as similarity
  from source
  join item_similarity_vectors as target on true
  join items as i on i.id = target.item_id
  where target.item_id <> source_item_id
    and i.slug is not null
    and i.admin_hidden = false
    and (i.is_private = false or i.is_private is null)
    and (filter_type_id is null or coalesce(target.type_id, i.type_id) = filter_type_id)
    and (exclude_root is null or coalesce(target.root_item_id, coalesce(i.group_root_item_id, i.id)) <> exclude_root)
    and (filter_country is null or target.country_slug = filter_country)
    and (filter_district is null or target.district_slug = filter_district)
  order by source.embedding <=> target.embedding
  limit greatest(match_count, 1);
$$;
