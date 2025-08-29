-- RLS-Policies für Profilrechte-System (KORRIGIERT)
-- Führe diese SQL-Befehle im Supabase Dashboard aus

-- RLS für profile_rights aktivieren
ALTER TABLE profile_rights ENABLE ROW LEVEL SECURITY;

-- Policy: Benutzer können ihre eigenen Profilrechte lesen
DROP POLICY IF EXISTS "Users can read their own profile rights" ON profile_rights;
CREATE POLICY "Users can read their own profile rights" ON profile_rights
  FOR SELECT USING (profile_id = auth.uid());

-- Policy: Benutzer können ihre eigenen Profilrechte erstellen/bearbeiten
DROP POLICY IF EXISTS "Users can manage their own profile rights" ON profile_rights;
CREATE POLICY "Users can manage their own profile rights" ON profile_rights
  FOR ALL USING (profile_id = auth.uid());

-- Policy: Benutzer können Profilrechte lesen, die ihnen gewährt wurden
DROP POLICY IF EXISTS "Users can read rights granted to them" ON profile_rights;
CREATE POLICY "Users can read rights granted to them" ON profile_rights
  FOR SELECT USING (target_user_id = auth.uid());

-- RLS für item_rights aktivieren
ALTER TABLE item_rights ENABLE ROW LEVEL SECURITY;

-- Policy: Benutzer können ihre eigenen Item-Rechte lesen
DROP POLICY IF EXISTS "Users can read their own item rights" ON item_rights;
CREATE POLICY "Users can read their own item rights" ON item_rights
  FOR SELECT USING (user_id = auth.uid());

-- Policy: Item-Besitzer können Rechte für ihre Items verwalten
DROP POLICY IF EXISTS "Item owners can manage rights for their items" ON item_rights;
CREATE POLICY "Item owners can manage rights for their items" ON item_rights
  FOR ALL USING (
    item_id IN (
      SELECT id FROM items WHERE profile_id = auth.uid()
    )
  );

-- Policy: Benutzer können Item-Rechte lesen, die ihnen gewährt wurden
DROP POLICY IF EXISTS "Users can read item rights granted to them" ON item_rights;
CREATE POLICY "Users can read item rights granted to them" ON item_rights
  FOR SELECT USING (user_id = auth.uid());

-- Zusätzliche Policy für profiles Tabelle (falls noch nicht vorhanden)
-- Erlaubt Benutzern, andere Benutzer zu suchen
DROP POLICY IF EXISTS "Users can search other users" ON profiles;
CREATE POLICY "Users can search other users" ON profiles
  FOR SELECT USING (true);

-- Policy für profiles: Benutzer können ihr eigenes Profil bearbeiten
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- Policy für profiles: Benutzer können ihr eigenes Profil lesen
DROP POLICY IF EXISTS "Users can read their own profile" ON profiles;
CREATE POLICY "Users can read their own profile" ON profiles
  FOR SELECT USING (id = auth.uid());

-- Alternative: Einfache Freigabe für profiles (falls Policies Probleme machen)
-- DROP POLICY IF EXISTS "Users can search other users" ON profiles;
-- CREATE POLICY "Users can search other users" ON profiles FOR SELECT USING (true);
