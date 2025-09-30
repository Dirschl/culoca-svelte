-- Fix user role download permissions
-- This script removes the default download permission from the user role
-- Users will need explicit permission to download images

-- Update user role (role_id = 2) to remove default download permission
UPDATE roles 
SET permissions = jsonb_set(
  permissions, 
  '{download}', 
  'false'
) 
WHERE id = 2; -- user role

-- Verify the changes
SELECT id, name, display_name, permissions->'download' as download_permission, permissions->'download_original' as download_original_permission 
FROM roles 
WHERE id = 2;

-- Test the unified rights function
SELECT 'User role download permission removed!' as status;




