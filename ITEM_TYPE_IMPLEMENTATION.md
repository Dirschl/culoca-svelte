# Item Type Implementation

## Übersicht
Die Items-Tabelle wurde um ein `type_id` Feld erweitert, um verschiedene Inhaltstypen zu kategorisieren.

## Implementierte Änderungen

### 1. Datenbank-Schema

#### Types-Tabelle erstellen:
```sql
-- create-types-table.sql
CREATE TABLE IF NOT EXISTS types (
  id INTEGER PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO types (id, name, description) VALUES
  (1, 'Foto', 'Fotografien und Bilder'),
  (2, 'Event', 'Veranstaltungen und Events'),
  (3, 'Link', 'Externe Links und Verweise'),
  (4, 'Text', 'Textbeiträge und Artikel'),
  (5, 'Firma', 'Firmen- und Unternehmensinformationen'),
  (6, 'Video', 'Videomaterial und Filme');
```

#### Items-Tabelle erweitern:
```sql
-- add-type-id-to-items.sql
ALTER TABLE items ADD COLUMN type_id INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE items ADD CONSTRAINT fk_items_type_id 
FOREIGN KEY (type_id) REFERENCES types(id);
CREATE INDEX idx_items_type_id ON items(type_id);
```

#### Bestehende Items aktualisieren:
```sql
-- update-existing-items-type.sql
UPDATE items SET type_id = 1 WHERE type_id IS NULL OR type_id = 0;
```

### 2. Frontend-Änderungen

#### TypeScript Constants:
- `src/lib/constants/itemTypes.ts` - Zentrale Definition der Item-Typen
- Helper-Funktionen für Labels und Beschreibungen
- Multilanguage-ready durch numerische IDs

#### Bulk-Upload erweitert:
- `src/routes/bulk-upload/+page.svelte` - Type-Dropdown hinzugefügt
- Default: `type_id = 1` (Foto) für alle neuen Uploads
- UI zeigt Type-Label und Beschreibung

### 3. Backend-Änderungen

#### Upload-API erweitert:
- `src/routes/api/upload/+server.ts` - `type_id` Verarbeitung
- FormData-Parameter `type_id` wird an Datenbank weitergegeben
- Fallback auf `type_id = 1` wenn nicht angegeben

#### Sitemap-API angepasst:
- `src/routes/sitemap.xml/+server.ts` - Nur Fotos (`type_id = 1`) in Sitemap
- Filter: `.eq('type_id', 1)` für bessere SEO

## Vorteile der Implementierung

### ✅ Performance:
- **INTEGER** statt VARCHAR(20) - schneller
- **Index** für effiziente Filterung
- **Kleinere Datenübertragung**

### ✅ Multilanguage:
- **Numerische IDs** - sprachunabhängig
- **Frontend-Übersetzungen** lokal handhabbar
- **Einfache Erweiterung** für neue Sprachen

### ✅ Skalierbarkeit:
- **Einfach neue Typen** hinzufügen (7, 8, 9...)
- **Foreign Key Constraint** für Datenintegrität
- **Zukunftssicher** für neue Content-Typen

## Verwendung

### Frontend:
```typescript
import { ITEM_TYPES, getTypeLabel } from '$lib/constants/itemTypes';

// Type-ID verwenden
const typeId = ITEM_TYPES.PHOTO; // 1

// Label anzeigen
const label = getTypeLabel(typeId); // "Foto"
```

### API-Filter:
```typescript
// Nur Fotos laden
const { data } = await supabase
  .from('items')
  .select('*')
  .eq('type_id', ITEM_TYPES.PHOTO);
```

### Sitemap:
- Nur Fotos (`type_id = 1`) werden in der Sitemap aufgenommen
- Bessere SEO durch fokussierte Inhalte

## Nächste Schritte

1. **SQL ausführen:** Die drei SQL-Scripts in der Datenbank ausführen
2. **Testen:** Bulk-Upload mit verschiedenen Types testen
3. **Erweitern:** Weitere Content-Typen (Events, Links, etc.) implementieren
4. **UI-Filter:** Gallery-Filter nach Type-ID hinzufügen

## Dateien

- `create-types-table.sql` - Types-Tabelle erstellen
- `add-type-id-to-items.sql` - Items-Tabelle erweitern  
- `update-existing-items-type.sql` - Bestehende Items aktualisieren
- `src/lib/constants/itemTypes.ts` - TypeScript Constants
- `src/routes/bulk-upload/+page.svelte` - Frontend erweitert
- `src/routes/api/upload/+server.ts` - Backend erweitert
- `src/routes/sitemap.xml/+server.ts` - Sitemap angepasst 