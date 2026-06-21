import { Link } from "react-router-dom";
import { ArrowLeft, Cookie, Settings, BarChart3, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";

const Section = ({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) => (
  <section className="rounded-xl border bg-card p-6 shadow-sm">
    <div className="flex items-center gap-2.5 mb-3">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
    </div>
    <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
  </section>
);

const CookiesPage = () => (
  <div className="min-h-screen bg-background">
    <SEO
      title="Cookie 政策 | ReadGZH"
      description="ReadGZH Cookie 政策：我们使用的 Cookie 类型（必要 Cookie 与 Google Analytics 分析 Cookie）以及如何管理 Cookie。"
      path="/cookies"
      ogType="website"
    />
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <Link to="/">
        <Button variant="ghost" size="sm" className="mb-6 gap-1.5">
          <ArrowLeft className="h-4 w-4" />返回首页
        </Button>
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-foreground">Cookie 政策</h1>
        <p className="text-sm text-muted-foreground">最后更新：2026 年 6 月 21 日</p>
      </div>

      <div className="space-y-4">
        <Section icon={Cookie} title="1. 什么是 Cookie">
          <p>
            Cookie 是网站存储在您浏览器中的小型文本文件，用于记录登录状态、偏好设置和访问统计。
            ReadGZH 仅使用最少量的 Cookie 与本地存储（localStorage），以保障服务正常运行。
          </p>
        </Section>

        <Section icon={Settings} title="2. 必要 Cookie / 本地存储">
          <p>这类 Cookie 是服务运行必需的，无法关闭：</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong className="text-foreground">登录会话：</strong>保持您的账号登录状态（Supabase Auth Token）</li>
            <li><strong className="text-foreground">偏好设置：</strong>记录您在"新鲜事"等页面的已读状态</li>
            <li><strong className="text-foreground">邀请追踪：</strong>缓存邀请码，让您注册后能自动绑定邀请人</li>
          </ul>
        </Section>

        <Section icon={BarChart3} title="3. 分析 Cookie">
          <p>
            我们使用 <strong className="text-foreground">Google Analytics</strong> 收集匿名访问数据，
            包括页面浏览、停留时长、来源渠道，用于了解整体使用趋势。
            这些数据已脱敏，无法追溯到个人身份。
          </p>
          <p>您可通过浏览器的"请勿跟踪"（Do Not Track）设置或安装 GA 退出插件来阻止分析数据收集。</p>
        </Section>

        <Section icon={Settings} title="4. 管理您的 Cookie">
          <p>
            您可以通过浏览器设置随时清除或拒绝 Cookie。注意：清除登录会话 Cookie 后，
            您需要重新登录才能访问账户页面。
          </p>
          <p>主流浏览器的 Cookie 管理路径：Chrome / Edge：设置 → 隐私与安全 → Cookie；Safari：偏好设置 → 隐私。</p>
        </Section>

        <Section icon={Mail} title="5. 联系我们">
          <p>
            Cookie 或追踪相关问题，请联系{" "}
            <a href="mailto:sweeyeah@hotmail.com" className="text-primary hover:underline font-medium">
              sweeyeah@hotmail.com
            </a>
            。
          </p>
        </Section>
      </div>
    </div>
  </div>
);

export default CookiesPage;
