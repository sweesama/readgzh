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
import { Copy, Key, Plus, Trash2, Gift, LogOut, ArrowLeft, Eye, EyeOff, BarChart3 } from "lucide-react";
import Footer from "@/components/home/Footer";

interface ApiKey {
  id: string;
  key_prefix: string;
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

const DashboardPage = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [usage, setUsage] = useState<UsageRecord[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showNewKey, setShowNewKey] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [keysLoading, setKeysLoading] = useState(true);

  const fetchKeys = useCallback(async () => {
    const { data } = await supabase.functions.invoke("api-keys", {
      body: { action: "list" },
    });
    if (data?.success) setKeys(data.keys);
    setKeysLoading(false);
  }, []);

  const fetchUsage = useCallback(async () => {
    const { data } = await supabase.functions.invoke("api-keys", {
      body: { action: "usage" },
    });
    if (data?.success) setUsage(data.usage);
  }, []);

  useEffect(() => {
    if (!loading && !user) return;
    if (user) {
      fetchKeys();
      fetchUsage();
    }
  }, [user, loading, fetchKeys, fetchUsage]);

  const handleLogin = async () => {
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (error) {
      toast({ title: "登录失败", description: String(error), variant: "destructive" });
    }
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
          <div className="max-w-md mx-auto text-center">
            <Key className="h-16 w-16 mx-auto mb-6 text-primary" />
            <h1 className="text-3xl font-bold mb-3">开发者控制台</h1>
            <p className="text-muted-foreground mb-8">登录后可以生成 API Key，管理用量，领取每日免费额度</p>
            <Button onClick={handleLogin} size="lg" className="w-full max-w-xs">
              <img src="https://www.google.com/favicon.ico" alt="" className="w-5 h-5 mr-2" />
              使用 Google 账号登录
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />首页
            </Button>
            <h1 className="text-xl font-bold">开发者控制台</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />退出
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">今日用量</p>
                  <p className="text-3xl font-bold">{todayTotal}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">缓存命中 {todayCached} 次</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">近 7 天总量</p>
                  <p className="text-3xl font-bold">{weekTotal}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">每日免费额度</p>
                  <p className="text-3xl font-bold">50 次/天</p>
                </div>
                <Gift className="h-8 w-8 text-primary" />
              </div>
              <Button
                onClick={claimCredits}
                disabled={isClaiming}
                size="sm"
                className="mt-3 w-full"
              >
                <Gift className="mr-2 h-4 w-4" />
                {isClaiming ? "领取中..." : "领取今日额度"}
              </Button>
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
            <CardDescription>管理你的 API Key，每个账号最多 3 个活跃 Key</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Create new key */}
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

            {/* Keys list */}
            {keysLoading ? (
              <div className="text-muted-foreground text-sm py-4">加载中...</div>
            ) : keys.length === 0 ? (
              <div className="text-muted-foreground text-sm py-4">还没有 API Key，点击上方创建一个</div>
            ) : (
              <div className="space-y-3">
                {keys.map((key) => (
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
                          {key.is_active ? key.tier : "已撤销"}
                        </Badge>
                      </div>
                      <code className="text-sm text-muted-foreground font-mono">{key.key_prefix}</code>
                      <p className="text-xs text-muted-foreground">
                        创建于 {new Date(key.created_at).toLocaleDateString("zh-CN")}
                        {key.last_used_at && ` · 最后使用 ${new Date(key.last_used_at).toLocaleDateString("zh-CN")}`}
                        {` · 限额 ${key.daily_limit} 次/天`}
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
                <BarChart3 className="h-5 w-5" />用量明细（近 30 天）
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium text-muted-foreground">日期</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">请求数</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">缓存命中</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">实际抓取</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Aggregate by date */}
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
