import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Zap, Code, Copy, ArrowRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const Index = () => {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const isValidWeChatUrl = (url: string) => {
    return url.includes("mp.weixin.qq.com") || url.includes("weixin.qq.com");
  };

  const handleConvert = async () => {
    if (!url.trim()) {
      toast({
        title: "请输入链接",
        description: "请粘贴微信公众号文章链接",
        variant: "destructive",
      });
      return;
    }

    if (!isValidWeChatUrl(url)) {
      toast({
        title: "无效链接",
        description: "请输入有效的微信公众号文章链接",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    // Navigate to read page with the URL
    navigate(`/read?url=${encodeURIComponent(url)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleConvert();
    }
  };

  const apiEndpoint = `${window.location.origin}/api/read?url=微信文章链接`;

  const copyApiExample = () => {
    navigator.clipboard.writeText(apiEndpoint);
    toast({
      title: "已复制",
      description: "API 地址已复制到剪贴板",
    });
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
            
            <p className="text-lg md:text-xl text-muted-foreground mb-8">
              粘贴微信公众号链接，获取纯净文本内容。<br />
              支持 API 调用，让任何 AI 都能读取微信文章。
            </p>

            {/* Main Input */}
            <div className="bg-card rounded-2xl shadow-lg border p-6 md:p-8">
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  type="url"
                  placeholder="粘贴微信公众号文章链接..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 h-12 text-base"
                />
                <Button 
                  onClick={handleConvert} 
                  disabled={isLoading}
                  size="lg"
                  className="h-12 px-8"
                >
                  {isLoading ? (
                    "转换中..."
                  ) : (
                    <>
                      转换阅读
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                支持 mp.weixin.qq.com 开头的所有公众号文章链接
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>清爽阅读</CardTitle>
              <CardDescription>
                去除广告和杂乱元素，只保留纯净的文章内容，提供舒适的阅读体验
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>一键复制</CardTitle>
              <CardDescription>
                提取的文章内容可一键复制，方便粘贴给 ChatGPT、Claude 等任何 AI 助手
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Code className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>API 接口</CardTitle>
              <CardDescription>
                提供 JSON API，开发者可以将微信文章阅读能力集成到自己的 AI 应用中
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* API Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                开发者 API
              </CardTitle>
              <CardDescription>
                使用简单的 GET 请求获取文章内容，返回 JSON 格式数据
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted rounded-lg p-4 font-mono text-sm">
                <div className="flex items-center justify-between gap-4">
                  <code className="text-foreground break-all">
                    GET /api/read?url=微信文章链接
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={copyApiExample}
                    className="shrink-0"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="mt-4 text-sm text-muted-foreground">
                <p className="font-medium mb-2">返回格式：</p>
                <pre className="bg-muted rounded-lg p-4 overflow-x-auto">
{`{
  "success": true,
  "data": {
    "title": "文章标题",
    "author": "作者名称",
    "content": "文章正文内容...",
    "publishTime": "发布时间",
    "sourceUrl": "原文链接"
  }
}`}
                </pre>
              </div>
            </CardContent>
          </Card>
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
