import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Shield, Users, FileText, Key, Activity, TrendingUp, Crown, Zap, LogIn, Globe, Eye, PlusCircle, UserPlus, Gift, Sparkles, ShieldOff, CheckCircle2, Ban } from "lucide-react";

interface AdminStats {
  total_users: number;
  total_articles: number;
  active_api_keys: number;
  pro_users: number;
  lite_users: number;
  today_api_requests: number;
  today_credits_consumed: number;
  today_anon_requests: number;
  today_all_requests: number;
  today_cached: number;
  today_active_users: number;
  today_new_articles: number;
  total_api_requests: number;
  total_credits_consumed: number;
  total_anon_requests: number;
  total_all_requests: number;
  total_cached: number;
  total_views: number;
  referrals_total: number;
  referrals_rewarded: number;
  referrals_pending: number;
  referrals_invalid: number;
  referrals_today: number;
  referral_credits_granted: number;
  referral_credits_consumed: number;
  welcome_credits_granted: number;
  welcome_credits_consumed: number;
}

interface RecentUser {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
}

interface TopInviter {
  user_id: string;
  label: string;
  rewarded_count: number;
  credits_earned: number;
}

interface RecentReferral {
  id: string;
  inviter: string;
  invitee: string;
  status: string;
  reward_amount: number | null;
  created_at: string;
  rewarded_at: string | null;
}

interface AnonBreakdownBucket {
  attempted: number;
  allowed: number;
  blocked: number;
}
interface AnonBreakdown {
  article: AnonBreakdownBucket;
  image: AnonBreakdownBucket;
  top_article_ips: { ip: string; attempts: number }[];
  top_image_ips: { ip: string; attempts: number }[];
}

