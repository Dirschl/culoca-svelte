-- Create item_rights table with correct structure
-- This migration creates the item_rights table from scratch
-- Führe dieses Script im Supabase Dashboard aus

-- 1. Drop existing table if it exists (BE CAREFUL - this will delete existing data!)
DROP TABLE IF EXISTS item_rights CASCADE;

-- 2. Create item_rights table with correct structure
CREATE TABLE item_rights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rights JSONB NOT NULL DEFAULT '{"download": false, "edit": false, "delete": false}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(item_id, target_user_id)
);

-- 3. Create profile_rights table if it doesn't exist
CREATE TABLE IF NOT EXISTS profile_rights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rights JSONB NOT NULL DEFAULT '{"download": false, "edit": false, "delete": false}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(profile_id, target_user_id)
);

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

-- 6. Create triggers for updated_at
CREATE TRIGGER update_item_rights_updated_at 
  BEFORE UPDATE ON item_rights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profile_rights_updated_at 
  BEFORE UPDATE ON profile_rights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Create indexes for performance
CREATE INDEX idx_item_rights_item_id ON item_rights(item_id);
CREATE INDEX idx_item_rights_target_user_id ON item_rights(target_user_id);
CREATE INDEX idx_profile_rights_profile_id ON profile_rights(profile_id);
CREATE INDEX idx_profile_rights_target_user_id ON profile_rights(target_user_id);

-- 8. Enable RLS
ALTER TABLE item_rights ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_rights ENABLE ROW LEVEL SECURITY;

-- 9. Create RLS policies for item_rights
CREATE POLICY "Users can view rights for their own items" ON item_rights
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM items 
            WHERE items.id = item_rights.item_id 
            AND items.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage rights for their own items" ON item_rights
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM items 
            WHERE items.id = item_rights.item_id 
            AND items.user_id = auth.uid()
        )
    );

-- 10. Create RLS policies for profile_rights
CREATE POLICY "Users can view their own profile rights" ON profile_rights
    FOR SELECT USING (
        profile_id = auth.uid() OR target_user_id = auth.uid()
    );

CREATE POLICY "Users can manage their own profile rights" ON profile_rights
    FOR ALL USING (
        profile_id = auth.uid()
    );

-- 11. Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON item_rights TO anon, authenticated;
GRANT ALL ON profile_rights TO anon, authenticated;
GRANT SELECT ON public_profiles TO anon, authenticated;

-- 12. Confirmation
SELECT 'item_rights table created successfully!' as status;
