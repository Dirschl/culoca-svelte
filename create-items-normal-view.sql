-- Haversine-Entfernungsfunktion
CREATE OR REPLACE FUNCTION calculate_distance(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
) RETURNS double precision AS $$
BEGIN
  RETURN (
    6371000 * acos(
      cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lon2) - radians(lon1)) +
      sin(radians(lat1)) * sin(radians(lat2))
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Items Normal View - Alle Items ohne Limits
-- Für die normale Galerie ohne Suchfunktion
CREATE OR REPLACE VIEW items_normal_view AS
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
  i.original_name
FROM items i
WHERE i.path_512 IS NOT NULL
  AND i.gallery = true
  AND (i.is_private = false OR i.is_private IS NULL); 