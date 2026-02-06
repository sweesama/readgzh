import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Copy, ExternalLink, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ArticleData {
  title: string;
  author: string;
  content: string;
  publishTime?: string;
  sourceUrl: string;
}

const ReadPage = () => {
  const [searchParams] = useSearchParams();
  const url = searchParams.get("url");
  
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!url) {
      setError("未提供文章链接");
      setIsLoading(false);
      return;
    }

    const fetchArticle = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: fnError } = await supabase.functions.invoke("wechat-reader", {
          body: { url },
        });

        if (fnError) {
          // supabase-js 在函数返回非 2xx 时会把响应当成错误；尝试从 context 里读出我们返回的 JSON
          const ctx = (fnError as unknown as { context?: Response })?.context;
          if (ctx) {
            try {
              const body = await ctx.json();
              if (body?.error) {
                const msg = body.hint ? `${body.error}\n\n💡 ${body.hint}` : body.error;
                throw new Error(msg);
              }
            } catch {
              // ignore parse errors and fall back to fnError.message
            }
          }

          throw new Error(fnError.message || "获取文章失败");
        }

        if (!data.success) {
          // Include hint if available
          const errorMsg = data.hint 
            ? `${data.error}\n\n💡 ${data.hint}` 
            : data.error || "获取文章失败";
          throw new Error(errorMsg);
        }

        setArticle(data.data);
      } catch (err) {
        console.error("Error fetching article:", err);
        setError(err instanceof Error ? err.message : "获取文章失败，请稍后重试");
      } finally {
        setIsLoading(false);
      }
    };

    fetchArticle();
  }, [url]);

  const handleCopyContent = async () => {
    if (!article) return;

    const textToCopy = `# ${article.title}\n\n作者：${article.author}\n${article.publishTime ? `发布时间：${article.publishTime}\n` : ""}\n---\n\n${article.content}\n\n---\n原文链接：${article.sourceUrl}`;

    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast({
      title: "已复制",
      description: "文章内容已复制到剪贴板，可粘贴给 AI 使用",
    });

    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <Skeleton className="h-8 w-32 mb-8" />
          <Card>
            <CardHeader>
              <Skeleton className="h-10 w-3/4 mb-4" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
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

      {/* Article Content */}
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <article className="bg-card rounded-2xl shadow-sm border p-6 md:p-10">
          {/* Article Header */}
          <header className="mb-8 pb-6 border-b">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              {article.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{article.author}</span>
              {article.publishTime && (
                <span>{article.publishTime}</span>
              )}
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
              <a
                href={article.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                查看原文
              </a>
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
          </footer>
        </article>
      </div>
    </div>
  );
};

export default ReadPage;
