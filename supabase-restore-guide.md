# Supabase Datenbankrücksicherung - Anleitung

## 🚨 WICHTIG: App ist kaputt - Datenbankrücksicherung nötig

### **Option 1: Supabase Dashboard (Empfohlen)**

1. **Gehen Sie zu [supabase.com](https://supabase.com)**
2. **Loggen Sie sich ein**
3. **Wählen Sie Ihr Culoca-Projekt**
4. **Gehen Sie zu "Settings" → "Database"**
5. **Scrollen Sie zu "Backups"**
6. **Wählen Sie einen Backup-Punkt vor den Problemen**
7. **Klicken Sie "Restore"**

### **Option 2: SQL-Script zurücksetzen**

Falls keine Backups verfügbar sind, können wir die Datenbank manuell zurücksetzen:

```sql
-- 1. Alle Tabellen löschen
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS welcome_content CASCADE;

-- 2. Alle Funktionen löschen
DROP FUNCTION IF EXISTS gallery_items_normal_postgis CASCADE;
DROP FUNCTION IF EXISTS gallery_items_search_postgis CASCADE;
DROP FUNCTION IF EXISTS gallery_items_unified_postgis CASCADE;

-- 3. Alle Views löschen
DROP VIEW IF EXISTS gallery_items_normal CASCADE;
DROP VIEW IF EXISTS gallery_items_search CASCADE;
```

### **Option 3: Neues Projekt erstellen**

1. **Erstellen Sie ein neues Supabase-Projekt**
2. **Kopieren Sie die Umgebungsvariablen**
3. **Führen Sie die ursprünglichen SQL-Scripts aus**

### **Option 4: Point-in-Time Recovery**

Supabase bietet Point-in-Time Recovery für Pro-Plan:
1. **Gehen Sie zu "Settings" → "Database"**
2. **Wählen Sie "Point-in-Time Recovery"**
3. **Wählen Sie einen Zeitpunkt vor den Problemen**

## 🔧 Sofortige Lösung

### **Temporäre API-Fix (ohne Datenbankrücksicherung)**

```typescript
// Verwende einfache SQL statt PostGIS-Funktionen
const { data, error } = await supabase
  .from('items')
  .select('*')
  .eq('gallery', true)
  .not('path_512', 'is', null)
  .order('created_at', { ascending: false })
  .range(0, 49);
```

## 📞 Support

Falls nichts funktioniert:
1. **Supabase Support kontaktieren**
2. **Projekt-Export erstellen**
3. **Neues Projekt mit Export importieren**

## 🎯 Empfohlene Vorgehensweise

1. **Sofort:** Option 1 (Dashboard Backup) versuchen
2. **Falls nicht verfügbar:** Option 2 (SQL-Reset)
3. **Als letzter Ausweg:** Option 3 (Neues Projekt)

**Welche Option möchten Sie versuchen?** 