import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Search, Eye, Clock, ArrowLeft, ArrowRight, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Article {
  id: string;
  title: string;
  author: string | null;
  publish_time: string | null;
  slug: string | null;
  view_count: number;
  created_at: string;
}

const PAGE_SIZE = 24;

const ArticlesPage = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const fetchArticles = async () => {
      setLoading(true);
      let query = supabase
        .from("articles")
        .select("id, title, author, publish_time, slug, view_count, created_at", { count: "exact" });

      if (debouncedSearch) {
        query = query.or(`title.ilike.%${debouncedSearch}%,author.ilike.%${debouncedSearch}%`);
      }

      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (!error) {
        setArticles(data || []);
        setTotalCount(count || 0);
      }
      setLoading(false);
    };
    fetchArticles();
  }, [debouncedSearch, page]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="font-semibold">AI 阅读器</span>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">文章库</h1>
          <p className="text-muted-foreground">
            共 {totalCount} 篇已缓存文章，均可供 AI 直接阅读
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-8 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索文章标题或作者..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11"
          />
        </div>

        {/* Articles grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader>
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            {debouncedSearch ? `没有找到包含「${debouncedSearch}」的文章` : "暂无文章"}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map((article) => (
              <Link
                key={article.id}
                to={article.slug ? `/${article.slug}` : `/a/${article.id}`}
              >
                <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer group">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                      {article.title}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-3 mt-2 text-xs">
                      {article.author && <span>{article.author}</span>}
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {article.view_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(article.created_at).toLocaleDateString("zh-CN")}
                      </span>
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col items-center gap-3 mt-10">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage(0)}
                className="hidden sm:inline-flex"
              >
                首页
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">上一页</span>
              </Button>

              {(() => {
                const pages: (number | "ellipsis-start" | "ellipsis-end")[] = [];
                const current = page;
                const total = totalPages;

                if (total <= 7) {
                  for (let i = 0; i < total; i++) pages.push(i);
                } else {
                  pages.push(0);
                  if (current > 3) pages.push("ellipsis-start");
                  const start = Math.max(1, current - 1);
                  const end = Math.min(total - 2, current + 1);
                  for (let i = start; i <= end; i++) pages.push(i);
                  if (current < total - 4) pages.push("ellipsis-end");
                  pages.push(total - 1);
                }

                return pages.map((p, idx) =>
                  typeof p === "string" ? (
                    <span key={p} className="px-1 text-muted-foreground">···</span>
                  ) : (
                    <Button
                      key={p}
                      variant={p === current ? "default" : "outline"}
                      size="sm"
                      className="min-w-[36px]"
                      onClick={() => setPage(p)}
                    >
                      {p + 1}
                    </Button>
                  )
                );
              })()}

              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                <span className="hidden sm:inline">下一页</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(totalPages - 1)}
                className="hidden sm:inline-flex"
              >
                末页
              </Button>
            </div>
            <span className="text-xs text-muted-foreground">
              第 {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, totalCount)} 篇，共 {totalCount} 篇
            </span>
          </div>
        )}
      </main>
    </div>
  );
};

export default ArticlesPage;
