-- Update items_by_distance function to include gallery filtering and privacy filtering
-- This adds support for filtering by gallery = true, but makes it optional

-- Drop all existing function overloads to avoid return type conflicts
DROP FUNCTION IF EXISTS items_by_distance(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS items_by_distance(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER, UUID);
DROP FUNCTION IF EXISTS items_by_distance(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER, UUID, BOOLEAN);
DROP FUNCTION IF EXISTS items_by_distance(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER, UUID, BOOLEAN, UUID);

-- Drop the alias function too
DROP FUNCTION IF EXISTS images_by_distance(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS images_by_distance(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER, UUID);

-- Create updated function for distance-based item queries with optional gallery filtering and privacy filtering
CREATE OR REPLACE FUNCTION items_by_distance(
    user_lat DOUBLE PRECISION,
    user_lon DOUBLE PRECISION,
    page INTEGER DEFAULT 0,
    page_size INTEGER DEFAULT 50,
    filter_user_id UUID DEFAULT NULL,
    require_gallery BOOLEAN DEFAULT FALSE,
    current_user_id UUID DEFAULT NULL
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
    original_name TEXT,
    exif_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    is_private BOOLEAN,
    distance DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        i.profile_id,
        i.user_id,
        i.path_512::TEXT,
        i.path_2048::TEXT,
        i.path_64::TEXT,
        i.width,
        i.height,
        i.lat,
        i.lon,
        i.title::TEXT,
        i.description::TEXT,
        i.keywords,
        i.original_name::TEXT,
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
    WHERE 
        i.lat IS NOT NULL 
        AND i.lon IS NOT NULL 
        AND i.path_512 IS NOT NULL
        AND (NOT require_gallery OR i.gallery = true)  -- Only filter by gallery if required
        AND (filter_user_id IS NULL OR i.profile_id = filter_user_id)
        -- Privacy filtering
        AND (
            -- If current_user_id is provided (logged in user)
            CASE 
                WHEN current_user_id IS NOT NULL THEN
                    i.profile_id = current_user_id OR i.is_private = false OR i.is_private IS NULL
                ELSE
                    -- Anonymous user - only show public images
                    i.is_private = false OR i.is_private IS NULL
            END
        )
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
GRANT EXECUTE ON FUNCTION items_by_distance(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER, UUID, BOOLEAN, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION items_by_distance(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER, UUID, BOOLEAN, UUID) TO anon;

-- Also update the alias for backward compatibility
CREATE OR REPLACE FUNCTION images_by_distance(
    user_lat DOUBLE PRECISION,
    user_lon DOUBLE PRECISION,
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
    original_name TEXT,
    exif_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    is_private BOOLEAN,
    distance DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY SELECT * FROM items_by_distance(user_lat, user_lon, page, page_size, filter_user_id, FALSE, NULL);
END;
$$ LANGUAGE plpgsql;

-- Grant permissions for the alias function too
GRANT EXECUTE ON FUNCTION images_by_distance(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION images_by_distance(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER, UUID) TO anon; 