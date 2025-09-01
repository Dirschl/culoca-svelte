-- Fix unified rights function to include item_rights
-- This migration updates the function to properly merge all three sources of rights
-- Führe dieses Script im Supabase Dashboard aus

-- Drop the existing function
DROP FUNCTION IF EXISTS get_unified_item_rights(UUID, UUID);

-- Create the complete unified rights function
CREATE OR REPLACE FUNCTION get_unified_item_rights(
  p_item_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  item_owner_id UUID;
  profile_rights JSONB;
  item_rights JSONB;
  role_permissions JSONB;
  result JSONB;
BEGIN
  -- Get item owner
  SELECT profile_id INTO item_owner_id FROM items WHERE id = p_item_id;
  
  -- Item owner has all rights
  IF item_owner_id = p_user_id THEN
    RETURN '{"download": true, "download_original": true, "edit": true, "delete": true}'::JSONB;
  END IF;
  
  -- Get profile rights (for all items of the owner)
  SELECT rights INTO profile_rights 
  FROM profile_rights 
  WHERE profile_id = item_owner_id AND target_user_id = p_user_id;
  
  -- Get item-specific rights
  SELECT rights INTO item_rights 
  FROM item_rights 
  WHERE item_id = p_item_id AND target_user_id = p_user_id;
  
  -- Get role permissions
  SELECT permissions INTO role_permissions 
  FROM roles r
  JOIN profiles p ON p.role_id = r.id
  WHERE p.id = p_user_id;
  
  -- Initialize result with role permissions (lowest priority)
  result := jsonb_build_object(
    'download', COALESCE(role_permissions->>'download', 'false')::BOOLEAN,
    'download_original', COALESCE(role_permissions->>'download_original', 'false')::BOOLEAN,
    'edit', COALESCE(role_permissions->>'edit', 'false')::BOOLEAN,
    'delete', COALESCE(role_permissions->>'delete', 'false')::BOOLEAN
  );
  
  -- Override with profile rights (medium priority)
  IF profile_rights IS NOT NULL THEN
    result := jsonb_build_object(
      'download', COALESCE(profile_rights->>'download', result->>'download')::BOOLEAN,
      'download_original', COALESCE(profile_rights->>'download_original', result->>'download_original')::BOOLEAN,
      'edit', COALESCE(profile_rights->>'edit', result->>'edit')::BOOLEAN,
      'delete', COALESCE(profile_rights->>'delete', result->>'delete')::BOOLEAN
    );
  END IF;
  
  -- Override with item rights (highest priority)
  IF item_rights IS NOT NULL THEN
    result := jsonb_build_object(
      'download', COALESCE(item_rights->>'download', result->>'download')::BOOLEAN,
      'download_original', COALESCE(item_rights->>'download_original', result->>'download_original')::BOOLEAN,
      'edit', COALESCE(item_rights->>'edit', result->>'edit')::BOOLEAN,
      'delete', COALESCE(item_rights->>'delete', result->>'delete')::BOOLEAN
    );
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Confirmation
SELECT 'Unified rights function with item_rights support created successfully!' as status;
