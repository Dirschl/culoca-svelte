# Environment Variables

## Required Environment Variables

### Supabase Configuration
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key

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

Make sure to set all environment variables in your production environment (Vercel, etc.). 