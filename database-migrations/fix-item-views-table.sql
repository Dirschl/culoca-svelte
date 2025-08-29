-- Fix item_views table structure for GPS coordinates
-- This migration ensures the table can handle GPS data properly

-- 1. Ensure the table exists with correct structure
CREATE TABLE IF NOT EXISTS public.item_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    visitor_id UUID, -- NULL for anonymous visitors, NOT NULL for authenticated users
    referer TEXT, -- The referring URL
    user_agent TEXT, -- Browser user agent
    ip_address INET, -- Visitor IP address
    distance_meters INTEGER, -- Distance between visitor and item in meters
    visitor_lat DOUBLE PRECISION, -- Visitor's latitude when viewing
    visitor_lon DOUBLE PRECISION, -- Visitor's longitude when viewing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add GPS columns if they don't exist (for existing tables)
ALTER TABLE public.item_views 
ADD COLUMN IF NOT EXISTS distance_meters INTEGER,
ADD COLUMN IF NOT EXISTS visitor_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS visitor_lon DOUBLE PRECISION;

-- 3. Ensure proper data types for GPS columns
-- If columns exist with wrong types, we need to recreate them
DO $$
BEGIN
    -- Check if visitor_lat is the wrong type and fix it
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'item_views' 
        AND column_name = 'visitor_lat' 
        AND data_type != 'double precision'
    ) THEN
        ALTER TABLE public.item_views ALTER COLUMN visitor_lat TYPE DOUBLE PRECISION;
    END IF;
    
    -- Check if visitor_lon is the wrong type and fix it
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'item_views' 
        AND column_name = 'visitor_lon' 
        AND data_type != 'double precision'
    ) THEN
        ALTER TABLE public.item_views ALTER COLUMN visitor_lon TYPE DOUBLE PRECISION;
    END IF;
    
    -- Check if distance_meters is the wrong type and fix it
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'item_views' 
        AND column_name = 'distance_meters' 
        AND data_type != 'integer'
    ) THEN
        ALTER TABLE public.item_views ALTER COLUMN distance_meters TYPE INTEGER;
    END IF;
END $$;

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_item_views_item_id ON public.item_views(item_id);
CREATE INDEX IF NOT EXISTS idx_item_views_created_at ON public.item_views(created_at);
CREATE INDEX IF NOT EXISTS idx_item_views_visitor_id ON public.item_views(visitor_id);
CREATE INDEX IF NOT EXISTS idx_item_views_distance ON public.item_views(distance_meters);

-- 5. Drop existing functions to recreate them
DROP FUNCTION IF EXISTS public.log_item_view(UUID, UUID, TEXT, TEXT, INET, DOUBLE PRECISION, DOUBLE PRECISION);
DROP FUNCTION IF EXISTS public.log_item_view(UUID, UUID, TEXT, TEXT, INET);

-- 6. Create the log_item_view function with GPS support
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

-- 7. Create a basic version without GPS for fallback
CREATE OR REPLACE FUNCTION log_item_view_basic(
    p_item_id UUID,
    p_visitor_id UUID DEFAULT NULL,
    p_referer TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    existing_view_id UUID;
BEGIN
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
            ip_address
        ) VALUES (
            p_item_id, 
            p_visitor_id, 
            p_referer, 
            p_user_agent, 
            p_ip_address
        );
        
        RAISE NOTICE 'Successfully inserted basic item view: item_id=%, visitor_id=%', 
            p_item_id, p_visitor_id;
    ELSE
        RAISE NOTICE 'Skipping duplicate basic view for today: item_id=%, visitor_id=%', 
            p_item_id, p_visitor_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 8. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.item_views TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_item_view(UUID, UUID, TEXT, TEXT, INET, DOUBLE PRECISION, DOUBLE PRECISION) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_item_view_basic(UUID, UUID, TEXT, TEXT, INET) TO anon, authenticated;

-- 9. Enable RLS if needed
ALTER TABLE public.item_views ENABLE ROW LEVEL SECURITY;

-- 10. Create RLS policies for item_views
DROP POLICY IF EXISTS "Allow insert for all users" ON public.item_views;
CREATE POLICY "Allow insert for all users" ON public.item_views
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow select for item owners" ON public.item_views;
CREATE POLICY "Allow select for item owners" ON public.item_views
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.items 
            WHERE items.id = item_views.item_id 
            AND items.user_id = auth.uid()
        )
    );

-- 11. Confirmation
SELECT 'item_views table and functions successfully updated!' as status;
