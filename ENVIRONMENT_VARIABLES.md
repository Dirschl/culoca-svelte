# Umgebungsvariablen für Culoca Svelte

## 🚨 Aktuelles Problem

Der Upload schlägt fehl, weil die Hetzner WebDAV-Umgebungsvariablen nicht konfiguriert sind.

## 📋 Benötigte Umgebungsvariablen

### 1. Supabase (Bereits konfiguriert)
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 2. Hetzner Storage Box (FEHLT - Ursache des Problems)
```
HETZNER_WEBDAV_URL=https://u472664.your-storage-box.de
HETZNER_WEBDAV_USER=your-hetzner-username
HETZNER_WEBDAV_PASSWORD=your-hetzner-password
HETZNER_WEBDAV_PUBLIC_URL=https://your-public-hetzner-url.com
```

## 🔧 Vercel Konfiguration

### Schritt 1: Vercel Dashboard öffnen
1. Gehe zu [vercel.com](https://vercel.com)
2. Wähle dein Projekt "culoca-svelte"
3. Gehe zu **Settings** → **Environment Variables**

### Schritt 2: Hetzner Variablen hinzufügen
Füge diese 4 neuen Variablen hinzu:

| Variable | Wert | Beschreibung |
|----------|------|--------------|
| `HETZNER_WEBDAV_URL` | `https://u472664.your-storage-box.de` | WebDAV URL deiner Hetzner Storage Box |
| `HETZNER_WEBDAV_USER` | `your-username` | Dein Hetzner Storage Box Username |
| `HETZNER_WEBDAV_PASSWORD` | `your-password` | Dein Hetzner Storage Box Password |
| `HETZNER_WEBDAV_PUBLIC_URL` | `https://your-public-url.com` | Öffentliche URL für Original-Dateien |

### Schritt 3: Deployment
Nach dem Hinzufügen der Variablen:
1. Gehe zu **Deployments**
2. Klicke auf **"Redeploy"** für das neueste Deployment
3. Warte bis der Build abgeschlossen ist

## 🔍 Wo findest du die Hetzner Werte?

### Hetzner Storage Box Dashboard
1. Logge dich in dein Hetzner Cloud Dashboard ein
2. Gehe zu **Storage Box**
3. Wähle deine Storage Box aus
4. Unter **"Access"** findest du:
   - **WebDAV URL**: `https://u472664.your-storage-box.de`
   - **Username**: Dein Storage Box Username
   - **Password**: Dein Storage Box Password

### Public URL
Die `HETZNER_WEBDAV_PUBLIC_URL` ist die URL, unter der deine Original-Dateien öffentlich zugänglich sind. Diese wird normalerweise von Hetzner bereitgestellt.

## 🚨 Temporäre Lösung

Falls du die Hetzner-Werte nicht sofort hast, habe ich den Code so angepasst, dass:
- Der Upload trotzdem funktioniert
- Die Original-Dateien in Supabase Storage bleiben
- Du später die Hetzner-Variablen hinzufügen kannst

## ✅ Test nach Konfiguration

Nach dem Hinzufügen der Umgebungsvariablen:
1. Warte bis das Deployment abgeschlossen ist
2. Versuche einen Upload
3. Überprüfe die Browser-Konsole für Erfolgsmeldungen

## 🔧 Debugging

Falls der Upload immer noch fehlschlägt, überprüfe:
1. Sind alle 4 Hetzner-Variablen gesetzt?
2. Sind die Werte korrekt (keine Leerzeichen)?
3. Ist das Deployment abgeschlossen?
4. Zeigen die Browser-Logs weitere Fehler?

## 📞 Hilfe

Bei Problemen:
1. Überprüfe die Vercel Build-Logs
2. Teste die Hetzner-Verbindung lokal
3. Überprüfe die Browser-Konsole für detaillierte Fehlermeldungen 