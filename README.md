# Culoca Photo Gallery

Eine moderne Foto-Galerie mit SvelteKit und Supabase.

## Features

- 📸 Drag & Drop Upload
- 🗺️ GPS-basierte Standortanzeige
- 🧭 Kompass-Richtung
- 📱 Responsive Design
- 🔐 OAuth Authentication (Google, Facebook)
- 📊 EXIF-Daten Extraktion
- 🎨 Zwei Layout-Modi: Grid und Justified
- 🔊 Audioguide-Funktion
- 🌓 Dark/Light Mode

## Setup

### 1. Installation

```bash
npm install
```

### 2. Umgebungsvariablen

Erstelle eine `.env` Datei:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Datenbank Setup

Führe das SQL-Skript aus, um EXIF-Felder hinzuzufügen:

```sql
-- In der Supabase SQL Editor ausführen:
ALTER TABLE images ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE images ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE images ADD COLUMN IF NOT EXISTS keywords TEXT;
```

Oder verwende die Datei `add-exif-fields-simple.sql` im Supabase SQL Editor.

### 4. Entwicklung

```bash
npm run dev
```

## Deployment

### GitHub Setup

1. **Repository erstellen** (falls noch nicht vorhanden):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/culoca-svelte.git
   git push -u origin main
   ```

2. **Code pushen**:
   ```bash
   git add .
   git commit -m "Your commit message"
   git push origin main
   ```

### Vercel Deployment

1. **Vercel Account**: Gehe zu [vercel.com](https://vercel.com) und melde dich an

2. **Neues Projekt**: Klicke auf "New Project" und wähle dein GitHub Repository

3. **Konfiguration**:
   - **Framework Preset**: SvelteKit
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
   - **Install Command**: `npm install`

4. **Umgebungsvariablen** in Vercel hinzufügen:
   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

5. **Deploy**: Klicke auf "Deploy"

### Automatische Deployments

Nach dem Setup wird jeder Push zu `main` automatisch deployed:

```bash
git add .
git commit -m "Update feature"
git push origin main
```

### Domain Setup (Optional)

1. In Vercel Dashboard → Settings → Domains
2. Füge deine Custom Domain hinzu
3. Konfiguriere DNS-Einstellungen bei deinem Domain-Provider

## Lokale Entwicklung

```bash
# Entwicklungsserver starten
npm run dev

# Build für Produktion
npm run build

# Vorschau der Produktion
npm run preview

# Code formatieren
npm run format

# Linting
npm run lint
```

## Umgebungsvariablen

### Erforderlich
- `VITE_SUPABASE_URL`: Deine Supabase Projekt URL
- `VITE_SUPABASE_ANON_KEY`: Dein Supabase Anonymous Key

### Optional
- `SUPABASE_SERVICE_ROLE_KEY`: Für server-seitige Operationen
- `PUBLIC_APP_URL`: Deine App URL (für Production)

## Supabase Setup

### 1. Projekt erstellen
1. Gehe zu [supabase.com](https://supabase.com)
2. Erstelle ein neues Projekt
3. Notiere dir die URL und den Anon Key

### 2. Datenbank Schema
Führe die SQL-Skripte aus:
- `create-profiles-table.sql`
- `recreate-images-table.sql`
- `add-exif-fields-simple.sql`

### 3. Storage Setup
1. Erstelle einen Bucket namens `images`
2. Konfiguriere die Policies für öffentlichen Zugriff
3. Optional: Erstelle einen `thumbnails-64px` Bucket

### 4. Authentication
1. Aktiviere OAuth Provider (Google, Facebook)
2. Konfiguriere Redirect URLs:
   - Development: `http://localhost:5173/auth/callback`
   - Production: `https://your-domain.com/auth/callback`

## Troubleshooting

### EXIF Upload Problem
Falls der EXIF-Upload nicht funktioniert:
1. Überprüfe ob die Datenbank-Felder existieren
2. Führe `add-exif-fields-simple.sql` aus
3. Der Code hat eine Fallback-Funktion für fehlende Felder

### Deployment Issues
1. Überprüfe Umgebungsvariablen in Vercel
2. Stelle sicher, dass alle Dependencies in `package.json` stehen
3. Prüfe die Build-Logs in Vercel

### GPS/Location Issues
1. HTTPS ist erforderlich für GPS-Funktionen
2. Überprüfe Browser-Berechtigungen
3. Teste auf verschiedenen Geräten

## Performance

- Bilder werden automatisch optimiert
- Lazy Loading für große Galerien
- CDN-Caching über Vercel
- Responsive Images mit verschiedenen Größen

## Lizenz

MIT
