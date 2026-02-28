import { useEffect, useState } from "react";
import { FileText, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const StatsWidget = () => {
  const [totalArticles, setTotalArticles] = useState<number | null>(null);
  const [totalViews, setTotalViews] = useState<number | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      const { count } = await supabase.from("articles").select("*", { count: "exact", head: true });
      setTotalArticles(count ?? 0);

      const { data } = await supabase.from("articles").select("view_count");
      const views = data?.reduce((sum, row) => sum + (row.view_count || 0), 0) ?? 0;
      setTotalViews(views);
    };
    fetchStats();
  }, []);

  return (
    <div className="flex items-center gap-3 bg-card/80 backdrop-blur-md border rounded-full px-4 py-2 shadow-sm text-xs">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <FileText className="h-3.5 w-3.5 text-primary" />
        <span className="font-semibold text-foreground">
          {totalArticles !== null ? totalArticles.toLocaleString() : "–"}
        </span>
        <span>篇</span>
      </div>
      <div className="w-px h-3.5 bg-border" />
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Eye className="h-3.5 w-3.5 text-primary" />
        <span className="font-semibold text-foreground">
          {totalViews !== null ? totalViews.toLocaleString() : "–"}
        </span>
        <span>次阅读</span>
      </div>
    </div>
  );
};

export default StatsWidget;
