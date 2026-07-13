
REVOKE EXECUTE ON FUNCTION public.get_anon_request_breakdown(date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_total_anon_requests(date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_api_usage_stats(date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_token_stats() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_total_views() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_anon_request_breakdown(date) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_total_anon_requests(date) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_api_usage_stats(date) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_token_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_total_views() TO service_role;

REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_user_balance(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_balance(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.validate_api_key(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_api_key(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_api_key(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_api_key(text, integer) TO service_role;
