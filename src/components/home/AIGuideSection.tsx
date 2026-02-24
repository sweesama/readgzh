import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, Check, MessageSquare } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const AI_GUIDE_TEMPLATE = `请帮我阅读这篇微信公众号文章，你可以通过访问以下链接获取内容：
${SUPABASE_URL}/functions/v1/rd?url=（把微信链接粘贴在这里）

例如：${SUPABASE_URL}/functions/v1/rd?url=https://mp.weixin.qq.com/s/xxxxx`;

const AIGuideSection = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(AI_GUIDE_TEMPLATE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "已复制！", description: "直接粘贴给 AI 即可" });
  };

  return (
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
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <><Check className="mr-2 h-4 w-4" />已复制</> : <><Copy className="mr-2 h-4 w-4" />复制这段话</>}
              </Button>
            </div>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground mt-4">
          💡 提示：AI 会自动访问链接并获取文章全文，无需你手动操作
        </p>
      </div>
    </div>
  );
};

export default AIGuideSection;
