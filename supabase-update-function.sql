-- Update images_by_distance function to support user filtering
-- Run this in Supabase SQL Editor

-- First drop the existing function
DROP FUNCTION IF EXISTS images_by_distance_optimized(double precision, double precision, integer, integer, text);

-- Then create the new function with correct UUID types
CREATE OR REPLACE FUNCTION images_by_distance_optimized(
    user_lat DOUBLE PRECISION,
    user_lon DOUBLE PRECISION,
    max_results INTEGER DEFAULT 100,
    offset_count INTEGER DEFAULT 0,
    filter_user_id TEXT DEFAULT NULL
)
RETURNS TABLE(
    id UUID,
    title TEXT,
    description TEXT,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    path_512 TEXT,
    path_2048 TEXT,
    path_64 TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    profile_id UUID,
    distance_m DOUBLE PRECISION
)
LANGUAGE SQL
AS $$
    SELECT 
        i.id,
        i.title,
        i.description,
        i.lat,
        i.lon,
        i.path_512,
        i.path_2048,
        i.path_64,
        i.created_at,
        i.profile_id,
        (6371000 * acos(cos(radians(user_lat)) * cos(radians(i.lat)) * cos(radians(i.lon) - radians(user_lon)) + sin(radians(user_lat)) * sin(radians(i.lat)))) AS distance_m
    FROM items i
    WHERE 
        i.lat IS NOT NULL 
        AND i.lon IS NOT NULL 
        AND i.path_512 IS NOT NULL 
        AND (filter_user_id IS NULL OR i.profile_id::TEXT = filter_user_id)
    ORDER BY distance_m ASC
    LIMIT max_results
    OFFSET offset_count;
$$; 