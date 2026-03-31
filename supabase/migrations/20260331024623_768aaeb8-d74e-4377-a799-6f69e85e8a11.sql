
CREATE OR REPLACE FUNCTION public.get_token_stats()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'total_tokens', 
    ROUND(SUM(
      (length(a.content) + 
       -- Add ~200 tokens per image (markdown ![...](...) or <img> tags)
       (SELECT COUNT(*)::int FROM regexp_matches(a.content, '!\[.*?\]\(.*?\)|<img[^>]+>', 'g')) * 200
      ) * GREATEST(a.view_count, 1) * 1.2
    ))::bigint
  )
  FROM public.articles a;
$function$;
