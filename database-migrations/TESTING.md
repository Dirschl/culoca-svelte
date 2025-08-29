# Testing Guide für Profilrechte-System

## 🔧 Schritt-für-Schritt Debugging

### 1. RLS-Policies korrigieren
Führe diese SQL-Befehle im Supabase Dashboard aus:

**Verwende die Datei: `rls-policies-simple.sql`**

```sql
-- Einfache Freigabe für profiles Tabelle (Benutzersuche)
DROP POLICY IF EXISTS "Users can search other users" ON profiles;
CREATE POLICY "Users can search other users" ON profiles FOR SELECT USING (true);

-- RLS für profile_rights aktivieren
ALTER TABLE profile_rights ENABLE ROW LEVEL SECURITY;

-- Einfache Policy für profile_rights
DROP POLICY IF EXISTS "Users can manage their own profile rights" ON profile_rights;
CREATE POLICY "Users can manage their own profile rights" ON profile_rights
  FOR ALL USING (profile_id = auth.uid());
```

### 2. Test-Endpoint aufrufen
```
http://localhost:5173/api/test-profile-rights
```

### 3. Browser-Konsole prüfen
- Öffne die Developer Tools (F12)
- Gehe zu Console
- Schaue nach detaillierten Fehlermeldungen

### 4. Einfache Benutzersuche testen
```
http://localhost:5173/api/search-users?q=test
```

## 🐛 Häufige Probleme

### Problem: "column user_id does not exist"
**Lösung:** Die `profiles` Tabelle verwendet `id`, nicht `user_id`

### Problem: "policy already exists"
**Lösung:** Verwende `CREATE POLICY IF NOT EXISTS` oder `DROP POLICY IF EXISTS`

### Problem: RLS blockiert Zugriff
**Lösung:** Temporär RLS deaktivieren für Tests:
```sql
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
```

## 📋 Debugging-Checkliste

- [ ] RLS-Policies korrekt erstellt?
- [ ] Tabellen existieren?
- [ ] Benutzer ist authentifiziert?
- [ ] Supabase Logs zeigen Fehler?
- [ ] Browser-Konsole zeigt Details?

## 🚀 Schnelltest

Führe diese SQL-Befehle aus, um alles zu testen:

```sql
-- Test 1: Tabellen existieren?
SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'profile_rights');
SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'item_rights');

-- Test 2: RLS aktiviert?
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('profile_rights', 'item_rights', 'profiles');

-- Test 3: Policies existieren?
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('profile_rights', 'item_rights', 'profiles');
```
