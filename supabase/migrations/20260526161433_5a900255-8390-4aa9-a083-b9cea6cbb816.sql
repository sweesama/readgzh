
-- 1) Public RPC that returns comments with safe author fields only (no raw user_id)
CREATE OR REPLACE FUNCTION public.list_public_comments()
RETURNS TABLE (
  id uuid,
  parent_id uuid,
  content text,
  is_anonymous boolean,
  likes_count integer,
  dislikes_count integer,
  created_at timestamptz,
  author_display_name text,
  author_avatar_url text,
  author_is_admin boolean,
  is_own boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.parent_id,
    c.content,
    c.is_anonymous,
    c.likes_count,
    c.dislikes_count,
    c.created_at,
    CASE WHEN c.is_anonymous THEN NULL
         ELSE NULLIF(BTRIM(p.display_name), '') END AS author_display_name,
    CASE WHEN c.is_anonymous THEN NULL ELSE p.avatar_url END AS author_avatar_url,
    CASE WHEN c.is_anonymous THEN false
         ELSE COALESCE(p.email = 'sweeyeah@gmail.com', false) END AS author_is_admin,
    (auth.uid() IS NOT NULL AND c.user_id = auth.uid()) AS is_own
  FROM public.comments c
  LEFT JOIN public.profiles p ON p.id = c.user_id
  ORDER BY c.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.list_public_comments() TO anon, authenticated;

-- Restrict direct SELECT on comments to authenticated only (frontend uses RPC for listing).
-- Authenticated users still need direct access for is_own checks via auth.uid() = user_id elsewhere if any.
DROP POLICY IF EXISTS "Anyone can read comments" ON public.comments;
CREATE POLICY "Authenticated can read comments"
ON public.comments
FOR SELECT
TO authenticated
USING (true);

-- 2) Storage.objects RLS: restrict writes to service_role; allow public reads of email-assets.
CREATE POLICY "email_assets_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'email-assets');

CREATE POLICY "service_role_storage_insert"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service_role_storage_update"
ON storage.objects
FOR UPDATE
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service_role_storage_delete"
ON storage.objects
FOR DELETE
TO public
USING (auth.role() = 'service_role');
