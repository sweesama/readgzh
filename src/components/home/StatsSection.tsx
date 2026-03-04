import { useEffect, useState, useRef } from "react";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const StatsWidget = () => {
  const [totalArticles, setTotalArticles] = useState<number | null>(null);
  const [displayCount, setDisplayCount] = useState(0);
  const animRef = useRef<number>();

  useEffect(() => {
    const fetchStats = async () => {
      const { count } = await supabase.from("articles").select("*", { count: "exact", head: true });
      setTotalArticles(count ?? 0);
    };
    fetchStats();
  }, []);

  // Animate counting up
  useEffect(() => {
    if (totalArticles === null) return;
    // Estimate ~2000 tokens per article average
    const targetTokens = totalArticles * 2000;
    const duration = 2000;
    const startTime = performance.now();
    const startVal = 0;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayCount(Math.round(startVal + (targetTokens - startVal) * eased));
      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    };

    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [totalArticles]);

  const formatTokens = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toLocaleString();
  };

  return (
    <div className="flex items-center justify-center gap-2 py-4">
      <div className="inline-flex items-center gap-2 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-full px-5 py-2.5 shadow-sm">
        <Sparkles className="h-4 w-4 text-primary animate-pulse" />
        <span className="text-sm text-muted-foreground">已帮 AI 阅读</span>
        <span className="text-lg font-bold text-primary tabular-nums tracking-tight">
          {totalArticles !== null ? formatTokens(displayCount) : "–"}
        </span>
        <span className="text-sm text-muted-foreground">tokens 的微信公众号内容</span>
      </div>
    </div>
  );
};

export default StatsWidget;
