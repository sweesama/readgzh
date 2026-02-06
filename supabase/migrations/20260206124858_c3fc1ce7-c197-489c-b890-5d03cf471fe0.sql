-- Remove the dangerously permissive INSERT policy
DROP POLICY "Anyone can insert articles" ON public.articles;

-- Only authenticated users can insert articles directly (backup policy)
-- The edge function uses service_role which bypasses RLS anyway
CREATE POLICY "Service role can insert articles"
  ON public.articles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
