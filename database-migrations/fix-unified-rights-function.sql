-- Fix for the unified rights function
-- This migration fixes the get_unified_item_rights function to work with the current table structure
-- Führe dieses Script im Supabase Dashboard aus

-- Drop and recreate the function with better debugging
CREATE OR REPLACE FUNCTION get_unified_item_rights(
  p_item_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  item_owner_id UUID;
  user_role_id INTEGER;
  role_permissions JSONB;
  profile_rights JSONB;
  item_rights JSONB;
  result JSONB;
BEGIN
  -- Get item owner
  SELECT user_id INTO item_owner_id FROM items WHERE id = p_item_id;
  
  -- Item owner has all rights
  IF item_owner_id = p_user_id THEN
    RETURN '{"download": true, "download_original": true, "edit": true, "delete": true}'::JSONB;
  END IF;
  
  -- Get user's role permissions
  SELECT role_id INTO user_role_id FROM profiles WHERE id = p_user_id;
  IF user_role_id IS NULL THEN
    user_role_id := 1; -- anonymous
  END IF;
  
  SELECT permissions INTO role_permissions FROM roles WHERE id = user_role_id;
  
  -- Get profile rights (for all items of the owner)
  SELECT rights INTO profile_rights 
  FROM profile_rights 
  WHERE profile_id = item_owner_id AND target_user_id = p_user_id;
  
  -- Get item-specific rights (check both old and new structure)
  SELECT rights INTO item_rights 
  FROM item_rights 
  WHERE item_id = p_item_id AND target_user_id = p_user_id;
  
  -- Start with role permissions (system-wide)
  result := COALESCE(role_permissions, '{}'::JSONB);
  
  -- Override with profile rights if they exist
  IF profile_rights IS NOT NULL THEN
    -- For download, check both role and profile rights
    IF COALESCE(profile_rights->>'download', 'false')::BOOLEAN THEN
      result := jsonb_set(result, '{download}', 'true');
    END IF;
    
    -- For download_original, check both role and profile rights
    IF COALESCE(profile_rights->>'download_original', 'false')::BOOLEAN THEN
      result := jsonb_set(result, '{download_original}', 'true');
    END IF;
    
    -- For edit, check both role and profile rights
    IF COALESCE(profile_rights->>'edit', 'false')::BOOLEAN THEN
      result := jsonb_set(result, '{edit}', 'true');
    END IF;
    
    -- For delete, check both role and profile rights
    IF COALESCE(profile_rights->>'delete', 'false')::BOOLEAN THEN
      result := jsonb_set(result, '{delete}', 'true');
    END IF;
  END IF;
  
  -- Override with item-specific rights if they exist (highest priority)
  IF item_rights IS NOT NULL THEN
    -- For download, check role, profile, and item rights
    IF COALESCE(item_rights->>'download', 'false')::BOOLEAN THEN
      result := jsonb_set(result, '{download}', 'true');
    END IF;
    
    -- For download_original, check role, profile, and item rights
    IF COALESCE(item_rights->>'download_original', 'false')::BOOLEAN THEN
      result := jsonb_set(result, '{download_original}', 'true');
    END IF;
    
    -- For edit, check role, profile, and item rights
    IF COALESCE(item_rights->>'edit', 'false')::BOOLEAN THEN
      result := jsonb_set(result, '{edit}', 'true');
    END IF;
    
    -- For delete, check role, profile, and item rights
    IF COALESCE(item_rights->>'delete', 'false')::BOOLEAN THEN
      result := jsonb_set(result, '{delete}', 'true');
    END IF;
  END IF;
  
  -- Ensure all required fields are present with defaults
  result := result || '{"download": false, "download_original": false, "edit": false, "delete": false}'::JSONB;
  
  -- Only return the rights we care about
  RETURN jsonb_build_object(
    'download', COALESCE(result->>'download', 'false')::BOOLEAN,
    'download_original', COALESCE(result->>'download_original', 'false')::BOOLEAN,
    'edit', COALESCE(result->>'edit', 'false')::BOOLEAN,
    'delete', COALESCE(result->>'delete', 'false')::BOOLEAN
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also fix the item_rights table to remove old columns and ensure consistency
-- First, migrate any data from old columns to new rights JSONB
UPDATE item_rights 
SET rights = jsonb_build_object(
  'download', COALESCE(allow_download, false),
  'download_original', false,
  'edit', COALESCE(allow_edit, false),
  'delete', COALESCE(allow_delete, false)
)
WHERE rights IS NULL OR rights = '{}'::JSONB;

-- Now drop the old columns
ALTER TABLE item_rights 
DROP COLUMN IF EXISTS allow_download,
DROP COLUMN IF EXISTS allow_edit,
DROP COLUMN IF EXISTS allow_delete;

-- Confirmation
SELECT 'Unified rights function fixed successfully!' as status;
