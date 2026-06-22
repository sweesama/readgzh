import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Copy, ExternalLink, CheckCircle, Share2, Eye, Bot } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import DOMPurify from "dompurify";
import SEO from "@/components/SEO";

const API_BASE = "https://api.readgzh.site";
const IMAGE_PROXY_BASE = `${API_BASE}/image-proxy`;

interface Article {
  id: string;
  title: string;
  author: string | null;
  content: string;
  raw_html: string | null;
  source_url: string | null;
  publish_time: string | null;
  created_at: string;
  view_count: number;
  slug: string | null;
}

type PublicArticleDetail = Article | null;

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function proxyWechatImages(html: string): string {
  const proxyBase = `${IMAGE_PROXY_BASE}?url=`;
  return html.replace(
    /src="(https?:\/\/mmbiz\.qpic\.cn[^"]*)"/g,
    (_, url) => `src="${proxyBase}${encodeURIComponent(decodeHtmlEntities(url))}"`
  );
}

function replaceVideoIframes(html: string, sourceUrl?: string | null): string {
  const proxyBase = `${IMAGE_PROXY_BASE}?url=`;
  let result = html.replace(
    /<iframe[^>]*class="video_iframe[^"]*"[^>]*>/gi,
    (match) => {
      const coverMatch = match.match(/data-cover="([^"]*)"/);
      const coverUrl = coverMatch ? decodeHtmlEntities(coverMatch[1]) : null;
      const proxiedCover = coverUrl ? `${proxyBase}${encodeURIComponent(coverUrl)}` : null;
      const linkUrl = sourceUrl || "#";

      if (proxiedCover) {
        return `<div style="border:1px solid hsl(var(--border));border-radius:12px;overflow:hidden;margin:16px 0;">` +
          `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer" style="display:block;text-decoration:none;color:inherit;">` +
          `<div style="position:relative;background:#000;aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;">` +
          `<img src="${proxiedCover}" style="width:100%;height:100%;object-fit:cover;opacity:0.85;" alt="视频封面"/>` +
          `<span style="position:absolute;font-size:3em;text-shadow:0 2px 8px rgba(0,0,0,0.5);">▶️</span>` +
          `</div>` +
          `<div style="padding:10px 16px;background:hsl(var(--muted));">` +
          `<span style="font-size:0.85em;color:hsl(var(--muted-foreground));">点击查看原文播放视频</span>` +
          `</div>` +
          `</a></div>`;
      }
      return `<div style="margin:12px 0;padding:10px 16px;border:1px solid hsl(var(--border));border-radius:8px;background:hsl(var(--muted));display:flex;align-items:center;gap:8px;">` +
        `<span style="font-size:1.2em;">📹</span>` +
        `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer" style="color:hsl(var(--primary));text-decoration:none;font-size:0.9em;">点击查看原文播放视频 →</a>` +
        `</div>`;
    }
  );
  result = result.replace(/<\/iframe>/gi, "");
  result = result.replace(/<iframe[\s\S]*?<\/iframe>/gi, "");
  return result;
}

function sanitizeHtml(html: string, sourceUrl?: string | null): string {
  // Pre-process: convert data-src to src, replace video iframes, proxy images
  let processed = html.replace(/data-src="([^"]+)"/g, 'src="$1"');
  processed = processed.replace(/visibility:\s*hidden[^;]*;?/g, "");
  processed = processed.replace(/opacity:\s*0[^;]*;?/g, "");
  processed = replaceVideoIframes(processed, sourceUrl);
  processed = proxyWechatImages(processed);

  // Use DOMPurify for robust sanitization
  return DOMPurify.sanitize(processed, {
    ADD_TAGS: ['section', 'figure', 'figcaption'],
    ADD_ATTR: ['target', 'rel'],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'noscript', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  });
}

