-- 1. Revoke direct REST access to the articles table.
-- The app (frontend + edge functions) reads articles only through:
--   * RPC list_public_articles / get_public_article_detail (SECURITY DEFINER)
--   * edge functions using the service_role key (bypasses grants)
-- Direct /rest/v1/articles?select=content,... traffic is unwanted scraping
-- and was the top source of DB time / statement timeouts.
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.articles FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.articles FROM authenticated;
GRANT ALL ON public.articles TO service_role;

-- Replace the permissive authenticated SELECT policy with an explicit deny,
-- so even if a future grant is reintroduced by accident, direct reads stay blocked.
DROP POLICY IF EXISTS "Authenticated can read base articles" ON public.articles;
CREATE POLICY "No direct read access to articles"
  ON public.articles FOR SELECT
  USING (false);

-- 2. Speed up the search endpoint (articles-api /search uses ILIKE on title + content).
-- Trigram GIN indexes turn "%needle%" ILIKE into an index scan instead of full table scan.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS articles_title_trgm_idx
  ON public.articles USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS articles_content_trgm_idx
  ON public.articles USING gin (content gin_trgm_ops);
