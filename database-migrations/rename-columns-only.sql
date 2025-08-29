-- Minimal migration to rename columns only
-- This migration only renames user_id to target_user_id in existing tables
-- Führe dieses Script im Supabase Dashboard aus

-- 1. Rename user_id to target_user_id in item_rights table if it exists
DO $$
BEGIN
    -- Check if item_rights table exists and has user_id column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'item_rights' 
        AND column_name = 'user_id'
        AND table_schema = 'public'
    ) THEN
        -- Rename user_id to target_user_id
        ALTER TABLE item_rights RENAME COLUMN user_id TO target_user_id;
        RAISE NOTICE 'Renamed user_id to target_user_id in item_rights table';
    ELSE
        RAISE NOTICE 'item_rights table does not exist or does not have user_id column';
    END IF;
    
    -- Check if profile_rights table exists and has user_id column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profile_rights' 
        AND column_name = 'user_id'
        AND table_schema = 'public'
    ) THEN
        -- Rename user_id to target_user_id
        ALTER TABLE profile_rights RENAME COLUMN user_id TO target_user_id;
        RAISE NOTICE 'Renamed user_id to target_user_id in profile_rights table';
    ELSE
        RAISE NOTICE 'profile_rights table does not exist or does not have user_id column';
    END IF;
END $$;

-- 2. Confirmation
SELECT 'Column renaming completed successfully!' as status;
