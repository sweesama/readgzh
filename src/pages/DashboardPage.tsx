import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Copy, Key, Plus, Trash2, Gift, LogOut, ArrowLeft, Eye, EyeOff, BarChart3, Coins, Zap, Loader2, Crown, Mail, Pencil, CreditCard, CalendarClock } from "lucide-react";
import Footer from "@/components/home/Footer";
import SEO from "@/components/SEO";

interface ApiKey {
  id: string;
  key_prefix: string;
  key_value?: string | null;
  name: string;
  tier: string;
  daily_limit: number;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

interface UsageRecord {
  usage_date: string;
  request_count: number;
  cached_count: number;
  api_key_id: string;
}

interface Balance {
  claimed_today: boolean;
  total_credits: number;
  used_credits: number;
  remaining_credits: number;
  is_pro?: boolean;
  daily_limit?: number;
  bonus_credits?: number;
  bonus_expires_at?: string | null;
}

const DashboardPage = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [usage, setUsage] = useState<UsageRecord[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showNewKey, setShowNewKey] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [keysLoading, setKeysLoading] = useState(true);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [proLoading, setProLoading] = useState(true);
  // Email OTP state
  const [loginEmail, setLoginEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  // Subscription info
  const [subscriptionInfo, setSubscriptionInfo] = useState<{
    status: string | null;
    interval: string | null;
    current_period_end: string | null;
  } | null>(null);
  const [isLegacyPro, setIsLegacyPro] = useState(false);
  const [isLifetimePro, setIsLifetimePro] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  // Nickname editing
  const [displayName, setDisplayName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameLoading, setNameLoading] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [showRevokedKeys, setShowRevokedKeys] = useState(false);

  const handleUpgrade = async (type: "pro" | "pro_annual" = "pro") => {
    setUpgradeLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-payment", {
        body: { type },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err) {
      toast({ title: "支付创建失败", description: String(err), variant: "destructive" });
    }
    setUpgradeLoading(false);
  };

  const handleBuyCredits = async () => {
    setUpgradeLoading(true);
    try {
      const creditType = isPro ? "credits" : "credits_free";
      const { data, error } = await supabase.functions.invoke("create-payment", {
        body: { type: creditType },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err) {
      toast({ title: "购买失败", description: String(err), variant: "destructive" });
    }
    setUpgradeLoading(false);
  };

  const fetchKeys = useCallback(async () => {
    setKeysLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setKeys([]);
        return;
      }

      const { data, error } = await supabase.functions.invoke("api-keys", {
        body: { action: "list" },
      });

      if (error) throw error;
      if (data?.success) {
        setKeys(Array.isArray(data.keys) ? data.keys : []);
      }
    } catch {
      setKeys([]);
    } finally {
      setKeysLoading(false);
    }
  }, []);

