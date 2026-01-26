# Environment Variables

## Required Environment Variables

### Supabase Configuration
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key (client-safe)
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase **service role** key (server-only; never expose to client or commit)

**Important:** Store `SUPABASE_SERVICE_ROLE_KEY` only in `.env.local` (local) or deployment secrets (e.g. Vercel). Never hardcode it or commit it. If a key was ever leaked (e.g. in git history), **rotate it immediately** in [Supabase Dashboard → Project Settings → API](https://supabase.com/dashboard/project/_/settings/api), then update your env and redeploy.

### Hetzner WebDAV Configuration
- `HETZNER_WEBDAV_URL`: Your Hetzner WebDAV URL
- `HETZNER_WEBDAV_USER`: Your WebDAV username
- `HETZNER_WEBDAV_PASSWORD`: Your WebDAV password
- `HETZNER_WEBDAV_PUBLIC_URL`: Your public Hetzner URL for downloads

### Google Gemini AI Configuration
- `GOOGLE_GEMINI_API_KEY`: Your Google Gemini API key for AI image analysis

## Setup Instructions

1. Copy `.env.local.example` to `.env.local`
2. Fill in your actual values
3. For Google Gemini API:
   - Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Add it to your `.env.local` file

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## Production Deployment

Make sure to set all environment variables in your production environment (Vercel, etc.). Use each platform’s “Secrets” or “Environment Variables” UI; never put real keys in repo or Dockerfiles.

## Secrets and key rotation

- **Never commit** `SUPABASE_SERVICE_ROLE_KEY`, `HETZNER_*` passwords, `GOOGLE_GEMINI_API_KEY`, or any other secret.
- If a secret was leaked (e.g. detected by GitHub secret scanning): **rotate it immediately** in the provider’s dashboard, then update `.env.local` and deployment env. Old keys remain valid until rotated.
- `.env` and `.env.local` are gitignored; use `.env.example` only for placeholder names, never real values. 