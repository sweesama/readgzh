-- Public-safe article access: only lightweight list/search + single-item detail via SECURITY DEFINER RPCs
CREATE OR REPLACE FUNCTION public.list_public_articles(
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 24,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH filtered AS (
    SELECT
      id,
      title,
      author,
      publish_time,
      slug,
      view_count,
      created_at
    FROM public.articles
    WHERE (
      p_search IS NULL
      OR btrim(p_search) = ''
      OR title ILIKE '%' || p_search || '%'
      OR COALESCE(author, '') ILIKE '%' || p_search || '%'
    )
  ), total AS (
    SELECT COUNT(*)::integer AS count FROM filtered
  ), paged AS (
    SELECT *
    FROM filtered
    ORDER BY created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 24), 1), 50)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  )
  SELECT jsonb_build_object(
    'total_count', (SELECT count FROM total),
    'articles', COALESCE((SELECT jsonb_agg(to_jsonb(paged)) FROM paged), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_public_article_detail(
  p_slug text DEFAULT NULL,
  p_article_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT to_jsonb(t)
  FROM (
    SELECT
      id,
      title,
      author,
      content,
      raw_html,
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
$$;

GRANT EXECUTE ON FUNCTION public.list_public_articles(text, integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_article_detail(text, uuid) TO anon, authenticated;