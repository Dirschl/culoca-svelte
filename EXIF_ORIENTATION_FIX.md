# EXIF Orientation Fix

## Problem

Ein User hat Bilder, die im Querformat dargestellt werden, obwohl sie hochformat sind. Das Problem liegt daran, dass die EXIF-Orientierung nicht korrekt beim Erstellen der Thumbnails (64px und 512px) berücksichtigt wurde.

### Symptome
- Bilder werden falsch orientiert angezeigt (hochformat als querformat)
- Justified Layout zeigt falsche Seitenverhältnisse
- EXIF-Orientierung war 270° (Rotate 90° CW)
- Thumbnails wurden ohne EXIF-Orientierung erstellt

## Ursache

Die ursprüngliche Bildverarbeitung in `src/lib/image.ts` verwendete nicht die EXIF-Orientierung beim Erstellen der Thumbnails. Obwohl die `resizeJPG` Funktion bereits `sharp(buffer).rotate()` verwendet, wurden bestehende Thumbnails ohne diese Korrektur erstellt.

## Lösung

### 1. Automatische Korrektur für neue Uploads

Die `resizeJPG` Funktion in `src/lib/image.ts` verwendet bereits:
```typescript
const sharpBuffer = sharp(buffer).rotate();
```

Dies wendet automatisch die EXIF-Orientierung an.

### 2. Retroaktive Korrektur für bestehende Bilder

#### Script: `fix-exif-orientation.mjs`
- Korrigiert alle bestehenden Thumbnails (64px und 512px)
- Wendet EXIF-Orientierung korrekt an
- Überschreibt bestehende Thumbnails mit korrigierten Versionen

#### Script: `fix-specific-user-images.mjs`
- Spezifisch für bestimmte User
- Detaillierte Berichterstattung pro User
- Kann für einzelne User oder alle User ausgeführt werden

### 3. SQL-Analyse

#### Script: `check-exif-orientation.sql`
- Identifiziert Bilder mit EXIF-Orientierung
- Zeigt Statistiken über betroffene Bilder
- Hilft bei der Analyse des Problems

## Ausführung

### Schritt 1: Analyse
```bash
# Führen Sie das SQL-Script in Supabase aus
# check-exif-orientation.sql
```

### Schritt 2: Korrektur aller Bilder
```bash
# Alle bestehenden Thumbnails korrigieren
node fix-exif-orientation.mjs
```

### Schritt 3: Spezifische User-Korrektur
```bash
# Für bestimmten User (ersetzen Sie USER_ID)
node fix-specific-user-images.mjs USER_ID

# Für alle User
node fix-specific-user-images.mjs
```

## EXIF-Orientierungswerte

| Wert | Beschreibung |
|------|-------------|
| 1 | Normal (keine Rotation) |
| 2 | Spiegel horizontal |
| 3 | Rotate 180° |
| 4 | Spiegel vertikal |
| 5 | Spiegel horizontal + Rotate 270° CW |
| 6 | Rotate 90° CW |
| 7 | Spiegel horizontal + Rotate 90° CW |
| 8 | Rotate 270° CW |

## Technische Details

### Sharp.js EXIF-Behandlung
```typescript
// Korrekt: EXIF-Orientierung anwenden
const sharpInstance = sharp(buffer).rotate();

// Falsch: Ohne EXIF-Orientierung
const sharpInstance = sharp(buffer);
```

### Thumbnail-Erstellung
```typescript
// 512px Thumbnail mit korrekter Orientierung
const thumbnail512 = await sharpInstance
  .resize(512, 512, { 
    fit: 'inside', 
    withoutEnlargement: true 
  })
  .jpeg({ mozjpeg: true, quality: 85 })
  .toBuffer();

// 64px Thumbnail mit korrekter Orientierung
const thumbnail64 = await sharpInstance
  .resize(64, 64, { 
    fit: 'inside', 
    withoutEnlargement: true 
  })
  .jpeg({ mozjpeg: true, quality: 85 })
  .toBuffer();
```

## Verifikation

### Vor der Korrektur
- Bilder werden falsch orientiert angezeigt
- Justified Layout zeigt falsche Seitenverhältnisse
- EXIF-Orientierung wird ignoriert

### Nach der Korrektur
- Bilder werden korrekt orientiert angezeigt
- Justified Layout zeigt korrekte Seitenverhältnisse
- EXIF-Orientierung wird berücksichtigt

## Prävention

### Für neue Uploads
- Die `resizeJPG` Funktion verwendet bereits `sharp(buffer).rotate()`
- Neue Uploads werden automatisch korrekt verarbeitet

### Für bestehende Bilder
- Retroaktive Korrektur mit den bereitgestellten Scripts
- Regelmäßige Überprüfung auf EXIF-Probleme

## Monitoring

### SQL-Query für Monitoring
```sql
-- Bilder mit EXIF-Orientierung überwachen
SELECT 
    COUNT(*) as total_images,
    COUNT(CASE WHEN exif_json::text LIKE '%Orientation%' THEN 1 END) as images_with_orientation,
    COUNT(CASE WHEN exif_json::text LIKE '%"Orientation":1%' THEN 1 END) as normal_orientation,
    COUNT(CASE WHEN exif_json::text LIKE '%Orientation%' AND exif_json::text NOT LIKE '%"Orientation":1%' THEN 1 END) as needs_fix
FROM items;
```

## Troubleshooting

### Häufige Probleme

1. **Upload-Fehler**
   - Prüfen Sie die Supabase Storage-Berechtigungen
   - Stellen Sie sicher, dass die Buckets existieren

2. **Speicherplatz-Probleme**
   - Die Scripts überschreiben bestehende Thumbnails
   - Stellen Sie sicher, dass genügend Speicherplatz verfügbar ist

3. **Performance-Probleme**
   - Die Scripts verarbeiten Bilder sequenziell
   - Für große Mengen können Sie die Scripts anpassen

### Debugging

```bash
# Detaillierte Logs aktivieren
DEBUG=sharp node fix-exif-orientation.mjs

# Nur bestimmte Bilder verarbeiten
# Bearbeiten Sie das Script, um nur bestimmte IDs zu verarbeiten
```

## Fazit

Das EXIF-Orientierungsproblem wird durch die retroaktive Korrektur aller bestehenden Thumbnails gelöst. Neue Uploads werden automatisch korrekt verarbeitet, da die `resizeJPG` Funktion bereits die EXIF-Orientierung berücksichtigt. 