import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, Check, MessageSquare } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const API_BASE = "https://api.readgzh.site";

const AI_GUIDE_TEMPLATE = `请帮我阅读这篇微信公众号文章，你可以通过访问以下链接获取文章全文：
${API_BASE}/rd?url=（把微信文章链接粘贴在这里）

例如：${API_BASE}/rd?url=https://mp.weixin.qq.com/s/1KRk1ahr1t5w_d_WkiKH7A

请直接访问上面的链接，返回的就是文章的完整内容。`;

const AIGuideSection = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(AI_GUIDE_TEMPLATE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "已复制！", description: "直接粘贴给 AI 即可" });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 justify-center mb-3">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold text-center">直接告诉 AI 怎么用</h2>
        </div>
        <p className="text-center text-muted-foreground mb-4 text-sm">
          复制下面这段话，直接发给任何 AI（ChatGPT、Claude、Gemini 等），它就能自动读取微信文章了
        </p>
        <Card className="border-2 border-dashed border-primary/30 bg-muted/50">
          <CardContent className="pt-4 pb-3">
            <pre className="whitespace-pre-wrap text-sm text-foreground leading-relaxed font-sans">
              {AI_GUIDE_TEMPLATE}
            </pre>
            <div className="flex justify-end mt-3">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <><Check className="mr-2 h-4 w-4" />已复制</> : <><Copy className="mr-2 h-4 w-4" />复制这段话</>}
              </Button>
            </div>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground mt-3">
          💡 无需注册，每天可免费使用 10 次 · 注册后每天 50 次 · <a href="/pricing" className="text-primary hover:underline">Pro 会员</a>每天 2000 次
        </p>
      </div>
    </div>
  );
};

export default AIGuideSection;
