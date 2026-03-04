import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Copy, CheckCircle, Code, Globe, Bot, Search, BookOpen, Zap, Key, Cog } from "lucide-react";
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

        {/* ChatGPT Action */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              ChatGPT Action 接入（自定义 GPTs）
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">
              你可以将 ReadGZH 集成为 ChatGPT 的自定义 Action，让你的 GPTs 能直接读取微信文章。
            </p>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg">1. 创建或编辑 GPTs</h3>
              <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
                <li>打开 <a href="https://chat.openai.com/gpts/editor" target="_blank" rel="noopener" className="text-primary hover:underline">ChatGPT GPTs 编辑器</a></li>
                <li>点击「Configure」→「Actions」→「Create new action」</li>
                <li>在 Schema 输入框中选择「Import from URL」</li>
              </ol>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg">2. 导入 OpenAPI 规范</h3>
              <p className="text-sm text-muted-foreground">
                粘贴以下 URL 导入 API 定义：
              </p>
              <CodeBlock label="OpenAPI Spec URL">
{`https://readgzh.site/.well-known/openapi.yaml`}
              </CodeBlock>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg">3. 配置鉴权</h3>
              <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
                <li>Authentication Type 选择「API Key」</li>
                <li>Auth Type 选择「Bearer」</li>
                <li>粘贴你的 API Key（<code className="bg-muted px-1.5 py-0.5 rounded text-xs">sk_live_...</code>，可在 <Link to="/dashboard" className="text-primary hover:underline">控制台</Link> 创建）</li>
              </ol>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg">4. 设置 GPTs 指令</h3>
              <p className="text-sm text-muted-foreground">
                在 GPTs 的 Instructions 中添加以下内容：
              </p>
              <CodeBlock label="GPTs Instructions 示例">
{`当用户分享微信公众号文章链接（mp.weixin.qq.com）时，
使用 readWeChatArticle action 读取文章全文内容，
然后根据用户需求进行总结、翻译或分析。`}
              </CodeBlock>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg">5. 测试</h3>
              <p className="text-sm text-muted-foreground">
                保存后，在 GPTs 对话中发送一个微信文章链接，GPTs 会自动调用 ReadGZH 读取全文。
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
    "readgzh": {
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

        {/* OpenClaw Skills */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cog className="h-5 w-5 text-primary" />
              OpenClaw Skills 接入
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">
              ReadGZH 提供原生 <a href="https://docs.openclaw.ai/tools/creating-skills" target="_blank" rel="noopener" className="text-primary hover:underline">OpenClaw Skill</a> 支持，
              可直接在 OpenClaw 中使用微信文章读取能力。
            </p>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg">方式一：通过 MCP 接入（推荐）</h3>
              <p className="text-sm text-muted-foreground">
                OpenClaw 原生支持 MCP 协议。只需在 OpenClaw 的 MCP 配置中添加 ReadGZH 服务即可：
              </p>
              <CodeBlock label="OpenClaw MCP 配置">
{`{
  "mcpServers": {
    "readgzh": {
      "url": "${API_URL}/mcp-server"
    }
  }
}`}
              </CodeBlock>
              <p className="text-sm text-muted-foreground">
                配置完成后，OpenClaw 会自动发现 <code className="bg-muted px-1.5 py-0.5 rounded text-xs">read_wechat_article</code>、
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">search_articles</code> 等工具。
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg">方式二：一键安装 Skill</h3>
              <p className="text-sm text-muted-foreground">
                如果 ReadGZH 已发布到 ClawHub，可直接一键安装：
              </p>
              <CodeBlock label="通过 ClawHub 安装（推荐）">
{`clawhub install readgzh`}
              </CodeBlock>
              <p className="text-sm text-muted-foreground">或者手动下载安装：</p>
              <CodeBlock label="手动安装">
{`mkdir -p ~/.openclaw/workspace/skills/readgzh
curl -o ~/.openclaw/workspace/skills/readgzh/SKILL.md \\
  https://readgzh.site/.well-known/SKILL.md`}
              </CodeBlock>
              <p className="text-sm text-muted-foreground">
                安装后重启 OpenClaw，当用户提到「微信」「公众号」或分享 mp.weixin.qq.com 链接时，Skill 会自动触发。
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg">配置 API Key（可选）</h3>
              <p className="text-sm text-muted-foreground">
                如需使用带鉴权的 API（更高配额），在 Skill 配置中添加 API Key：
              </p>
              <CodeBlock label="config.yaml">
{`api_key: "sk_live_你的Key"`}
              </CodeBlock>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg">使用示例</h3>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                <p className="font-medium">💬 你：</p>
                <p className="text-muted-foreground italic">帮我读一下这篇微信文章 https://mp.weixin.qq.com/s/xxxxx</p>
                <p className="font-medium mt-3">🤖 OpenClaw：</p>
                <p className="text-muted-foreground italic">正在使用 readgzh skill 读取文章...（自动调用 read_wechat_article）</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Key Authentication */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              API Key 鉴权
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">
              网页版免费使用，无需 Key。API 调用需要携带 API Key，可在{" "}
              <Link to="/dashboard" className="text-primary hover:underline">开发者控制台</Link> 免费创建。
            </p>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg">获取 API Key</h3>
              <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
                <li>前往 <Link to="/dashboard" className="text-primary hover:underline">开发者控制台</Link>，使用 Google 账号登录</li>
                <li>点击「创建 Key」生成一个 <code className="bg-muted px-1.5 py-0.5 rounded text-xs">sk_live_...</code> 格式的密钥</li>
                <li>每天点击「领取今日积分」获取 50 积分（简单文章 1 积分，复杂文章 2 积分）</li>
                <li>需要更多积分？查看 <Link to="/pricing" className="text-primary hover:underline">定价方案</Link></li>
              </ol>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg">使用方式</h3>
              <p className="text-sm text-muted-foreground">
                在请求中添加 <code className="bg-muted px-1.5 py-0.5 rounded text-xs">Authorization</code> 头：
              </p>
              <CodeBlock label="带鉴权的 API 请求">
{`curl "${API_URL}/rd?url=https://mp.weixin.qq.com/s/xxxxx" \\
  -H "Authorization: Bearer sk_live_你的Key"`}
              </CodeBlock>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg">错误响应</h3>
              <div className="grid gap-2 text-sm">
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <code className="font-semibold text-destructive shrink-0">401</code>
                  <div>
                    <p className="text-muted-foreground">未提供 API Key 或 Key 无效</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <code className="font-semibold text-destructive shrink-0">429</code>
                  <div>
                    <p className="text-muted-foreground">已达每日调用上限，响应头包含 <code className="bg-muted px-1 rounded text-xs">X-RateLimit-Remaining</code></p>
                  </div>
                </div>
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
              <li>网页版免费使用；API 调用需要 Key，每日 50 积分（需领取）</li>
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
