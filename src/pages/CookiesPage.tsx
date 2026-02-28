import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const CookiesPage = () => (
  <div className="min-h-screen bg-background">
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <Link to="/">
        <Button variant="ghost" size="sm" className="mb-6 gap-1.5">
          <ArrowLeft className="h-4 w-4" />返回首页
        </Button>
      </Link>
      <h1 className="text-3xl font-bold mb-6">Cookie 政策</h1>
      <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
        <p><strong>最后更新：</strong>2026 年 2 月 28 日</p>
        <h2 className="text-xl font-semibold text-foreground mt-6">1. 什么是 Cookie</h2>
        <p>Cookie 是存储在您浏览器中的小型文本文件，用于记录您的偏好和使用习惯。</p>
        <h2 className="text-xl font-semibold text-foreground mt-6">2. 我们使用的 Cookie</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>必要 Cookie：</strong>用于网站基本功能运行</li>
          <li><strong>分析 Cookie：</strong>Google Analytics 使用 Cookie 收集匿名使用数据，帮助我们了解网站使用情况</li>
        </ul>
        <h2 className="text-xl font-semibold text-foreground mt-6">3. 管理 Cookie</h2>
        <p>您可以通过浏览器设置管理或删除 Cookie。禁用 Cookie 可能影响网站部分功能。</p>
      </div>
    </div>
  </div>
);

export default CookiesPage;
