-- Create server-side sorting function with correct types
-- This function will handle all sorting in the database

DROP FUNCTION IF EXISTS public.get_items_server_sorted_v2(uuid, uuid, integer, integer, boolean, text, double precision, double precision);

CREATE OR REPLACE FUNCTION public.get_items_server_sorted_v2(
    current_user_id uuid DEFAULT NULL,
    filter_user_id uuid DEFAULT NULL,
    page integer DEFAULT 0,
    page_size integer DEFAULT 50,
    require_gallery boolean DEFAULT true,
    search text DEFAULT NULL,
    user_lat double precision DEFAULT NULL,
    user_lon double precision DEFAULT NULL
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
    title text,
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
        i.title::text, 
        i.description, 
        i.lat, 
        i.lon, 
        i.width, 
        i.height,
        i.is_private, 
        i.keywords, 
        i.gallery,
        CASE 
            WHEN user_lat IS NOT NULL AND user_lon IS NOT NULL THEN
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
        AND (require_gallery IS FALSE OR i.gallery = TRUE)
        AND (
            (filter_user_id IS NULL)
            OR (i.profile_id = filter_user_id)
        )
        AND (
            (current_user_id IS NOT NULL AND (i.profile_id = current_user_id OR i.is_private IS FALSE OR i.is_private IS NULL))
            OR (current_user_id IS NULL AND (i.is_private IS FALSE OR i.is_private IS NULL))
        )
        -- Search filter (optional)
        AND (
            search IS NULL
            OR i.title ILIKE '%' || search || '%'
            OR i.description ILIKE '%' || search || '%'
            OR (i.keywords && string_to_array(search, ' '))
        )
    ORDER BY
        -- PRIMARY: Sort by distance when GPS coordinates provided
        CASE WHEN user_lat IS NOT NULL AND user_lon IS NOT NULL THEN
            (6371000 * acos(
                cos(radians(user_lat)) * cos(radians(i.lat)) *
                cos(radians(i.lon) - radians(user_lon)) +
                sin(radians(user_lat)) * sin(radians(i.lat))
            ))
        END ASC NULLS LAST,
        -- SECONDARY: Sort by created_at (newest first)
        i.created_at DESC
    OFFSET page * page_size
    LIMIT page_size;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_items_server_sorted_v2 TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_items_server_sorted_v2 TO anon; 