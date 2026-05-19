import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { ArrowLeft, Sparkles, Gift, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Footer from "@/components/home/Footer";
import SEO from "@/components/SEO";
import { CHANGELOG } from "@/data/changelog";
import { EVENTS } from "@/data/events";
import { getLatestWhatsnewDate, WHATSNEW_SEEN_KEY } from "@/lib/whatsnew";

const tagColor: Record<string, string> = {
  新增: "bg-primary/10 text-primary",
  改进: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  修复: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  安全: "bg-red-500/10 text-red-600 dark:text-red-400",
  计费: "bg-green-500/10 text-green-600 dark:text-green-400",
};

const statusBadge: Record<string, { label: string; cls: string }> = {
  active: { label: "进行中", cls: "bg-primary/10 text-primary" },
  upcoming: { label: "即将上线", cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  ended: { label: "已结束", cls: "bg-muted text-muted-foreground" },
};

const ChangelogPage = () => {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "events" ? "events" : "changelog";

  // Mark "新鲜事" as read when user visits this page
  useEffect(() => {
    try {
      localStorage.setItem(WHATSNEW_SEEN_KEY, getLatestWhatsnewDate());
    } catch {}
  }, []);

  const onTabChange = (v: string) => {
    const next = new URLSearchParams(params);
    if (v === "events") next.set("tab", "events");
    else next.delete("tab");
    setParams(next, { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title="新鲜事 - 更新日志与活动 | ReadGZH"
        description="ReadGZH 新鲜事：产品更新日志、最新活动一站直达。"
        path="/changelog"
        ogType="website"
      />
      <div className="container mx-auto px-4 py-8 flex-1 max-w-3xl">
        <Link to="/">
          <Button variant="ghost" className="mb-8">
            <ArrowLeft className="mr-2 h-4 w-4" />返回首页
          </Button>
        </Link>

        <header className="mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">新鲜事</h1>
          </div>
          <p className="text-muted-foreground">
            产品更新与最新活动，都在这里。
          </p>
        </header>

        <Tabs value={tab} onValueChange={onTabChange} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="changelog" className="gap-1.5">
              <Calendar className="h-3.5 w-3.5" />更新日志
            </TabsTrigger>
            <TabsTrigger value="events" className="gap-1.5">
              <Gift className="h-3.5 w-3.5" />活动
            </TabsTrigger>
          </TabsList>

          <TabsContent value="changelog">
            <div className="space-y-10">
              {CHANGELOG.map((entry) => (
                <article
                  key={entry.date + entry.title}
                  className="relative pl-6 border-l-2 border-border"
                >
                  <div className="absolute -left-[7px] top-2 h-3 w-3 rounded-full bg-primary" />
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <time className="text-sm font-mono text-muted-foreground">{entry.date}</time>
                    {entry.version && (
                      <Badge variant="outline" className="text-xs">{entry.version}</Badge>
                    )}
                    {entry.tags?.map((t) => (
                      <span
                        key={t}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${tagColor[t] ?? "bg-muted text-muted-foreground"}`}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <h2 className="text-lg font-semibold mb-3 text-foreground">{entry.title}</h2>
                  <ul className="space-y-1.5 text-sm text-foreground/85 list-disc pl-5 marker:text-primary/60">
                    {entry.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="events">
            {EVENTS.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">
                暂无进行中的活动，敬请期待。
              </p>
            ) : (
              <div className="space-y-6">
                {EVENTS.map((ev) => {
                  const sb = statusBadge[ev.status];
                  return (
                    <article
                      key={ev.date + ev.title}
                      className="rounded-xl border border-border bg-card p-6 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${sb.cls}`}>
                          {sb.label}
                        </span>
                        <time className="text-xs font-mono text-muted-foreground">
                          {ev.date}{ev.endDate ? ` – ${ev.endDate}` : ""}
                        </time>
                      </div>
                      <h2 className="text-xl font-semibold mb-1 text-foreground">{ev.title}</h2>
                      {ev.highlight && (
                        <p className="text-sm text-primary font-medium mb-3">{ev.highlight}</p>
                      )}
                      <ul className="space-y-1.5 text-sm text-foreground/85 list-disc pl-5 marker:text-primary/60">
                        {ev.items.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                      {ev.cta && (
                        <div className="mt-4">
                          <Link to={ev.cta.href}>
                            <Button size="sm">{ev.cta.label}</Button>
                          </Link>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <p className="mt-12 text-center text-xs text-muted-foreground">
          有想看到的功能？欢迎到{" "}
          <Link to="/comments" className="text-primary hover:underline">留言板</Link>{" "}
          告诉我们。
        </p>
      </div>

      <Footer />
    </div>
  );
};

export default ChangelogPage;
