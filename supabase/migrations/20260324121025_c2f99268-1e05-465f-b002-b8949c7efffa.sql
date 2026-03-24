CREATE OR REPLACE FUNCTION public.get_token_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_tokens', 
    ROUND(SUM(length(content) * GREATEST(view_count, 1) * 1.2))::bigint
  )
  FROM public.articles;
$$;