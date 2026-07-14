
CREATE OR REPLACE FUNCTION public.refund_credits(p_key_hash text, p_amount integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key RECORD;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('refunded', 0);
  END IF;

  SELECT * INTO v_key FROM public.api_keys
  WHERE key_hash = p_key_hash AND is_active = true;
  IF NOT FOUND THEN
    RETURN json_build_object('refunded', 0, 'error', 'Invalid API key');
  END IF;

  -- Reverse today's usage counter for this key
  UPDATE public.api_usage
  SET request_count = GREATEST(0, request_count - p_amount),
      updated_at = now()
  WHERE api_key_id = v_key.id
    AND usage_date = CURRENT_DATE;

  RETURN json_build_object('refunded', p_amount, 'api_key_id', v_key.id);
END;
$$;

REVOKE ALL ON FUNCTION public.refund_credits(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_credits(text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.refund_credits(text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credits(text, integer) TO service_role;
