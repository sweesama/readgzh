
-- Add bonus_expires_at column (NULL = never expires, for legacy users)
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS bonus_expires_at timestamptz DEFAULT NULL;

-- Update validate_api_key to respect bonus expiry
CREATE OR REPLACE FUNCTION public.validate_api_key(p_key_hash text, p_credit_cost integer DEFAULT 1)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_key RECORD;
  v_usage INTEGER;
  v_total_limit INTEGER;
  v_result JSON;
  v_is_paid BOOLEAN;
  v_effective_bonus INTEGER;
BEGIN
  SELECT * INTO v_key FROM public.api_keys WHERE key_hash = p_key_hash AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'Invalid API key');
  END IF;

  v_is_paid := v_key.tier IN ('lite', 'pro', 'pro_lifetime');

  -- Effective bonus: 0 if expired, otherwise full amount
  IF v_key.bonus_credits > 0 AND v_key.bonus_expires_at IS NOT NULL AND v_key.bonus_expires_at < now() THEN
    v_effective_bonus := 0;
    -- Auto-clear expired bonus
    UPDATE public.api_keys SET bonus_credits = 0, bonus_expires_at = NULL WHERE id = v_key.id;
  ELSE
    v_effective_bonus := COALESCE(v_key.bonus_credits, 0);
  END IF;

  -- Record today's usage
  INSERT INTO public.api_usage (api_key_id, usage_date, request_count)
  VALUES (v_key.id, CURRENT_DATE, p_credit_cost)
  ON CONFLICT (api_key_id, usage_date)
  DO UPDATE SET request_count = api_usage.request_count + p_credit_cost, updated_at = now();

  UPDATE public.api_keys SET last_used_at = now() WHERE id = v_key.id;

  -- Calculate total usage: monthly for paid tiers, daily for free
  IF v_is_paid THEN
    SELECT COALESCE(SUM(request_count), 0) INTO v_usage
    FROM public.api_usage
    WHERE api_key_id = v_key.id
      AND usage_date >= date_trunc('month', CURRENT_DATE)::date;
  ELSE
    SELECT COALESCE(request_count, 0) INTO v_usage
    FROM public.api_usage
    WHERE api_key_id = v_key.id AND usage_date = CURRENT_DATE;
    IF NOT FOUND THEN v_usage := 0; END IF;
  END IF;

  v_total_limit := v_key.daily_limit + v_effective_bonus;

  -- If usage exceeds base limit but within bonus range, deduct from bonus
  IF v_usage > v_key.daily_limit AND v_usage <= v_total_limit THEN
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
    'bonus_credits', v_effective_bonus
  );

  RETURN v_result;
END;
$function$;

-- Update get_user_balance to respect bonus expiry
CREATE OR REPLACE FUNCTION public.get_user_balance(p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_claimed INTEGER;
  v_used INTEGER;
  v_today DATE := CURRENT_DATE;
  v_has_claimed BOOLEAN;
  v_is_paid BOOLEAN;
  v_tier TEXT;
  v_daily_limit INTEGER;
  v_bonus INTEGER;
  v_bonus_expires_at TIMESTAMPTZ;
BEGIN
  -- Get tier, daily limit, bonus credits and expiry
  SELECT COALESCE(MAX(tier), 'free'), COALESCE(MAX(daily_limit), 30), 
         COALESCE(SUM(bonus_credits), 0), MAX(bonus_expires_at)
  INTO v_tier, v_daily_limit, v_bonus, v_bonus_expires_at
  FROM public.api_keys
  WHERE user_id = p_user_id AND is_active = true;

  -- Zero out bonus if expired
  IF v_bonus > 0 AND v_bonus_expires_at IS NOT NULL AND v_bonus_expires_at < now() THEN
    UPDATE public.api_keys SET bonus_credits = 0, bonus_expires_at = NULL
    WHERE user_id = p_user_id AND is_active = true AND bonus_expires_at < now();
    v_bonus := 0;
  END IF;

  v_is_paid := v_tier IN ('lite', 'pro', 'pro_lifetime');

  IF v_is_paid THEN
    v_claimed := v_daily_limit;
    v_has_claimed := true;
    SELECT COALESCE(SUM(au.request_count), 0) INTO v_used
    FROM public.api_usage au
    JOIN public.api_keys ak ON ak.id = au.api_key_id
    WHERE ak.user_id = p_user_id 
      AND au.usage_date >= date_trunc('month', CURRENT_DATE)::date;
  ELSE
    SELECT COALESCE(SUM(credits_claimed), 0) INTO v_claimed
    FROM public.daily_credits
    WHERE user_id = p_user_id AND claim_date = v_today;
    v_has_claimed := v_claimed > 0;

    SELECT COALESCE(SUM(au.request_count), 0) INTO v_used
    FROM public.api_usage au
    JOIN public.api_keys ak ON ak.id = au.api_key_id
    WHERE ak.user_id = p_user_id AND au.usage_date = v_today;
  END IF;

  RETURN json_build_object(
    'claimed_today', v_has_claimed,
    'total_credits', v_claimed + v_bonus,
    'used_credits', v_used,
    'remaining_credits', GREATEST(0, v_claimed + v_bonus - v_used),
    'is_pro', v_is_paid,
    'daily_limit', v_daily_limit,
    'bonus_credits', v_bonus,
    'bonus_expires_at', v_bonus_expires_at,
    'tier', v_tier
  );
END;
$function$;
