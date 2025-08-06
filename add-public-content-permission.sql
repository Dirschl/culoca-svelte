-- =====================================================
-- ADD PUBLIC_CONTENT PERMISSION TO ROLES
-- =====================================================

-- Add public_content permission to existing roles
-- Only admins should have this permission

UPDATE roles 
SET permissions = jsonb_set(
  permissions, 
  '{public_content}', 
  'false'
) 
WHERE id = 1; -- anonymous role

UPDATE roles 
SET permissions = jsonb_set(
  permissions, 
  '{public_content}', 
  'false'
) 
WHERE id = 2; -- user role

UPDATE roles 
SET permissions = jsonb_set(
  permissions, 
  '{public_content}', 
  'true'
) 
WHERE id = 3; -- admin role

-- Verify the changes
SELECT id, name, display_name, permissions->'public_content' as public_content_permission 
FROM roles 
ORDER BY id; 