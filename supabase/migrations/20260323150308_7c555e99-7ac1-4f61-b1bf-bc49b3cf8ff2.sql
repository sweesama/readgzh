-- Expose only safe comment-author fields through a secure RPC to avoid leaking private profile data.
CREATE OR REPLACE FUNCTION public.get_comment_profiles(p_user_ids uuid[])
RETURNS TABLE (
  id uuid,
  display_name text,
  avatar_url text,
  is_admin boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    NULLIF(BTRIM(p.display_name), '') AS display_name,
    p.avatar_url,
    COALESCE(p.email = 'sweeyeah@gmail.com', false) AS is_admin
  FROM public.profiles p
  WHERE p.id = ANY(COALESCE(p_user_ids, ARRAY[]::uuid[]));
$$;