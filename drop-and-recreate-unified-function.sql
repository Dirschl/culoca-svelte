-- Drop all existing distance functions to avoid conflicts
DROP FUNCTION IF EXISTS public.items_by_distance_manual(uuid, uuid, integer, integer, boolean, double precision, double precision);
DROP FUNCTION IF EXISTS public.items_by_distance_manual(double precision, double precision, integer, integer, uuid, boolean, uuid);
DROP FUNCTION IF EXISTS public.items_by_distance_manual(uuid, uuid, integer, integer, boolean, text, double precision, double precision);
DROP FUNCTION IF EXISTS public.items_by_distance_unified(uuid, uuid, integer, integer, boolean, text, double precision, double precision);

-- Create the unified function with correct types
CREATE OR REPLACE FUNCTION public.items_by_distance_unified(
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
        i.id, i.slug, i.path_512, i.path_2048, i.path_64, i.original_name, i.created_at,
        i.user_id, i.profile_id, i.title, i.description, i.lat, i.lon, i.width, i.height,
        i.is_private, i.keywords, i.gallery,
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
        (user_lat IS NOT NULL AND user_lon IS NOT NULL) DESC,
        distance ASC NULLS LAST,
        i.created_at DESC
    OFFSET page * page_size
    LIMIT page_size;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.items_by_distance_unified TO authenticated;
GRANT EXECUTE ON FUNCTION public.items_by_distance_unified TO anon; 