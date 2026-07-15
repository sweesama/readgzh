
CREATE OR REPLACE FUNCTION public.refund_credits(p_key_hash text, p_amount integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key RECORD;
  v_is_paid BOOLEAN;
  v_account_limit INTEGER;
  v_pre_usage INTEGER;
  v_post_usage INTEGER;
  v_bonus_refund INTEGER;
  v_to_restore INTEGER;
  v_grant RECORD;
  v_restorable INTEGER;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('refunded', 0);
  END IF;

  SELECT * INTO v_key FROM public.api_keys
  WHERE key_hash = p_key_hash AND is_active = true;
  IF NOT FOUND THEN
    RETURN json_build_object('refunded', 0, 'error', 'Invalid API key');
  END IF;

  v_is_paid := v_key.tier IN ('lite','pro','pro_lifetime');

  SELECT COALESCE(MAX(daily_limit), v_key.daily_limit)
  INTO v_account_limit
  FROM public.api_keys
  WHERE user_id = v_key.user_id AND is_active = true;

  -- Usage window matches validate_api_key: monthly for paid, daily for free.
  IF v_is_paid THEN
    SELECT COALESCE(SUM(au.request_count), 0) INTO v_pre_usage
    FROM public.api_usage au
    JOIN public.api_keys ak ON ak.id = au.api_key_id
    WHERE ak.user_id = v_key.user_id
      AND ak.is_active = true
      AND au.usage_date >= date_trunc('month', CURRENT_DATE)::date;
  ELSE
    SELECT COALESCE(SUM(au.request_count), 0) INTO v_pre_usage
    FROM public.api_usage au
    JOIN public.api_keys ak ON ak.id = au.api_key_id
    WHERE ak.user_id = v_key.user_id
      AND ak.is_active = true
      AND au.usage_date = CURRENT_DATE;
  END IF;

  v_post_usage := GREATEST(0, v_pre_usage - p_amount);

  -- Portion of the refund that had been drawn from bonus_grants:
  -- credits above v_account_limit within [v_post_usage, v_pre_usage].
  v_bonus_refund := GREATEST(0, v_pre_usage - GREATEST(v_post_usage, v_account_limit));

  -- Reverse today's counter first (mirrors upfront deduction).
  UPDATE public.api_usage
  SET request_count = GREATEST(0, request_count - p_amount),
      updated_at = now()
  WHERE api_key_id = v_key.id
    AND usage_date = CURRENT_DATE;

  -- Restore bonus grants. validate_api_key consumes them ASC by expires_at,
  -- so we restore DESC (most-recently-consumed first) up to what was refunded.
  v_to_restore := v_bonus_refund;
  IF v_to_restore > 0 THEN
    FOR v_grant IN
      SELECT id, consumed_amount FROM public.bonus_grants
      WHERE user_id = v_key.user_id AND consumed_amount > 0
      ORDER BY expires_at DESC
      FOR UPDATE
    LOOP
      EXIT WHEN v_to_restore <= 0;
      v_restorable := LEAST(v_grant.consumed_amount, v_to_restore);
      UPDATE public.bonus_grants
      SET consumed_amount = consumed_amount - v_restorable
      WHERE id = v_grant.id;
      v_to_restore := v_to_restore - v_restorable;
    END LOOP;
  END IF;

  RETURN json_build_object(
    'refunded', p_amount,
    'bonus_restored', v_bonus_refund - v_to_restore,
    'api_key_id', v_key.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.refund_credits(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credits(text, integer) TO service_role;
