import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowLeft, Zap, Building2, Gift, Loader2, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import Footer from "@/components/home/Footer";

const PricingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");

  const handleCheckout = async (type: string) => {
    if (!user) {
      navigate("/dashboard");
      return;
    }
    setCheckoutLoading(type);
    try {
      const { data, error } = await supabase.functions.invoke("create-payment", {
        body: { type },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err) {
      toast({ title: "支付创建失败", description: String(err), variant: "destructive" });
    }
    setCheckoutLoading(null);
  };

  const proPrice = billingInterval === "monthly" ? "¥39" : "¥299";
  const proPeriod = billingInterval === "monthly" ? "/月" : "/年";
  const proSaving = billingInterval === "annual" ? "省 ¥169，约 7.7 折" : null;

  const tiers = [
    {
      name: "Free",
      price: "¥0",
      period: "永久免费",
      description: "每天到网站领取 30 积分免费额度",
      icon: Gift,
      highlight: false,
      features: [
        "每日 30 积分",
        "需每日到网站领取积分",
        "完整的文章解析能力",
        "缓存文章免费读取",
        "WebMCP 协议支持",
        "可购买加量包扩展额度（¥15/500积分）",
        "社区支持",
      ],
      cta: "免费开始",
      action: () => navigate("/dashboard"),
      checkoutType: null,
    },
    {
      name: "Lite",
      price: "¥9",
      period: "/月",
      description: "轻量尝鲜，适合偶尔使用的个人用户",
      icon: Sparkles,
      highlight: false,
      features: [
        "每月 300 积分",
        "月初自动发放，无需手动领取",
        "完整的文章解析能力",
        "缓存文章免费读取",
        "用量统计面板",
        "可购买加量包扩展额度（¥9/500积分）",
        "随时取消订阅",
        "邮件支持",
      ],
      cta: checkoutLoading === "lite" ? "处理中..." : "立即订阅",
      action: () => handleCheckout("lite"),
      checkoutType: "lite",
    },
    {
      name: "Pro",
      price: proPrice,
      period: proPeriod,
      description: "面向个人开发者和小型 AI 应用",
      icon: Zap,
      highlight: true,
      saving: proSaving,
      features: [
        "每月 2,000 积分",
        "月初自动发放，无需手动领取",
        "完整的文章解析能力",
        "缓存文章免费读取",
        "AI 智能摘要（?mode=summary）",
        "优先抓取队列",
        "用量统计面板",
        "可购买加量包扩展额度（¥9/500积分）",
        "随时取消订阅",
        "邮件支持",
      ],
      cta: checkoutLoading === "pro" || checkoutLoading === "pro_annual" ? "处理中..." : "立即订阅",
      action: () => handleCheckout(billingInterval === "monthly" ? "pro" : "pro_annual"),
      checkoutType: billingInterval === "monthly" ? "pro" : "pro_annual",
    },
    {
      name: "Enterprise",
      price: "定制",
      period: "",
      description: "面向企业级 AI 产品和大规模集成",
      icon: Building2,
      highlight: false,
      features: [
        "不限量积分",
        "私有部署选项",
        "专属抓取通道",
        "SLA 保障 99.9%",
        "实时监控面板",
        "专属技术支持",
        "自定义功能开发",
      ],
      cta: "联系我们",
      action: () => { window.location.href = "mailto:hi@readgzh.site"; },
      checkoutType: null,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-8">
          <ArrowLeft className="mr-2 h-4 w-4" />返回首页
        </Button>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">简单透明的定价</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            免费开始使用，随业务增长升级。缓存文章免费读取。
          </p>
          <p className="text-sm text-muted-foreground mt-2">支持信用卡、支付宝等多种支付方式 · 随时取消</p>

          {/* Billing interval toggle */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setBillingInterval("monthly")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                billingInterval === "monthly"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              月付
            </button>
            <button
              onClick={() => setBillingInterval("annual")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                billingInterval === "annual"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              年付
              <Badge variant="secondary" className="ml-1.5 text-xs">省 ¥169</Badge>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto mb-16">
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
                {"saving" in tier && tier.saving && (
                  <Badge variant="secondary" className="mt-2 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                    {tier.saving}
                  </Badge>
                )}
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
                  onClick={tier.action}
                  disabled={!!checkoutLoading && checkoutLoading === tier.checkoutType}
                >
                  {checkoutLoading && checkoutLoading === tier.checkoutType ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />处理中...</>
                  ) : (
                    tier.cta
                  )}
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
              a: "不需要！已经抓取过的文章再次读取完全免费，不消耗任何积分。只有首次抓取新文章才会消耗 3 积分。",
            },
            {
              q: "免费层的每日领取是什么意思？",
              a: "免费用户每天需要到 ReadGZH 网站点击「领取积分」按钮，即可获得当日 30 积分。",
            },
            {
              q: "Lite 和 Pro 有什么区别？",
              a: "Lite（¥9/月）每月 300 积分，适合偶尔使用。Pro（¥39/月）每月 2000 积分，并额外提供 AI 智能摘要和优先抓取队列。",
            },
            {
              q: "订阅后可以取消吗？",
              a: "可以！你可以随时在控制台取消订阅，取消后在当前计费周期结束前仍可使用已有功能。不会产生额外费用。",
            },
            {
              q: "月付和年付有什么区别？",
              a: "仅 Pro 提供年付选项。功能完全一样！年付 ¥299 相当于月均 ¥24.9，比月付 ¥39 节省约 ¥169（7.7 折）。",
            },
            {
              q: "加量包有有效期吗？",
              a: "新购买的加量包自购买之日起 30 天内有效。可叠加购买，每包独立计算有效期。",
            },
            {
              q: "如果积分用完了怎么办？",
              a: "你可以在控制台购买「加量包」（订阅用户 ¥9/500积分，免费用户 ¥15/500积分），也可以升级到更高级别的订阅计划。",
            },
            {
              q: "支持哪些支付方式？",
              a: "我们通过 Stripe 支持信用卡（Visa/Mastercard）和支付宝。如需微信支付或其他方式，请联系我们。",
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
