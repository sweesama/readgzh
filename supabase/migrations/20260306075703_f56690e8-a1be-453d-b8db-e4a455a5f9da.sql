-- Update validate_api_key to consider bonus_credits
CREATE OR REPLACE FUNCTION public.validate_api_key(p_key_hash text, p_credit_cost integer DEFAULT 1)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key RECORD;
  v_usage INTEGER;
  v_daily_limit INTEGER;
  v_total_limit INTEGER;
  v_result JSON;
BEGIN
  SELECT * INTO v_key FROM public.api_keys WHERE key_hash = p_key_hash AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'Invalid API key');
  END IF;

  v_daily_limit := v_key.daily_limit;
  -- Total limit = daily limit + any purchased bonus credits
  v_total_limit := v_daily_limit + COALESCE(v_key.bonus_credits, 0);

  INSERT INTO public.api_usage (api_key_id, usage_date, request_count)
  VALUES (v_key.id, CURRENT_DATE, p_credit_cost)
  ON CONFLICT (api_key_id, usage_date)
  DO UPDATE SET request_count = api_usage.request_count + p_credit_cost, updated_at = now()
  RETURNING request_count INTO v_usage;

  UPDATE public.api_keys SET last_used_at = now() WHERE id = v_key.id;

  -- If usage exceeds daily limit but within bonus range, deduct from bonus
  IF v_usage > v_daily_limit AND v_usage <= v_total_limit THEN
    -- Deduct from bonus credits
    UPDATE public.api_keys 
    SET bonus_credits = GREATEST(0, bonus_credits - p_credit_cost) 
    WHERE id = v_key.id;
  END IF;

  v_result := json_build_object(
    'valid', true,
    'allowed', v_usage <= v_total_limit,
    'user_id', v_key.user_id,
    'tier', v_key.tier,
    'current', v_usage,
    'limit', v_total_limit,
    'remaining', GREATEST(0, v_total_limit - v_usage),
    'credit_cost', p_credit_cost,
    'bonus_credits', COALESCE(v_key.bonus_credits, 0)
  );

  RETURN v_result;
END;
$$;

-- Also update the single-arg version
CREATE OR REPLACE FUNCTION public.validate_api_key(p_key_hash text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.validate_api_key(p_key_hash, 1);
END;
$$;