UPDATE public.articles
SET content = regexp_replace(
      btrim(substring(content from 1 for position('预览时标签不可点' in content) - 1)),
      E'\\n{3,}', E'\n\n', 'g')
WHERE id = 'eab6844e-70f3-4921-9a44-a05b3af0a63a'
  AND position('预览时标签不可点' in content) > 200;