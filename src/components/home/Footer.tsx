import { Link } from "react-router-dom";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-10">
        {/* Top section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <img src="/logo.png" alt="ReadGZH" className="h-8 w-8" />
              <span className="font-bold text-lg text-foreground">ReadGZH</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              让 AI 读懂微信公众号。粘贴链接，一键生成 AI 可访问的页面。
            </p>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-semibold text-foreground mb-3 text-sm">资源</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/articles" className="text-muted-foreground hover:text-primary transition-colors">文章库</Link></li>
              <li><Link to="/docs" className="text-muted-foreground hover:text-primary transition-colors">开发者文档</Link></li>
              <li><Link to="/pricing" className="text-muted-foreground hover:text-primary transition-colors">定价方案</Link></li>
              <li><Link to="/dashboard" className="text-muted-foreground hover:text-primary transition-colors">开发者控制台</Link></li>
              <li><Link to="/faq" className="text-muted-foreground hover:text-primary transition-colors">常见问题 (FAQ)</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold text-foreground mb-3 text-sm">法律条款</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/privacy" className="text-muted-foreground hover:text-primary transition-colors">隐私政策</Link></li>
              <li><Link to="/terms" className="text-muted-foreground hover:text-primary transition-colors">服务条款</Link></li>
              <li><Link to="/cookies" className="text-muted-foreground hover:text-primary transition-colors">Cookie 政策</Link></li>
            </ul>
          </div>
        </div>

        {/* Divider + copyright */}
        <div className="border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>© {currentYear} ReadGZH. All rights reserved.</p>
          <p>© <span className="font-medium">Mzu</span> · <a href="https://readgzh.site" className="hover:underline">readgzh.site</a></p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
