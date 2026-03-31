
CREATE OR REPLACE FUNCTION public.get_token_stats()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH img_avg AS (
    -- Calculate average images per article from articles that still have raw_html
    SELECT COALESCE(
      SUM((SELECT COUNT(*)::int FROM regexp_matches(a.raw_html, '<img[^>]+>', 'g')))::numeric 
      / NULLIF(COUNT(*), 0),
      5  -- fallback default if no raw_html exists at all
    ) AS avg_imgs
    FROM public.articles a
    WHERE a.raw_html IS NOT NULL
  )
  SELECT jsonb_build_object(
    'total_tokens', 
    ROUND(SUM(
      (length(a.content) + 
       -- Use actual count from raw_html, or estimate from average
       CASE 
         WHEN a.raw_html IS NOT NULL 
         THEN (SELECT COUNT(*)::int FROM regexp_matches(a.raw_html, '<img[^>]+>', 'g')) * 200
         ELSE ROUND(img_avg.avg_imgs * 200)
       END
      ) * GREATEST(a.view_count, 1) * 1.2
    ))::bigint
  )
  FROM public.articles a, img_avg;
$function$;
