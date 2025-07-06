# Culoca Svelte - Deployment Guide

## 🚀 Schnelle Deployment-Anleitung

### 1. GitHub Repository Setup ✅

Ihr Code ist bereits auf GitHub! Repository: `https://github.com/Dirschl/culoca-svelte`

### 2. Vercel Deployment

#### Schritt 1: Vercel Account
1. Gehe zu [vercel.com](https://vercel.com)
2. Melde dich mit deinem GitHub Account an

#### Schritt 2: Neues Projekt erstellen
1. Klicke auf **"New Project"**
2. Wähle dein Repository **"culoca-svelte"** aus
3. Klicke auf **"Import"**

#### Schritt 3: Projekt-Konfiguration
Vercel erkennt automatisch SvelteKit, aber überprüfe diese Einstellungen:

- **Framework Preset**: `SvelteKit`
- **Build Command**: `npm run build`
- **Output Directory**: `build`
- **Install Command**: `npm install`
- **Node.js Version**: `20.x`

#### Schritt 4: Umgebungsvariablen hinzufügen
Füge diese Variablen in Vercel hinzu (Settings → Environment Variables):

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Wo findest du diese Werte?**
1. Gehe zu deinem Supabase Dashboard
2. Settings → API
3. Kopiere die "Project URL" und "anon public" Key

#### Schritt 5: Deploy
1. Klicke auf **"Deploy"**
2. Warte bis der Build abgeschlossen ist (ca. 2-3 Minuten)
3. Deine App ist live! 🎉

### 3. Automatische Deployments

Ab jetzt wird jeder Push zu `main` automatisch deployed:

```bash
git add .
git commit -m "Deine Änderungen"
git push origin main
```

### 4. Custom Domain (Optional)

1. In Vercel Dashboard → Settings → Domains
2. Füge deine Domain hinzu: `culoca.com`
3. Konfiguriere DNS bei deinem Domain-Provider:
   - Typ: `CNAME`
   - Name: `@` (oder `www`)
   - Wert: `cname.vercel-dns.com`

## 📋 Checkliste vor Deployment

- [x] Code ist auf GitHub
- [x] Vercel Konfiguration erstellt
- [ ] Supabase Umgebungsvariablen hinzugefügt
- [ ] Erstes Deployment durchgeführt
- [ ] Domain konfiguriert (optional)

## 🔧 Supabase Konfiguration für Produktion

### 1. Redirect URLs aktualisieren
In Supabase Dashboard → Authentication → URL Configuration:

**Site URL**: `https://your-app-name.vercel.app`

**Redirect URLs**:
```
https://your-app-name.vercel.app/auth/callback
https://your-custom-domain.com/auth/callback (falls vorhanden)
```

### 2. CORS Origins
Füge deine Vercel URL zu den erlaubten Origins hinzu:
```
https://your-app-name.vercel.app
https://your-custom-domain.com
```

## 🚨 Häufige Probleme & Lösungen

### Build Fehler
```bash
# Lokaler Test vor Deployment
npm run build
npm run preview
```

### Umgebungsvariablen nicht gefunden
- Überprüfe die Schreibweise: `VITE_SUPABASE_URL` (nicht `PUBLIC_SUPABASE_URL`)
- Stelle sicher, dass keine Leerzeichen in den Werten sind
- Vercel Dashboard → Settings → Environment Variables

### Authentication Fehler
- Überprüfe Redirect URLs in Supabase
- Stelle sicher, dass HTTPS verwendet wird
- Prüfe CORS-Einstellungen

### Images nicht sichtbar
- Überprüfe Supabase Storage Policies
- Stelle sicher, dass der `images` Bucket öffentlich zugänglich ist

## 📊 Performance Optimierungen

Deine App ist bereits optimiert mit:
- ✅ Vercel Edge CDN
- ✅ Automatische Bildoptimierung
- ✅ Lazy Loading
- ✅ Code Splitting
- ✅ Caching Headers

## 🔄 Deployment Workflow

```bash
# 1. Lokale Entwicklung
npm run dev

# 2. Änderungen testen
npm run build
npm run preview

# 3. Code committen
git add .
git commit -m "Feature: Neue Funktion"
git push origin main

# 4. Automatisches Deployment auf Vercel ✨
```

## 📞 Support

Bei Problemen:
1. Überprüfe die Vercel Build-Logs
2. Teste lokal mit `npm run build`
3. Überprüfe Supabase Konfiguration
4. Kontrolliere Browser-Konsole für Fehler

**Deine App wird verfügbar sein unter:**
- Vercel URL: `https://culoca-svelte.vercel.app`
- Custom Domain: `https://deine-domain.com` (falls konfiguriert)

Viel Erfolg! 🚀 