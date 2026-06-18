# Lemon Squeezy — Culoca Bildverkauf

Culoca verkauft Bildlizenzen über [Lemon Squeezy](https://lemonsqueezy.com) als **Merchant of Record** (Rechnungen, MwSt., internationale Zahlungen). Nach dem Kauf erhält der Nutzer Download-Rechte in seinem Culoca-Konto.

## Architektur: ein Zahlungsanbieter, ein Account, mehrere Stores

| Ebene | Was |
|-------|-----|
| **Zahlungsanbieter** | Nur Lemon Squeezy (weltweite Steuer/MoR) |
| **LS-Account** | Ein Konto (z. B. DIRSCHL.com GmbH) — Billing, Auszahlungen, API-Keys |
| **Stores im Account** | Getrennte Marken/Produkte, je Store eigene Domain & Webhooks |

Aktuell zwei Stores im selben Account:

| Store | Domain (Checkout) | Plattform | Store-ID (Beispiel) |
|-------|-------------------|-----------|---------------------|
| **dirschl.com** | `dirschl.com` | dirschl.com SaaS (WordPress) | `389397` |
| **culoca.com** | `culoca.lemonsqueezy.com` (Übergang) | culoca.com (SvelteKit) | **`410993`** |

Culoca verwendet **nur den Culoca-Store** (`LEMONSQUEEZY_STORE_ID=410993`). Der dirschl-Store (`389397`) bleibt für SaaS-Produkte.

**API-Key:** Ein Account-Key gilt für alle Stores im Konto (dirschl + culoca). Kein separater Key nötig.

Referenz: [Multiple Stores](https://docs.lemonsqueezy.com/help/your-account/multiple-stores) · [Custom Domain](https://docs.lemonsqueezy.com/help/domains/adding-a-custom-domain)

## 1. Culoca-Store in Lemon Squeezy anlegen

Im Dashboard (Account-Dropdown → **Stores** → **New store**):

1. **Store name:** `Culoca` (oder „Culoca.com“)
2. **Store URL (Slug):** `culoca` → `culoca.lemonsqueezy.com`
3. **Währung:** EUR
4. **Kontakt-E-Mail:** Support-Adresse für Culoca-Käufer

### Produkte (im Culoca-Store, nicht im dirschl-Store)

| Produkt | Basispreis | Hinweis |
|---------|------------|---------|
| Culoca Standard-Lizenz | €29,00 | Checkout setzt Preis pro Bild via `custom_price` |
| Culoca Erweiterte Lizenz | €99,00 | wie oben |

Keine LS-Lizenzschlüssel — Culoca verwaltet Rechte in `license_purchases`.

### Produkte im Culoca-Store (Stand 2026-06-18)

| Produkt | Produkt-ID | Variant-ID (API) | Checkout-Slug (Share-URL) | Preis |
|---------|------------|------------------|-----------------------------|-------|
| Culoca Standard-Lizenz | `1154821` | **`1807065`** | `c019b1eb-552a-41cf-a6fa-11b39324e913` | €29 |
| Culoca Erweiterte Lizenz | `1154827` | **`1807072`** | `38e06a1b-da89-438d-806c-ae1c2202816e` | €99 |

Für Vercel: **numerische Variant-IDs** (`1807065` / `1807072`), nicht die UUID-Slugs aus der Share-URL. Im Dashboard: Produkt-Menü (⋯) → **Copy variant ID**.

### Custom Domain für Culoca-Checkout

**Wichtig:** `culoca.com` läuft auf Vercel (SvelteKit). LS braucht für die Checkout-URL eine Domain, die per DNS auf LS zeigt.

Empfohlen (eine Option wählen):

| Option | Checkout-URL | DNS |
|--------|--------------|-----|
| **A** Subdomain | `checkout.culoca.com/checkout/…` | A-Record `checkout` → LS (laut Dashboard) |
| **B** Apex | `culoca.com/checkout/…` | Nur wenn `/checkout/*` an LS geroutet wird; sonst Konflikt mit Vercel |
| **C** Übergang | `culoca.lemonsqueezy.com/checkout/…` | Kein DNS nötig, weniger Marken-Einheitlichkeit |

Settings → **Domains** im **Culoca-Store** (Store-Umschalter oben links beachten).

### Webhook (Culoca-Store)

Settings → Webhooks → **New webhook** (im Culoca-Store):

- URL: `https://culoca.com/api/webhooks/lemon-squeezy`
- Events: **`order_created`**, **`order_refunded`**
- Signing Secret → `LEMONSQUEEZY_WEBHOOK_SECRET` in Vercel (max. 40 Zeichen)

Culoca-Webhook angelegt: ID `111667`, Events `order_created` + `order_refunded`.

Der dirschl-Webhook (`www.dirschl.com/wp-json/…`) bleibt im dirschl-Store unverändert.

### API-Key

Settings → API: derselbe Account-Key funktioniert für alle Stores. Beim Checkout/API-Call wird der Store über `LEMONSQUEEZY_STORE_ID` gewählt.

## 2. Umgebungsvariablen (Vercel)

```env
CULOCA_SALES_ENABLED=true
PUBLIC_CULOCA_SALES_ENABLED=true

LEMONSQUEEZY_API_KEY=...              # Account-Key (alle Stores)
LEMONSQUEEZY_STORE_ID=410993
LEMONSQUEEZY_WEBHOOK_SECRET=...       # Secret des Culoca-Store-Webhooks (im LS-Dashboard)
LEMONSQUEEZY_VARIANT_STANDARD_ID=1807065
LEMONSQUEEZY_VARIANT_EXTENDED_ID=1807072
LEMONSQUEEZY_TEST_MODE=true

# Optional: Checkout-Host, falls Subdomain (z. B. checkout.culoca.com)
# LEMONSQUEEZY_CHECKOUT_HOST=checkout.culoca.com

CULOCA_LICENSE_STANDARD_PRICE_CENTS=2900
CULOCA_LICENSE_EXTENDED_PRICE_CENTS=9900
PUBLIC_CULOCA_LICENSE_STANDARD_PRICE_CENTS=2900
PUBLIC_CULOCA_LICENSE_EXTENDED_PRICE_CENTS=9900
```

`SUPABASE_SERVICE_ROLE_KEY` muss gesetzt sein (Webhook schreibt Lizenzen).

Nach Store-/Variant-Wechsel: **Redeploy** auf Vercel.

## 3. Datenbank-Migration

Im Supabase SQL Editor (Reihenfolge):

1. `database-migrations/2026-06-18_license-purchases-lemon-squeezy.sql`
2. `database-migrations/2026-06-18_license-cart.sql`

## 4. Ablauf (culoca.com)

1. Nutzer → Bild → Lizenzstufe → **In den Warenkorb**
2. `/warenkorb` → **Zur Kasse**
3. `POST /api/checkout/cart` → LS-Checkout (Culoca-Store, Domain siehe oben)
4. Custom data: `checkout_mode: cart`, `line_items`, `buyer_user_id`
5. Webhook `order_created` → `license_purchases`
6. Redirect: `/dashboard?section=licenses&purchase=success`

APIs: `GET/POST/PATCH/DELETE /api/cart`, `POST /api/checkout/cart`

## 5. Testmodus

- `LEMONSQUEEZY_TEST_MODE=true` + LS Test mode
- Nach Freischaltung: Live mode + `LEMONSQUEEZY_TEST_MODE=false`

## 6. Migration vom gemeinsamen dirschl-Store

Falls Culoca-Produkte noch im Store `#389397` liegen:

1. Culoca-Store anlegen (oben)
2. Produkte im Culoca-Store neu anlegen (oder duplizieren)
3. Vercel-Env auf neue Store-ID + Variant-IDs umstellen
4. Testkauf auf culoca.com
5. Alte Culoca-Produkte im dirschl-Store optional archivieren

## 7. Rechtliches

- `/web/license#kommerziell`
- Bildspezifisch: `{item-url}/download#lizenzbedingungen`
- Lemon Squeezy AGB für Zahlung & Rechnung
