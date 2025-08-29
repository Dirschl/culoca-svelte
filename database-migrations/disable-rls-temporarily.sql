-- Temporär RLS deaktivieren für Tests
-- Führe diese SQL-Befehle im Supabase Dashboard aus

-- RLS für profile_rights temporär deaktivieren
ALTER TABLE profile_rights DISABLE ROW LEVEL SECURITY;

-- RLS für item_rights temporär deaktivieren
ALTER TABLE item_rights DISABLE ROW LEVEL SECURITY;

-- RLS für profiles deaktivieren (nur für Benutzersuche)
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
