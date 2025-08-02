-- =====================================================
-- OPTIMIZED SEARCH FUNCTIONS WITH PROPER GIN INDEX USAGE
-- =====================================================

-- 1. Clean up old functions first
DROP FUNCTION IF EXISTS search_all_items_and(text, integer, integer);
DROP FUNCTION IF EXISTS get_search_count_and(text);
DROP FUNCTION IF EXISTS make_and_query(text);

-- 2. Install unaccent extension for proper umlaut handling
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 3. Prepare table with tsvector column using unaccent (one-time setup)
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS tsv tsvector
  GENERATED ALWAYS AS (
    to_tsvector('german', unaccent(coalesce(title,'') || ' ' || coalesce(slug,'')))
  ) STORED;

-- 4. Create GIN index on the generated column
CREATE INDEX IF NOT EXISTS items_tsv_idx
  ON items USING GIN (tsv);

-- 5. Helper function to create safe tsquery with unaccent support
CREATE OR REPLACE FUNCTION make_and_query(q text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
SELECT
  string_agg( quote_literal(regexp_replace(unaccent(lower(w)), '[^a-z0-9]', '', 'g')) || ':*', ' & ')
FROM regexp_split_to_table(trim(q), '\s+') AS w
WHERE w <> '';
$$;

-- 6. Search function with proper German config and unaccent
CREATE OR REPLACE FUNCTION search_all_items_and(
    search_query text     DEFAULT '',
    page_offset  integer  DEFAULT 0,
    page_size    integer  DEFAULT 50
)
RETURNS TABLE (
    id          uuid,
    title       text,
    slug        text,
    created_at  timestamptz,
    lat         double precision,
    lon         double precision,
    is_private  boolean,
    user_id     uuid,
    width       integer,
    height      integer,
    path_512    text,
    accountname text,
    full_name   text,
    rank        real
) LANGUAGE plpgsql STABLE AS
$$
declare
    tsq  text := make_and_query(search_query);
begin
    if tsq is null then                 -- Leere Suche ⇒ alles (paginieren!)
        return query
        select  i.id,
                i.title::text,
                i.slug::text,
                i.created_at,
                i.lat,
                i.lon,
                i.is_private,
                i.user_id,
                i.width,
                i.height,
                i.path_512::text,
                p.accountname::text,
                p.full_name::text,
                1.0::real as rank
        from    items i
        left join profiles p on p.id = i.user_id
        order  by i.created_at desc
        limit   page_size
        offset  page_offset;
    else
        return query
        select  i.id,
                i.title::text,
                i.slug::text,
                i.created_at,
                i.lat,
                i.lon,
                i.is_private,
                i.user_id,
                i.width,
                i.height,
                i.path_512::text,
                p.accountname::text,
                p.full_name::text,
                ts_rank(i.tsv, tq) as rank
        from    items i
        left join profiles p on p.id = i.user_id
        cross join lateral to_tsquery('german', tsq) as tq
        where   i.tsv @@ tq
        order   by rank desc, i.created_at desc
        limit   page_size
        offset  page_offset;
    end if;
end;
$$;

-- 7. Count function with proper German config
CREATE OR REPLACE FUNCTION get_search_count_and(
    search_query text DEFAULT ''
)
RETURNS integer LANGUAGE plpgsql STABLE AS
$$
declare
    tsq  text := make_and_query(search_query);
    cnt  integer;
begin
    if tsq is null then                 -- Leere Suche ⇒ alles zählen
        select count(*) into cnt
        from items i
        left join profiles p on p.id = i.user_id;
    else
        select count(*) into cnt
        from items i
        left join profiles p on p.id = i.user_id
        cross join lateral to_tsquery('german', tsq) as tq
        where i.tsv @@ tq;
    end if;
    
    return cnt;
end;
$$;

-- 8. Grant permissions
GRANT EXECUTE ON FUNCTION search_all_items_and(text, integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_search_count_and(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION make_and_query(text) TO anon, authenticated;

-- 9. Enable RLS for the functions
ALTER FUNCTION search_all_items_and(text, integer, integer) SECURITY DEFINER;
ALTER FUNCTION get_search_count_and(text) SECURITY DEFINER;
ALTER FUNCTION make_and_query(text) SECURITY DEFINER; 