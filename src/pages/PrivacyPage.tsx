import { Link } from "react-router-dom";
import { ArrowLeft, Database, Eye, Lock, Share2, UserX, Mail } from "lucide-react";
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

const PrivacyPage = () => (
  <div className="min-h-screen bg-background">
    <SEO
      title="隐私政策 | ReadGZH"
      description="ReadGZH 隐私政策：我们如何收集、使用和保护您的信息，包括访问日志、注册邮箱与 Google Analytics 匿名数据。"
      path="/privacy"
      ogType="website"
    />
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <Link to="/">
        <Button variant="ghost" size="sm" className="mb-6 gap-1.5">
          <ArrowLeft className="h-4 w-4" />返回首页
        </Button>
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-foreground">隐私政策</h1>
        <p className="text-sm text-muted-foreground">最后更新：2026 年 6 月 21 日</p>
      </div>

      <div className="space-y-4">
        <Section icon={Database} title="1. 我们收集的信息">
          <p>ReadGZH 支持完全匿名使用（无需注册），也提供可选的账户注册以获取更多额度与功能。我们收集的信息分为以下几类：</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong className="text-foreground">用户提交内容：</strong>您粘贴的微信公众号文章链接</li>
            <li><strong className="text-foreground">技术日志：</strong>IP 地址、访问时间、User-Agent，用于速率限制与防滥用（保留 7 天）</li>
            <li><strong className="text-foreground">账号信息：</strong>注册用户的邮箱、昵称、头像（可选）、API Key</li>
            <li><strong className="text-foreground">支付信息：</strong>由 Stripe 处理，我们仅保留订单号与订阅状态，<u>不接触您的银行卡号</u></li>
            <li><strong className="text-foreground">分析数据：</strong>Google Analytics 收集的匿名访问指标（已脱敏）</li>
          </ul>
        </Section>

        <Section icon={Eye} title="2. 信息的使用">
          <p>收集的信息仅用于以下目的：</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>提供文章抓取、格式转换与 AI 摘要服务</li>
            <li>防止恶意抓取与防止服务被滥用（按 IP 速率限制）</li>
            <li>账号管理、积分发放与订阅履约</li>
            <li>留言板互动通知、退款申请与系统公告</li>
            <li>分析整体使用趋势以改进产品（仅聚合数据）</li>
          </ul>
          <p>我们<strong className="text-foreground">不会</strong>将您的个人数据出售或交换给任何第三方营销机构。</p>
        </Section>

        <Section icon={Lock} title="3. 数据存储与安全">
          <p>
            数据存储于 Supabase（基于 PostgreSQL），全部表启用 Row Level Security 行级访问控制。
            数据库密码、API Key、Stripe 密钥通过密钥保管库（Vault）加密存储。
          </p>
          <p>
            转换后的文章内容会缓存在我们的服务器上以提升后续访问性能。缓存文章包含正文 HTML 与图片代理缓存，
            原始 HTML 会在 30 天后自动清理。
          </p>
        </Section>

        <Section icon={Share2} title="4. 第三方服务">
          <p>ReadGZH 使用以下第三方服务，对应的数据按其各自隐私政策处理：</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong className="text-foreground">Supabase</strong>（数据库 / 认证 / 边缘函数）</li>
            <li><strong className="text-foreground">Stripe</strong>（支付处理）</li>
            <li><strong className="text-foreground">Cloudflare</strong>（CDN 与图片代理）</li>
            <li><strong className="text-foreground">Google Analytics</strong>（匿名访问分析）</li>
            <li><strong className="text-foreground">Mailgun</strong>（事务性邮件发送）</li>
          </ul>
        </Section>

        <Section icon={UserX} title="5. 您的权利">
          <p>您对自己的数据拥有以下权利：</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong className="text-foreground">访问：</strong>登录控制台查看积分、订阅、API Key 与账单</li>
            <li><strong className="text-foreground">导出：</strong>可发邮件申请导出您的账户数据副本</li>
            <li><strong className="text-foreground">删除：</strong>可发邮件申请注销账户，我们将在 7 天内清除您的个人数据</li>
            <li><strong className="text-foreground">退订邮件：</strong>每封系统邮件底部均有一键退订链接</li>
          </ul>
        </Section>

        <Section icon={Mail} title="6. 联系我们">
          <p>
            隐私相关问题、数据请求或投诉，请联系{" "}
            <a href="mailto:sweeyeah@hotmail.com" className="text-primary hover:underline font-medium">
              sweeyeah@hotmail.com
            </a>
            ，我们会在 7 个工作日内回复。
          </p>
        </Section>
      </div>
    </div>
  </div>
);

export default PrivacyPage;
