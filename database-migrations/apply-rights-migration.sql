-- Anwendung der Rechte-System Migration
-- Führe dieses Script im Supabase Dashboard aus

-- 1. Profilrechte Tabelle erstellen
CREATE TABLE IF NOT EXISTS profile_rights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  rights JSONB NOT NULL DEFAULT '{"download": false, "edit": false, "delete": false}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(profile_id, target_user_id)
);

-- 2. Item-Rechte Tabelle erstellen (korrigiert für items Tabelle)
CREATE TABLE IF NOT EXISTS item_rights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  rights JSONB NOT NULL DEFAULT '{"download": false, "edit": false, "delete": false}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(item_id, target_user_id)
);

-- Ensure the foreign key constraint exists with the correct name
DO $$
BEGIN
  -- Drop existing constraint if it has wrong name
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
END $$;

-- 3. Trigger-Funktion erstellen
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 4. Trigger für profile_rights
DROP TRIGGER IF EXISTS update_profile_rights_updated_at ON profile_rights;
CREATE TRIGGER update_profile_rights_updated_at 
  BEFORE UPDATE ON profile_rights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Trigger für item_rights
DROP TRIGGER IF EXISTS update_item_rights_updated_at ON item_rights;
CREATE TRIGGER update_item_rights_updated_at 
  BEFORE UPDATE ON item_rights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Rechte-Prüfungsfunktion
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

-- 7. Funktion zum Abrufen aller Rechte
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

-- 8. Indizes für Performance
CREATE INDEX IF NOT EXISTS idx_profile_rights_profile_id ON profile_rights(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_rights_target_user_id ON profile_rights(target_user_id);
CREATE INDEX IF NOT EXISTS idx_item_rights_item_id ON item_rights(item_id);
CREATE INDEX IF NOT EXISTS idx_item_rights_target_user_id ON item_rights(target_user_id);

-- 9. RLS aktivieren (optional - für zusätzliche Sicherheit)
ALTER TABLE profile_rights ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_rights ENABLE ROW LEVEL SECURITY;

-- 10. Bestätigung
SELECT 'Rechte-System erfolgreich installiert!' as status;
