-- 创建文章存储表
CREATE TABLE public.articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- 原始微信链接（可选，用于去重和溯源）
  source_url TEXT,
  -- 文章元信息
  title TEXT NOT NULL,
  author TEXT,
  publish_time TEXT,
  -- 文章正文（纯文本，AI友好格式）
  content TEXT NOT NULL,
  -- 原始 HTML（可选，用于后续重新解析）
  raw_html TEXT,
  -- 创建时间
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- 访问统计
  view_count INTEGER NOT NULL DEFAULT 0
);

-- 创建索引加速查询
CREATE INDEX idx_articles_source_url ON public.articles(source_url);
CREATE INDEX idx_articles_created_at ON public.articles(created_at DESC);

-- 启用 RLS（但允许公开读取）
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- 允许任何人读取文章（这是核心功能：让 AI 能访问）
CREATE POLICY "Anyone can read articles"
  ON public.articles
  FOR SELECT
  USING (true);

-- 允许任何人插入文章（匿名用户也可以提交）
CREATE POLICY "Anyone can insert articles"
  ON public.articles
  FOR INSERT
  WITH CHECK (true);

-- 创建更新访问计数的函数
CREATE OR REPLACE FUNCTION public.increment_view_count(article_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.articles
  SET view_count = view_count + 1
  WHERE id = article_id;
END;
$$;