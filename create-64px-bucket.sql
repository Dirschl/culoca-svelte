-- Create images-64 storage bucket for 64px thumbnails
INSERT INTO storage.buckets (id, name, public) 
VALUES ('images-64', 'images-64', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for images-64
-- Allow authenticated users to upload 64px thumbnails
CREATE POLICY "Allow authenticated users to upload 64px thumbnails" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'images-64' AND 
    auth.role() = 'authenticated'
  );

-- Allow authenticated users to update their own 64px thumbnails
CREATE POLICY "Allow users to update own 64px thumbnails" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'images-64' AND 
    auth.role() = 'authenticated'
  );

-- Allow authenticated users to delete their own 64px thumbnails
CREATE POLICY "Allow users to delete own 64px thumbnails" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'images-64' AND 
    auth.role() = 'authenticated'
  );

-- 64px thumbnails are publicly viewable
CREATE POLICY "64px thumbnails are publicly viewable" ON storage.objects
  FOR SELECT USING (bucket_id = 'images-64'); 