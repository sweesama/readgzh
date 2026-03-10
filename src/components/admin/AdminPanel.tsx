import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Users, FileText, Key, Activity, TrendingUp, Crown, Zap } from "lucide-react";

interface AdminStats {
  total_users: number;
  total_articles: number;
  active_api_keys: number;
  pro_users: number;
  today_requests: number;
  today_cached: number;
  today_active_users: number;
  total_requests: number;
  total_cached: number;
}

interface RecentUser {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
}

export default function AdminPanel({ onBack }: { onBack: () => void }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error: fnErr } = await supabase.functions.invoke("admin-stats");
      if (fnErr || !data?.success) {
        setError(data?.error || fnErr?.message || "无权访问");
      } else {
        setStats(data.stats);
        setRecentUsers(data.recent_users);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="text-green-400 font-mono p-6">
        <span className="animate-pulse">{">"} LOADING ADMIN MATRIX...</span>
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
    { icon: Users, label: "注册用户", value: stats.total_users, color: "text-cyan-400" },
    { icon: Crown, label: "Pro 用户", value: stats.pro_users, color: "text-amber-400" },
    { icon: FileText, label: "文章总数", value: stats.total_articles, color: "text-emerald-400" },
    { icon: Key, label: "活跃 Key", value: stats.active_api_keys, color: "text-purple-400" },
    { icon: Activity, label: "今日请求", value: stats.today_requests, color: "text-green-300" },
    { icon: Zap, label: "今日缓存命中", value: stats.today_cached, color: "text-yellow-400" },
    { icon: TrendingUp, label: "今日活跃", value: stats.today_active_users, color: "text-pink-400" },
    { icon: Activity, label: "累计请求", value: stats.total_requests, color: "text-blue-400" },
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {statCards.map((card) => (
          <div key={card.label} className="border border-green-900/60 rounded bg-black/50 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <card.icon className={`h-3.5 w-3.5 ${card.color}`} />
              <span className="text-green-600 text-xs">{card.label}</span>
            </div>
            <div className={`text-xl font-bold ${card.color}`}>
              {card.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Cache hit rate */}
      <div className="border border-green-900/60 rounded bg-black/50 p-3 mb-6">
        <span className="text-green-600 text-xs">缓存命中率</span>
        <div className="text-green-300 mt-1">
          {stats.total_requests > 0
            ? `${((stats.total_cached / stats.total_requests) * 100).toFixed(1)}%`
            : "N/A"}{" "}
          <span className="text-green-700 text-xs">
            ({stats.total_cached.toLocaleString()} / {stats.total_requests.toLocaleString()})
          </span>
        </div>
      </div>

      {/* Recent Users */}
      <div className="border border-green-900/60 rounded bg-black/50 p-3">
        <div className="text-green-600 text-xs mb-2">最近注册用户 (20)</div>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {recentUsers.map((u) => (
            <div key={u.id} className="flex items-center justify-between text-xs">
              <span className="text-green-400 truncate max-w-[200px]">
                {u.display_name || u.email || "匿名"}
              </span>
              <span className="text-green-700">
                {new Date(u.created_at).toLocaleDateString("zh-CN")}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
