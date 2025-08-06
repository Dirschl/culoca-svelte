# 🎯 Role-Based Permission System

## 📋 Übersicht

Das **Berechtigungssystem** ermöglicht es, **Benutzerrollen** und **Berechtigungen** zu verwalten. Es unterstützt **anonyme Benutzer**, **normale Benutzer** und **Administratoren**.

## 🚀 Installation

### 1. Datenbank-Schema ausführen

Führe das SQL-Script in der **Supabase SQL Editor** aus:

```sql
-- Führe add-role-system.sql aus
```

### 2. Frontend-Integration

Die **TypeScript-Dateien** sind bereits erstellt:
- `src/lib/auth/permissions.ts` - Frontend-Berechtigungslogik

## 📊 Rollen-System

### 🎭 Verfügbare Rollen

| Rolle | Name | Beschreibung | Berechtigungen |
|-------|------|--------------|----------------|
| **1** | `anonymous` | Anonym | Nur Lesen erlaubt |
| **2** | `user` | Benutzer | Erweiterte Funktionen |
| **3** | `admin` | Administrator | Vollzugriff |

### 🔐 Berechtigungen

| Berechtigung | Anonymous | User | Admin |
|--------------|-----------|------|-------|
| `view_gallery` | ✅ | ✅ | ✅ |
| `view_items` | ✅ | ✅ | ✅ |
| `view_maps` | ✅ | ✅ | ✅ |
| `search` | ✅ | ✅ | ✅ |
| `joystick` | ❌ | ✅ | ✅ |
| `bulk_upload` | ❌ | ✅ | ✅ |
| `settings` | ❌ | ✅ | ✅ |
| `admin` | ❌ | ❌ | ✅ |
| `delete_items` | ❌ | ❌ | ✅ |
| `edit_items` | ❌ | ✅ | ✅ |
| `create_items` | ❌ | ✅ | ✅ |
| `manage_users` | ❌ | ❌ | ✅ |
| `view_analytics` | ❌ | ❌ | ✅ |
| `system_settings` | ❌ | ❌ | ✅ |

## 🛠️ Verwendung

### Backend (SQL)

```sql
-- Berechtigung prüfen
SELECT has_permission('user-uuid', 'admin');

-- Alle Berechtigungen abrufen
SELECT get_user_permissions('user-uuid');

-- Rollen-Informationen
SELECT * FROM get_user_role_info('user-uuid');
```

### Frontend (TypeScript)

```typescript
import { hasPermission, canAccessAdmin } from '$lib/auth/permissions';

// Berechtigung prüfen
const canAdmin = await canAccessAdmin(user);

// Reaktive Berechtigungen
import { userPermissions } from '$lib/auth/permissions';
$: canUseJoystick = $userPermissions.joystick;
```

### Svelte-Komponenten

```svelte
<script>
  import { userPermissions } from '$lib/auth/permissions';
</script>

{#if $userPermissions.admin}
  <a href="/admin">Admin Panel</a>
{/if}

{#if $userPermissions.joystick}
  <a href="/simulation">Simulation</a>
{/if}
```

## 🔧 Admin-Link Integration

### 1. API-Route verwenden

```typescript
// In einer Komponente
async function checkAdminPermission() {
  const response = await fetch('/api/check-admin-permission');
  const { hasAdminPermission } = await response.json();
  return hasAdminPermission;
}
```

### 2. Direkte Berechtigungsprüfung

```typescript
import { canAccessAdmin } from '$lib/auth/permissions';

const canAdmin = await canAccessAdmin(user);
```

## 📝 Datenbank-Funktionen

### `has_permission(user_id, permission_name)`
Prüft, ob ein Benutzer eine bestimmte Berechtigung hat.

### `get_user_permissions(user_id)`
Gibt alle Berechtigungen eines Benutzers zurück.

### `get_user_role_info(user_id)`
Gibt Rollen-Informationen eines Benutzers zurück.

## 🔄 Rollen verwalten

### Benutzer zur Admin-Rolle zuweisen

```sql
UPDATE profiles 
SET role_id = 3 
WHERE id = 'user-uuid-here';
```

### Neue Berechtigung hinzufügen

```sql
-- Rolle aktualisieren
UPDATE roles 
SET permissions = jsonb_set(
  permissions, 
  '{new_permission}', 
  'true'
) 
WHERE name = 'admin';
```

## 🚨 Sicherheit

- **Anonyme Benutzer** haben **nur Leserechte**
- **Berechtigungen** werden **serverseitig** geprüft
- **Frontend-Checks** sind nur für **UI-Zwecke**
- **Alle kritischen Operationen** müssen **serverseitig** validiert werden

## 🔍 Debugging

### Berechtigungen prüfen

```sql
-- Alle Benutzer und ihre Berechtigungen anzeigen
SELECT * FROM user_permissions_view;

-- Spezifischen Benutzer prüfen
SELECT * FROM get_user_role_info('user-uuid');
```

### Logs prüfen

```bash
# Frontend-Logs
console.log('Permission check:', await hasPermission(user, 'admin'));

# Backend-Logs (Supabase)
-- SQL-Logs in der Supabase Console
```

## 📚 Nächste Schritte

1. **Admin-Link** im Menü hinzufügen
2. **Berechtigungsprüfungen** in bestehende Komponenten integrieren
3. **Admin-Panel** erweitern
4. **Rollen-Management** im Admin-Panel implementieren

## 🎯 Vorteile

- ✅ **Flexibel** - JSONB für erweiterbare Berechtigungen
- ✅ **Sicher** - Serverseitige Validierung
- ✅ **Performant** - Indizierte Abfragen
- ✅ **Benutzerfreundlich** - Einfache Frontend-Integration
- ✅ **Skalierbar** - Neue Rollen und Berechtigungen einfach hinzufügbar 