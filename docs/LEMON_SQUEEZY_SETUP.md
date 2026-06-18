# Lemon Squeezy — Culoca Bildverkauf

Culoca verkauft Bildlizenzen über [Lemon Squeezy](https://lemonsqueezy.com) als **Merchant of Record** (Rechnungen, MwSt., internationale Zahlungen). Nach dem Kauf erhält der Nutzer Download-Rechte in seinem Culoca-Konto.

**Hinweis:** Der LS-Account **DIRSCHL.com GmbH** (`dirschl.com`, Store `#389397`) wird gemeinsam mit der geplanten **dirschl.com-SaaS** genutzt. Beide Plattformen haben **eigene Webhooks** und können denselben API-Key verwenden.

## 1. Lemon Squeezy Dashboard (Stand Einrichtung)

| Was | Wert / Status |
|-----|----------------|
| Store | `dirschl.com` · **Store-ID `389397`** |
| Modus | **Test mode** (Konto noch in Prüfung) |
| API-Key | `dirschl.com` (vorhanden) — optional zweiter Key `culoca.com` |
| Webhook dirschl.com | `https://www.dirschl.com/wp-json/dirschl-hub/v1/webhooks/lemon` (7 Events, u. a. `license_key_*`) |
| Webhook culoca.com | **noch anlegen** → `https://culoca.com/api/webhooks/lemon-squeezy` |

### Culoca-Produkte (angelegt)

| Produkt | Produkt-ID | Basispreis | Variant-ID |
|---------|------------|------------|------------|
| Culoca Standard-Lizenz | `1154543` | €29,00 | In LS: Produkt → Variante → URL `/variants/…` |
| Culoca Erweiterte Lizenz | `1154544` | €99,00 | wie oben |

Ohne LS-Lizenzschlüssel (Culoca verwaltet Rechte in `license_purchases`). Checkout setzt den Preis pro Bild via `custom_price`.

### Bestehende Testprodukte (dirschl.com SaaS)

| Produkt | Produkt-ID | Variant-ID (Beispiel) |
|---------|------------|------------------------|
| DIRSCHL Social Media | `1093768` | `1713240` |
| DIRSCHL Social Media (Duplikat) | — | — |
| Test | — | — |

### Noch erledigen (Dashboard)

1. **Zweiten Webhook** anlegen (nicht den dirschl-Webhook bearbeiten):
   - URL: `https://culoca.com/api/webhooks/lemon-squeezy`
   - Events: **`order_created`**, **`order_refunded`**
   - Signing Secret → `LEMONSQUEEZY_WEBHOOK_SECRET` in Vercel
2. **Variant-IDs** der Culoca-Produkte aus der Produkt-URL kopieren
3. Optional: API-Key `culoca.com` (oder bestehenden `dirschl.com`-Key teilen)
4. Nach Freischaltung: **Live mode** + `LEMONSQUEEZY_TEST_MODE=false`

## 2. Umgebungsvariablen (Vercel / `.env`)

```env
CULOCA_SALES_ENABLED=true
PUBLIC_CULOCA_SALES_ENABLED=true

LEMONSQUEEZY_API_KEY=...          # bestehender Key aus Settings → API
LEMONSQUEEZY_STORE_ID=389397
LEMONSQUEEZY_WEBHOOK_SECRET=...   # Secret des **Culoca**-Webhooks
LEMONSQUEEZY_VARIANT_STANDARD_ID=...
LEMONSQUEEZY_VARIANT_EXTENDED_ID=...
LEMONSQUEEZY_TEST_MODE=true       # solange LS im Testmodus

CULOCA_LICENSE_STANDARD_PRICE_CENTS=2900
CULOCA_LICENSE_EXTENDED_PRICE_CENTS=9900
PUBLIC_CULOCA_LICENSE_STANDARD_PRICE_CENTS=2900
PUBLIC_CULOCA_LICENSE_EXTENDED_PRICE_CENTS=9900
```

`SUPABASE_SERVICE_ROLE_KEY` muss gesetzt sein (Webhook schreibt Lizenzen).

## 3. Datenbank-Migration

Im Supabase SQL Editor ausführen (in dieser Reihenfolge):

1. `database-migrations/2026-06-18_license-purchases-lemon-squeezy.sql`
2. `database-migrations/2026-06-18_license-cart.sql` (Warenkorb + mehrere Lizenzen pro Bestellung)

## 4. Ablauf

1. Nutzer öffnet Bild → Lizenzstufe wählen → **In den Warenkorb**
2. Warenkorb unter `/warenkorb` (auch ein einzelnes Bild)
3. `POST /api/checkout/cart` → Lemon-Checkout mit Gesamtsumme
4. Custom data: `checkout_mode: cart`, `line_items` (JSON mit `item_id`, `license_tier`, `price_cents`)
5. Webhook `order_created` → Einträge in `license_purchases` (eine Zeile pro Bild)
6. Warenkorb wird geleert; Redirect: `/settings/licenses?purchase=success`

APIs: `GET/POST/PATCH/DELETE /api/cart`, `POST /api/checkout/cart`

Der Endpunkt `POST /api/checkout/create` (Einzelcheckout) bleibt für Webhook-Kompatibilität bestehen, wird in der UI nicht mehr genutzt.

## 5. Testmodus

- `LEMONSQUEEZY_TEST_MODE=true` für Testzahlungen
- Lemon Squeezy Test-Karte verwenden

## 6. Fotografen / Preise

- Standard: alle öffentlichen Fotos verkaufbar, außer `stock_settings.culoca.saleEnabled === false`
- Individuelle Preise optional in `items.stock_settings.culoca.standardPriceCents` / `extendedPriceCents`

## 7. Rechtliches

- Allgemeine Bedingungen: `/web/license#kommerziell`
- Bildspezifische Kaufseite: `{item-url}/download#lizenzbedingungen`
- Lemon Squeezy AGB gelten für Zahlung & Rechnung

## 9. Zwei Plattformen, ein LS-Account

- **dirschl.com (SaaS):** WordPress-Webhook, LS-Lizenzschlüssel, Produkte wie „DIRSCHL Social Media“
- **culoca.com:** SvelteKit-Webhook `/api/webhooks/lemon-squeezy`, Events `order_created` / `order_refunded`, keine LS-License-Keys
- Pro Plattform **eigener Webhook** mit **eigenem Signing Secret** (Culoca nur seinen Secret in Vercel)
- Checkout-URLs (`dirschl.com/checkout/buy/…`) sind **nicht** die Variant-IDs für die Culoca-API

## 10. SEO

- `acquireLicensePage` → Download-/Kauf-URL pro Bild
- Sitemap & Hubs nutzen indexierbare `-2048` Bild-URLs
