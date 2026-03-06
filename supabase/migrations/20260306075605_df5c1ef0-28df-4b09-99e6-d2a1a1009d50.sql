-- Add bonus_credits column to api_keys to track purchased credit packs
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS bonus_credits integer NOT NULL DEFAULT 0;

-- Update get_user_balance to handle Pro users automatically (no manual claiming needed)
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
  v_is_pro BOOLEAN;
  v_daily_limit INTEGER;
  v_bonus INTEGER;
BEGIN
  -- Check if user is Pro (has any active pro-tier key)
  SELECT EXISTS(
    SELECT 1 FROM public.api_keys
    WHERE user_id = p_user_id AND is_active = true AND tier = 'pro'
  ) INTO v_is_pro;

  -- Get daily limit and bonus credits
  SELECT COALESCE(MAX(daily_limit), 50), COALESCE(SUM(bonus_credits), 0)
  INTO v_daily_limit, v_bonus
  FROM public.api_keys
  WHERE user_id = p_user_id AND is_active = true;

  -- For Pro users, auto-set credits to daily_limit (no manual claiming needed)
  IF v_is_pro THEN
    v_claimed := v_daily_limit;
    v_has_claimed := true;
  ELSE
    -- Check if free user claimed today
    SELECT COALESCE(SUM(credits_claimed), 0) INTO v_claimed
    FROM public.daily_credits
    WHERE user_id = p_user_id AND claim_date = v_today;
    v_has_claimed := v_claimed > 0;
  END IF;

  -- Get today's total usage across all keys
  SELECT COALESCE(SUM(au.request_count), 0) INTO v_used
  FROM public.api_usage au
  JOIN public.api_keys ak ON ak.id = au.api_key_id
  WHERE ak.user_id = p_user_id AND au.usage_date = v_today;

  RETURN json_build_object(
    'claimed_today', v_has_claimed,
    'total_credits', v_claimed + v_bonus,
    'used_credits', v_used,
    'remaining_credits', GREATEST(0, v_claimed + v_bonus - v_used),
    'is_pro', v_is_pro,
    'daily_limit', v_daily_limit,
    'bonus_credits', v_bonus
  );
END;
$$;