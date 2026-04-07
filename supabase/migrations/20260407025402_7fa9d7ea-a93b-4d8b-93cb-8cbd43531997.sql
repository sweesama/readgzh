
-- Set to 0 so next check-payment call adds exactly 500 with proper idempotency
UPDATE public.api_keys SET bonus_credits = 0 WHERE id = '79cd5555-3381-46f6-9d38-85de8aaa9da0';
-- Remove the placeholder claim so the real session ID can be recorded
DELETE FROM public.credit_pack_claims WHERE stripe_session_id = 'manual_fix_gaolei_nj_20260405';
