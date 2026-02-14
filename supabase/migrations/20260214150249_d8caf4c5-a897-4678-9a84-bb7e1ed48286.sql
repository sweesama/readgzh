
-- Rate limiting table: track requests per IP per day
CREATE TABLE public.rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  request_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(ip_address, request_date)
);

-- Enable RLS (only edge functions with service role key access this)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- No public policies - only service role can access
-- This table is only used by edge functions with SUPABASE_SERVICE_ROLE_KEY

-- Index for fast lookups
CREATE INDEX idx_rate_limits_ip_date ON public.rate_limits(ip_address, request_date);

-- Function to check and increment rate limit, returns remaining count
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_ip TEXT,
  p_daily_limit INTEGER DEFAULT 100
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count INTEGER;
  v_result JSON;
BEGIN
  -- Upsert: insert or increment
  INSERT INTO public.rate_limits (ip_address, request_date, request_count)
  VALUES (p_ip, CURRENT_DATE, 1)
  ON CONFLICT (ip_address, request_date)
  DO UPDATE SET request_count = rate_limits.request_count + 1, updated_at = now()
  RETURNING request_count INTO v_count;

  v_result := json_build_object(
    'allowed', v_count <= p_daily_limit,
    'current', v_count,
    'limit', p_daily_limit,
    'remaining', GREATEST(0, p_daily_limit - v_count)
  );

  RETURN v_result;
END;
$$;

-- Cleanup old records (keep only 7 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.rate_limits WHERE request_date < CURRENT_DATE - INTERVAL '7 days';
END;
$$;