export default function AdminPanel({ onBack }: { onBack: () => void }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [topInviters, setTopInviters] = useState<TopInviter[]>([]);
  const [recentReferrals, setRecentReferrals] = useState<RecentReferral[]>([]);
  const [anonBreakdown, setAnonBreakdown] = useState<AnonBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    setError("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setNeedsLogin(true);
      setLoading(false);
      return;
    }
    setNeedsLogin(false);
    const { data, error: fnErr } = await supabase.functions.invoke("admin-stats");
    if (fnErr || !data?.success) {
      setError(data?.error || fnErr?.message || "无权访问");
    } else {
      setStats(data.stats);
      setRecentUsers(data.recent_users || []);
      setTopInviters(data.top_inviters || []);
      setRecentReferrals(data.recent_referrals || []);
      setAnonBreakdown(data.anon_breakdown || null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();

    // Listen for auth changes (e.g., after Google login redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        fetchStats();
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    setSigningIn(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (error) {
        setError("登录失败: " + (error as any)?.message || "未知错误");
        setSigningIn(false);
      }
    } catch (e) {
      setError("登录失败");
      setSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="text-green-400 font-mono p-6">
        <span className="animate-pulse">{">"} LOADING ADMIN MATRIX...</span>
      </div>
    );
  }

  if (needsLogin) {
    return (
      <div className="font-mono text-sm p-6">
        <div className="flex items-center gap-2 text-amber-400 mb-4">
          <Shield className="h-4 w-4" />
          <span>ADMIN AUTHENTICATION REQUIRED</span>
        </div>
        <p className="text-green-600 mb-4">{">"} 需要管理员身份验证才能访问系统控制台。</p>
        <button
          onClick={handleGoogleLogin}
          disabled={signingIn}
          className="flex items-center gap-2 px-4 py-2 border border-green-700 rounded bg-green-950/50 text-green-400 hover:bg-green-900/50 transition-colors text-sm disabled:opacity-50"
        >
          <LogIn className="h-4 w-4" />
          {signingIn ? "正在跳转..." : "使用 Google 账号登录"}
        </button>
        <button onClick={onBack} className="mt-4 block text-green-700 hover:text-green-400 text-xs">
          [ESC] 返回终端
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-400 font-mono p-6">
        <p>{">"} ACCESS DENIED: {error}</p>
        <button onClick={onBack} className="mt-4 text-green-400 underline text-sm">← 返回终端</button>
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    { icon: Users, label: "注册用户数", value: stats.total_users ?? 0, color: "text-cyan-400" },
    { icon: Crown, label: "Pro 付费用户", value: stats.pro_users ?? 0, color: "text-amber-400", sub: `Lite: ${stats.lite_users ?? 0}` },
    { icon: FileText, label: "文章库总数", value: stats.total_articles ?? 0, color: "text-emerald-400" },
    { icon: Key, label: "活跃 API Key", value: stats.active_api_keys ?? 0, color: "text-purple-400" },
    { icon: Activity, label: "今日 API 请求次数", value: stats.today_api_requests ?? 0, color: "text-green-300", sub: `匿名访客: ${stats.today_anon_requests ?? 0} 次` },
    { icon: Zap, label: "今日消耗积分", value: stats.today_credits_consumed ?? 0, color: "text-fuchsia-400", sub: "3 积分 / 次请求" },
    { icon: PlusCircle, label: "今日新增文章", value: stats.today_new_articles ?? 0, color: "text-orange-400" },
    { icon: Zap, label: "今日缓存命中", value: stats.today_cached ?? 0, color: "text-yellow-400" },
    { icon: TrendingUp, label: "今日活跃用户", value: stats.today_active_users ?? 0, color: "text-pink-400" },
    { icon: Eye, label: "累计文章浏览", value: stats.total_views ?? 0, color: "text-teal-400" },
    { icon: Globe, label: "累计 API 请求", value: stats.total_api_requests ?? 0, color: "text-blue-400", sub: `匿名累计: ${stats.total_anon_requests ?? 0}` },
    { icon: Zap, label: "累计消耗积分", value: stats.total_credits_consumed ?? 0, color: "text-fuchsia-300" },
  ];

  return (
    <div className="font-mono text-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-green-300">
          <Shield className="h-4 w-4" />
          <span>ADMIN CONSOLE — SYSTEM OVERVIEW</span>
        </div>
        <button onClick={onBack} className="text-green-600 hover:text-green-400 text-xs">
          [ESC] 返回终端
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {statCards.map((card) => (
          <div key={card.label} className="border border-green-900/60 rounded bg-black/50 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <card.icon className={`h-3.5 w-3.5 ${card.color}`} />
              <span className="text-green-600 text-xs">{card.label}</span>
            </div>
            <div className={`text-xl font-bold ${card.color}`}>
              {(card.value ?? 0).toLocaleString()}
            </div>
            {(card as any).sub && (
              <div className="text-green-700 text-[10px] mt-0.5">{(card as any).sub}</div>
            )}
          </div>
        ))}
      </div>

      {/* Cache hit rate */}
      <div className="border border-green-900/60 rounded bg-black/50 p-3 mb-6">
        <span className="text-green-600 text-xs">API 缓存命中率</span>
        <div className="text-green-300 mt-1">
          {(stats.total_api_requests ?? 0) > 0
            ? `${(((stats.total_cached ?? 0) / (stats.total_api_requests ?? 1)) * 100).toFixed(1)}%`
            : "N/A"}{" "}
          <span className="text-green-700 text-xs">
            ({(stats.total_cached ?? 0).toLocaleString()} / {(stats.total_api_requests ?? 0).toLocaleString()})
          </span>
        </div>
      </div>

      {/* Anonymous traffic breakdown */}
      {anonBreakdown && (
        <div className="mb-6">
          <div className="flex items-center gap-2 text-green-300 mb-2">
            <ShieldOff className="h-4 w-4" />
            <span>今日匿名流量拆解 — ANON TRAFFIC</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { title: "文章读取 /rd（上限 10 次/IP/天）", data: anonBreakdown.article, top: anonBreakdown.top_article_ips, hint: "有效 = 真正进到抓取器；被拦 = 超限直接 429（不消耗积分）" },
              { title: "图片代理（上限 500 次/IP/天）", data: anonBreakdown.image, top: anonBreakdown.top_image_ips, hint: "有效 = 真正代理了图片；被拦 = 超限直接 403/429" },
            ].map((sec) => {
              const total = sec.data.attempted || 0;
              const blockRate = total > 0 ? ((sec.data.blocked / total) * 100).toFixed(1) : "0";
              return (
                <div key={sec.title} className="border border-green-900/60 rounded bg-black/50 p-3">
                  <div className="text-green-500 text-xs mb-2">{sec.title}</div>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-1 text-green-700 text-[10px]"><Activity className="h-3 w-3" />尝试总数</div>
                      <div className="text-cyan-300 text-lg font-bold tabular-nums">{sec.data.attempted.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-green-700 text-[10px]"><CheckCircle2 className="h-3 w-3" />有效放行</div>
                      <div className="text-emerald-400 text-lg font-bold tabular-nums">{sec.data.allowed.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-green-700 text-[10px]"><Ban className="h-3 w-3" />被拦截</div>
                      <div className="text-red-400 text-lg font-bold tabular-nums">
                        {sec.data.blocked.toLocaleString()}
                        <span className="text-red-700 text-[10px] ml-1">({blockRate}%)</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-green-800 text-[10px] mb-2">{sec.hint}</div>
                  {sec.top.length > 0 && (
                    <div className="border-t border-green-900/40 pt-2">
                      <div className="text-green-600 text-[10px] mb-1">Top 5 高频 IP</div>
                      <div className="space-y-0.5">
                        {sec.top.map((ip, i) => (
                          <div key={ip.ip} className="flex items-center justify-between text-[11px]">
                            <span className="text-green-700 w-4 shrink-0">#{i + 1}</span>
                            <span className="text-green-400 truncate min-w-0 flex-1 font-mono">{ip.ip}</span>
                            <span className={`shrink-0 tabular-nums ${ip.attempts > (sec.title.startsWith("图片") ? 500 : 10) ? "text-red-400" : "text-amber-400"}`}>
                              {ip.attempts} 次
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* Referral Section */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-green-300 mb-2">
          <Gift className="h-4 w-4" />
          <span>邀请活动 — REFERRAL PROGRAM</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
          {[
            { icon: UserPlus, label: "邀请关系总数", value: stats.referrals_total ?? 0, color: "text-cyan-400", sub: `今日新增: ${stats.referrals_today ?? 0}` },
            { icon: Sparkles, label: "已发放奖励笔数", value: stats.referrals_rewarded ?? 0, color: "text-emerald-400" },
            { icon: Activity, label: "待激活 (未首读)", value: stats.referrals_pending ?? 0, color: "text-amber-400" },
            { icon: Shield, label: "已作废", value: stats.referrals_invalid ?? 0, color: "text-red-400" },
            { icon: Zap, label: "邀请人累计积分", value: stats.referral_credits_granted ?? 0, color: "text-fuchsia-400", sub: `已消耗: ${stats.referral_credits_consumed ?? 0}` },
            { icon: Gift, label: "新人欢迎积分", value: stats.welcome_credits_granted ?? 0, color: "text-purple-400", sub: `已消耗: ${stats.welcome_credits_consumed ?? 0}` },
            { icon: TrendingUp, label: "活动总发放积分", value: (stats.referral_credits_granted ?? 0) + (stats.welcome_credits_granted ?? 0), color: "text-yellow-400" },
            { icon: Users, label: "新用户带来占比", value: (stats.total_users ?? 0) > 0 ? Math.round(((stats.referrals_total ?? 0) / stats.total_users) * 1000) / 10 : 0, color: "text-pink-400", sub: "% 注册来自邀请" },
          ].map((card) => (
            <div key={card.label} className="border border-green-900/60 rounded bg-black/50 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <card.icon className={`h-3.5 w-3.5 ${card.color}`} />
                <span className="text-green-600 text-xs">{card.label}</span>
              </div>
              <div className={`text-xl font-bold ${card.color}`}>
                {(card.value ?? 0).toLocaleString()}
              </div>
              {(card as any).sub && (
                <div className="text-green-700 text-[10px] mt-0.5">{(card as any).sub}</div>
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Top inviters */}
          <div className="border border-green-900/60 rounded bg-black/50 p-3">
            <div className="text-green-600 text-xs mb-2">邀请排行榜 Top 10</div>
            {topInviters.length === 0 ? (
              <div className="text-green-700 text-xs">暂无数据</div>
            ) : (
              <div className="space-y-1">
                {topInviters.map((u, i) => (
                  <div key={u.user_id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-green-700 w-5 shrink-0 tabular-nums">#{i + 1}</span>
                    <span className="text-green-400 truncate min-w-0 flex-1">{u.label}</span>
                    <span className="text-amber-400 shrink-0 tabular-nums">{u.rewarded_count} 人</span>
                    <span className="text-fuchsia-400 shrink-0 tabular-nums w-16 text-right">{u.credits_earned} 积分</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent referrals */}
          <div className="border border-green-900/60 rounded bg-black/50 p-3">
            <div className="text-green-600 text-xs mb-2">最近邀请关系 ({recentReferrals.length})</div>
            {recentReferrals.length === 0 ? (
              <div className="text-green-700 text-xs">暂无数据</div>
            ) : (
              <div className="space-y-1 max-h-56 overflow-y-auto pr-2 scrollbar-thin">
                {recentReferrals.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-green-400 truncate min-w-0 flex-1">
                      {r.inviter} <span className="text-green-700">→</span> {r.invitee}
                    </span>
                    <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${
                      r.status === "rewarded" ? "text-emerald-400 border-emerald-800" :
                      r.status === "invalid" ? "text-red-400 border-red-800" :
                      "text-amber-400 border-amber-800"
                    }`}>
                      {r.status === "rewarded" ? `+${r.reward_amount ?? 0}` : r.status === "invalid" ? "作废" : "待激活"}
                    </span>
                    <span className="text-green-700 shrink-0 tabular-nums">
                      {new Date(r.created_at).toLocaleDateString("zh-CN")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Users */}
      <div className="border border-green-900/60 rounded bg-black/50 p-3">
        <div className="text-green-600 text-xs mb-2">最近注册用户 ({recentUsers.length})</div>
        <div className="space-y-1 max-h-72 overflow-y-auto pr-3 scrollbar-thin">
          {recentUsers.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-green-400 truncate min-w-0 flex-1">
                {u.display_name || u.email || "匿名"}
              </span>
              <span className="text-green-700 shrink-0 tabular-nums">
                {new Date(u.created_at).toLocaleDateString("zh-CN")}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
