-- Complete setup for item_views with GPS support
-- This script should be run in Supabase SQL Editor

-- Create item_views table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.item_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    visitor_id UUID, -- NULL for anonymous visitors, NOT NULL for authenticated users
    referer TEXT, -- The referring URL
    user_agent TEXT, -- Browser user agent
    ip_address INET, -- Visitor IP address (optional, for privacy consider not storing)
    distance_meters INTEGER, -- Distance between visitor and item in meters
    visitor_lat DOUBLE PRECISION, -- Visitor's latitude when viewing
    visitor_lon DOUBLE PRECISION, -- Visitor's longitude when viewing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add GPS columns if they don't exist (for existing tables)
ALTER TABLE public.item_views 
ADD COLUMN IF NOT EXISTS distance_meters INTEGER,
ADD COLUMN IF NOT EXISTS visitor_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS visitor_lon DOUBLE PRECISION;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_item_views_item_id ON public.item_views(item_id);
CREATE INDEX IF NOT EXISTS idx_item_views_created_at ON public.item_views(created_at);
CREATE INDEX IF NOT EXISTS idx_item_views_visitor_id ON public.item_views(visitor_id);
CREATE INDEX IF NOT EXISTS idx_item_views_distance ON public.item_views(distance_meters);

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.log_item_view(UUID, UUID, TEXT, TEXT, INET, DOUBLE PRECISION, DOUBLE PRECISION);
DROP FUNCTION IF EXISTS public.log_item_view(UUID, UUID, TEXT, TEXT, INET);

-- Create the log_item_view function with GPS support
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

-- Test the function with a sample call
-- (This will be commented out to avoid actual test data)
-- SELECT log_item_view(
--     '00000000-0000-0000-0000-000000000001'::uuid,
--     NULL,
--     'test',
--     'test',
--     '127.0.0.1'::inet,
--     48.1351,
--     11.5820
-- ); 