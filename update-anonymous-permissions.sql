-- =====================================================
-- UPDATE ANONYMOUS ROLE PERMISSIONS
-- =====================================================

-- Update anonymous role (role_id = 1) to include joystick and settings
UPDATE roles 
SET permissions = jsonb_set(
  jsonb_set(
    permissions, 
    '{joystick}', 
    'true'
  ),
  '{settings}',
  'true'
) 
WHERE id = 1; -- anonymous role

-- Verify the changes
SELECT id, name, display_name, permissions->'joystick' as joystick_permission, permissions->'settings' as settings_permission 
FROM roles 
WHERE id = 1; 