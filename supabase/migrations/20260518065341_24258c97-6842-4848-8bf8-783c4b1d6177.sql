CREATE TABLE public.refund_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  stripe_charge_id TEXT NOT NULL,
  stripe_payment_intent_id TEXT,
  stripe_refund_id TEXT NOT NULL UNIQUE,
  stripe_subscription_id TEXT,
  amount_refunded INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'cny',
  original_amount INTEGER NOT NULL,
  refund_type TEXT NOT NULL DEFAULT 'self_service',
  reason TEXT,
  formula_breakdown JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_refund_records_user_id ON public.refund_records(user_id);
CREATE INDEX idx_refund_records_created_at ON public.refund_records(created_at);

ALTER TABLE public.refund_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own refund records"
ON public.refund_records FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Service role full access refund records"
ON public.refund_records FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');