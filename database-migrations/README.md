# Datenbank-Migration für Profilrechte-System

## 🚀 Installation

### 1. Supabase Dashboard
1. Gehe zu deinem Supabase Projekt
2. Öffne den **SQL Editor**
3. Kopiere den Inhalt von `create-profile-rights-tables.sql`
4. Führe die SQL-Befehle aus
5. **Wichtig:** Führe auch `rls-policies-profile-rights.sql` aus

### 2. Über Supabase CLI (falls verfügbar)
```bash
supabase db push
```

## 📋 Was wird erstellt

### Tabellen
- **`profile_rights`** - Globale Profilrechte (JSONB)
- **`item_rights`** - Item-spezifische Rechte

### Funktionen
- **`check_item_rights()`** - Prüft einzelne Rechte
- **`get_user_item_rights()`** - Holt alle Rechte für einen Benutzer

### Trigger
- **`update_updated_at_column()`** - Aktualisiert `updated_at` automatisch

### Indexe
- Performance-Optimierung für häufige Abfragen

### RLS-Policies
- **Sicherheitsrichtlinien** für alle Tabellen
- **Benutzer können nur ihre eigenen Rechte verwalten**
- **Item-Besitzer können Rechte für ihre Items vergeben**

## 🔧 Nach der Migration

Die API-Endpoints sollten dann funktionieren:
- `/api/profile-rights` - CRUD für Profilrechte
- `/api/search-users` - Benutzersuche
- `/api/check-item-rights/[itemId]` - Rechte-Prüfung

## 🧪 Testen

1. Gehe zu `/profile`
2. Scrolle zum Bereich "Rechteverwaltung"
3. Teste die Benutzersuche
4. Versuche Rechte zu vergeben

## ❗ Fehlerbehebung

Falls du Fehler siehst:
1. Prüfe, ob die Tabellen erstellt wurden
2. Prüfe die Supabase Logs
3. Stelle sicher, dass die RLS-Policies korrekt sind 