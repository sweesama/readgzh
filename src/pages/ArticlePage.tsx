import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Copy, ExternalLink, CheckCircle, Share2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Article {
  id: string;
  title: string;
  author: string | null;
  content: string;
  source_url: string | null;
  publish_time: string | null;
  created_at: string;
  view_count: number;
}

const ArticlePage = () => {
  const { id } = useParams<{ id: string }>();
  
  const [article, setArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (!id) {
      setError("未找到文章");
      setIsLoading(false);
      return;
    }

    const fetchArticle = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // 获取文章
        const { data, error: fetchError } = await supabase
          .from("articles")
          .select("*")
          .eq("id", id)
          .single();

        if (fetchError) {
          if (fetchError.code === "PGRST116") {
            throw new Error("文章不存在或已被删除");
          }
          throw fetchError;
        }

        setArticle(data);

        // 异步更新访问计数（不阻塞页面加载）
        supabase.rpc("increment_view_count", { article_id: id }).then(({ error }) => {
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
  }, [id]);

  const handleCopyContent = async () => {
    if (!article) return;

    const textToCopy = `# ${article.title}\n\n作者：${article.author || "未知"}\n${article.publish_time ? `发布时间：${article.publish_time}\n` : ""}\n---\n\n${article.content}\n\n---\n${article.source_url ? `原文链接：${article.source_url}` : ""}`;

    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast({
      title: "已复制",
      description: "文章内容已复制到剪贴板",
    });

    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    toast({
      title: "链接已复制",
      description: "可以将此链接分享给 AI 工具使用",
    });

    setTimeout(() => setLinkCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <Skeleton className="h-8 w-32 mb-8" />
          <Card>
            <CardContent className="pt-6 space-y-4">
              <Skeleton className="h-10 w-3/4 mb-4" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="container mx-auto px-4 max-w-lg">
          <Card className="border-destructive">
            <CardContent className="pt-6 text-center">
              <div className="text-destructive text-lg font-medium mb-2">获取失败</div>
              <p className="text-muted-foreground mb-6">{error}</p>
              <Link to="/">
                <Button>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回首页
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!article) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-3 max-w-3xl flex items-center justify-between">
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Button onClick={handleCopyLink} size="sm" variant="outline">
              {linkCopied ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  已复制
                </>
              ) : (
                <>
                  <Share2 className="mr-2 h-4 w-4" />
                  分享链接
                </>
              )}
            </Button>
            <Button onClick={handleCopyContent} size="sm">
              {copied ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  复制内容
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Article Content */}
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <article className="bg-card rounded-2xl shadow-sm border p-6 md:p-10">
          {/* Article Header */}
          <header className="mb-8 pb-6 border-b">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              {article.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {article.author || "未知作者"}
              </span>
              {article.publish_time && (
                <span>{article.publish_time}</span>
              )}
              <span>阅读 {article.view_count} 次</span>
            </div>
          </header>

          {/* Article Body */}
          <div className="article-content prose prose-slate max-w-none">
            {article.content.split("\n").map((paragraph, index) => (
              paragraph.trim() && (
                <p key={index} className="mb-4 text-foreground leading-relaxed">
                  {paragraph}
                </p>
              )
            ))}
          </div>

          {/* Article Footer */}
          <footer className="mt-10 pt-6 border-t">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              {article.source_url ? (
                <a
                  href={article.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  查看原文
                </a>
              ) : (
                <span className="text-sm text-muted-foreground">
                  无原文链接
                </span>
              )}
              <Button onClick={handleCopyContent} variant="outline">
                {copied ? (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    已复制到剪贴板
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    复制全文给 AI
                  </>
                )}
              </Button>
            </div>
            
            {/* AI 工具提示 */}
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                💡 <strong>分享给 AI：</strong>复制当前页面链接，发送给 ChatGPT、Claude 或其他 AI 工具即可让它阅读此文章。
              </p>
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
};

export default ArticlePage;
