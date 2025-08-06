-- =====================================================
-- FIX SEARCH FUNCTION FOR EXACT MATCHING (POSTGIS)
-- =====================================================

-- This script updates the search function to use exact matching
-- instead of prefix matching to prevent "Pfarrkirchen" from matching "Pfarrkirche"

-- 1. Create a new function for exact matching with PostGIS compatibility
CREATE OR REPLACE FUNCTION make_exact_query_postgis(q text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
SELECT
  string_agg( quote_literal(regexp_replace(unaccent(lower(w)), '[^a-z0-9]', '', 'g')), ' & ')
FROM regexp_split_to_table(trim(q), '\s+') AS w
WHERE w <> '';
$$;

-- 2. Update the search function to use exact matching
DROP FUNCTION IF EXISTS public.gallery_items_search_postgis(double precision, double precision, integer, integer, uuid, text);

CREATE OR REPLACE FUNCTION public.gallery_items_search_postgis(
  user_lat double precision DEFAULT 0,
  user_lon double precision DEFAULT 0,
  page_value integer DEFAULT 0,
  page_size_value integer DEFAULT 50,
  current_user_id uuid DEFAULT NULL::uuid,
  search_term text DEFAULT NULL::text
)
RETURNS TABLE(id uuid, slug text, title text, description text, lat double precision, lon double precision, path_512 text, path_2048 text, path_64 text, width integer, height integer, created_at timestamp with time zone, profile_id uuid, user_id uuid, is_private boolean, gallery boolean, keywords text[], original_name text, distance double precision, total_count bigint)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.slug,
    i.title::text,
    i.description::text,
    i.lat,
    i.lon,
    i.path_512,
    i.path_2048,
    i.path_64,
    i.width,
    i.height,
    i.created_at,
    i.profile_id,
    i.user_id,
    i.is_private,
    i.gallery,
    i.keywords,
    i.original_name,
    -- GPS-Entfernungsberechnung direkt in PostgreSQL mit PostGIS
    CASE
      WHEN user_lat != 0 AND user_lon != 0 AND i.lat IS NOT NULL AND i.lon IS NOT NULL THEN
        -- PostGIS ST_Distance für präzise Entfernungsberechnung
        ST_Distance(
          ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography,
          ST_SetSRID(ST_MakePoint(i.lon, i.lat), 4326)::geography
        )
      ELSE
        -- Items ohne GPS oder ohne User-Koordinaten bekommen maximale Entfernung
        999999999
    END AS distance,
    COUNT(*) OVER() AS total_count
  FROM items i
  WHERE i.path_512 IS NOT NULL
    AND i.gallery = true
    AND (
      CASE
        -- Wenn current_user_id gesetzt ist: Zeige NUR Items des Users (User-Filter)
        WHEN current_user_id IS NOT NULL THEN
          i.profile_id = current_user_id
        -- Wenn kein current_user_id: Nur öffentliche Items
        ELSE
          i.is_private = false OR i.is_private IS NULL
      END
    )
    AND (
      -- Suchfilter: Wenn search_term vorhanden, dann suchen
      CASE
        WHEN search_term IS NOT NULL AND search_term != '' THEN
          -- NEU: Verwende exakte Volltext-Suche ohne Prefix-Matching
          i.tsv @@ to_tsquery('german', make_exact_query_postgis(search_term))
        ELSE
          TRUE -- Keine Suche, alle Items
      END
    )
  ORDER BY distance ASC
  OFFSET (page_value * page_size_value)
  LIMIT page_size_value;
END;
$function$;

-- 3. Grant permissions
GRANT EXECUTE ON FUNCTION public.gallery_items_search_postgis(double precision, double precision, integer, integer, uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION make_exact_query_postgis(text) TO anon, authenticated, service_role;

-- 4. Set ownership
ALTER FUNCTION public.gallery_items_search_postgis(double precision, double precision, integer, integer, uuid, text) OWNER TO postgres;
ALTER FUNCTION make_exact_query_postgis(text) OWNER TO postgres; 