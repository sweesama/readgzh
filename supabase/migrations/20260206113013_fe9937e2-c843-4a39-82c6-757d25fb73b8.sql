-- Add slug column for friendly URLs (extracted from WeChat URL path)
ALTER TABLE public.articles ADD COLUMN slug text UNIQUE;

-- Create index for fast slug lookups
CREATE INDEX idx_articles_slug ON public.articles (slug);

-- Backfill existing articles: extract the short ID from WeChat URLs
-- WeChat URLs look like: https://mp.weixin.qq.com/s/L3Tbd4KMmPnahnStnunTVA
UPDATE public.articles 
SET slug = regexp_replace(source_url, '^.*/(s/[^?#]+).*$', '\1')
WHERE source_url IS NOT NULL AND slug IS NULL;