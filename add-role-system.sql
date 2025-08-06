-- =====================================================
-- ADD ROLE-BASED PERMISSION SYSTEM
-- =====================================================

-- This script adds a comprehensive role-based permission system
-- to manage user access levels and feature permissions

-- 1. Create roles table FIRST
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Insert default roles FIRST
INSERT INTO roles (id, name, display_name, description, permissions) VALUES
(1, 'anonymous', 'Anonym', 'Nicht eingeloggte Benutzer - nur Lesen erlaubt', '{
  "view_gallery": true,
  "view_items": true,
  "view_maps": true,
  "search": true,
  "joystick": false,
  "bulk_upload": false,
  "settings": false,
  "admin": false,
  "delete_items": false,
  "edit_items": false,
  "create_items": false
}'),
(2, 'user', 'Benutzer', 'Eingeloggte Benutzer - erweiterte Funktionen', '{
  "view_gallery": true,
  "view_items": true,
  "view_maps": true,
  "search": true,
  "joystick": true,
  "bulk_upload": true,
  "settings": true,
  "admin": false,
  "delete_items": false,
  "edit_items": true,
  "create_items": true
}'),
(3, 'admin', 'Administrator', 'Vollzugriff auf alle Funktionen', '{
  "view_gallery": true,
  "view_items": true,
  "view_maps": true,
  "search": true,
  "joystick": true,
  "bulk_upload": true,
  "settings": true,
  "admin": true,
  "delete_items": true,
  "edit_items": true,
  "create_items": true,
  "manage_users": true,
  "view_analytics": true,
  "system_settings": true
}')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions,
  updated_at = NOW();

-- 3. NOW add role_id column to profiles table (AFTER roles exist)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id) DEFAULT 1;

-- 4. Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_role_id ON profiles(role_id);

-- 5. Update existing profiles to have user role (if they don't have one)
UPDATE profiles 
SET role_id = 2 
WHERE role_id IS NULL OR role_id = 1;

-- 6. Create function to check permissions
CREATE OR REPLACE FUNCTION has_permission(user_id UUID, permission_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_role_id INTEGER;
  user_permissions JSONB;
BEGIN
  -- Get user's role
  SELECT role_id INTO user_role_id
  FROM profiles
  WHERE id = user_id;
  
  -- If no role found, treat as anonymous
  IF user_role_id IS NULL THEN
    user_role_id := 1;
  END IF;
  
  -- Get permissions for the role
  SELECT permissions INTO user_permissions
  FROM roles
  WHERE id = user_role_id;
  
  -- Return the specific permission (default to false if not found)
  RETURN COALESCE(user_permissions->>permission_name, 'false')::BOOLEAN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create function to get user permissions
CREATE OR REPLACE FUNCTION get_user_permissions(user_id UUID)
RETURNS JSONB AS $$
DECLARE
  user_role_id INTEGER;
  user_permissions JSONB;
BEGIN
  -- Get user's role
  SELECT role_id INTO user_role_id
  FROM profiles
  WHERE id = user_id;
  
  -- If no role found, treat as anonymous
  IF user_role_id IS NULL THEN
    user_role_id := 1;
  END IF;
  
  -- Get permissions for the role
  SELECT permissions INTO user_permissions
  FROM roles
  WHERE id = user_role_id;
  
  RETURN user_permissions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create function to get user role info
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
  LEFT JOIN profiles p ON p.id = user_id
  WHERE r.id = COALESCE(p.role_id, 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Create view for easy permission checking
CREATE OR REPLACE VIEW user_permissions_view AS
SELECT 
  p.id as user_id,
  p.full_name,
  p.email,
  r.id as role_id,
  r.name as role_name,
  r.display_name as role_display_name,
  r.permissions
FROM profiles p
JOIN roles r ON r.id = COALESCE(p.role_id, 1);

-- 10. Add comments for documentation
COMMENT ON TABLE roles IS 'User roles and their permissions';
COMMENT ON COLUMN roles.permissions IS 'JSONB object containing permission flags';
COMMENT ON FUNCTION has_permission(UUID, TEXT) IS 'Check if a user has a specific permission';
COMMENT ON FUNCTION get_user_permissions(UUID) IS 'Get all permissions for a user';
COMMENT ON FUNCTION get_user_role_info(UUID) IS 'Get role information for a user';

-- 11. Grant necessary permissions
GRANT SELECT ON roles TO authenticated;
GRANT SELECT ON user_permissions_view TO authenticated;
GRANT EXECUTE ON FUNCTION has_permission(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_permissions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_role_info(UUID) TO authenticated;

-- 12. Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION update_roles_updated_at();

-- =====================================================
-- USAGE EXAMPLES:
-- =====================================================

-- Check if user can access admin panel:
-- SELECT has_permission('user-uuid-here', 'admin');

-- Get all permissions for a user:
-- SELECT get_user_permissions('user-uuid-here');

-- Get role information:
-- SELECT * FROM get_user_role_info('user-uuid-here');

-- View all users and their permissions:
-- SELECT * FROM user_permissions_view;

-- =====================================================
-- PERMISSION NAMES REFERENCE:
-- =====================================================
-- view_gallery: Can view the main gallery
-- view_items: Can view individual items
-- view_maps: Can view map interface
-- search: Can use search functionality
-- joystick: Can access simulation/joystick feature
-- bulk_upload: Can use bulk upload feature
-- settings: Can access user settings
-- admin: Can access admin panel
-- delete_items: Can delete items
-- edit_items: Can edit item metadata
-- create_items: Can create new items
-- manage_users: Can manage other users (admin only)
-- view_analytics: Can view analytics (admin only)
-- system_settings: Can change system settings (admin only) 