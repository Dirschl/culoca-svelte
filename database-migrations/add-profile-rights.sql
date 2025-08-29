-- Profilrechte-System für Culoca
-- Ermöglicht es Benutzern, anderen Benutzern Rechte auf ihre Items zu geben

-- Profilrechte Tabelle (JSONB für Flexibilität)
CREATE TABLE IF NOT EXISTS profile_rights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  rights JSONB NOT NULL DEFAULT '{"download": false, "edit": false, "delete": false}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(profile_id, target_user_id)
);

-- Item-spezifische Rechte Tabelle
CREATE TABLE IF NOT EXISTS item_rights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  allow_download BOOLEAN DEFAULT FALSE,
  allow_edit BOOLEAN DEFAULT FALSE,
  allow_delete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(item_id, user_id)
);

-- Trigger für updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger für profile_rights
DROP TRIGGER IF EXISTS update_profile_rights_updated_at ON profile_rights;
CREATE TRIGGER update_profile_rights_updated_at 
  BEFORE UPDATE ON profile_rights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger für item_rights
DROP TRIGGER IF EXISTS update_item_rights_updated_at ON item_rights;
CREATE TRIGGER update_item_rights_updated_at 
  BEFORE UPDATE ON item_rights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Funktion zur Rechte-Prüfung
CREATE OR REPLACE FUNCTION check_item_rights(
  p_item_id UUID,
  p_user_id UUID,
  p_right_type TEXT -- 'download', 'edit', 'delete'
)
RETURNS BOOLEAN AS $$
DECLARE
  item_owner_id UUID;
  profile_rights JSONB;
  item_rights RECORD;
BEGIN
  -- 1. Item-Besitzer hat immer alle Rechte
  SELECT profile_id INTO item_owner_id FROM items WHERE id = p_item_id;
  IF item_owner_id = p_user_id THEN
    RETURN TRUE;
  END IF;

  -- 2. Prüfe Profilrechte (globale Rechte des Item-Besitzers)
  SELECT rights INTO profile_rights 
  FROM profile_rights 
  WHERE profile_id = item_owner_id AND target_user_id = p_user_id;
  
  IF profile_rights IS NOT NULL AND profile_rights->>p_right_type = 'true' THEN
    RETURN TRUE;
  END IF;

  -- 3. Prüfe Item-spezifische Rechte
  SELECT * INTO item_rights 
  FROM item_rights 
  WHERE item_id = p_item_id AND user_id = p_user_id;
  
  IF item_rights IS NOT NULL THEN
    CASE p_right_type
      WHEN 'download' THEN RETURN item_rights.allow_download;
      WHEN 'edit' THEN RETURN item_rights.allow_edit;
      WHEN 'delete' THEN RETURN item_rights.allow_delete;
      ELSE RETURN FALSE;
    END CASE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Funktion zum Abrufen aller Rechte für einen Benutzer
CREATE OR REPLACE FUNCTION get_user_item_rights(
  p_item_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  item_owner_id UUID;
  profile_rights JSONB;
  item_rights RECORD;
  result JSONB;
BEGIN
  -- 1. Item-Besitzer hat immer alle Rechte
  SELECT profile_id INTO item_owner_id FROM items WHERE id = p_item_id;
  IF item_owner_id = p_user_id THEN
    RETURN '{"download": true, "edit": true, "delete": true}'::JSONB;
  END IF;

  -- 2. Prüfe Profilrechte
  SELECT rights INTO profile_rights 
  FROM profile_rights 
  WHERE profile_id = item_owner_id AND target_user_id = p_user_id;
  
  -- 3. Prüfe Item-spezifische Rechte
  SELECT * INTO item_rights 
  FROM item_rights 
  WHERE item_id = p_item_id AND user_id = p_user_id;
  
  -- Kombiniere Rechte (Item-Rechte überschreiben Profil-Rechte)
  result := COALESCE(profile_rights, '{"download": false, "edit": false, "delete": false}'::JSONB);
  
  IF item_rights IS NOT NULL THEN
    IF item_rights.allow_download THEN result := jsonb_set(result, '{download}', 'true'); END IF;
    IF item_rights.allow_edit THEN result := jsonb_set(result, '{edit}', 'true'); END IF;
    IF item_rights.allow_delete THEN result := jsonb_set(result, '{delete}', 'true'); END IF;
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Index für bessere Performance
CREATE INDEX IF NOT EXISTS idx_profile_rights_profile_id ON profile_rights(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_rights_target_user_id ON profile_rights(target_user_id);
CREATE INDEX IF NOT EXISTS idx_item_rights_item_id ON item_rights(item_id);
CREATE INDEX IF NOT EXISTS idx_item_rights_user_id ON item_rights(user_id);
