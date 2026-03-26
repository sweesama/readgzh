-- Emergency backend safeguard: block direct public reads of articles.content from REST
-- 1) Remove broad public read from base table
DROP POLICY IF EXISTS "Anyone can read articles" ON public.articles;

-- 2) Expose only lightweight metadata through a public view
CREATE OR REPLACE VIEW public.articles_public
WITH (security_invoker=on) AS
SELECT
  id,
  title,
  author,
  publish_time,
  slug,
  source_url,
  summary,
  view_count,
  created_at
FROM public.articles;

GRANT SELECT ON public.articles_public TO anon, authenticated;

-- 3) Re-open base table only for authenticated/service direct reads so public REST clients cannot request content
CREATE POLICY "Authenticated can read base articles"
ON public.articles
FOR SELECT
TO authenticated
USING (true);

-- 4) Lock writes to service role only (explicit, defensive)
CREATE POLICY "Service role can insert articles"
ON public.articles
FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update articles"
ON public.articles
FOR UPDATE
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can delete articles"
ON public.articles
FOR DELETE
TO public
USING (auth.role() = 'service_role');