CREATE OR REPLACE FUNCTION public.search_public_articles(p_query text, p_limit integer DEFAULT 5)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_q text := btrim(COALESCE(p_query, ''));
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 5), 1), 20);
  v_result jsonb;
BEGIN
  IF v_q = '' THEN
    RETURN jsonb_build_object('articles', '[]'::jsonb);
  END IF;

  -- Force trigram index usage: a seq scan detoasts every article body and
  -- blows past the statement timeout for rare keywords.
  SET LOCAL enable_seqscan = off;

  WITH matches AS (
    (SELECT id, title, author, publish_time, slug, source_url, view_count, created_at
       FROM public.articles
      WHERE title ILIKE '%' || v_q || '%'
      ORDER BY created_at DESC
      LIMIT 200)
    UNION
    (SELECT id, title, author, publish_time, slug, source_url, view_count, created_at
       FROM public.articles
      WHERE content ILIKE '%' || v_q || '%'
      LIMIT 200)
  ), paged AS (
    SELECT title, author, publish_time, slug, source_url, view_count, created_at
      FROM matches
     ORDER BY created_at DESC
     LIMIT v_limit
  )
  SELECT jsonb_build_object(
    'articles', COALESCE((SELECT jsonb_agg(to_jsonb(paged)) FROM paged), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_public_articles(text, integer) TO anon, authenticated, service_role;