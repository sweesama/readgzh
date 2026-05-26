UPDATE public.api_keys SET key_value = NULL WHERE key_value IS NOT NULL;
ALTER TABLE public.api_keys DROP COLUMN IF EXISTS key_value;

DROP POLICY IF EXISTS email_assets_public_read ON storage.objects;