CREATE OR REPLACE FUNCTION public.get_total_views()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(view_count), 0)::bigint FROM public.articles;
$$;

CREATE OR REPLACE FUNCTION public.get_total_anon_requests(p_date date DEFAULT NULL)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(request_count), 0)::bigint 
  FROM public.rate_limits
  WHERE (p_date IS NULL OR request_date = p_date);
$$;

CREATE OR REPLACE FUNCTION public.get_api_usage_stats(p_date date DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'request_count', COALESCE(SUM(request_count), 0)::bigint,
    'cached_count', COALESCE(SUM(cached_count), 0)::bigint
  )
  FROM public.api_usage
  WHERE (p_date IS NULL OR usage_date = p_date);
$$;