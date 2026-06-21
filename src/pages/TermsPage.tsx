import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";

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
      <h1 className="text-3xl font-bold mb-6">服务条款</h1>
      <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
        <p><strong>最后更新：</strong>2026 年 2 月 28 日</p>
        <h2 className="text-xl font-semibold text-foreground mt-6">1. 服务描述</h2>
        <p>ReadGZH 提供微信公众号文章转换服务，将微信文章转换为 AI 工具可访问的格式。本服务仅用于个人学习和研究目的。</p>
        <h2 className="text-xl font-semibold text-foreground mt-6">2. 使用规则</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>不得将本服务用于任何违法活动</li>
          <li>不得大规模自动化抓取或滥用服务</li>
          <li>不得侵犯原始内容作者的合法权益</li>
          <li>转换的内容版权归原作者所有</li>
        </ul>
        <h2 className="text-xl font-semibold text-foreground mt-6">3. 免责声明</h2>
        <p>ReadGZH 不对转换内容的准确性、完整性负责。服务按"现状"提供，不提供任何形式的保证。我们保留随时修改或中断服务的权利。</p>
        <h2 className="text-xl font-semibold text-foreground mt-6">4. 知识产权与内容下架</h2>
        <p>通过本服务转换的文章内容版权归原始发布者所有。ReadGZH 仅访问公开可访问的微信文章链接并缓存为 AI 可读格式，不主张对转换内容的任何权利。</p>
        <p>如您是原作者或权利人，希望下架某篇已缓存的文章，请发送邮件至 <a href="mailto:sweeyeah@hotmail.com" className="text-primary hover:underline">sweeyeah@hotmail.com</a>，并在邮件中包含：</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>需要下架的文章链接（ReadGZH 上的 <code>/s/...</code> 链接，或原始微信链接）</li>
          <li>您的身份说明（作者本人 / 公众号运营方 / 权利代理人）</li>
          <li>简要的下架理由</li>
        </ul>
        <p>我们会在收到投诉后 24-48 小时内核实并删除相关缓存内容（包括文章正文、原始 HTML 与图片缓存）。</p>
      </div>
    </div>
  </div>
);

export default TermsPage;
