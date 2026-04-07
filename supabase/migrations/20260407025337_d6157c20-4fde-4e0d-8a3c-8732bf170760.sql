
-- Fix the user's bonus credits from 12000 back to 500
UPDATE public.api_keys 
SET bonus_credits = 500 
WHERE id = '79cd5555-3381-46f6-9d38-85de8aaa9da0';

-- Insert the claim record to prevent future duplication
-- We need the actual Stripe session ID; use a placeholder based on the payment
-- First get all sessions for this user - we'll use a deterministic marker
INSERT INTO public.credit_pack_claims (user_id, stripe_session_id, credits_added)
SELECT 'dbc9e7a4-e57f-4e3f-b21b-94ab64b5ef94', 'manual_fix_gaolei_nj_20260405', 500
WHERE NOT EXISTS (
  SELECT 1 FROM public.credit_pack_claims WHERE user_id = 'dbc9e7a4-e57f-4e3f-b21b-94ab64b5ef94'
);
