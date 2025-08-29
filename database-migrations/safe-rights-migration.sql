-- Safe Rights System Migration
-- This migration adds missing parts without dropping existing data
-- Führe dieses Script im Supabase Dashboard aus

-- 1. Create profile_rights table if it doesn't exist
CREATE TABLE IF NOT EXISTS profile_rights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rights JSONB NOT NULL DEFAULT '{"download": false, "edit": false, "delete": false}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(profile_id, target_user_id)
);

-- 2. Create item_rights table if it doesn't exist
CREATE TABLE IF NOT EXISTS item_rights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rights JSONB NOT NULL DEFAULT '{"download": false, "edit": false, "delete": false}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(item_id, target_user_id)
);

-- 3. Add missing columns if they don't exist
ALTER TABLE profile_rights 
ADD COLUMN IF NOT EXISTS rights JSONB DEFAULT '{"download": false, "edit": false, "delete": false}',
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE item_rights 
ADD COLUMN IF NOT EXISTS rights JSONB DEFAULT '{"download": false, "edit": false, "delete": false}',
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 4. Create or replace public_profiles view
CREATE OR REPLACE VIEW public_profiles AS
SELECT 
    id,
    full_name,
    email,
    avatar_url,
    created_at,
    updated_at
FROM profiles;

-- 5. Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. Create triggers for updated_at (drop if exists first)
DROP TRIGGER IF EXISTS update_profile_rights_updated_at ON profile_rights;
CREATE TRIGGER update_profile_rights_updated_at 
  BEFORE UPDATE ON profile_rights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_item_rights_updated_at ON item_rights;
CREATE TRIGGER update_item_rights_updated_at 
  BEFORE UPDATE ON item_rights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Create rights checking functions
CREATE OR REPLACE FUNCTION check_item_rights(
  p_item_id UUID,
  p_user_id UUID,
  p_right_type TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  item_owner_id UUID;
  profile_rights JSONB;
  item_rights JSONB;
BEGIN
  -- Item-Besitzer hat immer alle Rechte
  SELECT user_id INTO item_owner_id FROM items WHERE id = p_item_id;
  IF item_owner_id = p_user_id THEN
    RETURN TRUE;
  END IF;

  -- Prüfe Profilrechte
  SELECT rights INTO profile_rights 
  FROM profile_rights 
  WHERE profile_id = item_owner_id AND target_user_id = p_user_id;
  
  IF profile_rights IS NOT NULL AND profile_rights->>p_right_type = 'true' THEN
    RETURN TRUE;
  END IF;

  -- Prüfe Item-spezifische Rechte
  SELECT rights INTO item_rights 
  FROM item_rights 
  WHERE item_id = p_item_id AND target_user_id = p_user_id;
  
  IF item_rights IS NOT NULL AND item_rights->>p_right_type = 'true' THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 8. Create function to get all user rights for an item
CREATE OR REPLACE FUNCTION get_user_item_rights(
  p_item_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  item_owner_id UUID;
  profile_rights JSONB;
  item_rights JSONB;
  result JSONB;
BEGIN
  -- Item-Besitzer hat immer alle Rechte
  SELECT user_id INTO item_owner_id FROM items WHERE id = p_item_id;
  IF item_owner_id = p_user_id THEN
    RETURN '{"download": true, "edit": true, "delete": true}'::JSONB;
  END IF;

  -- Prüfe Profilrechte
  SELECT rights INTO profile_rights 
  FROM profile_rights 
  WHERE profile_id = item_owner_id AND target_user_id = p_user_id;
  
  -- Prüfe Item-spezifische Rechte
  SELECT rights INTO item_rights 
  FROM item_rights 
  WHERE item_id = p_item_id AND target_user_id = p_user_id;
  
  -- Kombiniere Rechte
  result := COALESCE(profile_rights, '{"download": false, "edit": false, "delete": false}'::JSONB);
  
  IF item_rights IS NOT NULL THEN
    result := result || item_rights;
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 9. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profile_rights_profile_id ON profile_rights(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_rights_target_user_id ON profile_rights(target_user_id);
CREATE INDEX IF NOT EXISTS idx_item_rights_item_id ON item_rights(item_id);
CREATE INDEX IF NOT EXISTS idx_item_rights_target_user_id ON item_rights(target_user_id);

-- 10. Enable RLS
ALTER TABLE profile_rights ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_rights ENABLE ROW LEVEL SECURITY;

-- 11. Create RLS policies for profile_rights (drop if exists first)
DROP POLICY IF EXISTS "Users can view their own profile rights" ON profile_rights;
CREATE POLICY "Users can view their own profile rights" ON profile_rights
    FOR SELECT USING (
        profile_id = auth.uid() OR target_user_id = auth.uid()
    );

DROP POLICY IF EXISTS "Users can manage their own profile rights" ON profile_rights;
CREATE POLICY "Users can manage their own profile rights" ON profile_rights
    FOR ALL USING (
        profile_id = auth.uid()
    );

-- 12. Create RLS policies for item_rights (drop if exists first)
DROP POLICY IF EXISTS "Users can view rights for their own items" ON item_rights;
CREATE POLICY "Users can view rights for their own items" ON item_rights
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM items 
            WHERE items.id = item_rights.item_id 
            AND items.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can manage rights for their own items" ON item_rights;
CREATE POLICY "Users can manage rights for their own items" ON item_rights
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM items 
            WHERE items.id = item_rights.item_id 
            AND items.user_id = auth.uid()
        )
    );

-- 13. Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON profile_rights TO anon, authenticated;
GRANT ALL ON item_rights TO anon, authenticated;
GRANT SELECT ON public_profiles TO anon, authenticated;
GRANT EXECUTE ON FUNCTION check_item_rights(UUID, UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_item_rights(UUID, UUID) TO anon, authenticated;

-- 14. Confirmation
SELECT 'Safe rights system migration completed successfully!' as status;
