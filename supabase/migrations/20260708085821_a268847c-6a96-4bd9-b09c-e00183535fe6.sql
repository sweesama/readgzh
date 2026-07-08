
CREATE OR REPLACE FUNCTION public.get_anon_request_breakdown(p_date date DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH rows AS (
    SELECT
      ip_address,
      request_count,
      CASE
        WHEN ip_address LIKE 'img:%' THEN 'image'
        WHEN ip_address LIKE 'read:%' THEN 'read_other'
        ELSE 'article'
      END AS kind,
      CASE
        WHEN ip_address LIKE 'img:%' THEN 500
        ELSE 10
      END AS daily_cap
    FROM public.rate_limits
    WHERE (p_date IS NULL OR request_date = p_date)
  ),
  agg AS (
    SELECT
      kind,
      SUM(request_count)::bigint AS attempted,
      SUM(LEAST(request_count, daily_cap))::bigint AS allowed
    FROM rows
    GROUP BY kind
  ),
  top_article AS (
    SELECT ip_address, SUM(request_count)::bigint AS attempts
    FROM rows WHERE kind = 'article'
    GROUP BY ip_address ORDER BY attempts DESC LIMIT 5
  ),
  top_image AS (
    SELECT REPLACE(ip_address, 'img:', '') AS ip_address, SUM(request_count)::bigint AS attempts
    FROM rows WHERE kind = 'image'
    GROUP BY ip_address ORDER BY attempts DESC LIMIT 5
  )
  SELECT jsonb_build_object(
    'article', COALESCE((SELECT jsonb_build_object(
      'attempted', attempted,
      'allowed', allowed,
      'blocked', attempted - allowed
    ) FROM agg WHERE kind = 'article'), jsonb_build_object('attempted',0,'allowed',0,'blocked',0)),
    'image', COALESCE((SELECT jsonb_build_object(
      'attempted', attempted,
      'allowed', allowed,
      'blocked', attempted - allowed
    ) FROM agg WHERE kind = 'image'), jsonb_build_object('attempted',0,'allowed',0,'blocked',0)),
    'top_article_ips', COALESCE((SELECT jsonb_agg(jsonb_build_object('ip', ip_address, 'attempts', attempts)) FROM top_article), '[]'::jsonb),
    'top_image_ips', COALESCE((SELECT jsonb_agg(jsonb_build_object('ip', ip_address, 'attempts', attempts)) FROM top_image), '[]'::jsonb)
  );
$$;
