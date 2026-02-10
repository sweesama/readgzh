import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Zap, Code, ArrowRight, Loader2, Copy, Check, MessageSquare, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const AI_GUIDE_TEMPLATE = `请帮我阅读这篇微信公众号文章，你可以通过访问以下链接获取内容：
https://read-open-share.lovable.app/?url=（把微信链接粘贴在这里）

例如：https://read-open-share.lovable.app/?url=https://mp.weixin.qq.com/s/xxxxx`;

const Index = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

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

      {/* AI-Optimized Advantages */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 justify-center mb-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-bold text-center">专为 AI 深度优化</h2>
          </div>
          <p className="text-center text-muted-foreground mb-10">
            不只是简单转发，我们对输出内容做了大量精简处理，让 AI 读得更快、更准、更省 Token
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: "🧹", title: "去除所有样式噪音", desc: "自动剥离 inline style、class、data 属性等视觉标记，只保留纯净语义内容" },
              { icon: "📉", title: "Token 消耗减少 50%+", desc: "清理空标签、嵌套容器、<br> 转真换行、&nbsp; 转空格，大幅压缩无效字符" },
              { icon: "🚫", title: "过滤微信私有标签", desc: "移除 <mp-common-profile> 等微信自定义组件，避免 AI 解析困惑" },
              { icon: "🖼️", title: "图片代理防盗链", desc: "微信图片通过服务端代理，AI 和用户都能正常查看，无需担心防盗链" },
              { icon: "📄", title: "纯 HTML 直出", desc: "无需 JavaScript 渲染，AI 爬虫直接获取完整内容，兼容所有 AI 平台" },
              { icon: "☁️", title: "云端零安装", desc: "无需本地部署、无需 API Key、无需浏览器插件，手机电脑随时可用" },
            ].map((item, i) => (
              <div key={i} className="flex gap-4 p-5 rounded-xl border bg-card hover:shadow-md transition-shadow">
                <span className="text-2xl shrink-0">{item.icon}</span>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI 使用说明 Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 justify-center mb-6">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-bold text-center">直接告诉 AI 怎么用</h2>
          </div>
          <p className="text-center text-muted-foreground mb-6">
            复制下面这段话，直接发给任何 AI（ChatGPT、Claude、Gemini 等），它就能自动读取微信文章了
          </p>
          <Card className="border-2 border-dashed border-primary/30 bg-muted/50">
            <CardContent className="pt-6 pb-4">
              <pre className="whitespace-pre-wrap text-sm text-foreground leading-relaxed font-sans">
                {AI_GUIDE_TEMPLATE}
              </pre>
              <div className="flex justify-end mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(AI_GUIDE_TEMPLATE);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                    toast({ title: "已复制！", description: "直接粘贴给 AI 即可" });
                  }}
                >
                  {copied ? (
                    <><Check className="mr-2 h-4 w-4" />已复制</>
                  ) : (
                    <><Copy className="mr-2 h-4 w-4" />复制这段话</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
          <p className="text-center text-xs text-muted-foreground mt-4">
            💡 提示：AI 会自动访问链接并获取文章全文，无需你手动操作
          </p>
        </div>
      </div>

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
