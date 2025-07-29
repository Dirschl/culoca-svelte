-- Update log_item_view function to support GPS coordinates
-- This script should be run in Supabase SQL Editor

-- Drop existing function with old signature
DROP FUNCTION IF EXISTS public.log_item_view(UUID, UUID, TEXT, TEXT, INET);

-- Create updated function with GPS support
CREATE OR REPLACE FUNCTION log_item_view(
    p_item_id UUID,
    p_visitor_id UUID DEFAULT NULL,
    p_referer TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_visitor_lat DOUBLE PRECISION DEFAULT NULL,
    p_visitor_lon DOUBLE PRECISION DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    existing_view_id UUID;
    item_lat DOUBLE PRECISION;
    item_lon DOUBLE PRECISION;
    calculated_distance INTEGER;
BEGIN
    -- Get item coordinates
    SELECT lat, lon INTO item_lat, item_lon
    FROM public.items
    WHERE id = p_item_id;
    
    -- Calculate distance if both visitor and item have coordinates
    IF p_visitor_lat IS NOT NULL AND p_visitor_lon IS NOT NULL 
       AND item_lat IS NOT NULL AND item_lon IS NOT NULL THEN
        -- Haversine formula for distance calculation (result in meters)
        calculated_distance := ROUND(6371000 * acos(
            cos(radians(p_visitor_lat)) * cos(radians(item_lat)) * 
            cos(radians(item_lon) - radians(p_visitor_lon)) + 
            sin(radians(p_visitor_lat)) * sin(radians(item_lat))
        ));
    ELSE
        calculated_distance := NULL;
    END IF;
    
    -- Debug logging
    RAISE NOTICE 'Logging item view: item_id=%, visitor_id=%, distance=%, referer=%', 
        p_item_id, p_visitor_id, calculated_distance, p_referer;
    
    -- Check if a view already exists for this item/visitor today
    SELECT id INTO existing_view_id
    FROM public.item_views
    WHERE item_id = p_item_id 
      AND visitor_id IS NOT DISTINCT FROM p_visitor_id
      AND DATE(created_at) = CURRENT_DATE
    LIMIT 1;
    
    -- Only insert if no view exists for today
    IF existing_view_id IS NULL THEN
        INSERT INTO public.item_views (
            item_id, 
            visitor_id, 
            referer, 
            user_agent, 
            ip_address,
            distance_meters,
            visitor_lat,
            visitor_lon
        ) VALUES (
            p_item_id, 
            p_visitor_id, 
            p_referer, 
            p_user_agent, 
            p_ip_address,
            calculated_distance,
            p_visitor_lat,
            p_visitor_lon
        );
        
        RAISE NOTICE 'Successfully inserted item view: item_id=%, visitor_id=%, distance=%m', 
            p_item_id, p_visitor_id, calculated_distance;
    ELSE
        RAISE NOTICE 'Skipping duplicate view for today: item_id=%, visitor_id=%', 
            p_item_id, p_visitor_id;
    END IF;
END;
$$ LANGUAGE plpgsql; 