CREATE TABLE public.referral_codes (
  user_id UUID PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_referral_codes_code ON public.referral_codes(code);
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own referral code" ON public.referral_codes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage referral codes" ON public.referral_codes FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL,
  invitee_id UUID NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','qualified','rewarded','invalid')),
  signup_ip TEXT,
  signup_user_agent TEXT,
  invalid_reason TEXT,
  qualified_at TIMESTAMPTZ,
  rewarded_at TIMESTAMPTZ,
  reward_amount INTEGER,
  invitee_bonus_amount INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (inviter_id <> invitee_id)
);
CREATE INDEX idx_referrals_inviter ON public.referrals(inviter_id);
CREATE INDEX idx_referrals_status ON public.referrals(status);
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own referrals as inviter" ON public.referrals FOR SELECT TO authenticated USING (auth.uid() = inviter_id);
CREATE POLICY "Service role can manage referrals" ON public.referrals FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE TABLE public.bonus_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  consumed_amount INTEGER NOT NULL DEFAULT 0 CHECK (consumed_amount >= 0),
  source TEXT NOT NULL CHECK (source IN ('referral','referral_welcome','credit_pack','admin','migration')),
  source_ref TEXT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  note TEXT,
  CHECK (consumed_amount <= amount)
);
CREATE INDEX idx_bonus_grants_user_active ON public.bonus_grants(user_id, expires_at) WHERE consumed_amount < amount;
CREATE UNIQUE INDEX idx_bonus_grants_unique_source ON public.bonus_grants(source, source_ref) WHERE source_ref IS NOT NULL;
ALTER TABLE public.bonus_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own bonus grants" ON public.bonus_grants FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage bonus grants" ON public.bonus_grants FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

INSERT INTO public.bonus_grants (user_id, amount, source, source_ref, granted_at, expires_at, note)
SELECT user_id, bonus_credits, 'migration', 'api_key_' || id::text,
  COALESCE(created_at, now() - INTERVAL '1 day'),
  COALESCE(bonus_expires_at, now() + INTERVAL '60 days'),
  '从 api_keys.bonus_credits 一次性迁移'
FROM public.api_keys WHERE bonus_credits > 0 AND is_active = true;

