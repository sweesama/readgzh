import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const PrivacyPage = () => (
  <div className="min-h-screen bg-background">
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <Link to="/">
        <Button variant="ghost" size="sm" className="mb-6 gap-1.5">
          <ArrowLeft className="h-4 w-4" />返回首页
        </Button>
      </Link>
      <h1 className="text-3xl font-bold mb-6">隐私政策</h1>
      <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
        <p><strong>最后更新：</strong>2026 年 2 月 28 日</p>
        <h2 className="text-xl font-semibold text-foreground mt-6">1. 信息收集</h2>
        <p>ReadGZH 支持匿名使用（无需注册），也提供可选的账户注册以获取更多功能。我们收集以下信息：</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>您提交的微信文章链接</li>
          <li>基本访问日志（IP 地址、访问时间），用于速率限制和服务稳定性</li>
          <li>注册用户的邮箱地址，用于账户管理和 API Key 发放</li>
          <li>通过 Google Analytics 收集的匿名使用数据</li>
        </ul>
        <h2 className="text-xl font-semibold text-foreground mt-6">2. 信息使用</h2>
        <p>收集的信息仅用于：提供文章转换服务、防止滥用、改善服务质量。我们不会将您的数据出售给第三方。</p>
        <h2 className="text-xl font-semibold text-foreground mt-6">3. 数据存储</h2>
        <p>转换后的文章内容存储在我们的服务器上，以便后续访问。您提交的原始链接和转换后的内容可能被缓存以提升性能。</p>
        <h2 className="text-xl font-semibold text-foreground mt-6">4. 第三方服务</h2>
        <p>我们使用 Google Analytics 来分析网站流量。Google 的隐私政策请参阅其官方文档。</p>
        <h2 className="text-xl font-semibold text-foreground mt-6">5. 联系我们</h2>
        <p>如有隐私相关问题，请通过 GitHub 项目页面联系我们。</p>
      </div>
    </div>
  </div>
);

export default PrivacyPage;
