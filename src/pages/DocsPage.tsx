import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Copy, CheckCircle, Code, Globe, Bot, Search, BookOpen, Zap } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const SITE_URL = "https://readgzh.site";
const API_URL = "https://api.readgzh.site";

const CodeBlock = ({ children, label }: { children: string; label?: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    toast({ title: "已复制" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      {label && <div className="text-xs text-muted-foreground mb-1 font-medium">{label}</div>}
      <pre className="bg-muted/70 border rounded-lg p-4 overflow-x-auto text-sm font-mono leading-relaxed">
        <code>{children}</code>
      </pre>
      <Button
        size="icon"
        variant="ghost"
        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleCopy}
      >
        {copied ? <CheckCircle className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
};

const DocsPage = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-3 max-w-4xl flex items-center justify-between">
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回首页
            </Button>
          </Link>
          <h1 className="text-sm font-semibold">开发者文档</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 max-w-4xl space-y-10">
        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-1.5 rounded-full text-sm font-medium">
            <Code className="h-4 w-4" />
            Developer Docs
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">API & MCP 接入指南</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            让你的 AI 应用能够读取微信公众号文章。提供 REST API 和 MCP 协议两种接入方式。
          </p>
        </div>

        {/* Quick Start */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              快速开始
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              最简单的方式：直接在浏览器访问以下 URL，即可获得 AI 可读的文章页面。
            </p>
            <CodeBlock label="浏览器直接访问">
{`${API_URL}/rd?url=https://mp.weixin.qq.com/s/你的文章ID`}
            </CodeBlock>
            <p className="text-sm text-muted-foreground">
              返回一个精简的 HTML 页面，AI 可以直接读取全文内容。
            </p>
          </CardContent>
        </Card>

        {/* REST API */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              REST API
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Endpoint 1: Scrape */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">1. 抓取文章</h3>
              <p className="text-sm text-muted-foreground">
                提交微信文章链接，系统自动抓取内容并缓存，返回文章 ID 和短链接。
              </p>
              <CodeBlock label="POST 请求">
{`curl -X POST ${API_URL}/rd \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://mp.weixin.qq.com/s/xxxxx"}'`}
              </CodeBlock>
              <CodeBlock label="响应示例">
{`{
  "success": true,
  "articleId": "abc123-...",
  "slug": "s/article-title",
  "cached": false,
  "data": {
    "title": "文章标题",
    "author": "作者名",
    "content": "文章纯文本内容...",
    "publishTime": "2025-01-01",
    "sourceUrl": "https://mp.weixin.qq.com/s/..."
  }
}`}
              </CodeBlock>
            </div>

            {/* Endpoint 2: Read */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">2. 读取已缓存文章</h3>
              <p className="text-sm text-muted-foreground">
                通过 slug 或 ID 获取已缓存的文章内容（返回 HTML）。
              </p>
              <CodeBlock label="GET 请求">
{`# 通过 slug
GET ${API_URL}/rd?s=article-title

# 通过 ID
GET ${API_URL}/rd?id=abc123-...`}
              </CodeBlock>
            </div>

            {/* Endpoint 3: One-step */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">3. 一步到位（推荐）</h3>
              <p className="text-sm text-muted-foreground">
                GET 请求直接传入微信链接，自动抓取并返回可读 HTML。适合让 AI 直接访问。
              </p>
              <CodeBlock label="GET 请求">
{`GET ${API_URL}/rd?url=https://mp.weixin.qq.com/s/xxxxx`}
              </CodeBlock>
              <p className="text-sm text-muted-foreground">
                返回精简的 HTML 页面，无需额外处理即可被 AI 直接读取。
              </p>
            </div>
          </CardContent>
        </Card>

        {/* MCP Protocol */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              MCP 协议接入
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">
              支持 <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener" className="text-primary hover:underline">Model Context Protocol (MCP)</a>，
              可直接在 Claude Desktop、Cursor 等工具中使用。
            </p>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg">配置方法</h3>
              <p className="text-sm text-muted-foreground">
                在 Claude Desktop 或其他 MCP 客户端中添加以下配置：
              </p>
              <CodeBlock label="claude_desktop_config.json">
{`{
  "mcpServers": {
    "wechat-reader": {
      "url": "${API_URL}/mcp-server"
    }
  }
}`}
              </CodeBlock>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg">可用工具</h3>
              <div className="grid gap-3">
                {[
                  {
                    icon: BookOpen,
                    name: "read_wechat_article",
                    desc: "读取微信文章全文",
                    params: "url: 微信文章链接",
                  },
                  {
                    icon: Search,
                    name: "search_articles",
                    desc: "按关键词搜索已缓存文章",
                    params: "query: 搜索关键词",
                  },
                  {
                    icon: Globe,
                    name: "list_recent_articles",
                    desc: "列出最近缓存的文章",
                    params: "limit: 返回数量（可选）",
                  },
                  {
                    icon: Code,
                    name: "get_article_by_slug",
                    desc: "通过 slug 获取文章",
                    params: "slug: 文章短链接",
                  },
                ].map((tool) => (
                  <div key={tool.name} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <tool.icon className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <code className="text-sm font-semibold">{tool.name}</code>
                      <p className="text-sm text-muted-foreground">{tool.desc}</p>
                      <p className="text-xs text-muted-foreground mt-1">参数: {tool.params}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg">使用示例</h3>
              <p className="text-sm text-muted-foreground">
                配置完成后，你可以在 Claude 中这样使用：
              </p>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                <p className="font-medium">💬 你：</p>
                <p className="text-muted-foreground italic">请帮我读一下这篇微信文章 https://mp.weixin.qq.com/s/xxxxx</p>
                <p className="font-medium mt-3">🤖 Claude：</p>
                <p className="text-muted-foreground italic">好的，让我来读取这篇文章...（自动调用 read_wechat_article 工具）</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Usage Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📋 使用须知
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <ul className="list-disc pl-5 space-y-2">
              <li>支持微信公众号普通图文文章和图片消息（小绿书）两种格式</li>
              <li>仅支持微信公众号链接（mp.weixin.qq.com）</li>
              <li>文章内容会自动缓存，重复请求不会重新抓取</li>
              <li>图片消息会提取所有图片和文字描述</li>
              <li>免费使用，每天每 IP 限制 100 次调用</li>
              <li>请遵守相关法律法规，仅用于个人学习和研究</li>
            </ul>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground pb-8">
          <p>
            MCP 服务端地址：<code className="bg-muted px-2 py-0.5 rounded text-xs">{API_URL}/mcp-server</code>
          </p>
          <p className="mt-2">
            <Link to="/" className="text-primary hover:underline">← 返回首页</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default DocsPage;
