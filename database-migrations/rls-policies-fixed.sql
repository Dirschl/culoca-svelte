-- Korrigierte RLS-Policies für Profilrechte-System mit Bearer-Token
-- Führe diese SQL-Befehle im Supabase Dashboard aus

-- 1. Einfache Freigabe für profiles Tabelle (Benutzersuche)
DROP POLICY IF EXISTS "Users can search other users" ON profiles;
CREATE POLICY "Users can search other users" ON profiles FOR SELECT USING (true);

-- 2. RLS für profile_rights aktivieren
ALTER TABLE profile_rights ENABLE ROW LEVEL SECURITY;

-- 3. Policy für profile_rights - erlaubt Benutzern ihre eigenen Rechte zu verwalten
DROP POLICY IF EXISTS "Users can manage their own profile rights" ON profile_rights;
CREATE POLICY "Users can manage their own profile rights" ON profile_rights
  FOR ALL USING (profile_id = auth.uid());

-- 4. Zusätzliche Policy für profile_rights - erlaubt Benutzern Rechte zu lesen, die ihnen gewährt wurden
DROP POLICY IF EXISTS "Users can read rights granted to them" ON profile_rights;
CREATE POLICY "Users can read rights granted to them" ON profile_rights
  FOR SELECT USING (target_user_id = auth.uid());

-- 5. RLS für item_rights aktivieren
ALTER TABLE item_rights ENABLE ROW LEVEL SECURITY;

-- 6. Policy für item_rights - erlaubt Benutzern ihre eigenen Rechte zu verwalten
DROP POLICY IF EXISTS "Users can manage their own item rights" ON item_rights;
CREATE POLICY "Users can manage their own item rights" ON item_rights
  FOR ALL USING (user_id = auth.uid());

-- 7. Policy für Item-Besitzer - erlaubt Item-Besitzern Rechte für ihre Items zu verwalten
DROP POLICY IF EXISTS "Item owners can manage rights for their items" ON item_rights;
CREATE POLICY "Item owners can manage rights for their items" ON item_rights
  FOR ALL USING (
    item_id IN (
      SELECT id FROM items WHERE profile_id = auth.uid()
    )
  );

-- 8. Zusätzliche Policy für item_rights - erlaubt Benutzern Rechte zu lesen, die ihnen gewährt wurden
DROP POLICY IF EXISTS "Users can read item rights granted to them" ON item_rights;
CREATE POLICY "Users can read item rights granted to them" ON item_rights
  FOR SELECT USING (user_id = auth.uid());
