import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Zap, Code, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Auto-submit if ?url= param is present (enables: AI visits site?url=WECHAT_LINK)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const autoUrl = params.get("url");
    if (autoUrl && autoUrl.includes("weixin.qq.com")) {
      setUrl(autoUrl);
      // Clear the param from URL to avoid re-trigger
      window.history.replaceState({}, "", "/");
      // Auto-submit after a tick
      setTimeout(() => {
        document.getElementById("auto-submit-trigger")?.click();
      }, 100);
    }
  }, []);

  const handleSubmit = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      toast({
        title: "请输入链接",
        description: "请粘贴微信公众号文章链接",
        variant: "destructive",
      });
      return;
    }

    if (!trimmedUrl.includes("mp.weixin.qq.com") && !trimmedUrl.includes("weixin.qq.com")) {
      toast({
        title: "链接格式不对",
        description: "请粘贴微信公众号文章链接（mp.weixin.qq.com）",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("wechat-reader", {
        body: { url: trimmedUrl },
      });

      if (error) {
        throw new Error(error.message || "请求失败");
      }

      if (!data.success) {
        throw new Error(data.error || "抓取失败");
      }

      toast({
        title: data.cached ? "文章已存在" : "抓取成功！",
        description: data.cached 
          ? "该文章之前已经转换过，直接跳转" 
          : "AI 可访问的链接已生成",
      });

      // Use slug-based URL if available, fallback to UUID
      if (data.slug) {
        navigate(`/${data.slug}`);
      } else {
        navigate(`/a/${data.articleId}`);
      }
    } catch (err) {
      console.error("Error:", err);
      toast({
        title: "抓取失败",
        description: err instanceof Error ? err.message : "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-background" />
        <div className="relative container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-full text-sm font-medium mb-6">
              <BookOpen className="h-4 w-4" />
              让 AI 读懂微信公众号
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              微信文章 AI 阅读器
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground mb-2">
              粘贴微信文章链接，一键生成 AI 可访问的页面
            </p>
            <p className="text-muted-foreground mb-10">
              ChatGPT、Claude、Perplexity 等 AI 工具可直接阅读
            </p>

            {/* 主输入区 */}
            <Card className="max-w-2xl mx-auto shadow-lg border-2">
              <CardContent className="pt-6 pb-6">
                <div className="flex gap-3">
                  <Input
                    type="url"
                    placeholder="粘贴微信文章链接（mp.weixin.qq.com/s/...）"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                    className="h-12 text-base"
                  />
                  <Button
                    id="auto-submit-trigger"
                    onClick={handleSubmit}
                    disabled={isLoading || !url.trim()}
                    className="h-12 px-6 shrink-0"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        抓取中...
                      </>
                    ) : (
                      <>
                        生成
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">为什么需要这个工具？</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>微信链接被封锁</CardTitle>
                <CardDescription>
                  AI 工具（ChatGPT、Claude 等）无法直接访问微信公众号文章，会被反爬虫拦截
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>自动提取内容</CardTitle>
                <CardDescription>
                  粘贴链接后自动抓取文章内容，生成一个 AI 可以自由访问的公开链接
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Code className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>分享给 AI</CardTitle>
                <CardDescription>
                  把生成的链接发给 ChatGPT、Claude、Perplexity，AI 就能读取文章内容
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>微信文章 AI 阅读器 - 让 AI 能够读取微信公众号内容</p>
          <p className="mt-2">本服务仅用于个人学习和研究目的</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
