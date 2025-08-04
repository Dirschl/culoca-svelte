-- =====================================================
-- ADD GPS TRACKING PERMISSION TO ROLES
-- =====================================================

-- Add gps_tracking permission to all roles
UPDATE roles 
SET permissions = jsonb_set(permissions, '{gps_tracking}', 'false')
WHERE id IN (1, 2, 3); -- anonymous, user, admin roles

-- Verify the changes
SELECT id, name, display_name, permissions->'gps_tracking' as gps_tracking_permission 
FROM roles 
ORDER BY id; 