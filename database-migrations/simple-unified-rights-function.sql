-- Simple unified rights function
-- This migration creates a very simple function to debug the issue
-- Führe dieses Script im Supabase Dashboard aus

-- Drop the existing function
DROP FUNCTION IF EXISTS get_unified_item_rights(UUID, UUID);

-- Create a very simple function for debugging
CREATE OR REPLACE FUNCTION get_unified_item_rights(
  p_item_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  item_owner_id UUID;
  profile_rights JSONB;
  result JSONB;
BEGIN
  -- Get item owner
  SELECT user_id INTO item_owner_id FROM items WHERE id = p_item_id;
  
  -- Item owner has all rights
  IF item_owner_id = p_user_id THEN
    RETURN '{"download": true, "download_original": true, "edit": true, "delete": true}'::JSONB;
  END IF;
  
  -- Get profile rights (for all items of the owner)
  SELECT rights INTO profile_rights 
  FROM profile_rights 
  WHERE profile_id = item_owner_id AND target_user_id = p_user_id;
  
  -- If profile rights exist, return them
  IF profile_rights IS NOT NULL THEN
    RETURN jsonb_build_object(
      'download', COALESCE(profile_rights->>'download', 'false')::BOOLEAN,
      'download_original', COALESCE(profile_rights->>'download_original', 'false')::BOOLEAN,
      'edit', COALESCE(profile_rights->>'edit', 'false')::BOOLEAN,
      'delete', COALESCE(profile_rights->>'delete', 'false')::BOOLEAN
    );
  END IF;
  
  -- Default: no rights
  RETURN '{"download": false, "download_original": false, "edit": false, "delete": false}'::JSONB;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Confirmation
SELECT 'Simple unified rights function created successfully!' as status;
