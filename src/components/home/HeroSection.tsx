import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface HeroSectionProps {
  initialUrl?: string;
}

const HeroSection = ({ initialUrl = "" }: HeroSectionProps) => {
  const navigate = useNavigate();
  const [url, setUrl] = useState(initialUrl);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      toast({ title: "请输入链接", description: "请粘贴微信公众号文章链接", variant: "destructive" });
      return;
    }
    if (!trimmedUrl.includes("mp.weixin.qq.com") && !trimmedUrl.includes("weixin.qq.com")) {
      toast({ title: "链接格式不对", description: "请粘贴微信公众号文章链接（mp.weixin.qq.com）", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("wechat-reader", { body: { url: trimmedUrl } });
      if (error) throw new Error(error.message || "请求失败");
      if (!data.success) throw new Error(data.error || "抓取失败");

      toast({
        title: data.cached ? "文章已存在" : "抓取成功！",
        description: data.cached ? "该文章之前已经转换过，直接跳转" : "AI 可访问的链接已生成",
      });

      if (data.slug) {
        navigate(`/${data.slug}`);
      } else {
        navigate(`/a/${data.articleId}`);
      }
    } catch (err) {
      console.error("Error:", err);
      toast({ title: "抓取失败", description: err instanceof Error ? err.message : "请稍后重试", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) handleSubmit();
  };

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-background" />
      <div className="relative container mx-auto px-4 pt-20 pb-12 md:pt-28 md:pb-16">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 sm:gap-4 mb-6 whitespace-nowrap">
            <img
              src="/logo.png"
              alt="ReadGZH logo"
              width={64}
              height={64}
              fetchPriority="high"
              decoding="async"
              className="h-10 w-10 sm:h-14 sm:w-14 md:h-16 md:w-16 shrink-0"
            />
            <h1 className="text-xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground tracking-tight">
              ReadGZH <span className="text-muted-foreground">—</span> 微信文章 AI 阅读器
            </h1>
          </div>

          <p className="text-sm sm:text-lg md:text-xl text-muted-foreground mb-2 whitespace-nowrap">粘贴微信文章链接，一键生成 AI 可访问的页面</p>
          <p className="text-xs sm:text-base text-muted-foreground mb-8 whitespace-nowrap">ChatGPT、Claude、Perplexity 等 AI 工具可直接阅读</p>

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
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" />抓取中...</>
                  ) : (
                    <>生成<ArrowRight className="ml-2 h-5 w-5" /></>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
