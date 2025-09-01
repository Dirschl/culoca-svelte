-- =====================================================
-- UNIFIED RIGHTS SYSTEM MIGRATION
-- =====================================================
-- This migration unifies the three rights systems:
-- 1. Roles → permissions (JSONB) - system-wide permissions
-- 2. Profile Rights - for all items of a user
-- 3. Item Rights - for specific items
-- Führe dieses Script im Supabase Dashboard aus

-- 1. Add download_original permission to existing roles
UPDATE roles 
SET permissions = jsonb_set(
  permissions, 
  '{download_original}', 
  'false'
) 
WHERE id = 1; -- anonymous role

UPDATE roles 
SET permissions = jsonb_set(
  permissions, 
  '{download_original}', 
  'false'
) 
WHERE id = 2; -- user role

UPDATE roles 
SET permissions = jsonb_set(
  permissions, 
  '{download_original}', 
  'true'
) 
WHERE id = 3; -- admin role

-- 2. Create comprehensive rights checking function
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
  
  -- Get item-specific rights
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

-- 3. Create simplified permission check function
CREATE OR REPLACE FUNCTION has_item_permission(
  p_item_id UUID,
  p_user_id UUID,
  p_permission TEXT -- 'download', 'download_original', 'edit', 'delete'
)
RETURNS BOOLEAN AS $$
DECLARE
  rights JSONB;
BEGIN
  rights := get_unified_item_rights(p_item_id, p_user_id);
  RETURN COALESCE(rights->>p_permission, 'false')::BOOLEAN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update existing rights tables to include download_original
-- Update profile_rights default
UPDATE profile_rights 
SET rights = rights || '{"download_original": false}'::JSONB
WHERE rights->>'download_original' IS NULL;

-- Update item_rights default
UPDATE item_rights 
SET rights = rights || '{"download_original": false}'::JSONB
WHERE rights->>'download_original' IS NULL;

-- 5. Create function to get user's role info with permissions
CREATE OR REPLACE FUNCTION get_user_role_info(user_id UUID)
RETURNS TABLE(
  role_id INTEGER,
  role_name VARCHAR(50),
  display_name VARCHAR(100),
  permissions JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.name,
    r.display_name,
    r.permissions
  FROM roles r
  INNER JOIN profiles p ON p.role_id = r.id
  WHERE p.id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Confirmation
SELECT 'Unified rights system created successfully!' as status;
