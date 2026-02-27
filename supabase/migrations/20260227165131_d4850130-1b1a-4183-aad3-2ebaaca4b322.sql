-- Drop the overly permissive INSERT policy; service_role bypasses RLS so edge functions still work
DROP POLICY IF EXISTS "Service role can insert articles" ON public.articles;