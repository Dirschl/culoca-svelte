-- Einfache RLS-Policies für Profilrechte-System
-- Führe diese SQL-Befehle im Supabase Dashboard aus

-- 1. Einfache Freigabe für profiles Tabelle (Benutzersuche)
DROP POLICY IF EXISTS "Users can search other users" ON profiles;
CREATE POLICY "Users can search other users" ON profiles FOR SELECT USING (true);

-- 2. RLS für profile_rights aktivieren
ALTER TABLE profile_rights ENABLE ROW LEVEL SECURITY;

-- 3. Einfache Policy für profile_rights
DROP POLICY IF EXISTS "Users can manage their own profile rights" ON profile_rights;
CREATE POLICY "Users can manage their own profile rights" ON profile_rights
  FOR ALL USING (profile_id = auth.uid());

-- 4. RLS für item_rights aktivieren
ALTER TABLE item_rights ENABLE ROW LEVEL SECURITY;

-- 5. Einfache Policy für item_rights
DROP POLICY IF EXISTS "Users can manage their own item rights" ON item_rights;
CREATE POLICY "Users can manage their own item rights" ON item_rights
  FOR ALL USING (user_id = auth.uid());

-- 6. Policy für Item-Besitzer
DROP POLICY IF EXISTS "Item owners can manage rights for their items" ON item_rights;
CREATE POLICY "Item owners can manage rights for their items" ON item_rights
  FOR ALL USING (
    item_id IN (
      SELECT id FROM items WHERE profile_id = auth.uid()
    )
  );
