CREATE OR REPLACE FUNCTION public.check_rate_limit(p_ip text, p_daily_limit integer DEFAULT 10)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER;
  v_result JSON;
BEGIN
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
$function$;