
-- ============================================
-- Security hardening batch
-- ============================================

-- 1. comment_votes: restrict SELECT to authenticated, fix permissive INSERT/DELETE
DROP POLICY IF EXISTS "Anyone can read votes" ON public.comment_votes;
DROP POLICY IF EXISTS "Anyone can delete own votes" ON public.comment_votes;
DROP POLICY IF EXISTS "Anyone can insert votes" ON public.comment_votes;

CREATE POLICY "Authenticated can read votes"
  ON public.comment_votes FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users can insert own votes"
  ON public.comment_votes FOR INSERT
  TO authenticated WITH CHECK (voter_id = auth.uid()::text);

CREATE POLICY "Users can delete own votes"
  ON public.comment_votes FOR DELETE
  TO authenticated USING (voter_id = auth.uid()::text);

-- 2. comments: hide user_id for anonymous comments
ALTER TABLE public.comments ALTER COLUMN user_id DROP NOT NULL;
UPDATE public.comments SET user_id = NULL WHERE is_anonymous = true;

CREATE OR REPLACE FUNCTION public.scrub_anon_comment_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_anonymous = true THEN
    NEW.user_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scrub_anon_comment_user_id_trg ON public.comments;
CREATE TRIGGER scrub_anon_comment_user_id_trg
BEFORE INSERT OR UPDATE ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.scrub_anon_comment_user_id();

-- Update INSERT policy to allow anonymous (user_id will be nulled by trigger)
DROP POLICY IF EXISTS "Authenticated users can insert comments" ON public.comments;
CREATE POLICY "Authenticated users can insert comments"
  ON public.comments FOR INSERT
  TO authenticated
  WITH CHECK (
    (is_anonymous = true AND auth.uid() IS NOT NULL)
    OR (is_anonymous = false AND auth.uid() = user_id)
  );

-- 3. rate_limits: add explicit service-role-only policy
DROP POLICY IF EXISTS "Service role manages rate_limits" ON public.rate_limits;
CREATE POLICY "Service role manages rate_limits"
  ON public.rate_limits FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 4. storage.objects: allow public READ on email-assets, block writes
DROP POLICY IF EXISTS "Public read email-assets" ON storage.objects;
CREATE POLICY "Public read email-assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'email-assets');
-- No INSERT/UPDATE/DELETE policies → only service_role (which bypasses RLS) can write
