import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Copy, Gift, Users, Sparkles, Share2, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import Footer from "@/components/home/Footer";
import SEO from "@/components/SEO";
import { buildInviteLink } from "@/lib/referral";

type ReferralRow = {
  masked_email: string;
  status: "pending" | "qualified" | "rewarded" | "invalid";
  reward: number | null;
  created_at: string;
  rewarded_at: string | null;
};

type Stats = {
  code: string;
  rewarded_count: number;
  pending_count: number;
  total_earned: number;
  cap: number;
  next_tier_reward: number | null;
  referrals: ReferralRow[];
};

const tiers = [
  { range: "1–3 人", reward: 30, total: 90 },
  { range: "4–8 人", reward: 60, total: 300 },
  { range: "9–15 人", reward: 90, total: 630 },
  { range: "16–20 人", reward: 120, total: 600 },
];

const statusLabel: Record<string, { text: string; cls: string }> = {
  pending: { text: "待激活", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  qualified: { text: "已激活", cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  rewarded: { text: "已发放", cls: "bg-primary/10 text-primary" },
  invalid: { text: "无效", cls: "bg-muted text-muted-foreground" },
};

const InvitePage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/dashboard");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setStatsLoading(true);
      const { data, error } = await supabase.rpc("get_my_referral_stats");
      if (!error && data) setStats(data as unknown as Stats);
      setStatsLoading(false);
    })();
  }, [user]);

  const link = stats?.code ? buildInviteLink(stats.code) : "";

  const handleCopy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast({ title: "已复制邀请链接", description: "分享给朋友吧 🎉" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!link) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "ReadGZH — 微信文章 AI 阅读器",
          text: "我在用 ReadGZH 把微信文章喂给 AI，体验非常顺。来注册一起用，我们都能拿积分。",
          url: link,
        });
      } catch {}
    } else {
      handleCopy();
    }
  };

  const progressPct = stats ? Math.round((stats.rewarded_count / stats.cap) * 100) : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title="邀请好友 - ReadGZH"
        description="邀请好友注册 ReadGZH，最高可得 1620 积分。"
        path="/dashboard/invite"
        ogType="website"
        robots="noindex,nofollow"
      />
      <div className="container mx-auto px-4 py-8 flex-1 max-w-3xl">
        <Link to="/dashboard">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />返回控制台
          </Button>
        </Link>

        <header className="mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <Gift className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">邀请好友，最高得 1620 积分</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            每位好友需完成邮箱验证并阅读一篇文章后，奖励才会发放。积分自发放日起 60 天内有效。
          </p>
        </header>

        {/* 邀请链接卡片 */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Share2 className="h-4 w-4" />我的专属邀请链接
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <div className="flex flex-col sm:flex-row gap-2">
                <code className="flex-1 px-3 py-2 rounded-md bg-muted text-sm font-mono break-all">
                  {link}
                </code>
                <Button onClick={handleCopy} variant="outline" size="sm" className="gap-1.5">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "已复制" : "复制"}
                </Button>
                <Button onClick={handleShare} size="sm" className="gap-1.5">
                  <Share2 className="h-4 w-4" />分享
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 进度卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>已成功邀请</CardDescription>
              <CardTitle className="text-2xl">{stats?.rewarded_count ?? 0}<span className="text-base font-normal text-muted-foreground"> / {stats?.cap ?? 20}</span></CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={progressPct} className="h-1.5" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>累计获得积分</CardDescription>
              <CardTitle className="text-2xl text-primary">{stats?.total_earned ?? 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">已到账，60 天内有效</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>下一位奖励</CardDescription>
              <CardTitle className="text-2xl">
                {stats?.next_tier_reward ? `${stats.next_tier_reward} 积分` : "已满"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{stats?.pending_count ?? 0} 位待激活</p>
            </CardContent>
          </Card>
        </div>

        {/* 阶梯说明 */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />阶梯奖励
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {tiers.map((t, i) => {
                const reached = (stats?.rewarded_count ?? 0) > (i === 0 ? 0 : i === 1 ? 3 : i === 2 ? 8 : 15);
                return (
                  <div
                    key={t.range}
                    className={`rounded-lg border p-3 text-center ${reached ? "border-primary/40 bg-primary/5" : "border-border"}`}
                  >
                    <div className="text-xs text-muted-foreground mb-1">{t.range}</div>
                    <div className={`text-lg font-bold ${reached ? "text-primary" : ""}`}>
                      {t.reward}<span className="text-xs font-normal">/人</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">小计 {t.total}</div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-center">
              满额奖励：90 + 300 + 630 + 600 = <span className="text-primary font-semibold">1620 积分</span>
            </p>
          </CardContent>
        </Card>

        {/* 邀请记录 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />邀请记录
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : !stats?.referrals?.length ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                还没有人通过你的链接注册。分享出去试试吧。
              </p>
            ) : (
              <div className="space-y-2">
                {stats.referrals.map((r, i) => {
                  const s = statusLabel[r.status] ?? statusLabel.invalid;
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-2 py-2 border-b border-border last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-mono truncate">{r.masked_email}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString("zh-CN")}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.cls}`}>
                        {s.text}
                      </span>
                      {r.reward && (
                        <span className="text-sm font-semibold text-primary tabular-nums">
                          +{r.reward}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          请勿用小号自邀，系统会通过 IP / 邮箱 / 设备信息识别并作废奖励。
        </p>
      </div>
      <Footer />
    </div>
  );
};

export default InvitePage;
