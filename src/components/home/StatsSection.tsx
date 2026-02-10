import { useEffect, useState } from "react";
import { FileText, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const StatsSection = () => {
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
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="grid grid-cols-2 gap-6">
          <div className="flex flex-col items-center gap-2 p-6 rounded-2xl border bg-card">
            <FileText className="h-6 w-6 text-primary mb-1" />
            <span className="text-3xl font-bold text-foreground">
              {totalArticles !== null ? totalArticles.toLocaleString() : "–"}
            </span>
            <span className="text-sm text-muted-foreground">已转换文章</span>
          </div>
          <div className="flex flex-col items-center gap-2 p-6 rounded-2xl border bg-card">
            <Eye className="h-6 w-6 text-primary mb-1" />
            <span className="text-3xl font-bold text-foreground">
              {totalViews !== null ? totalViews.toLocaleString() : "–"}
            </span>
            <span className="text-sm text-muted-foreground">累计阅读</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsSection;
