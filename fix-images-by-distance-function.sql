-- Fix the images_by_distance function to work with the items table
-- This replaces the old function that was looking at the images table

DROP FUNCTION IF EXISTS images_by_distance(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION images_by_distance(
    user_lat DOUBLE PRECISION,
    user_lon DOUBLE PRECISION,
    page INTEGER DEFAULT 0,
    page_size INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    profile_id UUID,
    user_id UUID,
    path_512 TEXT,
    path_2048 TEXT,
    path_64 TEXT,
    width INTEGER,
    height INTEGER,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    title TEXT,
    description TEXT,
    keywords TEXT[],
    camera TEXT,
    lens TEXT,
    original_name TEXT,
    exif_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    distance DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.*,
        CASE 
            WHEN i.lat IS NOT NULL AND i.lon IS NOT NULL THEN
                6371000 * acos(
                    cos(radians(user_lat)) * cos(radians(i.lat)) * 
                    cos(radians(i.lon) - radians(user_lon)) + 
                    sin(radians(user_lat)) * sin(radians(i.lat))
                )
            ELSE NULL
        END as distance
    FROM items i
    ORDER BY 
        CASE 
            WHEN i.lat IS NOT NULL AND i.lon IS NOT NULL THEN
                6371000 * acos(
                    cos(radians(user_lat)) * cos(radians(i.lat)) * 
                    cos(radians(i.lon) - radians(user_lon)) + 
                    sin(radians(user_lat)) * sin(radians(i.lat))
                )
        END ASC NULLS LAST,
        i.created_at DESC
    LIMIT page_size OFFSET (page * page_size);
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION images_by_distance TO authenticated;
GRANT EXECUTE ON FUNCTION images_by_distance TO anon; 