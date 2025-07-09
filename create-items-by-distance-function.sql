-- Create function for distance-based item queries
-- This replaces the old images_by_distance function for the items table

CREATE OR REPLACE FUNCTION items_by_distance(
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
GRANT EXECUTE ON FUNCTION items_by_distance TO authenticated;
GRANT EXECUTE ON FUNCTION items_by_distance TO anon;

-- Also create an alias for backward compatibility
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
    RETURN QUERY SELECT * FROM items_by_distance(user_lat, user_lon, page, page_size);
END;
$$ LANGUAGE plpgsql;

-- Grant permissions for the alias function too
GRANT EXECUTE ON FUNCTION images_by_distance TO authenticated;
GRANT EXECUTE ON FUNCTION images_by_distance TO anon; 