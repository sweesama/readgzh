import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Footer from "@/components/home/Footer";
import SEO from "@/components/SEO";
import { CHANGELOG } from "@/data/changelog";

const tagColor: Record<string, string> = {
  新增: "bg-primary/10 text-primary",
  改进: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  修复: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  安全: "bg-red-500/10 text-red-600 dark:text-red-400",
  计费: "bg-green-500/10 text-green-600 dark:text-green-400",
};

const ChangelogPage = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title="更新日志 - 产品迭代记录 | ReadGZH"
        description="ReadGZH 产品更新日志，记录每一次功能上线、改进与修复。让你随时了解新变化。"
        path="/changelog"
        ogType="website"
      />
      <div className="container mx-auto px-4 py-8 flex-1 max-w-3xl">
        <Link to="/">
          <Button variant="ghost" className="mb-8">
            <ArrowLeft className="mr-2 h-4 w-4" />返回首页
          </Button>
        </Link>

        <header className="mb-10">
          <div className="inline-flex items-center gap-2 mb-3">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">更新日志</h1>
          </div>
          <p className="text-muted-foreground">
            ReadGZH 的每一次重要更新都会记录在这里。新功能、改进、修复 —— 一目了然。
          </p>
        </header>

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
                {entry.tags?.map((tag) => (
                  <span
                    key={tag}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${tagColor[tag] ?? "bg-muted text-muted-foreground"}`}
                  >
                    {tag}
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
