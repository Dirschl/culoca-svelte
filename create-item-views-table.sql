-- Create item_views table for tracking item visits
-- This table tracks when items are viewed on their detail pages

CREATE TABLE IF NOT EXISTS public.item_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    visitor_id UUID, -- NULL for anonymous visitors, NOT NULL for authenticated users
    referer TEXT, -- The referring URL
    user_agent TEXT, -- Browser user agent
    ip_address INET, -- Visitor IP address (optional, for privacy consider not storing)
    distance_meters DOUBLE PRECISION, -- Distance between visitor and item in meters
    visitor_lat DOUBLE PRECISION, -- Visitor's latitude when viewing
    visitor_lon DOUBLE PRECISION, -- Visitor's longitude when viewing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_item_views_item_id ON public.item_views(item_id);
CREATE INDEX IF NOT EXISTS idx_item_views_created_at ON public.item_views(created_at);
CREATE INDEX IF NOT EXISTS idx_item_views_visitor_id ON public.item_views(visitor_id);
CREATE INDEX IF NOT EXISTS idx_item_views_distance ON public.item_views(distance_meters);

-- Create a function to get item view statistics
CREATE OR REPLACE FUNCTION get_item_view_stats(item_uuid UUID)
RETURNS TABLE(
    total_views BIGINT,
    authenticated_views BIGINT,
    anonymous_views BIGINT,
    unique_visitors BIGINT,
    views_today BIGINT,
    views_this_week BIGINT,
    views_this_month BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_views,
        COUNT(*) FILTER (WHERE visitor_id IS NOT NULL) as authenticated_views,
        COUNT(*) FILTER (WHERE visitor_id IS NULL) as anonymous_views,
        COUNT(DISTINCT visitor_id) FILTER (WHERE visitor_id IS NOT NULL) as unique_visitors,
        COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) as views_today,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as views_this_week,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as views_this_month
    FROM public.item_views 
    WHERE item_id = item_uuid;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get detailed item view statistics with distance
CREATE OR REPLACE FUNCTION get_item_view_stats_detailed(item_uuid UUID)
RETURNS TABLE(
    total_views BIGINT,
    unique_users BIGINT,
    authenticated_users BIGINT,
    anonymous_users BIGINT,
    views_today BIGINT,
    views_this_week BIGINT,
    views_this_month BIGINT,
    avg_distance_meters DOUBLE PRECISION,
    min_distance_meters DOUBLE PRECISION,
    max_distance_meters DOUBLE PRECISION,
    local_views BIGINT -- Views within 10km
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_views,
        COUNT(DISTINCT visitor_id) FILTER (WHERE visitor_id IS NOT NULL) as unique_users,
        COUNT(*) FILTER (WHERE visitor_id IS NOT NULL) as authenticated_users,
        COUNT(*) FILTER (WHERE visitor_id IS NULL) as anonymous_users,
        COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) as views_today,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as views_this_week,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as views_this_month,
        AVG(distance_meters) FILTER (WHERE distance_meters IS NOT NULL) as avg_distance_meters,
        MIN(distance_meters) FILTER (WHERE distance_meters IS NOT NULL) as min_distance_meters,
        MAX(distance_meters) FILTER (WHERE distance_meters IS NOT NULL) as max_distance_meters,
        COUNT(*) FILTER (WHERE distance_meters IS NOT NULL AND distance_meters <= 10000) as local_views
    FROM public.item_views 
    WHERE item_id = item_uuid;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get popular items
CREATE OR REPLACE FUNCTION get_popular_items(limit_count INTEGER DEFAULT 10)
RETURNS TABLE(
    item_id UUID,
    item_title TEXT,
    total_views BIGINT,
    views_today BIGINT,
    views_this_week BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id as item_id,
        i.title as item_title,
        COUNT(v.id) as total_views,
        COUNT(v.id) FILTER (WHERE DATE(v.created_at) = CURRENT_DATE) as views_today,
        COUNT(v.id) FILTER (WHERE v.created_at >= CURRENT_DATE - INTERVAL '7 days') as views_this_week
    FROM public.items i
    LEFT JOIN public.item_views v ON i.id = v.item_id
    WHERE i.gallery = true
    GROUP BY i.id, i.title
    ORDER BY total_views DESC, views_this_week DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get popular items with distance stats
CREATE OR REPLACE FUNCTION get_popular_items_detailed(limit_count INTEGER DEFAULT 10)
RETURNS TABLE(
    item_id UUID,
    item_title TEXT,
    item_slug TEXT,
    total_views BIGINT,
    unique_users BIGINT,
    authenticated_users BIGINT,
    anonymous_users BIGINT,
    views_today BIGINT,
    views_this_week BIGINT,
    avg_distance_meters DOUBLE PRECISION,
    local_views BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id as item_id,
        i.title as item_title,
        i.slug as item_slug,
        COUNT(v.id) as total_views,
        COUNT(DISTINCT v.visitor_id) FILTER (WHERE v.visitor_id IS NOT NULL) as unique_users,
        COUNT(v.id) FILTER (WHERE v.visitor_id IS NOT NULL) as authenticated_users,
        COUNT(v.id) FILTER (WHERE v.visitor_id IS NULL) as anonymous_users,
        COUNT(v.id) FILTER (WHERE DATE(v.created_at) = CURRENT_DATE) as views_today,
        COUNT(v.id) FILTER (WHERE v.created_at >= CURRENT_DATE - INTERVAL '7 days') as views_this_week,
        AVG(v.distance_meters) FILTER (WHERE v.distance_meters IS NOT NULL) as avg_distance_meters,
        COUNT(v.id) FILTER (WHERE v.distance_meters IS NOT NULL AND v.distance_meters <= 10000) as local_views
    FROM public.items i
    LEFT JOIN public.item_views v ON i.id = v.item_id
    WHERE i.gallery = true
    GROUP BY i.id, i.title, i.slug
    ORDER BY total_views DESC, unique_users DESC, views_this_week DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get analytics summary
CREATE OR REPLACE FUNCTION get_analytics_summary()
RETURNS TABLE(
    total_views BIGINT,
    unique_users BIGINT,
    authenticated_users BIGINT,
    anonymous_users BIGINT,
    views_today BIGINT,
    views_this_week BIGINT,
    views_this_month BIGINT,
    avg_distance_meters DOUBLE PRECISION,
    local_views BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_views,
        COUNT(DISTINCT visitor_id) FILTER (WHERE visitor_id IS NOT NULL) as unique_users,
        COUNT(*) FILTER (WHERE visitor_id IS NOT NULL) as authenticated_users,
        COUNT(*) FILTER (WHERE visitor_id IS NULL) as anonymous_users,
        COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) as views_today,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as views_this_week,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as views_this_month,
        AVG(distance_meters) FILTER (WHERE distance_meters IS NOT NULL) as avg_distance_meters,
        COUNT(*) FILTER (WHERE distance_meters IS NOT NULL AND distance_meters <= 10000) as local_views
    FROM public.item_views;
END;
$$ LANGUAGE plpgsql;

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS public.log_item_view(UUID, UUID, TEXT, TEXT, INET, DOUBLE PRECISION, DOUBLE PRECISION);
DROP FUNCTION IF EXISTS public.log_item_view(UUID, UUID, TEXT, TEXT, INET);

-- Create a function to log item views with deduplication
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