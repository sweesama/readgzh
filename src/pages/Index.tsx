import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Zap, Code, Copy, ArrowRight, CheckCircle, Lightbulb } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();
  
  // 粘贴内容
  const [pastedContent, setPastedContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 简单解析粘贴的内容，尝试提取标题和正文
  const parseContent = (raw: string) => {
    const lines = raw.trim().split("\n").filter(line => line.trim());
    
    if (lines.length === 0) {
      return { title: "", content: "" };
    }
    
    // 第一行通常是标题
    const title = lines[0].trim();
    
    // 剩余的是正文
    const content = lines.slice(1).join("\n").trim();
    
    return { title, content: content || title }; // 如果只有一行，标题和内容相同
  };

  const handleSubmit = async () => {
    if (!pastedContent.trim()) {
      toast({
        title: "请粘贴内容",
        description: "请先从微信文章页面复制内容",
        variant: "destructive",
      });
      return;
    }

    const { title, content } = parseContent(pastedContent);

    if (!title) {
      toast({
        title: "内容无效",
        description: "无法解析文章内容，请确保复制了完整的文章",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("articles")
        .insert({
          title: title.substring(0, 200), // 限制标题长度
          author: "微信公众号", // 默认作者
          content: content,
          source_url: sourceUrl.trim() || null,
        })
        .select("id")
        .single();

      if (error) throw error;

      toast({
        title: "生成成功！",
        description: "AI可访问的链接已生成",
      });

      navigate(`/a/${data.id}`);
    } catch (err) {
      console.error("Error submitting article:", err);
      toast({
        title: "提交失败",
        description: err instanceof Error ? err.message : "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-background" />
        <div className="relative container mx-auto px-4 py-12 md:py-16">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-full text-sm font-medium mb-6">
              <BookOpen className="h-4 w-4" />
              让 AI 读懂微信公众号
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              微信文章 AI 阅读器
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-2">
              把微信文章变成 AI 可访问的链接
            </p>
            <p className="text-muted-foreground">
              ChatGPT、Claude、Perplexity 等 AI 工具可直接阅读
            </p>
          </div>
        </div>
      </div>

      {/* Main Tool Section */}
      <div className="container mx-auto px-4 pb-16">
        <div className="max-w-3xl mx-auto">
          {/* 使用说明 */}
          <Card className="mb-6 bg-muted/50 border-dashed">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Lightbulb className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div className="text-sm space-y-2">
                  <p className="font-medium text-foreground">使用方法（3步）：</p>
                  <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                    <li>在<strong>电脑浏览器</strong>打开微信文章链接</li>
                    <li>全选复制文章内容（Ctrl+A → Ctrl+C）</li>
                    <li>粘贴到下方，生成 AI 可读链接</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 主表单 */}
          <Card className="shadow-lg border-2">
            <CardHeader>
              <CardTitle>粘贴文章内容</CardTitle>
              <CardDescription>
                从微信文章页面复制的内容会自动解析
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="在这里粘贴从微信文章复制的全部内容...

（打开微信文章 → 全选 → 复制 → 粘贴到这里）"
                value={pastedContent}
                onChange={(e) => setPastedContent(e.target.value)}
                className="min-h-[250px] text-base"
              />
              
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  原文链接（可选，方便溯源）
                </label>
                <Input
                  type="url"
                  placeholder="粘贴微信文章链接（可选）"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                />
              </div>
              
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting || !pastedContent.trim()}
                className="w-full h-12 text-base"
              >
                {isSubmitting ? (
                  "生成中..."
                ) : (
                  <>
                    生成 AI 可访问链接
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* 预览解析结果 */}
          {pastedContent.trim() && (
            <Card className="mt-4 bg-muted/30">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-2">预览解析：</p>
                <p className="font-medium text-foreground truncate">
                  标题：{parseContent(pastedContent).title || "（未识别）"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  正文：{parseContent(pastedContent).content.substring(0, 100)}...
                </p>
              </CardContent>
            </Card>
          )}
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
                <CardTitle>生成可读链接</CardTitle>
                <CardDescription>
                  把文章内容保存到我们平台，生成一个 AI 可以自由访问的公开链接
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
