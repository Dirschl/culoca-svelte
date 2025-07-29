-- Add GPS columns to item_views table
-- This script should be run in Supabase SQL Editor

-- Add GPS columns if they don't exist
ALTER TABLE public.item_views 
ADD COLUMN IF NOT EXISTS distance_meters INTEGER,
ADD COLUMN IF NOT EXISTS visitor_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS visitor_lon DOUBLE PRECISION;

-- Create index for distance if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_item_views_distance ON public.item_views(distance_meters);

-- Verify the table structure
\d item_views; 