# Image Quality Settings

Die Culoca-App unterstützt jetzt konfigurierbare Bildqualitäts- und Formateinstellungen über Environment-Variablen.

## Environment-Variablen

### Bildformate
- `IMAGE_FORMAT_2048`: Format für 2048px Bilder (Hauptanzeige)
- `IMAGE_FORMAT_512`: Format für 512px Bilder (Galerie-Thumbnails)
- `IMAGE_FORMAT_64`: Format für 64px Bilder (Karten-Marker)

**Gültige Werte:** `jpg`, `jpeg`, `webp`
**Standard:** `jpg`

### Bildqualität
- `IMAGE_QUALITY_2048`: Qualität für 2048px Bilder
- `IMAGE_QUALITY_512`: Qualität für 512px Bilder
- `IMAGE_QUALITY_64`: Qualität für 64px Bilder

**Gültige Werte:** `1-100` (höher = bessere Qualität, größere Dateigröße)
**Standard:** `85`

## Beispiel-Konfiguration

### Hohe Qualität (mehr Speicherplatz)
```env
IMAGE_FORMAT_2048=jpg
IMAGE_QUALITY_2048=95
IMAGE_FORMAT_512=jpg
IMAGE_QUALITY_512=90
IMAGE_FORMAT_64=jpg
IMAGE_QUALITY_64=85
```

### Optimierte Kompression (weniger Speicherplatz)
```env
IMAGE_FORMAT_2048=webp
IMAGE_QUALITY_2048=85
IMAGE_FORMAT_512=webp
IMAGE_QUALITY_512=75
IMAGE_FORMAT_64=webp
IMAGE_QUALITY_64=60
```

### Gemischte Einstellungen
```env
# Hauptbilder in hoher Qualität
IMAGE_FORMAT_2048=jpg
IMAGE_QUALITY_2048=90

# Thumbnails optimiert
IMAGE_FORMAT_512=webp
IMAGE_QUALITY_512=75

# Marker stark komprimiert
IMAGE_FORMAT_64=webp
IMAGE_QUALITY_64=50
```

## Format-Vergleich

### JPEG
- ✅ Universelle Unterstützung
- ✅ Gute Kompression für Fotos
- ❌ Größere Dateien als WebP

### WebP
- ✅ Bessere Kompression (20-30% kleiner)
- ✅ Unterstützt Transparenz
- ❌ Nicht alle Browser unterstützen WebP

## Qualitäts-Empfehlungen

### 2048px (Hauptanzeige)
- **Hoch:** 90-95 (für Druckqualität)
- **Standard:** 85 (guter Kompromiss)
- **Niedrig:** 75-80 (für Bandbreiten-Optimierung)

### 512px (Galerie)
- **Hoch:** 85-90
- **Standard:** 75-80
- **Niedrig:** 65-70

### 64px (Karten-Marker)
- **Hoch:** 80-85
- **Standard:** 60-70
- **Niedrig:** 50-60

## Testen der Einstellungen

Verwende das Test-Skript, um verschiedene Einstellungen zu testen:

```bash
node test-image-settings.mjs
```

Das Skript zeigt:
- Aktuelle Environment-Variablen
- Geparste Einstellungen
- Dateigröße-Vergleiche für verschiedene Formate/Qualitäten

## Auswirkungen

### Speicherplatz
- WebP spart etwa 20-30% Speicherplatz gegenüber JPEG
- Niedrigere Qualität = kleinere Dateien
- 64px Bilder sind sehr klein (meist < 1KB)

### Ladezeiten
- Kleinere Dateien = schnellere Ladezeiten
- WebP lädt schneller als JPEG
- 64px Marker laden praktisch sofort

### Kompatibilität
- JPEG: 100% Browser-Unterstützung
- WebP: 95%+ moderne Browser (IE nicht unterstützt)

## Deployment

Nach Änderung der Environment-Variablen:

1. **Lokal:** Restart des Dev-Servers
2. **Vercel:** Neue Umgebungsvariablen in der Vercel-Konsole setzen
3. **Neue Uploads:** Verwenden automatisch die neuen Einstellungen
4. **Bestehende Bilder:** Bleiben unverändert

## Fehlerbehandlung

Bei ungültigen Werten werden Fallback-Werte verwendet:
- Ungültiges Format → `jpg`
- Ungültige Qualität → `85`
- Fehlende Variable → Standard-Werte

Warnungen werden in der Konsole angezeigt. 