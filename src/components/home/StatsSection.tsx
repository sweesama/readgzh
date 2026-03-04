import { useEffect, useState, useRef } from "react";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const StatsWidget = () => {
  const [totalTokens, setTotalTokens] = useState<number | null>(null);
  const [displayCount, setDisplayCount] = useState(0);
  const animRef = useRef<number>();

  useEffect(() => {
    const fetchStats = async () => {
      const { data } = await supabase.from("articles").select("content, view_count");
      if (data) {
        const totalChars = data.reduce((sum, row) => sum + (row.content?.length || 0) * Math.max(row.view_count || 1, 1), 0);
        const estimatedTokens = Math.round(totalChars * 1.2);
        setTotalTokens(estimatedTokens);
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  // Animate counting up
  useEffect(() => {
    if (totalTokens === null) return;
    const duration = 2000;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayCount(Math.round(totalTokens * eased));
      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    };

    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [totalTokens]);

  const formatTokens = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toLocaleString();
  };

  return (
    <div className="flex items-center justify-center gap-2 py-2">
      <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-full px-4 py-1.5 shadow-sm">
        <Sparkles className="h-3 w-3 text-primary animate-pulse" />
        <span className="text-xs text-muted-foreground">已帮 AI 阅读</span>
        <span className="text-sm font-bold text-primary tabular-nums tracking-tight">
          {totalTokens !== null ? formatTokens(displayCount) : "–"}
        </span>
        <span className="text-xs text-muted-foreground">tokens 的微信公众号内容</span>
      </div>
    </div>
  );
};

export default StatsWidget;
