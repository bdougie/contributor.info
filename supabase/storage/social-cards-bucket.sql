-- Create social-cards storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('social-cards', 'social-cards', true)
ON CONFLICT (id) DO NOTHING;

-- Set up bucket policies for social cards
-- Allow public access to read social card images
CREATE POLICY "Public Access for Social Cards" ON storage.objects
FOR SELECT USING (bucket_id = 'social-cards');

-- Allow authenticated uploads (for build process)
CREATE POLICY "Allow Build Process Upload" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'social-cards' 
  AND auth.role() = 'service_role'
);

-- Allow authenticated updates (for regeneration)
CREATE POLICY "Allow Build Process Update" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'social-cards' 
  AND auth.role() = 'service_role'
);

-- Allow authenticated deletes (for cleanup)
CREATE POLICY "Allow Build Process Delete" ON storage.objects
FOR DELETE USING (
  bucket_id = 'social-cards' 
  AND auth.role() = 'service_role'
);