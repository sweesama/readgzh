ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS paid_since timestamptz;

CREATE OR REPLACE FUNCTION public.set_api_key_paid_since()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.tier IN ('lite','pro','pro_lifetime') AND COALESCE(OLD.tier,'free') = 'free' THEN
    NEW.paid_since := now();
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS api_keys_paid_since_trg ON public.api_keys;
CREATE TRIGGER api_keys_paid_since_trg BEFORE UPDATE OF tier ON public.api_keys
FOR EACH ROW EXECUTE FUNCTION public.set_api_key_paid_since();

-- Start of the current paid usage window: month start, but never before the user became paid.
CREATE OR REPLACE FUNCTION public.paid_window_start(p_user_id uuid)
RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT GREATEST(date_trunc('month', CURRENT_DATE)::date,
                  (SELECT MAX(paid_since)::date FROM public.api_keys WHERE user_id = p_user_id AND is_active = true));
$$;
REVOKE ALL ON FUNCTION public.paid_window_start(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_user_balance(p_user_id uuid)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_claimed INTEGER; v_used INTEGER; v_today DATE := CURRENT_DATE;
  v_has_claimed BOOLEAN; v_is_paid BOOLEAN; v_tier TEXT;
  v_daily_limit INTEGER; v_bonus INTEGER; v_bonus_expires_at TIMESTAMPTZ;
BEGIN
  SELECT COALESCE(MAX(tier), 'free'), COALESCE(MAX(daily_limit), 30)
  INTO v_tier, v_daily_limit
  FROM public.api_keys WHERE user_id = p_user_id AND is_active = true;

  SELECT COALESCE(SUM(amount - consumed_amount), 0),
         MIN(expires_at) FILTER (WHERE amount > consumed_amount)
  INTO v_bonus, v_bonus_expires_at
  FROM public.bonus_grants
  WHERE user_id = p_user_id AND expires_at > now() AND consumed_amount < amount;

  v_is_paid := v_tier IN ('lite', 'pro', 'pro_lifetime');

  IF v_is_paid THEN
    v_claimed := v_daily_limit; v_has_claimed := true;
    SELECT COALESCE(SUM(au.request_count), 0) INTO v_used
    FROM public.api_usage au JOIN public.api_keys ak ON ak.id = au.api_key_id
    WHERE ak.user_id = p_user_id AND au.usage_date >= public.paid_window_start(p_user_id);
  ELSE
    SELECT COALESCE(SUM(credits_claimed), 0) INTO v_claimed
    FROM public.daily_credits WHERE user_id = p_user_id AND claim_date = v_today;
    v_has_claimed := v_claimed > 0;
    SELECT COALESCE(SUM(au.request_count), 0) INTO v_used
    FROM public.api_usage au JOIN public.api_keys ak ON ak.id = au.api_key_id
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

CREATE OR REPLACE FUNCTION public.validate_api_key(p_key_hash text, p_credit_cost integer DEFAULT 1)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_key RECORD; v_usage INTEGER; v_account_limit INTEGER; v_total_limit INTEGER;
  v_is_paid BOOLEAN; v_bonus INTEGER; v_to_consume INTEGER; v_grant RECORD; v_remaining INTEGER;
BEGIN
  SELECT * INTO v_key FROM public.api_keys WHERE key_hash = p_key_hash AND is_active = true;
  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'Invalid API key');
  END IF;

  v_is_paid := v_key.tier IN ('lite', 'pro', 'pro_lifetime');

  SELECT COALESCE(MAX(daily_limit), v_key.daily_limit) INTO v_account_limit
  FROM public.api_keys WHERE user_id = v_key.user_id AND is_active = true;

  SELECT COALESCE(SUM(amount - consumed_amount), 0) INTO v_bonus
  FROM public.bonus_grants
  WHERE user_id = v_key.user_id AND expires_at > now() AND consumed_amount < amount;

  INSERT INTO public.api_usage (api_key_id, usage_date, request_count)
  VALUES (v_key.id, CURRENT_DATE, p_credit_cost)
  ON CONFLICT (api_key_id, usage_date)
  DO UPDATE SET request_count = api_usage.request_count + p_credit_cost, updated_at = now();

  UPDATE public.api_keys SET last_used_at = now() WHERE id = v_key.id;

  IF v_is_paid THEN
    SELECT COALESCE(SUM(au.request_count), 0) INTO v_usage
    FROM public.api_usage au JOIN public.api_keys ak ON ak.id = au.api_key_id
    WHERE ak.user_id = v_key.user_id AND ak.is_active = true
      AND au.usage_date >= public.paid_window_start(v_key.user_id);
  ELSE
    SELECT COALESCE(SUM(au.request_count), 0) INTO v_usage
    FROM public.api_usage au JOIN public.api_keys ak ON ak.id = au.api_key_id
    WHERE ak.user_id = v_key.user_id AND ak.is_active = true AND au.usage_date = CURRENT_DATE;
  END IF;

  v_total_limit := v_account_limit + v_bonus;

  IF v_usage > v_account_limit AND v_usage <= v_total_limit THEN
    v_to_consume := p_credit_cost;
    FOR v_grant IN
      SELECT id, amount, consumed_amount FROM public.bonus_grants
      WHERE user_id = v_key.user_id AND expires_at > now() AND consumed_amount < amount
      ORDER BY expires_at ASC FOR UPDATE
    LOOP
      EXIT WHEN v_to_consume <= 0;
      v_remaining := v_grant.amount - v_grant.consumed_amount;
      IF v_remaining >= v_to_consume THEN
        UPDATE public.bonus_grants SET consumed_amount = consumed_amount + v_to_consume WHERE id = v_grant.id;
        v_to_consume := 0;
      ELSE
        UPDATE public.bonus_grants SET consumed_amount = amount WHERE id = v_grant.id;
        v_to_consume := v_to_consume - v_remaining;
      END IF;
    END LOOP;
  END IF;

  RETURN json_build_object(
    'valid', true, 'allowed', v_usage <= v_total_limit, 'user_id', v_key.user_id,
    'tier', v_key.tier, 'current', v_usage, 'limit', v_total_limit,
    'remaining', GREATEST(0, v_total_limit - v_usage),
    'credit_cost', p_credit_cost, 'bonus_credits', v_bonus
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.refund_credits(p_key_hash text, p_amount integer)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_key RECORD; v_is_paid BOOLEAN; v_account_limit INTEGER; v_pre_usage INTEGER;
  v_post_usage INTEGER; v_bonus_refund INTEGER; v_to_restore INTEGER; v_grant RECORD; v_restorable INTEGER;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('refunded', 0);
  END IF;
  SELECT * INTO v_key FROM public.api_keys WHERE key_hash = p_key_hash AND is_active = true;
  IF NOT FOUND THEN
    RETURN json_build_object('refunded', 0, 'error', 'Invalid API key');
  END IF;
  v_is_paid := v_key.tier IN ('lite','pro','pro_lifetime');
  SELECT COALESCE(MAX(daily_limit), v_key.daily_limit) INTO v_account_limit
  FROM public.api_keys WHERE user_id = v_key.user_id AND is_active = true;

  IF v_is_paid THEN
    SELECT COALESCE(SUM(au.request_count), 0) INTO v_pre_usage
    FROM public.api_usage au JOIN public.api_keys ak ON ak.id = au.api_key_id
    WHERE ak.user_id = v_key.user_id AND ak.is_active = true
      AND au.usage_date >= public.paid_window_start(v_key.user_id);
  ELSE
    SELECT COALESCE(SUM(au.request_count), 0) INTO v_pre_usage
    FROM public.api_usage au JOIN public.api_keys ak ON ak.id = au.api_key_id
    WHERE ak.user_id = v_key.user_id AND ak.is_active = true AND au.usage_date = CURRENT_DATE;
  END IF;

  v_post_usage := GREATEST(0, v_pre_usage - p_amount);
  v_bonus_refund := GREATEST(0, v_pre_usage - GREATEST(v_post_usage, v_account_limit));

  UPDATE public.api_usage SET request_count = GREATEST(0, request_count - p_amount), updated_at = now()
  WHERE api_key_id = v_key.id AND usage_date = CURRENT_DATE;

  v_to_restore := v_bonus_refund;
  IF v_to_restore > 0 THEN
    FOR v_grant IN
      SELECT id, consumed_amount FROM public.bonus_grants
      WHERE user_id = v_key.user_id AND consumed_amount > 0
      ORDER BY expires_at DESC FOR UPDATE
    LOOP
      EXIT WHEN v_to_restore <= 0;
      v_restorable := LEAST(v_grant.consumed_amount, v_to_restore);
      UPDATE public.bonus_grants SET consumed_amount = consumed_amount - v_restorable WHERE id = v_grant.id;
      v_to_restore := v_to_restore - v_restorable;
    END LOOP;
  END IF;

  RETURN json_build_object('refunded', p_amount, 'bonus_restored', v_bonus_refund - v_to_restore, 'api_key_id', v_key.id);
END;
$function$;

CREATE TABLE public.comp_grants (
  token text PRIMARY KEY,
  email text NOT NULL,
  days integer NOT NULL DEFAULT 30,
  note text,
  claimed_at timestamptz,
  claimed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.comp_grants TO service_role;
ALTER TABLE public.comp_grants ENABLE ROW LEVEL SECURITY;