CREATE OR REPLACE FUNCTION public.generate_referral_code(p_user_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code TEXT;
  v_chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_existing TEXT;
  v_attempts INT := 0;
BEGIN
  SELECT code INTO v_existing FROM public.referral_codes WHERE user_id = p_user_id;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  LOOP
    v_code := '';
    FOR i IN 1..8 LOOP
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    END LOOP;
    BEGIN
      INSERT INTO public.referral_codes (user_id, code) VALUES (p_user_id, v_code);
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      v_attempts := v_attempts + 1;
      IF v_attempts > 10 THEN RAISE EXCEPTION 'Failed to generate unique code'; END IF;
    END;
  END LOOP;
END;
$$;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT p.id FROM public.profiles p
           LEFT JOIN public.referral_codes rc ON rc.user_id = p.id
           WHERE rc.user_id IS NULL
  LOOP
    PERFORM public.generate_referral_code(r.id);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_user_balance(p_user_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
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
    WHERE ak.user_id = p_user_id AND au.usage_date >= date_trunc('month', CURRENT_DATE)::date;
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
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_key RECORD; v_usage INTEGER; v_total_limit INTEGER; v_result JSON;
  v_is_paid BOOLEAN; v_bonus INTEGER; v_to_consume INTEGER;
  v_grant RECORD; v_remaining INTEGER;
BEGIN
  SELECT * INTO v_key FROM public.api_keys WHERE key_hash = p_key_hash AND is_active = true;
  IF NOT FOUND THEN RETURN json_build_object('valid', false, 'error', 'Invalid API key'); END IF;
  v_is_paid := v_key.tier IN ('lite', 'pro', 'pro_lifetime');

  SELECT COALESCE(SUM(amount - consumed_amount), 0) INTO v_bonus
  FROM public.bonus_grants
  WHERE user_id = v_key.user_id AND expires_at > now() AND consumed_amount < amount;

  INSERT INTO public.api_usage (api_key_id, usage_date, request_count)
  VALUES (v_key.id, CURRENT_DATE, p_credit_cost)
  ON CONFLICT (api_key_id, usage_date)
  DO UPDATE SET request_count = api_usage.request_count + p_credit_cost, updated_at = now();

  UPDATE public.api_keys SET last_used_at = now() WHERE id = v_key.id;

  IF v_is_paid THEN
    SELECT COALESCE(SUM(request_count), 0) INTO v_usage
    FROM public.api_usage WHERE api_key_id = v_key.id
      AND usage_date >= date_trunc('month', CURRENT_DATE)::date;
  ELSE
    SELECT COALESCE(request_count, 0) INTO v_usage
    FROM public.api_usage WHERE api_key_id = v_key.id AND usage_date = CURRENT_DATE;
    IF NOT FOUND THEN v_usage := 0; END IF;
  END IF;

  v_total_limit := v_key.daily_limit + v_bonus;

  IF v_usage > v_key.daily_limit AND v_usage <= v_total_limit THEN
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

CREATE OR REPLACE FUNCTION public.issue_referral_reward(p_invitee_id UUID)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ref RECORD; v_rewarded_count INT; v_reward INT; v_welcome INT := 30;
BEGIN
  SELECT * INTO v_ref FROM public.referrals
  WHERE invitee_id = p_invitee_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('triggered', false, 'reason', 'no_pending_referral'); END IF;

  SELECT COUNT(*) INTO v_rewarded_count FROM public.referrals
  WHERE inviter_id = v_ref.inviter_id AND status = 'rewarded';

  IF v_rewarded_count >= 20 THEN
    UPDATE public.referrals SET status = 'invalid', invalid_reason = 'inviter_cap_reached' WHERE id = v_ref.id;
    RETURN jsonb_build_object('triggered', false, 'reason', 'cap_reached');
  END IF;

  v_reward := CASE
    WHEN v_rewarded_count < 3  THEN 30
    WHEN v_rewarded_count < 8  THEN 60
    WHEN v_rewarded_count < 15 THEN 90
    ELSE 120
  END;

  INSERT INTO public.bonus_grants (user_id, amount, source, source_ref, expires_at, note)
  VALUES (v_ref.inviter_id, v_reward, 'referral', v_ref.id::text,
    now() + INTERVAL '60 days', '邀请第 ' || (v_rewarded_count + 1) || ' 位好友');

  INSERT INTO public.bonus_grants (user_id, amount, source, source_ref, expires_at, note)
  VALUES (v_ref.invitee_id, v_welcome, 'referral_welcome', v_ref.id::text,
    now() + INTERVAL '60 days', '受邀注册首读奖励');

  UPDATE public.referrals SET status = 'rewarded',
    qualified_at = COALESCE(qualified_at, now()),
    rewarded_at = now(), reward_amount = v_reward, invitee_bonus_amount = v_welcome
  WHERE id = v_ref.id;

  RETURN jsonb_build_object('triggered', true, 'inviter_id', v_ref.inviter_id,
    'reward', v_reward, 'invitee_welcome', v_welcome, 'tier_position', v_rewarded_count + 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_referral(
  p_code TEXT, p_invitee_id UUID, p_signup_ip TEXT, p_signup_ua TEXT, p_invitee_email TEXT
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inviter_id UUID; v_inviter_email TEXT; v_inviter_count INT; v_existing UUID;
BEGIN
  SELECT user_id INTO v_inviter_id FROM public.referral_codes WHERE code = upper(p_code);
  IF v_inviter_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code'); END IF;
  IF v_inviter_id = p_invitee_id THEN RETURN jsonb_build_object('ok', false, 'reason', 'self_invite'); END IF;

  SELECT email INTO v_inviter_email FROM public.profiles WHERE id = v_inviter_id;
  IF v_inviter_email IS NOT NULL AND lower(v_inviter_email) = lower(COALESCE(p_invitee_email, '')) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'same_email');
  END IF;

  SELECT id INTO v_existing FROM public.referrals WHERE invitee_id = p_invitee_id;
  IF v_existing IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'already_invited'); END IF;

  SELECT COUNT(*) INTO v_inviter_count FROM public.referrals
  WHERE inviter_id = v_inviter_id AND status IN ('pending','qualified','rewarded');
  IF v_inviter_count >= 20 THEN RETURN jsonb_build_object('ok', false, 'reason', 'inviter_cap'); END IF;

  INSERT INTO public.referrals (inviter_id, invitee_id, status, signup_ip, signup_user_agent)
  VALUES (v_inviter_id, p_invitee_id, 'pending', p_signup_ip, p_signup_ua);
  RETURN jsonb_build_object('ok', true, 'inviter_id', v_inviter_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url');
  BEGIN PERFORM public.generate_referral_code(NEW.id);
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_referral_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_code TEXT; v_rewarded INT; v_pending INT;
        v_total_earned INT; v_list jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'unauthorized'); END IF;
  SELECT code INTO v_code FROM public.referral_codes WHERE user_id = v_uid;

  SELECT COUNT(*) FILTER (WHERE status = 'rewarded'),
         COUNT(*) FILTER (WHERE status IN ('pending','qualified')),
         COALESCE(SUM(reward_amount) FILTER (WHERE status = 'rewarded'), 0)
  INTO v_rewarded, v_pending, v_total_earned
  FROM public.referrals WHERE inviter_id = v_uid;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'masked_email',
      CASE WHEN p.email IS NULL THEN '匿名用户'
           ELSE substr(p.email, 1, 2) || '***@' || split_part(p.email, '@', 2) END,
    'status', r.status, 'reward', r.reward_amount,
    'created_at', r.created_at, 'rewarded_at', r.rewarded_at
  ) ORDER BY r.created_at DESC), '[]'::jsonb) INTO v_list
  FROM public.referrals r LEFT JOIN public.profiles p ON p.id = r.invitee_id
  WHERE r.inviter_id = v_uid;

  RETURN jsonb_build_object(
    'code', v_code,
    'rewarded_count', v_rewarded,
    'pending_count', v_pending,
    'total_earned', v_total_earned,
    'cap', 20,
    'next_tier_reward', CASE
      WHEN v_rewarded < 3  THEN 30
      WHEN v_rewarded < 8  THEN 60
      WHEN v_rewarded < 15 THEN 90
      WHEN v_rewarded < 20 THEN 120
      ELSE NULL END,
    'referrals', v_list
  );
END;
$$;