CREATE OR REPLACE FUNCTION public.get_token_stats()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Token saving estimate per article view:
  --   raw_html / 4   = tokens AI would burn parsing the original WeChat HTML page
  --                    (with scripts, CSS, tracking, image tags). Fallback to content*3
  --                    when raw_html has been cleaned up.
  --   + length(content) = tokens for the clean article we actually returned.
  -- Multiplied by view_count (each cached read replaces one fetch) and 1.3x for
  -- system prompt / reasoning overhead the AI would have spent.
  SELECT jsonb_build_object(
    'total_tokens',
    COALESCE(ROUND(SUM(
      (COALESCE(length(a.raw_html), length(a.content) * 3) / 4 + length(a.content))
      * GREATEST(a.view_count, 1) * 1.3
    )), 0)::bigint
  )
  FROM public.articles a;
$function$;