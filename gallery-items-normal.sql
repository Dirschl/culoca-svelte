-- Gallery Items Normal Function (Simplified)
-- Für die normale Galerie ohne Suchfunktion
CREATE OR REPLACE FUNCTION gallery_items_normal(
  page integer DEFAULT 0,
  page_size integer DEFAULT 50,
  user_lat double precision DEFAULT 0,
  user_lon double precision DEFAULT 0,
  current_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  slug text,
  title text,
  description text,
  lat double precision,
  lon double precision,
  path_512 text,
  path_2048 text,
  path_64 text,
  width integer,
  height integer,
  created_at timestamp with time zone,
  profile_id uuid,
  user_id uuid,
  is_private boolean,
  gallery boolean,
  keywords text[],
  original_name text,
  total_count integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.slug,
    i.title,
    i.description,
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
    COUNT(*) OVER() AS total_count
  FROM items i
  WHERE i.path_512 IS NOT NULL
    AND i.gallery = true
    AND (
      CASE
        WHEN current_user_id IS NOT NULL THEN
          i.profile_id = current_user_id OR i.is_private = false OR i.is_private IS NULL
        ELSE
          i.is_private = false OR i.is_private IS NULL
      END
    )
  ORDER BY
    CASE
      WHEN user_lat != 0 AND user_lon != 0 AND i.lat IS NOT NULL AND i.lon IS NOT NULL THEN
        -- GPS-basierte Sortierung nach Entfernung (vereinfacht)
        ABS(i.lat - user_lat) + ABS(i.lon - user_lon)
      ELSE
        -- Fallback: Sortierung nach Koordinaten (Bilder mit GPS zuerst)
        CASE
          WHEN i.lat IS NOT NULL AND i.lon IS NOT NULL THEN 0
          ELSE 1
        END
    END,
    i.lat,
    i.lon
  OFFSET (page * page_size)
  LIMIT page_size;
END;
$$ LANGUAGE plpgsql; 