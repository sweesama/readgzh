CREATE OR REPLACE FUNCTION public.get_token_stats()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Simplified: avoid per-row regex over raw_html which timed out at scale.
  -- Assume ~5 images per article on average = 1000 tokens of image context.
  SELECT jsonb_build_object(
    'total_tokens',
    COALESCE(ROUND(SUM(
      (length(a.content) + 1000) * GREATEST(a.view_count, 1) * 1.2
    )), 0)::bigint
  )
  FROM public.articles a;
$function$;