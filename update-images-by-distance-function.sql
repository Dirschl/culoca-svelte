-- Update images_by_distance function to support user filtering and radius limit
-- This extends the existing function with an optional user_id parameter and radius limit

CREATE OR REPLACE FUNCTION images_by_distance_optimized(
    user_lat DOUBLE PRECISION,
    user_lon DOUBLE PRECISION,
    max_results INTEGER DEFAULT 100,
    offset_count INTEGER DEFAULT 0,
    filter_user_id TEXT DEFAULT NULL,
    max_radius_meters INTEGER DEFAULT 10000
)
RETURNS TABLE(
    id TEXT,
    title TEXT,
    description TEXT,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    path_512 TEXT,
    path_2048 TEXT,
    path_64 TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    profile_id TEXT,
    distance_m DOUBLE PRECISION
)
LANGUAGE SQL
AS $$
    SELECT 
        i.id::TEXT,
        i.title,
        i.description,
        i.lat,
        i.lon,
        i.path_512,
        i.path_2048,
        i.path_64,
        i.created_at,
        i.profile_id::TEXT,
        (6371000 * acos(cos(radians(user_lat)) * cos(radians(i.lat)) * cos(radians(i.lon) - radians(user_lon)) + sin(radians(user_lat)) * sin(radians(i.lat)))) AS distance_m
    FROM images i
    WHERE 
        i.lat IS NOT NULL 
        AND i.lon IS NOT NULL 
        AND i.path_512 IS NOT NULL 
        AND i.path_2048 IS NOT NULL
        AND (filter_user_id IS NULL OR i.profile_id::TEXT = filter_user_id)
        AND (6371000 * acos(cos(radians(user_lat)) * cos(radians(i.lat)) * cos(radians(i.lon) - radians(user_lon)) + sin(radians(user_lat)) * sin(radians(i.lat)))) <= max_radius_meters
    ORDER BY distance_m ASC
    LIMIT max_results
    OFFSET offset_count;
$$;

-- Test the function with sample coordinates (Munich area)
-- SELECT * FROM public.images_by_distance_optimized(48.1351, 11.5820, 10, 0, NULL, 2000);
-- SELECT * FROM public.images_by_distance_optimized(48.1351, 11.5820, 10, 0, 'some-user-id', 5000); 