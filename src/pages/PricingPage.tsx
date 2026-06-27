import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowLeft, Zap, Gift, Loader2, Sparkles, Package, Clock, Infinity as InfinityIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import Footer from "@/components/home/Footer";
import SEO from "@/components/SEO";

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
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="定价方案 - Free / Lite / Pro 套餐 | ReadGZH"
        description="ReadGZH 定价方案：免费每日 30 积分，Lite/Pro 订阅获得更多积分配额、AI 摘要与高级特性。缓存文章永久免费读取。"
        path="/pricing"
        ogType="website"
      />
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-8">
          <ArrowLeft className="mr-2 h-4 w-4" />返回首页
        </Button>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">简单透明的定价</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            免费开始使用，随业务增长升级。缓存文章免费读取。
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            支持信用卡（Visa / Mastercard / 银联）、Link、支付宝、微信 · 随时取消
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            订阅套餐仅支持信用卡 / Link；支付宝与微信仅支持加量包等一次性付款
          </p>

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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16 items-stretch">
          {tiers.map((tier) => (
            <Card
              key={tier.name}
              className={`relative flex flex-col ${
                tier.highlight ? "border-primary shadow-lg md:scale-105" : ""
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

        {/* 按需购买：一次性加量包，无需订阅 */}
        <div className="max-w-5xl mx-auto mb-20">
          <div className="text-center mb-8">
            <Badge variant="secondary" className="mb-3">不想订阅？</Badge>
            <h2 className="text-3xl font-bold mb-3">按需购买加量包</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              一次付清，30 天有效，不绑定订阅。适合临时调研、批量阅读、做项目等短期需求。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* 免费用户加量包 */}
            <Card className="flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <Package className="h-8 w-8 text-muted-foreground" />
                  <Badge variant="outline">免费用户</Badge>
                </div>
                <CardTitle className="text-xl">基础加量包</CardTitle>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-bold">¥15</span>
                  <span className="text-muted-foreground">/ 500 积分</span>
                </div>
                <CardDescription>未订阅用户可直接购买</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <ul className="space-y-2 mb-6 flex-1">
                  <li className="flex items-start gap-2 text-sm"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />500 积分（约可读 166 篇新文章）</li>
                  <li className="flex items-start gap-2 text-sm"><Clock className="h-4 w-4 text-primary shrink-0 mt-0.5" />自购买日起 30 天有效</li>
                  <li className="flex items-start gap-2 text-sm"><InfinityIcon className="h-4 w-4 text-primary shrink-0 mt-0.5" />缓存文章仍然免费读</li>
                  <li className="flex items-start gap-2 text-sm"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />支持支付宝 / 微信 / 信用卡</li>
                </ul>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate(user ? "/dashboard?action=buy_credits" : "/dashboard")}
                >
                  {user ? "立即购买" : "登录后购买"}
                </Button>
              </CardContent>
            </Card>

            {/* 订阅用户优惠加量包 */}
            <Card className="flex flex-col border-primary/50">
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <Package className="h-8 w-8 text-primary" />
                  <Badge className="bg-primary/10 text-primary hover:bg-primary/10">订阅用户 6 折</Badge>
                </div>
                <CardTitle className="text-xl">优惠加量包</CardTitle>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-bold">¥9</span>
                  <span className="text-muted-foreground">/ 500 积分</span>
                </div>
                <CardDescription>Lite / Pro 订阅用户专属价</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <ul className="space-y-2 mb-6 flex-1">
                  <li className="flex items-start gap-2 text-sm"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />500 积分，比基础包便宜 ¥6</li>
                  <li className="flex items-start gap-2 text-sm"><Clock className="h-4 w-4 text-primary shrink-0 mt-0.5" />自购买日起 30 天有效，可叠加</li>
                  <li className="flex items-start gap-2 text-sm"><InfinityIcon className="h-4 w-4 text-primary shrink-0 mt-0.5" />与订阅积分独立计算</li>
                  <li className="flex items-start gap-2 text-sm"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />在控制台一键购买，可选 1-20 份</li>
                </ul>
                <Button
                  className="w-full"
                  onClick={() => navigate(user ? "/dashboard?action=buy_credits" : "/dashboard")}
                >
                  {user ? "前往控制台购买" : "登录后购买"}
                </Button>
              </CardContent>
            </Card>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            * 加量包属于一次性消耗品，购买后已用部分不支持退款；7 天内完全未使用可联系客服全额退款。
          </p>
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
              q: "可以升级订阅吗？会重复扣费吗？",
              a: "可以升级（如月付升年付）。系统会自动按已用天数补差价，不会出现「月费+年费」两份订阅，也不会重复扣款或叠加积分。同一时间最多只有一个有效订阅。",
            },
            {
              q: "如何申请退款？退多少？",
              a: "订阅后 14 天内可在「控制台 → 账单与订阅 → 申请退款」自助退款，每位用户一年内最多 1 次。退款金额按已用比例计算（月付按 max(已过天数 / 当月用量) 比例扣除已用部分；年付扣除已完整使用的整月数 × ¥24.9，再按当月用量扣除当月部分），剩余金额自动原路退回。退款成功后会立即取消订阅、降级为免费版，并清空未使用的加量包积分。超出 14 天或特殊情况请联系客服。",
            },
            {
              q: "加量包能退款吗？",
              a: "加量包属于一次性消耗品，购买后已用部分不支持退款；7 天内完全未使用的加量包可联系客服全额退款。",
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
              a: "我们通过 Stripe 支持：信用卡（Visa / Mastercard / 银联 UnionPay）、Link、支付宝、微信支付。注意：订阅套餐（Lite / Pro 月付 / 年付）由于需要按周期自动扣款，仅支持信用卡和 Link；支付宝、微信支付仅支持加量包等一次性付款。如需其他支付方式，欢迎联系我们。",
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
