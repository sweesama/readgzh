
-- Manual subscriptions: for users paying via WeChat/Alipay outside Stripe.
-- Uses tier='pro_lifetime' on api_keys (already protected from Stripe downgrades
-- in check-payment and stripe-webhook) and a separate expiry table + cron.

CREATE TABLE IF NOT EXISTS public.manual_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL,
  daily_limit INTEGER NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  amount_cny INTEGER,
  payment_method TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  expired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.manual_subscriptions TO service_role;
-- No anon/authenticated grants: only edge functions (service role) touch this.

ALTER TABLE public.manual_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only"
  ON public.manual_subscriptions
  FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_manual_subs_active_expiry
  ON public.manual_subscriptions (expires_at)
  WHERE status = 'active';

-- Expiry function: revert api_keys to free when a manual sub expires.
CREATE OR REPLACE FUNCTION public.expire_manual_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_has_other BOOLEAN;
BEGIN
  FOR v_row IN
    SELECT id, user_id FROM public.manual_subscriptions
    WHERE status = 'active' AND expires_at <= now()
  LOOP
    -- Only downgrade if the user has no OTHER still-active manual sub.
    SELECT EXISTS (
      SELECT 1 FROM public.manual_subscriptions
      WHERE user_id = v_row.user_id
        AND id <> v_row.id
        AND status = 'active'
        AND expires_at > now()
    ) INTO v_has_other;

    IF NOT v_has_other THEN
      UPDATE public.api_keys
      SET tier = 'free', daily_limit = 30
      WHERE user_id = v_row.user_id
        AND is_active = true
        AND tier = 'pro_lifetime';
    END IF;

    UPDATE public.manual_subscriptions
    SET status = 'expired', expired_at = now(), updated_at = now()
    WHERE id = v_row.id;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_manual_subscriptions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_manual_subscriptions() TO service_role;

-- Daily cron at 03:00 UTC
DO $$
BEGIN
  PERFORM cron.unschedule('expire-manual-subscriptions');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'expire-manual-subscriptions',
  '0 3 * * *',
  $cron$ SELECT public.expire_manual_subscriptions(); $cron$
);