  const fetchUsage = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setUsage([]);
        return;
      }

      const { data, error } = await supabase.functions.invoke("api-keys", {
        body: { action: "usage" },
      });

      if (error) throw error;
      if (data?.success) {
        setUsage(Array.isArray(data.usage) ? data.usage : []);
      }
    } catch {
      setUsage([]);
    }
  }, []);

  const fetchBalance = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setBalance(null);
        return;
      }

      const { data, error } = await supabase.functions.invoke("api-keys", {
        body: { action: "balance" },
      });

      if (error) throw error;
      if (data?.success) {
        setBalance(data.balance ?? null);
      }
    } catch {
      setBalance(null);
    }
  }, []);

  const checkProStatus = useCallback(async () => {
    setProLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsPro(false);
        setSubscriptionInfo(null);
        setIsLegacyPro(false);
        setIsLifetimePro(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("check-payment");
      if (error) throw error;

      if (data?.is_pro) {
        setIsPro(true);
        void fetchKeys();
        void fetchBalance();
      } else {
        setIsPro(false);
      }
      if (data?.subscription) {
        setSubscriptionInfo(data.subscription);
      } else {
        setSubscriptionInfo(null);
      }
      setIsLegacyPro(Boolean(data?.legacy));
      setIsLifetimePro(Boolean(data?.lifetime));
    } catch {
      setIsPro(false);
      setSubscriptionInfo(null);
      setIsLegacyPro(false);
      setIsLifetimePro(false);
    } finally {
      setProLoading(false);
    }
  }, [fetchKeys, fetchBalance]);

  // Fetch display name from profile
  const fetchProfile = useCallback(async () => {
    if (!user?.id) {
      setDisplayName("");
      return;
    }

    const { data } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();
    setDisplayName(data?.display_name ?? "");
  }, [user?.id]);

  const handleSaveName = async () => {
    if (!displayName.trim()) return;
    setNameLoading(true);
    const { error } = await supabase.from("profiles").update({ display_name: displayName.trim() }).eq("id", user!.id);
    if (error) {
      toast({ title: "保存失败", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "昵称已更新" });
      setEditingName(false);
    }
    setNameLoading(false);
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err) {
      toast({ title: "无法打开订阅管理", description: String(err), variant: "destructive" });
    }
    setPortalLoading(false);
  };

  useEffect(() => {
    if (loading) return;

    if (!user) {
      setKeys([]);
      setUsage([]);
      setBalance(null);
      setDisplayName("");
      setNewKey(null);
      setShowNewKey(false);
      setRevealedKeys(new Set());
      setIsPro(false);
      setIsLegacyPro(false);
      setIsLifetimePro(false);
      setSubscriptionInfo(null);
      setKeysLoading(false);
      setProLoading(false);
      return;
    }

    void fetchKeys();
    void fetchUsage();
    void fetchBalance();
    void checkProStatus();
    void fetchProfile();

    const params = new URLSearchParams(window.location.search);
    if (params.get("credits_purchased")) {
      toast({ title: "🎉 积分购买成功", description: `${params.get("credits_purchased")} 积分已到账` });
      window.history.replaceState({}, "", "/dashboard");
      void checkProStatus();
    }
  }, [user, loading, fetchKeys, fetchUsage, fetchBalance, checkProStatus, fetchProfile]);

  const handleGoogleLogin = async () => {
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (error) {
      toast({ title: "登录失败", description: String(error), variant: "destructive" });
    }
  };

  const handleAppleLogin = async () => {
    const { error } = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (error) {
      toast({ title: "登录失败", description: String(error), variant: "destructive" });
    }
  };

  const handleSendOtp = async () => {
    if (!loginEmail) {
      toast({ title: "请输入邮箱地址", variant: "destructive" });
      return;
    }
    setOtpLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: loginEmail,
      options: { shouldCreateUser: true },
    });
    if (error) {
      toast({ title: "发送验证码失败", description: error.message, variant: "destructive" });
    } else {
      setOtpSent(true);
      toast({ title: "验证码已发送", description: "请查收邮件，输入验证码" });
    }
    setOtpLoading(false);
  };

  const handleVerifyOtp = async () => {
    if (!otpCode) {
      toast({ title: "请输入验证码", variant: "destructive" });
      return;
    }
    setOtpLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: loginEmail,
      token: otpCode,
      type: "email",
    });
    if (error) {
      toast({ title: "验证失败", description: error.message, variant: "destructive" });
    }
    setOtpLoading(false);
  };

  const createKey = async () => {
    setIsCreating(true);
    try {
      const { data } = await supabase.functions.invoke("api-keys", {
        body: { action: "create", name: newKeyName || "Default" },
      });
      if (data?.success) {
        setNewKey(data.key);
        setShowNewKey(true);
        setNewKeyName("");
        fetchKeys();
        toast({ title: "API Key 创建成功", description: "请立即复制保存，此 Key 只显示一次！" });
      } else {
        toast({ title: "创建失败", description: data?.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "创建失败", variant: "destructive" });
    }
    setIsCreating(false);
  };

  const revokeKey = async (keyId: string) => {
    const { data } = await supabase.functions.invoke("api-keys", {
      body: { action: "revoke", key_id: keyId },
    });
    if (data?.success) {
      fetchKeys();
      toast({ title: "Key 已撤销" });
    }
  };

  const claimCredits = async () => {
    setIsClaiming(true);
    try {
      const { data } = await supabase.functions.invoke("api-keys", {
        body: { action: "claim_credits" },
      });
      if (data?.success) {
        toast({ title: "🎉 领取成功", description: data.message });
        fetchBalance();
      } else {
        toast({ title: "领取失败", description: data?.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "领取失败", variant: "destructive" });
    }
    setIsClaiming(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "已复制" });
  };

  // Calculate today's usage
  const today = new Date().toISOString().split("T")[0];
  const todayUsage = usage.filter(u => u.usage_date === today);
  const todayTotal = todayUsage.reduce((sum, u) => sum + u.request_count, 0);
  const todayCached = todayUsage.reduce((sum, u) => sum + u.cached_count, 0);
  const last7Days = usage.filter(u => {
    const d = new Date(u.usage_date);
    return d >= new Date(Date.now() - 7 * 86400000);
  });
  const weekTotal = last7Days.reduce((sum, u) => sum + u.request_count, 0);

  const hasClaimed = balance?.claimed_today ?? false;
  const remainingCredits = balance?.remaining_credits ?? 0;
  const totalCredits = balance?.total_credits ?? 0;
  const bonusCredits = balance?.bonus_credits ?? 0;
  const dailyLimit = balance?.daily_limit ?? (isPro ? 2000 : 30);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">加载中...</div>
      </div>
    );
  }

  // Login screen
  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Button variant="ghost" onClick={() => navigate("/")} className="mb-8">
            <ArrowLeft className="mr-2 h-4 w-4" />返回首页
          </Button>
          <div className="max-w-md mx-auto text-center space-y-6">
            <Key className="h-16 w-16 mx-auto mb-2 text-primary" />
            <h1 className="text-3xl font-bold">开发者控制台</h1>
            <p className="text-muted-foreground">登录后可以生成 API Key，管理用量，领取每日免费积分</p>

            {/* Email OTP Login */}
            <Card>
              <CardContent className="pt-6 space-y-3">
                {!otpSent ? (
                  <>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="输入邮箱地址"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                      />
                      <Button onClick={handleSendOtp} disabled={otpLoading} className="shrink-0">
                        {otpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4 mr-1" />}
                        发送验证码
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">无需密码，一次性验证码登录</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm">验证码已发送至 <span className="font-medium">{loginEmail}</span></p>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="输入验证码"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                        maxLength={8}
                        className="text-center tracking-widest text-lg"
                      />
                      <Button onClick={handleVerifyOtp} disabled={otpLoading} className="shrink-0">
                        {otpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "验证登录"}
                      </Button>
                    </div>
                    <Button variant="link" size="sm" onClick={() => { setOtpSent(false); setOtpCode(""); }}>
                      换一个邮箱 / 重新发送
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">或使用第三方账号</span>
              </div>
            </div>

            {/* OAuth buttons */}
            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              <Button onClick={handleGoogleLogin} size="lg" variant="outline" className="w-full">
                <img src="https://www.google.com/favicon.ico" alt="" className="w-5 h-5 mr-2" />
                使用 Google 账号登录
              </Button>
              <Button onClick={handleAppleLogin} size="lg" variant="outline" className="w-full">
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                使用 Apple 账号登录
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="开发者控制台 - API Key 管理 | ReadGZH"
        description="管理 ReadGZH API Key、查看积分使用情况、订阅与账户设置。"
        path="/dashboard"
        noindex
      />
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />首页
            </Button>
            <h1 className="text-xl font-bold">开发者控制台</h1>
            {!proLoading && (
              <Badge variant={isPro ? "default" : "secondary"} className={isPro ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0" : ""}>
                {isPro ? <><Crown className="h-3 w-3 mr-1" />{isLifetimePro ? "永久Pro" : "Pro"}</> : "Free"}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="h-8 w-40 text-sm"
                  placeholder="设置昵称"
                  onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                />
                <Button size="sm" variant="ghost" onClick={handleSaveName} disabled={nameLoading}>
                  {nameLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "保存"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>取消</Button>
              </div>
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {displayName || user.email}
                <Pencil className="h-3 w-3" />
              </button>
            )}
            <Button variant="outline" size="sm" onClick={() => void signOut()}>
              <LogOut className="mr-2 h-4 w-4" />退出
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Upgrade Banner - only show for free users */}
        {!isPro && !proLoading && (
          <Card className="border-primary/40 bg-gradient-to-r from-primary/10 to-primary/5">
            <CardContent className="pt-6 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Zap className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-semibold">升级到 Pro</p>
                  <p className="text-sm text-muted-foreground">每日 2,000 积分 · 无需每日领取 · 优先抓取队列</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleUpgrade("pro")} disabled={upgradeLoading} size="sm">
                  {upgradeLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                  ¥39/月
                </Button>
                <Button onClick={() => handleUpgrade("pro_annual")} disabled={upgradeLoading} variant="outline" size="sm">
                  ¥299/年 <Badge variant="secondary" className="ml-1 text-xs">省¥169</Badge>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pro Status Banner */}
        {isPro && (
          <Card className="border-amber-500/40 bg-gradient-to-r from-amber-500/10 to-orange-500/5">
            <CardContent className="pt-6 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Crown className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="font-semibold">{isLifetimePro ? "永久 Pro" : (subscriptionInfo ? (subscriptionInfo.interval === "year" ? "Pro 年付" : "Pro 月付") : "Pro")} 会员</p>
                  {subscriptionInfo ? (
                    <p className="text-sm text-muted-foreground">
                      每月 {dailyLimit} 积分
                      {subscriptionInfo.status === "canceling" && " · 已取消，"}
                      {subscriptionInfo.current_period_end && (
                        <>
                          {subscriptionInfo.status === "canceling" ? "有效至 " : " · 下次续费 "}
                          {new Date(subscriptionInfo.current_period_end).toLocaleDateString("zh-CN")}
                        </>
                      )}
                    </p>
                  ) : isLegacyPro ? (
                    <p className="text-sm text-muted-foreground">永久会员 · 感谢早期支持 ❤️</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">每月 {dailyLimit} 积分 · 感谢支持 ❤️</p>
                  )}
                </div>
              </div>
              {subscriptionInfo && (
                <Button onClick={handleManageSubscription} disabled={portalLoading} variant="outline" size="sm">
                  {portalLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                  管理订阅
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">今日消耗</p>
                  <p className="text-3xl font-bold">{todayTotal} <span className="text-base font-normal text-muted-foreground">积分</span></p>
                </div>
                <BarChart3 className="h-8 w-8 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">缓存命中 {todayCached} 次（不消耗积分）</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">近 7 天消耗</p>
                  <p className="text-3xl font-bold">{weekTotal} <span className="text-base font-normal text-muted-foreground">积分</span></p>
                </div>
                <BarChart3 className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{isPro ? "本月剩余积分" : "今日剩余积分"}</p>
                  <p className="text-3xl font-bold">
                    {isPro || hasClaimed ? (
                      <>{remainingCredits}<span className="text-base font-normal text-muted-foreground"> / {totalCredits}</span></>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </p>
                </div>
                <Coins className="h-8 w-8 text-primary" />
              </div>
              {bonusCredits > 0 && (
                <p className="text-xs text-primary mt-1">
                  🎁 含 {bonusCredits} 加量包积分
                  {balance?.bonus_expires_at && (
                    <span className="text-muted-foreground ml-1">
                      （{new Date(balance.bonus_expires_at).toLocaleDateString('zh-CN')} 到期）
                    </span>
                  )}
                </p>
              )}
              {isPro ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">✅ 订阅会员每月自动获得 {dailyLimit} 积分</p>
                  <Button
                    onClick={handleBuyCredits}
                    disabled={upgradeLoading}
                    size="sm"
                    variant="outline"
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {upgradeLoading ? "处理中..." : "购买加量包 (500积分 / ¥9)"}
                  </Button>
                </div>
              ) : hasClaimed ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">✅ 今日积分已领取 · 每篇文章消耗 3 积分</p>
                  <Button
                    onClick={handleBuyCredits}
                    disabled={upgradeLoading}
                    size="sm"
                    variant="outline"
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {upgradeLoading ? "处理中..." : "购买加量包 (500积分 / ¥15)"}
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={claimCredits}
                  disabled={isClaiming}
                  size="sm"
                  className="mt-3 w-full"
                >
                  <Gift className="mr-2 h-4 w-4" />
                  {isClaiming ? "领取中..." : "领取今日 30 积分"}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* New Key Alert */}
        {newKey && (
          <Card className="border-primary bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Key className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">新 API Key 已生成</h3>
              </div>
              <p className="text-sm text-destructive font-medium mb-3">⚠️ 请立即复制保存，此 Key 只会显示一次！</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-background p-3 rounded border text-sm font-mono break-all">
                  {showNewKey ? newKey : "sk_live_" + "•".repeat(36)}
                </code>
                <Button variant="outline" size="icon" onClick={() => setShowNewKey(!showNewKey)}>
                  {showNewKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(newKey)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="ghost" size="sm" className="mt-3" onClick={() => setNewKey(null)}>
                我已保存，关闭提示
              </Button>
            </CardContent>
          </Card>
        )}

        {/* API Keys Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />API Keys
            </CardTitle>
            <div className="flex items-center justify-between">
              <CardDescription>管理你的 API Key，每个账号最多 3 个活跃 Key</CardDescription>
              {keys.some(k => !k.is_active) && (
                <button
                  onClick={() => setShowRevokedKeys(!showRevokedKeys)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showRevokedKeys ? "隐藏已撤销" : `显示已撤销 (${keys.filter(k => !k.is_active).length})`}
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Input
                placeholder="Key 名称（可选，如 'Production'）"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="max-w-xs"
              />
              <Button onClick={createKey} disabled={isCreating}>
                <Plus className="mr-2 h-4 w-4" />
                {isCreating ? "创建中..." : "创建 Key"}
              </Button>
            </div>

            {keysLoading ? (
              <div className="text-muted-foreground text-sm py-4">加载中...</div>
            ) : keys.length === 0 ? (
              <div className="text-muted-foreground text-sm py-4">还没有 API Key，点击上方创建一个</div>
            ) : (
              <div className="space-y-3">
                {keys.filter(k => k.is_active || showRevokedKeys).map((key) => (
                  <div
                    key={key.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      key.is_active ? "bg-card" : "bg-muted/50 opacity-60"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{key.name}</span>
                        <Badge variant={key.is_active ? "default" : "secondary"}>
                          {key.is_active ? (key.tier === "pro_lifetime" ? "永久Pro" : key.tier) : "已撤销"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-sm text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded break-all">
                          {revealedKeys.has(key.id) && key.key_value ? key.key_value : key.key_prefix}
                        </code>
                        {key.is_active && key.key_value && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              setRevealedKeys(prev => {
                                const next = new Set(prev);
                                if (next.has(key.id)) next.delete(key.id);
                                else next.add(key.id);
                                return next;
                              });
                            }}
                          >
                            {revealedKeys.has(key.id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </Button>
                        )}
                        {key.is_active && key.key_value && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1"
                            onClick={() => copyToClipboard(key.key_value!)}
                          >
                            <Copy className="h-3 w-3" />
                            复制
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        创建于 {new Date(key.created_at).toLocaleDateString("zh-CN")}
                        {key.last_used_at && ` · 最后使用 ${new Date(key.last_used_at).toLocaleDateString("zh-CN")}`}
                        {` · 限额 ${key.daily_limit} 积分/${["lite", "pro", "pro_lifetime"].includes(key.tier) ? "月" : "天"}`}
                      </p>
                    </div>
                    {key.is_active && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => revokeKey(key.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Usage Details */}
        {usage.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />积分消耗明细（近 30 天）
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium text-muted-foreground">日期</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">消耗积分</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">缓存命中</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">实际抓取</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(
                      usage.reduce((acc, u) => {
                        if (!acc[u.usage_date]) acc[u.usage_date] = { requests: 0, cached: 0 };
                        acc[u.usage_date].requests += u.request_count;
                        acc[u.usage_date].cached += u.cached_count;
                        return acc;
                      }, {} as Record<string, { requests: number; cached: number }>)
                    )
                      .sort(([a], [b]) => b.localeCompare(a))
                      .map(([date, data]) => (
                        <tr key={date} className="border-b last:border-0">
                          <td className="py-2">{date}</td>
                          <td className="text-right py-2">{data.requests}</td>
                          <td className="text-right py-2 text-muted-foreground">{data.cached}</td>
                          <td className="text-right py-2">{data.requests - data.cached}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Credit Cost Guide */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5" />积分计费规则
            </CardTitle>
            <CardDescription>每次读取文章统一消耗积分</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-lg border bg-muted/30 text-sm">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="default">3 积分</Badge>
                <span className="font-medium">每篇文章</span>
              </div>
              <p className="text-muted-foreground">所有类型的文章（普通图文、图片消息等）统一消耗 3 积分</p>
            </div>
            <p className="text-xs text-muted-foreground mt-3">💡 已缓存文章的读取永远免费，不消耗积分</p>
          </CardContent>
        </Card>

        {/* Quick Start Guide */}
        <Card>
          <CardHeader>
            <CardTitle>快速开始</CardTitle>
            <CardDescription>在 API 请求中添加 Authorization 头即可使用</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto font-mono">
{`curl "https://api.readgzh.site/rd?url=微信文章链接" \\
  -H "Authorization: Bearer sk_live_你的Key"`}
            </pre>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
};

export default DashboardPage;
