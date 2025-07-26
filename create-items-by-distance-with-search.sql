-- Create items_by_distance_with_search function for server-side distance sorting with search support
-- This extends the working items_by_distance_manual function with search functionality

DROP FUNCTION IF EXISTS items_by_distance_with_search(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER, UUID, BOOLEAN, UUID, TEXT);

CREATE OR REPLACE FUNCTION items_by_distance_with_search(
    user_lat DOUBLE PRECISION,
    user_lon DOUBLE PRECISION,
    page INTEGER DEFAULT 0,
    page_size INTEGER DEFAULT 50,
    filter_user_id UUID DEFAULT NULL,
    require_gallery BOOLEAN DEFAULT FALSE,
    current_user_id UUID DEFAULT NULL,
    search TEXT DEFAULT NULL
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
    gallery BOOLEAN,
    slug TEXT,
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
        i.gallery,
        i.slug::TEXT,
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
        -- Search filter (optional)
        AND (
            search IS NULL
            OR i.title ILIKE '%' || search || '%'
            OR i.description ILIKE '%' || search || '%'
            OR (i.keywords && string_to_array(search, ' '))
        )
    ORDER BY 
        -- PRIMARY: Sort by distance (closest first) when GPS coordinates provided
        CASE 
            WHEN user_lat IS NOT NULL AND user_lon IS NOT NULL AND i.lat IS NOT NULL AND i.lon IS NOT NULL THEN
                6371000 * acos(
                    cos(radians(user_lat)) * cos(radians(i.lat)) * 
                    cos(radians(i.lon) - radians(user_lon)) + 
                    sin(radians(user_lat)) * sin(radians(i.lat))
                )
        END ASC NULLS LAST,
        -- SECONDARY: Sort by created_at (newest first) for items with same distance or no GPS
        i.created_at DESC
    LIMIT page_size OFFSET (page * page_size);
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION items_by_distance_with_search(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER, UUID, BOOLEAN, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION items_by_distance_with_search(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER, UUID, BOOLEAN, UUID, TEXT) TO anon; 