# 64px Thumbnails für Kartendarstellung

Diese Implementierung erstellt automatisch 64px hohe Vorschaubilder beim Upload, die als Marker in den Karten verwendet werden können.

## Implementierte Änderungen

### 1. Datenbank-Erweiterung
- **Datei**: `add-64px-field.sql`
- **Zweck**: Fügt das `path_64` Feld zur `images` Tabelle hinzu
- **Ausführung**: Führen Sie das SQL-Script in der Supabase SQL Editor aus

### 2. Storage Bucket
- **Datei**: `create-64px-bucket.sql`
- **Zweck**: Erstellt den `images-64` Storage Bucket für 64px Thumbnails
- **Ausführung**: Führen Sie das SQL-Script in der Supabase SQL Editor aus

### 3. Upload-Funktion erweitert
- **Datei**: `src/routes/api/upload/+server.ts`
- **Änderungen**:
  - Upload der 64px Version zum `images-64` Bucket
  - Speicherung des `path_64` in der Datenbank
  - Fallback auf 512px Version, falls 64px Upload fehlschlägt

### 4. Karten-Implementierung
- **Datei**: `src/routes/image/[id]/+page.svelte`
- **Änderungen**:
  - Benutzerdefinierte Leaflet-Marker mit 64px Thumbnails
  - Fallback auf 512px Version, falls 64px nicht verfügbar
  - Styling mit abgerundeten Ecken und Schatten
  - Popup mit Bildtitel

### 5. API-Endpunkte erweitert
- **Dateien**: 
  - `src/routes/api/images/+server.ts`
  - `src/routes/+page.svelte`
- **Änderungen**: `path_64` Feld zu allen relevanten Queries hinzugefügt

### 6. Retroaktive Konvertierung
- **Datei**: `create-64px-thumbnails.mjs`
- **Zweck**: Erstellt 64px Thumbnails für bereits vorhandene Bilder
- **Ausführung**: `node create-64px-thumbnails.mjs`

## Ausführung der Implementierung

### Schritt 1: Datenbank-Setup
```sql
-- Führen Sie diese Scripts in der Supabase SQL Editor aus:
-- 1. add-64px-field.sql
-- 2. create-64px-bucket.sql
```

### Schritt 2: Retroaktive Konvertierung
```bash
# Für bereits vorhandene Bilder
node create-64px-thumbnails.mjs
```

### Schritt 3: Deployment
```bash
# Änderungen committen und pushen
git add .
git commit -m "Add 64px thumbnails for map markers"
git push origin main
```

## Funktionsweise

### Upload-Prozess
1. Beim Upload wird automatisch eine 64px Version erstellt
2. Die 64px Version wird im `images-64` Bucket gespeichert
3. Der Pfad wird in der Datenbank als `path_64` gespeichert

### Karten-Darstellung
1. Die Karte verwendet benutzerdefinierte Leaflet-Marker
2. Marker zeigen das 64px Thumbnail des Bildes
3. Fallback auf 512px Version, falls 64px nicht verfügbar
4. Marker haben abgerundete Ecken und Schatten für bessere Sichtbarkeit

### Vorteile
- **Schnellere Ladezeiten**: 64px Bilder sind deutlich kleiner
- **Bessere Performance**: Weniger Bandbreite für Karten-Marker
- **Original Seitenverhältnis**: Bilder behalten ihr ursprüngliches Verhältnis
- **Flexible Darstellung**: Können bei Bedarf rund oder quadratisch dargestellt werden

## Technische Details

### Bildgrößen
- **64px**: Höhe 64px, Breite proportional (für Marker)
- **512px**: Quadratisch 512x512px (für Galerie)
- **2048px**: Längste Kante 2048px (für Detailansicht)

### Storage-Struktur
```
images-64/     # 64px Thumbnails für Marker
images-512/    # 512px Thumbnails für Galerie
images-2048/   # 2048px Versionen für Detailansicht
```

### Datenbank-Schema
```sql
ALTER TABLE images ADD COLUMN path_64 TEXT;
```

## Fehlerbehandlung

- Falls 64px Upload fehlschlägt, wird automatisch auf 512px Version zurückgegriffen
- Bestehende Bilder ohne 64px Version funktionieren weiterhin
- Retroaktive Konvertierung kann jederzeit ausgeführt werden 