-- Create anchor-based search function
-- This function puts a specific item (anchor) at the top with 0km distance
-- and then sorts the rest by distance from the anchor's location

DROP FUNCTION IF EXISTS items_by_distance_with_anchor(
    DOUBLE PRECISION, 
    DOUBLE PRECISION, 
    UUID, 
    INTEGER, 
    INTEGER, 
    UUID
);

CREATE OR REPLACE FUNCTION items_by_distance_with_anchor(
    user_lat DOUBLE PRECISION,
    user_lon DOUBLE PRECISION,
    anchor_id UUID,
    page INTEGER DEFAULT 0,
    page_size INTEGER DEFAULT 50,
    filter_user_id UUID DEFAULT NULL
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
    is_private BOOLEAN,
    distance DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    -- First, get the anchor item with 0km distance
    SELECT 
        i.id,
        i.profile_id,
        i.user_id,
        i.path_512,
        i.path_2048,
        i.path_64,
        i.width,
        i.height,
        i.lat,
        i.lon,
        i.title,
        i.description,
        i.keywords,
        i.camera,
        i.lens,
        i.original_name,
        i.exif_data,
        i.created_at,
        i.is_private,
        0.0 as distance  -- Anchor item gets 0km distance
    FROM items i
    WHERE i.id = anchor_id
    AND i.lat IS NOT NULL 
    AND i.lon IS NOT NULL 
    AND i.path_512 IS NOT NULL
    AND (filter_user_id IS NULL OR i.profile_id = filter_user_id)
    
    UNION ALL
    
    -- Then get all other items sorted by distance from anchor location
    SELECT 
        i.id,
        i.profile_id,
        i.user_id,
        i.path_512,
        i.path_2048,
        i.path_64,
        i.width,
        i.height,
        i.lat,
        i.lon,
        i.title,
        i.description,
        i.keywords,
        i.camera,
        i.lens,
        i.original_name,
        i.exif_data,
        i.created_at,
        i.is_private,
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
    WHERE i.id != anchor_id  -- Exclude the anchor item
    AND i.lat IS NOT NULL 
    AND i.lon IS NOT NULL 
    AND i.path_512 IS NOT NULL
    AND (filter_user_id IS NULL OR i.profile_id = filter_user_id)
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
    LIMIT page_size - 1 OFFSET (page * page_size);  -- -1 because anchor takes one slot
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION items_by_distance_with_anchor TO authenticated;
GRANT EXECUTE ON FUNCTION items_by_distance_with_anchor TO anon; 