-- Simple update to add user filter functionality to existing function
-- This only updates the privacy logic part

CREATE OR REPLACE FUNCTION public.gallery_items_normal_postgis(user_lat double precision DEFAULT 0, user_lon double precision DEFAULT 0, page_value integer DEFAULT 0, page_size_value integer DEFAULT 50, current_user_id uuid DEFAULT NULL::uuid)
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
    CASE
      WHEN user_lat != 0 AND user_lon != 0 AND i.lat IS NOT NULL AND i.lon IS NOT NULL THEN
        6371000 * acos(
          cos(radians(user_lat)) * cos(radians(i.lat)) * cos(radians(i.lon) - radians(user_lon)) +
          sin(radians(user_lat)) * sin(radians(i.lat))
        )
      ELSE
        999999999
    END AS distance,
    COUNT(*) OVER() AS total_count
  FROM items i
  WHERE i.path_512 IS NOT NULL
    AND i.gallery = true
    AND (
      CASE
        -- Wenn current_user_id gesetzt ist: Zeige alle Items des Users (User-Filter)
        WHEN current_user_id IS NOT NULL THEN
          i.profile_id = current_user_id
        -- Wenn kein current_user_id: Nur öffentliche Items
        ELSE
          i.is_private = false OR i.is_private IS NULL
      END
    )
  ORDER BY distance ASC
  OFFSET (page_value * page_size_value)
  LIMIT page_size_value;
END;
$function$; 