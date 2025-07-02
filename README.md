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

## Setup

### 1. Installation

```bash
npm install
```

### 2. Umgebungsvariablen

Erstelle eine `.env` Datei:

```env
PUBLIC_SUPABASE_URL=your_supabase_url
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
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

## EXIF Upload Problem

Falls der EXIF-Upload nicht funktioniert, liegt das wahrscheinlich daran, dass die Datenbank-Felder `title`, `description` und `keywords` noch nicht existieren.

**Lösung:**
1. Gehe zu deinem Supabase Dashboard
2. Öffne den SQL Editor
3. Führe das folgende SQL aus:

```sql
ALTER TABLE images ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE images ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE images ADD COLUMN IF NOT EXISTS keywords TEXT;
```

Der Upload-Code hat jetzt eine Fallback-Funktion, die auch ohne EXIF-Felder funktioniert, aber die EXIF-Daten werden dann nicht gespeichert.

## Deployment

```bash
npm run build
```

## Lizenz

MIT
