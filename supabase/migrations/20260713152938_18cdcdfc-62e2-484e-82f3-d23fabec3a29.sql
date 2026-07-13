DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Public read for email-assets bucket'
  ) THEN
    CREATE POLICY "Public read for email-assets bucket"
      ON storage.objects
      FOR SELECT
      TO anon, authenticated
      USING (bucket_id = 'email-assets');
  END IF;
END $$;