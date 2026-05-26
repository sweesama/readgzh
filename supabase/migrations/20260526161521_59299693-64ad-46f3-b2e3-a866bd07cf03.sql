
DROP FUNCTION IF EXISTS public.list_public_comments();

CREATE FUNCTION public.list_public_comments()
RETURNS TABLE (
  id uuid,
  parent_id uuid,
  content text,
  is_anonymous boolean,
  likes_count integer,
  dislikes_count integer,
  created_at timestamptz,
  author_key text,
  author_display_name text,
  author_avatar_url text,
  author_is_admin boolean,
  is_own boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    c.id,
    c.parent_id,
    c.content,
    c.is_anonymous,
    c.likes_count,
    c.dislikes_count,
    c.created_at,
    CASE WHEN c.is_anonymous OR c.user_id IS NULL THEN NULL
         ELSE encode(extensions.digest(c.user_id::text || 'rgz_comment_v1', 'sha256'), 'hex') END AS author_key,
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
