-- Create map_shares table for storing share data
CREATE TABLE IF NOT EXISTS public.map_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(60) NOT NULL DEFAULT 'CULOCA - Map View Share',
  description VARCHAR(160) NOT NULL DEFAULT 'Map View Snippet - CULOCA.com',
  screenshot TEXT, -- Base64 data URL of the screenshot
  params TEXT NOT NULL, -- URL parameters (lat, lon, zoom, map_type, user)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  views INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.map_shares ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access for reading shares
CREATE POLICY "Allow anonymous read access" ON public.map_shares
  FOR SELECT USING (true);

-- Allow authenticated users to create shares
CREATE POLICY "Allow authenticated users to create shares" ON public.map_shares
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow users to update their own shares
CREATE POLICY "Allow users to update own shares" ON public.map_shares
  FOR UPDATE USING (auth.uid() = created_by);

-- Allow users to delete their own shares
CREATE POLICY "Allow users to delete own shares" ON public.map_shares
  FOR DELETE USING (auth.uid() = created_by);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_map_shares_created_at ON public.map_shares(created_at DESC);

-- Grant permissions
GRANT SELECT ON public.map_shares TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.map_shares TO authenticated; 