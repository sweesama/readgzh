import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Zap, BookOpen, Code } from "lucide-react";

const features = [
  { icon: Zap, title: "微信链接被封锁", desc: "AI 工具（ChatGPT、Claude 等）无法直接访问微信公众号文章，会被反爬虫拦截" },
  { icon: BookOpen, title: "自动提取内容", desc: "粘贴链接后自动抓取文章内容，支持普通图文和图片消息（小绿书），生成 AI 可访问的公开链接" },
  { icon: Code, title: "分享给 AI", desc: "把生成的链接发给 ChatGPT、Claude、Perplexity，AI 就能读取文章内容" },
];

const FeaturesSection = () => (
  <div className="container mx-auto px-4 py-16 bg-muted/30">
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-center mb-8">为什么需要这个工具？</h2>
      <div className="grid md:grid-cols-3 gap-6">
        {features.map((f, i) => (
          <Card key={i} className="border-2 hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <f.icon className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>{f.title}</CardTitle>
              <CardDescription>{f.desc}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  </div>
);

export default FeaturesSection;
