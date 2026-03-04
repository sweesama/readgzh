import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowLeft, Zap, Building2, Gift } from "lucide-react";
import Footer from "@/components/home/Footer";

const tiers = [
  {
    name: "Free",
    price: "¥0",
    period: "永久免费",
    description: "每天到网站领取 50 次免费额度",
    icon: Gift,
    highlight: false,
    features: [
      "每日 50 次 API 调用",
      "需每日到网站领取额度",
      "完整的文章解析能力",
      "缓存文章免费读取",
      "WebMCP 协议支持",
      "社区支持",
    ],
    cta: "免费开始",
    ctaLink: "/dashboard",
  },
  {
    name: "Pro",
    price: "¥39",
    period: "/月",
    description: "面向个人开发者和小型 AI 应用",
    icon: Zap,
    highlight: true,
    features: [
      "每日 2,000 次 API 调用",
      "无需每日领取，自动重置",
      "完整的文章解析能力",
      "缓存文章免费读取",
      "优先抓取队列",
      "用量统计面板",
      "邮件支持",
    ],
    cta: "即将推出",
    ctaLink: null,
  },
  {
    name: "Enterprise",
    price: "定制",
    period: "",
    description: "面向企业级 AI 产品和大规模集成",
    icon: Building2,
    highlight: false,
    features: [
      "不限量 API 调用",
      "私有部署选项",
      "专属抓取通道",
      "SLA 保障 99.9%",
      "实时监控面板",
      "专属技术支持",
      "自定义功能开发",
    ],
    cta: "联系我们",
    ctaLink: "mailto:hi@readgzh.site",
  },
];

const PricingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-8">
          <ArrowLeft className="mr-2 h-4 w-4" />返回首页
        </Button>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">简单透明的定价</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            免费开始使用，随业务增长升级。缓存文章的读取永远免费，只有新文章抓取才消耗额度。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-16">
          {tiers.map((tier) => (
            <Card
              key={tier.name}
              className={`relative flex flex-col ${
                tier.highlight ? "border-primary shadow-lg scale-105" : ""
              }`}
            >
              {tier.highlight && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">推荐</Badge>
              )}
              <CardHeader className="text-center">
                <tier.icon className={`h-10 w-10 mx-auto mb-2 ${tier.highlight ? "text-primary" : "text-muted-foreground"}`} />
                <CardTitle className="text-2xl">{tier.name}</CardTitle>
                <div className="mt-2">
                  <span className="text-4xl font-bold">{tier.price}</span>
                  <span className="text-muted-foreground">{tier.period}</span>
                </div>
                <CardDescription className="mt-2">{tier.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <ul className="space-y-3 flex-1">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full mt-6"
                  variant={tier.highlight ? "default" : "outline"}
                  onClick={() => {
                    if (tier.ctaLink?.startsWith("mailto:")) {
                      window.location.href = tier.ctaLink;
                    } else if (tier.ctaLink) {
                      navigate(tier.ctaLink);
                    }
                  }}
                  disabled={!tier.ctaLink}
                >
                  {tier.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto space-y-6 mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">常见问题</h2>
          {[
            {
              q: "缓存文章需要消耗额度吗？",
              a: "不需要！已经抓取过的文章再次读取完全免费，不消耗任何额度。只有首次抓取新文章才会消耗一次额度。",
            },
            {
              q: "免费层的每日领取是什么意思？",
              a: "免费用户每天需要到 ReadGZH 网站点击「领取额度」按钮，即可获得当日 50 次免费 API 调用额度。这有助于我们控制成本。",
            },
            {
              q: "如何付费升级到 Pro？",
              a: "Pro 套餐即将推出，敬请期待！目前免费层已经能满足大多数个人开发者的需求。",
            },
            {
              q: "API Key 安全吗？",
              a: "我们只存储 Key 的哈希值，即使数据库泄漏也无法还原你的 Key。请妥善保管你的 Key，不要在客户端代码中暴露。",
            },
          ].map(({ q, a }) => (
            <div key={q} className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2">{q}</h3>
              <p className="text-sm text-muted-foreground">{a}</p>
            </div>
          ))}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default PricingPage;