/** Strip all styles/classes/data-attrs and empty tags — mimic AI SSR view */
function stripToAIView(html: string): string {
  // Pre-process: convert data-src to src
  let stripped = html.replace(/data-src="([^"]+)"/g, 'src="$1"');
  
  // Use DOMPurify to strip all dangerous content first
  stripped = DOMPurify.sanitize(stripped, {
    ADD_TAGS: ['section', 'figure', 'figcaption'],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'noscript', 'iframe', 'object', 'embed', 'form'],
  });

  // Remove all attributes: style, class, id (for clean AI view)
  stripped = stripped.replace(/\s*style="[^"]*"/gi, "");
  stripped = stripped.replace(/\s*class="[^"]*"/gi, "");
  stripped = stripped.replace(/\s*id="[^"]*"/gi, "");
  // Remove WeChat custom tags
  stripped = stripped.replace(/<mp-[\w-]+[^>]*>[\s\S]*?<\/mp-[\w-]+>/gi, "");
  // <br> → newline, &nbsp; → space
  stripped = stripped.replace(/<br\s*\/?>/gi, "\n");
  stripped = stripped.replace(/&nbsp;/gi, " ");
  // Remove empty tags (multi-pass)
  for (let i = 0; i < 3; i++) {
    stripped = stripped.replace(/<(div|span|section|p)>\s*<\/\1>/gi, "");
  }
  // Collapse whitespace
  stripped = stripped.replace(/\n{3,}/g, "\n\n");
  // Proxy images
  stripped = proxyWechatImages(stripped);
  return stripped.trim();
}

