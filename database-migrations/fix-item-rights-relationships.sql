-- Fix item_rights table relationships
-- This migration ensures proper foreign key relationships

-- 1. Check if public_profiles view exists, if not create it
CREATE OR REPLACE VIEW public_profiles AS
SELECT 
    id,
    full_name,
    email,
    avatar_url,
    created_at,
    updated_at
FROM profiles;

-- 2. Grant permissions on the view
GRANT SELECT ON public_profiles TO anon, authenticated;

-- 3. Ensure item_rights table has correct foreign key constraints
DO $$
BEGIN
    -- Drop existing constraint if it exists with wrong name
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'item_rights_target_user_id_fkey' 
        AND table_name = 'item_rights'
    ) THEN
        ALTER TABLE item_rights DROP CONSTRAINT item_rights_target_user_id_fkey;
    END IF;
    
    -- Add the constraint with correct name
    ALTER TABLE item_rights 
    ADD CONSTRAINT item_rights_target_user_id_fkey 
    FOREIGN KEY (target_user_id) REFERENCES profiles(id) ON DELETE CASCADE;
    
    -- Also ensure item_id constraint exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'item_rights_item_id_fkey' 
        AND table_name = 'item_rights'
    ) THEN
        ALTER TABLE item_rights 
        ADD CONSTRAINT item_rights_item_id_fkey 
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. Ensure profile_rights table has correct foreign key constraints
DO $$
BEGIN
    -- Drop existing constraints if they exist with wrong names
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profile_rights_profile_id_fkey' 
        AND table_name = 'profile_rights'
    ) THEN
        ALTER TABLE profile_rights DROP CONSTRAINT profile_rights_profile_id_fkey;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profile_rights_target_user_id_fkey' 
        AND table_name = 'profile_rights'
    ) THEN
        ALTER TABLE profile_rights DROP CONSTRAINT profile_rights_target_user_id_fkey;
    END IF;
    
    -- Add the constraints with correct names
    ALTER TABLE profile_rights 
    ADD CONSTRAINT profile_rights_profile_id_fkey 
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
    
    ALTER TABLE profile_rights 
    ADD CONSTRAINT profile_rights_target_user_id_fkey 
    FOREIGN KEY (target_user_id) REFERENCES profiles(id) ON DELETE CASCADE;
END $$;

-- 5. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_item_rights_item_id ON item_rights(item_id);
CREATE INDEX IF NOT EXISTS idx_item_rights_target_user_id ON item_rights(target_user_id);
CREATE INDEX IF NOT EXISTS idx_profile_rights_profile_id ON profile_rights(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_rights_target_user_id ON profile_rights(target_user_id);

-- 6. Enable RLS if not already enabled
ALTER TABLE item_rights ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_rights ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies for item_rights
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

-- 8. Create RLS policies for profile_rights
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

-- 9. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON item_rights TO anon, authenticated;
GRANT ALL ON profile_rights TO anon, authenticated;
GRANT SELECT ON public_profiles TO anon, authenticated;

-- 10. Confirmation
SELECT 'item_rights relationships successfully fixed!' as status;
