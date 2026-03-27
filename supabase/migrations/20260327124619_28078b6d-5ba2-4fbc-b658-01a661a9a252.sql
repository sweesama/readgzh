CREATE OR REPLACE FUNCTION public.get_public_article_detail(p_slug text DEFAULT NULL::text, p_article_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT to_jsonb(t)
  FROM (
    SELECT
      id,
      title,
      author,
      content,
      source_url,
      publish_time,
      created_at,
      view_count,
      slug
    FROM public.articles
    WHERE (
      (p_slug IS NOT NULL AND slug = CASE WHEN p_slug LIKE 's/%' THEN p_slug ELSE 's/' || p_slug END)
      OR (p_article_id IS NOT NULL AND id = p_article_id)
    )
    ORDER BY created_at DESC
    LIMIT 1
  ) AS t;
$function$;