const ArticlePage = () => {
  const { id, slug } = useParams<{ id?: string; slug?: string }>();

  const [article, setArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [aiView, setAiView] = useState(false);

  useEffect(() => {
    if (!id && !slug) {
      setError("未找到文章");
      setIsLoading(false);
      return;
    }

    const fetchArticle = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase.rpc("get_public_article_detail", {
          p_slug: slug ?? null,
          p_article_id: id ?? null,
        });

        if (fetchError) {
          if (fetchError.code === "PGRST116") throw new Error("文章不存在或已被删除");
          throw fetchError;
        }

        const articleData = data as unknown as PublicArticleDetail;

        if (!articleData) {
          throw new Error("文章不存在或已被删除");
        }

        setArticle(articleData);
        supabase.rpc("increment_view_count", { article_id: articleData.id }).then(({ error }) => {
          if (error) console.error("Failed to increment view count:", error);
        });
      } catch (err) {
        console.error("Error fetching article:", err);
        setError(err instanceof Error ? err.message : "获取文章失败");
      } finally {
        setIsLoading(false);
      }
    };

    fetchArticle();
  }, [id, slug]);

  const sanitizedHtml = useMemo(() => {
    if (!article?.raw_html) return null;
    return sanitizeHtml(article.raw_html, article.source_url);
  }, [article?.raw_html, article?.source_url]);

  const aiHtml = useMemo(() => {
    if (!article?.raw_html) return null;
    return stripToAIView(article.raw_html);
  }, [article?.raw_html]);

  const handleCopyContent = async () => {
    if (!article) return;
    const textToCopy = `# ${article.title}\n\n作者：${article.author || "未知"}\n${article.publish_time ? `发布时间：${article.publish_time}\n` : ""}\n---\n\n${article.content}\n\n---\n${article.source_url ? `原文链接：${article.source_url}` : ""}`;
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast({ title: "已复制", description: "文章内容已复制到剪贴板" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = async () => {
    const slugId = article?.slug?.replace(/^s\//, "") || "";
    const shareUrl = slugId
      ? `${API_BASE}/rd?s=${slugId}`
      : `${API_BASE}/rd?id=${article?.id}`;
    await navigator.clipboard.writeText(shareUrl);
    setLinkCopied(true);
    toast({ title: "链接已复制", description: "发送给 ChatGPT、Claude 等 AI 即可直接阅读此文章" });
    setTimeout(() => setLinkCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <Skeleton className="h-8 w-32 mb-8" />
          <div className="bg-card rounded-2xl border p-6 md:p-10 space-y-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="container mx-auto px-4 max-w-lg text-center">
          <div className="bg-card rounded-2xl border border-destructive p-8">
            <div className="text-destructive text-lg font-medium mb-2">获取失败</div>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Link to="/">
              <Button><ArrowLeft className="mr-2 h-4 w-4" />返回首页</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!article) return null;

  const articlePath = article.slug ? `/s/${article.slug.replace(/^s\//, "")}` : `/a/${article.id}`;
  const articleDesc = (article.content || "").replace(/\s+/g, " ").trim().slice(0, 155);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`${article.title.slice(0, 55)} | ReadGZH`}
        description={articleDesc || `${article.title} - 由 ReadGZH 转换的 AI 可读微信公众号文章`}
        path={articlePath}
        ogType="article"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: article.title,
          author: { "@type": "Person", name: article.author || "未知作者" },
          datePublished: article.publish_time || article.created_at,
          dateModified: article.created_at,
          mainEntityOfPage: `https://readgzh.site${articlePath}`,
          publisher: {
            "@type": "Organization",
            name: "ReadGZH",
            url: "https://readgzh.site",
          },
        }}
      />
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-3 max-w-3xl flex items-center justify-between">
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />返回
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setAiView(!aiView)}
              size="sm"
              variant={aiView ? "default" : "outline"}
              className="gap-1.5"
            >
              {aiView ? <><Eye className="h-4 w-4" />人类视角</> : <><Bot className="h-4 w-4" />AI 视角</>}
            </Button>
            <Button onClick={handleCopyContent} size="sm" variant="ghost">
              {copied ? <><CheckCircle className="mr-2 h-4 w-4" />已复制</> : <><Copy className="mr-2 h-4 w-4" />复制内容</>}
            </Button>
            <Button onClick={handleCopyLink} size="sm">
              {linkCopied ? <><CheckCircle className="mr-2 h-4 w-4" />已复制</> : <><Share2 className="mr-2 h-4 w-4" />复制链接</>}
            </Button>
          </div>
        </div>
      </div>

      {/* AI View Banner */}
      {aiView && (
        <div className="bg-primary/10 border-b border-primary/20">
          <div className="container mx-auto px-4 py-2 max-w-3xl">
            <p className="text-sm text-primary flex items-center gap-2">
              <Bot className="h-4 w-4" />
              <span>当前为 <strong>AI 视角</strong> — 这是 AI 实际接收到的精简内容，已去除所有样式和冗余标签</span>
            </p>
          </div>
        </div>
      )}

      {/* Article */}
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <article className={`rounded-2xl shadow-sm border p-6 md:p-10 ${aiView ? "bg-muted/50 font-mono text-sm" : "bg-card"}`}>
          {/* Header */}
          <header className="mb-8 pb-6 border-b">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-4">{article.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{article.author || "未知作者"}</span>
              {article.publish_time && <span>{article.publish_time}</span>}
              <span>阅读 {article.view_count} 次</span>
            </div>
          </header>

          {/* Content */}
          {aiView ? (
            <div
              className="ai-view-content leading-relaxed"
              dangerouslySetInnerHTML={{ __html: aiHtml || DOMPurify.sanitize(article.content) }}
            />
          ) : sanitizedHtml ? (
            <div
              className="article-html-content"
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            />
          ) : (
            <div className="article-text-content">
              {article.content.split("\n").map((paragraph, index) =>
                paragraph.trim() ? (
                  <p key={index} className="mb-4 text-foreground leading-relaxed">{paragraph}</p>
                ) : null
              )}
            </div>
          )}

          {/* Footer */}
          <footer className="mt-10 pt-6 border-t">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              {article.source_url ? (
                <a href={article.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ExternalLink className="mr-2 h-4 w-4" />查看原文
                </a>
              ) : (
                <span className="text-sm text-muted-foreground">无原文链接</span>
              )}
              <div className="flex items-center gap-2">
                <Button onClick={handleCopyContent} variant="ghost" size="sm">
                  {copied ? <><CheckCircle className="mr-2 h-4 w-4" />已复制</> : <><Copy className="mr-2 h-4 w-4" />复制全文</>}
                </Button>
                <Button onClick={handleCopyLink}>
                  {linkCopied ? <><CheckCircle className="mr-2 h-4 w-4" />链接已复制</> : <><Share2 className="mr-2 h-4 w-4" />复制链接给 AI</>}
                </Button>
              </div>
            </div>
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                💡 <strong>使用方法：</strong>点击"复制链接给 AI"，然后粘贴到 ChatGPT、Claude 或其他 AI 对话中，AI 即可直接阅读此文章。
              </p>
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
};

export default ArticlePage;
