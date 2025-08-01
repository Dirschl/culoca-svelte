# Cache Refresh & Manual Data Update Guide

## Problem
Wenn du Daten manuell in der Supabase-Konsole änderst, werden diese Änderungen möglicherweise nicht im Frontend angezeigt. Das liegt an:

1. **RLS-Policies** - Row Level Security kann manuelle Änderungen blockieren
2. **Caching** - Supabase hat verschiedene Cache-Ebenen
3. **Views/Functions** - Daten werden über gecachte Views/Functions geladen

## Lösung

### 1. Cache Refresh APIs

#### Alle Caches aktualisieren:
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{}' \
  http://localhost:5173/api/admin/refresh-cache
```

#### Nur Profile-Cache:
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"table":"profiles"}' \
  http://localhost:5173/api/admin/refresh-cache
```

#### Nur Items-Cache:
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"table":"items"}' \
  http://localhost:5173/api/admin/refresh-cache
```

#### Spezifischen Benutzer-Cache:
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID_HERE"}' \
  http://localhost:5173/api/admin/refresh-cache
```

### 2. Force Update API

Für komplexe Updates, die RLS umgehen müssen:

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID_HERE",
    "updates": {
      "profile": {
        "full_name": "Neuer Name",
        "accountname": "neuer_account"
      },
      "auth": {
        "email": "neue@email.com"
      }
    }
  }' \
  http://localhost:5173/api/admin/force-update-user
```

### 3. Admin Interface

Im Admin-Interface unter `/admin/users` sind jetzt Buttons verfügbar:

- **🔄 Aktualisieren** - Lädt Benutzer neu
- **🗄️ Cache** - Aktualisiert alle Caches
- **👥 Profile** - Aktualisiert nur Profile-Cache
- **🖼️ Items** - Aktualisiert nur Items-Cache
- **🔄 Cache** (im Edit-Modal) - Aktualisiert Cache für spezifischen Benutzer

## Best Practices

### Für manuelle Änderungen in Supabase:

1. **Nach manuellen Änderungen immer Cache aktualisieren**
2. **Verwende die Admin-APIs statt direkter Datenbankänderungen**
3. **Teste Änderungen im Frontend nach Cache-Refresh**

### Für kritische Updates:

1. **Verwende `force-update-user` API**
2. **Aktualisiere Cache nach dem Update**
3. **Teste im Frontend**

## Troubleshooting

### Wenn Daten immer noch nicht angezeigt werden:

1. **Browser-Cache leeren** (Ctrl+F5)
2. **Server neu starten** (`npm run dev`)
3. **Supabase-Cache warten** (kann bis zu 5 Minuten dauern)
4. **RLS-Policies überprüfen** - manuelle Änderungen können Policies verletzen

### Für Entwickler:

- **Debug-Logs** in der Konsole prüfen
- **Network-Tab** im Browser für API-Aufrufe prüfen
- **Supabase-Logs** in der Supabase-Konsole prüfen 