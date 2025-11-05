# Vercel Deployment - Playwright Setup

## Automatische Installation

Die Playwright-Browser werden automatisch während des `postinstall` Scripts installiert. Das Script:
1. Baut Sharp für Linux neu (für Vercel)
2. Installiert Chromium für Playwright

## Manuelle Installation (falls nötig)

Falls die automatische Installation nicht funktioniert, kannst du die Browser manuell in Vercel installieren:

### Option 1: Vercel Build Command

In Vercel Dashboard → Settings → Build & Development Settings:

```
Build Command: npm run build && npx playwright install chromium
```

### Option 2: Environment Variable

Füge in Vercel eine Environment Variable hinzu:

```
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0
```

### Option 3: Vercel Build Logs prüfen

Falls Probleme auftreten:
1. Gehe zu Vercel Dashboard → Deployments
2. Öffne das Build-Log
3. Prüfe, ob `playwright install chromium` erfolgreich war

## Troubleshooting

### Problem: Browser nicht gefunden

**Lösung:** Stelle sicher, dass Playwright in `dependencies` (nicht `devDependencies`) ist.

### Problem: Build zu langsam

**Lösung:** Die erste Installation dauert länger (ca. 2-3 Minuten). Nachfolgende Builds sind schneller, da die Browser gecacht werden.

### Problem: Timeout beim Build

**Lösung:** Erhöhe die Build-Timeout-Zeit in Vercel Settings auf mindestens 5 Minuten.

## Alternative: @playwright/browser-chromium

Für eine kleinere Bundle-Größe kannst du `@playwright/browser-chromium` verwenden:

```bash
npm install @playwright/browser-chromium
```

Und dann im Code:
```typescript
import { chromium } from '@playwright/browser-chromium';
```

## Verifizierung

Nach dem Deployment kannst du den Service testen:

```bash
curl "https://culoca.com/web/services/site-screenshot?url=https://example.com" -o test.jpg
```

Wenn der Screenshot erfolgreich erstellt wird, ist alles korrekt installiert!

