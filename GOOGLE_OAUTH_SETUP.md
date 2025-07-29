# Google OAuth Setup für bestehende Benutzer

## 🔐 **Übersicht**

Ja, es ist definitiv möglich! Sie können manuell Benutzer mit E-Mail/Passwort erstellen und diese später mit Google OAuth verknüpfen. Supabase unterstützt beide Authentifizierungsmethoden für denselben Account.

## 📋 **Schritt-für-Schritt Anleitung**

### 1. **Manuelle Benutzer-Erstellung**

#### Option A: Admin-Interface
1. Gehen Sie zu `/admin/create-user`
2. Füllen Sie die Felder aus:
   - **E-Mail**: `kunde@example.com`
   - **Passwort**: `sicheres-passwort`
   - **Vollständiger Name**: `Max Mustermann`
   - **Account-Name** (optional): `max82`

#### Option B: Direkter API-Call
```bash
curl -X POST https://your-domain.com/api/admin/create-user \
  -H "Content-Type: application/json" \
  -d '{
    "email": "kunde@example.com",
    "password": "sicheres-passwort",
    "fullName": "Max Mustermann",
    "accountName": "max82"
  }'
```

### 2. **Supabase Google OAuth konfigurieren**

#### In Supabase Dashboard:
1. **Authentication** → **Providers**
2. **Google** aktivieren
3. **Client ID** und **Client Secret** von Google Console eintragen
4. **Redirect URLs** konfigurieren:
   - Development: `http://localhost:5173/auth/callback`
   - Production: `https://your-domain.com/auth/callback`

### 3. **Google Cloud Console Setup**

#### Google Cloud Console:
1. Gehen Sie zu [Google Cloud Console](https://console.cloud.google.com/)
2. **Neues Projekt** erstellen oder bestehendes wählen
3. **APIs & Services** → **Credentials**
4. **Create Credentials** → **OAuth 2.0 Client IDs**
5. **Application type**: Web application
6. **Authorized redirect URIs** hinzufügen:
   - `https://your-project.supabase.co/auth/v1/callback`
   - `http://localhost:5173/auth/callback` (Development)

### 4. **Benutzer kann sich mit Google anmelden**

Nach der Konfiguration kann der Benutzer:

1. **Mit E-Mail/Passwort anmelden** (wie gewohnt)
2. **Mit Google anmelden** (neue Option)
3. **Beide Methoden verwenden** für denselben Account

## 🔗 **Account-Linking**

### Automatisches Linking
- Wenn der Benutzer sich mit Google anmeldet und die E-Mail-Adresse bereits existiert, wird automatisch verknüpft
- Supabase erkennt die E-Mail-Adresse und verbindet die Accounts

### Manuelles Linking (falls nötig)
```sql
-- In Supabase SQL Editor
UPDATE auth.users 
SET raw_user_meta_data = raw_user_meta_data || 
    '{"google_linked": true}'::jsonb
WHERE email = 'kunde@example.com';
```

## 🛡️ **Sicherheitsaspekte**

### Admin-Zugriff beschränken
In `src/routes/admin/create-user/+page.svelte`:
```javascript
// Ändern Sie diese Zeile:
if (user?.email === 'your-admin-email@example.com') {
  isAdmin = true;
}

// Zu Ihrer Admin-E-Mail:
if (user?.email === 'ihre-admin-email@example.com') {
  isAdmin = true;
}
```

### Service Role Key
Stellen Sie sicher, dass `SUPABASE_SERVICE_ROLE_KEY` in Ihren Umgebungsvariablen gesetzt ist:
```env
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 📱 **Benutzer-Erfahrung**

### Für den Kunden:
1. **Erste Anmeldung**: E-Mail/Passwort (von Ihnen erstellt)
2. **Profil einrichten**: Name, Account-Name, etc.
3. **Google hinzufügen**: Kann später Google OAuth aktivieren
4. **Beide Methoden**: Kann sich mit E-Mail ODER Google anmelden

### Für Sie als Admin:
1. **Benutzer erstellen**: Über Admin-Interface
2. **Zugangsdaten mitteilen**: E-Mail/Passwort an Kunden
3. **Google Setup**: OAuth konfigurieren
4. **Support**: Kunde kann beide Methoden nutzen

## 🔧 **Troubleshooting**

### Problem: Google OAuth funktioniert nicht
**Lösung:**
1. Redirect URLs in Google Console prüfen
2. Client ID/Secret in Supabase prüfen
3. Domain in Google Console autorisiert?

### Problem: Account wird nicht verknüpft
**Lösung:**
1. E-Mail-Adressen müssen identisch sein
2. Google Account muss bestätigt sein
3. Supabase Auth-Logs prüfen

### Problem: Admin-Zugriff funktioniert nicht
**Lösung:**
1. Service Role Key prüfen
2. Admin-E-Mail in Code anpassen
3. Supabase RLS-Policies prüfen

## 📞 **Support für Kunden**

### E-Mail an Kunden:
```
Hallo [Kundenname],

ich habe Ihren Account bei Culoca erstellt:

E-Mail: kunde@example.com
Passwort: [sicheres-passwort]

Sie können sich jetzt anmelden unter: https://your-domain.com/login

Später können Sie auch Google für die Anmeldung verwenden.

Bei Fragen melden Sie sich gerne!

Beste Grüße
[Ihr Name]
```

## ✅ **Checkliste**

- [ ] Admin-Interface erstellt
- [ ] Service Role Key konfiguriert
- [ ] Google OAuth in Supabase aktiviert
- [ ] Google Cloud Console konfiguriert
- [ ] Redirect URLs korrekt gesetzt
- [ ] Test-Benutzer erstellt
- [ ] Beide Anmeldemethoden getestet

**Das System ist jetzt bereit für manuelle Benutzer-Erstellung mit späterer Google OAuth-Integration!** 🚀 