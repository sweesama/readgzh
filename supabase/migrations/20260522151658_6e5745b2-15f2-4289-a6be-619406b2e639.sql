
INSERT INTO public.bonus_grants (user_id, amount, source, source_ref, expires_at, note)
SELECT
  '8f950315-ecf5-439d-9f8f-165fd66369f7'::uuid,
  2000,
  'admin',
  'agg_bug_fix_2026_05',
  now() + INTERVAL '30 days',
  '感谢重度使用，帮助发现多 Key 共享额度 Bug 的一次性补偿'
WHERE NOT EXISTS (
  SELECT 1 FROM public.bonus_grants
  WHERE source = 'admin' AND source_ref = 'agg_bug_fix_2026_05'
);

CREATE OR REPLACE FUNCTION public.validate_api_key(p_key_hash text, p_credit_cost integer DEFAULT 1)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_key RECORD;
  v_usage INTEGER;
  v_account_limit INTEGER;
  v_total_limit INTEGER;
  v_is_paid BOOLEAN;
  v_bonus INTEGER;
  v_to_consume INTEGER;
  v_grant RECORD;
  v_remaining INTEGER;
  v_result JSON;
BEGIN
  SELECT * INTO v_key FROM public.api_keys
  WHERE key_hash = p_key_hash AND is_active = true;
  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'Invalid API key');
  END IF;

  v_is_paid := v_key.tier IN ('lite', 'pro', 'pro_lifetime');

  SELECT COALESCE(MAX(daily_limit), v_key.daily_limit)
  INTO v_account_limit
  FROM public.api_keys
  WHERE user_id = v_key.user_id AND is_active = true;

  SELECT COALESCE(SUM(amount - consumed_amount), 0) INTO v_bonus
  FROM public.bonus_grants
  WHERE user_id = v_key.user_id
    AND expires_at > now()
    AND consumed_amount < amount;

  INSERT INTO public.api_usage (api_key_id, usage_date, request_count)
  VALUES (v_key.id, CURRENT_DATE, p_credit_cost)
  ON CONFLICT (api_key_id, usage_date)
  DO UPDATE SET request_count = api_usage.request_count + p_credit_cost, updated_at = now();

  UPDATE public.api_keys SET last_used_at = now() WHERE id = v_key.id;

  IF v_is_paid THEN
    SELECT COALESCE(SUM(au.request_count), 0) INTO v_usage
    FROM public.api_usage au
    JOIN public.api_keys ak ON ak.id = au.api_key_id
    WHERE ak.user_id = v_key.user_id
      AND ak.is_active = true
      AND au.usage_date >= date_trunc('month', CURRENT_DATE)::date;
  ELSE
    SELECT COALESCE(SUM(au.request_count), 0) INTO v_usage
    FROM public.api_usage au
    JOIN public.api_keys ak ON ak.id = au.api_key_id
    WHERE ak.user_id = v_key.user_id
      AND ak.is_active = true
      AND au.usage_date = CURRENT_DATE;
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

  v_result := json_build_object(
    'valid', true,
    'allowed', v_usage <= v_total_limit,
    'user_id', v_key.user_id,
    'tier', v_key.tier,
    'current', v_usage,
    'limit', v_total_limit,
    'remaining', GREATEST(0, v_total_limit - v_usage),
    'credit_cost', p_credit_cost,
    'bonus_credits', v_bonus
  );
  RETURN v_result;
END;
$function$;
