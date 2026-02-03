-- 1. Create the 'media' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow PUBLIC read access to files in the 'media' bucket
CREATE POLICY "Public Media Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'media' );

-- 3. Allow AUTHENTICATED users to upload files to 'media' bucket
CREATE POLICY "Authenticated Media Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'media' );

-- 4. Allow AUTHENTICATED users to update their files
CREATE POLICY "Authenticated Media Update"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'media' );

-- 5. Allow AUTHENTICATED users to delete their files
CREATE POLICY "Authenticated Media Delete"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'media' );
