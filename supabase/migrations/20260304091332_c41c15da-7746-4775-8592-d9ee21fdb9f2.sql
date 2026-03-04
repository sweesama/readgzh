
-- Add a function to get user's remaining credits for today
CREATE OR REPLACE FUNCTION public.get_user_balance(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claimed INTEGER;
  v_used INTEGER;
  v_today DATE := CURRENT_DATE;
  v_has_claimed BOOLEAN;
BEGIN
  -- Check if user claimed today
  SELECT COALESCE(SUM(credits_claimed), 0) INTO v_claimed
  FROM public.daily_credits
  WHERE user_id = p_user_id AND claim_date = v_today;

  v_has_claimed := v_claimed > 0;

  -- Get today's total usage across all keys
  SELECT COALESCE(SUM(au.request_count), 0) INTO v_used
  FROM public.api_usage au
  JOIN public.api_keys ak ON ak.id = au.api_key_id
  WHERE ak.user_id = p_user_id AND au.usage_date = v_today;

  RETURN json_build_object(
    'claimed_today', v_has_claimed,
    'total_credits', v_claimed,
    'used_credits', v_used,
    'remaining_credits', GREATEST(0, v_claimed - v_used)
  );
END;
$$;

-- Update validate_api_key to support variable credit costs
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
  v_result JSON;
BEGIN
  SELECT * INTO v_key FROM public.api_keys WHERE key_hash = p_key_hash AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'Invalid API key');
  END IF;

  v_daily_limit := v_key.daily_limit;

  INSERT INTO public.api_usage (api_key_id, usage_date, request_count)
  VALUES (v_key.id, CURRENT_DATE, p_credit_cost)
  ON CONFLICT (api_key_id, usage_date)
  DO UPDATE SET request_count = api_usage.request_count + p_credit_cost, updated_at = now()
  RETURNING request_count INTO v_usage;

  UPDATE public.api_keys SET last_used_at = now() WHERE id = v_key.id;

  v_result := json_build_object(
    'valid', true,
    'allowed', v_usage <= v_daily_limit,
    'user_id', v_key.user_id,
    'tier', v_key.tier,
    'current', v_usage,
    'limit', v_daily_limit,
    'remaining', GREATEST(0, v_daily_limit - v_usage),
    'credit_cost', p_credit_cost
  );

  RETURN v_result;
END;
$$;
