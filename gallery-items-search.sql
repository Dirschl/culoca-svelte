-- Create gallery-items-search function
-- Simple function for gallery items sorted by distance, with optional search

-- Drop all possible versions of the function to avoid conflicts
DROP FUNCTION IF EXISTS gallery_items_search(double precision, double precision, integer, integer, uuid);
DROP FUNCTION IF EXISTS gallery_items_search(double precision, double precision, integer, integer, uuid, text);
DROP FUNCTION IF EXISTS gallery_items_search(double precision, double precision, integer, integer);
DROP FUNCTION IF EXISTS gallery_items_search(double precision, double precision, integer, integer, text);

CREATE OR REPLACE FUNCTION gallery_items_search(
    user_lat double precision,
    user_lon double precision,
    page integer DEFAULT 0,
    page_size integer DEFAULT 50,
    current_user_id uuid DEFAULT NULL,
    search text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    slug text,
    path_512 text,
    path_2048 text,
    path_64 text,
    original_name text,
    created_at timestamp with time zone,
    user_id uuid,
    profile_id uuid,
    title character varying(255),
    description text,
    lat double precision,
    lon double precision,
    width integer,
    height integer,
    is_private boolean,
    keywords text[],
    gallery boolean,
    distance double precision
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.id,
        i.slug,
        i.path_512,
        i.path_2048,
        i.path_64,
        i.original_name,
        i.created_at,
        i.user_id,
        i.profile_id,
        i.title,
        i.description,
        i.lat,
        i.lon,
        i.width,
        i.height,
        i.is_private,
        i.keywords,
        i.gallery,
        CASE 
            WHEN i.lat IS NOT NULL AND i.lon IS NOT NULL THEN
                (6371000 * acos(
                    cos(radians(user_lat)) * cos(radians(i.lat)) *
                    cos(radians(i.lon) - radians(user_lon)) +
                    sin(radians(user_lat)) * sin(radians(i.lat))
                ))
            ELSE NULL
        END AS distance
    FROM items i
    WHERE
        i.lat IS NOT NULL
        AND i.lon IS NOT NULL
        AND i.path_512 IS NOT NULL
        AND i.gallery = true
        AND (
            (current_user_id IS NOT NULL AND (i.profile_id = current_user_id OR i.is_private = false OR i.is_private IS NULL))
            OR (current_user_id IS NULL AND (i.is_private = false OR i.is_private IS NULL))
        )
        AND (
            search IS NULL
            OR i.title ILIKE '%' || search || '%'
            OR i.description ILIKE '%' || search || '%'
            OR (i.keywords && string_to_array(search, ' '))
        )
    ORDER BY
        distance ASC NULLS LAST,
        i.created_at DESC
    OFFSET page * page_size
    LIMIT page_size;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION gallery_items_search TO authenticated;
GRANT EXECUTE ON FUNCTION gallery_items_search TO anon; 