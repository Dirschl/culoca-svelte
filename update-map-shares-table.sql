-- Update map_shares table to fix screenshot field
-- This script only updates the table structure without recreating existing policies

-- First, check if the table exists and what columns it has
DO $$
BEGIN
    -- Check if screenshot_url column exists and rename it to screenshot
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'map_shares' 
        AND column_name = 'screenshot_url'
    ) THEN
        ALTER TABLE public.map_shares RENAME COLUMN screenshot_url TO screenshot;
        RAISE NOTICE 'Renamed screenshot_url to screenshot';
    END IF;
    
    -- Check if screenshot column doesn't exist and add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'map_shares' 
        AND column_name = 'screenshot'
    ) THEN
        ALTER TABLE public.map_shares ADD COLUMN screenshot TEXT;
        RAISE NOTICE 'Added screenshot column';
    END IF;
    
END $$;

-- Update the comment for the screenshot column
COMMENT ON COLUMN public.map_shares.screenshot IS 'Base64 data URL of the screenshot'; 