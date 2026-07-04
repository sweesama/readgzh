
-- Cache table for expensive aggregate stats
CREATE TABLE IF NOT EXISTS public.platform_stats_cache (
  key text PRIMARY KEY,
  value bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_stats_cache TO anon, authenticated;
GRANT ALL ON public.platform_stats_cache TO service_role;

ALTER TABLE public.platform_stats_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read stats cache"
  ON public.platform_stats_cache FOR SELECT
  USING (true);

-- Refresh function (heavy). Runs via pg_cron; not called on user requests.
CREATE OR REPLACE FUNCTION public.refresh_token_stats_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
BEGIN
  SELECT COALESCE(ROUND(SUM(
    (COALESCE(length(a.raw_html), length(a.content) * 3) / 4 + length(a.content))
    * GREATEST(a.view_count, 1) * 1.3
  )), 0)::bigint
  INTO v_total
  FROM public.articles a;

  INSERT INTO public.platform_stats_cache (key, value, updated_at)
  VALUES ('total_tokens', v_total, now())
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;
END;
$$;

-- Replace get_token_stats to read from cache; live-compute fallback only if cache is empty.
CREATE OR REPLACE FUNCTION public.get_token_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
BEGIN
  SELECT value INTO v_total
  FROM public.platform_stats_cache
  WHERE key = 'total_tokens';

  IF v_total IS NULL THEN
    -- Cache miss: compute once (rare; only until first cron run) and store.
    SELECT COALESCE(ROUND(SUM(
      (COALESCE(length(a.raw_html), length(a.content) * 3) / 4 + length(a.content))
      * GREATEST(a.view_count, 1) * 1.3
    )), 0)::bigint
    INTO v_total
    FROM public.articles a;

    BEGIN
      INSERT INTO public.platform_stats_cache (key, value)
      VALUES ('total_tokens', v_total)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN jsonb_build_object('total_tokens', COALESCE(v_total, 0));
END;
$$;

-- Seed the cache immediately so first read after migration is instant.
SELECT public.refresh_token_stats_cache();

-- Schedule refresh every 30 minutes (idempotent).
DO $$
BEGIN
  PERFORM cron.unschedule('refresh-token-stats-cache');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'refresh-token-stats-cache',
  '*/30 * * * *',
  $cron$ SELECT public.refresh_token_stats_cache(); $cron$
);
