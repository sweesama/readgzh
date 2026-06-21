import { Link } from "react-router-dom";
import { ArrowLeft, FileText, Shield, AlertTriangle, Mail } from "lucide-react";
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

const TermsPage = () => (
  <div className="min-h-screen bg-background">
    <SEO
      title="服务条款 | ReadGZH"
      description="ReadGZH 服务条款：服务描述、使用规则、免责声明与知识产权说明。本服务仅用于个人学习和研究目的。"
      path="/terms"
      ogType="website"
    />
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <Link to="/">
        <Button variant="ghost" size="sm" className="mb-6 gap-1.5">
          <ArrowLeft className="h-4 w-4" />返回首页
        </Button>
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-foreground">服务条款</h1>
        <p className="text-sm text-muted-foreground">最后更新：2026 年 6 月 21 日</p>
      </div>

      <div className="space-y-4">
        <Section icon={FileText} title="1. 服务描述">
          <p>
            ReadGZH（readgzh.site）是一款将微信公众号公开文章链接转换为 AI
            工具可访问格式的工具。我们的工作原理类似浏览器：访问任何人都能打开的公开 URL，
            将渲染后的内容缓存为干净的 HTML，供 ChatGPT、Claude、Perplexity 等 AI 客户端调用。
          </p>
          <p>本服务面向开发者、研究者和重度 AI 用户，不替代微信原生的阅读体验。</p>
        </Section>

        <Section icon={Shield} title="2. 使用规则">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>不得将本服务用于任何违法、侵权或骚扰活动</li>
            <li>不得绕过免费配额、积分体系或速率限制进行大规模自动化抓取</li>
            <li>不得反向工程、商业转售本服务的 API 接口</li>
            <li>转换后的文章内容版权归原作者所有，仅供个人学习与研究使用</li>
            <li>账号 / API Key 不得多人共享，违规账号将被冻结且不予退款</li>
          </ul>
        </Section>

        <Section icon={AlertTriangle} title="3. 免责声明">
          <p>
            ReadGZH 不对转换内容的准确性、完整性、时效性提供任何保证。文章内容由原作者发布，
            ReadGZH 仅承担"公开 URL 抓取与格式化"的技术职能，不对内容立场承担责任。
          </p>
          <p>
            服务按"现状"提供。我们保留在合理范围内修改、暂停或终止服务的权利，
            付费用户的剩余权益将按未消耗比例退款或迁移。
          </p>
        </Section>

        <Section icon={Mail} title="4. 知识产权与内容下架">
          <p>
            转换的文章内容版权归原始发布者所有。ReadGZH 仅访问公开可访问的微信文章链接，
            缓存为 AI 可读格式，<strong className="text-foreground">不主张</strong>对转换内容的任何权利。
          </p>
          <p>
            如您是原作者或权利人，希望下架某篇已缓存的文章，请发送邮件至{" "}
            <a
              href="mailto:sweeyeah@hotmail.com?subject=ReadGZH%20%E5%86%85%E5%AE%B9%E4%B8%8B%E6%9E%B6%E7%94%B3%E8%AF%B7"
              className="text-primary hover:underline font-medium"
            >
              sweeyeah@hotmail.com
            </a>
            ，邮件中请包含：
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>需下架的文章链接（ReadGZH 的 <code className="text-xs bg-muted px-1 py-0.5 rounded">/s/...</code> 链接，或原始微信链接）</li>
            <li>身份说明（作者本人 / 公众号运营方 / 权利代理人）</li>
            <li>简要的下架理由</li>
          </ul>
          <p>
            我们将在 24–48 小时内核实并删除相关缓存内容（包括文章正文、原始 HTML 与图片缓存）。
            紧急下架需求请在邮件标题注明"紧急"。
          </p>
        </Section>

        <Section icon={Mail} title="5. 联系方式">
          <p>
            其他服务相关问题，可通过留言板或发邮件至{" "}
            <a href="mailto:sweeyeah@hotmail.com" className="text-primary hover:underline font-medium">
              sweeyeah@hotmail.com
            </a>{" "}
            与我们联系。
          </p>
        </Section>
      </div>
    </div>
  </div>
);

export default TermsPage;
